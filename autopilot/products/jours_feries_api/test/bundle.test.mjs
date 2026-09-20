import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { handleRequest as bundled } from "../dist/worker.bundle.mjs";
import { handleRequest as source } from "../worker.mjs";

const SOURCE = new URL("../dist/worker.bundle.mjs", import.meta.url);

async function body(handler, path, init = {}) {
  const res = await handler(new Request(`https://api.test${path}`, init), {});
  return { status: res.status, json: await res.json() };
}

describe("bundle a coller", () => {
  it("ne contient plus aucun import", () => {
    const text = readFileSync(SOURCE, "utf8");
    assert.equal(/^\s*import\s/m.test(text), false);
  });

  it("expose le meme export par defaut", async () => {
    const mod = await import("../dist/worker.bundle.mjs");
    assert.equal(typeof mod.default.fetch, "function");
  });

  it("repond exactement comme la source", async () => {
    const routes = [
      "/v1/holidays?year=2026&zone=alsace-moselle",
      "/v1/deadline?from=2026-05-07&delay=1&calendar=calendaires",
      "/v1/count?from=2026-05-01&to=2026-05-31",
      "/v1/zones",
      "/v1/inconnue",
      "/v1/holidays?year=1900",
    ];
    for (const route of routes) {
      const a = await body(source, route);
      const b = await body(bundled, route);
      assert.deepEqual(b, a, route);
    }
  });

  it("garde la protection de la marketplace", async () => {
    const res = await bundled(
      new Request("https://api.test/v1/zones"),
      { RAPIDAPI_PROXY_SECRET: "s3cret" },
    );
    assert.equal(res.status, 403);
  });
});
