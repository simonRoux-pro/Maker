/**
 * API de controle de conformite des factures electroniques francaises.
 *
 * L'obligation de reception est entree en vigueur le 1er septembre 2026 pour
 * toute entreprise assujettie a la TVA. Celle d'emettre suit au 1er septembre
 * 2027 pour les PME et TPE.
 *
 * Aucune dependance, aucun stockage. Une facture envoyee ici est analysee en
 * memoire puis oubliee: c'est une condition pour qu'un comptable accepte de
 * s'en servir.
 */

import { InputError, XmlError, checksPerformed, extract, validate } from "./engine.mjs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-RapidAPI-Proxy-Secret, X-RapidAPI-Key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const MAX_BODY = 2 * 1024 * 1024;

function json(payload, { status = 200, cache = "no-store", filename = null } = {}) {
  const headers = { ...JSON_HEADERS, "Cache-Control": cache };
  if (filename) headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  return new Response(JSON.stringify(payload), { status, headers });
}

function fail(message, status = 400) {
  return json({ error: { message } }, { status });
}

/** Le XML arrive soit brut, soit dans un champ xml d'un objet JSON. */
async function readXml(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new InputError("corps trop volumineux, 2 Mo maximum");
  const type = request.headers.get("Content-Type") ?? "";
  if (type.includes("json")) {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new InputError("corps JSON invalide");
    }
    if (typeof body?.xml !== "string") throw new InputError("le champ xml est obligatoire");
    return body.xml;
  }
  if (!raw.trim()) throw new InputError("corps vide: envoyez le XML de la facture");
  return raw;
}

const ROOT = {
  name: "Controle de conformite des factures electroniques",
  description:
    "Valide une facture au format CII, celui que Factur-X embarque. Structure, mentions obligatoires et coherence arithmetique des totaux.",
  contexte: {
    reception_obligatoire: "2026-09-01, toutes les entreprises assujetties a la TVA",
    emission_grandes_entreprises: "2026-09-01",
    emission_pme_tpe: "2027-09-01",
  },
  endpoints: [
    "POST /v1/validate   corps: le XML de la facture",
    "POST /v1/extract    corps: le XML, reponse: les donnees lues",
    "GET  /v1/checks     liste des controles exerces",
  ],
  limites:
    "Ce controle ne couvre pas l'integralite des regles EN 16931. La liste exacte est sur /v1/checks.",
};

export async function handleRequest(request, env = {}) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const secret = env.RAPIDAPI_PROXY_SECRET;

  if (path === "/health") {
    return json({ status: "ok", protected: Boolean(secret) });
  }
  if (secret && request.headers.get("X-RapidAPI-Proxy-Secret") !== secret) {
    return fail("acces refuse, passe par la marketplace", 403);
  }

  if (path === "/") return json(ROOT, { cache: "public, max-age=3600" });
  if (path === "/openapi.json") {
    const download = url.searchParams.get("download");
    return json(openapiFor(url), {
      cache: "public, max-age=3600",
      filename: download && download !== "0" ? "openapi.json" : null,
    });
  }
  if (path === "/v1/checks") {
    return json(
      { count: checksPerformed().length, checks: checksPerformed() },
      { cache: "public, max-age=86400" },
    );
  }

  if (path === "/v1/validate" || path === "/v1/extract") {
    if (request.method !== "POST") return fail("utilise POST sur cette route", 405);
    let xml;
    try {
      xml = await readXml(request);
    } catch (err) {
      if (err instanceof InputError) return fail(err.message);
      return fail(`erreur interne: ${err.message}`, 500);
    }
    try {
      return json(path === "/v1/validate" ? validate(xml) : extract(xml));
    } catch (err) {
      if (err instanceof InputError || err instanceof XmlError) return fail(err.message);
      return fail(`erreur interne: ${err.message}`, 500);
    }
  }

  return fail(`route inconnue: ${path}`, 404);
}

export function openapiFor(url) {
  const origin = typeof url === "string" ? new URL(url).origin : url.origin;
  return { ...OPENAPI, servers: [{ url: origin, description: "production" }] };
}

const XML_BODY = {
  required: true,
  content: {
    "application/xml": { schema: { type: "string" } },
    "application/json": {
      schema: { type: "object", properties: { xml: { type: "string" } }, required: ["xml"] },
    },
  },
};

export const OPENAPI = {
  openapi: "3.0.3",
  info: {
    title: "French e-invoice compliance check",
    version: "1.0.0",
    description:
      "Validate a French electronic invoice in CII format, the one embedded in Factur-X. Checks structure, mandatory business terms and the arithmetic consistency of totals, which is where real invoices fail. Receiving electronic invoices is mandatory in France since 1 September 2026 for every VAT-registered business.",
  },
  paths: {
    "/v1/validate": {
      post: {
        summary: "Valider une facture CII",
        requestBody: XML_BODY,
        responses: { 200: { description: "verdict, erreurs et avertissements en francais" } },
      },
    },
    "/v1/extract": {
      post: {
        summary: "Lire une facture CII sans la juger",
        requestBody: XML_BODY,
        responses: { 200: { description: "donnees structurees de la facture" } },
      },
    },
    "/v1/checks": {
      get: {
        summary: "Liste des controles exerces",
        responses: { 200: { description: "perimetre exact du controle" } },
      },
    },
  },
};

export default { fetch: handleRequest };
