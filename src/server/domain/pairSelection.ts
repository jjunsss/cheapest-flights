import type { DatePair } from "./dates.js";

export interface PairSelectionSummary {
  selected: DatePair[];
  totalPairs: number;
  coveredDepartureDates: number;
  totalDepartureDates: number;
  coveredStayDays: number;
  totalStayDays: number;
}

export function selectDepartureFirstPairs(pairs: DatePair[], cap: number): PairSelectionSummary {
  const totalPairs = pairs.length;
  const groups = groupByDeparture(pairs);
  const totalDepartureDates = groups.length;
  const stayOrder = buildStayPriority(groups);
  const totalStayDays = stayOrder.length;
  if (cap <= 0 || pairs.length === 0) {
    return {
      selected: [],
      totalPairs,
      coveredDepartureDates: 0,
      totalDepartureDates,
      coveredStayDays: 0,
      totalStayDays,
    };
  }
  if (pairs.length <= cap) {
    return {
      selected: pairs,
      totalPairs,
      coveredDepartureDates: totalDepartureDates,
      totalDepartureDates,
      coveredStayDays: new Set(pairs.map((pair) => pair.stayDays)).size,
      totalStayDays,
    };
  }

  const selected: DatePair[] = [];
  const seen = new Set<string>();

  const broadGroups = distributeGroups(groups, Math.min(groups.length, cap), 0);
  broadGroups.forEach((group, index) => {
    if (selected.length >= cap) return;
    addClosestUnseenPair(selected, seen, group, stayOrder[index % stayOrder.length]!);
  });

  for (let layer = 1; selected.length < cap && layer < groups.length + stayOrder.length + 2; layer += 1) {
    const remaining = cap - selected.length;
    const orderedGroups = distributeGroups(groups, Math.min(groups.length, remaining), layer);
    let addedInLayer = 0;
    for (let index = 0; index < orderedGroups.length; index += 1) {
      if (selected.length >= cap) break;
      const group = orderedGroups[index]!;
      const before = selected.length;
      addClosestUnseenPair(selected, seen, group, stayOrder[(index + layer) % stayOrder.length]!);
      if (selected.length > before) addedInLayer += 1;
    }
    if (addedInLayer === 0) break;
  }

  if (selected.length < cap) {
    for (const pair of pairs) {
      if (selected.length >= cap) break;
      const key = pairKey(pair);
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(pair);
    }
  }

  return {
    selected,
    totalPairs,
    coveredDepartureDates: new Set(selected.map((pair) => pair.departDate)).size,
    totalDepartureDates,
    coveredStayDays: new Set(selected.map((pair) => pair.stayDays)).size,
    totalStayDays,
  };
}

interface DepartureGroup {
  departDate: string;
  pairs: DatePair[];
}

function groupByDeparture(pairs: DatePair[]): DepartureGroup[] {
  const map = new Map<string, DatePair[]>();
  for (const pair of pairs) {
    const group = map.get(pair.departDate) ?? [];
    group.push(pair);
    map.set(pair.departDate, group);
  }
  return Array.from(map.entries()).map(([departDate, groupPairs]) => ({
    departDate,
    pairs: [...groupPairs].sort((a, b) => a.stayDays - b.stayDays),
  }));
}

function buildStayPriority(groups: DepartureGroup[]): number[] {
  const stays = Array.from(
    new Set(groups.flatMap((group) => group.pairs.map((pair) => pair.stayDays))),
  ).sort((a, b) => a - b);
  if (stays.length <= 2) return stays;

  const middle = stays[Math.floor((stays.length - 1) / 2)]!;
  const priority = [middle, stays[0]!, stays[stays.length - 1]!];
  for (const stay of stays) {
    if (!priority.includes(stay)) {
      priority.push(stay);
    }
  }
  return priority;
}

function distributeGroups(groups: DepartureGroup[], count: number, layer: number): DepartureGroup[] {
  if (count >= groups.length) {
    return rotate(groups, layer % groups.length);
  }
  if (count <= 1) {
    return [groups[Math.min(groups.length - 1, Math.floor(groups.length / 2))]!];
  }

  const step = (groups.length - 1) / (count - 1);
  const picked: DepartureGroup[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const idx = Math.round(i * step);
    if (seen.has(idx)) continue;
    seen.add(idx);
    picked.push(groups[idx]!);
  }
  return rotate(picked, layer % picked.length);
}

function rotate<T>(items: T[], offset: number): T[] {
  if (items.length === 0 || offset === 0) return items;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function addClosestUnseenPair(
  selected: DatePair[],
  seen: Set<string>,
  group: DepartureGroup,
  targetStay: number,
): void {
  const pair = [...group.pairs].sort(
    (a, b) => Math.abs(a.stayDays - targetStay) - Math.abs(b.stayDays - targetStay) || a.stayDays - b.stayDays,
  ).find((candidate) => !seen.has(pairKey(candidate)));
  if (!pair) return;
  seen.add(pairKey(pair));
  selected.push(pair);
}

function pairKey(pair: DatePair): string {
  return `${pair.departDate}/${pair.returnDate}`;
}
