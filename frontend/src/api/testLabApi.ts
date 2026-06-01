import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 120000, // 2 minutes — covers full synchronous suite runs
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Types ──────────────────────────────────────────────────────────────────────

export type TestStatus = "PASS" | "FAIL" | "ERROR" | "SKIPPED";
export type RunStatus  = "RUNNING" | "PASSED" | "FAILED" | "PARTIAL" | "ABORTED";

export interface TestResult {
  resultId: string;
  suiteName: string;
  testName: string;
  status: TestStatus;
  description: string;
  assertionMessage?: string;
  errorMessage?: string;
  durationMs: number;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  cleanupIds?: string[];
  runAt: string;
}

export interface TestRun {
  testRunId: string;
  suiteName: string;
  triggeredBy: string;
  status: RunStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  errorTests: number;
  skippedTests: number;
  passRate: number;
  results: TestResult[];
  startedAt: string;
  completedAt?: string;
  totalDurationMs: number;
  environment?: Record<string, unknown>;
}

/** Lightweight status response from GET /runs/{id}/status (no results array). */
export interface RunStatusPoll {
  testRunId: string;
  suiteName: string;
  status: RunStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  errorTests: number;
  skippedTests: number;
  passRate: number;
  startedAt: string;
  completedAt?: string;
  totalDurationMs: number;
  isActive: boolean;
}

export interface SuiteInfo {
  name: string;
  description: string;
}

export interface AutomationStatus {
  schedule: {
    nightlyRun: string;
    healthCheck: string;
  };
  lastNightlyRun: {
    runId?: string;
    status: string;
    passRate?: string;
    passed?: number;
    total?: number;
    completedAt?: string;
    durationMs?: number;
    triggeredAt?: string;
    note?: string;
  };
  lastHealthCheck: {
    runId?: string;
    status: string;
    passRate?: string;
    passed?: number;
    total?: number;
    completedAt?: string;
    triggeredAt?: string;
    note?: string;
  };
}

// ── API ────────────────────────────────────────────────────────────────────────

export const testLabApi = {
  /**
   * Run a test suite synchronously (blocks until complete).
   * Best for fast individual suites (< 30 seconds).
   * For ALL suites use runSuiteAsync instead to avoid HTTP timeout risk.
   */
  runSuite: (suite = "ALL", triggeredBy = "admin"): Promise<TestRun> =>
    api.post("/test-lab/run", null, { params: { suite, triggeredBy } }).then((r) => r.data),

  /**
   * Start a test run asynchronously.
   * Returns immediately with a RUNNING run (runId populated).
   * Poll getRunStatus(runId) every few seconds until status !== "RUNNING".
   * Then call getRun(runId) for the full result.
   */
  runSuiteAsync: (suite = "ALL", triggeredBy = "admin"): Promise<TestRun> =>
    api.post("/test-lab/run/async", null, { params: { suite, triggeredBy } }).then((r) => r.data),

  /** List recent test runs (latest first). */
  getRecentRuns: (limit = 20): Promise<TestRun[]> =>
    api.get("/test-lab/runs", { params: { limit } }).then((r) => r.data),

  /** Get a specific test run by ID (full results). */
  getRun: (runId: string): Promise<TestRun> =>
    api.get(`/test-lab/runs/${runId}`).then((r) => r.data),

  /** Lightweight status poll — no results array, low payload. */
  getRunStatus: (runId: string): Promise<RunStatusPoll> =>
    api.get(`/test-lab/runs/${runId}/status`).then((r) => r.data),

  /** Get the single most recent completed run. */
  getLatestRun: (): Promise<TestRun | null> =>
    api.get("/test-lab/runs/latest").then((r) => r.data).catch(() => null),

  /** Cleanup test data created by a run. */
  cleanupRun: (runId: string): Promise<void> =>
    api.delete(`/test-lab/runs/${runId}/cleanup`).then(() => undefined),

  /** List all available suite names and descriptions. */
  getSuites: (): Promise<SuiteInfo[]> =>
    api.get("/test-lab/suites").then((r) => r.data),

  /** Get scheduled automation status (last nightly run, last health check). */
  getAutomationStatus: (): Promise<AutomationStatus> =>
    api.get("/test-lab/automation/status").then((r) => r.data),
};
