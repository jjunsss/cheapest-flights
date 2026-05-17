export interface DateOnly {
  year: number;
  month: number;
  day: number;
}

export interface DatePair {
  departDate: string;
  returnDate: string;
  stayDays: number;
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(value: string): DateOnly {
  const match = DATE_ONLY_RE.exec(value);
  if (!match) {
    throw new Error(`Invalid date '${value}'. Expected YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date '${value}'.`);
  }

  return { year, month, day };
}

export function formatDateOnly(date: DateOnly): string {
  return `${date.year.toString().padStart(4, "0")}-${date.month
    .toString()
    .padStart(2, "0")}-${date.day.toString().padStart(2, "0")}`;
}

export function todayDateOnly(now = new Date()): string {
  return formatDateOnly({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
  });
}

export function toUtcDate(value: DateOnly): Date {
  return new Date(Date.UTC(value.year, value.month - 1, value.day));
}

export function fromUtcDate(value: Date): DateOnly {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate()
  };
}

export function addDays(value: string, days: number): string {
  const date = toUtcDate(parseDateOnly(value));
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(fromUtcDate(date));
}

export function addMonthsClamped(value: string, months: number): string {
  const parsed = parseDateOnly(value);
  const originalDay = parsed.day;
  const firstOfTarget = new Date(Date.UTC(parsed.year, parsed.month - 1 + months, 1));
  const lastOfTarget = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)
  ).getUTCDate();

  return formatDateOnly({
    year: firstOfTarget.getUTCFullYear(),
    month: firstOfTarget.getUTCMonth() + 1,
    day: Math.min(originalDay, lastOfTarget)
  });
}

export function compareDateOnly(a: string, b: string): number {
  return toUtcDate(parseDateOnly(a)).getTime() - toUtcDate(parseDateOnly(b)).getTime();
}

export function daysBetween(start: string, end: string): number {
  const startTime = toUtcDate(parseDateOnly(start)).getTime();
  const endTime = toUtcDate(parseDateOnly(end)).getTime();
  return Math.round((endTime - startTime) / 86_400_000);
}

export function generateDatePairs(
  startDate: string,
  endDate: string,
  minStayDays: number,
  maxStayDays: number
): DatePair[] {
  if (compareDateOnly(endDate, startDate) < 0) {
    throw new Error("dateRange.end must be on or after dateRange.start.");
  }
  if (!Number.isInteger(minStayDays) || !Number.isInteger(maxStayDays)) {
    throw new Error("Stay range must use whole days.");
  }
  if (minStayDays < 1 || maxStayDays < minStayDays) {
    throw new Error("Invalid stay range.");
  }

  const pairs: DatePair[] = [];
  for (let depart = startDate; compareDateOnly(depart, endDate) <= 0; depart = addDays(depart, 1)) {
    for (let stayDays = minStayDays; stayDays <= maxStayDays; stayDays += 1) {
      const returnDate = addDays(depart, stayDays);
      pairs.push({ departDate: depart, returnDate, stayDays });
    }
  }
  return pairs;
}
