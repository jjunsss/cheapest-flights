import { readFile } from "node:fs/promises";
import { generateDatePairs } from "./datePairs.js";
import { parseFlightCsv } from "./csv.js";
import { rankFlights, type RankedFlight } from "./ranking.js";
import { generateReport } from "./report.js";

export interface RunSearchOptions {
  origin: string;
  destination: string;
  departFrom: string;
  departTo: string;
  minNights: number;
  maxNights: number;
  fixtureCsvPath: string;
  exchangeRates: Record<string, number>;
  now?: Date;
}

export interface RunSearchResult {
  best: RankedFlight;
  datePairs: ReturnType<typeof generateDatePairs>;
  ranked: RankedFlight[];
  report: string;
}

export async function runSearch(options: RunSearchOptions): Promise<RunSearchResult> {
  const datePairs = generateDatePairs({
    departFrom: options.departFrom,
    departTo: options.departTo,
    minNights: options.minNights,
    maxNights: options.maxNights
  });
  const csv = await readFile(options.fixtureCsvPath, "utf8");
  const ranked = rankFlights(parseFlightCsv(csv), {
    targetCurrency: "KRW",
    rates: options.exchangeRates
  });

  if (!ranked[0]) {
    throw new Error("No flights found");
  }

  const report = generateReport({
    origin: options.origin,
    destination: options.destination,
    generatedAt: (options.now ?? new Date()).toISOString(),
    flights: ranked
  });

  return { best: ranked[0], datePairs, ranked, report };
}
