# Environment Configuration

## Overview

MediaPi Adult reads configuration from environment variables. `.env.example` documents supported values, but runtime loading depends on how Pi starts the extension. If Pi does not load `.env` automatically, start Pi from a shell where these variables are exported.

The adult downloader should be a dedicated qBittorrent or Transmission instance. Do not point these variables at the PT/viewing downloader instance.

## Required Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ADULT_DOWNLOADER_TYPE` | Yes | `qbittorrent` | Dedicated adult downloader backend: `qbittorrent` or `transmission`. |
| `ADULT_STATE_DIR` | Yes | none | Local state directory for active tasks and completed history. |
| `ADULT_IMPORT_TARGET_CENSORED` | Yes | none | Root directory for coded censored JAV imports. |
| `ADULT_IMPORT_TARGET_UNCENSORED` | Yes | none | Root directory for coded uncensored JAV imports. |
| `ADULT_IMPORT_TARGET_NO_CODE` | Yes | none | Root directory for no-code or uncertain-category adult imports. |
| `ADULT_ENABLED_SITES` | No | `sukebei` | Comma-separated public BT site adapter names. MVP default is `sukebei`. |

`ADULT_IMPORT_ROOT` is legacy. New code should prefer category aliases. If retained for compatibility, it must not replace the three required category target variables.

## qBittorrent Variables

Required when `ADULT_DOWNLOADER_TYPE=qbittorrent`:

| Variable | Default | Description |
| --- | --- | --- |
| `ADULT_QB_URL` | `http://localhost:8081` | Dedicated adult qBittorrent Web API URL. |
| `ADULT_QB_USERNAME` | none | qBittorrent username. |
| `ADULT_QB_PASSWORD` | none | qBittorrent password. |

## Transmission Variables

Required when `ADULT_DOWNLOADER_TYPE=transmission`:

| Variable | Default | Description |
| --- | --- | --- |
| `ADULT_TR_URL` | `http://localhost:9092` | Dedicated adult Transmission RPC URL. |
| `ADULT_TR_USERNAME` | none | Transmission username. |
| `ADULT_TR_PASSWORD` | none | Transmission password. |

## Site Variables

| Variable | Default | Description |
| --- | --- | --- |
| `SUKEBEI_BASE_URL` | `https://sukebei.nyaa.si` | Sukebei search base URL. |
| `JAVBUS_BASE_URL` | `https://www.javbus.com` | JavBus metadata base URL. |
| `JAVLIBRARY_BASE_URL` | `https://www.javlibrary.com` | Planned metadata fallback. |

Only public BT site adapters belong in `ADULT_ENABLED_SITES`. Do not configure Prowlarr or PT indexers for this extension.

## Background Monitor

| Variable | Default | Description |
| --- | --- | --- |
| `ADULT_MONITOR_ENABLED` | `true` | Start the in-process task monitor when the extension loads. |
| `ADULT_MONITOR_INTERVAL_SECONDS` | `60` | Poll interval for registered active tasks. |

The monitor runs only while Pi is running and the extension is loaded. It processes tasks recorded in adult local state and ignores unregistered downloader tasks.

## Import Targets

Required target aliases:

```bash
ADULT_IMPORT_TARGET_CENSORED=/private/adult/censored
ADULT_IMPORT_TARGET_UNCENSORED=/private/adult/uncensored
ADULT_IMPORT_TARGET_NO_CODE=/private/adult/no-code
```

Directory layout:

- Coded tasks: `<target-root>/<NORMALIZED-CODE>/<original filename>`.
- No-code tasks: `<no-code-root>/<sanitized-display-title>-<short-infohash>/<original filename>`.

The extension should store only aliases and redacted paths in user-facing output, Pi session entries, and local state.

## Local State

Recommended files under `ADULT_STATE_DIR`:

- `tasks.jsonl`: active and failed task state for monitor pickup and retries.
- `completed.jsonl`: long-lived completed history for dedupe.

State files may store codes, infohashes, display titles, target aliases, status, timestamps, import IDs, and non-sensitive error summaries. They must not store real source paths, real target paths, or downloader credentials.

## Retention

The current product model does not keep adult BT tasks seeding after import. Cleanup should run after successful import and completed-history write.

`ADULT_RETENTION_DAYS` is legacy and should not be used as a default blocker for cleanup in the new workflow.

## Translation

| Variable | Required | Description |
| --- | --- | --- |
| `TRANSLATE_API_KEY` | No | Optional translation service key. MVP may ignore this and return source text. |

Translation must degrade gracefully. Search should still work when no translation key exists.

## Validation Rules

- Fail fast when the selected downloader is missing required connection values.
- Reject unknown `ADULT_DOWNLOADER_TYPE` values.
- Require all three category target aliases for automatic import.
- Validate `ADULT_STATE_DIR` is configured and writable before starting the monitor.
- Validate target paths after resolution and ensure imports stay inside the selected alias root.
- Ignore or reject unknown site names with an actionable error; choose one policy and document it in implementation.
- Never include password values, local paths, or raw environment values in thrown errors, tool details, Pi session entries, or long-lived state.
