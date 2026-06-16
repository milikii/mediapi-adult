const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeCode, extractCode } = require("../dist/utils/code.js");

// ── normalizeCode ──────────────────────────────────────────────────────

test("normalizeCode: no separator", () => {
  assert.equal(normalizeCode("ssis843"), "SSIS-843");
});

test("normalizeCode: hyphen separator", () => {
  assert.equal(normalizeCode("SSIS-843"), "SSIS-843");
});

test("normalizeCode: underscore separator", () => {
  assert.equal(normalizeCode("ssis_843"), "SSIS-843");
});

test("normalizeCode: space separator", () => {
  assert.equal(normalizeCode("ssis 843"), "SSIS-843");
});

test("normalizeCode: lowercase input", () => {
  assert.equal(normalizeCode("abcd-12"), "ABCD-12");
});

test("normalizeCode: mixed case input", () => {
  assert.equal(normalizeCode("SsIs-843"), "SSIS-843");
});

test("normalizeCode: leading zeros preserved", () => {
  assert.equal(normalizeCode("SSIS-00843"), "SSIS-00843");
});

test("normalizeCode: invalid - no match (hello)", () => {
  assert.equal(normalizeCode("hello"), null);
});

test("normalizeCode: invalid - just digits", () => {
  assert.equal(normalizeCode("12345"), null);
});

test("normalizeCode: invalid - empty string", () => {
  assert.equal(normalizeCode(""), null);
});

test("normalizeCode: invalid - prefix too long", () => {
  assert.equal(normalizeCode("toolongprefix-1"), null);
});

test("normalizeCode: digits too short (< 2)", () => {
  assert.equal(normalizeCode("AB-1"), null);
});

test("normalizeCode: digits too long (> 6)", () => {
  assert.equal(normalizeCode("AB-1234567"), null);
});

// ── extractCode ────────────────────────────────────────────────────────

test("extractCode: code embedded in title", () => {
  assert.equal(extractCode("SSIS-843 Great Title"), "SSIS-843");
});

test("extractCode: code at end of text", () => {
  assert.equal(extractCode("Watch this movie ssis843"), "SSIS-843");
});

test("extractCode: no code in text", () => {
  assert.equal(extractCode("no code here"), null);
});

test("extractCode: empty text", () => {
  assert.equal(extractCode(""), null);
});
