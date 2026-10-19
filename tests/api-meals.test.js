import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeHandler } from "../api/meals.js";

test("retired REST endpoint always returns 410 without accessing credentials, payload or storage", async () => {
  for (const method of ["GET", "POST", "PUT", "DELETE"]) {
    const req = {
      method,
      get body() {
        throw Error("Retired endpoint must not inspect payloads");
      },
      get headers() {
        throw Error("Retired endpoint must not inspect credentials");
      },
    };
    const res = {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(v) {
        this.code = v;
        return this;
      },
      json(v) {
        this.body = v;
        return this;
      },
    };
    await makeHandler(() => {
      throw Error("No database client may be created");
    })(req, res);
    assert.equal(res.code, 410);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(res.headers.Location, undefined);
    assert.equal(res.body.error, "legacy_action_retired");
    assert.ok(res.body.mcp_url.endsWith("/mcp"));
    assert.equal(Object.hasOwn(res.body, "meal"), false);
  }
});

test("published legacy Action schema and instructions no longer advertise writes or key creation", async () => {
  const schema = JSON.parse(
    await readFile(
      new URL("../public/chatgpt/openapi.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(schema.paths, {});
  assert.equal(schema.components?.securitySchemes, undefined);
  const instructions = await readFile(
    new URL("../public/chatgpt/instructions.txt", import.meta.url),
    "utf8",
  );
  assert.match(instructions, /HTTP 410/);
  assert.match(instructions, /MCP\/OAuth/);
});
