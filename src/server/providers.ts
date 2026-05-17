import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium, type BrowserContext } from "playwright";
import type { NormalizedProvider, SearchTask } from "../shared/types.js";
import { buildProviderSearchUrl } from "../shared/providerLinks.js";
import type { AppDatabase } from "./db.js";
import { recordCapture } from "./db.js";
import { BROWSER_PROFILE_DIR, CAPTURES_DIR } from "./paths.js";

export interface BrowserTaskResult {
  status: "paused" | "succeeded" | "failed_final";
  message: string;
}

let browserContext: BrowserContext | null = null;

export async function openManualProviderTask(
  db: AppDatabase,
  task: SearchTask
): Promise<BrowserTaskResult> {
  const url = buildProviderUrl(task.provider, task);
  const captureDir = path.join(CAPTURES_DIR, task.runId);
  await mkdir(captureDir, { recursive: true });
  const payloadPath = path.join(captureDir, `${task.id}.json`);
  await writeFile(
    payloadPath,
    `${JSON.stringify(
      {
        provider: task.provider,
        url,
        task,
        capturedAt: new Date().toISOString(),
        note: "Manual headed-browser task. User should inspect the page and import CSV data for candidates."
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  recordCapture(db, {
    id: randomUUID(),
    runId: task.runId,
    provider: task.provider,
    kind: "manual_search_url",
    payloadPath,
    redacted: true
  });

  if (process.env.FLIGHT_FINDER_DISABLE_BROWSER === "1") {
    return {
      status: "paused",
      message: `${task.provider} manual URL captured. Browser launch disabled by FLIGHT_FINDER_DISABLE_BROWSER=1.`
    };
  }

  try {
    const context = await getBrowserContext(task.provider);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return {
      status: "paused",
      message: `${task.provider} 창을 열었습니다. 사용자가 화면을 확인한 뒤 앱에서 Resume을 누르면 다음 검색으로 넘어갑니다.`
    };
  } catch (error) {
    return {
      status: "paused",
      message: `${task.provider} 브라우저를 열지 못했습니다. URL 캡처는 저장했습니다: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

export function buildProviderUrl(provider: NormalizedProvider, task: SearchTask): string {
  return buildProviderSearchUrl({
    provider,
    origin: task.origin,
    destination: task.destination,
    departDate: task.departDate,
    returnDate: task.returnDate
  });
}

export async function closeManualBrowser(): Promise<void> {
  if (browserContext) {
    await browserContext.close();
    browserContext = null;
  }
}

async function getBrowserContext(provider: NormalizedProvider): Promise<BrowserContext> {
  if (browserContext) return browserContext;
  browserContext = await chromium.launchPersistentContext(path.join(BROWSER_PROFILE_DIR, provider), {
    headless: false,
    viewport: { width: 1360, height: 900 }
  });
  return browserContext;
}
