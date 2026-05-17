import { describe, expect, test } from "vitest";
import { importExpectedModule } from "./helpers/module.js";

const sampleQuery = {
  origin: "ICN",
  destination: "FUK",
  departDate: "2026-05-23",
  returnDate: "2026-05-28",
  nonstopOnly: true,
};

describe("KRW-first provider search", () => {
  test("provider URLs request Korean locale and KRW where supported", async () => {
    const { buildTripUrl } = await importExpectedModule("src/server/sources/trip.ts", ["buildTripUrl"]);
    const { buildKayakUrl } = await importExpectedModule("src/server/sources/kayak.ts", ["buildKayakUrl"]);
    const { buildMomondoUrl } = await importExpectedModule("src/server/sources/momondo.ts", ["buildMomondoUrl"]);

    const trip = new URL((buildTripUrl as Function)(sampleQuery));
    expect(trip.hostname).toBe("kr.trip.com");
    expect(trip.searchParams.get("locale")).toBe("ko-KR");
    expect(trip.searchParams.get("curr")).toBe("KRW");
    expect(trip.searchParams.get("currency")).toBe("KRW");
    expect(trip.searchParams.get("nonstoponly")).toBe("on");

    const kayak = new URL((buildKayakUrl as Function)(sampleQuery));
    expect(kayak.hostname).toBe("www.kayak.co.kr");
    expect(kayak.searchParams.get("currency")).toBe("KRW");
    expect(kayak.searchParams.get("fs")).toBe("stops=0");

    const momondo = new URL((buildMomondoUrl as Function)(sampleQuery));
    expect(momondo.hostname).toBe("www.momondo.co.kr");
    expect(momondo.searchParams.get("currency")).toBe("KRW");
    expect(momondo.searchParams.get("fs")).toBe("stops=0");
  });

  test("card parser prefers the Korean won display price over a foreign approximate price", async () => {
    const { parseCardText } = await importExpectedModule("src/server/sources/parsers.ts", ["parseCardText"]);

    const parsed = (parseCardText as Function)(
      "직항 티웨이 10:00 11:20 14:00 16:30 US$181 ₩244,350 1시간 20분",
    );

    expect(parsed).toMatchObject({
      priceCurrency: "KRW",
      priceKrw: 244350,
      priceRaw: "₩244,350",
      nonstop: true,
    });
    expect(parsed.priceUsd).toBeUndefined();
  });

  test("card parser reads Korean won suffix prices as KRW", async () => {
    const { parseCardText } = await importExpectedModule("src/server/sources/parsers.ts", ["parseCardText"]);

    const parsed = (parseCardText as Function)(
      "직항 제주항공 08:00 09:25 18:20 19:45 244,350원 1시간 25분",
    );

    expect(parsed).toMatchObject({
      priceCurrency: "KRW",
      priceKrw: 244350,
      priceRaw: "244,350원",
      nonstop: true,
    });
  });

  test("card parser infers airline from flight number prefixes", async () => {
    const { parseCardText } = await importExpectedModule("src/server/sources/parsers.ts", ["parseCardText"]);

    const tway = (parseCardText as Function)(
      "직항 TW 292 10:00 11:20 14:00 16:30 244,350원 1시간 20분",
    );
    const jeju = (parseCardText as Function)(
      "직항 7C1408 08:00 09:25 18:20 19:45 244,350원 1시간 25분",
    );

    expect(tway.carrier).toBe("티웨이");
    expect(jeju.carrier).toBe("제주항공");
  });

  test("candidate conversion keeps raw snippet for parser debugging", async () => {
    const { parseCardText } = await importExpectedModule("src/server/sources/parsers.ts", ["parseCardText"]);
    const { scrapedToCandidate } = await importExpectedModule("src/server/sources/index.ts", ["scrapedToCandidate"]);

    const parsed = (parseCardText as Function)("직항 TW 292 10:00 11:20 14:00 16:30 244,350원 1시간 20분");
    const candidate = (scrapedToCandidate as Function)(
      {
        ...parsed,
        origin: "ICN",
        destination: "FUK",
        departDate: "2026-05-23",
        returnDate: "2026-05-28",
        source: "trip",
        bookingUrl: "https://example.test",
      },
      { runId: "run_1", exchangeRates: { KRW: 1, USD: 1350 } },
    );

    expect(candidate.raw.rawSnippet).toContain("TW 292");
  });

  test("card parser and candidate conversion keep checked baggage signals", async () => {
    const { parseCardText } = await importExpectedModule("src/server/sources/parsers.ts", ["parseCardText"]);
    const { scrapedToCandidate } = await importExpectedModule("src/server/sources/index.ts", ["scrapedToCandidate"]);

    const parsed = (parseCardText as Function)(
      "직항 티웨이 10:00 11:20 14:00 16:30 244,350원 위탁 수하물 포함 기내 수하물 1시간 20분",
    );
    const candidate = (scrapedToCandidate as Function)(
      {
        ...parsed,
        origin: "ICN",
        destination: "FUK",
        departDate: "2026-05-23",
        returnDate: "2026-05-28",
        source: "trip",
        bookingUrl: "https://example.test",
      },
      { runId: "run_1", exchangeRates: { KRW: 1, USD: 1350 } },
    );

    expect(parsed).toMatchObject({
      checkedBagIncluded: true,
      carryOnIncluded: true,
    });
    expect(candidate.priceIncludes).toContain("checked_bag");
    expect(candidate.priceIncludes).toContain("carry_on");
    expect(candidate.raw.checkedBagIncluded).toBe(true);
  });

  test("card parser does not mark separately priced checked baggage as included", async () => {
    const { parseCardText } = await importExpectedModule("src/server/sources/parsers.ts", ["parseCardText"]);

    const parsed = (parseCardText as Function)(
      "직항 제주항공 08:00 09:25 18:20 19:45 244,350원 위탁 수하물 별도 1시간 25분",
    );

    expect(parsed.checkedBagIncluded).toBe(false);
  });

  test("scrape speed helpers keep price text and block heavy nonessential resources", async () => {
    const { hasFlightPriceText, shouldBlockRequestForSpeed } = await importExpectedModule("src/server/sources/_shared.ts", [
      "hasFlightPriceText",
      "shouldBlockRequestForSpeed",
    ]);

    expect((hasFlightPriceText as Function)("직항 244,350원")).toBe(true);
    expect((hasFlightPriceText as Function)("직항 ₩244,350")).toBe(true);
    expect((hasFlightPriceText as Function)("직항 시간 정보만 있음")).toBe(false);

    expect((shouldBlockRequestForSpeed as Function)("image", "https://img.example.test/photo.webp")).toBe(false);
    expect((shouldBlockRequestForSpeed as Function)("font", "https://static.example.test/font.woff2")).toBe(true);
    expect((shouldBlockRequestForSpeed as Function)("media", "https://static.example.test/intro.mp4")).toBe(true);
    expect((shouldBlockRequestForSpeed as Function)("script", "https://www.googletagmanager.com/gtm.js")).toBe(true);
    expect((shouldBlockRequestForSpeed as Function)("document", "https://kr.trip.com/flights/showfarefirst")).toBe(false);
    expect((shouldBlockRequestForSpeed as Function)("xhr", "https://kr.trip.com/api/price")).toBe(false);
  });
});
