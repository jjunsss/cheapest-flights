export interface ConvertCurrencyOptions {
  from: string;
  to: string;
  rates: Record<string, number>;
}

export function convertCurrency(amount: number, options: ConvertCurrencyOptions): number {
  if (!Number.isFinite(amount)) {
    throw new Error("amount must be a finite number");
  }

  const from = options.from.toUpperCase();
  const to = options.to.toUpperCase();
  const fromRate = options.rates[from];
  const toRate = options.rates[to];

  if (!fromRate) {
    throw new Error(`Missing exchange rate for ${from}`);
  }
  if (!toRate) {
    throw new Error(`Missing exchange rate for ${to}`);
  }

  return Math.round((amount * fromRate) / toRate);
}
