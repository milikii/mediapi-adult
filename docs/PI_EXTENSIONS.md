# Pi Extensions - Official Documentation

**Source**: https://pi.dev/docs/latest/extensions  
**Saved**: 2026-06-09  
**Version**: Latest

---

Extensions are TypeScript modules that extend pi's behavior. They can subscribe to lifecycle events, register custom tools callable by the LLM, add commands, and more.

**Placement for /reload**: Put extensions in `~/.pi/agent/extensions/` (global) or `.pi/extensions/` (project-local) for auto-discovery. Use `pi -e ./path.ts` only for quick tests. Extensions in auto-discovered locations can be hot-reloaded with `/reload`.

## Key Capabilities

- **Custom tools** - Register tools the LLM can call via `pi.registerTool()`
- **Event interception** - Block or modify tool calls, inject context, customize compaction
- **User interaction** - Prompt users via `ctx.ui` (select, confirm, input, notify)
- **Custom UI components** - Full TUI components with keyboard input via `ctx.ui.custom()` for complex interactions
- **Custom commands** - Register commands like `/mycommand` via `pi.registerCommand()`
- **Session persistence** - Store state that survives restarts via `pi.appendEntry()`
- **Custom rendering** - Control how tool calls/results and messages appear in TUI

## Example Use Cases

- Permission gates (confirm before rm -rf, sudo, etc.)
- Git checkpointing (stash at each turn, restore on branch)
- Path protection (block writes to .env, node_modules/)
- Custom compaction (summarize conversation your way)
- Conversation summaries (see summarize.ts example)
- Interactive tools (questions, wizards, custom dialogs)
- Stateful tools (todo lists, connection pools)
- External integrations (file watchers, webhooks, CI triggers)
- Games while you wait (see snake.ts example)

See `examples/extensions/` for working implementations.

---

## Quick Start

Create `~/.pi/agent/extensions/my-extension.ts`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // React to events
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  // Register a custom tool
  pi.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone by name",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });

  // Register a command
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}!`, "info");
    },
  });
}
```

Test with `--extension` (or `-e`) flag:

```bash
pi -e ./my-extension.ts
```

---

## Extension Locations

**Security**: Extensions run with your full system permissions and can execute arbitrary code. Only install from sources you trust.

Extensions are auto-discovered from trusted locations. Project-local `.pi/extensions` entries load only after the project is trusted.

| Location | Scope |
|----------|-------|
| `~/.pi/agent/extensions/*.ts` | Global (all projects) |
| `~/.pi/agent/extensions/*/index.ts` | Global (subdirectory) |
| `.pi/extensions/*.ts` | Project-local |
| `.pi/extensions/*/index.ts` | Project-local (subdirectory) |

Additional paths via `settings.json`:

```json
{
  "packages": [
    "npm:@foo/bar@1.0.0",
    "git:github.com/user/repo@v1"
  ],
  "extensions": [
    "/path/to/local/extension.ts",
    "/path/to/local/extension/dir"
  ]
}
```

---

## Available Imports

| Package | Purpose |
|---------|---------|
| `@earendil-works/pi-coding-agent` | Extension types (ExtensionAPI, ExtensionContext, events) |
| `typebox` | Schema definitions for tool parameters |
| `@earendil-works/pi-ai` | AI utilities (StringEnum for Google-compatible enums) |
| `@earendil-works/pi-tui` | TUI components for custom rendering |

npm dependencies work too. Add a `package.json` next to your extension (or in a parent directory), run `npm install`, and imports from `node_modules/` are resolved automatically.

Node.js built-ins (`node:fs`, `node:path`, etc.) are also available.

---

## Writing an Extension

