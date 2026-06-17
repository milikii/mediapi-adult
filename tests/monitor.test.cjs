const assert = require("node:assert/strict");
const test = require("node:test");

const { AdultMonitor } = require("../dist/services/monitor.js");
const { loadAdultConfig } = require("../dist/config.js");

// ---------------------------------------------------------------------------
// Factory helpers
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

const COMPLETE_INFO = {
  downloaderId: "dl-001",
  infohash: null,
  name: "Test Download",
  progress: 1,
  isComplete: true,
  contentPath: "/c/x",
};

const INCOMPLETE_INFO = {
  downloaderId: "dl-001",
  infohash: null,
  name: "Test Download",
  progress: 0.5,
  isComplete: false,
  contentPath: null,
};

const CLEANUP_OK = {
  task_id: "task-001",
  downloader_id: "dl-001",
  deleted_files: true,
  cleaned_at: 2000,
};

function makeMonitorDeps({ tasks, downloader, importer, history, cleanup }) {
  return {
    registry: {
      _tasks: tasks,
      list() {
        return this._tasks;
      },
      upsert(t) {
        if (!this.upserts) this.upserts = [];
        this.upserts.push(t);
      },
      upserts: [],
    },
    downloader:
      downloader ??
      (() => ({
        async getTask() {
          return null;
        },
        async addMagnet() {
          throw new Error("not implemented");
        },
        async listTasks() {
          return [];
        },
        async removeTask() {},
      }))(),
    importer:
      importer ??
      (() => ({
        import() {
          throw new Error("not implemented");
        },
      }))(),
    history:
      history ??
      (() => ({
        record() {},
        records: [],
      }))(),
    cleanup:
      cleanup ??
      (() => ({
        async cleanup() {
          return {
            task_id: "",
            downloader_id: "",
            deleted_files: false,
            cleaned_at: 0,
          };
        },
      }))(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("start/stop/isRunning basic flow", () => {
  const config = loadAdultConfig({});
  const deps = makeMonitorDeps({ tasks: [] });
  const monitor = new AdultMonitor(config, deps);

  try {
    // Not running initially
    assert.equal(monitor.isRunning(), false);

    // Start returns true
    assert.equal(monitor.start(() => {}), true);
    assert.equal(monitor.isRunning(), true);

    // Second start while running returns false
    assert.equal(monitor.start(() => {}), false);

    // Stop returns true
    assert.equal(monitor.stop(), true);
    assert.equal(monitor.isRunning(), false);

    // Second stop returns false
    assert.equal(monitor.stop(), false);
  } finally {
    monitor.stop();
  }
});

test("tick advances downloading task to cleaned (full flow)", async () => {
  const config = loadAdultConfig({});
  const task = makeTask({ status: "downloading" });
  const historyRecords = [];

  const deps = makeMonitorDeps({
    tasks: [task],
    downloader: {
      async getTask() {
        return COMPLETE_INFO;
      },
      async addMagnet() {
        throw new Error("not implemented");
      },
      async listTasks() {
        return [];
      },
      async removeTask() {},
    },
    importer: {
      import(req) {
        return {
          import_id: req.importId,
          task_id: req.taskId,
          target_alias: req.targetAlias,
          source_path: "[REDACTED]",
          target_path: "[REDACTED]",
          strategy: "hardlink",
          files_imported: 3,
          imported_at: req.importedAt,
        };
      },
    },
    history: {
      record(item) {
        historyRecords.push(item);
      },
      get records() {
        return historyRecords;
      },
    },
    cleanup: {
      async cleanup(req) {
        return {
          task_id: req.taskId,
          downloader_id: req.downloaderId,
          deleted_files: true,
          cleaned_at: req.cleanedAt,
        };
      },
    },
  });

  const monitor = new AdultMonitor(config, deps);
  await monitor.tick();

  // The task should have been upserted with status "cleaned"
  assert.equal(deps.registry.upserts.length, 1);
  assert.equal(deps.registry.upserts[0].status, "cleaned");
  assert.equal(deps.registry.upserts[0].task_id, "task-001");

  // History should have one record
  assert.equal(historyRecords.length, 1);
  assert.equal(historyRecords[0].key_type, "code");
  assert.equal(historyRecords[0].key, "ABC-123");
});

test("tick with isComplete:false changes registered to downloading", async () => {
  const config = loadAdultConfig({});
  const task = makeTask({ status: "registered" });
  const historyRecords = [];

  const deps = makeMonitorDeps({
    tasks: [task],
    downloader: {
      async getTask() {
        return INCOMPLETE_INFO;
      },
      async addMagnet() {
        throw new Error("not implemented");
      },
      async listTasks() {
        return [];
      },
      async removeTask() {},
    },
    importer: {
      import() {
        throw new Error("should not be called");
      },
    },
    history: {
      record(item) {
        historyRecords.push(item);
      },
      get records() {
        return historyRecords;
      },
    },
    cleanup: {
      async cleanup() {
        throw new Error("should not be called");
      },
    },
  });

  const monitor = new AdultMonitor(config, deps);
  await monitor.tick();

  // Task should have been upserted with status "downloading"
  assert.equal(deps.registry.upserts.length, 1);
  assert.equal(deps.registry.upserts[0].status, "downloading");
  assert.equal(deps.registry.upserts[0].updated_at > 0, true, "updated_at should be set");

  // History should NOT have been recorded (import not reached)
  assert.equal(historyRecords.length, 0);
});

test("tick resilience: one task throws, second task still processed", async () => {
  const config = loadAdultConfig({});
  let callCount = 0;
  const task1 = makeTask({
    task_id: "task-fail",
    downloader_id: "dl-fail",
    status: "downloading",
  });
  const task2 = makeTask({
    task_id: "task-ok",
    downloader_id: "dl-ok",
    status: "registered",
  });
  const historyRecords = [];

  const deps = makeMonitorDeps({
    tasks: [task1, task2],
    downloader: {
      async getTask(id) {
        callCount++;
        if (id === "dl-fail") {
          throw new Error("network error");
        }
        // second task gets incomplete info → goes to downloading
        return {
          ...INCOMPLETE_INFO,
          downloaderId: id,
        };
      },
      async addMagnet() {
        throw new Error("not implemented");
      },
      async listTasks() {
        return [];
      },
      async removeTask() {},
    },
    importer: {
      import() {
        throw new Error("should not be called");
      },
    },
    history: {
      record(item) {
        historyRecords.push(item);
      },
      get records() {
        return historyRecords;
      },
    },
    cleanup: {
      async cleanup() {
        throw new Error("should not be called");
      },
    },
  });

  const monitor = new AdultMonitor(config, deps);

  // tick() must NOT throw
  await monitor.tick();

  // The second task should have been upserted (registered → downloading)
  const okUpserts = deps.registry.upserts.filter(
    (u) => u.task_id === "task-ok",
  );
  assert.equal(okUpserts.length, 1);
  assert.equal(okUpserts[0].status, "downloading");

  // The first task should NOT have been upserted (threw during processing)
  const failUpserts = deps.registry.upserts.filter(
    (u) => u.task_id === "task-fail",
  );
  assert.equal(failUpserts.length, 0);

  // getTask was called twice (once per task)
  assert.equal(callCount, 2);

  // No exception should have escaped tick()
});

test("terminal-status task is not advanced", async () => {
  const config = loadAdultConfig({});
  let getTaskCalled = false;
  const task = makeTask({ status: "imported" });

  const deps = makeMonitorDeps({
    tasks: [task],
    downloader: {
      async getTask() {
        getTaskCalled = true;
        return COMPLETE_INFO;
      },
      async addMagnet() {
        throw new Error("not implemented");
      },
      async listTasks() {
        return [];
      },
      async removeTask() {},
    },
    importer: {
      import() {
        throw new Error("should not be called");
      },
    },
    history: {
      record() {},
      records: [],
    },
    cleanup: {
      async cleanup() {
        throw new Error("should not be called");
      },
    },
  });

  const monitor = new AdultMonitor(config, deps);
  await monitor.tick();

  // No upsert should have happened
  assert.equal(deps.registry.upserts.length, 0);

  // getTask should NOT be called for terminal-status task
  assert.equal(getTaskCalled, false);
});
