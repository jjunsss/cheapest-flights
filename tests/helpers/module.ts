import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function importExpectedModule(
  modulePath: string,
  exportNames: string[],
): Promise<Record<string, unknown>> {
  const absolutePath = resolve(rootDir, modulePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Expected app module is missing: ${modulePath}`);
  }

  const imported = await import(pathToFileURL(absolutePath).href);
  for (const exportName of exportNames) {
    if (!(exportName in imported)) {
      throw new Error(`Expected ${modulePath} to export ${exportName}`);
    }
  }

  return imported;
}

export function fixturePath(fileName: string): string {
  return resolve(rootDir, "fixtures", fileName);
}
