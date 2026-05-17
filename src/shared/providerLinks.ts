import type { NormalizedProvider } from "./types.js";

export function buildProviderSearchUrl(input: {
  provider: NormalizedProvider | string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
}): string {
  const provider = normalizeProviderForLink(input.provider);
  const origin = input.origin.trim().toUpperCase();
  const destination = input.destination.trim().toUpperCase();

  switch (provider) {
    case "momondo":
      return `https://www.momondo.co.kr/flight-search/${origin}-${destination}/${input.departDate}/${input.returnDate}?sort=price_a&currency=KRW&fs=stops%3D0`;
    case "trip":
      return `https://kr.trip.com/flights/showfarefirst?dcity=${origin}&acity=${destination}&ddate=${input.departDate}&rdate=${input.returnDate}&triptype=rt&class=y&quantity=1&nonstoponly=on&locale=ko-KR&curr=KRW&currency=KRW`;
    case "kayak":
    default:
      return `https://www.kayak.co.kr/flights/${origin}-${destination}/${input.departDate}/${input.returnDate}?sort=price_a&currency=KRW&fs=stops%3D0`;
  }
}

export function normalizeProviderForLink(provider: string): string {
  const lower = provider.trim().toLowerCase().replace(/[-\s]/g, "_");
  if (lower === "trip_com" || lower === "tripcom") return "trip";
  return lower;
}