An extension exports a default factory function that receives `ExtensionAPI`. The factory can be synchronous or asynchronous:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Subscribe to events
  pi.on("event_name", async (event, ctx) => {
    // ctx.ui for user interaction
    const ok = await ctx.ui.confirm("Title", "Are you sure?");
    ctx.ui.notify("Done!", "info");
    ctx.ui.setStatus("my-ext", "Processing...");  // Footer status
    ctx.ui.setWidget("my-ext", ["Line 1", "Line 2"]);  // Widget above editor
  });

  // Register tools, commands, shortcuts, flags
  pi.registerTool({ ... });
  pi.registerCommand("name", { ... });
  pi.registerShortcut("ctrl+x", { ... });
  pi.registerFlag("my-flag", { ... });
}
```

Extensions are loaded via jiti, so TypeScript works without compilation.

---

## Events Lifecycle

```
pi starts
  │
  ├─► project_trust (user/global and CLI extensions only)
  ├─► session_start { reason: "startup" }
  └─► resources_discover { reason: "startup" }
      │
      ▼
user sends prompt ─────────────────────────────────────────┐
  │                                                        │
  ├─► input (can intercept, transform, or handle)          │
  ├─► before_agent_start (inject message, modify prompt)   │
  ├─► agent_start                                          │
  │   ┌─── turn (repeats while LLM calls tools) ───┐       │
  │   ├─► turn_start                               │       │
  │   ├─► context (can modify messages)            │       │
  │   │   LLM responds, may call tools:            │       │
  │   │     ├─► tool_execution_start               │       │
  │   │     ├─► tool_call (can block)              │       │
  │   │     ├─► tool_result (can modify)           │       │
  │   │     └─► tool_execution_end                 │       │
  │   └─► turn_end                                 │       │
  └─► agent_end                                            │
                                                           │
user sends another prompt ◄────────────────────────────────┘

/new or /resume
  ├─► session_before_switch (can cancel)
  ├─► session_shutdown
  └─► session_start { reason: "new" | "resume" }

exit
  └─► session_shutdown
```

---

## Key Events

### session_start

Fired when a session is started, loaded, or reloaded.

```typescript
pi.on("session_start", async (event, ctx) => {
  // event.reason - "startup" | "reload" | "new" | "resume" | "fork"
  // Restore in-memory state from session entries
  const entries = ctx.sessionManager.getEntries();
});
```

### tool_call

Fired before tool executes. Can block execution.

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
    const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
    if (!ok) return { block: true, reason: "Blocked by user" };
  }
});
```

### tool_result

Fired after tool execution finishes. Can modify result.

```typescript
pi.on("tool_result", async (event, ctx) => {
  // Modify result before sending to LLM
  return { content: [...], details: {...}, isError: false };
});
```

### session_shutdown

Fired before extension runtime is torn down.

```typescript
pi.on("session_shutdown", async (event, ctx) => {
  // event.reason - "quit" | "reload" | "new" | "resume" | "fork"
  // Cleanup resources
});
```

---

## ExtensionContext

All event handlers receive `ctx: ExtensionContext`.

### ctx.sessionManager

Read-only access to session state:

```typescript
ctx.sessionManager.getEntries()       // All entries
ctx.sessionManager.getBranch()        // Current branch
ctx.sessionManager.getLeafId()        // Current leaf entry ID
```

### ctx.signal

The current agent abort signal, or `undefined` when no agent turn is active.

```typescript
pi.on("tool_result", async (event, ctx) => {
  const response = await fetch("https://example.com/api", {
    signal: ctx.signal,  // Abort-aware
  });
});
```

### ctx.ui

User interaction methods:

```typescript
// Dialogs
await ctx.ui.select("Pick:", ["A", "B", "C"]);
await ctx.ui.confirm("Delete?", "Are you sure?");
await ctx.ui.input("Name:", "placeholder");
await ctx.ui.editor("Edit:", "prefilled");

// Non-blocking
ctx.ui.notify("Done!", "info");
ctx.ui.setStatus("my-ext", "Processing...");
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
```

---

## ExtensionAPI Methods

### pi.registerTool(definition)

