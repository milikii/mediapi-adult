# Pi API Reference for MediaPi Adult

**Official Documentation**: https://pi.dev/docs/latest/extensions  
**Local Copy**: [PI_EXTENSIONS.md](PI_EXTENSIONS.md)

This document narrows the Pi extension API down to the patterns MediaPi Adult should use.

## Current Status

The extension currently registers the planned `adult_*` tools, starts/stops a monitor shell, and returns `not_implemented` from tool execution. This is intentional for the greenfield baseline.

## APIs Used

| API | Purpose |
| --- | --- |
| `pi.registerTool()` | Register `adult_*` tools. |
| `pi.appendEntry()` | Persist conversational workflow events, search snapshots, import/cleanup summaries, and same-session idempotency markers. |
| `ctx.sessionManager.getEntries()` | Reconstruct session-local state and check same-session idempotency. |
| `pi.on("session_start")` | Rebuild in-memory state and start one background monitor interval. |
| `pi.on("session_shutdown")` | Stop monitor timers before reload, quit, new session, or resume. |
| `ctx.ui.confirm()` / `ctx.ui.input()` | Confirm direct magnets as adult content and collect missing code/no-code information when UI is available. |
| `ctx.ui.notify()` / `ctx.ui.setStatus()` | Notify monitor status, import failures, conflicts, and cleanup failures. |

Prefer native `fetch` for downloader HTTP APIs. Use shell execution only if an integration cannot be implemented safely through direct APIs.

## Tool Registration Pattern

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "../utils/schema";

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

- Tool parameter schemas must match TypeScript parameter types.
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

Normal operation is monitor-driven after `adult_add_download` or `adult_register_download`. `adult_import` and `adult_cleanup` are retry/recovery tools.

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

If UI confirmation is unavailable, the agent should ask in chat instead of silently adding the magnet.

## Session Persistence

Use `pi.appendEntry(customType, data)` for state that belongs to the current conversation and should survive reloads or retries.

```typescript
pi.appendEntry("adult_task_event", {
  task_id: "adult-task-abc123",
  event: "registered",
  code: "SSIS-843",
  code_status: "coded",
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

```text
ADULT_STATE_DIR/
  tasks.jsonl
  completed.jsonl
```

Active task state should include enough information for monitor recovery:

```json
{
  "task_id": "adult-task-abc123",
  "status": "downloading",
  "downloader": "qbittorrent",
  "downloader_id": "hash123",
  "infohash": "abc...def",
  "code": "SSIS-843",
  "code_status": "coded",
  "display_title": "SSIS-843 ...",
  "target_alias": "censored",
  "dedupe_override": false,
  "created_at": 1781280000000,
  "updated_at": 1781280000000
}
```

Completed history should be long-lived and dedupe-oriented:

```json
{
  "key_type": "code",
  "key": "SSIS-843",
  "code": "SSIS-843",
  "code_status": "coded",
  "infohash": "abc...def",
  "display_title": "SSIS-843 ...",
  "target_alias": "censored",
  "import_id": "import-abc123",
  "completed_at": 1781280000000
}
```

For user-confirmed no-code content, use infohash as the key and store a display title.

Do not store real source paths, real target paths, or downloader credentials in local state.

## Idempotency and Dedupe Pattern

Side-effecting tools must check two things before calling external services:

1. Same-session idempotency for repeated tool calls.
2. Long-lived completed history for duplicate adult content.

Completed-history dedupe is blocking by default. A user can explicitly override it for one task, and that override must be recorded in active task state.

## Monitor Pattern

The extension uses Node timers for in-process monitoring.

```typescript
let monitorTimer: NodeJS.Timeout | undefined;

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
```

The monitor must process only active tasks from local state and must be idempotent across repeated ticks.
