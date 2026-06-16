import { AdultTask, AdultTaskStatus } from "../types";
import { appendJsonl, readJsonl } from "../utils/jsonl";

/**
 * Append-only active-task registry backed by a JSONL file.
 * The current state for each task_id is the *last* written record.
 * Reconstruction reads the file fresh every call (no in-memory cache).
 */
export class TaskRegistry {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /** Append a task record to the JSONL file. */
  upsert(task: AdultTask): void {
    appendJsonl(this.filePath, task);
  }

  /** Return the latest record for `taskId`, or undefined if not found. */
  get(taskId: string): AdultTask | undefined {
    const latest = this.buildLatestPerId();
    return latest.get(taskId);
  }

  /** Return one record per task_id (latest written), sorted by created_at ascending. */
  list(): AdultTask[] {
    const latest = this.buildLatestPerId();
    const tasks = Array.from(latest.values());
    tasks.sort((a, b) => a.created_at - b.created_at);
    return tasks;
  }

  /** Return records from `list()` filtered to the given status. */
  listByStatus(status: AdultTaskStatus): AdultTask[] {
    return this.list().filter((t) => t.status === status);
  }

  private buildLatestPerId(): Map<string, AdultTask> {
    const records = readJsonl<AdultTask>(this.filePath);
    const map = new Map<string, AdultTask>();
    for (const record of records) {
      map.set(record.task_id, record);
    }
    return map;
  }
}
