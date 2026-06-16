# Architecture - MediaPi Adult

## Overview

MediaPi Adult is a single Pi TypeScript extension. Pi owns chat transport, agent execution, user interaction, session persistence, and extension lifecycle. This repository owns adult task intake, public BT adapters, dedicated downloader clients, local task state, completed-history dedupe, monitor orchestration, import, and cleanup.

```text
User chat
  -> Pi runtime
  -> MediaPi Adult extension
  -> adult_* tools and direct-magnet confirmation
  -> public BT adapters, metadata adapters, dedicated downloader client
  -> local active-task registry
  -> in-process monitor
  -> importer, completed history, downloader cleanup
```

The extension must not start its own HTTP server or require a database server. Background automation is an in-process monitor that runs only while Pi has loaded the extension.

## Current Baseline

Current code contains only the greenfield shell:

- `src/index.ts`: extension entrypoint, tool registration, monitor start/stop hooks.
- `src/config.ts`: latest environment configuration shape.
- `src/types.ts`: canonical domain types.
- `src/runtime.ts`: runtime wiring.
- `src/services/monitor.ts`: monitor lifecycle shell.
- `src/tools/index.ts`: planned tool registration with `not_implemented` bodies.
- `src/utils/schema.ts`: small JSON-schema helper for tool parameters.

No adapter, downloader, importer, completed-history, or task-registry implementation exists yet.

## Target Runtime Boundaries

The modules listed below are the planned target layout, not current code. Only `src/index.ts`, `src/tools/index.ts`, and `src/services/monitor.ts` exist today (see Current Baseline above); the others are not implemented yet.

- `src/index.ts` registers tools and lifecycle handlers.
- `src/tools/*` owns Pi tool definitions and user-facing formatting.
- `src/adapters/*` coordinates source registries without site-specific parsing.
- `src/clients/bt-sites/*` implements `bt_resource` source adapters that fetch public-BT magnet results.
- `src/clients/metadata/*` implements separate metadata source adapters that fetch JAV/adult metadata.
- `src/clients/qbittorrent.ts` and `src/clients/transmission.ts` call the dedicated adult downloader instance.
- `src/services/task-registry.ts` owns active adult task state.
- `src/services/completed-history.ts` owns cross-session dedupe state.
- `src/services/monitor.ts` polls registered tasks and advances lifecycle.
- `src/services/importer.ts` imports completed files into configured target aliases.

MediaPi Adult must not depend on `mediapi-viewing`, Prowlarr, or PT indexers.

## Data Flow

### Search to Download

1. `adult_search` receives `query` and optional `sites`.
2. Query is normalized for metadata and code dedupe.
3. Public BT resource registry searches enabled `bt_resource` adapters concurrently.
4. Metadata registry queries enabled metadata adapters independently.
5. Tool combines metadata and magnet results into one response.
6. User selects a result.
7. `adult_add_download` checks same-session idempotency and completed history.
8. Downloader client adds the torrent to the dedicated adult downloader.
9. Tool records an active adult task for monitor pickup.

### Direct Magnet

1. User pastes a magnet.
2. Extension asks whether it belongs to the adult workflow.
3. If no, MediaPi Adult stops without persisting or forwarding the magnet.
4. If yes, it extracts infohash, display name, and possible code.
5. Missing code requires either user-provided code or explicit no-code confirmation.
6. Confirmed adult magnet enters `adult_add_download`.

### Adopt Existing Downloader Task

1. `adult_register_download` receives downloader ID, infohash, or magnet.
2. Tool resolves task metadata from the dedicated adult downloader.
3. Tool confirms or collects adult workflow metadata.
4. Tool checks completed history unless explicitly overridden.
5. Tool writes active task state.
6. Monitor handles it like any other registered task.

### Background Monitor

1. `session_start` starts one monitor interval if enabled and not already running.
2. Monitor reads active task state.
3. For each registered task, it queries downloader status.
4. Incomplete tasks remain `downloading`.
5. Completed tasks move to import.
6. Import success writes completed history.
7. Cleanup removes downloader task and temporary downloader data.
8. Failure states preserve source data and notify the user.
9. `session_shutdown` clears timers.

## Public Tool Interfaces

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
  target_alias?: "censored" | "uncensored" | "no_code";
  dedupe_override?: boolean;
})

adult_register_download({
  downloader_id?: string;
  infohash?: string;
  magnet?: string;
  code?: string;
  no_code_confirmed?: boolean;
  display_title?: string;
  target_alias?: "censored" | "uncensored" | "no_code";
  dedupe_override?: boolean;
})

adult_import({
  task_id: string;
  target_alias?: "censored" | "uncensored" | "no_code";
})

adult_cleanup({
  task_id: string;
  force?: boolean;
})
```

Normal operation is monitor-driven after task registration. `adult_import` and `adult_cleanup` are recovery tools.

## Persistence

Use two persistence layers.

### Pi Session Entries

Use `pi.appendEntry` for conversational and same-session state:

- `adult_resource_snapshot`
- `adult_task_event`
- `adult_import`
- `adult_cleanup`
- idempotency markers for side-effecting calls

Pi session entries must not contain real local paths or credentials.

### Local State Files

Use `ADULT_STATE_DIR` for cross-session automation state:

- `tasks.jsonl`: active and failed task state.
- `completed.jsonl`: long-lived completed history.

State writes should be append-only or atomic enough to tolerate process interruption. Reconstruction should use the latest entry per stable task key.

## Import Targets

MVP target aliases:

- `censored`
- `uncensored`
- `no_code`

Aliases resolve to local filesystem roots inside the extension only. User-facing output, Pi session details, and completed history store aliases and redacted path placeholders, not full paths.

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
- Raw secret-bearing environment values.

## Error Handling

- Return partial search results when one adapter fails.
- Throw from tool execution for hard failures after redacting sensitive details.
- Import failures move tasks to `import_failed` and preserve downloader files.
- Target conflicts move tasks to `import_conflict` and preserve downloader files.
- Cleanup failures move tasks to `cleanup_failed` after import/history success and can be retried.
- Monitor failures notify or log without crashing the extension.

## Testing Strategy

- Unit-test code normalization and magnet parsing.
- Unit-test registry partial-failure behavior.
- Unit-test completed-history dedupe by code and infohash.
- Unit-test active task reconstruction from JSONL.
- Unit-test monitor lifecycle transitions with fake downloader clients.
- Unit-test import redaction, alias routing, root validation, and conflict handling.
- Add opt-in integration tests for real Sukebei, JavBus, qBittorrent, and Transmission endpoints.
