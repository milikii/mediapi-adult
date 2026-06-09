# Pi API Reference

**Official Documentation**: https://pi.dev/docs/latest/extensions

**Local Copy**: [PI_EXTENSIONS.md](PI_EXTENSIONS.md) (full official documentation)

---

## Quick Reference

### APIs Used in MediaPi

| API | Purpose | Official Doc Section |
|-----|---------|---------------------|
| `pi.registerTool()` | Register custom tools (viewing_*, adult_*) | ExtensionAPI Methods > pi.registerTool |
| `pi.appendEntry()` | Persist download monitors, import artifacts | ExtensionAPI Methods > pi.appendEntry |
| `ctx.sessionManager.getEntries()` | Restore state from session | ExtensionContext > ctx.sessionManager |
| `pi.on("session_start")` | Rebuild in-memory cache on startup | Events > Session Events |
| `pi.on("tool_call")` | Idempotency key checks | Events > Tool Events |
| `pi.exec()` | Call external services (Prowlarr, qBittorrent) | ExtensionAPI Methods > pi.exec |

---

## Core Patterns

### 1. Tool Registration

```typescript
import { Type } from "typebox";

pi.registerTool({
  name: "viewing_search_media",
  label: "Search Media",
  description: "Search movies/series via Prowlarr + TMDB",
  parameters: Type.Object({
    query: Type.String(),
    media_type: Type.Union([Type.Literal("movie"), Type.Literal("series")]),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    return {
      content: [{ type: "text", text: "Found 5 results" }],
      details: { results: [...] },
    };
  },
});
```

**Key Points**:
- Use `typebox` for parameter schemas
- `execute()` returns `{ content, details }`
- `signal` for cancellation support
- `onUpdate()` for streaming progress

### 2. State Persistence (D033: Pi Session State)

```typescript
// Persist download monitor
pi.appendEntry("viewing_download", {
  idempotency_key: "pi-20260608-abc123",
  download_id: "hash123",
  infohash: "abc...def",
  status: "active",
  retention_until: Date.now() + 7 * 24 * 3600 * 1000,
});

// Restore on session start
pi.on("session_start", async (_event, ctx) => {
  const entries = ctx.sessionManager.getEntries();
  const downloads = entries.filter(
    e => e.type === "custom" && e.customType === "viewing_download"
  );
  
  for (const dl of downloads) {
    activeDownloads.set(dl.data.download_id, dl.data);
  }
});
```

**Key Points**:
- Sessions persist to `.pi/sessions/*.jsonl`
- Use `customType` to namespace entries
- Rebuild in-memory state in `session_start`

### 3. Idempotency (D021: Tools Must Be Idempotent)

```typescript
async function executeIdempotent<T>(
  ctx: ExtensionContext,
  idempotencyKey: string,
  customType: string,
  executor: () => Promise<T>
): Promise<T> {
  // Check session for prior execution
  const entries = ctx.sessionManager.getEntries();
  const existing = entries.find(
    e => e.type === "custom" &&
    e.customType === customType && 
    e.data?.idempotency_key === idempotencyKey
  );
  
  if (existing) return existing.data.result;
  
  // Execute and persist
  const result = await executor();
  pi.appendEntry(customType, {
    idempotency_key: idempotencyKey,
    result,
    executed_at: Date.now(),
  });
  
  return result;
}
```

**Key Points**:
- Check `idempotency_key` before side effects
- Store result in session entry
- Retry returns cached result

### 4. External Service Calls

```typescript
// Execute shell command
const result = await pi.exec("curl", [
  "-X", "POST",
  `${PROWLARR_URL}/api/v1/search`,
  "-H", `X-Api-Key: ${PROWLARR_API_KEY}`,
  "-d", JSON.stringify({ query: "Inception" }),
], { signal });

// result: { stdout, stderr, code, killed }
```

**Key Points**:
- Pass `signal` from tool context
- Handle `code !== 0` as error
- Parse `stdout` for JSON responses

---

## Example Correspondence

| MediaPi Feature | Official Example |
|----------------|------------------|
| Viewing extension (9 tools) | `examples/extensions/todo.ts` (stateful tools) |
| Adult extension (npm deps) | `examples/extensions/with-deps/` (package structure) |
| BT site adapters | Custom module pattern (no direct example) |
| Resource handles (encryption) | Custom implementation |

---

## Session Lifecycle

```
pi starts
  ├─► session_start { reason: "startup" }
  └─► resources_discover { reason: "startup" }

user: "下载电影 Inception 2010"
  ├─► input (can intercept)
  ├─► before_agent_start (can inject context)
  ├─► agent_start
  ├─► turn_start
  │   ├─► tool_call (check idempotency_key)
  │   ├─► tool_execution_start
  │   ├─► tool_result
  │   └─► tool_execution_end
  ├─► turn_end
  └─► agent_end

/new or /resume
  ├─► session_shutdown
  └─► session_start { reason: "new" | "resume" }

exit
  └─► session_shutdown
```

---

## Verification Checklist

Before implementing:

- [ ] Read [PI_EXTENSIONS.md](PI_EXTENSIONS.md) fully
- [ ] Review `examples/extensions/todo.ts` (state management)
- [ ] Review `examples/extensions/with-deps/` (npm dependencies)
- [ ] Understand session persistence (`.pi/sessions/*.jsonl`)
- [ ] Test minimal extension with `pi -e ./test.ts`

---

## References

- **Full Official Docs**: [PI_EXTENSIONS.md](PI_EXTENSIONS.md)
- **Online**: https://pi.dev/docs/latest/extensions
- **TypeBox**: https://github.com/sinclairzx81/typebox
- **Pi TUI Components**: https://pi.dev/docs/latest/tui-components
