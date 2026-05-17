# Search Cheapest Airplane

단일 도착지를 기준으로 여러 출국일·귀국일·숙박일수 조합을 훑어보고, 저렴한 직항 후보를 비교하는 도구입니다.

---

## 🚀 시작하기 — 편한 방식 선택

### A. Google Colab으로 바로 *(비개발자에게 추천)*

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/jjunsss/cheapest-flights/blob/main/notebooks/cheapest_flights_colab.ipynb)

> 설치가 낯선 사람에게 가장 설명하기 쉬운 방식입니다. 노트북 안에 한글 설명, 화면 이미지, 실행 버튼, 문제 해결 셀이 들어 있습니다.

1. 위 **`Open in Colab`** 버튼 클릭
2. 노트북이 열리면 위에서부터 코드 칸 왼쪽 **▶ 버튼** 클릭
3. `앱 서버 준비 완료`가 나오면 **앱 열기** 버튼 클릭
4. 앱 화면에서 출발지·도착지·날짜를 고르고 검색

### B. 브라우저 개발 환경에서 바로 *(GitHub 로그인 + 명령어 한 줄)*

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/jjunsss/cheapest-flights?quickstart=1)

> GitHub 계정만 있으면 됩니다. 없으면 위 버튼 누를 때 자동으로 가입 화면이 나옵니다 (이메일·비밀번호 입력만, 1분).

1. **위 초록 `Open in GitHub Codespaces` 버튼** 클릭
2. GitHub 로그인 (또는 가입)
3. 다음 화면에서 초록 **`Create codespace on main`** 버튼 한 번 클릭
4. **2분쯤 기다리기** — 자동으로 모든 게 깔립니다 (진행 메시지가 흘러갑니다)
5. 잠시 후 화면 아래쪽에 **시커먼 터미널 칸**이 보이면 → 거기에 `npm run dev` 입력하고 **Enter**
6. 우하단에 *"포트 5173이 사용 가능합니다"* 알림이 뜨면 → **`브라우저에서 열기`** 클릭

→ 새 탭에 앱이 열립니다.

**💡 다 쓰면 꼭 꺼주세요 (1초)**

탭만 닫으면 백그라운드에서 30분 동안 시간 차감이 계속 됩니다. 깔끔히 끄려면:

1. <https://github.com/codespaces> 접속
2. 방금 사용한 codespace 우측의 **`⋯`** (점 세 개) 클릭
3. **`Stop codespace`** 선택 → 즉시 중지

> ⚠️ **결제 수단 등록 안 된 무료 계정**은 한 달 60시간 한도를 넘으면 그냥 멈춥니다 (청구 X).
> 다만 **결제 수단을 등록해둔 계정**은 한도 초과 시 자동으로 과금될 수 있으니, 사용 후 반드시 `Stop`을 눌러주세요. 30분 idle 자동 중지를 믿지 말고 직접 끄는 습관이 안전합니다.

### C. 내 노트북에서 직접 *(Node.js 한 번 설치 + 스크립트 더블클릭)*

1. **Node.js 설치** *(처음 한 번만)* — <https://nodejs.org> 에서 LTS 다운로드 후 설치
2. **이 저장소 받기** — GitHub 페이지 초록 `Code` 버튼 → `Download ZIP` → 압축 풀기
3. **실행**:
   - **Windows** — `scripts` 폴더의 `start.bat` **더블클릭**
   - **macOS / Linux** — 터미널에서 `bash scripts/start.sh`

스크립트가 알아서 설치하고 브라우저까지 열어줍니다. 종료할 땐 `Ctrl + C`.

---

## 📖 사용법

### 1) 검색 입력

<img src="docs/screenshots/01-search.png" alt="검색 입력 화면" width="720">

- **출발지 / 도착지** — 인기 공항 카드 또는 검색창에 도시명·IATA 코드
- **검색 시작일 / 마지막일** — 이 범위 안에서 여러 출국·귀국 조합을 시도
- **최소 / 최대 숙박일수** — 찾으려는 여행 기간 범위

### 2) 검색 중

<img src="docs/screenshots/02-loading.png" alt="검색 폼 + 진행 박스" width="820">

검색 폼 바로 아래에 진행 화면이 뜨고 Trip.com / Kayak / Momondo에서 가격을 모읍니다. 결과가 나오는 즉시 같은 자리에 결과 표가 등장합니다. 검색이 완료될 때까지 계속 업데이트됩니다.

