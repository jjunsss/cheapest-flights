import { describe, expect, test } from "vitest";
import { importExpectedModule } from "./helpers/module.js";

describe("generateDatePairs", () => {
  test("creates inclusive departure and return date combinations", async () => {
    const { generateDatePairs } = await importExpectedModule("src/server/datePairs.ts", [
      "generateDatePairs",
    ]);

    const pairs = (generateDatePairs as Function)({
      departFrom: "2028-02-27",
      departTo: "2028-02-29",
      minNights: 2,
      maxNights: 3,
    });

    expect(pairs).toEqual([
      { departDate: "2028-02-27", returnDate: "2028-02-29", nights: 2 },
      { departDate: "2028-02-27", returnDate: "2028-03-01", nights: 3 },
      { departDate: "2028-02-28", returnDate: "2028-03-01", nights: 2 },
      { departDate: "2028-02-28", returnDate: "2028-03-02", nights: 3 },
      { departDate: "2028-02-29", returnDate: "2028-03-02", nights: 2 },
      { departDate: "2028-02-29", returnDate: "2028-03-03", nights: 3 },
    ]);
  });

  test("rejects impossible ranges", async () => {
    const { generateDatePairs } = await importExpectedModule("src/server/datePairs.ts", [
      "generateDatePairs",
    ]);

    expect(() =>
      (generateDatePairs as Function)({
        departFrom: "2026-06-10",
        departTo: "2026-06-01",
        minNights: 3,
        maxNights: 7,
      }),
    ).toThrow(/depart|range|date/i);

    expect(() =>
      (generateDatePairs as Function)({
        departFrom: "2026-06-01",
        departTo: "2026-06-10",
        minNights: 8,
        maxNights: 3,
      }),
    ).toThrow(/night|range/i);
  });
});

describe("selectDepartureFirstPairs", () => {
  test("covers departure dates before adding more stay variants", async () => {
    const { generateDatePairs } = await importExpectedModule("src/server/datePairs.ts", [
      "generateDatePairs",
    ]);
    const { selectDepartureFirstPairs } = await importExpectedModule("src/server/domain/pairSelection.ts", [
      "selectDepartureFirstPairs",
    ]);

    const pairs = (generateDatePairs as Function)({
      departFrom: "2026-06-01",
      departTo: "2026-06-05",
      minNights: 2,
      maxNights: 4,
    }).map((pair: { departDate: string; returnDate: string; nights: number }) => ({
      departDate: pair.departDate,
      returnDate: pair.returnDate,
      stayDays: pair.nights,
    }));

    const result = (selectDepartureFirstPairs as Function)(pairs, 5);

    expect(result.selected).toHaveLength(5);
    expect(new Set(result.selected.map((pair: { departDate: string }) => pair.departDate))).toHaveLength(5);
    expect(new Set(result.selected.map((pair: { stayDays: number }) => pair.stayDays))).toHaveLength(3);
    expect(result.coveredDepartureDates).toBe(5);
    expect(result.totalDepartureDates).toBe(5);
    expect(result.coveredStayDays).toBe(3);
    expect(result.totalStayDays).toBe(3);
  });

  test("uses remaining capacity to add stay-length variation across departure dates", async () => {
    const { generateDatePairs } = await importExpectedModule("src/server/datePairs.ts", [
      "generateDatePairs",
    ]);
    const { selectDepartureFirstPairs } = await importExpectedModule("src/server/domain/pairSelection.ts", [
      "selectDepartureFirstPairs",
    ]);

    const pairs = (generateDatePairs as Function)({
      departFrom: "2026-06-01",
      departTo: "2026-06-04",
      minNights: 2,
      maxNights: 5,
    }).map((pair: { departDate: string; returnDate: string; nights: number }) => ({
      departDate: pair.departDate,
      returnDate: pair.returnDate,
      stayDays: pair.nights,
    }));

    const result = (selectDepartureFirstPairs as Function)(pairs, 8);
    const countsByDeparture = new Map<string, number>();
    for (const pair of result.selected as Array<{ departDate: string }>) {
      countsByDeparture.set(pair.departDate, (countsByDeparture.get(pair.departDate) ?? 0) + 1);
    }

    expect(result.selected).toHaveLength(8);
    expect(countsByDeparture.size).toBe(4);
    expect(Array.from(countsByDeparture.values()).every((count) => count >= 1)).toBe(true);
    expect(new Set(result.selected.map((pair: { stayDays: number }) => pair.stayDays)).size).toBeGreaterThan(1);
  });
});
