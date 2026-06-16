const assert = require("node:assert/strict");
const test = require("node:test");
const { QbittorrentClient } = require("../dist/clients/qbittorrent.js");

function createMockFetch() {
  const calls = [];
  const mock = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    if (url.endsWith("/api/v2/auth/login")) {
      return new Response("Ok.", {
        headers: { "set-cookie": "SID=testsid; HttpOnly; path=/" },
      });
    }
    if (url.includes("/api/v2/torrents/info")) {
      return new Response(
        JSON.stringify([
          {
            hash: "abc123",
            name: "T",
            progress: 1,
            content_path: "/x/T",
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );
    }
    if (url.endsWith("/api/v2/torrents/add")) {
      return new Response("Ok.");
    }
    if (url.endsWith("/api/v2/torrents/delete")) {
      return new Response("Ok.");
    }
    return new Response("Unknown");
  };
  mock.calls = calls;
  return mock;
}

function createEmptyInfoMockFetch() {
  const calls = [];
  const mock = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    if (url.endsWith("/api/v2/auth/login")) {
      return new Response("Ok.", {
        headers: { "set-cookie": "SID=testsid; HttpOnly; path=/" },
      });
    }
    if (url.includes("/api/v2/torrents/info")) {
      return new Response(JSON.stringify([]), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.endsWith("/api/v2/torrents/add")) {
      return new Response("Ok.");
    }
    if (url.endsWith("/api/v2/torrents/delete")) {
      return new Response("Ok.");
    }
    return new Response("Unknown");
  };
  mock.calls = calls;
  return mock;
}

function createLoginFailMockFetch() {
  const calls = [];
  const mock = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    if (url.endsWith("/api/v2/auth/login")) {
      return new Response("Fails.");
    }
    if (url.includes("/api/v2/torrents/info")) {
      return new Response(
        JSON.stringify([
          {
            hash: "abc123",
            name: "T",
            progress: 1,
            content_path: "/x/T",
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );
    }
    if (url.endsWith("/api/v2/torrents/add")) {
      return new Response("Ok.");
    }
    if (url.endsWith("/api/v2/torrents/delete")) {
      return new Response("Ok.");
    }
    return new Response("Unknown");
  };
  mock.calls = calls;
  return mock;
}

const ENDPOINT = {
  url: "http://localhost:8081",
  username: "admin",
  password: "pw",
};

test("addMagnet sends login then add request and returns task with correct downloaderId", async () => {
  const mock = createMockFetch();
  const client = new QbittorrentClient(ENDPOINT, mock);

  const magnet =
    "magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01&dn=Test+Name";
  const result = await client.addMagnet(magnet);

  // Two calls: login, then add
  assert.equal(mock.calls.length, 2);
  assert.ok(mock.calls[0].url.endsWith("/api/v2/auth/login"));
  assert.ok(mock.calls[1].url.endsWith("/api/v2/torrents/add"));
  assert.ok(mock.calls[1].init.body.includes("urls="));

  // downloaderId should be the lowercased hex infohash
  assert.equal(result.downloaderId, "abcdef0123456789abcdef0123456789abcdef01");
  assert.equal(result.infohash, "abcdef0123456789abcdef0123456789abcdef01");
  assert.equal(result.name, "Test Name");
  assert.equal(result.progress, 0);
  assert.equal(result.isComplete, false);
  assert.equal(result.contentPath, null);
});

test("getTask returns task with correct fields and isComplete true", async () => {
  const mock = createMockFetch();
  const client = new QbittorrentClient(ENDPOINT, mock);

  const result = await client.getTask("ABC123");

  assert.notEqual(result, null);
  assert.equal(result.downloaderId, "abc123");
  assert.equal(result.infohash, "abc123");
  assert.equal(result.name, "T");
  assert.equal(result.progress, 1);
  assert.equal(result.isComplete, true);
  assert.equal(result.contentPath, "/x/T");
});

test("getTask returns null when info response is empty", async () => {
  const mock = createEmptyInfoMockFetch();
  const client = new QbittorrentClient(ENDPOINT, mock);

  const result = await client.getTask("ABC123");

  assert.equal(result, null);
});

test("listTasks returns array with mapped tasks", async () => {
  const mock = createMockFetch();
  const client = new QbittorrentClient(ENDPOINT, mock);

  const result = await client.listTasks();

  assert.equal(result.length, 1);
  assert.equal(result[0].downloaderId, "abc123");
  assert.equal(result[0].infohash, "abc123");
  assert.equal(result[0].name, "T");
  assert.equal(result[0].progress, 1);
  assert.equal(result[0].isComplete, true);
  assert.equal(result[0].contentPath, "/x/T");
});

test("removeTask sends delete POST with correct hashes and deleteFiles", async () => {
  const mock = createMockFetch();
  const client = new QbittorrentClient(ENDPOINT, mock);

  await client.removeTask("ABC123", true);

  // Find the delete call (last call after login)
  const deleteCall = mock.calls.find((c) =>
    c.url.endsWith("/api/v2/torrents/delete")
  );
  assert.notEqual(deleteCall, undefined);
  assert.ok(deleteCall.init.body.includes("hashes=abc123"));
  assert.ok(deleteCall.init.body.includes("deleteFiles=true"));
});

test("auth header includes SID cookie on subsequent requests", async () => {
  const mock = createMockFetch();
  const client = new QbittorrentClient(ENDPOINT, mock);

  // Trigger login via any API call
  await client.listTasks();

  // The info call (second call) should have the Cookie header
  const infoCall = mock.calls.find((c) =>
    c.url.includes("/api/v2/torrents/info")
  );
  assert.notEqual(infoCall, undefined);
  const cookie = infoCall.init.headers["Cookie"];
  assert.ok(cookie, "Cookie header should be present");
  assert.ok(cookie.includes("SID=testsid"));
});

test("login failure throws Error without password in message", async () => {
  const mock = createLoginFailMockFetch();
  const client = new QbittorrentClient(ENDPOINT, mock);

  await assert.rejects(
    async () => {
      await client.listTasks();
    },
    (err) => {
      assert.equal(err.message, "qBittorrent login failed");
      assert.ok(!err.message.includes("pw"));
      return true;
    }
  );
});
