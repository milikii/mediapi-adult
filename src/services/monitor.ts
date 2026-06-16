import type { AdultConfig } from "../config";

export class AdultMonitor {
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly config: AdultConfig) {}

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
    // Greenfield baseline: task registry, downloader polling, import, history,
    // and cleanup orchestration will be implemented against the new PRD.
  }
}
