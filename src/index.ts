/**
 * MediaPi Adult Extension Entry Point
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("MediaPi Adult Extension loaded", "info");
  });

  // TODO: Register tools
  // pi.registerTool(createAdultSearchTool(...));
  // pi.registerTool(createAddDownloadTool(...));
  // pi.registerTool(createImportTool(...));
  // pi.registerTool(createCleanupTool(...));
}