### 3) 결과 화면

<img src="docs/screenshots/03-results.png" alt="결과 표 + 필터" width="820">

- **가격 오름차순**으로 정렬
- 출발 날짜, 숙박일수, 항공사, 위탁 수하물 여부로 필터링
- 항공사가 자동 확인되지 않으면 `상세 확인 필요`로 표시

### 4) 행을 누르면 상세 정보

<img src="docs/screenshots/04-detail.png" alt="후보 상세 카드" width="820">

- 출국·귀국 시각, 비행시간, 항공사, 가격 원문, 예약 링크 정리
- 예약 화면으로 바로 이동 가능

### 5) 새 조건으로 다시 찾기

<img src="docs/screenshots/05-new-search.png" alt="새 검색 버튼" width="460">

결과 카드 우측 상단의 **`↑ 새 검색`** 버튼 → 모두 리셋

---

## ⚠️ 알아둘 점

- **개인 용도** 도구.
- 가격은 실제 예약 시 다를 수 있음. 참고용.
- 위탁 수하물, 좌석 선택, 결제 수수료는 예약 사이트에서 재점검 필요.
- 다른 사이트(현재 조사하는 것 이외)에서 더 쌀수도 있음.

---

<details>
<summary><strong>🛠 개발자용</strong></summary>

### 명령어

```sh
npm install              # 의존성
npx playwright install chromium
npm run dev              # 개발 서버 (front 5173 + back 3001)
npm run typecheck        # 타입 체크
npm test                 # 유닛 테스트
npm run build            # 프로덕션 빌드
```

### 환경 변수 (선택)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `FLIGHT_MAX_PAIRS` | 18 | 한 도착지당 최대 (출국·귀국) 조합 수. 출발일과 숙박일수를 함께 넓게 커버 |
| `FLIGHT_PARALLEL` | 3 | 동시 실행 워커 수 (↑ 빠름 / 차단 위험↑) |
| `FLIGHT_SETTLE_MS` | 900 | 첫 가격 카드 감지 후 추가로 기다리는 안정화 시간 |
| `FLIGHT_BLOCK_HEAVY_RESOURCES` | 1 | 폰트·미디어·추적 요청 차단. `0`이면 비활성화 |
| `FLIGHT_BLOCK_IMAGES` | 0 | 이미지까지 차단. 빠를 수 있지만 일부 사이트 결과 누락 위험 |
| `FX_RATES_JSON` | — | 환율 수동 지정 — 예: `'{"USD":1380,"EUR":1490}'` |

### 폴더 구조

```
src/
  client/          React 프론트 (Vite)
  server/          Fastify 백엔드
    sources/       Trip / Kayak / Momondo 자동 스크래퍼
    domain/        날짜·환율·검증 로직
  shared/          프론트·백엔드 공용 타입, 공항 데이터
scripts/           start.sh / start.bat (원클릭 실행)
.devcontainer/     GitHub Codespaces 자동 셋업
docs/screenshots/  README용 화면 캡처
```

### 스크래핑 흐름

1. `manager.processRun`이 `generateDatePairs`로 (출국·귀국) 조합 생성 후 출발일·숙박일수 다양성을 함께 보며 조합 선택 (cap = `FLIGHT_MAX_PAIRS`)
2. `FLIGHT_PARALLEL`개 worker가 각자 Playwright `BrowserContext`를 갖고 큐에서 task 소비
3. 각 task는 이미지·폰트·미디어·추적 요청을 차단하고, 가격 카드가 감지되면 고정 대기 없이 바로 파싱
4. `src/server/sources/{kayak,momondo,trip}.ts`의 scraper 호출 → `parseCardText`로 가격·항공사·시각 추출
5. `scrapedToCandidate` → `insertCandidate` → SSE event로 진행률 push
6. 메인 소스 0건이면 `AUTO_SOURCES`의 나머지로 **자동 폴백**
7. 클라이언트는 1.5초마다 `/api/runs/:id` 폴링 + SSE 보강

### 데이터 위치

- SQLite: `data/flights.sqlite` (전체 검색·결과 기록, `.gitignore`)
- 리포트: `reports/<run-id>/{summary.md, candidates.csv, candidates.json, coverage.json}`

</details>
