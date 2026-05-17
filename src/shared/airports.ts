export interface AirportInfo {
  code: string;
  cityKo: string;
  airportKo: string;
  countryKo: string;
}

export const AIRPORTS: Record<string, AirportInfo> = {
  ICN: { code: "ICN", cityKo: "서울/인천", airportKo: "인천국제공항", countryKo: "한국" },
  GMP: { code: "GMP", cityKo: "서울", airportKo: "김포국제공항", countryKo: "한국" },
  PUS: { code: "PUS", cityKo: "부산", airportKo: "김해국제공항", countryKo: "한국" },
  CJU: { code: "CJU", cityKo: "제주", airportKo: "제주국제공항", countryKo: "한국" },
  NRT: { code: "NRT", cityKo: "도쿄/나리타", airportKo: "나리타국제공항", countryKo: "일본" },
  HND: { code: "HND", cityKo: "도쿄/하네다", airportKo: "하네다공항", countryKo: "일본" },
  KIX: { code: "KIX", cityKo: "오사카/간사이", airportKo: "간사이국제공항", countryKo: "일본" },
  ITM: { code: "ITM", cityKo: "오사카/이타미", airportKo: "오사카국제공항", countryKo: "일본" },
  FUK: { code: "FUK", cityKo: "후쿠오카", airportKo: "후쿠오카공항", countryKo: "일본" },
  CTS: { code: "CTS", cityKo: "삿포로/치토세", airportKo: "신치토세공항", countryKo: "일본" },
  OKA: { code: "OKA", cityKo: "오키나와/나하", airportKo: "나하공항", countryKo: "일본" },
  TPE: { code: "TPE", cityKo: "타이베이/타오위안", airportKo: "타오위안국제공항", countryKo: "대만" },
  TSA: { code: "TSA", cityKo: "타이베이/쑹산", airportKo: "쑹산공항", countryKo: "대만" },
  KHH: { code: "KHH", cityKo: "가오슝", airportKo: "가오슝국제공항", countryKo: "대만" },
  HKG: { code: "HKG", cityKo: "홍콩", airportKo: "홍콩국제공항", countryKo: "홍콩" },
  MFM: { code: "MFM", cityKo: "마카오", airportKo: "마카오국제공항", countryKo: "마카오" },
  PVG: { code: "PVG", cityKo: "상하이/푸동", airportKo: "푸동국제공항", countryKo: "중국" },
  SHA: { code: "SHA", cityKo: "상하이/훙차오", airportKo: "훙차오국제공항", countryKo: "중국" },
  PEK: { code: "PEK", cityKo: "베이징/서우두", airportKo: "베이징서우두국제공항", countryKo: "중국" },
  PKX: { code: "PKX", cityKo: "베이징/다싱", airportKo: "베이징다싱국제공항", countryKo: "중국" },
  CAN: { code: "CAN", cityKo: "광저우", airportKo: "바이윈국제공항", countryKo: "중국" },
  SZX: { code: "SZX", cityKo: "선전", airportKo: "바오안국제공항", countryKo: "중국" },
  BKK: { code: "BKK", cityKo: "방콕/수완나품", airportKo: "수완나품공항", countryKo: "태국" },
  DMK: { code: "DMK", cityKo: "방콕/돈므앙", airportKo: "돈므앙국제공항", countryKo: "태국" },
  HKT: { code: "HKT", cityKo: "푸켓", airportKo: "푸켓국제공항", countryKo: "태국" },
  CNX: { code: "CNX", cityKo: "치앙마이", airportKo: "치앙마이국제공항", countryKo: "태국" },
  SIN: { code: "SIN", cityKo: "싱가포르", airportKo: "창이공항", countryKo: "싱가포르" },
  KUL: { code: "KUL", cityKo: "쿠알라룸푸르", airportKo: "쿠알라룸푸르국제공항", countryKo: "말레이시아" },
  PEN: { code: "PEN", cityKo: "페낭", airportKo: "페낭국제공항", countryKo: "말레이시아" },
  SGN: { code: "SGN", cityKo: "호치민", airportKo: "떤선녓국제공항", countryKo: "베트남" },
  HAN: { code: "HAN", cityKo: "하노이", airportKo: "노이바이국제공항", countryKo: "베트남" },
  DAD: { code: "DAD", cityKo: "다낭", airportKo: "다낭국제공항", countryKo: "베트남" },
  CXR: { code: "CXR", cityKo: "나트랑/깜라인", airportKo: "깜라인국제공항", countryKo: "베트남" },
  MNL: { code: "MNL", cityKo: "마닐라", airportKo: "니노이 아키노 국제공항", countryKo: "필리핀" },
  CEB: { code: "CEB", cityKo: "세부", airportKo: "막탄 세부 국제공항", countryKo: "필리핀" },
  DPS: { code: "DPS", cityKo: "발리/덴파사르", airportKo: "응우라라이국제공항", countryKo: "인도네시아" },
  CGK: { code: "CGK", cityKo: "자카르타", airportKo: "수카르노 하타 국제공항", countryKo: "인도네시아" },
  SYD: { code: "SYD", cityKo: "시드니", airportKo: "시드니공항", countryKo: "호주" },
  MEL: { code: "MEL", cityKo: "멜버른", airportKo: "멜버른공항", countryKo: "호주" },
  AKL: { code: "AKL", cityKo: "오클랜드", airportKo: "오클랜드공항", countryKo: "뉴질랜드" },
  LAX: { code: "LAX", cityKo: "로스앤젤레스", airportKo: "로스앤젤레스국제공항", countryKo: "미국" },
  SFO: { code: "SFO", cityKo: "샌프란시스코", airportKo: "샌프란시스코국제공항", countryKo: "미국" },
  SEA: { code: "SEA", cityKo: "시애틀", airportKo: "시애틀 타코마 국제공항", countryKo: "미국" },
  JFK: { code: "JFK", cityKo: "뉴욕/JFK", airportKo: "존 F. 케네디 국제공항", countryKo: "미국" },
  EWR: { code: "EWR", cityKo: "뉴욕/뉴어크", airportKo: "뉴어크 리버티 국제공항", countryKo: "미국" },
  BOS: { code: "BOS", cityKo: "보스턴", airportKo: "로건국제공항", countryKo: "미국" },
  ORD: { code: "ORD", cityKo: "시카고", airportKo: "오헤어국제공항", countryKo: "미국" },
  DFW: { code: "DFW", cityKo: "댈러스/포트워스", airportKo: "댈러스 포트워스 국제공항", countryKo: "미국" },
  ATL: { code: "ATL", cityKo: "애틀랜타", airportKo: "하츠필드 잭슨 국제공항", countryKo: "미국" },
  HNL: { code: "HNL", cityKo: "호놀룰루", airportKo: "다니엘 K. 이노우에 국제공항", countryKo: "미국" },
  YVR: { code: "YVR", cityKo: "밴쿠버", airportKo: "밴쿠버국제공항", countryKo: "캐나다" },
  YYZ: { code: "YYZ", cityKo: "토론토", airportKo: "토론토 피어슨 국제공항", countryKo: "캐나다" },
  CDG: { code: "CDG", cityKo: "파리/샤를드골", airportKo: "샤를드골공항", countryKo: "프랑스" },
  ORY: { code: "ORY", cityKo: "파리/오를리", airportKo: "오를리공항", countryKo: "프랑스" },
  LHR: { code: "LHR", cityKo: "런던/히스로", airportKo: "히스로공항", countryKo: "영국" },
  LGW: { code: "LGW", cityKo: "런던/개트윅", airportKo: "개트윅공항", countryKo: "영국" },
  AMS: { code: "AMS", cityKo: "암스테르담", airportKo: "스키폴공항", countryKo: "네덜란드" },
  FRA: { code: "FRA", cityKo: "프랑크푸르트", airportKo: "프랑크푸르트공항", countryKo: "독일" },
  MUC: { code: "MUC", cityKo: "뮌헨", airportKo: "뮌헨공항", countryKo: "독일" },
  FCO: { code: "FCO", cityKo: "로마/피우미치노", airportKo: "레오나르도 다 빈치 국제공항", countryKo: "이탈리아" },
  MXP: { code: "MXP", cityKo: "밀라노/말펜사", airportKo: "말펜사공항", countryKo: "이탈리아" },
  BCN: { code: "BCN", cityKo: "바르셀로나", airportKo: "엘프라트공항", countryKo: "스페인" },
  MAD: { code: "MAD", cityKo: "마드리드", airportKo: "바라하스공항", countryKo: "스페인" },
  ZRH: { code: "ZRH", cityKo: "취리히", airportKo: "취리히공항", countryKo: "스위스" },
  IST: { code: "IST", cityKo: "이스탄불", airportKo: "이스탄불공항", countryKo: "튀르키예" },
  DXB: { code: "DXB", cityKo: "두바이", airportKo: "두바이국제공항", countryKo: "아랍에미리트" },
  DOH: { code: "DOH", cityKo: "도하", airportKo: "하마드국제공항", countryKo: "카타르" },
  AUH: { code: "AUH", cityKo: "아부다비", airportKo: "자이드국제공항", countryKo: "아랍에미리트" },
  DEL: { code: "DEL", cityKo: "델리", airportKo: "인디라 간디 국제공항", countryKo: "인도" },
  BOM: { code: "BOM", cityKo: "뭄바이", airportKo: "차트라파티 시바지 국제공항", countryKo: "인도" },
  TAE: { code: "TAE", cityKo: "대구", airportKo: "대구국제공항", countryKo: "한국" },
  KWJ: { code: "KWJ", cityKo: "광주", airportKo: "광주공항", countryKo: "한국" },
  CJJ: { code: "CJJ", cityKo: "청주", airportKo: "청주국제공항", countryKo: "한국" },
  MWX: { code: "MWX", cityKo: "무안", airportKo: "무안국제공항", countryKo: "한국" },
  USM: { code: "USM", cityKo: "꼬사무이", airportKo: "사무이공항", countryKo: "태국" },
  KBV: { code: "KBV", cityKo: "끄라비", airportKo: "끄라비국제공항", countryKo: "태국" },
  BKI: { code: "BKI", cityKo: "코타키나발루", airportKo: "코타키나발루국제공항", countryKo: "말레이시아" },
  LGK: { code: "LGK", cityKo: "랑카위", airportKo: "랑카위국제공항", countryKo: "말레이시아" },
  REP: { code: "REP", cityKo: "시엠립", airportKo: "시엠립앙코르국제공항", countryKo: "캄보디아" },
  PNH: { code: "PNH", cityKo: "프놈펜", airportKo: "프놈펜국제공항", countryKo: "캄보디아" },
  PQC: { code: "PQC", cityKo: "푸꾸옥", airportKo: "푸꾸옥국제공항", countryKo: "베트남" },
  KLO: { code: "KLO", cityKo: "깔리보", airportKo: "깔리보국제공항", countryKo: "필리핀" },
  MPH: { code: "MPH", cityKo: "보라카이/카티클란", airportKo: "고도프레도 라모스 공항", countryKo: "필리핀" },
  GUM: { code: "GUM", cityKo: "괌", airportKo: "괌 안토니오 B. 원 팟 국제공항", countryKo: "괌" },
  SPN: { code: "SPN", cityKo: "사이판", airportKo: "사이판국제공항", countryKo: "북마리아나제도" },
  RMQ: { code: "RMQ", cityKo: "타이중", airportKo: "타이중국제공항", countryKo: "대만" },
  XMN: { code: "XMN", cityKo: "샤먼", airportKo: "샤먼가오치국제공항", countryKo: "중국" },
  HGH: { code: "HGH", cityKo: "항저우", airportKo: "항저우샤오산국제공항", countryKo: "중국" },
  CTU: { code: "CTU", cityKo: "청두", airportKo: "청두솽류국제공항", countryKo: "중국" },
  KMG: { code: "KMG", cityKo: "쿤밍", airportKo: "쿤밍창수이국제공항", countryKo: "중국" },
  ULN: { code: "ULN", cityKo: "울란바토르", airportKo: "칭기즈칸국제공항", countryKo: "몽골" },
  VVO: { code: "VVO", cityKo: "블라디보스토크", airportKo: "블라디보스토크국제공항", countryKo: "러시아" },
  MLE: { code: "MLE", cityKo: "말레", airportKo: "벨라나국제공항", countryKo: "몰디브" },
  KTM: { code: "KTM", cityKo: "카트만두", airportKo: "트리부반국제공항", countryKo: "네팔" },

  // 중국 추가 — 충칭/시안/칭다오/다롄/선양/난징/우한/톈진/하얼빈/정저우/창사
  CKG: { code: "CKG", cityKo: "충칭", airportKo: "장베이국제공항", countryKo: "중국" },
  XIY: { code: "XIY", cityKo: "시안", airportKo: "셴양국제공항", countryKo: "중국" },
  TAO: { code: "TAO", cityKo: "칭다오", airportKo: "자오둥국제공항", countryKo: "중국" },
  DLC: { code: "DLC", cityKo: "다롄", airportKo: "저우수이쯔국제공항", countryKo: "중국" },
  SHE: { code: "SHE", cityKo: "선양", airportKo: "타오셴국제공항", countryKo: "중국" },
  NKG: { code: "NKG", cityKo: "난징", airportKo: "루커우국제공항", countryKo: "중국" },
  WUH: { code: "WUH", cityKo: "우한", airportKo: "톈허국제공항", countryKo: "중국" },
  TSN: { code: "TSN", cityKo: "톈진", airportKo: "빈하이국제공항", countryKo: "중국" },
  HRB: { code: "HRB", cityKo: "하얼빈", airportKo: "타이핑국제공항", countryKo: "중국" },
  CGO: { code: "CGO", cityKo: "정저우", airportKo: "신정국제공항", countryKo: "중국" },
  CSX: { code: "CSX", cityKo: "창사", airportKo: "황화국제공항", countryKo: "중국" },
  KWL: { code: "KWL", cityKo: "구이린", airportKo: "량장국제공항", countryKo: "중국" },
  SYX: { code: "SYX", cityKo: "싼야", airportKo: "펑황국제공항", countryKo: "중국" },
  HAK: { code: "HAK", cityKo: "하이커우", airportKo: "메이란국제공항", countryKo: "중국" },
  YNT: { code: "YNT", cityKo: "옌타이", airportKo: "펑라이국제공항", countryKo: "중국" },
  WEH: { code: "WEH", cityKo: "웨이하이", airportKo: "다수이보국제공항", countryKo: "중국" },

  // 동남아/오세아니아 추가
  RGN: { code: "RGN", cityKo: "양곤", airportKo: "양곤국제공항", countryKo: "미얀마" },
  VTE: { code: "VTE", cityKo: "비엔티안", airportKo: "왓따이국제공항", countryKo: "라오스" },
  CRK: { code: "CRK", cityKo: "클락", airportKo: "클락국제공항", countryKo: "필리핀" },
  USU: { code: "USU", cityKo: "보라카이", airportKo: "카티클란공항", countryKo: "필리핀" },
  PER: { code: "PER", cityKo: "퍼스", airportKo: "퍼스공항", countryKo: "호주" },
  BNE: { code: "BNE", cityKo: "브리즈번", airportKo: "브리즈번공항", countryKo: "호주" },
  OOL: { code: "OOL", cityKo: "골드코스트", airportKo: "쿨랑가타공항", countryKo: "호주" },
  CNS: { code: "CNS", cityKo: "케언스", airportKo: "케언스공항", countryKo: "호주" },
  CHC: { code: "CHC", cityKo: "크라이스트처치", airportKo: "크라이스트처치공항", countryKo: "뉴질랜드" },

  // 유럽 추가
  PRG: { code: "PRG", cityKo: "프라하", airportKo: "바츨라프하벨국제공항", countryKo: "체코" },
  BUD: { code: "BUD", cityKo: "부다페스트", airportKo: "리스트페렌츠국제공항", countryKo: "헝가리" },
  WAW: { code: "WAW", cityKo: "바르샤바", airportKo: "쇼팽국제공항", countryKo: "폴란드" },
  CPH: { code: "CPH", cityKo: "코펜하겐", airportKo: "코펜하겐국제공항", countryKo: "덴마크" },
  ARN: { code: "ARN", cityKo: "스톡홀름", airportKo: "알란다국제공항", countryKo: "스웨덴" },
  OSL: { code: "OSL", cityKo: "오슬로", airportKo: "오슬로국제공항", countryKo: "노르웨이" },
  HEL: { code: "HEL", cityKo: "헬싱키", airportKo: "헬싱키반타국제공항", countryKo: "핀란드" },
  DUB: { code: "DUB", cityKo: "더블린", airportKo: "더블린국제공항", countryKo: "아일랜드" },
  BRU: { code: "BRU", cityKo: "브뤼셀", airportKo: "브뤼셀국제공항", countryKo: "벨기에" },
  LIS: { code: "LIS", cityKo: "리스본", airportKo: "포르텔라국제공항", countryKo: "포르투갈" },
  ATH: { code: "ATH", cityKo: "아테네", airportKo: "엘레프테리오스국제공항", countryKo: "그리스" },
  VIE: { code: "VIE", cityKo: "빈", airportKo: "비엔나국제공항", countryKo: "오스트리아" },

  // 북미 추가
  IAD: { code: "IAD", cityKo: "워싱턴", airportKo: "덜레스국제공항", countryKo: "미국" },
  IAH: { code: "IAH", cityKo: "휴스턴", airportKo: "조지부시국제공항", countryKo: "미국" },
  LAS: { code: "LAS", cityKo: "라스베이거스", airportKo: "해리리드국제공항", countryKo: "미국" },
  MIA: { code: "MIA", cityKo: "마이애미", airportKo: "마이애미국제공항", countryKo: "미국" },
  DEN: { code: "DEN", cityKo: "덴버", airportKo: "덴버국제공항", countryKo: "미국" },
  PHX: { code: "PHX", cityKo: "피닉스", airportKo: "스카이하버국제공항", countryKo: "미국" }
};

export function getAirportInfo(code: string): AirportInfo | undefined {
  return AIRPORTS[code.trim().toUpperCase()];
}

export function formatAirportLabel(code: string): string {
  const normalized = code.trim().toUpperCase();
  const airport = getAirportInfo(normalized);
  return airport ? `${airport.code} (${airport.cityKo})` : `${normalized} (공항명 미등록)`;
}

export function formatAirportDetail(code: string): string {
  const normalized = code.trim().toUpperCase();
  const airport = getAirportInfo(normalized);
  return airport
    ? `${airport.code} (${airport.cityKo}) - ${airport.airportKo}, ${airport.countryKo}`
    : `${normalized} (공항명 미등록)`;
}
