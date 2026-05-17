import type { FlightCandidate, NormalizedProvider } from "../../shared/types.js";

const DEFAULT_PROVIDER_PRIORITY = ["csv", "trip", "kayak", "momondo", "skyscanner", "google_flights", "kiwi"];
const FRESHNESS_TOLERANCE_MS = 30 * 60 * 1000;

export function rankCandidates(
  candidates: FlightCandidate[],
  providerPriority: NormalizedProvider[] = DEFAULT_PROVIDER_PRIORITY
): FlightCandidate[] {
  const priority = new Map(providerPriority.map((provider, index) => [provider, index]));

  return [...candidates]
    .filter((candidate) => candidate.directVerification === "verified_direct")
    .filter((candidate) => candidate.priceKrw !== null)
    .sort((a, b) => {
      const priceDelta = (a.priceKrw ?? Number.POSITIVE_INFINITY) - (b.priceKrw ?? Number.POSITIVE_INFINITY);
      if (priceDelta !== 0) return priceDelta;

      const baggageDelta = baggageScore(b) - baggageScore(a);
      if (baggageDelta !== 0) return baggageDelta;

      const capturedDelta = new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
      if (Math.abs(capturedDelta) > FRESHNESS_TOLERANCE_MS) return capturedDelta;

      const providerDelta =
        (priority.get(a.provider) ?? Number.MAX_SAFE_INTEGER) -
        (priority.get(b.provider) ?? Number.MAX_SAFE_INTEGER);
      if (providerDelta !== 0) return providerDelta;

      return a.id.localeCompare(b.id);
    });
}

export function groupByDestination(candidates: FlightCandidate[]): Map<string, FlightCandidate[]> {
  const grouped = new Map<string, FlightCandidate[]>();
  for (const candidate of candidates) {
    const existing = grouped.get(candidate.destination) ?? [];
    existing.push(candidate);
    grouped.set(candidate.destination, existing);
  }
  return grouped;
}

function baggageScore(candidate: FlightCandidate): number {
  let score = 0;
  if (candidate.priceIncludes.includes("checked_bag")) score += 2;
  if (candidate.priceIncludes.includes("carry_on")) score += 1;
  if (candidate.priceIncludes.includes("baggage_unknown")) score -= 1;
  return score;
}
