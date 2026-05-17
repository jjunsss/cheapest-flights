import { randomUUID } from "node:crypto";
import type {
  DirectVerification,
  ExchangeRateSnapshot,
  FlightCandidate,
  PriceInclude
} from "../../shared/types.js";
import { assertIata } from "./validation.js";
import { convertToKrw } from "./fx.js";
import { daysBetween, parseDateOnly } from "./dates.js";

export interface CsvParseResult {
  candidates: FlightCandidate[];
  warnings: string[];
  skippedRows: number;
}

interface CsvOptions {
  runId: string;
  exchangeRates: ExchangeRateSnapshot;
  importedAt?: Date;
}

const REQUIRED_COLUMNS = ["origin", "destination", "depart_date", "return_date", "currency"];

export function parseCandidateCsv(text: string, options: CsvOptions): CsvParseResult {
  const importedAt = (options.importedAt ?? new Date()).toISOString();
  const rows = parseCsvRows(text);
  const warnings: string[] = [];
  const candidates: FlightCandidate[] = [];
  let skippedRows = 0;

  if (rows.length === 0) {
    return { candidates, warnings: ["CSV is empty."], skippedRows };
  }

  const headers = rows[0]?.map(normalizeHeader) ?? [];
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const missing = REQUIRED_COLUMNS.filter((column) => !headerIndex.has(column));
  if (!hasAnyPriceColumn(headerIndex)) {
    missing.push("total_price or price_total");
  }
  if (missing.length > 0) {
    throw new Error(`CSV is missing required column(s): ${missing.join(", ")}.`);
  }

  const seen = new Set<string>();
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row || row.every((cell) => cell.trim() === "")) {
      continue;
    }

    try {
      const source = getCell(row, headerIndex, "source") || getCell(row, headerIndex, "provider") || "csv";
      const origin = assertIata(getCell(row, headerIndex, "origin"), `row ${rowIndex + 1} origin`);
      const destination = assertIata(
        getCell(row, headerIndex, "destination"),
        `row ${rowIndex + 1} destination`
      );
      const departDate = getCell(row, headerIndex, "depart_date");
      const returnDate = getCell(row, headerIndex, "return_date");
      parseDateOnly(departDate);
      parseDateOnly(returnDate);
      const stayDays = daysBetween(departDate, returnDate);
      if (stayDays < 1) {
        throw new Error("return_date must be after depart_date");
      }

      const priceTotal = parsePrice(
        getCell(row, headerIndex, "total_price") ||
          getCell(row, headerIndex, "price_total") ||
          getCell(row, headerIndex, "price_amount")
      );
      const priceCurrency = getCell(row, headerIndex, "currency").toUpperCase();
      if (!/^[A-Z]{3}$/.test(priceCurrency)) {
        throw new Error("currency must be a 3-letter ISO code");
      }

      const capturedAt = getCell(row, headerIndex, "captured_at") || importedAt;
      const capturedDate = new Date(capturedAt);
      if (Number.isNaN(capturedDate.getTime())) {
        throw new Error("captured_at must be an ISO date/time when provided");
      }

      const outboundDirect = parseDirectFlag(getCell(row, headerIndex, "outbound_direct"));
      const returnDirect = parseDirectFlag(getCell(row, headerIndex, "return_direct"));
      const directVerification = combineDirectVerification(outboundDirect, returnDirect);
      const priceIncludes = parsePriceIncludes(getCell(row, headerIndex, "price_includes"));
      const pricePerAdult = parsePricePerAdult(getCell(row, headerIndex, "price_per_adult"));
      const bookingUrl = getCell(row, headerIndex, "booking_url") || undefined;

      const dedupeKey = [
        source,
        origin,
        destination,
        departDate,
        returnDate,
        priceTotal,
        priceCurrency,
        capturedDate.toISOString()
      ].join("|");
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      candidates.push({
        id: randomUUID(),
        runId: options.runId,
        provider: source,
        origin,
        destination,
        departDate,
        returnDate,
        stayDays,
        priceTotal,
        priceCurrency,
        priceKrw: convertToKrw(priceTotal, priceCurrency, options.exchangeRates),
        priceIncludes,
        pricePerAdult,
        outboundDirect,
        returnDirect,
        directVerification,
        bookingUrl,
        capturedAt: capturedDate.toISOString(),
        raw: rowToObject(row, headers)
      });
    } catch (error) {
      skippedRows += 1;
      warnings.push(`Row ${rowIndex + 1} skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { candidates, warnings, skippedRows };
}

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.length > 1 || row[0]?.trim()) {
    rows.push(row);
  }
  return rows;
}

function hasAnyPriceColumn(headerIndex: Map<string, number>): boolean {
  return (
    headerIndex.has("total_price") || headerIndex.has("price_total") || headerIndex.has("price_amount")
  );
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function getCell(row: string[], headerIndex: Map<string, number>, header: string): string {
  const index = headerIndex.get(header);
  if (index === undefined) return "";
  return row[index]?.trim() ?? "";
}

function parsePrice(value: string): number {
  const normalized = value.replace(/[,\s]/g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error("price must be a positive number");
  }
  return number;
}

function parseDirectFlag(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "t", "yes", "y", "1", "direct", "nonstop", "non-stop"].includes(normalized)) {
    return true;
  }
  if (["false", "f", "no", "n", "0", "stop", "stops", "layover"].includes(normalized)) {
    return false;
  }
  return null;
}

function combineDirectVerification(
  outboundDirect: boolean | null,
  returnDirect: boolean | null
): DirectVerification {
  if (outboundDirect === false || returnDirect === false) return "not_direct";
  if (outboundDirect === true && returnDirect === true) return "verified_direct";
  return "unknown";
}

function parsePriceIncludes(value: string): PriceInclude[] {
  if (!value.trim()) return ["unknown_fees", "baggage_unknown"];
  const allowed = new Set<PriceInclude>([
    "taxes",
    "fees",
    "unknown_fees",
    "carry_on",
    "checked_bag",
    "baggage_unknown"
  ]);
  const parsed = value
    .split(/[|;]/)
    .map((part) => part.trim().toLowerCase().replace(/[\s-]+/g, "_"))
    .filter((part): part is PriceInclude => allowed.has(part as PriceInclude));
  return parsed.length > 0 ? parsed : ["unknown_fees", "baggage_unknown"];
}

function parsePricePerAdult(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return !["false", "f", "no", "n", "0"].includes(normalized);
}

function rowToObject(row: string[], headers: string[]): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((header, index) => {
    output[header] = row[index] ?? "";
  });
  return output;
}
