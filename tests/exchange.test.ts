import { describe, expect, test } from "vitest";
import { importExpectedModule } from "./helpers/module.js";

describe("convertCurrency", () => {
  test("converts through the supplied rate table", async () => {
    const { convertCurrency } = await importExpectedModule("src/server/exchange.ts", [
      "convertCurrency",
    ]);

    expect(
      (convertCurrency as Function)(820, {
        from: "EUR",
        to: "KRW",
        rates: { KRW: 1, EUR: 1460 },
      }),
    ).toBe(1197200);
  });

  test("fails loudly when a required exchange rate is missing", async () => {
    const { convertCurrency } = await importExpectedModule("src/server/exchange.ts", [
      "convertCurrency",
    ]);

    expect(() =>
      (convertCurrency as Function)(760, {
        from: "USD",
        to: "KRW",
        rates: { KRW: 1 },
      }),
    ).toThrow(/USD|exchange|rate/i);
  });
});
