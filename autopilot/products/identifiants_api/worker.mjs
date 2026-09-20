/**
 * API de validation des identifiants d'entreprise et bancaires, France et SEPA.
 *
 * Meme architecture que l'API jours feries: Cloudflare Workers, aucune
 * dependance, aucun stockage, aucune donnee conservee. Un IBAN qui passe par
 * ici n'est ecrit nulle part.
 */

import {
  IBAN_LENGTHS,
  InputError,
  VAT_FORMATS,
  checkIban,
  checkRib,
  checkSiren,
  checkSiret,
  checkVat,
  ribKey,
  vatFromSiren,
} from "./engine.mjs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-RapidAPI-Proxy-Secret, X-RapidAPI-Key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// une validation ne depend que de son entree, donc elle se cache
const CACHE_LONG = "public, max-age=86400";
const MAX_BATCH = 100;

function json(payload, { status = 200, cache = CACHE_LONG, filename = null } = {}) {
  const headers = { ...JSON_HEADERS, "Cache-Control": cache };
  if (filename) headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  return new Response(JSON.stringify(payload), { status, headers });
}

function fail(message, status = 400) {
  return json({ error: { message } }, { status, cache: "no-store" });
}

function required(p, name) {
  const value = p.get(name);
  if (value === null || value === "") throw new InputError(`parametre ${name} manquant`);
  return value;
}

export const OPERATIONS = {
  iban: (p) => checkIban(required(p, "iban")),
  siren: (p) => checkSiren(required(p, "siren")),
  siret: (p) => checkSiret(required(p, "siret")),
  vat: (p) => checkVat(required(p, "vat")),
  "vat-from-siren": (p) => vatFromSiren(required(p, "siren")),
  rib(p) {
    const bank = required(p, "bank");
    const branch = required(p, "branch");
    const account = required(p, "account");
    const key = p.get("key");
    return key ? checkRib(bank, branch, account, key) : ribKey(bank, branch, account);
  },
  reference: () => ({
    iban_countries: Object.entries(IBAN_LENGTHS).map(([code, length]) => ({ code, length })),
    vat_countries: Object.keys(VAT_FORMATS).map((code) => ({
      code,
      checked: code === "FR" ? "checksum" : "format",
    })),
    note:
      "Validation formelle uniquement. Cette API ne dit jamais si une entreprise ou un compte existe.",
  }),
};

function paramsFromObject(obj) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(obj ?? {})) {
    if (value === null || value === undefined) continue;
    p.set(key, String(value));
  }
  return p;
}

async function handleBatch(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail("corps JSON invalide");
  }
  const operations = body?.operations;
  if (!Array.isArray(operations)) return fail("operations doit etre un tableau");
  if (operations.length === 0) return fail("operations est vide");
  if (operations.length > MAX_BATCH) return fail(`${MAX_BATCH} operations maximum par appel`);

  const results = operations.map((entry, index) => {
    const name = entry?.op;
    const handler = OPERATIONS[name];
    if (!handler) return { index, op: name ?? null, error: `operation inconnue: ${name}` };
    try {
      return { index, op: name, result: handler(paramsFromObject(entry)) };
    } catch (err) {
      if (err instanceof InputError) return { index, op: name, error: err.message };
      throw err;
    }
  });

  return json({ count: results.length, results }, { cache: "no-store" });
}

const ROOT = {
  name: "Validation des identifiants France et SEPA",
  description:
    "IBAN, cle RIB, SIREN, SIRET et TVA intracommunautaire. Validation formelle, sans base de donnees ni appel externe.",
  endpoints: [
    "GET /v1/iban?iban=FR1420041010050500013M02606",
    "GET /v1/rib?bank=20041&branch=01005&account=0500013M026",
    "GET /v1/siren?siren=732829320",
    "GET /v1/siret?siret=35600000009075",
    "GET /v1/vat?vat=FR44732829320",
    "GET /v1/vat-from-siren?siren=732829320",
    "GET /v1/reference",
    "POST /v1/batch",
  ],
  limits: "Validation formelle uniquement, aucune verification d'existence.",
};

