import { generateDatePairs as generateDomainDatePairs } from "./domain/dates.js";

export interface GenerateDatePairsOptions {
  departFrom: string;
  departTo: string;
  minNights: number;
  maxNights: number;
}

export interface GeneratedDatePair {
  departDate: string;
  returnDate: string;
  nights: number;
}

export function generateDatePairs(options: GenerateDatePairsOptions): GeneratedDatePair[] {
  return generateDomainDatePairs(
    options.departFrom,
    options.departTo,
    options.minNights,
    options.maxNights
  ).map((pair) => ({
    departDate: pair.departDate,
    returnDate: pair.returnDate,
    nights: pair.stayDays
  }));
}
