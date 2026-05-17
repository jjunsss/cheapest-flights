import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FlightCandidate, FlightRunDetail } from "../shared/types.js";
import type { AppDatabase } from "./db.js";
import { getRunDetail, listCandidates, listProviderRuns } from "./db.js";
import { REPORTS_DIR } from "./paths.js";
import { groupByDestination, rankCandidates } from "./domain/ranking.js";
import { formatAirportLabel } from "../shared/airports.js";

export interface GeneratedReportPaths {
  dir: string;
  summaryPath: string;
  candidatesCsvPath: string;
  candidatesJsonPath: string;
  coveragePath: string;
}

export async function writeRunReports(db: AppDatabase, runId: string): Promise<GeneratedReportPaths> {
  const dir = path.join(REPORTS_DIR, runId);
  await mkdir(dir, { recursive: true });

  const candidates = listCandidates(db, runId);
  const detail = getRunDetail(db, runId);
  const summaryPath = path.join(dir, "summary.md");
  const candidatesCsvPath = path.join(dir, "candidates.csv");
  const candidatesJsonPath = path.join(dir, "candidates.json");
  const coveragePath = path.join(dir, "coverage.json");

  await writeFile(summaryPath, renderSummaryMarkdown(candidates, detail), "utf8");
  await writeFile(candidatesCsvPath, renderCandidatesCsv(candidates), "utf8");
  await writeFile(candidatesJsonPath, `${JSON.stringify(candidates, null, 2)}\n`, "utf8");
  await writeFile(
    coveragePath,
    `${JSON.stringify(
      {
        runId,
        generatedAt: new Date().toISOString(),
        providers: listProviderRuns(db, runId),
        warnings: detail?.warnings ?? []
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return { dir, summaryPath, candidatesCsvPath, candidatesJsonPath, coveragePath };
}

export async function readRunReportFile(runId: string, filename: string): Promise<Buffer> {
  const allowed = new Set(["summary.md", "candidates.csv", "candidates.json", "coverage.json"]);
  if (!allowed.has(filename)) {
    throw new Error("Unknown report file.");
  }
  return readFile(path.join(REPORTS_DIR, runId, filename));
}

function renderSummaryMarkdown(candidates: FlightCandidate[], detail: FlightRunDetail | null): string {
  const ranked = rankCandidates(candidates);
  const grouped = groupByDestination(ranked);
  const generatedAt = new Date().toISOString();
  const lines: string[] = [
    "# Cheapest Direct Flight Finder Report",
    "",
    `Generated at: ${generatedAt}`,
    `Run status: ${detail?.status ?? "unknown"}`,
    "",
    "> Booking URLs are volatile. Treat links as freshest for about 1 hour after each candidate's captured_at time.",
    "",
    "## Cheapest Overall",
    ""
  ];

  if (ranked.length === 0) {
    lines.push("No verified-direct KRW-ranked candidates were found yet.", "");
  } else {
    lines.push(renderCandidateTable(ranked.slice(0, 20)), "");
  }

  lines.push("## By Destination", "");
  if (grouped.size === 0) {
    lines.push("No destination sections yet.", "");
  } else {
    for (const [destination, items] of grouped) {
      lines.push(`### ${formatAirportLabel(destination)}`, "", renderCandidateTable(items.slice(0, 10)), "");
    }
  }

  const nonRanked = candidates.filter(
    (candidate) => candidate.directVerification !== "verified_direct" || candidate.priceKrw === null
  );
  lines.push("## Warnings And Incomplete Candidates", "");
  if ((detail?.warnings?.length ?? 0) === 0 && nonRanked.length === 0) {
    lines.push("No warnings recorded.", "");
  } else {
    for (const warning of detail?.warnings ?? []) {
      lines.push(`- ${warning}`);
    }
    for (const candidate of nonRanked.slice(0, 20)) {
      lines.push(
        `- ${candidate.provider} ${formatAirportLabel(candidate.origin)} -> ${formatAirportLabel(candidate.destination)} ${candidate.departDate}/${candidate.returnDate}: direct=${candidate.directVerification}, priceKrw=${candidate.priceKrw ?? "missing"}`
      );
    }
    lines.push("");
  }

  lines.push("## Provider Coverage", "");
  const providerRuns = detail?.providerRuns ?? [];
  if (providerRuns.length === 0) {
    lines.push("No provider runs recorded.", "");
  } else {
    lines.push("| Provider | Status | Results | Error |", "| --- | --- | ---: | --- |");
    for (const provider of providerRuns) {
      lines.push(
        `| ${provider.provider} | ${provider.status} | ${provider.nResults} | ${escapePipe(
          provider.error ?? ""
        )} |`
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function renderCandidateTable(candidates: FlightCandidate[]): string {
  const lines = [
    "| Rank | Provider | Route | Dates | Stay | Price | Includes | Captured | Booking |",
    "| ---: | --- | --- | --- | ---: | ---: | --- | --- | --- |"
  ];

  candidates.forEach((candidate, index) => {
    lines.push(
      `| ${index + 1} | ${candidate.provider} | ${formatAirportLabel(candidate.origin)} -> ${formatAirportLabel(candidate.destination)} | ${
        candidate.departDate
      } / ${candidate.returnDate} | ${candidate.stayDays} | ${formatPrice(candidate)} | ${escapePipe(
        candidate.priceIncludes.join(", ")
      )} | ${candidate.capturedAt} | ${candidate.bookingUrl ?? ""} |`
    );
  });

  return lines.join("\n");
}

function renderCandidatesCsv(candidates: FlightCandidate[]): string {
  const headers = [
    "id",
    "run_id",
    "provider",
    "origin",
    "destination",
    "depart_date",
    "return_date",
    "stay_days",
    "price_total",
    "price_currency",
    "price_krw",
    "direct_verification",
    "booking_url",
    "captured_at"
  ];

  const rows = candidates.map((candidate) => [
    candidate.id,
    candidate.runId,
    candidate.provider,
    candidate.origin,
    candidate.destination,
    candidate.departDate,
    candidate.returnDate,
    String(candidate.stayDays),
    String(candidate.priceTotal),
    candidate.priceCurrency,
    candidate.priceKrw === null ? "" : String(candidate.priceKrw),
    candidate.directVerification,
    candidate.bookingUrl ?? "",
    candidate.capturedAt
  ]);

  return `${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function formatPrice(candidate: FlightCandidate): string {
  if (candidate.priceKrw !== null) {
    return `${new Intl.NumberFormat("ko-KR").format(candidate.priceKrw)} KRW`;
  }
  return `${new Intl.NumberFormat("en-US").format(candidate.priceTotal)} ${candidate.priceCurrency}`;
}

function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function escapePipe(value: string): string {
  return value.replace(/\|/g, "\\|");
}
