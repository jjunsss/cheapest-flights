import { parseCsvRows, parseCandidateCsv } from "./domain/csv.js";

export { parseCandidateCsv };

export interface FlightCsvRecord {
  carrier: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departAt: string;
  returnAt: string;
  currency: string;
  totalPrice: number;
  durationMinutes: number;
  stops: number;
  bookingUrl: string;
}

const REQUIRED_COLUMNS = [
  "carrier",
  "flight_number",
  "origin",
  "destination",
  "depart_at",
  "return_at",
  "currency",
  "total_price",
  "duration_minutes",
  "stops",
  "booking_url"
];

export function parseFlightCsv(csvText: string): FlightCsvRecord[] {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return [];
  }

  const headers = (rows[0] ?? []).map((header) => header.trim().toLowerCase());
  const index = new Map(headers.map((header, position) => [header, position]));
  const missing = REQUIRED_COLUMNS.filter((header) => !index.has(header));
  if (missing.length > 0) {
    throw new Error(`CSV missing required column(s): ${missing.join(", ")}`);
  }

  const records: FlightCsvRecord[] = [];
  const errors: string[] = [];

  for (let rowNumber = 2; rowNumber <= rows.length; rowNumber += 1) {
    const row = rows[rowNumber - 1];
    if (!row || row.every((cell) => cell.trim() === "")) continue;

    try {
      const departAt = cell(row, index, "depart_at");
      const returnAt = cell(row, index, "return_at");
      assertValidDateTime(departAt, "depart_at");
      assertValidDateTime(returnAt, "return_at");

      records.push({
        carrier: cell(row, index, "carrier"),
        flightNumber: cell(row, index, "flight_number"),
        origin: assertIata(cell(row, index, "origin"), "origin"),
        destination: assertIata(cell(row, index, "destination"), "destination"),
        departAt,
        returnAt,
        currency: assertCurrency(cell(row, index, "currency")),
        totalPrice: parsePositiveNumber(cell(row, index, "total_price"), "total_price"),
        durationMinutes: parsePositiveInteger(cell(row, index, "duration_minutes"), "duration_minutes"),
        stops: parseNonNegativeInteger(cell(row, index, "stops"), "stops"),
        bookingUrl: cell(row, index, "booking_url")
      });
    } catch (error) {
      errors.push(`row ${rowNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return records;
}

function cell(row: string[], index: Map<string, number>, header: string): string {
  const position = index.get(header);
  const value = position === undefined ? "" : row[position]?.trim() ?? "";
  if (!value) {
    throw new Error(`${header} is required`);
  }
  return value;
}

function assertIata(value: string, field: string): string {
  const normalized = value.toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error(`${field} must be a 3-letter IATA code`);
  }
  return normalized;
}

function assertCurrency(value: string): string {
  const normalized = value.toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("currency must be a 3-letter ISO code");
  }
  return normalized;
}

function assertValidDateTime(value: string, field: string): void {
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw new Error(`${field} must be a valid ISO date/time`);
  }
}

function parsePositiveNumber(value: string, field: string): number {
  const number = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
  return number;
}

function parsePositiveInteger(value: string, field: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return number;
}

function parseNonNegativeInteger(value: string, field: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return number;
}
