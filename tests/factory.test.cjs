const assert = require("node:assert/strict");
const test = require("node:test");

const { createDownloader } = require("../dist/clients/factory.js");
const { loadAdultConfig } = require("../dist/config.js");
const { QbittorrentClient } = require("../dist/clients/qbittorrent.js");
const { TransmissionClient } = require("../dist/clients/transmission.js");

test("createDownloader default config returns QbittorrentClient", () => {
  const config = loadAdultConfig({});
  const downloader = createDownloader(config);
  assert.ok(downloader instanceof QbittorrentClient);
});

test("createDownloader with transmission type returns TransmissionClient", () => {
  const config = loadAdultConfig({ ADULT_DOWNLOADER_TYPE: "transmission" });
  const downloader = createDownloader(config);
  assert.ok(downloader instanceof TransmissionClient);
});
