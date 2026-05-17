import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { fixturePath, importExpectedModule } from "./helpers/module.js";

describe("rankFlights", () => {
  test("prefers lower converted price, then fewer stops, then shorter duration", async () => {
    const { parseFlightCsv } = await importExpectedModule("src/server/csv.ts", [
      "parseFlightCsv",
    ]);
    const { rankFlights } = await importExpectedModule("src/server/ranking.ts", [
      "rankFlights",
    ]);
    const csv = await readFile(fixturePath("flights.csv"), "utf8");
    const flights = (parseFlightCsv as Function)(csv);

    const ranked = (rankFlights as Function)(flights, {
      targetCurrency: "KRW",
      rates: {
        KRW: 1,
        USD: 1350,
        EUR: 1460,
      },
    });

    expect(ranked.map((flight: { flightNumber: string }) => flight.flightNumber)).toEqual([
      "EK323",
      "KE901",
      "AF267",
      "KE902",
    ]);
    expect(ranked.map((flight: { rank: number }) => flight.rank)).toEqual([1, 2, 3, 4]);
    expect(ranked[0].convertedCurrency).toBe("KRW");
    expect(ranked[0].convertedTotalPrice).toBe(1026000);
  });

  test("keeps source records immutable", async () => {
    const { parseFlightCsv } = await importExpectedModule("src/server/csv.ts", [
      "parseFlightCsv",
    ]);
    const { rankFlights } = await importExpectedModule("src/server/ranking.ts", [
      "rankFlights",
    ]);
    const csv = await readFile(fixturePath("flights.csv"), "utf8");
    const flights = (parseFlightCsv as Function)(csv);
    const before = structuredClone(flights);

    (rankFlights as Function)(flights, {
      targetCurrency: "KRW",
      rates: { KRW: 1, USD: 1350, EUR: 1460 },
    });

    expect(flights).toEqual(before);
  });
});
