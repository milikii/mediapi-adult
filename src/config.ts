import type { DownloaderType, TargetAlias } from "./types";

export interface AdultConfig {
  downloaderType: DownloaderType;
  qbittorrent: DownloaderEndpointConfig;
  transmission: DownloaderEndpointConfig;
  stateDir: string;
  importTargets: Record<TargetAlias, string>;
  monitorEnabled: boolean;
  monitorIntervalMs: number;
  enabledSites: string[];
  sukebeiBaseUrl: string;
  javbusBaseUrl: string;
  javlibraryBaseUrl: string;
  translateApiKey?: string;
}

export interface DownloaderEndpointConfig {
  url: string;
  username?: string;
  password?: string;
}

export function loadAdultConfig(
  env: NodeJS.ProcessEnv = process.env
): AdultConfig {
  return {
    downloaderType: parseDownloaderType(
      env.ADULT_DOWNLOADER_TYPE ?? "qbittorrent"
    ),
    qbittorrent: {
      url: trimTrailingSlash(env.ADULT_QB_URL ?? "http://localhost:8081"),
      username: emptyToUndefined(env.ADULT_QB_USERNAME),
      password: emptyToUndefined(env.ADULT_QB_PASSWORD),
    },
    transmission: {
      url: trimTrailingSlash(env.ADULT_TR_URL ?? "http://localhost:9092"),
      username: emptyToUndefined(env.ADULT_TR_USERNAME),
      password: emptyToUndefined(env.ADULT_TR_PASSWORD),
    },
    stateDir: env.ADULT_STATE_DIR ?? "",
    importTargets: {
      censored: env.ADULT_IMPORT_TARGET_CENSORED ?? "",
      uncensored: env.ADULT_IMPORT_TARGET_UNCENSORED ?? "",
      no_code: env.ADULT_IMPORT_TARGET_NO_CODE ?? "",
    },
    monitorEnabled: parseBoolean(env.ADULT_MONITOR_ENABLED, true),
    monitorIntervalMs:
      parsePositiveInteger(env.ADULT_MONITOR_INTERVAL_SECONDS, 60) * 1000,
    enabledSites: parseList(env.ADULT_ENABLED_SITES ?? "sukebei"),
    sukebeiBaseUrl: trimTrailingSlash(
      env.SUKEBEI_BASE_URL ?? "https://sukebei.nyaa.si"
    ),
    javbusBaseUrl: trimTrailingSlash(
      env.JAVBUS_BASE_URL ?? "https://www.javbus.com"
    ),
    javlibraryBaseUrl: trimTrailingSlash(
      env.JAVLIBRARY_BASE_URL ?? "https://www.javlibrary.com"
    ),
    translateApiKey: emptyToUndefined(env.TRANSLATE_API_KEY),
  };
}

export function validateAdultConfig(config: AdultConfig): void {
  if (!config.stateDir) {
    throw new Error("ADULT_STATE_DIR is required");
  }

  for (const alias of ["censored", "uncensored", "no_code"] as const) {
    if (!config.importTargets[alias]) {
      throw new Error(`ADULT_IMPORT_TARGET_${alias.toUpperCase()} is required`);
    }
  }

  if (config.monitorIntervalMs < 1000) {
    throw new Error("ADULT_MONITOR_INTERVAL_SECONDS must be at least 1");
  }
}

function parseDownloaderType(value: string): DownloaderType {
  if (value === "qbittorrent" || value === "transmission") return value;
  throw new Error(
    "ADULT_DOWNLOADER_TYPE must be either 'qbittorrent' or 'transmission'"
  );
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
