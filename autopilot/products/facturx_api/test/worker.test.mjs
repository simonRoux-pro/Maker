import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handleRequest } from "../worker.mjs";
import { VALIDE, modifier } from "./fixtures.mjs";

async function call(path, { env = {}, body, type = "application/xml", method } = {}) {
  const init = { method: method ?? (body === undefined ? "GET" : "POST") };
  if (body !== undefined) {
    init.body = body;
    init.headers = { "Content-Type": type };
  }
  const res = await handleRequest(new Request(`https://api.test${path}`, init), env);
  return { status: res.status, body: await res.json(), headers: res.headers };
}

describe("validation", () => {
  it("accepte du XML brut", async () => {
    const { status, body } = await call("/v1/validate", { body: VALIDE });
    assert.equal(status, 200);
    assert.equal(body.valid, true);
    assert.equal(body.profile, "BASIC");
  });

  it("accepte aussi un objet JSON portant le XML", async () => {
    const { body } = await call("/v1/validate", {
      body: JSON.stringify({ xml: VALIDE }),
      type: "application/json",
    });
    assert.equal(body.valid, true);
  });

  it("rend les erreurs en francais avec leur code", async () => {
    const faux = modifier(VALIDE, "<ram:GrandTotalAmount>1200.00</ram:GrandTotalAmount>",
      "<ram:GrandTotalAmount>999.00</ram:GrandTotalAmount>");
    const { body } = await call("/v1/validate", { body: faux });
    assert.equal(body.valid, false);
    const erreur = body.errors.find((e) => e.code === "BR-CO-15");
    assert.ok(erreur);
    assert.match(erreur.message, /total toutes taxes attendu/);
  });

  it("extrait sans juger", async () => {
    const { body } = await call("/v1/extract", { body: VALIDE });
    assert.equal(body.invoice_number, "FA-2026-0001");
    assert.equal(body.totals.grand_total, 1200);
    assert.equal(body.valid, undefined);
  });

  it("refuse un corps vide", async () => {
    const { status, body } = await call("/v1/validate", { body: "" });
    assert.equal(status, 400);
    assert.match(body.error.message, /corps vide/);
  });

  it("refuse GET sur une route de validation", async () => {
    assert.equal((await call("/v1/validate")).status, 405);
  });
});

describe("perimetre annonce", () => {
  it("publie la liste des controles", async () => {
    const { body } = await call("/v1/checks");
    assert.ok(body.count >= 15);
    assert.ok(body.checks.every((c) => c.code));
  });

  it("annonce le calendrier legal a la racine", async () => {
    const { body } = await call("/");
    assert.equal(body.contexte.reception_obligatoire, "2026-09-01, toutes les entreprises assujetties a la TVA");
    assert.match(body.limites, /ne couvre pas l'integralite/);
  });

  it("documente les routes servies", async () => {
    const { body } = await call("/openapi.json");
    assert.deepEqual(Object.keys(body.paths).sort(), ["/v1/checks", "/v1/extract", "/v1/validate"]);
    assert.equal(body.servers[0].url, "https://api.test");
  });
});

describe("acces et sante", () => {
  it("annonce le verrou sans donner sa valeur", async () => {
    const { body } = await call("/health", { env: { RAPIDAPI_PROXY_SECRET: "s3cret" } });
    assert.equal(body.protected, true);
    assert.equal(JSON.stringify(body).includes("s3cret"), false);
  });

  it("refuse une validation sans le secret quand il est pose", async () => {
    const { status } = await call("/v1/validate", {
      body: VALIDE, env: { RAPIDAPI_PROXY_SECRET: "s3cret" },
    });
    assert.equal(status, 403);
  });

  it("ne met jamais une facture en cache", async () => {
    const { headers } = await call("/v1/validate", { body: VALIDE });
    assert.equal(headers.get("Cache-Control"), "no-store");
  });
});
