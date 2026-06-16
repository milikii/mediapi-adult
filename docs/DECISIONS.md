# Architecture Decision Records - MediaPi Adult Extension

This document records active architecture and product decisions for MediaPi Adult.

---

## Active Decisions

### D030: TypeScript Extensions over Python Backend

**Status**: ACTIVE

**Decision**: Use TypeScript Pi extensions instead of a Python FastAPI backend.

**Reason**:

- Pi native extension system is TypeScript-first.
- Eliminates Docker, HTTP server, and port management for MVP.
- Simpler deployment through Pi extension loading.
- In-process execution is enough for chat tools and lightweight monitoring.
- Native Pi session state remains useful for tool idempotency and conversation events.

**Applies to**: Adult Extension

---

### D032: Public BT Site Adapters Only

**Status**: ACTIVE

**Decision**: Adult resource discovery uses public BT site adapters for downloadable resources. It must not use Prowlarr or PT indexers.

**Design**:

- `BTSiteAdapter` interface for public BT search.
- Adapter registry for multi-site management.
- One TypeScript file per site, such as `sukebei.ts`.
- Progressive expansion: Sukebei first, then additional public BT sites.
- BT resource adapters return normalized public resource results and must not add downloads, write task state, decide dedupe, or perform import/cleanup.

**Reason**:

- Adult BT resource settings differ from PT/viewing resource settings.
- PT trackers and Prowlarr belong to a separate viewing workflow.
- Public site failures can be isolated by adapter.

**Applies to**: Search and resource discovery

---

### D033: Split Persistence Between Pi Session and Local State

**Status**: ACTIVE

**Decision**: Use Pi session entries for conversational workflow state, but use local state files for active task registry and completed history.

**Reason**:

- Pi session entries are good for tool idempotency, search snapshots, and visible workflow events.
- Completed-history dedupe must survive new Pi sessions, compaction, and conversation cleanup.
- Background monitoring needs a durable active-task registry independent of one chat turn.
- A database server is unnecessary for MVP; JSONL or equivalent local files are enough.

**Applies to**: Persistence, dedupe, monitor recovery

---

### D035: Separate Source Adapter Families

**Status**: ACTIVE

**Decision**: Treat downloadable BT resource sources and metadata sources as separate adapter families, even when one external website can provide both.

**Families**:

- `bt_resource`: public adult BT search sources that return magnets or public resource details.
- `metadata`: JAV/adult metadata sources that return work metadata, artwork, and category hints.

**Rules**:

- `ADULT_ENABLED_SITES` selects only `bt_resource` adapters.
- Metadata sources must use a separate registry and configuration key when enabled.
- Every new source must document a source profile: stable name, family, base URL env, capabilities, adult boundary, rate-limit policy, failure mode, and fixture coverage.
- BT adapters must not mutate downloader state, local task state, completed history, import targets, or Pi session entries.
- Metadata adapters must not return magnets as primary search results or decide final dedupe/import outcomes.

**Reason**:

- Prevents future source additions from mixing search, metadata enrichment, and workflow side effects.
- Keeps partial failures isolated by source family.
- Makes adapter contribution and review predictable before implementation expands beyond Sukebei/JavBus.

**Applies to**: Source adapter design, configuration, search registry

---

### D036: Rich Metadata Cards with Inline Resource Details

**Status**: ACTIVE

**Decision**: Adult search returns rich metadata cards with title, poster URL when available, metadata, and magnet/resource details.

**Implementation**:

- Concurrent search: public BT sites plus metadata adapters.
- Display resources inline for inspectability.
- Opaque handles are optional and should only be added when needed for reliable follow-up selection.

**Reason**:

- Users need enough context to select the right adult resource without switching tools.
- Inline magnet/resource details keep the chat workflow short.

**Applies to**: Search UX

---

### D037: Dedicated Adult Downloader Instance

**Status**: ACTIVE

**Decision**: MediaPi Adult uses an independently configured downloader instance and must not share the PT/viewing downloader instance.

**Configuration**:

```bash
ADULT_DOWNLOADER_TYPE=transmission   # or qbittorrent
ADULT_TR_URL=http://localhost:9092
ADULT_TR_USERNAME=transmission
ADULT_TR_PASSWORD=***
```

**Reason**:

- Adult public-BT resources and PT viewing resources have different connection, import, and cleanup settings.
- Adult tasks should be isolated operationally from PT/viewing tasks.
- Avoids any runtime dependency on `mediapi-viewing` downloader clients or state.

**Applies to**: Download, import, cleanup

---

### D038: Separate GitHub Repositories

**Status**: ACTIVE

**Decision**: Keep independent repositories:

- `mediapi-viewing`: PT viewing extension for movies/series.
- `mediapi-adult`: adult public-BT workflow extension.

**Reason**:

- Different target audiences and workflows.
- Independent evolution and deployment.
- Privacy and contribution boundaries.
- Adult extension should not re-couple to viewing code.

**Applies to**: Project structure

---

### D039: Real External-Link MVP

**Status**: ACTIVE

**Decision**: The MVP should use real public-BT, metadata, and downloader integrations instead of a mock-only prototype.

**Reason**:

- The largest product risk is external integration behavior.
- Real parsing and downloader semantics affect the public tool contract.
- Import and cleanup behavior depends on actual downloader file metadata.

