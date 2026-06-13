# Architecture - MediaPi Adult

## Overview

MediaPi Adult is a single Pi TypeScript extension that controls an adult public-BT workflow. Pi owns chat transport, agent execution, user interaction, and session persistence. This repository owns adult task intake, site adapters, dedicated downloader clients, background monitoring, import/cleanup automation, and long-lived local dedupe state.

```text
User chat
  -> Pi runtime
  -> MediaPi Adult extension
  -> adult_* tools and direct-magnet confirmation
  -> public BT adapters, metadata adapters, dedicated downloader client
  -> local active-task state
  -> in-process monitor
  -> importer, completed history, downloader cleanup
```

The extension should not start its own HTTP server or require a database server. Background automation is an in-process monitor that runs only while Pi has loaded the extension.

## Runtime Boundaries

- `src/index.ts` registers tools, lifecycle handlers, and monitor start/stop hooks.
- `src/tools/*` contains Pi tool definitions and user-facing formatting.
- `src/adapters/*` coordinates public BT and metadata adapters.
- `src/clients/bt-sites/*` fetches public-BT magnet results.
- `src/clients/metadata/*` fetches JAV metadata.
- `src/clients/qbittorrent.ts` and `src/clients/transmission.ts` call the dedicated adult downloader instance.
- `src/services/importer.ts` imports completed files into configured target aliases.
- `src/services/completed-history.ts` should own cross-session dedupe state.
- `src/services/task-registry.ts` should own active adult task state for monitor pickup.
- `src/services/monitor.ts` should poll registered tasks and advance the lifecycle.
- `src/services/translator.ts` provides optional text translation and must degrade to source text when unavailable.

MediaPi Adult must not depend on `mediapi-viewing` runtime code, Prowlarr, or PT indexers.

## Data Flow

### Search-to-Download

1. `adult_search` receives `query` and optional site names.
2. Query is normalized for metadata and JAV-code dedupe.
3. Public BT registries search enabled adapters concurrently.
4. Metadata registry queries available metadata adapters independently.
5. Tool combines metadata and magnet results into one card.
6. User selects a result.
7. `adult_add_download` checks completed history by normalized code before adding.
8. Downloader factory creates the configured adult downloader client.
9. Client adds the torrent and returns downloader ID/hash.
10. Tool records an active adult task for monitor pickup.

### Direct Magnet

1. User pastes a magnet.
2. Extension asks whether this is an adult resource.
3. If user says no, MediaPi Adult stops without persisting or forwarding the magnet.
4. If user confirms adult content, the extension extracts infohash, display name, and possible code.
5. Missing code leads to user confirmation: provide a code or mark as no-code content.
6. Confirmed adult magnet enters the same `adult_add_download` path.

### Adopt Existing Downloader Task

1. `adult_register_download` or `adult_adopt_download` receives a downloader task ID, infohash, or magnet.
2. Tool resolves task metadata from the dedicated adult downloader.
3. Tool confirms or collects adult workflow metadata.
4. Tool checks completed history unless explicitly overridden.
5. Tool writes active task state.
6. Background monitor handles it like any other registered task.

### Background Monitor

1. `session_start` starts a single monitor interval if one is not already running.
2. Monitor reads active task state.
3. For each registered task, it queries downloader status.
4. Incomplete tasks remain registered/downloading.
5. Completed tasks move to import.
6. Import success writes completed history before cleanup.
7. Cleanup removes downloader task and temporary downloader data.
8. Failure states preserve source data and notify the user.
9. `session_shutdown` clears timers.

### Import and Cleanup

1. Importer resolves completed torrent files through the downloader client.
2. Target alias is selected from explicit task config or routing rules.
3. Coded tasks import to `<target-root>/<NORMALIZED-CODE>/`.
4. No-code tasks import to `<no-code-root>/<sanitized-display-title>-<short-infohash>/`.
5. Import uses hardlink-first and copy fallback.
6. Import never overwrites existing target files.
7. Completed history is written after import success.
8. Downloader cleanup runs only after history write succeeds.

## Public Tool Interfaces

Planned public tools:

