import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { fixturePath, importExpectedModule } from "./helpers/module.js";

describe("report generation", () => {
  test("generateReport renders a ranked search result summary", async () => {
    const { parseFlightCsv } = await importExpectedModule("src/server/csv.ts", [
      "parseFlightCsv",
    ]);
    const { rankFlights } = await importExpectedModule("src/server/ranking.ts", [
      "rankFlights",
    ]);
    const { generateReport } = await importExpectedModule("src/server/report.ts", [
      "generateReport",
    ]);
    const csv = await readFile(fixturePath("flights.csv"), "utf8");
    const ranked = (rankFlights as Function)((parseFlightCsv as Function)(csv), {
      targetCurrency: "KRW",
      rates: { KRW: 1, USD: 1350, EUR: 1460 },
    });

    const report = (generateReport as Function)({
      origin: "ICN",
      destination: "CDG",
      generatedAt: "2026-05-16T12:00:00.000Z",
      flights: ranked.slice(0, 3),
    });

    expect(report).toMatch(/ICN\s*(?:->|to)\s*CDG/i);
    expect(report).toMatch(/EK323/);
    expect(report).toMatch(/1,026,000|1026000/);
    expect(report).toMatch(/KE901/);
  });

  test("runSearch wires date generation, CSV parsing, ranking, and reporting", async () => {
    const { runSearch } = await importExpectedModule("src/server/run.ts", ["runSearch"]);

    const result = await (runSearch as Function)({
      origin: "ICN",
      destination: "CDG",
      departFrom: "2026-06-01",
      departTo: "2026-06-03",
      minNights: 7,
      maxNights: 7,
      fixtureCsvPath: fixturePath("flights.csv"),
      exchangeRates: { KRW: 1, USD: 1350, EUR: 1460 },
      now: new Date("2026-05-16T12:00:00.000Z"),
    });

    expect(result.best.flightNumber).toBe("EK323");
    expect(Array.isArray(result.datePairs)).toBe(true);
    expect(result.datePairs).toHaveLength(3);
    expect(result.report).toMatch(/EK323/);
  });
});
