import type { FlightCsvRecord } from "./csv.js";
import { convertCurrency } from "./exchange.js";
export { rankCandidates } from "./domain/ranking.js";

export interface RankedFlight extends FlightCsvRecord {
  rank: number;
  convertedCurrency: string;
  convertedTotalPrice: number;
}

export interface RankFlightsOptions {
  targetCurrency: string;
  rates: Record<string, number>;
}

export function rankFlights(flights: FlightCsvRecord[], options: RankFlightsOptions): RankedFlight[] {
  const targetCurrency = options.targetCurrency.toUpperCase();
  return flights
    .map((flight) => ({
      ...flight,
      convertedCurrency: targetCurrency,
      convertedTotalPrice: convertCurrency(flight.totalPrice, {
        from: flight.currency,
        to: targetCurrency,
        rates: options.rates
      })
    }))
    .sort(compareRankedFlights)
    .map((flight, index) => ({ ...flight, rank: index + 1 }));
}

function compareRankedFlights(a: Omit<RankedFlight, "rank">, b: Omit<RankedFlight, "rank">): number {
  const priceDelta = a.convertedTotalPrice - b.convertedTotalPrice;
  const lower = priceDelta <= 0 ? a : b;
  const higher = priceDelta <= 0 ? b : a;
  const relativeGap = (higher.convertedTotalPrice - lower.convertedTotalPrice) / lower.convertedTotalPrice;

  if (a.stops !== b.stops && relativeGap <= 0.1) {
    return a.stops - b.stops;
  }
  if (priceDelta !== 0) return priceDelta;
  if (a.stops !== b.stops) return a.stops - b.stops;
  if (a.durationMinutes !== b.durationMinutes) return a.durationMinutes - b.durationMinutes;
  return a.flightNumber.localeCompare(b.flightNumber);
}
