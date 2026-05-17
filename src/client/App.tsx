import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AIRPORTS, getAirportInfo } from '../shared/airports';
import { normalizeProviderForLink } from '../shared/providerLinks';
import type {
  FlightDefaultsResponse,
  FlightCandidate,
  FlightRunDetail,
  FlightRunEvent,
  FlightRunResponse,
  FlightSearchPayload,
} from '../shared/types';

type UiEvent = {
  id: number;
  message: string;
  timestamp: string;
  type: string;
};

type CandidateRawSummary = {
  source?: string;
  carrier?: string;
  carrierName?: string;
  outboundDepart?: string;
  outboundArrive?: string;
  inboundDepart?: string;
  inboundArrive?: string;
  returnDepart?: string;
  returnArrive?: string;
  durationOutbound?: string;
  durationInbound?: string;
  durationReturn?: string;
  priceRaw?: string;
  rawSnippet?: string;
  checkedBagIncluded?: boolean | null;
  carryOnIncluded?: boolean | null;
  baggageRaw?: string | null;
};

type ResultLimit = 30 | 60 | 100 | 'all';
type BaggageFilter = 'all' | 'included' | 'excluded' | 'unknown';

const fallbackDefaults = {
  origin: 'ICN',
  destination: 'FUK',
  startDate: toInputDate(addDays(new Date(), 1)),
  endDate: toInputDate(addMonths(new Date(), 6)),
  minNights: 2,
  maxNights: 21,
  providers: ['trip', 'kayak', 'momondo'],
};

const airportList = Object.values(AIRPORTS).sort((a, b) => a.cityKo.localeCompare(b.cityKo, 'ko'));
const popularDestinations = ['FUK', 'TPE', 'NRT', 'KIX', 'BKK', 'DAD', 'CEB', 'HKG'];
const popularOrigins = ['ICN', 'GMP', 'PUS', 'CJU'];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { error?: string };
      throw new Error(parsed.error || text || `${response.status} ${response.statusText}`);
    } catch {
      throw new Error(text || `${response.status} ${response.statusText}`);
    }
  }
  return response.json() as Promise<T>;
}

