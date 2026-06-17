import * as path from "node:path";

import { loadAdultConfig, validateAdultConfig, type AdultConfig } from "./config";
import { AdultMonitor, type MonitorDeps } from "./services/monitor";
import { TaskRegistry } from "./services/task-registry";
import { CompletedHistory } from "./services/completed-history";
import { Importer } from "./services/importer";
import { CleanupService } from "./services/cleanup";
import { createDownloader } from "./clients/factory";
import type { Downloader } from "./clients/downloader";

export interface AdultRuntime {
  config: AdultConfig;
  monitor: AdultMonitor;
  registry: TaskRegistry;
  history: CompletedHistory;
  downloader: Downloader;
  importer: Importer;
  cleanup: CleanupService;
}

export function createAdultRuntime(): AdultRuntime {
  const config = loadAdultConfig();
  validateAdultConfig(config);

  const registry = new TaskRegistry(path.join(config.stateDir, "tasks.jsonl"));
  const history = new CompletedHistory(
    path.join(config.stateDir, "completed.jsonl"),
  );
  const downloader = createDownloader(config);
  const importer = new Importer(config.importTargets);
  const cleanup = new CleanupService(downloader);
  const monitor = new AdultMonitor(config, {
    registry,
    downloader,
    importer,
    history,
    cleanup,
  });

  return {
    config,
    monitor,
    registry,
    history,
    downloader,
    importer,
    cleanup,
  };
}
