const assert = require("node:assert/strict");
const test = require("node:test");

const { advanceTask } = require("../dist/services/lifecycle.js");
const { ImportConflictError } = require("../dist/services/importer.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides = {}) {
  return {
    task_id: "task-001",
    status: "registered",
    downloader: "qbittorrent",
    downloader_id: "dl-001",
    infohash: "abcd1234efgh5678ijkl9012mnop3456qrst7890",
    code: "ABC-123",
    code_status: "needs_code",
    display_title: "Test Title",
    target_alias: "censored",
    dedupe_override: false,
    created_at: 1000,
    updated_at: 1000,
    ...overrides,
  };
}

const SAMPLE_ARTIFACT = {
  import_id: "imp-001",
  task_id: "task-001",
  target_alias: "censored",
  source_path: "[REDACTED]",
  target_path: "[REDACTED]",
  strategy: "hardlink",
  files_imported: 3,
  imported_at: 2000,
};

const CLEANUP_OK = {
  task_id: "task-001",
  downloader_id: "dl-001",
  deleted_files: true,
  cleaned_at: 2000,
};

const CLEANUP_FAILED = {
  task_id: "task-001",
  downloader_id: "dl-001",
  deleted_files: false,
  cleaned_at: 2000,
  error_summary: "failed to remove",
};

const COMPLETE_INFO = {
  downloaderId: "dl-001",
  infohash: null,
  name: "",
  progress: 1,
  isComplete: true,
  contentPath: "/path/to/content",
};

// ---------------------------------------------------------------------------
// Fake factories
// ---------------------------------------------------------------------------

function fakeDownloader(getTaskResult) {
  const calls = { getTask: 0 };
  return {
    async getTask(_id) {
      calls.getTask++;
      return typeof getTaskResult === "function" ? getTaskResult(_id) : getTaskResult;
    },
    async addMagnet() { throw new Error("not implemented"); },
    async listTasks() { throw new Error("not implemented"); },
    async removeTask() { throw new Error("not implemented"); },
    _calls: calls,
  };
}

function fakeImporter(impl) {
  return { import: impl };
}

function fakeHistory() {
  const recorded = [];
  return {
    record(item) { recorded.push(item); },
    _recorded: recorded,
  };
}