export default function App() {
  const [origin, setOrigin] = useState(fallbackDefaults.origin);
  const [destination, setDestination] = useState(fallbackDefaults.destination);
  const [startDate, setStartDate] = useState(fallbackDefaults.startDate);
  const [endDate, setEndDate] = useState(fallbackDefaults.endDate);
  const [minNights, setMinNights] = useState(fallbackDefaults.minNights);
  const [maxNights, setMaxNights] = useState(fallbackDefaults.maxNights);
  const [providers, setProviders] = useState<string[]>(fallbackDefaults.providers);
  const [run, setRun] = useState<FlightRunDetail | null>(null);
  const [events, setEvents] = useState<UiEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [showSearchWhileProcessing, setShowSearchWhileProcessing] = useState(false);
  const [revealedResultsRunId, setRevealedResultsRunId] = useState<string | null>(null);
  const [cachedCandidates, setCachedCandidates] = useState<FlightCandidate[]>([]);
  const eventCounter = useRef(0);
  const lastRunSnapshotRef = useRef<string>('');

  const originInfo = getAirportInfo(origin);
  const destinationInfo = getAirportInfo(destination);
  const progressPercent = run?.progress?.percent ?? inferPercent(run?.progress?.completed, run?.progress?.total);
  const rawPreviewCandidates = run?.candidatesPreview ?? [];
  const hasRevealedResults = Boolean(run?.id && revealedResultsRunId === run.id);
  const isProcessingRun = run?.status === 'queued' || run?.status === 'running' || run?.status === 'paused';
  const canShowInterimResults = shouldShowInterimResults(run, rawPreviewCandidates, progressPercent);
  const resultsAreRevealed = hasRevealedResults || canShowInterimResults;
  const previewCandidates =
    rawPreviewCandidates.length > 0 ? rawPreviewCandidates : resultsAreRevealed ? cachedCandidates : rawPreviewCandidates;
  // Side-panel layout was removed in favor of an inline flight animation
  // directly below the search form. We keep this name `false`-only so the
  // existing layout class hooks stay neutral.
  const showProcessPanel = false;
  const showFlightLoading = Boolean(run && isProcessingRun && !resultsAreRevealed);
  const showResultsPanel = previewCandidates.length > 0 && (!isProcessingRun || resultsAreRevealed);
  const showEmptyResultsNotice = Boolean(
    run && run.status === 'completed' && previewCandidates.length === 0,
  );
  const showLiveResultsLayout = isProcessingRun && resultsAreRevealed && !showSearchWhileProcessing;
  const showProcessOnly = false; // search form stays visible; flight-loading-inline sits below it

  const [sortKey, setSortKey] = useState<'price' | 'stayDays' | 'departDate' | 'returnDate'>('price');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [departDateFilter, setDepartDateFilter] = useState<string | null>(null);
  const [stayFilters, setStayFilters] = useState<number[]>([]);
  const [carrierFilters, setCarrierFilters] = useState<string[]>([]);
  const [baggageFilter, setBaggageFilter] = useState<BaggageFilter>('all');
  const [resultLimit, setResultLimit] = useState<ResultLimit>(30);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const availableDepartDates = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        count: number;
        minPrice: number;
        minPriceLabel: string;
        cheapestStayDays: number;
      }
    >();
    for (const candidate of previewCandidates) {
      const price = comparablePrice(candidate);
      const current = map.get(candidate.departDate);
      if (!current) {
        map.set(candidate.departDate, {
          date: candidate.departDate,
          count: 1,
          minPrice: price,
          minPriceLabel: formatCandidatePrice(candidate),
          cheapestStayDays: candidate.stayDays,
        });
        continue;
      }
      current.count += 1;
      if (price < current.minPrice) {
        current.minPrice = price;
        current.minPriceLabel = formatCandidatePrice(candidate);
        current.cheapestStayDays = candidate.stayDays;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [previewCandidates]);

  const suggestedDepartDates = useMemo(
    () =>
      [...availableDepartDates]
        .sort((a, b) => a.minPrice - b.minPrice || a.date.localeCompare(b.date))
        .slice(0, 8),
    [availableDepartDates],
  );

  const availableStays = useMemo(() => {
    const set = new Set<number>();
    for (const c of previewCandidates) set.add(c.stayDays);
    return Array.from(set).sort((a, b) => a - b);
  }, [previewCandidates]);

  const availableCarriers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of previewCandidates) {
      const carrier = getCarrierName(c);
      counts.set(carrier, (counts.get(carrier) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);
  }, [previewCandidates]);

  const baggageCounts = useMemo(() => {
    const counts: Record<Exclude<BaggageFilter, 'all'>, number> = {
      included: 0,
      excluded: 0,
      unknown: 0,
    };
    for (const candidate of previewCandidates) {
      counts[checkedBagStatus(candidate)] += 1;
    }
    return counts;
  }, [previewCandidates]);

  const visibleCandidates = useMemo(() => {
    let rows = previewCandidates.filter((c) => (stayFilters.length === 0 ? true : stayFilters.includes(c.stayDays)));
    if (departDateFilter) {
      rows = rows.filter((c) => c.departDate === departDateFilter);
    }
    if (carrierFilters.length > 0) {
      rows = rows.filter((c) => {
        return carrierFilters.includes(getCarrierName(c));
      });
    }
    if (baggageFilter !== 'all') {
      rows = rows.filter((candidate) => checkedBagStatus(candidate) === baggageFilter);
    }
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'price':
          cmp = comparablePrice(a) - comparablePrice(b);
          break;
        case 'stayDays':
          cmp = a.stayDays - b.stayDays;
          break;
        case 'departDate':
          cmp = a.departDate.localeCompare(b.departDate);
          break;
        case 'returnDate':
          cmp = a.returnDate.localeCompare(b.returnDate);
          break;
      }
      const directed = sortDir === 'asc' ? cmp : -cmp;
      if (directed !== 0) return directed;
      const combinationDelta = combinationStatus(b).priority - combinationStatus(a).priority;
      if (combinationDelta !== 0) return combinationDelta;
      return comparablePrice(a) - comparablePrice(b) || a.id.localeCompare(b.id);
    });
    return sorted;
  }, [previewCandidates, sortKey, sortDir, departDateFilter, stayFilters, carrierFilters, baggageFilter]);

  useEffect(() => {
    setStayFilters((current) => {
      const next = current.filter((stay) => availableStays.includes(stay));
      // Return the same reference when nothing changed to avoid a re-render loop
      // (this updater fires on every polling tick because availableStays is a new array).
      return next.length === current.length ? current : next;
    });
  }, [availableStays]);

  useEffect(() => {
    setCarrierFilters((current) => {
      const next = current.filter((carrier) => availableCarriers.includes(carrier));
      return next.length === current.length ? current : next;
    });
  }, [availableCarriers]);

  const cheapestVisibleCandidate = useMemo(
    () => [...visibleCandidates].sort((a, b) => comparablePrice(a) - comparablePrice(b))[0] ?? null,
    [visibleCandidates],
  );
  const displayedCandidates = useMemo(
    () => (resultLimit === 'all' ? visibleCandidates : visibleCandidates.slice(0, resultLimit)),
    [resultLimit, visibleCandidates],
  );
  const selectedCandidate = selectedCandidateId
    ? (displayedCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null)
    : null;

  useEffect(() => {
    if (!run?.id) {
      setRevealedResultsRunId(null);
      setCachedCandidates([]);
      return;
    }
    setRevealedResultsRunId((current) => (current && current !== run.id ? null : current));
    setCachedCandidates((current) => (current[0]?.runId && current[0].runId !== run.id ? [] : current));
  }, [run?.id]);

  useEffect(() => {
    if (!run?.id) return;
    const candidates = run.candidatesPreview ?? [];
    if (candidates.length > 0) {
      setCachedCandidates(candidates);
    }
    if (shouldShowInterimResults(run, candidates, progressPercent)) {
      setRevealedResultsRunId((current) => (current === run.id ? current : run.id));
    }
  }, [run, progressPercent]);

  useEffect(() => {
    if (departDateFilter && !availableDepartDates.some((option) => option.date === departDateFilter)) {
      setDepartDateFilter(null);
    }
  }, [availableDepartDates, departDateFilter]);

  useEffect(() => {
    if (selectedCandidateId && !displayedCandidates.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(null);
    }
  }, [displayedCandidates, selectedCandidateId]);

  function toggleSort(key: 'price' | 'stayDays' | 'departDate' | 'returnDate') {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'price' ? 'asc' : 'asc');
    }
  }

  function sortIndicator(key: 'price' | 'stayDays' | 'departDate' | 'returnDate') {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  function selectDepartDate(date: string | null) {
    setDepartDateFilter(date);
    setSortKey('price');
    setSortDir('asc');
  }

  function toggleStayFilter(nights: number) {
    setStayFilters((current) =>
      current.includes(nights) ? current.filter((value) => value !== nights) : [...current, nights].sort((a, b) => a - b),
    );
  }

  function toggleCarrierFilter(carrier: string) {
    setCarrierFilters((current) =>
      current.includes(carrier) ? current.filter((value) => value !== carrier) : [...current, carrier],
    );
  }

  useEffect(() => {
    let canceled = false;
    fetch('/api/defaults')
      .then((response) => readJson<FlightDefaultsResponse>(response))
      .then((defaults) => {
        if (canceled) return;
        setOrigin(defaults.origin ?? fallbackDefaults.origin);
        setDestination(defaults.destinations?.[0] ?? fallbackDefaults.destination);
        setStartDate(defaults.dateRange?.start ?? fallbackDefaults.startDate);
        setEndDate(defaults.dateRange?.end ?? fallbackDefaults.endDate);
        setMinNights(defaults.stay?.minNights ?? fallbackDefaults.minNights);
        setMaxNights(defaults.stay?.maxNights ?? fallbackDefaults.maxNights);
        setProviders(defaults.providers?.length ? defaults.providers : fallbackDefaults.providers);
      })
      .catch(() => {
        addEvent('기본값 API를 사용할 수 없어 기본 조건으로 시작합니다.', 'notice');
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const sharedRunId = new URLSearchParams(window.location.search).get('run');
    if (!sharedRunId) return;
    refreshRun(sharedRunId);
  }, []);

  useEffect(() => {
    if (!run?.id || run.status === 'completed' || run.status === 'failed' || run.status === 'paused') return;

    const source = new EventSource(`/api/runs/${run.id}/events`);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as FlightRunEvent;
        applyRunEvent(event);
      } catch {
        addEvent(message.data || '진행 상황을 수신했습니다.', 'message');
      }
    };
    source.onerror = () => {
      addEvent('진행 스트림 연결이 끊겨 상태를 다시 확인합니다.', 'warning');
      source.close();
      refreshRun(run.id);
    };

    // Aggressive polling so the candidates table updates in near real-time
    // even when SSE events are dropped or buffered by the browser.
    const id = run.id;
    const interval = window.setInterval(() => refreshRun(id), 1500);

    return () => {
      source.close();
      window.clearInterval(interval);
    };
  }, [run?.id, run?.status]);

  function addEvent(message: string, type = 'message') {
    if (message.trim().toLowerCase() === 'connected') return;
    if (isInternalStatusMessage(message)) return;
    const timestamp = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setEvents((current) => [
      { id: ++eventCounter.current, message, timestamp, type },
      ...current,
    ].slice(0, 30));
  }

  function buildPayload(): FlightSearchPayload {
    return {
      origin: origin.trim().toUpperCase(),
      destinations: [destination.trim().toUpperCase()],
      dateRange: { start: startDate, end: endDate },
      stay: { minNights, maxNights },
      providers: providers.length ? providers : fallbackDefaults.providers,
      currency: 'KRW',
    };
  }

  function validatePayload() {
    if (!originInfo) return '출발지를 검색해서 선택해 주세요.';
    if (!destinationInfo) return '도착지를 검색해서 하나 선택해 주세요.';
    if (origin === destination) return '출발지와 도착지는 달라야 합니다.';
    if (!startDate || !endDate || new Date(endDate) < new Date(startDate)) return '검색 기간을 확인해 주세요.';
    if (minNights < 1 || maxNights < minNights) return '숙박일수 범위를 확인해 주세요.';
    return '';
  }

  async function startRun(event: FormEvent) {
    event.preventDefault();
    const validation = validatePayload();
    setError(validation);
    if (validation) return;

    setIsRunning(true);
    setEvents([]);
    setShowSearchWhileProcessing(false);
    setRevealedResultsRunId(null);
    setCachedCandidates([]);
    try {
      const nextRun = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      }).then((response) => readJson<FlightRunResponse>(response));

      setRun({
        id: nextRun.id,
        status: nextRun.status ?? 'queued',
        progress: { completed: 0, total: 0, percent: 0 },
        message: '검색이 서버에 등록되었습니다. 곧 결과를 확인합니다.',
      });
      const url = new URL(window.location.href);
      url.searchParams.set('run', nextRun.id);
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      addEvent('검색을 시작했습니다.', 'run');
      window.setTimeout(() => refreshRun(nextRun.id), 700);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '검색 실행을 시작하지 못했습니다.');
    } finally {
      setIsRunning(false);
    }
  }

  async function refreshRun(id: string) {
    try {
      const detail = await fetch(`/api/runs/${id}`).then((response) => readJson<FlightRunDetail>(response));
      const snap = runSnapshot(detail);
      if (snap === lastRunSnapshotRef.current) {
        return; // no-op: nothing changed since last refresh, skip setRun to avoid re-render storm
      }
      lastRunSnapshotRef.current = snap;
      rememberResultReveal(detail);
      setRun(detail);
      if (detail.message) {
        addEvent(detail.message, detail.status);
      }
    } catch {
      addEvent('실행 상태를 가져오지 못했습니다.', 'warning');
    }
  }

  function startNewSearch() {
    setRun(null);
    setEvents([]);
    setRevealedResultsRunId(null);
    setCachedCandidates([]);
    setSelectedCandidateId(null);
    setStayFilters([]);
    setCarrierFilters([]);
    setBaggageFilter('all');
    setDepartDateFilter(null);
    setError('');
    lastRunSnapshotRef.current = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function controlRun(action: 'pause' | 'resume') {
    if (!run?.id) return;
    try {
      const detail = await fetch(`/api/runs/${run.id}/${action}`, { method: 'POST' }).then((response) =>
        readJson<FlightRunDetail>(response),
      );
      rememberResultReveal(detail);
      setRun(detail);
      addEvent(action === 'pause' ? '검색을 잠시 멈췄습니다.' : '검색을 다시 시작했습니다.', action);
      window.setTimeout(() => refreshRun(detail.id), 700);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '실행 제어 요청에 실패했습니다.');
    }
  }

  function applyRunEvent(event: FlightRunEvent) {
    if (event.type === 'heartbeat') return;
    let capturedId = '';
    setRun((current) => {
      if (!current) return current;
      capturedId = current.id;
      return {
        ...current,
        status: event.status ?? current.status,
        progress: event.progress ?? current.progress,
        message: event.message ?? current.message,
      };
    });
    addEvent(event.message ?? statusCopy(event.status) ?? '진행 상황을 업데이트했습니다.', event.type ?? event.status ?? 'event');

    // Fetch full detail (with candidatesPreview) whenever progress or completion lands.
    if (
      capturedId &&
      (event.type === 'progress' ||
        event.type === 'report' ||
        event.status === 'completed' ||
        event.status === 'paused')
    ) {
      window.setTimeout(() => refreshRun(capturedId), 200);
    }
  }

  function rememberResultReveal(detail: FlightRunDetail) {
    const candidates = detail.candidatesPreview ?? [];
    if (candidates.length > 0) {
      setCachedCandidates(candidates);
    }
    const detailPercent = detail.progress?.percent ?? inferPercent(detail.progress?.completed, detail.progress?.total);
    if (shouldShowInterimResults(detail, candidates, detailPercent)) {
      setRevealedResultsRunId((current) => (current === detail.id ? current : detail.id));
    }
  }

  return (
    <main className={`app-shell${showLiveResultsLayout ? ' live-results-shell' : ''}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Direct fare search</p>
          <h1>단일 도착지 최저가 직항 찾기</h1>
        </div>
        <div className="topbar-route" aria-label="현재 선택 경로">
          <span>{originInfo?.cityKo ?? origin}</span>
          <span className={`topbar-plane${run?.status === 'running' || run?.status === 'queued' ? ' is-active' : ''}`} aria-hidden="true">
            <PlaneIcon className="topbar-plane-icon" />
          </span>
          <span>{destinationInfo?.cityKo ?? destination}</span>
        </div>
      </header>

      {!showLiveResultsLayout && (
      <section className={`search-surface${showProcessPanel ? ' has-process' : ''}${showProcessOnly ? ' process-only' : ''}`}>
        {!showProcessOnly && !showLiveResultsLayout && (
          <form className="search-card compact-search" onSubmit={startRun}>
            <div className="route-grid">
              <AirportPicker
                label="출발지"
                variant="origin"
                value={origin}
                onSelect={setOrigin}
                popularCodes={popularOrigins}
              />
              <AirportPicker
                label="도착지"
                variant="destination"
                value={destination}
                onSelect={setDestination}
                popularCodes={popularDestinations}
                autoFocus
              />
            </div>

            <div className="date-grid">
              <label>
                검색 시작일
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label>
                검색 마지막일
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <label>
                최소 숙박일수
                <input
                  type="number"
                  min={1}
                  value={minNights}
                  onChange={(event) => setMinNights(Number(event.target.value))}
                />
              </label>
              <label>
                최대 숙박일수
                <input
                  type="number"
                  min={minNights}
                  value={maxNights}
                  onChange={(event) => setMaxNights(Number(event.target.value))}
                />
              </label>
            </div>

            {error && <p className="error-message">{error}</p>}

            <div className="action-row">
              <button className={`primary ${isRunning ? 'busy' : ''}`} type="submit" disabled={isRunning}>
                {isRunning && <span className="btn-spinner" aria-hidden="true" />}
                {isRunning ? '검색 시작 중' : '최저가 찾기'}
              </button>
            </div>
          </form>
        )}

      </section>
      )}

      {showFlightLoading && run && (
        <section className="panel flight-loading-inline" aria-live="polite">
          <div className="flight-loading-head">
            <p className="eyebrow">검색 중</p>
            <h2>
              {originInfo?.cityKo ?? origin} → {destinationInfo?.cityKo ?? destination}
              <span className="live-dot" aria-hidden="true" />
            </h2>
            <p className="flight-loading-note">
              {previewCandidates.length > 0
                ? `${previewCandidates.length}개 후보를 임시 보관 중입니다. 조금 더 모이면 결과를 표시합니다.`
                : '직항 후보를 모으고 있어요. 결과가 나오는 대로 바로 여기에 표시됩니다.'}
            </p>
          </div>
          <FlightMotion
            originLabel={originInfo?.cityKo ?? origin}
            destinationLabel={destinationInfo?.cityKo ?? destination}
            status={run.status}
            progressPercent={progressPercent}
            providers={providers}
          />
          <div
            className={`progress-track ${run.status === 'running' || run.status === 'queued' ? 'indeterminate' : ''}`}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </section>
      )}

      {showEmptyResultsNotice && (
        <section className="panel empty-results">
          <p className="eyebrow">검색 결과</p>
          <h2>가져온 항공편이 없습니다</h2>
          <p>
            모든 검색 소스가 0건을 반환했습니다. 사이트가 일시적으로 차단했거나, 이 날짜·노선에 직항이
            없을 수 있습니다. 잠시 후 <strong>↑ 새 검색</strong>으로 날짜 범위를 좁히거나 도착지를 바꿔
            다시 시도해 보세요.
          </p>
          <button type="button" className="ghost new-search-button" onClick={startNewSearch}>
            ↑ 새 검색
          </button>
        </section>
      )}

      {showResultsPanel && (
        <section
          className={`panel results-panel${
            run?.status === 'running' || run?.status === 'queued' ? ' is-active' : ''
          }`}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">검색 결과</p>
              <h2>
                가장 싼 직항 후보 <small className="result-meta">{visibleCandidates.length}건</small>
              </h2>
              <p className="section-note">
                가격 우선으로 정렬하되 같은 가격이면 왕복 확인 후보를 먼저 봅니다. 검색 완료 전까지 중간 결과는 계속 갱신됩니다.
              </p>
            </div>
            <div className="results-header-actions">
              {isProcessingRun && resultsAreRevealed && (
                <div className="live-loading-badge" aria-live="polite">
                  <span>
                    <i aria-hidden="true" />
                    계속 로딩중
                  </span>
                  <small>{liveResultProgressCopy(run)} · 후보 {previewCandidates.length}건</small>
                  <div className="mini-progress" aria-hidden="true">
                    <b style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              )}
              <button type="button" className="ghost new-search-button" onClick={startNewSearch}>
                ↑ 새 검색
              </button>
            </div>
          </div>

          {(availableDepartDates.length > 1 ||
            availableStays.length > 1 ||
            availableCarriers.length > 1 ||
            previewCandidates.length > 0) && (
            <div className="result-filters">
              {availableDepartDates.length > 1 && (
                <div className="date-filter-card">
                  <label className="date-select-control">
                    <span>출발 날짜 선택</span>
                    <select
                      value={departDateFilter ?? ''}
                      onChange={(event) => selectDepartDate(event.target.value || null)}
                    >
                      <option value="">전체 출발일</option>
                      {availableDepartDates.map((option) => (
                        <option key={option.date} value={option.date}>
                          {formatReadableDate(option.date)} · {option.count}건 · 최저 {option.minPriceLabel}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="departure-suggestions" aria-label="저렴한 출발일 추천">
                    <span className="filter-label">저렴한 출국일</span>
                    <button
                      type="button"
                      className={`date-choice${departDateFilter == null ? ' is-active' : ''}`}
                      onClick={() => selectDepartDate(null)}
                    >
                      <strong>전체</strong>
                      <small>모든 날짜</small>
                    </button>
                    {suggestedDepartDates.map((option) => (
                      <button
                        key={option.date}
                        type="button"
                        className={`date-choice${departDateFilter === option.date ? ' is-active' : ''}`}
                        onClick={() => selectDepartDate(option.date)}
                      >
                        <strong>{formatShortDate(option.date)}</strong>
                        <small>{option.minPriceLabel}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {availableStays.length > 1 && (
                <div className="filter-group" aria-label="숙박일수 필터">
                  <span className="filter-label">숙박일수</span>
                  <button
                    type="button"
                    className={`filter-chip${stayFilters.length === 0 ? ' is-active' : ''}`}
                    aria-pressed={stayFilters.length === 0}
                    onClick={() => setStayFilters([])}
                  >
                    전체
                  </button>
                  {availableStays.map((nights) => (
                    <button
                      key={nights}
                      type="button"
                      className={`filter-chip${stayFilters.includes(nights) ? ' is-active' : ''}`}
                      aria-pressed={stayFilters.includes(nights)}
                      onClick={() => toggleStayFilter(nights)}
                    >
                      {nights}박
                    </button>
                  ))}
                </div>
              )}
              {availableCarriers.length > 1 && (
                <div className="filter-group" aria-label="항공사 필터">
                  <span className="filter-label">항공사</span>
                  <button
                    type="button"
                    className={`filter-chip${carrierFilters.length === 0 ? ' is-active' : ''}`}
                    aria-pressed={carrierFilters.length === 0}
                    onClick={() => setCarrierFilters([])}
                  >
                    전체
                  </button>
                  {availableCarriers.map((carrier) => (
                    <button
                      key={carrier}
                      type="button"
                      className={`filter-chip${carrierFilters.includes(carrier) ? ' is-active' : ''}`}
                      aria-pressed={carrierFilters.includes(carrier)}
                      onClick={() => toggleCarrierFilter(carrier)}
                    >
                      {carrier}
                    </button>
                  ))}
                </div>
              )}
              <div className="filter-group" aria-label="위탁 수하물 필터">
                <span className="filter-label">수하물</span>
                <button
                  type="button"
                  className={`filter-chip${baggageFilter === 'all' ? ' is-active' : ''}`}
                  aria-pressed={baggageFilter === 'all'}
                  onClick={() => setBaggageFilter('all')}
                >
                  전체
                </button>
                <button
                  type="button"
                  className={`filter-chip${baggageFilter === 'included' ? ' is-active' : ''}`}
                  aria-pressed={baggageFilter === 'included'}
                  onClick={() => setBaggageFilter('included')}
                  title={
                    baggageCounts.included > 0
                      ? `위탁 수하물 포함으로 읽힌 후보 ${baggageCounts.included}건`
                      : '위탁 수하물 포함으로 읽힌 후보가 아직 없습니다'
                  }
                >
                  위탁 포함
                </button>
                <button
                  type="button"
                  className={`filter-chip${baggageFilter === 'excluded' ? ' is-active' : ''}`}
                  aria-pressed={baggageFilter === 'excluded'}
                  onClick={() => setBaggageFilter('excluded')}
                  title={
                    baggageCounts.excluded > 0
                      ? `위탁 수하물 미포함으로 읽힌 후보 ${baggageCounts.excluded}건`
                      : '위탁 수하물 미포함으로 읽힌 후보가 아직 없습니다'
                  }
                >
                  위탁 미포함
                </button>
                <button
                  type="button"
                  className={`filter-chip${baggageFilter === 'unknown' ? ' is-active' : ''}`}
                  aria-pressed={baggageFilter === 'unknown'}
                  onClick={() => setBaggageFilter('unknown')}
                  title={
                    baggageCounts.unknown > 0
                      ? `수하물 포함 여부가 미확인인 후보 ${baggageCounts.unknown}건`
                      : '수하물 포함 여부가 미확인인 후보가 아직 없습니다'
                  }
                >
                  미확인
                </button>
              </div>
            </div>
          )}

          {previewCandidates.length > 30 && (
            <div className="list-options">
              <label className="list-limit-control">
                <span>표시 개수</span>
                <select
                  value={String(resultLimit)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setResultLimit(value === 'all' ? 'all' : (Number(value) as ResultLimit));
                  }}
                >
                  <option value="30">30개</option>
                  <option value="60">60개</option>
                  <option value="100">100개</option>
                  <option value="all">전체</option>
                </select>
              </label>
            </div>
          )}

          {selectedCandidate ? (
            <CandidateDetail
              candidate={selectedCandidate}
              baselinePrice={cheapestVisibleCandidate ? comparablePrice(cheapestVisibleCandidate) : null}
              onClose={() => setSelectedCandidateId(null)}
            />
          ) : (
            <div className="candidate-detail-hint">
              <strong>상세 정보 확인을 위해 항공권 행을 클릭하세요.</strong>
            </div>
          )}

          <div className="results-table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>경로</th>
                  <th>
                    <button type="button" className="th-sort" onClick={() => toggleSort('departDate')}>
                      출국{sortIndicator('departDate')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-sort" onClick={() => toggleSort('returnDate')}>
                      귀국{sortIndicator('returnDate')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-sort" onClick={() => toggleSort('stayDays')}>
                      기간{sortIndicator('stayDays')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-sort" onClick={() => toggleSort('price')}>
                      가격{sortIndicator('price')}
                    </button>
                  </th>
                  <th>항공사</th>
                  <th>조합</th>
                  <th>확인</th>
                </tr>
              </thead>
              <tbody>
                {displayedCandidates.map((candidate, index) => {
                  const carrierName = getCarrierName(candidate);
                  const raw = getCandidateRaw(candidate);
                  const outboundTime = formatLegTime(raw, 'outbound');
                  const returnTime = formatLegTime(raw, 'return');
                  const combo = combinationStatus(candidate);
                  return (
                    <tr
                      key={candidate.id}
                      className={`candidate-row${selectedCandidateId === candidate.id ? ' is-selected' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${carrierName || providerLabel(candidate.provider)} ${formatCandidatePrice(
                        candidate,
                      )} 상세 확인`}
                      onClick={() => setSelectedCandidateId(candidate.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedCandidateId(candidate.id);
                        }
                      }}
                    >
                      <td className="rank" data-label="#">
                        {index + 1}
                      </td>
                      <td data-label="경로">
                        <span className="route-cell">
                          <strong>{candidate.origin}</strong>
                          <small>{getAirportInfo(candidate.origin)?.cityKo ?? candidate.origin}</small>
                          <span aria-hidden="true">→</span>
                          <strong>{candidate.destination}</strong>
                          <small>{getAirportInfo(candidate.destination)?.cityKo ?? candidate.destination}</small>
                        </span>
                      </td>
                      <td className="num dates-cell" data-label="출국">
                        {candidate.departDate}
                        <small className="weekday">({weekdayKo(candidate.departDate)})</small>
                        {outboundTime && <small className="cell-subtle">{outboundTime}</small>}
                      </td>
                      <td className="num dates-cell" data-label="귀국">
                        {candidate.returnDate}
                        <small className="weekday">({weekdayKo(candidate.returnDate)})</small>
                        {returnTime && <small className="cell-subtle">{returnTime}</small>}
                      </td>
                      <td className="num" data-label="기간">
                        {candidate.stayDays}박
                      </td>
                      <td className="num price" data-label="가격">
                        <strong>{formatCandidatePrice(candidate)}</strong>
                        {raw.priceRaw && <small className="cell-subtle">원문 {raw.priceRaw}</small>}
                      </td>
                      <td data-label="항공사">{carrierName}</td>
                      <td data-label="조합">
                        <span className={`combo-badge ${combo.tone}`}>{combo.label}</span>
                      </td>
                      <td data-label="확인">
                        <span className="detail-link">상세 확인</span>
                      </td>
                    </tr>
                  );
                })}
                {visibleCandidates.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-faint" style={{ textAlign: 'center', padding: '24px' }}>
                      필터 조건에 맞는 결과가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

function FlightMotion({
  originLabel,
  destinationLabel,
  status,
  progressPercent,
  providers,
}: {
  originLabel: string;
  destinationLabel: string;
  status?: string;
  progressPercent: number;
  providers: string[];
}) {
  const isActive = status === 'running' || status === 'queued';
  const statusLabel =
    status === 'queued'
      ? '대기'
      : status === 'paused'
        ? '확인 대기'
        : status === 'completed'
          ? '완료'
          : status === 'failed'
            ? '중단'
            : '수집';
  const visibleProviders = (providers.length ? providers : fallbackDefaults.providers).slice(0, 4);

  return (
    <div className={`flight-motion ${status ?? 'idle'}${isActive ? ' is-active' : ''}`} aria-label="항공권 데이터 수집 상태">
      <div className="flight-route-visual" aria-hidden="true">
        <span className="sky-streak streak-one" />
        <span className="sky-streak streak-two" />
        <span className="sky-streak streak-three" />
        <svg className="route-path" viewBox="0 0 320 140" preserveAspectRatio="none">
          <path className="route-path-base" d="M18 116 C92 12 228 12 302 116" />
          <path className="route-path-pulse" d="M18 116 C92 12 228 12 302 116" />
        </svg>
        <span className="route-dot origin-dot" />
        <span className="route-dot destination-dot" />
        <span className="data-packet packet-one" />
        <span className="data-packet packet-two" />
        <span className="data-packet packet-three" />
        <span className="plane-wrap">
          <PlaneIcon className="flight-plane-icon" />
        </span>
      </div>

      <div className="flight-motion-meta">
        <div className="flight-motion-airport">
          <span>FROM</span>
          <strong>{originLabel}</strong>
        </div>
        <strong className="flight-motion-state">{statusLabel}</strong>
        <div className="flight-motion-airport">
          <span>TO</span>
          <strong>{destinationLabel}</strong>
        </div>
      </div>

      <div className="flight-data-strip" aria-label="조회 채널">
        {visibleProviders.map((provider, index) => (
          <span className="flight-source" style={{ animationDelay: `${index * 140}ms` }} key={provider}>
            <i aria-hidden="true" />
            {providerLabel(provider)}
          </span>
        ))}
      </div>

      <div className="flight-meter" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}

function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" focusable="false" aria-hidden="true">
      <path
        d="M59.7 29.4c2.1 1.1 2.1 4.1 0 5.2L8.1 60.3c-2.4 1.2-4.8-1.3-3.6-3.6l8.5-17.3-9.2-5c-2.2-1.2-2.2-4.5 0-5.7l9.2-5L4.5 7.3C3.3 4.9 5.7 2.5 8.1 3.7l51.6 25.7Z"
        fill="currentColor"
      />
      <path d="M14.1 36.7 40.9 32 14.1 27.3" fill="none" stroke="rgba(255,255,255,0.78)" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

function CandidateDetail({
  candidate,
  baselinePrice,
  onClose,
}: {
  candidate: FlightCandidate;
  baselinePrice: number | null;
  onClose: () => void;
}) {
  const raw = getCandidateRaw(candidate);
  const carrierName = getCarrierName(candidate) || providerLabel(candidate.provider);
  const confidence = priceConfidence(candidate);
  const outboundTime = formatLegTime(raw, 'outbound');
  const returnTime = formatLegTime(raw, 'return');
  const combo = combinationStatus(candidate);
  const notes = candidateNotes(candidate, baselinePrice);

  return (
    <aside className="candidate-detail" aria-label="항공권 상세 정보">
      <div className="candidate-detail-header">
        <div>
          <p className="eyebrow">가격 확인</p>
          <h3>
            {candidate.origin} → {candidate.destination}
          </h3>
          <span>
            {carrierName} · {providerLabel(candidate.provider)}
          </span>
        </div>
        <button type="button" className="candidate-detail-close" onClick={onClose}>
          닫기
        </button>
      </div>

      <div className={`price-confidence ${confidence.tone}`}>
        <span>{confidence.label}</span>
        <strong>{formatCandidatePrice(candidate)}</strong>
        <small>{confidence.description}</small>
      </div>

      <dl className="detail-facts">
        <div>
          <dt>가격 차이</dt>
          <dd>{formatPriceDelta(candidate, baselinePrice)}</dd>
        </div>
        <div>
          <dt>원문 표시가</dt>
          <dd>{raw.priceRaw ?? `${candidate.priceTotal.toLocaleString()} ${candidate.priceCurrency}`}</dd>
        </div>
        <div>
          <dt>가격 기준</dt>
          <dd>{candidate.pricePerAdult ? '성인 1인 왕복' : '총액 여부 확인 필요'}</dd>
        </div>
        <div>
          <dt>조합 상태</dt>
          <dd>{combo.label}</dd>
        </div>
        <div>
          <dt>포함 항목</dt>
          <dd>{priceIncludesText(candidate)}</dd>
        </div>
        <div>
          <dt>직항 검증</dt>
          <dd>{directVerificationText(candidate)}</dd>
        </div>
        <div>
          <dt>캡처 시각</dt>
          <dd>{captureAgeText(candidate.capturedAt)}</dd>
        </div>
      </dl>

      <div className="detail-itinerary">
        <div>
          <span>출국</span>
          <strong>{formatReadableDate(candidate.departDate)}</strong>
          <small>{outboundTime || '시간 정보 미확인'}</small>
        </div>
        <div>
          <span>귀국</span>
          <strong>{formatReadableDate(candidate.returnDate)}</strong>
          <small>{returnTime || '시간 정보 미확인'}</small>
        </div>
      </div>

      <div className="detail-notes">
        <strong>특이사항</strong>
        <ul>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      {candidate.bookingUrl && (
        <a className="detail-book-link" href={candidate.bookingUrl} target="_blank" rel="noreferrer">
          예약/결제 화면으로 이동
        </a>
      )}
    </aside>
  );
}

function AirportPicker({
  label,
  variant,
  value,
  onSelect,
  popularCodes,
  autoFocus,
}: {
  label: string;
  variant: 'origin' | 'destination';
  value: string;
  onSelect: (code: string) => void;
  popularCodes: string[];
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const selected = getAirportInfo(value);
  const options = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const base = normalizedQuery
      ? airportList.filter((airport) => {
          const haystack = `${airport.code} ${airport.cityKo} ${airport.airportKo} ${airport.countryKo}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : popularCodes.flatMap((code) => {
          const airport = getAirportInfo(code);
          return airport ? [airport] : [];
        });
    return base
      .filter((airport, index, list) => list.findIndex((item) => item.code === airport.code) === index)
      .filter((airport) => airport.code !== value)
      .slice(0, 4);
  }, [popularCodes, query, value]);

  return (
    <section className={`airport-picker ${variant}`} aria-label={`${label} 선택`}>
      <div className="airport-picker-header">
        <span>{variant === 'origin' ? 'FROM' : 'TO'}</span>
        <strong>{label}</strong>
      </div>
      <label>
        <span className="sr-only">{label} 검색</span>
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="도시명 또는 공항 코드 검색"
        />
      </label>
      <div className="selected-airport">
        <strong>{selected ? selected.code : value}</strong>
        <span>{selected ? `${selected.cityKo} · ${selected.airportKo}` : '공항을 검색해서 선택하세요'}</span>
      </div>
      <div className="airport-options">
        {options.map((airport) => (
          <button
            type="button"
            className="airport-option"
            key={airport.code}
            onClick={() => {
              onSelect(airport.code);
              setQuery('');
            }}
          >
            <strong>{airport.code}</strong>
            <span>{airport.cityKo}</span>
            <small>{airport.airportKo}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function comparablePrice(candidate: FlightCandidate): number {
  return candidate.priceKrw ?? candidate.priceTotal;
}

function getCandidateRaw(candidate: FlightCandidate): CandidateRawSummary {
  return (candidate.raw ?? {}) as CandidateRawSummary;
}

function getCarrierName(candidate: FlightCandidate): string {
  const raw = getCandidateRaw(candidate);
  return raw.carrierName ?? raw.carrier ?? '상세 확인 필요';
}

function hasCheckedBagIncluded(candidate: FlightCandidate): boolean {
  const raw = getCandidateRaw(candidate);
  return candidate.priceIncludes.includes('checked_bag') || raw.checkedBagIncluded === true;
}

function checkedBagStatus(candidate: FlightCandidate): Exclude<BaggageFilter, 'all'> {
  const raw = getCandidateRaw(candidate);
  if (hasCheckedBagIncluded(candidate)) return 'included';
  if (raw.checkedBagIncluded === false) return 'excluded';
  return 'unknown';
}

function formatCandidatePrice(candidate: FlightCandidate): string {
  if (candidate.priceKrw !== null) {
    return `${candidate.priceKrw.toLocaleString('ko-KR')}원`;
  }
  return `${candidate.priceTotal.toLocaleString('en-US')} ${candidate.priceCurrency}`;
}

function formatPriceDelta(candidate: FlightCandidate, baselinePrice: number | null): string {
  if (baselinePrice === null) return '비교 기준 없음';
  const delta = comparablePrice(candidate) - baselinePrice;
  if (Math.abs(delta) < 1) return '현재 조건 최저가';
  const sign = delta > 0 ? '+' : '-';
  const amount = Math.abs(Math.round(delta)).toLocaleString(candidate.priceKrw !== null ? 'ko-KR' : 'en-US');
  return candidate.priceKrw !== null ? `최저가 대비 ${sign}${amount}원` : `최저가 대비 ${sign}${amount} ${candidate.priceCurrency}`;
}

function formatReadableDate(dateStr: string): string {
  return `${dateStr} (${weekdayKo(dateStr)})`;
}

function formatShortDate(dateStr: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  return `${Number(match[1])}/${Number(match[2])}(${weekdayKo(dateStr)})`;
}

function formatLegTime(raw: CandidateRawSummary, leg: 'outbound' | 'return'): string {
  const depart = leg === 'outbound' ? raw.outboundDepart : raw.returnDepart ?? raw.inboundDepart;
  const arrive = leg === 'outbound' ? raw.outboundArrive : raw.returnArrive ?? raw.inboundArrive;
  return depart && arrive ? `${depart} → ${arrive}` : depart || arrive || '';
}

function combinationStatus(candidate: FlightCandidate): {
  label: string;
  description: string;
  tone: 'good' | 'warn' | 'caution';
  priority: number;
} {
  const raw = getCandidateRaw(candidate);
  const hasOutboundTime = Boolean(formatLegTime(raw, 'outbound'));
  const hasReturnTime = Boolean(formatLegTime(raw, 'return'));
  if (hasOutboundTime && hasReturnTime && candidate.outboundDirect && candidate.returnDirect) {
    return {
      label: '왕복 확인',
      description: '가는 편과 오는 편 시간이 모두 추출된 왕복 후보입니다.',
      tone: 'good',
      priority: 3,
    };
  }
  if (hasOutboundTime) {
    return {
      label: '가는편 상세',
      description: '가는 편 시간은 확인됐지만 오는 편 조합은 사이트에서 다시 확인해야 합니다.',
      tone: 'warn',
      priority: 2,
    };
  }
  return {
    label: '가격만',
    description: '목록 가격만 추출됐고 실제 항공편 조합은 예약 사이트에서 확인해야 합니다.',
    tone: 'caution',
    priority: 1,
  };
}

function priceConfidence(candidate: FlightCandidate): { tone: 'good' | 'warn' | 'caution'; label: string; description: string } {
  const combo = combinationStatus(candidate);
  if (combo.priority < 3) {
    return {
      tone: 'warn',
      label: '왕복 조합 확인 필요',
      description: `${combo.description} 가격은 표시가 기준으로만 비교하세요.`,
    };
  }
  const includes = new Set(candidate.priceIncludes);
  if (includes.has('taxes') && includes.has('fees')) {
    return {
      tone: 'good',
      label: '표시가 기준 최종가에 가까움',
      description: '세금/수수료 포함으로 읽혔습니다. 결제 직전 옵션과 환율은 다시 확인해야 합니다.',
    };
  }
  if (includes.has('unknown_fees')) {
    return {
      tone: 'warn',
      label: '결제 전 수수료 확인 필요',
      description: '일부 수수료 포함 여부가 불명확합니다. 예약 사이트에서 최종 결제 금액을 확인하세요.',
    };
  }
  return {
    tone: 'caution',
    label: '최종가 불확실',
    description: '목록에서 읽은 표시 가격입니다. 세금/수수료/수하물 포함 여부를 결제 단계에서 확인해야 합니다.',
  };
}

function priceIncludesText(candidate: FlightCandidate): string {
  const raw = getCandidateRaw(candidate);
  const labels: Record<string, string> = {
    taxes: '세금',
    fees: '수수료',
    unknown_fees: '수수료 불확실',
    carry_on: '기내 수하물',
    checked_bag: '위탁 수하물',
    baggage_unknown: '수하물 미확인',
  };
  const items = candidate.priceIncludes.map((item) => labels[item] ?? item);
  if (raw.checkedBagIncluded === false) {
    items.push('위탁 수하물 별도');
  }
  if (raw.baggageRaw && raw.checkedBagIncluded !== null && raw.checkedBagIncluded !== undefined) {
    items.push(`원문 ${raw.baggageRaw}`);
  }
  return Array.from(new Set(items)).join(', ') || '미확인';
}

function directVerificationText(candidate: FlightCandidate): string {
  if (candidate.directVerification === 'verified_direct') return '직항 표시 확인';
  if (candidate.directVerification === 'not_direct') return '직항 아님';
  return '직항 여부 미확인';
}

function captureAgeText(capturedAt: string): string {
  const captured = new Date(capturedAt);
  if (Number.isNaN(captured.getTime())) return '캡처 시각 미상';
  const diffMs = Math.max(0, Date.now() - captured.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  const absolute = captured.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  if (minutes < 60) return `${minutes || 1}분 전 · ${absolute}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전 · ${absolute}`;
  return `${Math.floor(hours / 24)}일 전 · ${absolute}`;
}

function isCaptureStale(capturedAt: string): boolean {
  const captured = new Date(capturedAt).getTime();
  return Number.isFinite(captured) && Date.now() - captured > 60 * 60 * 1000;
}

function candidateNotes(candidate: FlightCandidate, baselinePrice: number | null): string[] {
  const raw = getCandidateRaw(candidate);
  const includes = new Set(candidate.priceIncludes);
  const combo = combinationStatus(candidate);
  const notes = [
    '자동 추출한 목록 가격이라 실제 결제 단계에서 금액이 바뀔 수 있습니다.',
    combo.description,
    formatPriceDelta(candidate, baselinePrice),
  ];
  if (includes.has('taxes') && includes.has('fees')) {
    notes.push('목록 화면에서는 세금과 수수료 포함 가격으로 읽혔습니다.');
  } else {
    notes.push('세금/수수료 포함 여부가 완전히 확인되지 않았습니다.');
  }
  if (!includes.has('carry_on') && !includes.has('checked_bag')) {
    if (raw.checkedBagIncluded === false) {
      notes.push('위탁 수하물은 표시 가격에 포함되지 않은 것으로 읽혔습니다.');
    } else {
      notes.push('수하물, 좌석 선택, 카드 결제 수수료는 별도일 수 있습니다.');
    }
  } else if (hasCheckedBagIncluded(candidate)) {
    notes.push('위탁 수하물 포함으로 읽힌 후보입니다.');
  }
  if (candidate.priceCurrency !== 'KRW' && candidate.priceKrw !== null) {
    notes.push(`원문 가격은 ${raw.priceRaw ?? `${candidate.priceTotal} ${candidate.priceCurrency}`}이고 원화는 실행 시점 환율로 환산했습니다.`);
  }
  if (candidate.pricePerAdult) {
    notes.push('성인 1인 왕복 기준으로 정리했습니다.');
  }
  if (candidate.directVerification === 'verified_direct') {
    notes.push('검색 결과에서 직항 표시를 확인한 후보입니다.');
  }
  if (!formatLegTime(raw, 'return')) {
    notes.push('귀국편은 이 캡처에서 분리 추출되지 않았으므로 예약 사이트에서 오는 편 선택 화면을 확인해야 합니다.');
  }
  if (isCaptureStale(candidate.capturedAt)) {
    notes.push('캡처 후 1시간 이상 지나 링크나 가격이 만료됐을 수 있습니다.');
  }
  return Array.from(new Set(notes));
}

function runSnapshot(detail: FlightRunDetail): string {
  const cp = detail.candidatesPreview ?? [];
  const lastId = cp.length > 0 ? cp[cp.length - 1]?.id ?? '' : '';
  return `${detail.status}|${detail.progress?.percent ?? 0}|${cp.length}|${cp[0]?.id ?? ''}|${lastId}`;
}

function weekdayKo(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Use UTC so server-side timezone never shifts the weekday.
  const dt = new Date(Date.UTC(year, month - 1, day));
  return WEEKDAY_KO[dt.getUTCDay()] ?? '';
}

function inferPercent(completed?: number, total?: number) {
  if (!completed || !total) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

function shouldShowInterimResults(
  run: FlightRunDetail | null,
  candidates: FlightCandidate[],
  progressPercent: number,
) {
  if (!run || candidates.length === 0) return false;
  if (run.status === 'completed' || run.status === 'failed') return true;
  if (run.status !== 'running' && run.status !== 'queued' && run.status !== 'paused') return false;

  const completed = run.progress?.completed ?? 0;
  const total = run.progress?.total ?? 0;
  if (total > 0) return completed / total >= 0.5;
  if (progressPercent > 0) return progressPercent >= 50;
  return candidates.length >= 8;
}

function statusCopy(status?: string) {
  switch (status) {
    case 'queued':
      return '대기열 등록';
    case 'running':
      return '검색 중';
    case 'paused':
      return '사용자 확인 대기';
    case 'completed':
      return '검색 완료';
    case 'failed':
      return '실패';
    case 'canceled':
      return '취소됨';
    default:
      return '대기 중';
  }
}

function runStatusMessage(run: FlightRunDetail) {
  if (run.status === 'paused') {
    return '브라우저 창에서 확인이 필요한 상태입니다. 확인 후 재개를 누르세요.';
  }
  if (run.status === 'completed') {
    return '검색이 끝났습니다. 아래 결과를 확인하세요.';
  }
  if (run.status === 'failed') {
    return '검색을 완료하지 못했습니다. 조건을 조금 줄여 다시 시도해 주세요.';
  }
  return run.message ?? '상태를 확인 중입니다.';
}

function isInternalStatusMessage(message: string): boolean {
  return /FLIGHT_MAX_PAIRS|균등 샘플링|Run failed:|Target page, context or browser has been closed/i.test(message);
}

function providerLabel(provider: string) {
  switch (provider) {
    case 'kayak':
      return 'Kayak';
    case 'momondo':
      return 'Momondo';
    case 'trip':
    case 'trip_com':
    case 'tripcom':
      return 'Trip.com';
    case 'csv':
      return '가격표';
    default:
      return normalizeProviderForLink(provider);
  }
}

function liveResultProgressCopy(run: FlightRunDetail | null) {
  if (run?.status === 'paused') return '확인 대기 중입니다.';
  if (run?.status === 'completed') return '조사가 완료되었습니다.';
  if (run?.status === 'failed') return '조사가 중단되었습니다.';
  return '결과를 계속 갱신 중입니다.';
}