Register a custom tool callable by the LLM.

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does (shown to LLM)",
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Stream progress
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });

    return {
      content: [{ type: "text", text: "Done" }],  // Sent to LLM
      details: { result: "..." },                  // For state & rendering
    };
  },
});
```

**Important**: Use `StringEnum` from `@earendil-works/pi-ai` for enums (Google API compatibility).

**Signaling errors**: Throw an error from `execute` to mark as failed:

```typescript
async execute(toolCallId, params) {
  if (!isValid(params.input)) {
    throw new Error(`Invalid input: ${params.input}`);
  }
  return { content: [{ type: "text", text: "OK" }], details: {} };
}
```

### pi.appendEntry(customType, data?)

Persist extension state (does NOT participate in LLM context).

```typescript
pi.appendEntry("my-state", { count: 42 });

// Restore on reload
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // Reconstruct from entry.data
    }
  }
});
```

### pi.registerCommand(name, options)

Register a command.

```typescript
pi.registerCommand("stats", {
  description: "Show session statistics",
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} entries`, "info");
  }
});
```

### pi.exec(command, args, options?)

Execute a shell command.

```typescript
const result = await pi.exec("git", ["status"], { signal, timeout: 5000 });
// result: { stdout, stderr, code, killed }
```

### pi.sendMessage(message, options?)

Inject a custom message into the session.

```typescript
pi.sendMessage({
  customType: "my-extension",
  content: "Message text",
  display: true,
  details: { ... },
}, {
  triggerTurn: true,
  deliverAs: "steer",
});
```

---

## State Management Pattern

Extensions with state should store it in tool result details for proper branching support:

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  // Reconstruct state from session
  pi.on("session_start", async (_event, ctx) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && entry.message.role === "toolResult") {
        if (entry.message.toolName === "my_tool") {
          items = entry.message.details?.items ?? [];
        }
      }
    }
  });

  pi.registerTool({
    name: "my_tool",
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      items.push("new item");
      return {
        content: [{ type: "text", text: "Added" }],
        details: { items: [...items] },  // Store for reconstruction
      };
    },
  });
}
```

---

## Extension Styles

### Single file

```
~/.pi/agent/extensions/
└── my-extension.ts
```

### Directory with index.ts

```
~/.pi/agent/extensions/
└── my-extension/
    ├── index.ts        # Entry point
    ├── tools.ts        # Helper module
    └── utils.ts
```

### Package with dependencies

```
~/.pi/agent/extensions/
└── my-extension/
    ├── package.json
    ├── package-lock.json
    ├── node_modules/
    └── src/
        └── index.ts
```

```json
// package.json
{
  "name": "my-extension",
  "dependencies": {
    "zod": "^3.0.0"
  },
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

Run `npm install` in the extension directory, then imports from `node_modules/` work automatically.

---

## Mode Behavior

| Mode | ctx.mode | ctx.hasUI | Notes |
|------|----------|-----------|-------|
| Interactive | `"tui"` | `true` | Full TUI |
| RPC | `"rpc"` | `true` | Dialogs via JSON protocol |
| JSON | `"json"` | `false` | Event stream; UI no-ops |
| Print | `"print"` | `false` | Extensions run but can't prompt |

Use `ctx.mode === "tui"` before TUI-specific features. Use `ctx.hasUI` before dialogs.

---

## Error Handling

- Extension errors are logged, agent continues
- `tool_call` errors block the tool (fail-safe)
- Tool `execute` errors must be signaled by throwing

---

## Examples Reference

All examples in `examples/extensions/`.

| Example | Description | Key APIs |
|---------|-------------|----------|
| `hello.ts` | Minimal tool registration | `registerTool` |
| `todo.ts` | Stateful tool with persistence | `registerTool`, `appendEntry`, session events |
| `permission-gate.ts` | Block dangerous commands | `on("tool_call")`, `ui.confirm` |
| `status-line.ts` | Footer status indicator | `setStatus` |
| `with-deps/` | Extension with npm dependencies | Package structure |

---

**For full documentation, visit**: https://pi.dev/docs/latest/extensions

**End of Pi Extensions Official Documentation**
