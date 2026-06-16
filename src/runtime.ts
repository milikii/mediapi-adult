import { loadAdultConfig, validateAdultConfig, type AdultConfig } from "./config";
import { AdultMonitor } from "./services/monitor";

export interface AdultRuntime {
  config: AdultConfig;
  monitor: AdultMonitor;
}

export function createAdultRuntime(): AdultRuntime {
  const config = loadAdultConfig();
  validateAdultConfig(config);

  return {
    config,
    monitor: new AdultMonitor(config),
  };
}
