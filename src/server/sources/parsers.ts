export interface ParsedFlightCard {
  priceUsd?: number;
  priceKrw?: number;
  priceRaw: string;
  priceCurrency: string;
  carrier?: string;
  outboundDepart?: string;
  outboundArrive?: string;
  inboundDepart?: string;
  inboundArrive?: string;
  durationOutbound?: string;
  durationInbound?: string;
  nonstop: boolean;
  checkedBagIncluded?: boolean | null;
  carryOnIncluded?: boolean | null;
  baggageRaw?: string;
  rawSnippet: string;
}

const CARRIER_HINTS = [
  'Korean Air',
  'Asiana',
  'Jeju Air',
  "T'way Air",
  'Tway Air',
  'Air Busan',
  'Air Seoul',
  'Jin Air',
  'Eastar Jet',
  'Aero K',
  'JAL',
  'Japan Airlines',
  'ANA',
  'All Nippon',
  'Peach',
  'Jetstar',
  'AirAsia',
  'Air Asia',
  'Cebu Pacific',
  'Cathay',
  'EVA Air',
  'China Airlines',
  'Garuda',
  'Singapore Airlines',
  'Vietnam Airlines',
  'Vietjet',
  'Thai Airways',
  'Thai AirAsia',
  'Bangkok Airways',
  'Philippine Airlines',
  'Malaysia Airlines',
  'Lufthansa',
  'Emirates',
  'Qatar',
  'Etihad',
  '대한항공',
  '아시아나',
  '제주항공',
  '진에어',
  '티웨이',
  '에어부산',
  '에어서울',
  '티웨이항공',
  '이스타항공',
  '이스타',
  '에어로케이',
  '에어프레미아',
  '피치항공',
  '젯스타',
  '스타플라이어',
  '스카이마크',
  '솔라시드',
  '중국동방항공',
  '중국남방항공',
  '중국국제항공',
  '상하이항공',
  '홍콩익스프레스',
  '캐세이퍼시픽',
  '에바항공',
  '중화항공',
  '비엣젯',
  '베트남항공',
  '타이항공',
  '타이에어아시아',
  '세부퍼시픽',
  '필리핀항공',
  '싱가포르항공',
];
const CARRIER_HINTS_LOWER = CARRIER_HINTS.map((carrier) => carrier.toLowerCase());
const FLIGHT_CODE_CARRIERS: Array<[RegExp, string]> = [
  [/(^|[^A-Z0-9])KE\s?-?\d{2,4}\b/i, '대한항공'],
  [/(^|[^A-Z0-9])OZ\s?-?\d{2,4}\b/i, '아시아나'],
  [/(^|[^A-Z0-9])7C\s?-?\d{2,4}\b/i, '제주항공'],
  [/(^|[^A-Z0-9])LJ\s?-?\d{2,4}\b/i, '진에어'],
  [/(^|[^A-Z0-9])TW\s?-?\d{2,4}\b/i, '티웨이'],
  [/(^|[^A-Z0-9])BX\s?-?\d{2,4}\b/i, '에어부산'],
  [/(^|[^A-Z0-9])RS\s?-?\d{2,4}\b/i, '에어서울'],
  [/(^|[^A-Z0-9])ZE\s?-?\d{2,4}\b/i, '이스타항공'],
  [/(^|[^A-Z0-9])RF\s?-?\d{2,4}\b/i, '에어로케이'],
  [/(^|[^A-Z0-9])YP\s?-?\d{2,4}\b/i, '에어프레미아'],
  [/(^|[^A-Z0-9])JL\s?-?\d{2,4}\b/i, 'JAL'],
  [/(^|[^A-Z0-9])NH\s?-?\d{2,4}\b/i, 'ANA'],
  [/(^|[^A-Z0-9])MM\s?-?\d{2,4}\b/i, 'Peach'],
  [/(^|[^A-Z0-9])GK\s?-?\d{2,4}\b/i, 'Jetstar'],
  [/(^|[^A-Z0-9])BC\s?-?\d{2,4}\b/i, 'Skymark'],
  [/(^|[^A-Z0-9])IT\s?-?\d{2,4}\b/i, 'Tigerair Taiwan'],
  [/(^|[^A-Z0-9])CI\s?-?\d{2,4}\b/i, 'China Airlines'],
  [/(^|[^A-Z0-9])BR\s?-?\d{2,4}\b/i, 'EVA Air'],
  [/(^|[^A-Z0-9])UO\s?-?\d{2,4}\b/i, 'Hong Kong Express'],
  [/(^|[^A-Z0-9])CX\s?-?\d{2,4}\b/i, 'Cathay Pacific'],
  [/(^|[^A-Z0-9])VJ\s?-?\d{2,4}\b/i, 'Vietjet'],
  [/(^|[^A-Z0-9])VN\s?-?\d{2,4}\b/i, 'Vietnam Airlines'],
  [/(^|[^A-Z0-9])5J\s?-?\d{2,4}\b/i, 'Cebu Pacific'],
  [/(^|[^A-Z0-9])PR\s?-?\d{2,4}\b/i, 'Philippine Airlines'],
  [/(^|[^A-Z0-9])SQ\s?-?\d{2,4}\b/i, 'Singapore Airlines'],
  [/(^|[^A-Z0-9])MU\s?-?\d{2,4}\b/i, 'China Eastern'],
  [/(^|[^A-Z0-9])CZ\s?-?\d{2,4}\b/i, 'China Southern'],
  [/(^|[^A-Z0-9])CA\s?-?\d{2,4}\b/i, 'Air China'],
];

