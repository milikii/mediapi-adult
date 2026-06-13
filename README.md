# MediaPi Adult

Pi TypeScript extension for an adult public-BT workflow:

`search/adopt/confirm magnet -> register adult task -> monitor downloader -> auto-import -> cleanup downloader -> record completed history`

The extension is intended to be the always-available adult BT task intake and automation layer for Pi. It is not a standalone app, web UI, media player, or PT/Prowlarr workflow.

## Current Status

Implemented in the current codebase:

- Pi extension entrypoint in `src/index.ts`
- Shared domain types in `src/types.ts`
- Base BT site adapter interface in `src/clients/bt-sites/base.ts`
- Base JAV metadata adapter interface in `src/clients/metadata/base.ts`
- Runtime wiring in `src/runtime.ts`
- `adult_search`
- `adult_get_resources`
- `adult_add_download`
- `adult_import`
- `adult_cleanup`
- Sukebei BT search adapter
- JavBus metadata adapter
- qBittorrent and Transmission downloader clients
- Import service with hardlink-first/copy fallback and path redaction
- Unit tests for parser, import redaction/root validation, idempotency, and retention checks
- Environment template in `.env.example`

Product requirements now call for changes that are not fully implemented yet:

- Direct magnet adult confirmation before entering this workflow.
- Adoption of existing adult downloader tasks.
- Dedicated active-task registry in local state.
- Cross-session completed-history dedupe by normalized code or confirmed no-code infohash.
- In-process background monitor.
- Category alias import routing: `censored`, `uncensored`, `no_code`.
- Automatic cleanup after successful import and completed-history write.
- Removal of the old default 3-day retention/seeding model.

Known gaps:

- Parser robustness still depends on real Sukebei/JavBus HTML validation.
- Translation service is a pass-through placeholder.
- JavBus magnet, Tokyo Toshokan, and JavLibrary fallback adapters are not implemented.
- No Pi TUI custom rendering beyond plain text tool output.
- No real qBittorrent/Transmission integration test has been run in this workspace.
- The implementation still needs to be aligned with the updated PRD.

## Product Scope

MediaPi Adult is:

- A Pi extension loaded by Pi.
- A chat-operated adult public-BT task intake and automation workflow.
- Separate from `mediapi-viewing`, which handles PT/movie/series viewing workflows.
- Built around a dedicated adult downloader instance.

MediaPi Adult is not:

- A web UI.
- A general-purpose bot framework.
- A media player or library manager.
- A Prowlarr or PT-indexer client.
- A shared runtime dependency of `mediapi-viewing`.

See [Product Requirements](docs/PRD.md) for the complete product contract.

## Target Workflow

Phase 1 should support three adult task entrances:

1. Search a code or query with `adult_search`, then choose a public-BT result.
2. Paste a magnet, confirm it is adult content, then add it to the adult workflow.
3. Register/adopt an existing task from the dedicated adult downloader.

After a task is registered:

1. The extension records it in local active-task state.
2. The in-process background monitor polls the dedicated adult downloader while Pi is running.
3. When the task completes, the extension imports files into a configured category alias.
4. Coded tasks use `<category-root>/<NORMALIZED-CODE>/<original filename>`.
5. Confirmed no-code tasks use `<no-code-root>/<sanitized-display-title>-<short-infohash>/<original filename>`.
6. After import and completed-history write succeed, the extension removes the downloader task and temporary downloader data.
7. Completed history blocks future duplicate downloads by normalized code, or by infohash for confirmed no-code content.

## Tool Contract

The planned public tools are:

| Tool | Purpose | MVP status |
| --- | --- | --- |
| `adult_search` | Search public adult BT resources and render metadata card | Implemented, needs validation |
| `adult_get_resources` | Resolve or re-display resources from a prior search | Implemented |
| `adult_add_download` | Add a confirmed adult magnet to the dedicated downloader | Implemented, needs completed-history and new metadata fields |
| `adult_register_download` / `adult_adopt_download` | Register an existing downloader task for monitoring | Planned |
| `adult_import` | Import completed task into category alias with redacted output | Implemented, needs alias routing and task layout |
| `adult_cleanup` | Retry cleanup for recovery | Implemented as manual retention cleanup, needs new automatic-cleanup semantics |

See [Pi API Reference](docs/PI_API_REFERENCE.md) for parameter and persistence patterns.

## Architecture

The extension is designed around small modules:

```text
Pi runtime
  -> src/index.ts registers tools and lifecycle hooks
  -> tools accept/search/register adult tasks
  -> public BT adapters fetch magnet results
  -> metadata adapters fetch JAV details
  -> dedicated downloader clients call qBittorrent or Transmission
  -> local task registry and completed history persist cross-session state
  -> monitor advances completed tasks through import and cleanup
```

