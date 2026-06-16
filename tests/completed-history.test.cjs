const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { CompletedHistory } = require("../dist/services/completed-history.js");

function makeCodeItem(overrides = {}) {
  return {
    key_type: "code",
    key: "ABC-123",
    code: "ABC-123",
    code_status: "coded",
    infohash: null,
    display_title: "Test Code Item",
    target_alias: "censored",
    import_id: "imp-001",
    completed_at: 1000,
    ...overrides,
  };
}

function makeInfohashItem(overrides = {}) {
  return {
    key_type: "infohash",
    key: "abcd1234efgh5678ijkl9012mnop3456qrst7890",
    code: null,
    code_status: "no_code_confirmed",
    infohash: "abcd1234efgh5678ijkl9012mnop3456qrst7890",
    display_title: "Test Infohash Item",
    target_alias: "uncensored",
    import_id: "imp-002",
    completed_at: 2000,
    ...overrides,
  };
}

test("CompletedHistory: record a code item, hasCode true, hasCode('other') false, hasInfohash false", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-hist-"));
  const history = new CompletedHistory(path.join(dir, "completed.jsonl"));

  const item = makeCodeItem();
  history.record(item);

  assert.equal(history.hasCode("ABC-123"), true);
  assert.equal(history.hasCode("OTHER"), false);
  assert.equal(history.hasInfohash("abcd1234efgh5678ijkl9012mnop3456qrst7890"), false);

  const found = history.findByCode("ABC-123");
  assert.deepEqual(found, item);
});

test("CompletedHistory: record an infohash item, hasInfohash true, hasCode false for it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-hist-"));
  const history = new CompletedHistory(path.join(dir, "completed.jsonl"));

  const item = makeInfohashItem();
  history.record(item);

  assert.equal(history.hasInfohash(item.key), true);
  assert.equal(history.hasCode(item.infohash), false);

  const found = history.findByInfohash(item.key);
  assert.deepEqual(found, item);
});

test("CompletedHistory: two code records same key, findByCode returns the latest, list length 2", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-hist-"));
  const history = new CompletedHistory(path.join(dir, "completed.jsonl"));

  const earlier = makeCodeItem({ import_id: "imp-001", completed_at: 1000 });
  const later = makeCodeItem({ import_id: "imp-002", completed_at: 2000 });

  history.record(earlier);
  history.record(later);

  const found = history.findByCode("ABC-123");
  assert.notEqual(found, undefined);
  assert.equal(found.import_id, "imp-002");
  assert.equal(found.completed_at, 2000);

  const all = history.list();
  assert.equal(all.length, 2);
  assert.equal(all[0].import_id, "imp-001");
  assert.equal(all[1].import_id, "imp-002");
});

test("CompletedHistory: multiple mixed records, list length matches, lookups correct", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-hist-"));
  const history = new CompletedHistory(path.join(dir, "completed.jsonl"));

  const code1 = makeCodeItem({ key: "ABC-123", import_id: "imp-001", completed_at: 1000 });
  const code2 = makeCodeItem({ key: "DEF-456", import_id: "imp-002", completed_at: 2000 });
  const hash1 = makeInfohashItem({ key: "hash1", import_id: "imp-003", completed_at: 3000 });
  const hash2 = makeInfohashItem({ key: "hash2", import_id: "imp-004", completed_at: 4000 });

  history.record(code1);
  history.record(hash1);
  history.record(code2);
  history.record(hash2);

  const all = history.list();
  assert.equal(all.length, 4);

  assert.equal(history.hasCode("ABC-123"), true);
  assert.equal(history.hasCode("DEF-456"), true);
  assert.equal(history.hasCode("GHI-789"), false);

  assert.equal(history.hasInfohash("hash1"), true);
  assert.equal(history.hasInfohash("hash2"), true);
  assert.equal(history.hasInfohash("hash3"), false);

  assert.deepEqual(history.findByCode("ABC-123"), code1);
  assert.deepEqual(history.findByCode("DEF-456"), code2);
  assert.equal(history.findByCode("GHI-789"), undefined);

  assert.deepEqual(history.findByInfohash("hash1"), hash1);
  assert.deepEqual(history.findByInfohash("hash2"), hash2);
  assert.equal(history.findByInfohash("hash3"), undefined);
});

test("CompletedHistory: fresh registry on a missing file returns empty", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mediapi-hist-"));
  const history = new CompletedHistory(path.join(dir, "completed.jsonl"));

  assert.equal(history.hasCode("ANY"), false);
  assert.equal(history.hasInfohash("ANY"), false);
  assert.equal(history.findByCode("ANY"), undefined);
  assert.equal(history.findByInfohash("ANY"), undefined);
  assert.deepEqual(history.list(), []);
});