```typescript
adult_search({
  query: string;
  sites?: string[];
})

adult_get_resources({
  result_id?: string;
  source?: string;
  magnet?: string;
})

adult_add_download({
  magnet: string;
  idempotency_key: string;
  code?: string;
  no_code_confirmed?: boolean;
  display_title?: string;
  target_alias?: "censored" | "uncensored" | "no_code" | string;
  dedupe_override?: boolean;
})

adult_register_download({
  downloader_id?: string;
  infohash?: string;
  magnet?: string;
  code?: string;
  no_code_confirmed?: boolean;
  display_title?: string;
  target_alias?: "censored" | "uncensored" | "no_code" | string;
  dedupe_override?: boolean;
})

adult_import({
  task_id: string;
  target_alias?: string;
})

adult_cleanup({
  task_id: string;
  force?: boolean;
})
```

`adult_import` and `adult_cleanup` remain useful for retry and recovery. The normal path is monitor-driven automatic import and cleanup.

## Core Types

`src/types.ts` should be the canonical source for shared domain types. Adapter-specific definitions should import from there instead of duplicating shape definitions.

Minimum shared shapes:

- `SearchResult`: `id`, `source`, `title`, `magnetUrl`, `sizeBytes`, `seeders`, `leechers`, `publishedAt`, optional `category`.
- `JAVMetadata`: normalized code, titles, actresses, maker, release date, duration, category, optional poster URL; fields from external sites should be nullable when missing.
- `AdultTask`: task ID, downloader name, downloader ID/hash, code or no-code status, display title, target alias, status, override flag, timestamps, and non-sensitive error summary.
- `CompletedHistoryItem`: normalized code or infohash key, code status, display title, target alias, import ID, completion timestamp, and optional source metadata.
- `ImportArtifact`: import ID, task ID, target alias, redacted source/target path fields, strategy, file count, timestamp.
- `CleanupRecord`: task ID, downloader ID/hash, deleted-files flag, timestamp, optional error summary.

## Persistence

Use two persistence layers.

### Pi Session Entries

Use `pi.appendEntry` for conversational state and idempotency:

- `adult_resource_snapshot`
- `adult_download`
- `adult_task_event`
- `adult_import`
- `adult_cleanup`

Pi session entries must not contain real local paths or credentials.

### Local State Files

Use a configured state directory for cross-session automation state:

- active task registry, for monitor pickup and retry.
- completed history, for dedupe across Pi sessions.

Recommended files:

- `ADULT_STATE_DIR/tasks.jsonl`
- `ADULT_STATE_DIR/completed.jsonl`

State writes should be append-only or atomic enough to tolerate process interruption. If a JSONL entry represents a state transition, reconstruction should use the latest entry per stable task key.

## Import Targets

Configured target aliases are required. MVP must support:

- `censored`
- `uncensored`
- `no_code`

Aliases resolve to local filesystem roots inside the extension only. User-facing output, Pi session details, and completed history should store aliases and redacted path placeholders, not full paths.

## Privacy Boundary

Allowed in session/tool details and local state:

- JAV code and display metadata.
- Magnet URL when needed for current workflow continuity.
- Infohash.
- Downloader ID/hash.
- Target alias.
- Redacted path placeholders.
- Task status, timestamps, dedupe override flag, and non-sensitive error summaries.

Forbidden in session/tool details and local state:

- Real source file path.
- Real target file path.
- Downloader credentials.
- Raw environment values containing secrets.

User-facing text must also redact local paths.

## Error Handling

- Return partial search results when one adapter fails.
- Throw from tool `execute` for hard failures after redacting sensitive details.
- Import failures move tasks to `import_failed` and preserve downloader files.
- Target conflicts move tasks to `import_conflict` and preserve downloader files.
- Cleanup failures move tasks to `cleanup_failed` after import/history success and can be retried.
- Monitor failures should be logged or notified without crashing the extension.

## Testing Strategy

- Unit-test parsers with static HTML/XML fixtures.
- Unit-test card formatting without network.
- Unit-test registry partial-failure behavior.
- Unit-test direct-magnet parsing and adult confirmation flow boundaries.
- Unit-test completed-history dedupe by code and infohash.
- Unit-test active task state reconstruction from local JSONL.
- Unit-test monitor lifecycle transitions with fake downloader clients.
- Unit-test import redaction, target alias routing, root validation, and conflict handling.
- Add opt-in integration tests for real Sukebei, JavBus, qBittorrent, and Transmission endpoints.
