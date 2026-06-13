# Pi API Reference for MediaPi Adult

**Official Documentation**: https://pi.dev/docs/latest/extensions

**Local Copy**: [PI_EXTENSIONS.md](PI_EXTENSIONS.md)

This document narrows the Pi extension API down to the patterns MediaPi Adult should use.

## APIs Used

| API | Purpose |
| --- | --- |
| `pi.registerTool()` | Register `adult_*` tools. |
| `pi.appendEntry()` | Persist conversational workflow events, search snapshots, import/cleanup summaries, and tool idempotency markers. |
| `ctx.sessionManager.getEntries()` | Reconstruct session-local state and check same-session idempotency. |
| `pi.on("session_start")` | Rebuild in-memory caches and start one background monitor interval. |
| `pi.on("session_shutdown")` | Stop monitor timers before reload, quit, new session, or resume. |
| `ctx.ui.confirm()` / `ctx.ui.input()` | Confirm direct magnets as adult content and collect missing code/no-code information when UI is available. |
| `ctx.ui.notify()` / `ctx.ui.setStatus()` | Notify import failures, conflicts, cleanup failures, and monitor status. |
| `pi.exec()` | Optional shell bridge for clients that cannot use direct HTTP APIs. Prefer native `fetch` for downloader HTTP APIs. |

## Tool Registration Pattern

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "../src/utils/schema";

export function registerAdultSearchTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "adult_search",
    label: "Adult Search",
    description: "Search public adult BT resources and JAV metadata by code or query",
    parameters: Type.Object({
      query: Type.String({ minLength: 1 }),
      sites: Type.Optional(Type.Array(Type.String())),
    }),
    async execute(_toolCallId, params, signal, onUpdate, _ctx) {
      onUpdate?.({
        content: [{ type: "text", text: "Searching enabled public adult BT sites..." }],
      });

      const result = await searchAdultResources(params, { signal });

      return {
        content: [{ type: "text", text: formatAdultSearchCard(result) }],
        details: result,
      };
    },
  });
}
```

Key requirements:

- Tool parameter schemas are JSON-schema-compatible objects. The current implementation uses a local `Type` helper to avoid runtime npm dependencies inside Pi containers.
- Tool result text is user-facing and must redact local paths.
- `details` may contain workflow data, but must not contain credentials or real local paths.
- Pass `signal` to network requests where possible.
- Side-effecting tools must check same-session idempotency and long-lived completed history before mutating the downloader.

## Planned Tool Parameters

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
  target_alias?: string;
  dedupe_override?: boolean;
})

adult_register_download({
  downloader_id?: string;
  infohash?: string;
  magnet?: string;
  code?: string;
  no_code_confirmed?: boolean;
  display_title?: string;
  target_alias?: string;
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

Normal operation is monitor-driven after `adult_add_download` or `adult_register_download`. `adult_import` and `adult_cleanup` remain available for manual retry and recovery.

## Direct Magnet Confirmation

When a user pastes a magnet directly, MediaPi Adult must ask whether it is an adult resource before calling `adult_add_download`.

```typescript
const isAdult = await ctx.ui.confirm(
  "Adult download?",
  "Should this magnet enter the MediaPi Adult workflow?"
);

if (!isAdult) {
  return {
    content: [{ type: "text", text: "This magnet was not added to MediaPi Adult." }],
    details: { handled: false },
  };
}
```

If `ctx.hasUI` is false, the agent should ask in chat instead of silently adding the magnet.

## Session Persistence

Use `pi.appendEntry(customType, data)` for state that belongs to the current conversation and should survive reloads or retries.

```typescript
pi.appendEntry("adult_task_event", {
  task_id: "adult-task-abc123",
  event: "registered",
  code: "SSIS-843",
  target_alias: "censored",
  downloader: "qbittorrent",
  downloader_id: "hash123",
  created_at: Date.now(),
});
```

For imports, persist redacted paths only:

```typescript
pi.appendEntry("adult_import", {
  import_id: "import-abc123",
  task_id: "adult-task-abc123",
  target_alias: "censored",
  source_path: "[REDACTED]",
  target_path: "[REDACTED]",
  strategy: "hardlink",
  files_imported: 1,
  imported_at: Date.now(),
});
```

## Local State Files

Use `ADULT_STATE_DIR` for cross-session task and history state.

Recommended files:

```text
ADULT_STATE_DIR/
  tasks.jsonl
  completed.jsonl
