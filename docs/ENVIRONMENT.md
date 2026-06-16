# Environment Configuration

## Overview

MediaPi Adult reads configuration from environment variables. `.env.example` documents the supported values, but runtime loading depends on how Pi starts the extension. If Pi does not load `.env` automatically, start Pi from a shell where these variables are exported.

The adult downloader must be a dedicated qBittorrent or Transmission instance. Do not point these variables at the PT/viewing downloader instance.

## Required Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ADULT_DOWNLOADER_TYPE` | Yes | `qbittorrent` | Dedicated adult downloader backend: `qbittorrent` or `transmission`. |
| `ADULT_STATE_DIR` | Yes | none | Local state directory for active tasks and completed history. |
| `ADULT_IMPORT_TARGET_CENSORED` | Yes | none | Root directory for coded censored JAV imports. |
| `ADULT_IMPORT_TARGET_UNCENSORED` | Yes | none | Root directory for coded uncensored JAV imports. |
| `ADULT_IMPORT_TARGET_NO_CODE` | Yes | none | Root directory for no-code or uncertain-category adult imports. |
| `ADULT_ENABLED_SITES` | No | `sukebei` | Comma-separated public BT resource source names. |

`ADULT_IMPORT_ROOT` and `ADULT_RETENTION_DAYS` are not supported by the new workflow.

## qBittorrent Variables

Required when `ADULT_DOWNLOADER_TYPE=qbittorrent` and downloader calls are implemented:

| Variable | Default | Description |
| --- | --- | --- |
| `ADULT_QB_URL` | `http://localhost:8081` | Dedicated adult qBittorrent Web API URL. |
| `ADULT_QB_USERNAME` | none | qBittorrent username. |
| `ADULT_QB_PASSWORD` | none | qBittorrent password. |

## Transmission Variables

Required when `ADULT_DOWNLOADER_TYPE=transmission` and downloader calls are implemented:

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

Only public BT resource source adapters belong in `ADULT_ENABLED_SITES`. Do not configure metadata-only sources, Prowlarr, Jackett, or PT indexers for this extension.

When metadata source selection is implemented, it must use a separate variable such as `ADULT_ENABLED_METADATA_SOURCES`. A website that supports both metadata and magnets should still expose those capabilities through separate adapter families.

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

The extension stores only aliases and redacted paths in user-facing output, Pi session entries, and local state.

## Local State

Recommended files under `ADULT_STATE_DIR`:

- `tasks.jsonl`: active and failed task state for monitor pickup and retries.
- `completed.jsonl`: long-lived completed history for dedupe.

State files may store codes, infohashes, display titles, target aliases, status, timestamps, import IDs, and non-sensitive error summaries. They must not store real source paths, real target paths, or downloader credentials.

## Translation

| Variable | Required | Description |
| --- | --- | --- |
| `TRANSLATE_API_KEY` | No | Optional translation service key. MVP may ignore this and return source text. |

Translation must degrade gracefully. Search should still work when no translation key exists.

## Validation Rules

- Reject unknown `ADULT_DOWNLOADER_TYPE` values.
- Require `ADULT_STATE_DIR`.
- Require all three category target aliases.
- Require monitor interval to be at least one second.
- Validate target paths after resolution and ensure imports stay inside the selected alias root.
- Reject unknown `ADULT_ENABLED_SITES` names with an actionable error when the BT source registry is created.
- Keep metadata source configuration separate from `ADULT_ENABLED_SITES`.
- Never include password values, local paths, or raw environment values in thrown errors, tool details, Pi session entries, or local state.
