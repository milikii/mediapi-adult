const assert = require("node:assert/strict");
const test = require("node:test");
const { TransmissionClient } = require("../dist/clients/transmission.js");

function createMockFetch() {
  const calls = [];
  const mock = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    const headers = init.headers ?? {};
    if (!headers["X-Transmission-Session-Id"]) {
      return new Response("", {
        status: 409,
        headers: { "x-transmission-session-id": "sess-1" },
      });
    }
    const body = JSON.parse(init.body);
    switch (body.method) {
      case "torrent-add":
        return new Response(
          JSON.stringify({
            result: "success",
            arguments: {
              "torrent-added": {
                hashString: "abc123",
                id: 1,
                name: "T",
              },
            },
          })
        );
      case "torrent-get":
        return new Response(
          JSON.stringify({
            result: "success",
            arguments: {
              torrents: [
                {
                  hashString: "abc123",
                  name: "T",
                  percentDone: 1,
                  downloadDir: "/d",
                },
              ],
            },
          })
        );
      case "torrent-remove":
        return new Response(
          JSON.stringify({ result: "success", arguments: {} })
        );
      default:
        return new Response(
          JSON.stringify({ result: "error", arguments: {} })
        );
    }
  };
  mock.calls = calls;
  return mock;
}

function createEmptyInfoMockFetch() {
  const calls = [];
  const mock = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    const headers = init.headers ?? {};
    if (!headers["X-Transmission-Session-Id"]) {
      return new Response("", {
        status: 409,
        headers: { "x-transmission-session-id": "sess-1" },
      });
    }
    const body = JSON.parse(init.body);
    if (body.method === "torrent-get") {
      return new Response(
        JSON.stringify({ result: "success", arguments: { torrents: [] } })
      );
    }
    return new Response(
      JSON.stringify({ result: "success", arguments: {} })
    );
  };
  mock.calls = calls;
  return mock;
}

function createErrorMockFetch() {
  const calls = [];
  const mock = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    const headers = init.headers ?? {};
    if (!headers["X-Transmission-Session-Id"]) {
      return new Response("", {
        status: 409,
        headers: { "x-transmission-session-id": "sess-1" },
      });
    }
    return new Response(
      JSON.stringify({ result: "error", arguments: {} })
    );
  };
  mock.calls = calls;
  return mock;
}

const ENDPOINT = {
  url: "http://localhost:9092",
  username: "tr",
  password: "pw",
};

test("addMagnet returns task with correct downloaderId", async () => {
  const mock = createMockFetch();
  const client = new TransmissionClient(ENDPOINT, mock);

  const magnet =
    "magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01&dn=T";
  const result = await client.addMagnet(magnet);

  assert.equal(result.downloaderId, "abc123");
  assert.equal(result.infohash, "abcdef0123456789abcdef0123456789abcdef01");
  assert.equal(result.name, "T");
  assert.equal(result.progress, 0);
  assert.equal(result.isComplete, false);
  assert.equal(result.contentPath, null);
});

test("getTask returns task with correct fields and isComplete true", async () => {
  const mock = createMockFetch();
  const client = new TransmissionClient(ENDPOINT, mock);

  const result = await client.getTask("ABC123");

  assert.notEqual(result, null);
  assert.equal(result.downloaderId, "abc123");
  assert.equal(result.infohash, "abc123");
  assert.equal(result.name, "T");
  assert.equal(result.progress, 1);
  assert.equal(result.isComplete, true);
  assert.equal(result.contentPath, "/d/T");
});

test("getTask returns null when torrents list is empty", async () => {
  const mock = createEmptyInfoMockFetch();
  const client = new TransmissionClient(ENDPOINT, mock);

  const result = await client.getTask("ABC123");

  assert.equal(result, null);
});

test("listTasks returns array with mapped tasks", async () => {
  const mock = createMockFetch();
  const client = new TransmissionClient(ENDPOINT, mock);

  const result = await client.listTasks();

  assert.equal(result.length, 1);
  assert.equal(result[0].downloaderId, "abc123");
  assert.equal(result[0].infohash, "abc123");
  assert.equal(result[0].name, "T");
  assert.equal(result[0].progress, 1);
  assert.equal(result[0].isComplete, true);
  assert.equal(result[0].contentPath, "/d/T");
});

test("removeTask sends correct body with delete-local-data and lowercased id", async () => {
  const mock = createMockFetch();
  const client = new TransmissionClient(ENDPOINT, mock);

  await client.removeTask("ABC123", true);

  const removeCall = mock.calls.find((c) => {
    try {
      return JSON.parse(c.init.body).method === "torrent-remove";
    } catch {
      return false;
    }
  });
  assert.notEqual(removeCall, undefined);
  const parsedBody = JSON.parse(removeCall.init.body);
  assert.equal(parsedBody.method, "torrent-remove");
  assert.deepEqual(parsedBody.arguments.ids, ["abc123"]);
  assert.equal(parsedBody.arguments["delete-local-data"], true);
});

test("409 handshake stores session-id and retries with correct header", async () => {
  const mock = createMockFetch();
  const client = new TransmissionClient(ENDPOINT, mock);

  await client.listTasks();

  assert.equal(mock.calls.length, 2);
  // First call: no X-Transmission-Session-Id
  assert.equal(
    mock.calls[0].init.headers["X-Transmission-Session-Id"],
    undefined
  );
  // Second call (retry): has session-id
  assert.equal(
    mock.calls[1].init.headers["X-Transmission-Session-Id"],
    "sess-1"
  );
});

test("Authorization header is present and starts with Basic", async () => {
  const mock = createMockFetch();
  const client = new TransmissionClient(ENDPOINT, mock);

  await client.listTasks();

  // All recorded calls should have the Authorization header
  for (const call of mock.calls) {
    assert.ok(
      call.init.headers["Authorization"],
      "Authorization header should be present"
    );
    assert.ok(
      call.init.headers["Authorization"].startsWith("Basic "),
      "Authorization should start with Basic "
    );
  }
});

test("RPC error throws Transmission RPC error without credentials", async () => {
  const mock = createErrorMockFetch();
  const client = new TransmissionClient(ENDPOINT, mock);

  await assert.rejects(
    async () => {
      await client.getTask("ABC123");
    },
    (err) => {
      assert.equal(err.message, "Transmission RPC error");
      assert.ok(!err.message.includes("pw"));
      return true;
    }
  );
});
