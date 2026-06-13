# Product Requirements - MediaPi Adult

## Summary

MediaPi Adult is a Pi TypeScript extension for always-available adult public-BT task intake and automation. It lets a user search adult BT sites, submit a magnet directly, or adopt an existing task in a dedicated adult downloader. Registered tasks are then monitored in the Pi extension process, automatically imported into configured category directories after completion, cleaned from the downloader, and recorded in a long-lived completed history to prevent duplicate JAV-code downloads.

The product is a workflow controller, not a standalone search page or downloader UI.

## Goals

- Provide a chat-first adult BT workflow through Pi.
- Accept adult tasks from three entrances: search result, direct magnet after user confirmation, and adoption of an existing downloader task.
- Use only public BT site adapters for adult resource discovery; never use Prowlarr or PT indexers.
- Keep adult BT downloads on a dedicated downloader instance separate from PT/viewing downloads.
- Monitor registered adult tasks automatically while the Pi extension is running.
- Import completed tasks into configured category roots without exposing real local paths in chat, Pi session entries, or long-lived history.
- Clean downloader tasks and temporary downloader files after a successful import and completed-history write.
- Persist long-lived completed history across Pi sessions for dedupe by normalized JAV code, with infohash fallback for confirmed no-code content.

## Non-goals

- No standalone HTTP server, web UI, Docker stack, database server, or media player.
- No Prowlarr, PT indexer, or PT/viewing workflow integration.
- No shared runtime dependency on `mediapi-viewing`.
- No automatic takeover of arbitrary magnets before the user confirms they are adult resources.
- No seeding/retention workflow for adult BT tasks after import.
- No claim that Pi session storage, local state files, or magnet transport are encrypted by this extension.

## Users and Jobs

Primary user:

- A Pi user who wants to submit adult BT tasks from chat at any time, keep them separate from PT/viewing downloads, and have completed files automatically organized and cleaned up.

Core jobs:

- Search a JAV code or adult query and quickly choose a useful public-BT resource.
- Paste a magnet and explicitly confirm whether it belongs to the adult workflow.
- Register an already-added adult downloader task so the extension can take over automation.
- Avoid downloading the same JAV code again across Pi sessions.
- Automatically import completed files into category-specific directories.
- Remove downloader tasks and temporary data after import succeeds.
- Get notified when import, routing, or file conflicts require manual handling.

## MVP Scope

Phase 1 must implement or preserve these product contracts:

- `adult_search` using public BT sites, initially Sukebei, plus metadata lookup when available.
- Direct magnet intake that asks the user to confirm adult content before entering this workflow.
- `adult_add_download` for confirmed adult magnets, with completed-history dedupe before adding.
- `adult_register_download` or `adult_adopt_download` for existing tasks in the adult downloader.
- A dedicated adult downloader configuration for qBittorrent or Transmission.
- A background monitor started by the Pi extension while Pi is running.
- Automatic import of completed registered tasks into configured target aliases.
- Automatic cleanup of downloader task and temporary downloader data only after import and completed-history write succeed.
- Long-lived local completed history outside Pi session state.
- Path redaction in user-facing output, Pi session custom entries, and long-lived state.
- Failure states for import errors and file conflicts that preserve downloader data and notify the user.

Phase 1 may defer:

- Additional BT adapters beyond Sukebei.
- JavBus magnet adapter, Tokyo Toshokan adapter, and JavLibrary fallback metadata.
- Real translation service.
- System-level daemonization outside Pi.
- Rich TUI custom rendering.
- Advanced metadata-based routing beyond the required category aliases.

## Entrances

### Search Entrance

- Accept a free-text query, usually a JAV code.
- Normalize obvious JAV code casing for metadata and dedupe.
- Query enabled public BT adapters concurrently.
- Query metadata adapters independently from BT results.
- Return partial results when one external source fails.
- Display enough resource detail for the user to select a result.
- Before adding a selected result, check completed history for the normalized code when available.

### Direct Magnet Entrance

- A pasted magnet must not be assumed to be adult content.
- The extension must ask the user whether the magnet is an adult resource.
- If the user says no, the adult extension must not add, persist, or forward the magnet; another extension may handle it.
- If the user confirms adult content, parse the magnet display name and infohash when available and continue through the adult workflow.
- If a JAV code cannot be extracted from the magnet name or later downloader metadata, ask the user to provide one or explicitly confirm that the item has no code.

### Adoption Entrance

- Allow the user to register an existing task already present in the dedicated adult downloader.
- Registration may identify the task by downloader ID, infohash, or magnet.
- The extension must confirm or collect adult workflow metadata before monitoring the task.
- Registered tasks enter the same lifecycle as tasks added through `adult_add_download`.
- Unregistered downloader tasks must not be modified.

## Lifecycle

Registered tasks follow this lifecycle:

