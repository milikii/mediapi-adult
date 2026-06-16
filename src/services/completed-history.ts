import { CompletedHistoryItem } from "../types";
import { appendJsonl, readJsonl } from "../utils/jsonl";

export class CompletedHistory {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  record(item: CompletedHistoryItem): void {
    appendJsonl(this.filePath, item);
  }

  hasCode(code: string): boolean {
    const records = readJsonl<CompletedHistoryItem>(this.filePath);
    return records.some(
      (r) => r.key_type === "code" && r.key === code,
    );
  }

  hasInfohash(infohash: string): boolean {
    const records = readJsonl<CompletedHistoryItem>(this.filePath);
    return records.some(
      (r) => r.key_type === "infohash" && r.key === infohash,
    );
  }

  findByCode(code: string): CompletedHistoryItem | undefined {
    const records = readJsonl<CompletedHistoryItem>(this.filePath);
    let latest: CompletedHistoryItem | undefined;
    for (const r of records) {
      if (r.key_type === "code" && r.key === code) {
        latest = r;
      }
    }
    return latest;
  }

  findByInfohash(infohash: string): CompletedHistoryItem | undefined {
    const records = readJsonl<CompletedHistoryItem>(this.filePath);
    let latest: CompletedHistoryItem | undefined;
    for (const r of records) {
      if (r.key_type === "infohash" && r.key === infohash) {
        latest = r;
      }
    }
    return latest;
  }

  list(): CompletedHistoryItem[] {
    return readJsonl<CompletedHistoryItem>(this.filePath);
  }
}