Key architecture docs:

- [Architecture](docs/ARCHITECTURE.md)
- [Architecture Decisions](docs/DECISIONS.md)
- [Pi Extensions Official Docs Copy](docs/PI_EXTENSIONS.md)

## Configuration

Start from the template:

```bash
cp .env.example .env
```

Important defaults and required values:

```bash
ADULT_DOWNLOADER_TYPE=qbittorrent
ADULT_QB_URL=http://localhost:8081
ADULT_TR_URL=http://localhost:9092
ADULT_STATE_DIR=/private/adult/.mediapi-adult-state
ADULT_IMPORT_TARGET_CENSORED=/private/adult/censored
ADULT_IMPORT_TARGET_UNCENSORED=/private/adult/uncensored
ADULT_IMPORT_TARGET_NO_CODE=/private/adult/no-code
ADULT_MONITOR_ENABLED=true
ADULT_MONITOR_INTERVAL_SECONDS=60
ADULT_ENABLED_SITES=sukebei
SUKEBEI_BASE_URL=https://sukebei.nyaa.si
JAVBUS_BASE_URL=https://www.javbus.com
```

The adult downloader should be a dedicated qBittorrent or Transmission instance. Do not point it at the PT/viewing downloader.

See [Environment Configuration](docs/ENVIRONMENT.md) for the full table and validation rules.

## Development

Install dependencies:

```bash
npm install
```

Compile:

```bash
npm run build
```

Run in Pi for quick extension loading tests:

```bash
pi -e ./src/index.ts
```

Command-level validation still requires running inside Pi with a configured dedicated downloader and network access to selected public BT/metadata sites.

## Planned Source Layout

```text
src/
  index.ts
  types.ts
  tools/
    search.ts
    get-resources.ts
    add-download.ts
    register-download.ts
    import.ts
    cleanup.ts
  adapters/
    magnet-registry.ts
    metadata-registry.ts
  clients/
    bt-sites/
      base.ts
      sukebei.ts
    metadata/
      base.ts
      javbus-metadata.ts
    downloader.ts
    qbittorrent.ts
    transmission.ts
    downloader-factory.ts
  services/
    completed-history.ts
    task-registry.ts
    monitor.ts
    importer.ts
    translator.ts
```

## Roadmap

Phase 1: align implementation with updated workflow

- [x] Implement Sukebei BT search.
- [x] Implement JavBus metadata lookup.
- [x] Implement qBittorrent and Transmission clients with a shared minimal interface.
- [x] Implement initial tool set.
- [x] Add tests for parsing, idempotency, redaction, and retention checks.
- [ ] Add direct magnet adult confirmation.
- [ ] Add local active-task registry and completed-history state.
- [ ] Add `adult_register_download` / `adult_adopt_download`.
- [ ] Add background monitor lifecycle.
- [ ] Add category alias import routing and task directory layout.
- [ ] Change cleanup semantics from retention-based to post-import automatic cleanup.
- [ ] Validate against real Pi, external sites, and a configured dedicated downloader.

Phase 2: multi-site expansion

- Add more public BT adapters.
- Add JavBus magnet adapter if useful.
- Add Tokyo Toshokan adapter.
- Add JavLibrary metadata fallback.
- Add adapter health/config tooling if operationally useful.

Phase 3: contributor framework

- Add BT adapter template.
- Add adapter test template.
- Publish contribution guide and issue templates.

## Privacy and Safety

The intended privacy boundary is strict:

- Real source and target file paths must never be written to Pi session entries or long-lived state.
- Tool result text should show `[REDACTED]` or `[hidden]` for local paths.
- Target aliases such as `censored`, `uncensored`, and `no_code` may be shown and persisted.
- Search queries, magnets, infohashes, downloader IDs, and task IDs may appear in session/tool data when needed for workflow continuity.
- Downloader credentials must never appear in errors, logs, details, or state files.
- The extension runs locally, but it calls configured external public BT/metadata sites and downloader APIs.
- No claim is made that Pi session storage, local state, or magnet transport is encrypted by this extension.

See [Architecture Decisions](docs/DECISIONS.md) for explicit privacy, downloader, monitoring, and dedupe decisions.

## Documentation

- [Product Requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Architecture Decisions](docs/DECISIONS.md)
- [BT Adapter Guide](docs/BT-ADAPTER-GUIDE.md)
- [Environment Configuration](docs/ENVIRONMENT.md)
- [Pi API Reference](docs/PI_API_REFERENCE.md)
- [Pi Extensions Official Docs Copy](docs/PI_EXTENSIONS.md)

## License

MIT License