1. `registered`: task is known to MediaPi Adult and belongs to the adult workflow.
2. `downloading`: downloader reports incomplete content.
3. `completed`: downloader reports all selected files complete.
4. `importing`: importer is copying or hardlinking files into the routed target directory.
5. `imported`: files are present in the import target and completed history has been written.
6. `cleaned`: downloader task and temporary downloader data have been removed.

Failure states:

- `duplicate_blocked`: completed history already contains the same normalized code or infohash and no override was given.
- `needs_code`: no JAV code could be detected and the user has not confirmed a no-code item.
- `import_failed`: import failed; downloader task and files must remain for retry.
- `import_conflict`: target files or task directory already exist; downloader task and files must remain for manual handling.
- `cleanup_failed`: import and history succeeded, but downloader cleanup failed; user should be notified and cleanup can be retried.

## Dedupe

- Completed-history dedupe is blocking by default.
- Primary dedupe key is normalized JAV code, such as `SSIS-843`.
- For content confirmed by the user to have no code, fallback dedupe key is infohash.
- Title matching may warn but must not silently block by itself.
- A user may explicitly override dedupe for a single task; the override must be recorded on that task.
- Pi session idempotency still prevents duplicate tool retries, but it is not a substitute for long-lived completed history.

## Import Routing

Import targets are configured as aliases, not raw paths in chat.

Required aliases:

- `censored`: coded censored JAV.
- `uncensored`: coded uncensored JAV.
- `no_code`: no-code adult content, and coded content whose category cannot be determined reliably.

Routing rules:

- Explicit user target alias at task creation or adoption wins.
- Otherwise, metadata/category detection chooses `censored` or `uncensored` when reliable.
- If there is no code or category cannot be determined reliably, route to `no_code`.
- There is no default `unknown` holding area in MVP.

Directory layout:

- Coded tasks: `<target-root>/<NORMALIZED-CODE>/<original filename>`.
- No-code tasks: `<no-code-root>/<sanitized-display-title>-<short-infohash>/<original filename>`.
- The importer must never overwrite existing target files.
- Target-root validation must resolve paths before checking containment.

## Background Monitoring

- The extension should start an in-process monitor when the Pi extension loads.
- The monitor only processes tasks recorded in local adult task state.
- It must not mutate arbitrary downloader tasks that were not registered.
- Poll interval is configurable.
- On `session_shutdown`, the extension should stop its interval/timers.
- This is Pi-runtime automation: if Pi is not running or the machine is sleeping, monitoring does not run.

## Persistence

Use two layers:

- Pi session entries for current conversation state, tool idempotency, search snapshots, and user-visible workflow events.
- Long-lived local state files for active task registry and completed history across Pi sessions.

Long-lived state must not store real full local paths. It may store:

- Normalized code or no-code status.
- Infohash.
- Display title.
- Target alias.
- Import ID.
- Task status and timestamps.
- Downloader ID/hash.
- Non-sensitive error summaries.

It must not store:

- Real source file paths.
- Real target file paths.
- Downloader credentials.
- Raw environment values containing secrets.

## Functional Requirements

### Download and Registration

- Accept a confirmed adult magnet and caller-provided idempotency key.
- Check long-lived completed history before adding or registering a task.
- Check Pi session entries before repeating a side-effecting tool call.
- Add torrents only to the configured adult downloader instance.
- Persist an active task record for monitor pickup.

### Import

- Resolve completed torrent content paths through the downloader client.
- Choose the target alias through explicit user input or routing rules.
- Preserve original filenames inside the task directory.
- Prefer hardlink; fall back to copy when hardlink is not possible.
- Never overwrite existing target files.
- Persist only redacted source/target fields and target alias.

### Cleanup

- Cleanup is automatic after successful import and completed-history write.
- No seeding retention window is required for adult BT tasks.
- Manual cleanup remains useful for `cleanup_failed` recovery.
- Cleanup must remove the downloader task and temporary downloader data, not imported library files.

## Quality Requirements

- Tool calls must respect the Pi abort signal where practical.
- External HTTP calls must use timeouts.
- Adapter failures must be isolated so one broken public BT site does not fail the whole search.
- Error messages should be actionable and avoid exposing secrets or paths.
- Types and TypeBox parameter schemas must stay aligned.
- Background monitor operations must be idempotent and retryable.
- Import failure and conflict handling must preserve source data.

## Acceptance Criteria

- `npm run build` passes.
- A Pi session can load the extension and start/stop the monitor without duplicate intervals.
- Searching a known code returns metadata and at least one public-BT magnet when external sites are reachable.
- A direct magnet requires adult confirmation before `adult_add_download` executes.
- A known completed code in completed history blocks a new download unless explicitly overridden.
- A registered completed task imports into the configured category alias and task folder.
- After successful import and completed-history write, the downloader task and temporary downloader data are removed.
- Import failures and file conflicts do not trigger cleanup and notify the user.
- User-facing output, Pi session entries, and long-lived history never contain real local paths or credentials.