**Constraints**:

- Unit tests should still use fixtures and fake clients.
- Real-site and real-downloader tests must be opt-in.
- External failures should degrade gracefully where partial results are useful.

**Applies to**: Phase 1 MVP

---

### D040: Direct Magnets Require Adult Confirmation

**Status**: ACTIVE

**Decision**: A pasted magnet is not automatically treated as adult content. The extension must ask the user whether it belongs to the adult workflow.

**Reason**:

- Magnets may belong to PT/viewing workflows or other extensions.
- MediaPi Adult must not hijack non-adult downloads.
- User confirmation is more reliable than guessing adult classification from magnet metadata.

**Implication**:

- If the user says no, MediaPi Adult does not persist, forward, or process the magnet.
- If the user confirms adult content, the magnet enters the adult add-download flow.

**Applies to**: Direct magnet intake

---

### D041: Explicit Privacy Boundary

**Status**: ACTIVE

**Decision**: The extension must redact local filesystem paths and credentials, while allowing workflow data such as JAV codes, magnets, infohashes, downloader IDs, target aliases, and timestamps when needed.

**Rules**:

- Never persist real source or target file paths in Pi session entries or long-lived state.
- Never return real local paths in user-facing tool text.
- Never include downloader credentials in errors, logs, details, or custom entries.
- Store target aliases instead of full paths in visible and persistent workflow records.
- Use `[REDACTED]` or `[hidden]` for path fields.

**Reason**:

- Path leakage is the primary local privacy risk in import and cleanup workflows.
- Workflow recovery needs enough non-path state to be useful.
- The extension does not implement encryption for Pi sessions, local state, or magnet transport.

**Applies to**: All tools, monitor, downloader clients, import service

---

### D042: No Seeding Retention for Adult BT Tasks

**Status**: ACTIVE

**Decision**: Adult tasks are temporary downloads. After successful import and completed-history write, the extension should remove the downloader task and temporary downloader data.

**Reason**:

- Adult public-BT workflow should not share PT seeding assumptions.
- The user wants the adult downloader kept clean after successful import.
- Imported library files are the retained output; downloader temporary data is not.

**Implication**:

- Manual cleanup remains a recovery tool, not the normal path.
- Cleanup must never delete imported library files.

**Applies to**: Import and cleanup lifecycle

---

### D043: In-Process Background Monitor

**Status**: ACTIVE

**Decision**: Start a lightweight in-process monitor from the Pi extension to poll registered adult tasks and advance them through completion, import, history write, and cleanup.

**Reason**:

- The desired user experience is automatic after task registration.
- Pi extension lifecycle supports `session_start` and `session_shutdown` hooks for starting and stopping timers.
- A separate daemon or server is unnecessary for MVP.

**Constraints**:

- Monitoring runs only while Pi is running and the extension is loaded.
- The monitor processes only tasks recorded in local adult task state.
- It must not mutate arbitrary downloader tasks that were not registered.
- Monitor transitions must be idempotent and retryable.

**Applies to**: Background automation

---

### D044: Completed-History Dedupe

**Status**: ACTIVE

**Decision**: Maintain a cross-session completed history that blocks duplicate downloads by default.

**Rules**:

- Primary key is normalized JAV code.
- For user-confirmed no-code content, fallback key is infohash.
- Title matching can warn but must not silently block.
- User can explicitly override a duplicate block for one task.
- Override must be recorded in active task state.

**Reason**:

- Prevents repeated downloads of the same code across Pi sessions.
- Pi session idempotency only protects a single tool-call retry pattern; it does not solve long-term dedupe.

**Applies to**: Download, adoption, completed history

---

### D045: Category Alias Import Routing

**Status**: ACTIVE

**Decision**: Import completed files through configured category aliases, not raw paths in chat.

**Required aliases**:

- `censored`
- `uncensored`
- `no_code`

**Directory layout**:

- Coded tasks: `<target-root>/<NORMALIZED-CODE>/<original filename>`.
- No-code tasks: `<no-code-root>/<sanitized-display-title>-<short-infohash>/<original filename>`.

**Routing**:

- Explicit task target alias wins.
- Reliable metadata may route coded tasks to `censored` or `uncensored`.
- No-code or uncertain-category tasks route to `no_code`.

**Reason**:

- Keeps real paths out of chat and state.
- Produces organized library directories automatically.
- Avoids an ambiguous `unknown` holding area in MVP.

**Applies to**: Import service and configuration

---

## Summary: Active Decisions

| ID | Decision | Applies To |
|----|----------|------------|
| D030 | TypeScript extensions | Architecture |
| D032 | Public BT site adapters only | Search |
| D033 | Split Pi session and local state | Persistence |
| D035 | Separate source adapter families | Source adapters |
| D036 | Rich metadata cards | Search UX |
| D037 | Dedicated adult downloader instance | Downloading |
| D038 | Separate repositories | Project structure |
| D039 | Real external-link MVP | Phase 1 |
| D040 | Direct magnets require adult confirmation | Intake |
| D041 | Explicit privacy boundary | All tools |
| D042 | No seeding retention | Cleanup |
| D043 | In-process background monitor | Automation |
| D044 | Completed-history dedupe | Dedupe |
| D045 | Category alias import routing | Import |
