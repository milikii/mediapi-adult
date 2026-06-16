# MediaPi Adult

MediaPi Adult is a Pi TypeScript extension for adult public-BT task intake and automation:

`search or confirm magnet or adopt task -> register adult task -> monitor downloader -> import -> write completed history -> cleanup downloader data`

It is a workflow controller for Pi. It is not a web UI, media player, Prowlarr client, PT workflow, or shared runtime dependency for other MediaPi extensions.

## Current Status

This repository has been reset to a greenfield baseline for the latest product requirements.

Implemented now:

- Pi extension entrypoint in `src/index.ts`.
- Latest configuration shape in `src/config.ts`.
- Canonical domain types in `src/types.ts`.
- Monitor lifecycle shell in `src/services/monitor.ts`.
- Planned public tool surface registered in `src/tools/index.ts`.
- Baseline tests that guard against legacy `ADULT_IMPORT_ROOT` and retention behavior.

Intentionally not implemented yet:

- Public BT search adapters.
- JAV metadata adapters.
- qBittorrent and Transmission clients.
- Direct magnet confirmation flow.
- Active task registry and completed-history persistence.
- Download registration/adoption logic.
- Monitor task advancement.
- Import and cleanup orchestration.

The old partial implementation was removed. There is no supported legacy retention/seeding workflow and no raw import-root workflow.

## Quick Start

1. Install dependencies: `npm install`
2. Copy the environment template and set required variables:
   ```bash
   cp .env.example .env
   ```
   See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for the full list of required and optional variables.
3. Build and test:
   ```bash
   npm run build
   npm test
   ```
4. Load the extension in Pi:
   ```bash
   pi -e ./src/index.ts
   ```
   The extension loads, the monitor starts, and the six `adult_*` tools register but currently return `not_implemented` (see [Current Status](#current-status)).
5. To add a new BT site, follow [docs/BT-ADAPTER-GUIDE.md](docs/BT-ADAPTER-GUIDE.md).

## Product Contract

Phase 1 is defined by [docs/PRD.md](docs/PRD.md). The MVP must support three entrances:

1. Search a code or query with `adult_search`, then add a selected public-BT result.
2. Paste a magnet, confirm it is adult content, then add it to the adult workflow.
3. Register or adopt an existing task from the dedicated adult downloader.

After a task is registered:

1. The extension records it in local active-task state.
2. The in-process monitor polls only registered adult tasks while Pi is running.
3. Completed tasks are imported into a configured target alias.
4. Coded tasks use `<category-root>/<NORMALIZED-CODE>/<original filename>`.
5. Confirmed no-code tasks use `<no-code-root>/<sanitized-display-title>-<short-infohash>/<original filename>`.
6. Completed history is written after import succeeds.
7. Downloader task and temporary downloader files are removed only after import and history write succeed.
8. Future duplicate downloads are blocked by normalized code, or by infohash for confirmed no-code content.

## Public Tools

The extension registers the latest planned tool names, but tool bodies currently return `not_implemented`.

| Tool | Purpose |
| --- | --- |
| `adult_search` | Search public adult BT resources and metadata. |
| `adult_get_resources` | Resolve or re-display resources from a prior search. |
| `adult_add_download` | Add a confirmed adult magnet to the dedicated downloader. |
| `adult_register_download` | Register an existing downloader task for monitoring. |
| `adult_import` | Retry import for a registered task. |
| `adult_cleanup` | Retry cleanup after import/history success. |

## Configuration

Start from the template:

```bash
cp .env.example .env
```

Required values:

```bash
ADULT_DOWNLOADER_TYPE=qbittorrent
ADULT_STATE_DIR=/private/adult/.mediapi-adult-state
ADULT_IMPORT_TARGET_CENSORED=/private/adult/censored
ADULT_IMPORT_TARGET_UNCENSORED=/private/adult/uncensored
ADULT_IMPORT_TARGET_NO_CODE=/private/adult/no-code
ADULT_MONITOR_ENABLED=true
ADULT_MONITOR_INTERVAL_SECONDS=60
ADULT_ENABLED_SITES=sukebei
```

The adult downloader must be a dedicated qBittorrent or Transmission instance. Do not point this extension at the PT/viewing downloader.

`ADULT_ENABLED_SITES` is only for public BT resource sources that return magnets or public resource details. Metadata-only sources use a separate adapter family and must not be configured as BT sites. See [docs/BT-ADAPTER-GUIDE.md](docs/BT-ADAPTER-GUIDE.md) before adding any new source.

## Development

Install dependencies:

```bash
npm install
```

Compile:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Load in Pi for extension lifecycle checks:

```bash
pi -e ./src/index.ts
```

Business-flow validation will become meaningful after the adapter, downloader, registry, monitor, importer, and cleanup services are implemented.

## Source Layout

```text
src/
  index.ts
  config.ts
  runtime.ts
  types.ts
  tools/
    index.ts
  services/
    monitor.ts
  utils/
    schema.ts
```

Planned next modules:

```text
src/
  adapters/
    magnet-registry.ts
    metadata-registry.ts
  clients/
    bt-sites/     # bt_resource source adapters
    metadata/     # metadata source adapters
    downloader.ts
    qbittorrent.ts
    transmission.ts
  services/
    task-registry.ts
    completed-history.ts
    importer.ts
```

## Roadmap

Phase 1 implementation order:

- [x] Reset repository to latest greenfield baseline.
- [x] Define canonical types and configuration without legacy retention/import-root behavior.
- [x] Register the latest planned public tool surface.
- [ ] Implement JSONL active task registry.
- [ ] Implement JSONL completed history and dedupe checks.
- [ ] Implement downloader interface and qBittorrent/Transmission clients.
- [ ] Implement direct magnet parsing and adult confirmation boundaries.
- [ ] Implement `adult_add_download` and `adult_register_download`.
- [ ] Implement Sukebei search and JavBus metadata adapters.
- [ ] Implement monitor lifecycle transitions.
- [ ] Implement alias-routed importer.
- [ ] Implement post-import cleanup.
- [ ] Validate against Pi, external sites, and a dedicated downloader.

Phase 2:

- Add additional public BT adapters.
- Add JavBus magnet adapter if useful.
- Add Tokyo Toshokan adapter.
- Add JavLibrary metadata fallback.

Phase 3:

- Add adapter templates and contribution docs.
- Add opt-in integration test harnesses.

## Privacy Boundary

User-facing output, Pi session entries, and long-lived local state must never contain real source paths, real target paths, downloader credentials, or raw secret-bearing environment values.

Allowed workflow data includes normalized code, confirmed no-code status, infohash, display title, target alias, downloader ID/hash, task status, timestamps, import ID, and non-sensitive error summaries.
