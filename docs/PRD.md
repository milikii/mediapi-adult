# Product Requirements - MediaPi Adult

## Summary

MediaPi Adult is a Pi TypeScript extension for adult public-BT task intake and automation. It accepts adult tasks from search results, confirmed direct magnets, and existing tasks in a dedicated adult downloader. Registered tasks are monitored while Pi is running, imported into configured category directories after completion, recorded in completed history, and cleaned from the downloader.

The product is a workflow controller. It is not a standalone search page, downloader UI, media player, PT workflow, Prowlarr client, or database-backed service.

## Current Implementation State

The repository is a greenfield baseline for this PRD.

Existing code only provides:

- Extension entrypoint.
- Latest configuration model.
- Canonical domain types.
- Monitor lifecycle shell.
- Planned tool registration with `not_implemented` tool bodies.

No old retention workflow, raw import-root workflow, or partial downloader/importer implementation is supported.

## Goals

- Provide a chat-first adult BT workflow through Pi.
- Accept adult tasks through search, direct magnet confirmation, and adoption of existing downloader tasks.
- Use public BT site adapters only; never use Prowlarr or PT indexers.
- Keep adult public-BT downloads on a dedicated downloader instance separate from PT/viewing downloads.
- Monitor registered adult tasks automatically while Pi is running.
- Import completed tasks into configured category aliases without exposing real local paths.
- Clean downloader tasks and temporary downloader files only after import and completed-history write succeed.
- Persist completed history across Pi sessions for dedupe by normalized JAV code or confirmed no-code infohash.

## Non-Goals

- No standalone HTTP server, web UI, Docker stack, database server, or media player.
- No Prowlarr, PT indexer, or PT/viewing workflow integration.
- No shared runtime dependency on `mediapi-viewing`.
- No automatic takeover of arbitrary magnets before adult confirmation.
- No seeding or retention window after import.
- No encryption claim for Pi session storage, local state files, or magnet transport.

## MVP Scope

Phase 1 must implement:

- `adult_search` using public BT sites, initially Sukebei, with metadata lookup when available.
- Direct magnet intake that asks the user to confirm adult content before entering this workflow.
- `adult_add_download` for confirmed adult magnets.
- `adult_register_download` for existing tasks in the dedicated adult downloader.
- qBittorrent and Transmission support behind a shared downloader interface.
- Local active-task registry outside Pi session state.
- Local completed history outside Pi session state.
- Background monitor started and stopped by Pi extension lifecycle events.
- Automatic import into configured target aliases.
- Automatic cleanup after import and history write succeed.
- Recovery tools for import and cleanup retry.
- Path and credential redaction in user-facing output, Pi session entries, and long-lived state.

Phase 1 may defer:

- Additional BT adapters beyond Sukebei.
- JavBus magnet adapter, Tokyo Toshokan adapter, and JavLibrary fallback metadata.
- Real translation service.
- System daemonization outside Pi.
- Rich TUI custom rendering.
- Advanced metadata routing beyond required aliases.

## Entrances

### Search Entrance

- Accept a free-text query, usually a JAV code.
- Normalize obvious JAV code casing for metadata and dedupe.
- Query enabled public BT adapters concurrently.
- Query metadata adapters independently from BT results.
- Return partial results when one external source fails.
- Display enough resource detail for the user to select a result.
- Check completed history before adding a selected result when a code or no-code infohash key is available.

### Direct Magnet Entrance

- A pasted magnet must not be assumed to be adult content.
- The extension must ask whether the magnet belongs in the adult workflow.
- If the user says no, the extension must not add, persist, or forward the magnet.
- If the user confirms adult content, parse display name and infohash when available.
- If a JAV code cannot be extracted, ask for a code or explicit no-code confirmation.

### Adoption Entrance

- Register an existing task already present in the dedicated adult downloader.
- Identify the task by downloader ID, infohash, or magnet.
- Confirm or collect adult workflow metadata before monitoring.
- Check completed history unless a one-task override is explicitly requested.
- Never mutate unregistered downloader tasks.

## Lifecycle

Registered tasks follow this lifecycle:

1. `registered`: known to MediaPi Adult and assigned adult workflow metadata.
2. `downloading`: downloader reports incomplete selected content.
3. `completed`: downloader reports selected content complete.
4. `importing`: files are being hardlinked or copied into the routed target alias.
5. `imported`: import succeeded and completed history has been written.
6. `cleaned`: downloader task and temporary downloader data were removed.

Failure states:

