const assert = require("node:assert/strict");
const test = require("node:test");

const { loadAdultConfig } = require("../dist/config.js");
const { plannedToolNames } = require("../dist/tools/index.js");

test("loads greenfield configuration without legacy retention/import root", () => {
  const config = loadAdultConfig({
    ADULT_STATE_DIR: "/state",
    ADULT_IMPORT_TARGET_CENSORED: "/adult/censored",
    ADULT_IMPORT_TARGET_UNCENSORED: "/adult/uncensored",
    ADULT_IMPORT_TARGET_NO_CODE: "/adult/no-code",
    ADULT_IMPORT_ROOT: "/legacy/root",
    ADULT_RETENTION_DAYS: "3",
  });

  assert.equal(config.stateDir, "/state");
  assert.deepEqual(config.importTargets, {
    censored: "/adult/censored",
    uncensored: "/adult/uncensored",
    no_code: "/adult/no-code",
  });
  assert.equal(Object.hasOwn(config, "importRoot"), false);
  assert.equal(Object.hasOwn(config, "retentionDays"), false);
});

test("registers the latest planned public tool surface", () => {
  assert.deepEqual(plannedToolNames(), [
    "adult_search",
    "adult_get_resources",
    "adult_add_download",
    "adult_register_download",
    "adult_import",
    "adult_cleanup",
  ]);
});
