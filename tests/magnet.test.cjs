const assert = require("node:assert/strict");
const test = require("node:test");

const {
  isMagnetUri,
  parseMagnet,
} = require("../dist/utils/magnet.js");

test("isMagnetUri returns true for magnet:? prefixed strings", () => {
  assert.equal(isMagnetUri("magnet:?xt=urn:btih:ABC"), true);
  assert.equal(isMagnetUri("  magnet:?xt=urn:btih:ABC  "), true);
  assert.equal(isMagnetUri("MAGNET:?xt=urn:btih:ABC"), true);
  assert.equal(isMagnetUri("Magnet:?xt=urn:btih:ABC"), true);
});

test("isMagnetUri returns false for non-magnet strings", () => {
  assert.equal(isMagnetUri(""), false);
  assert.equal(isMagnetUri("http://example.com"), false);
  assert.equal(isMagnetUri("xt=urn:btih:ABC"), false);
  assert.equal(isMagnetUri("magnet"), false);
});

test("parseMagnet returns null fields for non-magnet input", () => {
  const result = parseMagnet("not a magnet");
  assert.equal(result.infohash, null);
  assert.equal(result.displayName, null);
});

test("parseMagnet extracts 40-char hex infohash (lowercased)", () => {
  const hexHash = "ABCDEF0123456789abcdef0123456789abcdef01";
  const magnet = `magnet:?xt=urn:btih:${hexHash}&dn=Test+Title`;
  const result = parseMagnet(magnet);
  assert.equal(result.infohash, hexHash.toLowerCase());
  assert.equal(result.displayName, "Test Title");
});

test("parseMagnet lowercases uppercase-hex infohash", () => {
  const magnet = "magnet:?xt=urn:btih:ABCDEF0123456789ABCDEF0123456789ABCDEF01";
  const result = parseMagnet(magnet);
  assert.equal(result.infohash, "abcdef0123456789abcdef0123456789abcdef01");
});

test("parseMagnet extracts 32-char base32 infohash (uppercased)", () => {
  // 32 chars from base32 alphabet A-Z,2-7
  const base32Hash = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  assert.equal(base32Hash.length, 32);
  const magnet = `magnet:?xt=urn:btih:${base32Hash}&dn=Some+Movie`;
  const result = parseMagnet(magnet);
  assert.equal(result.infohash, base32Hash.toUpperCase());
  assert.equal(result.displayName, "Some Movie");
});

test("parseMagnet returns null infohash for magnet with no xt", () => {
  const magnet = "magnet:?dn=No+Hash";
  const result = parseMagnet(magnet);
  assert.equal(result.infohash, null);
  assert.equal(result.displayName, "No Hash");
});

test("parseMagnet returns null displayName when dn is absent", () => {
  const magnet = "magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01";
  const result = parseMagnet(magnet);
  assert.equal(result.infohash, "abcdef0123456789abcdef0123456789abcdef01");
  assert.equal(result.displayName, null);
});

test("parseMagnet decodes + and %20 in displayName", () => {
  const magnet =
    "magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01" +
    "&dn=Hello+World%21";
  const result = parseMagnet(magnet);
  assert.equal(result.displayName, "Hello World!");
});

test("parseMagnet returns null infohash when xt is non-btih (e.g. ed2k)", () => {
  const magnet = "magnet:?xt=urn:ed2k:somehash";
  const result = parseMagnet(magnet);
  assert.equal(result.infohash, null);
  assert.equal(result.displayName, null);
});

test("parseMagnet uses first valid btih when multiple xt params present", () => {
  const magnet =
    "magnet:?xt=urn:ed2k:ignored&xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01&xt=urn:btih:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const result = parseMagnet(magnet);
  assert.equal(result.infohash, "abcdef0123456789abcdef0123456789abcdef01");
});

test("parseMagnet returns null infohash when no valid btih xt found", () => {
  const magnet = "magnet:?xt=urn:btih:invalid";
  const result = parseMagnet(magnet);
  assert.equal(result.infohash, null);
});

test("parseMagnet empty dn becomes null", () => {
  const magnet =
    "magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01&dn=";
  const result = parseMagnet(magnet);
  assert.equal(result.infohash, "abcdef0123456789abcdef0123456789abcdef01");
  assert.equal(result.displayName, null);
});
