import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { fixturePath, importExpectedModule } from "./helpers/module.js";

describe("parseFlightCsv", () => {
  test("reads typed rows from the fixture CSV", async () => {
    const { parseFlightCsv } = await importExpectedModule("src/server/csv.ts", [
      "parseFlightCsv",
    ]);
    const csv = await readFile(fixturePath("flights.csv"), "utf8");

    const flights = (parseFlightCsv as Function)(csv);

    expect(flights).toHaveLength(4);
    expect(flights[0]).toEqual({
      carrier: "Korean Air",
      flightNumber: "KE901",
      origin: "ICN",
      destination: "CDG",
      departAt: "2026-06-01T11:10:00+09:00",
      returnAt: "2026-06-08T21:00:00+02:00",
      currency: "KRW",
      totalPrice: 1250000,
      durationMinutes: 820,
      stops: 0,
      bookingUrl: "https://example.test/book/ke901",
    });
  });

  test("reports row-level validation errors", async () => {
    const { parseFlightCsv } = await importExpectedModule("src/server/csv.ts", [
      "parseFlightCsv",
    ]);
    const csv = await readFile(fixturePath("flights-invalid.csv"), "utf8");

    expect(() => (parseFlightCsv as Function)(csv)).toThrow(/row 2|row 3|date|price/i);
  });
});
