import type { FlightSearchPayload, NormalizedProvider } from "../../shared/types.js";
import { compareDateOnly, parseDateOnly, todayDateOnly } from "./dates.js";

const IATA_RE = /^[A-Z]{3}$/;

export interface NormalizedSearchParams {
  origin: string;
  destinations: string[];
  dateRange: {
    start: string;
    end: string;
  };
  stay: {
    minNights: number;
    maxNights: number;
  };
  providers: NormalizedProvider[];
  currency: string;
  csvText?: string;
}

export function normalizeProvider(provider: string): NormalizedProvider {
  const trimmed = provider.trim();
  const lower = trimmed.toLowerCase().replace(/[-\s]/g, "_");
  if (lower === "kayak") return "kayak";
  if (lower === "momondo") return "momondo";
  if (lower === "trip" || lower === "trip_com" || lower === "tripcom") return "trip";
  if (lower === "csv") return "csv";
  return lower;
}

export function assertIata(value: string, label: string): string {
  const normalized = value.trim().toUpperCase();
  if (!IATA_RE.test(normalized)) {
    throw new Error(`${label} must be a 3-letter IATA code.`);
  }
  return normalized;
}

export function normalizeSearchPayload(payload: FlightSearchPayload): NormalizedSearchParams {
  if (!payload || typeof payload !== "object") {
    throw new Error("Request body is required.");
  }

  const origin = assertIata(payload.origin ?? "", "origin");
  const destinations = Array.from(
    new Set((payload.destinations ?? []).map((destination) => assertIata(destination, "destination")))
  ).filter((destination) => destination !== origin);

  if (destinations.length === 0) {
    throw new Error("At least one destination different from origin is required.");
  }

  const start = payload.dateRange?.start;
  const end = payload.dateRange?.end;
  parseDateOnly(start);
  parseDateOnly(end);
  if (compareDateOnly(start, todayDateOnly()) < 0) {
    throw new Error("dateRange.start cannot be in the past.");
  }
  if (compareDateOnly(end, start) < 0) {
    throw new Error("dateRange.end must be on or after dateRange.start.");
  }

  const minNights = Number(payload.stay?.minNights);
  const maxNights = Number(payload.stay?.maxNights);
  if (!Number.isInteger(minNights) || !Number.isInteger(maxNights) || minNights < 1) {
    throw new Error("stay.minNights and stay.maxNights must be positive whole numbers.");
  }
  if (maxNights < minNights || maxNights > 120) {
    throw new Error("stay.maxNights must be at least minNights and no more than 120.");
  }

  const providers = Array.from(
    new Set((payload.providers ?? []).map((provider) => normalizeProvider(String(provider))))
  ).filter(Boolean);
  if (providers.length === 0) {
    providers.push("csv");
  }

  const currency = (payload.currency ?? "KRW").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("currency must be a 3-letter ISO currency code.");
  }

  return {
    origin,
    destinations,
    dateRange: { start, end },
    stay: { minNights, maxNights },
    providers,
    currency,
    csvText: payload.csvText
  };
}
