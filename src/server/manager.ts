import { randomUUID } from "node:crypto";
import { chromium, type Browser } from "playwright";
import type {
  FlightEstimateResponse,
  FlightRunDetail,
  FlightRunResponse,
  FlightSearchPayload
} from "../shared/types.js";
import type { AppDatabase } from "./db.js";
import {
  appendRunWarnings,
  buildReportLinks,
  getRunDetail,
  insertCandidate,
  insertRun,
  updateRunStatus,
  upsertProviderRun
} from "./db.js";
import { parseCandidateCsv } from "./domain/csv.js";
import { generateDatePairs, type DatePair } from "./domain/dates.js";
import { createExchangeRateSnapshot } from "./domain/fx.js";
import { selectDepartureFirstPairs } from "./domain/pairSelection.js";
import { normalizeSearchPayload, type NormalizedSearchParams } from "./domain/validation.js";
import { RunEventHub } from "./events.js";
import { writeRunReports } from "./reports.js";
import {
  AUTO_SOURCES,
  isAutoSource,
  scrapedToCandidate,
  scraperFor,
  type AutoSource
} from "./sources/index.js";

const SECONDS_PER_PAIR = 14;
const MAX_PAIRS_PER_DEST = Number(process.env.FLIGHT_MAX_PAIRS ?? 18);
const PARALLEL_PAGES = Number(process.env.FLIGHT_PARALLEL ?? 3);

export class RunManager {
  private readonly activeRuns = new Set<string>();

  constructor(
    private readonly db: AppDatabase,
    private readonly events: RunEventHub
  ) {}

  defaults(): Record<string, unknown> {
    const today = new Date();
    const start = toInputDate(addLocalDays(today, 1));
    const end = toInputDate(addLocalDays(today, 30));
    return {
      origin: "ICN",
      destinations: ["FUK"],
      dateRange: { start, end },
      stay: { minNights: 2, maxNights: 7 },
      providers: ["trip", "kayak", "momondo"]
    };
  }

  estimate(payload: FlightSearchPayload): FlightEstimateResponse {
    const params = normalizeSearchPayload(payload);
    return estimateFromParams(params);
  }

  async createRun(payload: FlightSearchPayload): Promise<FlightRunResponse> {
    const params = normalizeSearchPayload(payload);
    const estimate = estimateFromParams(params);
    const exchangeRateSnapshot = createExchangeRateSnapshot();
    const exchangeRates = exchangeRateSnapshot.ratesToKrw;
    const runId = randomUUID();
    const warnings = [...estimate.warnings];

    insertRun(this.db, runId, params, exchangeRateSnapshot, warnings);

    if (params.csvText?.trim()) {
      try {
        const parsed = parseCandidateCsv(params.csvText, { runId, exchangeRates: exchangeRateSnapshot });
        for (const candidate of parsed.candidates) {
          insertCandidate(this.db, candidate);
        }
        appendRunWarnings(this.db, runId, parsed.warnings);
        upsertProviderRun(this.db, runId, "csv", "succeeded", parsed.candidates.length);
      } catch (error) {
        appendRunWarnings(this.db, runId, [
          `CSV import failed: ${error instanceof Error ? error.message : String(error)}`
        ]);
        upsertProviderRun(this.db, runId, "csv", "failed_final", 0, String(error));
      }
    }

    await writeRunReports(this.db, runId);
    this.processRun(runId, params, exchangeRates).catch((error) => {
      appendRunWarnings(this.db, runId, [
        `Run failed: ${error instanceof Error ? error.message : String(error)}`
      ]);
      updateRunStatus(this.db, runId, "failed", true);
      this.events.emit(runId, {
        type: "status",
        status: "failed",
        message: error instanceof Error ? error.message : String(error)
      });
    });

    return {
      id: runId,
      status: "queued",
      reportLinks: buildReportLinks(runId)
    };
  }

  getRun(runId: string): FlightRunDetail | null {
    return getRunDetail(this.db, runId);
  }

  async pause(runId: string): Promise<FlightRunDetail> {
    updateRunStatus(this.db, runId, "paused");
    this.events.emit(runId, {
      type: "pause",
      status: "paused",
      message: "검색을 일시정지했습니다."
    });
    return requireRunDetail(this.db, runId);
  }

