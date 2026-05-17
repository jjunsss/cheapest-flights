import { mkdirSync } from "node:fs";
import path from "node:path";

export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const REPORTS_DIR = path.join(ROOT_DIR, "reports");
export const CAPTURES_DIR = path.join(DATA_DIR, "captures");
export const BROWSER_PROFILE_DIR = path.join(DATA_DIR, "browser-profile");
export const DB_PATH = path.join(DATA_DIR, "flights.sqlite");

export function ensureRuntimeDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(REPORTS_DIR, { recursive: true });
  mkdirSync(CAPTURES_DIR, { recursive: true });
  mkdirSync(BROWSER_PROFILE_DIR, { recursive: true });
}
