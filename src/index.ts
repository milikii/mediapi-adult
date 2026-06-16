import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAdultRuntime } from "./runtime";
import { plannedToolNames, registerAdultTools } from "./tools";

export default function (pi: ExtensionAPI): void {
  const runtime = createAdultRuntime();

  pi.on("session_start", async (_event, ctx) => {
    const started = runtime.monitor.start((error) => {
      ctx.ui.notify(`MediaPi Adult monitor error: ${redactError(error)}`, "error");
    });

    ctx.ui.notify(
      started
        ? "MediaPi Adult loaded; monitor started."
        : "MediaPi Adult loaded.",
      "info"
    );
  });

  pi.on("session_shutdown", async () => {
    runtime.monitor.stop();
  });

  registerAdultTools(pi, runtime);
  console.log(
    `MediaPi Adult greenfield baseline loaded (${plannedToolNames().length} tools registered)`
  );
}

function redactError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
