import { scrapeMetaSearch, type KayakQuery, type ScrapedFlight, type ScrapeOptions } from "./_shared.js";

const SELECTOR = ".result-item.J_FlightItem, [class*='J_FlightItem']";
const DEFAULT_WAIT_MS = 13_000;

export function buildTripUrl(query: KayakQuery): string {
  const params = new URLSearchParams({
    dcity: query.origin,
    acity: query.destination,
    ddate: query.departDate,
    rdate: query.returnDate,
    triptype: "rt",
    class: "y",
    quantity: "1",
    locale: "ko-KR",
    curr: "KRW",
    currency: "KRW",
  });
  if (query.nonstopOnly !== false) params.set("nonstoponly", "on");
  return `https://kr.trip.com/flights/showfarefirst?${params.toString()}`;
}

export async function scrapeTrip(query: KayakQuery, options: ScrapeOptions = {}): Promise<ScrapedFlight[]> {
  return scrapeMetaSearch("trip", buildTripUrl(query), SELECTOR, query, DEFAULT_WAIT_MS, options);
}