export async function handleRequest(request, env = {}) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const secret = env.RAPIDAPI_PROXY_SECRET;

  if (path === "/health") {
    return json({ status: "ok", protected: Boolean(secret) }, { cache: "no-store" });
  }

  if (secret && request.headers.get("X-RapidAPI-Proxy-Secret") !== secret) {
    return fail("acces refuse, passe par la marketplace", 403);
  }

  if (path === "/") return json(ROOT);
  if (path === "/openapi.json") {
    const download = url.searchParams.get("download");
    return json(openapiFor(url), {
      filename: download && download !== "0" ? "openapi.json" : null,
    });
  }

  if (path === "/v1/batch") {
    if (request.method !== "POST") return fail("utilise POST sur /v1/batch", 405);
    try {
      return await handleBatch(request);
    } catch (err) {
      return fail(`erreur interne: ${err.message}`, 500);
    }
  }

  const match = path.match(/^\/v1\/([a-z-]+)$/);
  if (!match) return fail(`route inconnue: ${path}`, 404);
  const handler = OPERATIONS[match[1]];
  if (!handler) return fail(`route inconnue: ${path}`, 404);
  if (request.method !== "GET") return fail("utilise GET sur cette route", 405);

  try {
    return json(handler(url.searchParams));
  } catch (err) {
    if (err instanceof InputError) return fail(err.message);
    return fail(`erreur interne: ${err.message}`, 500);
  }
}

export function openapiFor(url) {
  const origin = typeof url === "string" ? new URL(url).origin : url.origin;
  return { ...OPENAPI, servers: [{ url: origin, description: "production" }] };
}

const stringParam = (name, required = true, example = undefined) => ({
  name, in: "query", required, schema: { type: "string" },
  ...(example === undefined ? {} : { example }),
});

export const OPENAPI = {
  openapi: "3.0.3",
  info: {
    title: "Validation des identifiants France et SEPA",
    version: "1.0.0",
    description:
      "IBAN zone SEPA, cle RIB francaise, SIREN, SIRET et TVA intracommunautaire. Validation formelle par calcul de cle, sans base de donnees ni appel externe. Cette API ne dit jamais si une entreprise ou un compte existe.",
  },
  paths: {
    "/v1/iban": {
      get: {
        summary: "Valider un IBAN de la zone SEPA",
        parameters: [stringParam("iban", true, "FR1420041010050500013M02606")],
        responses: { 200: { description: "validite, pays et BBAN" } },
      },
    },
    "/v1/rib": {
      get: {
        summary: "Calculer ou verifier une cle RIB francaise",
        description: "Sans le parametre key, la cle est calculee. Avec, elle est verifiee.",
        parameters: [
          stringParam("bank", true, "20041"),
          stringParam("branch", true, "01005"),
          stringParam("account", true, "0500013M026"),
          stringParam("key", false, "06"),
        ],
        responses: { 200: { description: "cle calculee ou verdict" } },
      },
    },
    "/v1/siren": {
      get: {
        summary: "Valider un SIREN",
        parameters: [stringParam("siren", true, "732829320")],
        responses: { 200: { description: "validite" } },
      },
    },
    "/v1/siret": {
      get: {
        summary: "Valider un SIRET",
        description: "Gere l'exception La Poste, dont les SIRET ne suivent pas Luhn.",
        parameters: [stringParam("siret", true, "35600000009075")],
        responses: { 200: { description: "validite, SIREN et NIC" } },
      },
    },
    "/v1/vat": {
      get: {
        summary: "Valider un numero de TVA intracommunautaire",
        description:
          "Cle recalculee pour la France. Pour les 26 autres Etats membres, seule la forme est verifiee, et la reponse le dit dans le champ checked.",
        parameters: [stringParam("vat", true, "FR44732829320")],
        responses: { 200: { description: "validite et niveau de verification" } },
      },
    },
    "/v1/vat-from-siren": {
      get: {
        summary: "Calculer le numero de TVA francais a partir d'un SIREN",
        parameters: [stringParam("siren", true, "732829320")],
        responses: { 200: { description: "numero de TVA" } },
      },
    },
    "/v1/reference": {
      get: {
        summary: "Pays couverts et niveau de verification",
        responses: { 200: { description: "reference" } },
      },
    },
    "/v1/batch": {
      post: {
        summary: "Jusqu'a 100 validations en un appel",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  operations: {
                    type: "array",
                    maxItems: MAX_BATCH,
                    items: { type: "object", properties: { op: { type: "string", enum: Object.keys(OPERATIONS) } } },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: "un resultat par operation, erreurs isolees" } },
      },
    },
  },
};

export default { fetch: handleRequest };
