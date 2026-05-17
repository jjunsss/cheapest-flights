import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  ExchangeRateSnapshot,
  FlightCandidate,
  FlightRunDetail,
  FlightRunStatus,
  NormalizedProvider,
  ProviderRunSummary,
  SearchTask,
  SearchTaskStatus
} from "../shared/types.js";
import { DB_PATH } from "./paths.js";
import { rankCandidates } from "./domain/ranking.js";

export type AppDatabase = Database.Database;

export interface RunRow {
  id: string;
  params_json: string;
  exchange_rates_json: string;
  warnings_json: string;
  started_at: string;
  finished_at: string | null;
  status: FlightRunStatus;
}

export interface NewTaskInput {
  id: string;
  runId: string;
  provider: NormalizedProvider;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
}

export function openDatabase(dbPath = DB_PATH): AppDatabase {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: AppDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      params_json TEXT NOT NULL,
      exchange_rates_json TEXT NOT NULL,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_runs (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      error TEXT,
      n_results INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS search_tasks (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      depart_date TEXT NOT NULL,
      return_date TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      depart_date TEXT NOT NULL,
      return_date TEXT NOT NULL,
      stay_days INTEGER NOT NULL,
      price_total REAL NOT NULL,
      price_currency TEXT NOT NULL,
      price_krw REAL,
      price_includes_json TEXT NOT NULL,
      price_per_adult INTEGER NOT NULL,
      outbound_direct INTEGER,
      return_direct INTEGER,
      direct_verification TEXT NOT NULL,
      booking_url TEXT,
      captured_at TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS captures (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload_path TEXT NOT NULL,
      redacted INTEGER NOT NULL DEFAULT 1,
      captured_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_dedupe
      ON candidates(run_id, provider, origin, destination, depart_date, return_date, price_total, price_currency, captured_at);
    CREATE INDEX IF NOT EXISTS idx_candidates_run_price ON candidates(run_id, price_krw);
    CREATE INDEX IF NOT EXISTS idx_candidates_run_provider ON candidates(run_id, provider);
    CREATE INDEX IF NOT EXISTS idx_tasks_resume ON search_tasks(run_id, provider, status, depart_date, return_date);
    CREATE INDEX IF NOT EXISTS idx_provider_runs_run_provider ON provider_runs(run_id, provider);
  `);
}

export function insertRun(
  db: AppDatabase,
  id: string,
  params: unknown,
  exchangeRates: ExchangeRateSnapshot,
  warnings: string[]
): void {
  db.prepare(
    `INSERT INTO runs (id, params_json, exchange_rates_json, warnings_json, started_at, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, JSON.stringify(params), JSON.stringify(exchangeRates), JSON.stringify(warnings), new Date().toISOString(), "queued");
}

export function getRunRow(db: AppDatabase, runId: string): RunRow | null {
  return (
    db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId) as RunRow | undefined
  ) ?? null;
}

export function updateRunStatus(
  db: AppDatabase,
  runId: string,
  status: FlightRunStatus,
  finished = false
): void {
  db.prepare(`UPDATE runs SET status = ?, finished_at = COALESCE(?, finished_at) WHERE id = ?`).run(
    status,
    finished ? new Date().toISOString() : null,
    runId
  );
}

export function appendRunWarnings(db: AppDatabase, runId: string, warnings: string[]): void {
  if (warnings.length === 0) return;
  const row = getRunRow(db, runId);
  if (!row) return;
  const current = safeJsonParse<string[]>(row.warnings_json, []);
  db.prepare(`UPDATE runs SET warnings_json = ? WHERE id = ?`).run(
    JSON.stringify([...current, ...warnings]),
    runId
  );
}

export function upsertProviderRun(
  db: AppDatabase,
  runId: string,
  provider: NormalizedProvider,
  status: SearchTaskStatus | FlightRunStatus,
  nResults = 0,
  error?: string
): void {
  const id = `${runId}:${provider}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO provider_runs (id, run_id, provider, status, started_at, finished_at, error, n_results)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       finished_at = excluded.finished_at,
       error = excluded.error,
       n_results = excluded.n_results`
  ).run(
    id,
    runId,
    provider,
    status,
    now,
    ["completed", "failed", "succeeded", "failed_final"].includes(status) ? now : null,
    error ?? null,
    nResults
  );
}

export function insertTasks(db: AppDatabase, tasks: NewTaskInput[]): void {
  if (tasks.length === 0) return;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO search_tasks
      (id, run_id, provider, origin, destination, depart_date, return_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
  );
  const tx = db.transaction((items: NewTaskInput[]) => {
    for (const task of items) {
      stmt.run(
        task.id,
        task.runId,
        task.provider,
        task.origin,
        task.destination,
        task.departDate,
        task.returnDate
      );
    }
  });
  tx(tasks);
}

export function nextTaskForRun(
  db: AppDatabase,
  runId: string,
  statuses: SearchTaskStatus[] = ["pending"]
): SearchTask | null {
  const placeholders = statuses.map(() => "?").join(", ");
  const row = db
    .prepare(
      `SELECT * FROM search_tasks
       WHERE run_id = ? AND status IN (${placeholders})
       ORDER BY provider, destination, depart_date, return_date
       LIMIT 1`
    )
    .get(runId, ...statuses) as Record<string, unknown> | undefined;
  return row ? mapTask(row) : null;
}

export function updateTaskStatus(
  db: AppDatabase,
  taskId: string,
  status: SearchTaskStatus,
  error?: string
): void {
  db.prepare(
    `UPDATE search_tasks
     SET status = ?, last_error = ?, attempts = attempts + CASE WHEN ? = 'running' THEN 1 ELSE 0 END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(status, error ?? null, status, taskId);
}

export function insertCandidate(db: AppDatabase, candidate: FlightCandidate): boolean {
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO candidates
       (id, run_id, provider, origin, destination, depart_date, return_date, stay_days,
        price_total, price_currency, price_krw, price_includes_json, price_per_adult,
        outbound_direct, return_direct, direct_verification, booking_url, captured_at, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      candidate.id,
      candidate.runId,
      candidate.provider,
      candidate.origin,
      candidate.destination,
      candidate.departDate,
      candidate.returnDate,
      candidate.stayDays,
      candidate.priceTotal,
      candidate.priceCurrency,
      candidate.priceKrw,
      JSON.stringify(candidate.priceIncludes),
      candidate.pricePerAdult ? 1 : 0,
      nullableBoolean(candidate.outboundDirect),
      nullableBoolean(candidate.returnDirect),
      candidate.directVerification,
      candidate.bookingUrl ?? null,
      candidate.capturedAt,
      JSON.stringify(candidate.raw ?? {})
    );
  return result.changes > 0;
}

export function listCandidates(db: AppDatabase, runId: string): FlightCandidate[] {
  const rows = db.prepare(`SELECT * FROM candidates WHERE run_id = ?`).all(runId) as Record<string, unknown>[];
  return rows.map(mapCandidate);
}

export function listProviderRuns(db: AppDatabase, runId: string): ProviderRunSummary[] {
  const rows = db
    .prepare(`SELECT * FROM provider_runs WHERE run_id = ? ORDER BY provider`)
    .all(runId) as Record<string, unknown>[];
  return rows.map((row) => ({
    provider: String(row.provider),
    status: String(row.status) as ProviderRunSummary["status"],
    startedAt: nullableString(row.started_at),
    finishedAt: nullableString(row.finished_at),
    error: nullableString(row.error),
    nResults: Number(row.n_results ?? 0)
  }));
}

export function countTasks(db: AppDatabase, runId: string): { total: number; completed: number } {
  const total = db.prepare(`SELECT COUNT(*) AS count FROM search_tasks WHERE run_id = ?`).get(runId) as {
    count: number;
  };
  const completed = db
    .prepare(
      `SELECT COUNT(*) AS count FROM search_tasks
       WHERE run_id = ? AND status IN ('succeeded', 'failed_final', 'cancelled')`
    )
    .get(runId) as { count: number };
  return { total: total.count, completed: completed.count };
}

export function getRunDetail(db: AppDatabase, runId: string): FlightRunDetail | null {
  const row = getRunRow(db, runId);
  if (!row) return null;
  const progress = countTasks(db, runId);
  const reportLinks = buildReportLinks(runId);
  const total = progress.total;

  return {
    id: row.id,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    progress: {
      completed: progress.completed,
      total,
      percent: total === 0 ? 100 : Math.round((progress.completed / total) * 100)
    },
    reportLinks,
    warnings: safeJsonParse<string[]>(row.warnings_json, []),
    providerRuns: listProviderRuns(db, runId),
    candidatesPreview: rankCandidates(listCandidates(db, runId))
  };
}

export function recordCapture(
  db: AppDatabase,
  input: {
    id: string;
    runId: string;
    provider: NormalizedProvider;
    kind: string;
    payloadPath: string;
    redacted?: boolean;
  }
): void {
  db.prepare(
    `INSERT INTO captures (id, run_id, provider, kind, payload_path, redacted, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.runId,
    input.provider,
    input.kind,
    input.payloadPath,
    input.redacted === false ? 0 : 1,
    new Date().toISOString()
  );
}

export function buildReportLinks(runId: string): { label: string; href: string }[] {
  return [
    { label: "Markdown summary", href: `/api/runs/${runId}/reports/summary.md` },
    { label: "Candidates CSV", href: `/api/runs/${runId}/reports/candidates.csv` },
    { label: "Candidates JSON", href: `/api/runs/${runId}/reports/candidates.json` },
    { label: "Coverage JSON", href: `/api/runs/${runId}/reports/coverage.json` }
  ];
}

export function parseRunParams<T>(row: RunRow): T {
  return JSON.parse(row.params_json) as T;
}

export function parseExchangeRates(row: RunRow): ExchangeRateSnapshot {
  return JSON.parse(row.exchange_rates_json) as ExchangeRateSnapshot;
}

function nullableBoolean(value: boolean | null): number | null {
  if (value === null) return null;
  return value ? 1 : 0;
}

function fromNullableBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return Number(value) === 1;
}

function nullableString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function mapCandidate(row: Record<string, unknown>): FlightCandidate {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    provider: String(row.provider),
    origin: String(row.origin),
    destination: String(row.destination),
    departDate: String(row.depart_date),
    returnDate: String(row.return_date),
    stayDays: Number(row.stay_days),
    priceTotal: Number(row.price_total),
    priceCurrency: String(row.price_currency),
    priceKrw: row.price_krw === null || row.price_krw === undefined ? null : Number(row.price_krw),
    priceIncludes: safeJsonParse(row.price_includes_json, []),
    pricePerAdult: Number(row.price_per_adult) === 1,
    outboundDirect: fromNullableBoolean(row.outbound_direct),
    returnDirect: fromNullableBoolean(row.return_direct),
    directVerification: String(row.direct_verification) as FlightCandidate["directVerification"],
    bookingUrl: nullableString(row.booking_url),
    capturedAt: String(row.captured_at),
    raw: safeJsonParse(row.raw_json, {})
  };
}

function mapTask(row: Record<string, unknown>): SearchTask {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    provider: String(row.provider),
    origin: String(row.origin),
    destination: String(row.destination),
    departDate: String(row.depart_date),
    returnDate: String(row.return_date),
    status: String(row.status) as SearchTaskStatus,
    attempts: Number(row.attempts ?? 0),
    lastError: nullableString(row.last_error)
  };
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
