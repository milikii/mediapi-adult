import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Append a JSON-serialized record to a JSONL file. Creates the parent directory
 * if it does not exist.
 */
export function appendJsonl<T>(filePath: string, record: T): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(record) + "\n");
}

/**
 * Read a JSONL file, returning an array of parsed records.
 * If the file does not exist, returns an empty array.
 * Lines that fail to parse are silently skipped (tolerates torn / interrupted writes).
 */
export function readJsonl<T>(filePath: string): T[] {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const results: T[] = [];
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    try {
      results.push(JSON.parse(trimmed) as T);
    } catch {
      // skip lines that fail to parse (torn final write, etc.)
    }
  }
  return results;
}
