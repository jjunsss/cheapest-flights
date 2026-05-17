import { scrapeMetaSearch, type KayakQuery, type ScrapedFlight, type ScrapeOptions } from "./_shared.js";

const SELECTOR = '[class*="Base-Result"], [class*="resultInner"], [class*="result"]';
const DEFAULT_WAIT_MS = 16_000;

export function buildMomondoUrl(query: KayakQuery): string {
  const stops = query.nonstopOnly !== false ? "0" : "";
  const params = new URLSearchParams({ sort: "price_a", currency: "KRW" });
  if (stops) params.set("fs", `stops=${stops}`);
  return `https://www.momondo.co.kr/flight-search/${query.origin}-${query.destination}/${query.departDate}/${query.returnDate}?${params.toString()}`;
}

export async function scrapeMomondo(query: KayakQuery, options: ScrapeOptions = {}): Promise<ScrapedFlight[]> {
  return scrapeMetaSearch("momondo", buildMomondoUrl(query), SELECTOR, query, DEFAULT_WAIT_MS, options);
}
