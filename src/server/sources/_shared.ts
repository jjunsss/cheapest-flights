import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";
import { parseCardText, type ParsedFlightCard } from "./parsers.js";

export interface KayakQuery {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  nonstopOnly?: boolean;
}

export const AUTO_SOURCES = ["kayak", "momondo", "trip"] as const;
export type AutoSource = (typeof AUTO_SOURCES)[number];

export interface ScrapedFlight extends ParsedFlightCard {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  source: AutoSource;
  bookingUrl: string;
}

export interface ScrapeOptions {
  browser?: Browser;
  context?: BrowserContext;
  timeoutMs?: number;
  waitMs?: number;
}

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const DEFAULT_VIEWPORT = { width: 1400, height: 1200 };
const SCRAPE_LOCALE = "ko-KR";
const SCRAPE_TIMEZONE = "Asia/Seoul";
const SCRAPE_HEADERS = {
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.5,en;q=0.3",
};
const SETTLE_AFTER_FIRST_CARD_MS = Number(process.env.FLIGHT_SETTLE_MS ?? 900);
const BLOCK_HEAVY_RESOURCES = process.env.FLIGHT_BLOCK_HEAVY_RESOURCES !== "0";
const BLOCK_IMAGES = process.env.FLIGHT_BLOCK_IMAGES === "1";
const PRICE_TEXT_PATTERN = String.raw`US\$|\$\d|₩\s?\d|KRW\s?\d|[\d,]{4,}\s?원`;
const PRICE_TEXT_RE = new RegExp(PRICE_TEXT_PATTERN);
const BLOCKED_RESOURCE_TYPES = new Set(["media", "font"]);
const BLOCKED_HOST_RE =
  /(?:doubleclick|googletagmanager|google-analytics|analytics\.google|facebook|hotjar|clarity|criteo|taboola|scorecardresearch|adservice|adsystem|adnxs|quantserve|optimizely|sentry)\./i;
const BLOCKED_MEDIA_ASSET_RE = /\.(?:mp4|webm|mov|avi|woff2?|ttf|otf)(?:[?#]|$)/i;
const BLOCKED_IMAGE_ASSET_RE = /\.(?:png|jpe?g|gif|webp|avif|svg|ico)(?:[?#]|$)/i;
const optimizedContexts = new WeakSet<BrowserContext>();

export function hasFlightPriceText(text: string): boolean {
  return PRICE_TEXT_RE.test(text);
}

export function shouldBlockRequestForSpeed(resourceType: string, url: string): boolean {
  if (BLOCKED_RESOURCE_TYPES.has(resourceType)) return true;
  if (BLOCKED_HOST_RE.test(url)) return true;
  if (BLOCKED_MEDIA_ASSET_RE.test(url)) return true;
  return BLOCK_IMAGES && (resourceType === "image" || BLOCKED_IMAGE_ASSET_RE.test(url));
}

/**
 * Common Playwright scrape pipeline shared by all metasearch sources. Each
 * caller only needs to provide the URL, the result-card selector, and the
 * source name. Browser/context lifecycle and dedupe are centralized.
 */
export async function scrapeMetaSearch(
  source: AutoSource,
  url: string,
  selector: string,
  query: KayakQuery,
  defaultWaitMs: number,
  options: ScrapeOptions = {},
): Promise<ScrapedFlight[]> {
  const ownBrowser = !options.browser && !options.context;
  const browser = options.browser ?? (options.context ? null : await chromium.launch({ headless: true }));
  const waitMs = options.waitMs ?? defaultWaitMs;
  const timeoutMs = options.timeoutMs ?? 30_000;

  const ownContext = !options.context;
  const context =
    options.context ??
    (await browser!.newContext({
      userAgent: USER_AGENT,
      locale: SCRAPE_LOCALE,
      timezoneId: SCRAPE_TIMEZONE,
      extraHTTPHeaders: SCRAPE_HEADERS,
      viewport: DEFAULT_VIEWPORT,
    }));
  await optimizeContext(context);
  const page = await context.newPage();
  const flights: ScrapedFlight[] = [];

  try {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("currency", "KRW");
        window.localStorage.setItem("selectedCurrency", "KRW");
        window.localStorage.setItem("locale", "ko-KR");
      } catch {
        // Some providers block storage before navigation; URL and headers still carry KRW intent.
      }
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await waitForPricedCards(page, selector, waitMs);

    const cards = await page.evaluate(({ sel, pricePattern }) => {
      const priceRe = new RegExp(pricePattern);
      const out: string[] = [];
      for (const el of document.querySelectorAll(sel)) {
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!text || text.length > 800) continue;
        if (!priceRe.test(text)) continue;
        out.push(text);
        if (out.length >= 40) break;
      }
      return out;
    }, { sel: selector, pricePattern: PRICE_TEXT_PATTERN });

    const seen = new Set<string>();
    for (const card of cards) {
      const parsed = parseCardText(card);
      if (!parsed) continue;
      const key = `${parsed.outboundDepart ?? ""}-${parsed.priceRaw}`;
      if (seen.has(key)) continue;
      seen.add(key);
      flights.push({
        ...parsed,
        origin: query.origin,
        destination: query.destination,
        departDate: query.departDate,
        returnDate: query.returnDate,
        source,
        bookingUrl: url,
      });
      if (flights.length >= 20) break;
    }
  } finally {
    await page.close().catch(() => {});
    if (ownContext) await context.close().catch(() => {});
    if (ownBrowser && browser) await browser.close().catch(() => {});
  }

  return flights;
}

async function optimizeContext(context: BrowserContext): Promise<void> {
  if (!BLOCK_HEAVY_RESOURCES || optimizedContexts.has(context)) return;
  optimizedContexts.add(context);
  const abort = async (route: Route) => {
    await route.abort().catch(() => {});
  };
  await context.route(BLOCKED_HOST_RE, abort);
  await context.route(BLOCKED_MEDIA_ASSET_RE, abort);
  if (BLOCK_IMAGES) {
    await context.route(BLOCKED_IMAGE_ASSET_RE, abort);
  }
}

async function waitForPricedCards(page: Page, selector: string, waitMs: number): Promise<void> {
  const startedAt = Date.now();
  try {
    await page.waitForFunction(
      ({ sel, pricePattern }) => {
        const priceRe = new RegExp(pricePattern);
        const cards = Array.from(document.querySelectorAll(sel)).slice(0, 120);
        return cards.some((el) => {
          const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
          return Boolean(text && text.length <= 800 && priceRe.test(text));
        });
      },
      { sel: selector, pricePattern: PRICE_TEXT_PATTERN },
      { timeout: waitMs, polling: 250 },
    );
    const remainingMs = Math.max(0, waitMs - (Date.now() - startedAt));
    const settleMs = Math.min(SETTLE_AFTER_FIRST_CARD_MS, remainingMs);
    if (settleMs > 0) {
      await page.waitForTimeout(settleMs);
    }
  } catch {
    // Keep old behavior's max wait budget: if no priced card appears, parse whatever is present.
  }
}
