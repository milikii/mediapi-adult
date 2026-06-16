const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { TaskRegistry } = require("../dist/services/task-registry.js");
const { appendJsonl, readJsonl } = require("../dist/utils/jsonl.js");

function makeTask(overrides = {}) {
  return {
    task_id: "t-001",
    status: "registered",
    downloader: "qbittorrent",
    downloader_id: "d-001",
    infohash: null,
    code: null,
    code_status: "needs_code",
    display_title: "Test Task",
    target_alias: "uncensored",
    dedupe_override: false,
    created_at: 1000,
    updated_at: 1000,
    ...overrides,
  };
}

test("TaskRegistry: upsert one task, get and list", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-reg-"));
  const reg = new TaskRegistry(path.join(dir, "tasks.jsonl"));

  const task = makeTask();
  reg.upsert(task);

  const got = reg.get("t-001");
  assert.deepEqual(got, task);

  const all = reg.list();
  assert.equal(all.length, 1);
  assert.deepEqual(all[0], task);
});

test("TaskRegistry: upsert same task_id twice returns latest, list length stays 1", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-reg-"));
  const reg = new TaskRegistry(path.join(dir, "tasks.jsonl"));

  const earlier = makeTask({ status: "registered", updated_at: 1000 });
  const later = makeTask({ status: "downloading", updated_at: 2000 });

  reg.upsert(earlier);
  reg.upsert(later);

  const got = reg.get("t-001");
  assert.equal(got.status, "downloading");
  assert.equal(got.updated_at, 2000);

  const all = reg.list();
  assert.equal(all.length, 1);
  assert.equal(all[0].status, "downloading");
});

test("TaskRegistry: multiple task_ids list sorted by created_at, listByStatus filters", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-reg-"));
  const reg = new TaskRegistry(path.join(dir, "tasks.jsonl"));

  const t1 = makeTask({ task_id: "t-001", status: "registered", created_at: 3000, updated_at: 3000 });
  const t2 = makeTask({ task_id: "t-002", status: "completed", created_at: 1000, updated_at: 1000 });
  const t3 = makeTask({ task_id: "t-003", status: "registered", created_at: 2000, updated_at: 2000 });

  reg.upsert(t1);
  reg.upsert(t2);
  reg.upsert(t3);

  const all = reg.list();
  assert.equal(all.length, 3);
  // sorted by created_at ascending
  assert.equal(all[0].task_id, "t-002");
  assert.equal(all[1].task_id, "t-003");
  assert.equal(all[2].task_id, "t-001");

  const registered = reg.listByStatus("registered");
  assert.equal(registered.length, 2);
  assert.equal(registered[0].task_id, "t-003");
  assert.equal(registered[1].task_id, "t-001");

  const completed = reg.listByStatus("completed");
  assert.equal(completed.length, 1);
  assert.equal(completed[0].task_id, "t-002");
});

test("readJsonl on missing file returns []", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-reg-"));
  const result = readJsonl(path.join(dir, "nonexistent.jsonl"));
  assert.deepEqual(result, []);
});

test("readJsonl tolerates torn final line", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-reg-"));
  const filePath = path.join(dir, "torn.jsonl");

  const valid = { task_id: "t-001", status: "registered" };
  appendJsonl(filePath, valid);

  // Append a broken line (raw bytes that are not valid JSON)
  fs.appendFileSync(filePath, '{bad json\n');

  const result = readJsonl(filePath);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], valid);
});

test("appendJsonl creates missing nested directory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-reg-"));
  const nestedPath = path.join(dir, "a", "b", "c", "tasks.jsonl");

  const task = makeTask();
  appendJsonl(nestedPath, task);

  assert.equal(fs.existsSync(nestedPath), true);

  const result = readJsonl(nestedPath);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], task);
});
