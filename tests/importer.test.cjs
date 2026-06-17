const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const {
  Importer,
  ImportConflictError,
  sanitizeTitle,
} = require("../dist/services/importer.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temporary directory and return its path.  Caller is responsible
 * for cleaning up with `rmSync(…, { recursive: true, force: true })`.
 */
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-imp-"));
}

/**
 * Write a small file at `dest` (creating parent dirs).
 */
function touch(dest, content) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content ?? "data");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("coded import — single file hardlink", () => {
  const root = tmpDir();
  const source = tmpDir();
  try {
    const code = "ABC-123";
    const srcFile = path.join(source, "video.mp4");
    touch(srcFile, "hello");

    const targets = {
      censored: root,
      uncensored: root,
      no_code: root,
    };
    const imp = new Importer(targets);

    const artifact = imp.import({
      taskId: "t-1",
      targetAlias: "censored",
      code,
      displayTitle: "Some Title",
      infohash: "abcd1234deadbeef",
      sourcePath: srcFile,
      importId: "i-1",
      importedAt: 1000,
    });

    // File landed correctly
    const expectedDest = path.join(root, code, "video.mp4");
    assert.equal(fs.existsSync(expectedDest), true);
    assert.equal(fs.readFileSync(expectedDest, "utf-8"), "hello");

    // Hardlink shares the same inode
    const srcStat = fs.statSync(srcFile);
    const destStat = fs.statSync(expectedDest);
    assert.equal(srcStat.ino, destStat.ino);

    // Artifact fields
    assert.equal(artifact.import_id, "i-1");
    assert.equal(artifact.task_id, "t-1");
    assert.equal(artifact.target_alias, "censored");
    assert.equal(artifact.source_path, "[REDACTED]");
    assert.equal(artifact.target_path, "[REDACTED]");
    assert.equal(artifact.strategy, "hardlink");
    assert.equal(artifact.files_imported, 1);
    assert.equal(artifact.imported_at, 1000);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test("no-code import — folder uses sanitizedTitle-infohash", () => {
  const root = tmpDir();
  const source = tmpDir();
  try {
    const srcFile = path.join(source, "file.mp4");
    touch(srcFile, "data");

    const imp = new Importer({
      censored: root,
      uncensored: root,
      no_code: root,
    });

    const artifact = imp.import({
      taskId: "t-2",
      targetAlias: "no_code",
      code: null,
      displayTitle: "My Great Movie",
      infohash: "deadbeef12345678",
      sourcePath: srcFile,
      importId: "i-2",
      importedAt: 2000,
    });

    const expectedDir = path.join(root, "My_Great_Movie-deadbeef");
    const expectedFile = path.join(expectedDir, "file.mp4");
    assert.equal(fs.existsSync(expectedFile), true);
    assert.equal(artifact.strategy, "hardlink");
    assert.equal(artifact.files_imported, 1);
    assert.equal(artifact.target_alias, "no_code");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test("no-code with null infohash throws", () => {
  const root = tmpDir();
  const source = tmpDir();
  try {
    const srcFile = path.join(source, "f.mp4");
    touch(srcFile);

    const imp = new Importer({
      censored: root,
      uncensored: root,
      no_code: root,
    });

    assert.throws(
      () => {
        imp.import({
          taskId: "t-3",
          targetAlias: "no_code",
          code: null,
          displayTitle: "No Infohash",
          infohash: null,
          sourcePath: srcFile,
          importId: "i-3",
          importedAt: 3000,
        });
      },
      (err) => {
        return (
          err instanceof Error &&
          err.message === "no-code import requires an infohash"
        );
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test("conflict — pre-existing destination throws ImportConflictError", () => {
  const root = tmpDir();
  const source = tmpDir();
  try {
    const code = "XYZ-999";
    const srcFile = path.join(source, "clash.mp4");
    touch(srcFile, "src");

    // Pre-create the destination file
    const destFile = path.join(root, code, "clash.mp4");
    touch(destFile, "existing");

    const imp = new Importer({
      censored: root,
      uncensored: root,
      no_code: root,
    });

    assert.throws(
      () => {
        imp.import({
          taskId: "t-4",
          targetAlias: "censored",
          code,
          displayTitle: "Clash",
          infohash: null,
          sourcePath: srcFile,
          importId: "i-4",
          importedAt: 4000,
        });
      },
      (err) => {
        return (
          err instanceof ImportConflictError ||
          err.name === "ImportConflictError"
        );
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test("copy fallback when linkFn throws EXDEV", () => {
  const root = tmpDir();
  const source = tmpDir();
  try {
    const srcFile = path.join(source, "vid.mkv");
    touch(srcFile, "content");

    const linkFn = () => {
      const e = new Error("xdev");
      e.code = "EXDEV";
      throw e;
    };

    const imp = new Importer(
      {
        censored: root,
        uncensored: root,
        no_code: root,
      },
      { linkFn },
    );

    const artifact = imp.import({
      taskId: "t-5",
      targetAlias: "uncensored",
      code: "ABC",
      displayTitle: "Copy Test",
      infohash: null,
      sourcePath: srcFile,
      importId: "i-5",
      importedAt: 5000,
    });

    const destFile = path.join(root, "ABC", "vid.mkv");
    assert.equal(fs.existsSync(destFile), true);
    assert.equal(fs.readFileSync(destFile, "utf-8"), "content");
    assert.equal(artifact.strategy, "copy");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test("directory source — preserves relative paths", () => {
  const root = tmpDir();
  const source = tmpDir();
  try {
    // Create a source directory with 2 files, one nested
    touch(path.join(source, "a.txt"), "aaa");
    touch(path.join(source, "sub", "b.txt"), "bbb");

    const imp = new Importer({
      censored: root,
      uncensored: root,
      no_code: root,
    });

    const artifact = imp.import({
      taskId: "t-6",
      targetAlias: "uncensored",
      code: "DIRTEST",
      displayTitle: "",
      infohash: null,
      sourcePath: source,
      importId: "i-6",
      importedAt: 6000,
    });

    // Both files should exist at correct relative paths
    assert.equal(fs.existsSync(path.join(root, "DIRTEST", "a.txt")), true);
    assert.equal(fs.existsSync(path.join(root, "DIRTEST", "sub", "b.txt")), true);
    assert.equal(artifact.files_imported, 2);
    assert.equal(artifact.strategy, "hardlink");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test("containment — code ../escape throws", () => {
  const root = tmpDir();
  const source = tmpDir();
  try {
    const srcFile = path.join(source, "f.mp4");
    touch(srcFile);

    const imp = new Importer({
      censored: root,
      uncensored: root,
      no_code: root,
    });

    assert.throws(
      () => {
        imp.import({
          taskId: "t-7",
          targetAlias: "censored",
          code: "../escape",
          displayTitle: "Escape",
          infohash: null,
          sourcePath: srcFile,
          importId: "i-7",
          importedAt: 7000,
        });
      },
      (err) => {
        return (
          err instanceof Error &&
          err.message === "import target escapes alias root"
        );
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test("sanitize — displayTitle with special chars", () => {
  const root = tmpDir();
  const source = tmpDir();
  try {
    const srcFile = path.join(source, "f.mp4");
    touch(srcFile);

    const imp = new Importer({
      censored: root,
      uncensored: root,
      no_code: root,
    });

    const artifact = imp.import({
      taskId: "t-8",
      targetAlias: "no_code",
      code: null,
      displayTitle: "Bad/Chars:Test?File|Name",
      infohash: "deadbeef12345678",
      sourcePath: srcFile,
      importId: "i-8",
      importedAt: 8000,
    });

    // The folder name should NOT contain any of / \ : * ? " < > |
    const expectedDir = path.join(root, "Bad_Chars_Test_File_Name-deadbeef");
    assert.equal(fs.existsSync(path.join(expectedDir, "f.mp4")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test("sanitizeTitle standalone function", () => {
  // The function should be exported; test edge cases
  assert.equal(sanitizeTitle("Hello World"), "Hello_World");
  assert.equal(sanitizeTitle("  leading/trailing  "), "leading_trailing");
  assert.equal(sanitizeTitle("a/b:c*d?e"), "a_b_c_d_e");
  assert.equal(sanitizeTitle(""), "untitled");
  assert.equal(sanitizeTitle("___"), "untitled");
  assert.equal(sanitizeTitle("normal"), "normal");
});
