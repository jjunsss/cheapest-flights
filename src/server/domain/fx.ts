import type { ExchangeRateSnapshot } from "../../shared/types.js";

export function createExchangeRateSnapshot(now = new Date()): ExchangeRateSnapshot {
  const ratesToKrw: Record<string, number> = { KRW: 1 };
  const raw = process.env.FX_RATES_JSON;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [currency, rate] of Object.entries(parsed)) {
        const normalizedCurrency = currency.toUpperCase();
        const numericRate = Number(rate);
        if (/^[A-Z]{3}$/.test(normalizedCurrency) && Number.isFinite(numericRate) && numericRate > 0) {
          ratesToKrw[normalizedCurrency] = numericRate;
        }
      }
    } catch {
      // Invalid manual rates should not break runs; conversion warnings cover missing currencies.
    }
  }

  return {
    baseCurrency: "KRW",
    source: raw ? "FX_RATES_JSON" : "KRW-only",
    capturedAt: now.toISOString(),
    ratesToKrw
  };
}

export function convertToKrw(
  amount: number,
  currency: string,
  snapshot: ExchangeRateSnapshot
): number | null {
  const normalizedCurrency = currency.toUpperCase();
  const rate = snapshot.ratesToKrw[normalizedCurrency];
  if (!Number.isFinite(amount) || amount < 0 || !rate) {
    return null;
  }
  return Math.round(amount * rate);
}
