import * as fs from "node:fs";
import * as path from "node:path";

import { REDACTED_PATH, TargetAlias, ImportArtifact } from "../types";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ImportConflictError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ImportConflictError";
  }
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ImportRequest {
  taskId: string;
  targetAlias: TargetAlias;
  code: string | null;
  displayTitle: string;
  infohash: string | null;
  sourcePath: string;
  importId: string;
  importedAt: number;
}

export interface ImporterOptions {
  linkFn?: (src: string, dest: string) => void;
  copyFn?: (src: string, dest: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize a display title for use as a directory name.
 *
 * Replace characters that are problematic across OS filesystems (including
 * Windows) as well as ASCII control characters with `_`.  Then collapse
 * whitespace runs to a single `_`, trim leading/trailing `._` and spaces,
 * cap length at 100, and fall back to "untitled" when the result is empty.
 */
export function sanitizeTitle(title: string): string {
  // Replace / \ : * ? " < > | and ASCII control chars (0x00-0x1f, 0x7f)
  let s = title.replace(/[/\\:*?"<>|\x00-\x1f\x7f]/g, "_");

  // Collapse whitespace (including runs of `_` that were already there)
  s = s.replace(/\s+/g, "_");

  // Also collapse runs of underscores from replacements
  s = s.replace(/_+/g, "_");

  // Trim leading/trailing . _ and spaces (and any char that looks like a separator)
  s = s.replace(/^[._\s]+|[._\s]+$/g, "");

  // Cap at 100 characters
  if (s.length > 100) {
    s = s.slice(0, 100);
    // Re-trim edges after slicing (might end on a separator)
    s = s.replace(/^[._\s]+|[._\s]+$/g, "");
  }

  if (s.length === 0) {
    s = "untitled";
  }

  return s;
}

// ---------------------------------------------------------------------------
// Importer
// ---------------------------------------------------------------------------

export class Importer {
  private readonly targets: Record<TargetAlias, string>;
  private readonly linkFn: (src: string, dest: string) => void;
  private readonly copyFn: (src: string, dest: string) => void;

  constructor(targets: Record<TargetAlias, string>, options?: ImporterOptions) {
    this.targets = targets;
    this.linkFn = options?.linkFn ?? fs.linkSync;
    this.copyFn = options?.copyFn ?? fs.copyFileSync;
  }

  /**
   * Import one or more files from `sourcePath` into the alias-determined
   * destination root.
   *
   * Returns an `ImportArtifact` with redacted paths.
   */
  import(req: ImportRequest): ImportArtifact {
    const root = this.targets[req.targetAlias];
    if (!root) {
      throw new Error(`unknown target alias: ${req.targetAlias}`);
    }

    // --- determine destination folder -----------------------------------
    let destDir: string;
    if (req.code && req.code.length > 0) {
      destDir = path.join(root, req.code);
    } else {
      if (!req.infohash) {
        throw new Error("no-code import requires an infohash");
      }
      const shortInfohash = req.infohash.slice(0, 8);
      const safeTitle = sanitizeTitle(req.displayTitle);
      destDir = path.join(root, `${safeTitle}-${shortInfohash}`);
    }

    // --- containment check (before creating anything) --------------------
    const resolvedDest = path.resolve(destDir);
    const resolvedRoot = path.resolve(root);
    if (
      resolvedDest !== resolvedRoot &&
      !resolvedDest.startsWith(resolvedRoot + path.sep)
    ) {
      throw new Error("import target escapes alias root");
    }

    // --- gather source files --------------------------------------------
    const sourceStat = fs.statSync(req.sourcePath);
    let sourceFiles: Array<{ rel: string; srcAbs: string }>;

    if (sourceStat.isDirectory()) {
      sourceFiles = this.collectFiles(req.sourcePath);
    } else {
      sourceFiles = [
        { rel: path.basename(req.sourcePath), srcAbs: req.sourcePath },
      ];
    }

    // --- create destination directory -----------------------------------
    fs.mkdirSync(resolvedDest, { recursive: true });

    // --- import each file -----------------------------------------------
    let anyCopied = false;
    let filesImported = 0;

    for (const file of sourceFiles) {
      const destAbs = path.join(resolvedDest, file.rel);

      // NEVER overwrite
      if (fs.existsSync(destAbs)) {
        throw new ImportConflictError(
          `destination already exists: ${destAbs}`,
        );
      }

      // Ensure parent dir exists for nested files (directory source)
      const destParent = path.dirname(destAbs);
      fs.mkdirSync(destParent, { recursive: true });

      try {
        this.linkFn(file.srcAbs, destAbs);
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === "EXDEV") {
          this.copyFn(file.srcAbs, destAbs);
          anyCopied = true;
        } else {
          throw err; // rethrow anything else
        }
      }

      filesImported++;
    }

    return {
      import_id: req.importId,
      task_id: req.taskId,
      target_alias: req.targetAlias,
      source_path: REDACTED_PATH,
      target_path: REDACTED_PATH,
      strategy: anyCopied ? "copy" : "hardlink",
      files_imported: filesImported,
      imported_at: req.importedAt,
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Recursively collect all files under `dir`, yielding relative paths.
   */
  private collectFiles(dir: string): Array<{ rel: string; srcAbs: string }> {
    const result: Array<{ rel: string; srcAbs: string }> = [];
    const walk = (currentDir: string, relativeSoFar: string): void => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = relativeSoFar
          ? `${relativeSoFar}/${entry.name}`
          : entry.name;
        const abs = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(abs, rel);
        } else {
          result.push({ rel, srcAbs: abs });
        }
      }
    };
    walk(dir, "");
    return result;
  }
}
