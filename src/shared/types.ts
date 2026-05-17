export type FlightProvider =
  | "csv"
  | "googleFlights"
  | "google_flights"
  | "skyscanner"
  | "kiwi"
  | "kayak"
  | "naver"
  | string;

export type NormalizedProvider = "csv" | "google_flights" | "skyscanner" | "kiwi" | string;

export type FlightRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "canceled";

export type SearchTaskStatus =
  | "pending"
  | "running"
  | "paused"
  | "succeeded"
  | "failed_retryable"
  | "failed_final"
  | "cancelled";

export type DirectVerification = "verified_direct" | "not_direct" | "unknown";

export type PriceInclude =
  | "taxes"
  | "fees"
  | "unknown_fees"
  | "carry_on"
  | "checked_bag"
  | "baggage_unknown";

export interface FlightSearchPayload {
  origin: string;
  destinations: string[];
  dateRange: {
    start: string;
    end: string;
  };
  stay: {
    minNights: number;
    maxNights: number;
  };
  providers: FlightProvider[];
  currency?: string;
  csvText?: string;
}

export interface FlightDefaultsResponse {
  origin?: string;
  destinations?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  stay?: {
    minNights?: number;
    maxNights?: number;
  };
  providers?: FlightProvider[];
}

export interface FlightEstimateResponse {
  combinations: number;
  browserTasks: number;
  csvRows: number;
  estimatedSeconds: number;
  estimatedEtaText: string;
  providerCount: number;
  summary: string;
  warnings: string[];
}

export interface FlightRunResponse {
  id: string;
  status?: FlightRunStatus;
  reportLinks?: ReportLink[];
}

export interface ReportLink {
  label: string;
  href: string;
}

export interface FlightRunDetail {
  id: string;
  status: FlightRunStatus;
  startedAt?: string;
  finishedAt?: string;
  progress?: {
    completed?: number;
    total?: number;
    percent?: number;
  };
  reportLinks?: ReportLink[];
  message?: string;
  warnings?: string[];
  providerRuns?: ProviderRunSummary[];
  candidatesPreview?: FlightCandidate[];
}

export interface FlightRunEvent {
  type?: "status" | "progress" | "pause" | "report" | "error" | "heartbeat";
  status?: FlightRunStatus;
  message?: string;
  progress?: {
    completed?: number;
    total?: number;
    percent?: number;
  };
  reportLinks?: ReportLink[];
  timestamp?: string;
}

export interface ProviderRunSummary {
  provider: NormalizedProvider;
  status: SearchTaskStatus | FlightRunStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  nResults: number;
}

export interface FlightCandidate {
  id: string;
  runId: string;
  provider: NormalizedProvider;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  stayDays: number;
  priceTotal: number;
  priceCurrency: string;
  priceKrw: number | null;
  priceIncludes: PriceInclude[];
  pricePerAdult: boolean;
  outboundDirect: boolean | null;
  returnDirect: boolean | null;
  directVerification: DirectVerification;
  bookingUrl?: string;
  capturedAt: string;
  raw?: unknown;
}

export interface SearchTask {
  id: string;
  runId: string;
  provider: NormalizedProvider;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  status: SearchTaskStatus;
  attempts: number;
  lastError?: string;
}

export interface ExchangeRateSnapshot {
  baseCurrency: "KRW";
  source: string;
  capturedAt: string;
  ratesToKrw: Record<string, number>;
}