const TIME_RE = /(\d{1,2}:\d{2}\s*(?:am|pm)?)/gi;
const DURATION_RE = /(\d+h\s*\d*m?|\d+시간\s*\d*분?)/gi;
const CHECKED_BAG_INCLUDED_RE =
  /위탁\s*수하물.{0,18}(포함|무료|제공|1개|15\s?kg|20\s?kg|23\s?kg)|checked\s*(bag|baggage).{0,24}(included|free|1|15\s?kg|20\s?kg|23\s?kg)|includes?.{0,24}checked\s*(bag|baggage)/i;
const CHECKED_BAG_EXCLUDED_RE =
  /(위탁\s*수하물|수하물).{0,18}(불포함|미포함|별도|추가|없음|제외)|(?:no|without).{0,24}checked\s*(bag|baggage)|checked\s*(bag|baggage).{0,28}(not included|excluded|extra|separate|fee)/i;
const CARRY_ON_INCLUDED_RE = /기내\s*수하물|휴대\s*수하물|carry[-\s]?on|cabin\s*bag/i;
type ParsedPrice = {
  amount: number;
  currency: 'KRW' | 'USD';
  raw: string;
};

// The "원" suffix variant must match proper thousand-separated numbers (or 5+
// digit plain integers). Otherwise text like "NRTT1504,200원" gets misparsed as
// "1504,200원" — pulling the leading "1" off the terminal label and inflating
// the price by 1,000,000.
const PRICE_RE = /(US\$|\$|₩|KRW\s?)\s?([\d,]{3,})|(\d{1,3}(?:,\d{3})+|\d{5,})\s?원/g;

export function parseCardText(text: string): ParsedFlightCard | null {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  if (!/nonstop|직항|nostop|0\s*stops?/i.test(clean)) return null;

  // Skip advertisements
  if (/\bAd\b|paid placement|sponsored|광고/i.test(clean)) return null;

  const priceMatch = Array.from(clean.matchAll(PRICE_RE))
    .map(parsePriceMatch)
    .filter((p): p is ParsedPrice => Boolean(p));

  if (priceMatch.length === 0) return null;

  // Korean won is the comparison source of truth. If a card contains both
  // a KRW display price and a foreign approximate price, keep the KRW value.
  const comparablePrices = priceMatch.some((price) => price.currency === 'KRW')
    ? priceMatch.filter((price) => price.currency === 'KRW')
    : priceMatch;
  comparablePrices.sort((a, b) => a.amount - b.amount);
  const cheapest = comparablePrices[0]!;

  let priceUsd: number | undefined;
  let priceKrw: number | undefined;
  const priceCurrency = cheapest.currency;
  if (cheapest.currency === 'KRW') {
    priceKrw = cheapest.amount;
  } else {
    priceUsd = cheapest.amount;
  }

  const times = Array.from(clean.matchAll(TIME_RE)).map((m) => m[1]!);
  const durations = Array.from(clean.matchAll(DURATION_RE)).map((m) => m[1]!);
  const baggage = parseBaggage(clean);

  return {
    priceUsd,
    priceKrw,
    priceCurrency,
    priceRaw: cheapest.raw,
    carrier: parseCarrier(clean),
    outboundDepart: times[0],
    outboundArrive: times[1],
    inboundDepart: times[2],
    inboundArrive: times[3],
    durationOutbound: durations[0],
    durationInbound: durations[1],
    nonstop: true,
    checkedBagIncluded: baggage.checkedBagIncluded,
    carryOnIncluded: baggage.carryOnIncluded,
    baggageRaw: baggage.raw,
    rawSnippet: clean.slice(0, 380),
  };
}

function parseCarrier(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  for (let i = 0; i < CARRIER_HINTS.length; i += 1) {
    if (lowerText.includes(CARRIER_HINTS_LOWER[i]!)) {
      return CARRIER_HINTS[i]!;
    }
  }
  for (const [pattern, carrier] of FLIGHT_CODE_CARRIERS) {
    if (pattern.test(text)) return carrier;
  }
  return undefined;
}

function parsePriceMatch(match: RegExpMatchArray): ParsedPrice | null {
  const prefix = match[1]?.trim() ?? '';
  const prefixedAmount = match[2];
  const wonAmount = match[3];
  const amount = Number((prefixedAmount ?? wonAmount ?? '').replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;

  if (wonAmount || prefix.startsWith('₩') || prefix.toUpperCase().startsWith('KRW')) {
    if (amount < 10_000 || amount > 50_000_000) return null;
    return {
      amount,
      currency: 'KRW',
      raw: wonAmount ? `${amount.toLocaleString('ko-KR')}원` : `₩${amount.toLocaleString('ko-KR')}`,
    };
  }

  if (prefix.startsWith('US$') || prefix === '$') {
    if (amount < 30 || amount > 50_000) return null;
    return {
      amount,
      currency: 'USD',
      raw: `${prefix}${amount.toLocaleString('en-US')}`,
    };
  }

  return null;
}

function parseBaggage(text: string): {
  checkedBagIncluded: boolean | null;
  carryOnIncluded: boolean | null;
  raw?: string;
} {
  const excluded = CHECKED_BAG_EXCLUDED_RE.exec(text);
  const included = CHECKED_BAG_INCLUDED_RE.exec(text);
  const carryOn = CARRY_ON_INCLUDED_RE.exec(text);

  let checkedBagIncluded: boolean | null = null;
  let raw = included?.[0] ?? excluded?.[0] ?? carryOn?.[0];
  if (excluded) {
    checkedBagIncluded = false;
    raw = excluded[0];
  } else if (included) {
    checkedBagIncluded = true;
    raw = included[0];
  }

  return {
    checkedBagIncluded,
    carryOnIncluded: carryOn ? true : null,
    raw,
  };
}
