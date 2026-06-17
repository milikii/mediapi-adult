import type { AdultTask, CompletedHistoryItem, ImportArtifact, CleanupRecord } from "../types";
import type { Downloader } from "../clients/downloader";
import { ImportConflictError, type ImportRequest } from "./importer";
import type { CleanupRequest } from "./cleanup";

// ---------------------------------------------------------------------------
// Dependency interfaces (narrower than the real service classes so test fakes
// can satisfy them without pulling in fs / network).
// ---------------------------------------------------------------------------

export interface LifecycleImporter {
  import(req: ImportRequest): ImportArtifact;
}

export interface LifecycleHistory {
  record(item: CompletedHistoryItem): void;
}

export interface LifecycleCleaner {
  cleanup(req: CleanupRequest): Promise<CleanupRecord>;
}

export interface AdvanceDeps {
  downloader: Downloader;
  importer: LifecycleImporter;
  history: LifecycleHistory;
  cleanup: LifecycleCleaner;
  now: number;
  importId: string;
}

export interface AdvanceResult {
  task: AdultTask;
  importArtifact?: ImportArtifact;
  cleanupRecord?: CleanupRecord;
}

// Only these three statuses are eligible for automatic advancement.
// Everything else is considered terminal for the monitor loop.
const ADVANCING_STATUSES: ReadonlySet<string> = new Set([
  "registered",
  "downloading",
  "completed",
]);

// ---------------------------------------------------------------------------
// advanceTask – single-task lifecycle state machine
// ---------------------------------------------------------------------------

export async function advanceTask(
  task: AdultTask,
  deps: AdvanceDeps,
): Promise<AdvanceResult> {
  // Terminal statuses → return unchanged (recovery via explicit tools).
  if (!ADVANCING_STATUSES.has(task.status)) {
    return { task };
  }

  const info = await deps.downloader.getTask(task.downloader_id);

  // Downloader doesn't know about this task yet → stay put.
  if (info === null) {
    return { task };
  }

  // Still downloading → publish the "downloading" status.
  if (!info.isComplete) {
    return {
      task: { ...task, status: "downloading", updated_at: deps.now },
    };
  }

  // Download is complete but has no content → import_failed.
  if (info.contentPath === null) {
    return {
      task: {
        ...task,
        status: "import_failed",
        updated_at: deps.now,
        error_summary: "missing content path",
      },
    };
  }

  // ── Import procedure ──────────────────────────────────────────────────
  const req: ImportRequest = {
    taskId: task.task_id,
    targetAlias: task.target_alias,
    code: task.code,
    displayTitle: task.display_title,
    infohash: task.infohash,
    sourcePath: info.contentPath,
    importId: deps.importId,
    importedAt: deps.now,
  };

  try {
    const importArtifact = deps.importer.import(req);

    // Record completion history.
    deps.history.record({
      key_type: task.code ? "code" : "infohash",
      key: task.code ?? task.infohash ?? "",
      code: task.code,
      code_status: task.code ? "coded" : "no_code_confirmed",
      infohash: task.infohash,
      display_title: task.display_title,
      target_alias: task.target_alias,
      import_id: deps.importId,
      completed_at: deps.now,
    });

    // Clean up the downloader (delete source files).
    const cleanupRecord = await deps.cleanup.cleanup({
      taskId: task.task_id,
      downloaderId: task.downloader_id,
      deleteFiles: true,
      cleanedAt: deps.now,
    });

    const status = cleanupRecord.error_summary
      ? "cleanup_failed"
      : "cleaned";

    return {
      task: { ...task, status, updated_at: deps.now },
      importArtifact,
      cleanupRecord,
    };
  } catch (err: unknown) {
    if (err instanceof ImportConflictError) {
      return {
        task: { ...task, status: "import_conflict", updated_at: deps.now },
      };
    }
    return {
      task: {
        ...task,
        status: "import_failed",
        updated_at: deps.now,
        error_summary: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
