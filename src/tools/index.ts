import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AdultRuntime } from "../runtime";
import { Type } from "../utils/schema";

type ToolSpec = {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
};

const plannedTools: ToolSpec[] = [
  {
    name: "adult_search",
    label: "Adult Search",
    description: "Search public adult BT resources and metadata.",
    parameters: Type.Object({
      query: Type.String({ minLength: 1 }),
      sites: Type.Optional(Type.Array(Type.String())),
    }),
  },
  {
    name: "adult_get_resources",
    label: "Adult Get Resources",
    description: "Resolve or re-display resources from a search result.",
    parameters: Type.Object({
      result_id: Type.Optional(Type.String({ minLength: 1 })),
      source: Type.Optional(Type.String({ minLength: 1 })),
      magnet: Type.Optional(Type.String({ minLength: 1 })),
    }),
  },
  {
    name: "adult_add_download",
    label: "Adult Add Download",
    description: "Add a confirmed adult magnet to the dedicated downloader.",
    parameters: Type.Object({
      magnet: Type.String({ minLength: 1 }),
      idempotency_key: Type.String({ minLength: 1 }),
      code: Type.Optional(Type.String({ minLength: 1 })),
      no_code_confirmed: Type.Optional(Type.Boolean()),
      display_title: Type.Optional(Type.String({ minLength: 1 })),
      target_alias: Type.Optional(Type.String({ minLength: 1 })),
      dedupe_override: Type.Optional(Type.Boolean()),
    }),
  },
  {
    name: "adult_register_download",
    label: "Adult Register Download",
    description: "Register an existing dedicated-downloader task for monitoring.",
    parameters: Type.Object({
      downloader_id: Type.Optional(Type.String({ minLength: 1 })),
      infohash: Type.Optional(Type.String({ minLength: 1 })),
      magnet: Type.Optional(Type.String({ minLength: 1 })),
      code: Type.Optional(Type.String({ minLength: 1 })),
      no_code_confirmed: Type.Optional(Type.Boolean()),
      display_title: Type.Optional(Type.String({ minLength: 1 })),
      target_alias: Type.Optional(Type.String({ minLength: 1 })),
      dedupe_override: Type.Optional(Type.Boolean()),
    }),
  },
  {
    name: "adult_import",
    label: "Adult Import",
    description: "Retry importing a registered task into a configured alias.",
    parameters: Type.Object({
      task_id: Type.String({ minLength: 1 }),
      target_alias: Type.Optional(Type.String({ minLength: 1 })),
    }),
  },
  {
    name: "adult_cleanup",
    label: "Adult Cleanup",
    description: "Retry cleanup for a task after import/history success.",
    parameters: Type.Object({
      task_id: Type.String({ minLength: 1 }),
      force: Type.Optional(Type.Boolean()),
    }),
  },
];

export function registerAdultTools(
  pi: ExtensionAPI,
  _runtime: AdultRuntime
): void {
  for (const tool of plannedTools) {
    pi.registerTool({
      ...tool,
      async execute() {
        return {
          content: [
            {
              type: "text",
              text: `${tool.name} is not implemented in the new greenfield baseline yet.`,
            },
          ],
          details: {
            status: "not_implemented",
            tool: tool.name,
          },
          isError: true,
        };
      },
    });
  }
}

export function plannedToolNames(): string[] {
  return plannedTools.map((tool) => tool.name);
}
