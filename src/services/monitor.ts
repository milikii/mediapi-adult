import type { AdultConfig } from "../config";
import type { AdultTask } from "../types";
import type { Downloader } from "../clients/downloader";
import { advanceTask } from "./lifecycle";
import type {
  LifecycleImporter,
  LifecycleHistory,
  LifecycleCleaner,
} from "./lifecycle";

// ---------------------------------------------------------------------------
// Dependency interfaces (narrower than the real service classes so test fakes
// can satisfy them without pulling in fs / network).
// ---------------------------------------------------------------------------

export interface TaskStore {
  list(): AdultTask[];
  upsert(task: AdultTask): void;
}

export interface MonitorDeps {
  registry: TaskStore;
  downloader: Downloader;
  importer: LifecycleImporter;
  history: LifecycleHistory;
  cleanup: LifecycleCleaner;
}

// ---------------------------------------------------------------------------
// AdultMonitor
// ---------------------------------------------------------------------------

export class AdultMonitor {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly config: AdultConfig,
    private readonly deps: MonitorDeps,
  ) {}

  start(onError: (error: unknown) => void): boolean {
    if (!this.config.monitorEnabled || this.timer) return false;

    this.timer = setInterval(() => {
      this.tick().catch(onError);
    }, this.config.monitorIntervalMs);

    return true;
  }

  stop(): boolean {
    if (!this.timer) return false;
    clearInterval(this.timer);
    this.timer = undefined;
    return true;
  }

  isRunning(): boolean {
    return this.timer !== undefined;
  }

  async tick(): Promise<void> {
    const advanceable = new Set(["registered", "downloading", "completed"]);
    const tasks = this.deps.registry
      .list()
      .filter((t) => advanceable.has(t.status));

    for (const task of tasks) {
      try {
        const now = Date.now();
        const importId = `import-${task.task_id}-${now}`;
        const result = await advanceTask(task, {
          downloader: this.deps.downloader,
          importer: this.deps.importer,
          history: this.deps.history,
          cleanup: this.deps.cleanup,
          now,
          importId,
        });

        if (result.task.status !== task.status) {
          this.deps.registry.upsert(result.task);
        }
      } catch {
        // skip this task; leave for next tick
      }
    }
  }
}