```

Active task state should include enough information for monitor recovery:

```typescript
{
  task_id: "adult-task-abc123",
  status: "downloading",
  downloader: "qbittorrent",
  downloader_id: "hash123",
  infohash: "abc...def",
  code: "SSIS-843",
  code_status: "coded",
  display_title: "SSIS-843 ...",
  target_alias: "censored",
  dedupe_override: false,
  created_at: 1781280000000,
  updated_at: 1781280000000
}
```

Completed history should be long-lived and dedupe-oriented:

```typescript
{
  key_type: "code",
  key: "SSIS-843",
  code: "SSIS-843",
  code_status: "coded",
  infohash: "abc...def",
  display_title: "SSIS-843 ...",
  target_alias: "censored",
  import_id: "import-abc123",
  completed_at: 1781280000000
}
```

For user-confirmed no-code content, use infohash as the key and store a display title:

```typescript
{
  key_type: "infohash",
  key: "abc...def",
  code_status: "no_code_confirmed",
  display_title: "User confirmed title",
  target_alias: "no_code",
  import_id: "import-def456",
  completed_at: 1781280000000
}
```

Do not store real source paths, real target paths, or downloader credentials in local state.

## Idempotency and Dedupe Pattern

Side-effecting tools must check two things before calling external services:

1. Same-session idempotency for repeated tool calls.
2. Long-lived completed history for duplicate adult content.

```typescript
function findPriorEntry(ctx, customType: string, idempotencyKey: string) {
  return ctx.sessionManager.getEntries().find((entry) => {
    return (
      entry.type === "custom" &&
      entry.customType === customType &&
      entry.data?.idempotency_key === idempotencyKey
    );
  });
}
```

Completed-history dedupe is blocking by default. A user can explicitly override it for one task, and that override must be recorded in active task state.

## Monitor Pattern

The extension may use Node timers for in-process monitoring.

```typescript
let monitorTimer: NodeJS.Timeout | undefined;

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!monitorTimer && runtime.config.monitorEnabled) {
      monitorTimer = setInterval(() => {
        runtime.monitor.tick().catch((error) => {
          ctx.ui.notify(`Adult monitor error: ${redactError(error)}`, "error");
        });
      }, runtime.config.monitorIntervalMs);
    }
  });

  pi.on("session_shutdown", async () => {
    if (monitorTimer) clearInterval(monitorTimer);
    monitorTimer = undefined;
  });
}
```

Implementation requirements:

- Start at most one interval per extension runtime.
- Process only tasks recorded in local active task state.
- Do not mutate arbitrary downloader tasks.
- Make state transitions idempotent and retryable.
- Notify the user on `import_failed`, `import_conflict`, and `cleanup_failed` when UI is available.

## External Calls

Prefer direct HTTP calls with `fetch` for site adapters and downloader APIs:

```typescript
const response = await fetch(url, {
  signal,
  headers: {
    "User-Agent": "MediaPi-Adult/0.1",
  },
});
```

Requirements:

- Use timeouts for external sites and downloader APIs.
- Never log passwords or full environment-derived URLs containing credentials.
- Return partial search results when one public BT or metadata adapter fails.
- Throw tool errors only after redacting sensitive details.

## User-Facing Formatting

Search cards should be compact and actionable:

```text
[SSIS-843] Japanese or translated title
Maker: S1 NO.1 STYLE
Date: 2023-08-18 | Duration: 175 min
Actors: ...

Resources:
1. sukebei | 8.9 GB | seeders: 7
   magnet:?xt=urn:btih:...
```

Avoid local paths in all import and cleanup output:

```text
Import complete
Target: censored
Strategy: hardlink
Path: [hidden]
```

## Verification Checklist

- [ ] Read [PI_EXTENSIONS.md](PI_EXTENSIONS.md).
- [ ] Register all planned tools from `src/index.ts`.
- [ ] Validate TypeBox schemas against TypeScript types.
- [ ] Test direct magnet adult confirmation before add-download.
- [ ] Test completed-history dedupe before external downloader calls.
- [ ] Test same-session idempotency before repeated side effects.
- [ ] Test monitor start/stop does not create duplicate intervals.
- [ ] Test import target alias routing and redaction.
- [ ] Test path redaction in `content`, `details`, Pi session entries, and local state.
- [ ] Test partial adapter failure behavior.