function fakeCleaner(impl) {
  const calls = [];
  return {
    async cleanup(req) {
      const r = typeof impl === "function" ? impl(req) : impl;
      const result = r instanceof Promise ? await r : r;
      calls.push(req);
      return result;
    },
    _calls: calls,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("terminal status returns task unchanged, downloader.getTask not called", async () => {
  const task = makeTask({ status: "imported" });
  const dl = fakeDownloader(null);
  const deps = {
    downloader: dl,
    importer: fakeImporter(() => { throw new Error("should not be called"); }),
    history: fakeHistory(),
    cleanup: fakeCleaner(CLEANUP_OK),
    now: 2000,
    importId: "imp-001",
  };
  const result = await advanceTask(task, deps);
  assert.equal(result.task, task);
  assert.equal(result.importArtifact, undefined);
  assert.equal(dl._calls.getTask, 0);
});

test("getTask returns null → task unchanged", async () => {
  const task = makeTask();
  const dl = fakeDownloader(null);
  const deps = {
    downloader: dl,
    importer: fakeImporter(() => { throw new Error("should not be called"); }),
    history: fakeHistory(),
    cleanup: fakeCleaner(CLEANUP_OK),
    now: 2000,
    importId: "imp-001",
  };
  const result = await advanceTask(task, deps);
  assert.equal(result.task, task);
  assert.equal(result.importArtifact, undefined);
  assert.equal(dl._calls.getTask, 1);
});

test("downloading status, isComplete:false → status downloading, updated_at = now", async () => {
  const task = makeTask({ status: "downloading" });
  const info = {
    downloaderId: "dl-001",
    infohash: null,
    name: "",
    progress: 0.5,
    isComplete: false,
    contentPath: null,
  };
  const dl = fakeDownloader(info);
  const deps = {
    downloader: dl,
    importer: fakeImporter(() => { throw new Error("should not be called"); }),
    history: fakeHistory(),
    cleanup: fakeCleaner(CLEANUP_OK),
    now: 2000,
    importId: "imp-001",
  };
  const result = await advanceTask(task, deps);
  assert.equal(result.task.status, "downloading");
  assert.equal(result.task.updated_at, 2000);
  assert.equal(result.importArtifact, undefined);
});

test("complete + import success + cleanup success → status cleaned", async () => {
  const task = makeTask();
  const h = fakeHistory();
  const cleanCalls = [];
  const deps = {
    downloader: fakeDownloader(COMPLETE_INFO),
    importer: fakeImporter(() => ({ ...SAMPLE_ARTIFACT, task_id: task.task_id })),
    history: h,
    cleanup: {
      async cleanup(req) {
        cleanCalls.push(req);
        return CLEANUP_OK;
      },
    },
    now: 2000,
    importId: "imp-001",
  };
  const result = await advanceTask(task, deps);

  assert.equal(result.task.status, "cleaned");
  assert.equal(result.task.updated_at, 2000);
  assert.deepEqual(result.importArtifact, { ...SAMPLE_ARTIFACT, task_id: task.task_id });
  assert.deepEqual(result.cleanupRecord, CLEANUP_OK);

  // history.record called once with correct coded-task fields
  assert.equal(h._recorded.length, 1);
  assert.equal(h._recorded[0].key_type, "code");
  assert.equal(h._recorded[0].key, "ABC-123");
  assert.equal(h._recorded[0].code_status, "coded");

  // cleanup called with downloaderId and deleteFiles:true
  assert.equal(cleanCalls.length, 1);
  assert.equal(cleanCalls[0].downloaderId, "dl-001");
  assert.equal(cleanCalls[0].deleteFiles, true);
});

test("complete + import success + cleanup error → status cleanup_failed", async () => {
  const task = makeTask();
  const h = fakeHistory();
  const deps = {
    downloader: fakeDownloader(COMPLETE_INFO),
    importer: fakeImporter(() => ({ ...SAMPLE_ARTIFACT, task_id: task.task_id })),
    history: h,
    cleanup: fakeCleaner(CLEANUP_FAILED),
    now: 2000,
    importId: "imp-001",
  };
  const result = await advanceTask(task, deps);

  assert.equal(result.task.status, "cleanup_failed");
  assert.equal(result.task.updated_at, 2000);
  assert.notEqual(result.importArtifact, undefined);
  assert.equal(result.cleanupRecord.error_summary, "failed to remove");

  // history WAS recorded (import happened before cleanup)
  assert.equal(h._recorded.length, 1);
});

test("complete + importer throws ImportConflictError → status import_conflict, history not recorded, cleanup not called", async () => {
  const task = makeTask();
  const h = fakeHistory();
  let cleanupCalled = false;
  const deps = {
    downloader: fakeDownloader(COMPLETE_INFO),
    importer: fakeImporter(() => { throw new ImportConflictError("x"); }),
    history: h,
    cleanup: {
      async cleanup() { cleanupCalled = true; return CLEANUP_OK; },
    },
    now: 2000,
    importId: "imp-001",
  };
  const result = await advanceTask(task, deps);

  assert.equal(result.task.status, "import_conflict");
  assert.equal(result.task.updated_at, 2000);
  assert.equal(result.importArtifact, undefined);
  assert.equal(h._recorded.length, 0, "history should NOT be recorded on import conflict");
  assert.equal(cleanupCalled, false, "cleanup should NOT be called on import conflict");
});

test("complete + importer throws generic Error → status import_failed, error_summary", async () => {
  const task = makeTask();
  const h = fakeHistory();
  let cleanupCalled = false;
  const deps = {
    downloader: fakeDownloader(COMPLETE_INFO),
    importer: fakeImporter(() => { throw new Error("disk full"); }),
    history: h,
    cleanup: {
      async cleanup() { cleanupCalled = true; return CLEANUP_OK; },
    },
    now: 2000,
    importId: "imp-001",
  };
  const result = await advanceTask(task, deps);

  assert.equal(result.task.status, "import_failed");
  assert.equal(result.task.error_summary, "disk full");
  assert.equal(h._recorded.length, 0, "history should NOT be recorded on import failure");
  assert.equal(cleanupCalled, false, "cleanup should NOT be called on import failure");
  assert.equal(result.importArtifact, undefined);
});

test("complete + contentPath:null → status import_failed, error_summary missing content path", async () => {
  const task = makeTask();
  const info = { ...COMPLETE_INFO, contentPath: null };
  let importCalled = false;
  const h = fakeHistory();
  const deps = {
    downloader: fakeDownloader(info),
    importer: fakeImporter(() => { importCalled = true; throw new Error("should not be called"); }),
    history: h,
    cleanup: fakeCleaner(CLEANUP_OK),
    now: 2000,
    importId: "imp-001",
  };
  const result = await advanceTask(task, deps);

  assert.equal(result.task.status, "import_failed");
  assert.equal(result.task.error_summary, "missing content path");
  assert.equal(importCalled, false);
  assert.equal(result.importArtifact, undefined);
  assert.equal(h._recorded.length, 0);
});

test("no-code task (code:null, infohash set) → history key_type:infohash, code_status:no_code_confirmed, key = infohash", async () => {
  const task = makeTask({
    code: null,
    code_status: "no_code_confirmed",
  });
  const h = fakeHistory();
  const deps = {
    downloader: fakeDownloader(COMPLETE_INFO),
    importer: fakeImporter(() => ({ ...SAMPLE_ARTIFACT, task_id: task.task_id })),
    history: h,
    cleanup: fakeCleaner(CLEANUP_OK),
    now: 2000,
    importId: "imp-001",
  };
  const result = await advanceTask(task, deps);

  assert.equal(result.task.status, "cleaned");
  assert.equal(h._recorded.length, 1);
  assert.equal(h._recorded[0].key_type, "infohash");
  assert.equal(h._recorded[0].key, task.infohash);
  assert.equal(h._recorded[0].code_status, "no_code_confirmed");
});