  async resume(runId: string): Promise<FlightRunDetail> {
    updateRunStatus(this.db, runId, "running");
    this.events.emit(runId, {
      type: "status",
      status: "running",
      message: "검색을 다시 시작합니다."
    });
    return requireRunDetail(this.db, runId);
  }

  private async processRun(
    runId: string,
    params: NormalizedSearchParams,
    exchangeRates: Record<string, number>
  ): Promise<void> {
    if (this.activeRuns.has(runId)) return;
    this.activeRuns.add(runId);

    const autoSources = params.providers.filter(isAutoSource);
    let browser: Browser | null = null;

    try {
      updateRunStatus(this.db, runId, "running");

      const allPairs = generateDatePairs(
        params.dateRange.start,
        params.dateRange.end,
        params.stay.minNights,
        params.stay.maxNights
      );
      const pairSelection = selectDepartureFirstPairs(allPairs, MAX_PAIRS_PER_DEST);
      const pairs = pairSelection.selected;

      if (allPairs.length > pairs.length) {
        appendRunWarnings(this.db, runId, [
          `${allPairs.length}개 (출국·귀국) 조합 중 출발일 ${pairSelection.coveredDepartureDates}/${pairSelection.totalDepartureDates}개, 숙박일수 ${pairSelection.coveredStayDays}/${pairSelection.totalStayDays}개를 커버하는 ${pairs.length}개 조합을 검색합니다.`
        ]);
      }

      this.events.emit(runId, {
        type: "status",
        status: "running",
        message:
          autoSources.length === 0
            ? "자동 추출 소스가 선택되지 않았습니다."
            : `${autoSources.join(", ")} · ${params.destinations.length} 도착지 × ${pairs.length} 날짜 조합 검색 시작`
      });

      if (autoSources.length === 0) {
        await this.completeRun(runId);
        return;
      }

      browser = await chromium.launch({ headless: true });
      const perSourceCounts = new Map<AutoSource, number>();

      await this.runWave(browser, runId, params, exchangeRates, autoSources, pairs, perSourceCounts, false);

      const totalCandidates = Array.from(perSourceCounts.values()).reduce((a, b) => a + b, 0);
      const fallbackSources = AUTO_SOURCES.filter((s) => !autoSources.includes(s as AutoSource)) as AutoSource[];
      if (totalCandidates === 0 && fallbackSources.length > 0) {
        appendRunWarnings(this.db, runId, [
          `선택한 소스 (${autoSources.join(", ")})에서 0건. 자동 폴백 시도: ${fallbackSources.join(", ")}`
        ]);
        this.events.emit(runId, {
          type: "status",
          status: "running",
          message: `결과 없음 → 자동 폴백: ${fallbackSources.join(", ")}`
        });
        await this.runWave(browser, runId, params, exchangeRates, fallbackSources, pairs, perSourceCounts, true);
      }

      await this.completeRun(runId);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
      this.activeRuns.delete(runId);
    }
  }

