import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handleRequest } from "../worker.mjs";

async function call(path, { env = {}, ...init } = {}) {
  const res = await handleRequest(new Request(`https://api.test${path}`, init), env);
  return { status: res.status, body: await res.json(), headers: res.headers };
}

describe("routes", () => {
  it("decrit l'api et ses limites a la racine", async () => {
    const { status, body } = await call("/");
    assert.equal(status, 200);
    assert.match(body.limits, /aucune verification d'existence/);
  });

  it("valide un IBAN", async () => {
    const { body } = await call("/v1/iban?iban=FR1420041010050500013M02606");
    assert.equal(body.valid, true);
  });

  it("calcule une cle RIB sans le parametre key", async () => {
    const { body } = await call("/v1/rib?bank=20041&branch=01005&account=0500013M026");
    assert.equal(body.key, "06");
    assert.equal(body.valid, undefined);
  });

  it("verifie une cle RIB avec le parametre key", async () => {
    const { body } = await call("/v1/rib?bank=20041&branch=01005&account=0500013M026&key=06");
    assert.equal(body.valid, true);
  });

  it("valide un NIR et ventile une TVA", async () => {
    assert.equal((await call("/v1/nir?nir=269054958815780")).body.valid, true);
    const tva = await call("/v1/vat-amount?amount=100&rate=20");
    assert.equal(tva.body.ttc, 120);
  });

  it("donne la reference des pays couverts", async () => {
    const { body } = await call("/v1/reference");
    assert.equal(body.iban_countries.length, 37);
    assert.equal(body.vat_countries.length, 27);
    assert.equal(
      body.vat_countries.filter((c) => c.checked === "checksum").length,
      1,
      "seule la France est verifiee par calcul de cle",
    );
  });

  it("400 sur parametre manquant", async () => {
    const { status, body } = await call("/v1/iban");
    assert.equal(status, 400);
    assert.match(body.error.message, /iban/);
  });

  it("404 sur route inconnue", async () => {
    assert.equal((await call("/v1/inconnue")).status, 404);
  });

  it("405 si mauvaise methode", async () => {
    assert.equal((await call("/v1/siren?siren=732829320", { method: "POST" })).status, 405);
  });
});

describe("acces marketplace", () => {
  it("refuse sans le secret quand il est configure", async () => {
    const { status } = await call("/v1/iban?iban=FR1420041010050500013M02606", {
      env: { RAPIDAPI_PROXY_SECRET: "s3cret" },
    });
    assert.equal(status, 403);
  });

  it("laisse /health accessible et annonce le verrou", async () => {
    const ferme = await call("/health", { env: { RAPIDAPI_PROXY_SECRET: "s3cret" } });
    assert.equal(ferme.status, 200);
    assert.equal(ferme.body.protected, true);
    assert.equal(JSON.stringify(ferme.body).includes("s3cret"), false);

    const ouvert = await call("/health");
    assert.equal(ouvert.body.protected, false);
  });
});

describe("batch", () => {
  const post = (payload) =>
    call("/v1/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  it("melange les types de validation dans un seul appel", async () => {
    const { body } = await post({
      operations: [
        { op: "iban", iban: "DE89370400440532013000" },
        { op: "siren", siren: "732829320" },
        { op: "vat-from-siren", siren: "732829320" },
      ],
    });
    assert.equal(body.count, 3);
    assert.equal(body.results[0].result.valid, true);
    assert.equal(body.results[2].result.vat_number, "FR44732829320");
  });

  it("isole l'erreur d'une operation", async () => {
    const { body } = await post({
      operations: [{ op: "siren", siren: "732829320" }, { op: "rib", bank: "1" }],
    });
    assert.equal(body.results[0].result.valid, true);
    assert.match(body.results[1].error, /branch/);
  });

  it("refuse plus de 100 operations", async () => {
    const operations = Array.from({ length: 101 }, () => ({ op: "siren", siren: "732829320" }));
    assert.equal((await post({ operations })).status, 400);
  });
});

describe("specification", () => {
  it("annonce le domaine appele", async () => {
    const { body } = await call("/openapi.json");
    assert.equal(body.servers[0].url, "https://api.test");
  });

  it("documente exactement les routes servies", async () => {
    const { body } = await call("/openapi.json");
    assert.deepEqual(Object.keys(body.paths).sort(), [
      "/v1/batch", "/v1/iban", "/v1/nir", "/v1/reference", "/v1/rib",
      "/v1/siren", "/v1/siret", "/v1/vat", "/v1/vat-amount", "/v1/vat-from-siren",
    ]);
  });

  it("se telecharge avec download=1", async () => {
    const { headers } = await call("/openapi.json?download=1");
    assert.equal(headers.get("Content-Disposition"), 'attachment; filename="openapi.json"');
  });
});
