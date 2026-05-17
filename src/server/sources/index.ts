import { randomUUID } from "node:crypto";
import type { FlightCandidate, PriceInclude } from "../../shared/types.js";
import { daysBetween } from "../domain/dates.js";
import { scrapeKayak } from "./kayak.js";
import { scrapeMomondo } from "./momondo.js";
import { scrapeTrip } from "./trip.js";
import type { KayakQuery, ScrapedFlight } from "./_shared.js";
import { AUTO_SOURCES as AUTO_SOURCES_CONST, type AutoSource as AutoSourceType } from "./_shared.js";

export const AUTO_SOURCES = AUTO_SOURCES_CONST;
export type AutoSource = AutoSourceType;

export function isAutoSource(value: string): value is AutoSource {
  return (AUTO_SOURCES as readonly string[]).includes(value);
}

export function scraperFor(source: AutoSource) {
  switch (source) {
    case "kayak":
      return scrapeKayak;
    case "momondo":
      return scrapeMomondo;
    case "trip":
      return scrapeTrip;
  }
}

export interface ConvertOptions {
  runId: string;
  exchangeRates: Record<string, number>;
}

export function scrapedToCandidate(
  flight: ScrapedFlight,
  options: ConvertOptions,
): FlightCandidate {
  const priceCurrency = flight.priceCurrency;
  const priceTotal = flight.priceKrw ?? flight.priceUsd ?? 0;
  const priceKrw = flight.priceKrw ?? convertToKrw(flight.priceUsd ?? 0, "USD", options.exchangeRates);
  const priceIncludes = buildPriceIncludes(flight);

  return {
    id: randomUUID(),
    runId: options.runId,
    provider: flight.source,
    origin: flight.origin,
    destination: flight.destination,
    departDate: flight.departDate,
    returnDate: flight.returnDate,
    stayDays: safeDaysBetween(flight.departDate, flight.returnDate),
    priceTotal,
    priceCurrency,
    priceKrw: Number.isFinite(priceKrw) ? Math.round(priceKrw) : null,
    priceIncludes,
    pricePerAdult: true,
    outboundDirect: flight.nonstop,
    returnDirect: flight.nonstop,
    directVerification: flight.nonstop ? "verified_direct" : "unknown",
    bookingUrl: flight.bookingUrl,
    capturedAt: new Date().toISOString(),
    raw: {
      source: flight.source,
      carrier: flight.carrier ?? null,
      outboundDepart: flight.outboundDepart ?? null,
      outboundArrive: flight.outboundArrive ?? null,
      inboundDepart: flight.inboundDepart ?? null,
      inboundArrive: flight.inboundArrive ?? null,
      returnDepart: flight.inboundDepart ?? null,
      returnArrive: flight.inboundArrive ?? null,
      durationOutbound: flight.durationOutbound ?? null,
      durationInbound: flight.durationInbound ?? null,
      durationReturn: flight.durationInbound ?? null,
      priceRaw: flight.priceRaw,
      rawSnippet: flight.rawSnippet,
      checkedBagIncluded: flight.checkedBagIncluded ?? null,
      carryOnIncluded: flight.carryOnIncluded ?? null,
      baggageRaw: flight.baggageRaw ?? null,
    },
  };
}

export type { ScrapedFlight, KayakQuery };
export { scrapeKayak, scrapeMomondo, scrapeTrip };

function safeDaysBetween(departDate: string, returnDate: string): number {
  try {
    return Math.max(0, daysBetween(departDate, returnDate));
  } catch {
    return 0;
  }
}

const DEFAULT_USD_TO_KRW = 1350;

function convertToKrw(amount: number, currency: string, rates: Record<string, number>): number {
  if (!amount) return 0;
  if (currency === "KRW") return amount;
  const normalized = currency.toUpperCase();
  const rate = rates[normalized] ?? rates.USD ?? DEFAULT_USD_TO_KRW;
  return amount * rate;
}

function buildPriceIncludes(flight: ScrapedFlight): PriceInclude[] {
  const includes: PriceInclude[] = ["taxes", "fees"];
  if (flight.carryOnIncluded === true) {
    includes.push("carry_on");
  }
  if (flight.checkedBagIncluded === true) {
    includes.push("checked_bag");
  }
  if (flight.checkedBagIncluded == null && flight.carryOnIncluded == null) {
    includes.push("baggage_unknown");
  }
  return includes;
}