  private async runWave(
    browser: Browser,
    runId: string,
    params: NormalizedSearchParams,
    exchangeRates: Record<string, number>,
    sources: AutoSource[],
    pairs: DatePair[],
    perSourceCounts: Map<AutoSource, number>,
    isFallback: boolean
  ): Promise<void> {
    const tasks: Array<{ source: AutoSource; destination: string; pair: DatePair }> = [];
    for (const source of sources) {
      upsertProviderRun(this.db, runId, source, "running", 0);
      perSourceCounts.set(source, perSourceCounts.get(source) ?? 0);
      for (const destination of params.destinations) {
        for (const pair of pairs) {
          tasks.push({ source, destination, pair });
        }
      }
    }

    const totalTasks = tasks.length;
    let doneTasks = 0;
    const queue = [...tasks];
    const prefix = isFallback ? "폴백 " : "";

    const worker = async (): Promise<void> => {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        locale: "ko-KR",
        timezoneId: "Asia/Seoul",
        extraHTTPHeaders: {
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.5,en;q=0.3"
        },
        viewport: { width: 1400, height: 1200 }
      });
      try {
        while (queue.length > 0) {
          const task = queue.shift();
          if (!task) break;
          const { source, destination, pair } = task;
          try {
            const flights = await scraperFor(source)(
              {
                origin: params.origin,
                destination,
                departDate: pair.departDate,
                returnDate: pair.returnDate,
                nonstopOnly: true
              },
              { context }
            );
            for (const flight of flights) {
              insertCandidate(this.db, scrapedToCandidate(flight, { runId, exchangeRates }));
            }
            perSourceCounts.set(source, (perSourceCounts.get(source) ?? 0) + flights.length);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            appendRunWarnings(this.db, runId, [
              `${prefix}${source} ${destination} ${pair.departDate}/${pair.returnDate} 실패: ${message}`
            ]);
          } finally {
            doneTasks += 1;
            this.events.emit(runId, {
              type: "progress",
              status: "running",
              message: `${prefix}${source} · ${params.origin}→${destination} ${pair.departDate} / ${pair.returnDate} (${doneTasks}/${totalTasks})`,
              progress: {
                completed: doneTasks,
                total: totalTasks,
                percent: Math.round((doneTasks / totalTasks) * 100)
              }
            });
          }
        }
      } finally {
        await context.close().catch(() => {});
      }
    };

    await Promise.all(Array.from({ length: Math.max(1, PARALLEL_PAGES) }, () => worker()));

    for (const source of sources) {
      upsertProviderRun(this.db, runId, source, "succeeded", perSourceCounts.get(source) ?? 0);
    }
  }

  private async completeRun(runId: string): Promise<void> {
    updateRunStatus(this.db, runId, "completed", true);
    await writeRunReports(this.db, runId);
    this.events.emit(runId, {
      type: "report",
      status: "completed",
      message: "검색이 완료되었습니다.",
      progress: { completed: 1, total: 1, percent: 100 },
      reportLinks: buildReportLinks(runId)
    });
  }
}

function estimateFromParams(params: NormalizedSearchParams): FlightEstimateResponse {
  const autoSourceCount = params.providers.filter(isAutoSource).length;
  let pairsCount = 0;
  let totalPairs = 0;
  try {
    const allPairs = generateDatePairs(
      params.dateRange.start,
      params.dateRange.end,
      params.stay.minNights,
      params.stay.maxNights
    );
    totalPairs = allPairs.length;
    pairsCount = selectDepartureFirstPairs(allPairs, MAX_PAIRS_PER_DEST).selected.length;
  } catch {
    pairsCount = 0;
  }
  const tasks = params.destinations.length * autoSourceCount * pairsCount;
  const csvRows = countCsvDataRows(params.csvText);
  const wallClockSeconds = Math.max(10, Math.ceil((tasks * SECONDS_PER_PAIR) / Math.max(1, PARALLEL_PAGES)) + csvRows);
  const warnings: string[] = [];

  if (autoSourceCount === 0 && csvRows === 0) {
    warnings.push("자동 추출 가능한 소스가 선택되지 않았습니다. Kayak/Momondo/Trip 중 하나를 선택하세요.");
  }
  if (totalPairs > pairsCount && pairsCount > 0) {
    warnings.push(
      `${totalPairs} 조합 중 출발일과 숙박일수를 함께 넓게 커버하는 ${pairsCount}개 조합을 먼저 검색합니다.`
    );
  }
  const supportedFromRequest = params.providers.filter((provider) => !isAutoSource(provider) && provider !== "csv");
  if (supportedFromRequest.length > 0) {
    warnings.push(
      `자동 추출 미지원 소스 무시: ${supportedFromRequest.join(", ")}. 지원: ${AUTO_SOURCES.join(", ")}.`
    );
  }

  return {
    combinations: tasks + csvRows,
    browserTasks: tasks,
    csvRows,
    estimatedSeconds: wallClockSeconds,
    estimatedEtaText: formatEta(wallClockSeconds),
    providerCount: autoSourceCount,
    summary: `${params.destinations.length}개 도착지 × ${autoSourceCount}개 소스 × ${pairsCount}개 (출국·귀국) 조합 = ${tasks}회 스크래핑 · ETA ${formatEta(wallClockSeconds)}`,
    warnings
  };
}

function requireRunDetail(db: AppDatabase, runId: string): FlightRunDetail {
  const detail = getRunDetail(db, runId);
  if (!detail) {
    throw new Error(`Run not found: ${runId}`);
  }
  return detail;
}

function countCsvDataRows(csvText?: string): number {
  if (!csvText?.trim()) return 0;
  return Math.max(0, csvText.trim().split(/\r?\n/).length - 1);
}

function formatEta(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `약 ${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `약 ${hours}시간 ${rest}분` : `약 ${hours}시간`;
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
