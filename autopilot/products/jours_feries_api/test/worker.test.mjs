import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handleRequest } from "../worker.mjs";

async function call(path, { env = {}, ...init } = {}) {
  const res = await handleRequest(new Request(`https://api.test${path}`, init), env);
  const body = res.headers.get("Content-Type")?.includes("json") ? await res.json() : null;
  return { status: res.status, body, headers: res.headers };
}

describe("routes", () => {
  it("decrit l'api a la racine", async () => {
    const { status, body } = await call("/");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.endpoints));
  });

  it("sert les jours feries", async () => {
    const { status, body } = await call("/v1/holidays?year=2026");
    assert.equal(status, 200);
    assert.equal(body.count, 11);
    assert.equal(body.holidays[0].date, "2026-01-01");
  });

  it("sert l'openapi", async () => {
    const { status, body } = await call("/openapi.json");
    assert.equal(status, 200);
    assert.equal(body.openapi, "3.0.3");
    assert.ok(body.paths["/v1/deadline"]);
  });

  it("liste zones et calendriers", async () => {
    const { body } = await call("/v1/zones");
    assert.equal(body.zones.length, 9);
    assert.equal(body.calendars.length, 3);
  });

  it("calcule une echeance", async () => {
    const { body } = await call("/v1/deadline?from=2026-05-07&delay=1&calendar=calendaires");
    assert.equal(body.deadline, "2026-05-11");
    assert.equal(body.rolled, true);
  });

  it("accepte les fermetures declarees", async () => {
    const { body } = await call("/v1/business-day?date=2026-07-20&closed=2026-07-20");
    assert.equal(body.business_day, false);
    assert.equal(body.reason, "fermeture declaree");
  });

  it("ignore la barre finale", async () => {
    const { status } = await call("/v1/holidays/?year=2026");
    assert.equal(status, 200);
  });

  it("repond sur /health sans authentification", async () => {
    const { status, body } = await call("/health", { env: { RAPIDAPI_PROXY_SECRET: "s3cret" } });
    assert.equal(status, 200);
    assert.equal(body.status, "ok");
  });
});

describe("erreurs", () => {
  it("400 sur parametre manquant", async () => {
    const { status, body } = await call("/v1/holidays");
    assert.equal(status, 400);
    assert.match(body.error.message, /year/);
  });

  it("400 sur annee hors perimetre, avec les bornes dans le message", async () => {
    const { status, body } = await call("/v1/holidays?year=1900");
    assert.equal(status, 400);
    assert.match(body.error.message, /hors perimetre/);
    assert.match(body.error.message, /1982/);
  });

  it("400 sur date invalide", async () => {
    const { status } = await call("/v1/business-day?date=2026-02-30");
    assert.equal(status, 400);
  });

  it("404 sur route inconnue", async () => {
    const { status } = await call("/v1/inconnue");
    assert.equal(status, 404);
  });

  it("405 si mauvaise methode", async () => {
    const { status } = await call("/v1/holidays?year=2026", { method: "POST" });
    assert.equal(status, 405);
  });

  it("ne renvoie jamais de trace interne", async () => {
    const { body } = await call("/v1/add?date=2026-05-06&days=abc");
    assert.ok(!JSON.stringify(body).includes("engine.mjs"));
  });
});

describe("acces marketplace", () => {
  it("refuse sans le secret quand il est configure", async () => {
    const { status, body } = await call("/v1/holidays?year=2026", {
      env: { RAPIDAPI_PROXY_SECRET: "s3cret" },
    });
    assert.equal(status, 403);
    assert.match(body.error.message, /marketplace/);
  });

  it("accepte avec le bon secret", async () => {
    const { status } = await call("/v1/holidays?year=2026", {
      env: { RAPIDAPI_PROXY_SECRET: "s3cret" },
      headers: { "X-RapidAPI-Proxy-Secret": "s3cret" },
    });
    assert.equal(status, 200);
  });

  it("laisse passer tout le monde si aucun secret n'est configure", async () => {
    const { status } = await call("/v1/holidays?year=2026");
    assert.equal(status, 200);
  });
});

describe("batch", () => {
  const post = (payload, opts = {}) =>
    call("/v1/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      ...opts,
    });

  it("traite plusieurs operations", async () => {
    const { status, body } = await post({
      operations: [
        { op: "add", date: "2026-05-06", days: 3 },
        { op: "count", from: "2026-05-01", to: "2026-05-31" },
        { op: "holidays", year: 2026, zone: "reunion" },
      ],
    });
    assert.equal(status, 200);
    assert.equal(body.count, 3);
    assert.equal(body.results[0].result.result, "2026-05-12");
    assert.equal(body.results[1].result.count, 17);
    assert.equal(body.results[2].result.count, 12);
  });

  it("isole l'erreur d'une operation", async () => {
    const { body } = await post({
      operations: [
        { op: "add", date: "2026-05-06", days: 1 },
        { op: "add", date: "pas-une-date", days: 1 },
        { op: "inexistante" },
      ],
    });
    assert.ok(body.results[0].result);
    assert.match(body.results[1].error, /format attendu/);
    assert.match(body.results[2].error, /operation inconnue/);
  });

  it("refuse plus de 100 operations", async () => {
    const operations = Array.from({ length: 101 }, () => ({ op: "holidays", year: 2026 }));
    const { status, body } = await post({ operations });
    assert.equal(status, 400);
    assert.match(body.error.message, /100/);
  });

  it("refuse un corps invalide", async () => {
    const res = await handleRequest(
      new Request("https://api.test/v1/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{pas du json",
      }),
      {},
    );
    assert.equal(res.status, 400);
  });

  it("refuse GET", async () => {
    const { status } = await call("/v1/batch");
    assert.equal(status, 405);
  });
});

describe("entetes", () => {
  it("autorise le navigateur et repond au preflight", async () => {
    const res = await handleRequest(
      new Request("https://api.test/v1/zones", { method: "OPTIONS" }),
      {},
    );
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
  });

  it("met un cache long sur les donnees stables", async () => {
    const { headers } = await call("/v1/holidays?year=2026");
    assert.match(headers.get("Cache-Control"), /max-age=86400/);
  });
});