- `duplicate_blocked`: completed history already contains the same normalized code or no-code infohash.
- `needs_code`: no JAV code was detected and no no-code confirmation exists.
- `import_failed`: import failed; downloader task and files remain for retry.
- `import_conflict`: target file or task directory conflict; downloader task and files remain for manual handling.
- `cleanup_failed`: import and history succeeded, but downloader cleanup failed.

## Dedupe

- Completed-history dedupe is blocking by default.
- Primary key is normalized JAV code, such as `SSIS-843`.
- Confirmed no-code content uses infohash as the key.
- Title matching may warn but must not silently block by itself.
- A user may explicitly override dedupe for one task, and the override must be recorded on that task.
- Pi session idempotency prevents repeated tool retries, but it is not a substitute for completed history.

## Import Routing

Import targets are aliases, not raw paths in chat or persistent workflow records.

Required aliases:

- `censored`: coded censored JAV.
- `uncensored`: coded uncensored JAV.
- `no_code`: no-code adult content and coded content whose category cannot be determined reliably.

Routing rules:

- Explicit user target alias at task creation or adoption wins.
- Otherwise, reliable metadata/category detection chooses `censored` or `uncensored`.
- Missing code or unreliable category routes to `no_code`.
- There is no default `unknown` holding area.

Directory layout:

- Coded tasks: `<target-root>/<NORMALIZED-CODE>/<original filename>`.
- No-code tasks: `<no-code-root>/<sanitized-display-title>-<short-infohash>/<original filename>`.
- The importer must never overwrite existing target files.
- Target-root validation must resolve paths before checking containment.

## Background Monitoring

- The extension starts one in-process monitor when loaded, if enabled.
- The monitor processes only tasks recorded in local adult task state.
- It must not mutate arbitrary downloader tasks.
- Poll interval is configurable.
- `session_shutdown` stops timers.
- Monitoring runs only while Pi is running and the extension is loaded.

## Persistence

Use two layers:

- Pi session entries for current conversation events, tool idempotency, search snapshots, and user-visible workflow events.
- Local JSONL state files for active task registry and completed history across Pi sessions.

Recommended files:

```text
ADULT_STATE_DIR/tasks.jsonl
ADULT_STATE_DIR/completed.jsonl
```

Local state may store normalized code, no-code status, infohash, display title, target alias, import ID, task status, timestamps, downloader ID/hash, dedupe override flag, and non-sensitive error summaries.

Local state must not store real source paths, real target paths, downloader credentials, or raw secret-bearing environment values.

## Functional Requirements

### Download and Registration

- Accept a confirmed adult magnet and caller-provided idempotency key.
- Check same-session idempotency before side effects.
- Check completed history before adding or registering a task.
- Add torrents only to the configured adult downloader instance.
- Persist an active task record for monitor pickup.

### Import

- Resolve completed torrent content paths through the downloader client.
- Choose target alias through explicit input or routing rules.
- Preserve original filenames inside the task directory.
- Prefer hardlink; fall back to copy when hardlink is not possible.
- Never overwrite existing target files.
- Persist only redacted source/target fields and target alias.

### Cleanup

- Cleanup is automatic after successful import and completed-history write.
- No seeding retention window exists.
- Manual cleanup is for `cleanup_failed` recovery.
- Cleanup removes downloader task and temporary downloader data, never imported library files.

## Quality Requirements

- `npm run build` must pass.
- Unit tests must cover each implemented service before it becomes part of the happy path.
- Tool parameter schemas and TypeScript types must stay aligned.
- Tool calls must respect Pi abort signals where practical.
- External HTTP calls must use timeouts.
- Adapter failures must be isolated so one broken public site does not fail the whole search.
- Background monitor operations must be idempotent and retryable.
- Import failure and conflict handling must preserve source data.
- Errors must be actionable and must not expose secrets or local paths.

## Acceptance Criteria

- Pi can load the extension and start/stop the monitor without duplicate intervals.
- Searching a known code returns metadata and at least one public-BT magnet when external sites are reachable.
- Direct magnet intake requires adult confirmation before adding anything.
- Completed-history dedupe blocks a known completed code unless explicitly overridden.
- Existing downloader tasks can be registered without mutating unrelated tasks.
- A completed registered task imports into the configured alias and task folder.
- Successful import writes completed history before cleanup.
- Cleanup removes downloader task and temporary downloader files after history write succeeds.
- Import failures and conflicts do not trigger cleanup.
- User-facing output, Pi session entries, and local state never contain real paths or credentials.
