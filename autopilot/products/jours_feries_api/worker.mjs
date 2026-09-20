/**
 * API HTTP jours feries, jours ouvres et delais en droit francais.
 *
 * Compatible Cloudflare Workers (export default { fetch }) et Node via
 * server.mjs. Aucune dependance, aucun stockage, aucune donnee utilisateur
 * conservee: rien a securiser cote donnees personnelles.
 *
 * Si la variable RAPIDAPI_PROXY_SECRET est definie, seules les requetes
 * portant l'en-tete correspondant sont servies. C'est ce qui empeche de
 * contourner la facturation de la marketplace en tapant l'URL directement.
 */

import {
  InputError,
  MAX_YEAR,
  MIN_YEAR,
  ZONES,
  addDays,
  countDays,
  deadline,
  holidays,
  isBusinessDay,
  nextBusinessDay,
  previousBusinessDay,
} from "./engine.mjs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-RapidAPI-Proxy-Secret, X-RapidAPI-Key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// les jours feries d'une annee passee ne changent jamais, on peut cacher fort
const CACHE_LONG = "public, max-age=86400";
const MAX_BATCH = 100;

function json(payload, { status = 200, cache = CACHE_LONG, filename = null } = {}) {
  const headers = { ...JSON_HEADERS, "Cache-Control": cache };
  if (filename) {
    // force le telechargement au lieu de l'affichage: c'est la seule facon
    // simple de recuperer le fichier depuis un telephone
    headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function fail(message, status = 400) {
  return json({ error: { message } }, { status, cache: "no-store" });
}

function intParam(params, name, { required = true, min = -100000, max = 100000 } = {}) {
  const raw = params.get(name);
  if (raw === null || raw === "") {
    if (required) throw new InputError(`parametre ${name} manquant`);
    return null;
  }
  if (!/^-?\d+$/.test(raw.trim())) throw new InputError(`${name} doit etre un entier`);
  const value = Number(raw);
  if (value < min || value > max) throw new InputError(`${name} hors bornes`);
  return value;
}

function common(params) {
  return {
    zone: params.get("zone") ?? "metropole",
    calendar: params.get("calendar") ?? "ouvres",
    closed: params.get("closed") ?? null,
  };
}

/** Une operation, appelee soit par une route GET soit par le batch. */
export const OPERATIONS = {
  holidays(p) {
    // les bornes sont verifiees par le moteur, qui dit precisement pourquoi
    const year = intParam(p, "year");
    const zone = p.get("zone") ?? "metropole";
    const list = holidays(year, zone);
    return { year, zone, count: list.length, holidays: list };
  },
  "business-day"(p) {
    const date = p.get("date");
    if (!date) throw new InputError("parametre date manquant");
    return isBusinessDay(date, common(p));
  },
  add(p) {
    const date = p.get("date");
    if (!date) throw new InputError("parametre date manquant");
    return addDays(date, intParam(p, "days"), common(p));
  },
  count(p) {
    const from = p.get("from");
    const to = p.get("to");
    if (!from || !to) throw new InputError("parametres from et to obligatoires");
    return countDays(from, to, { ...common(p), inclusive: p.get("inclusive") !== "false" });
  },
  deadline(p) {
    const from = p.get("from");
    if (!from) throw new InputError("parametre from manquant");
    return deadline(from, {
      ...common(p),
      delay: intParam(p, "delay", { min: 0 }),
      unit: p.get("unit") ?? "days",
      rollover: p.get("rollover") ?? "next_business_day",
      rollover_calendar: p.get("rollover_calendar") ?? "ouvres",
    });
  },
  next(p) {
    const date = p.get("date");
    if (!date) throw new InputError("parametre date manquant");
    return nextBusinessDay(date, common(p));
  },
  previous(p) {
    const date = p.get("date");
    if (!date) throw new InputError("parametre date manquant");
    return previousBusinessDay(date, common(p));
  },
  zones() {
    return {
      zones: Object.entries(ZONES).map(([id, z]) => ({ id, label: z.label })),
      calendars: [
        { id: "ouvres", label: "jours ouvres, lundi a vendredi hors feries" },
        { id: "ouvrables", label: "jours ouvrables, lundi a samedi hors feries" },
        { id: "calendaires", label: "tous les jours" },
      ],
      coverage: { min_year: MIN_YEAR, max_year: MAX_YEAR },
    };
  },
};

function paramsFromObject(obj) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(obj ?? {})) {
    if (value === null || value === undefined) continue;
    p.set(key, Array.isArray(value) ? value.join(",") : String(value));
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
  name: "API jours feries et delais France",
  description:
    "Jours feries legaux, jours ouvres et ouvrables, calcul de delais avec report au premier jour ouvrable. Metropole, Alsace-Moselle et outre-mer.",
  coverage: { min_year: MIN_YEAR, max_year: MAX_YEAR },
  endpoints: [
    "GET /v1/holidays?year=2026&zone=metropole",
    "GET /v1/business-day?date=2026-05-08",
    "GET /v1/add?date=2026-05-06&days=3&calendar=ouvres",
    "GET /v1/count?from=2026-05-01&to=2026-05-31&calendar=ouvres",
    "GET /v1/deadline?from=2026-05-07&delay=14&unit=days&calendar=calendaires",
    "GET /v1/next?date=2026-05-07",
    "GET /v1/previous?date=2026-05-11",
    "GET /v1/zones",
    "POST /v1/batch",
  ],
};

export async function handleRequest(request, env = {}) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  const secret = env.RAPIDAPI_PROXY_SECRET;

  // /health reste accessible sans secret: c'est la sonde de la marketplace,
  // et le seul moyen de savoir si le verrou est actif sans avoir a deviner.
  // Elle dit si un secret est configure, jamais sa valeur.
  if (path === "/health") {
    return json(
      { status: "ok", protected: Boolean(secret) },
      { cache: "no-store" },
    );
  }

  if (secret && request.headers.get("X-RapidAPI-Proxy-Secret") !== secret) {
    return fail("acces refuse, passe par la marketplace", 403);
  }

  if (path === "/") return json(ROOT);
  if (path === "/openapi.json") {
    // ?download=1 renvoie le meme contenu, mais en piece jointe
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

/**
 * La specification est servie avec l'URL reelle de l'appel comme serveur.
 * Ainsi un import depuis une marketplace pointe toujours sur le bon domaine,
 * sans avoir a maintenir une URL en dur dans le code.
 */
export function openapiFor(url) {
  const origin = typeof url === "string" ? new URL(url).origin : url.origin;
  return { ...OPENAPI, servers: [{ url: origin, description: "production" }] };
}

export const OPENAPI = {
  openapi: "3.0.3",
  info: {
    title: "Jours feries et delais France",
    version: "1.0.0",
    description:
      "Jours feries legaux francais, jours ouvres et ouvrables, arithmetique de dates et calcul d'echeances avec report au premier jour ouvrable suivant.",
  },
  paths: {
    "/v1/holidays": {
      get: {
        summary: "Jours feries legaux d'une annee",
        parameters: [
          { name: "year", in: "query", required: true, schema: { type: "integer", minimum: MIN_YEAR, maximum: MAX_YEAR } },
          { name: "zone", in: "query", schema: { type: "string", enum: Object.keys(ZONES), default: "metropole" } },
        ],
        responses: { 200: { description: "liste triee" } },
      },
    },
    "/v1/business-day": {
      get: {
        summary: "Un jour est-il ouvre",
        parameters: [
          { name: "date", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "calendar", in: "query", schema: { type: "string", enum: ["ouvres", "ouvrables", "calendaires"] } },
          { name: "zone", in: "query", schema: { type: "string", enum: Object.keys(ZONES) } },
          { name: "closed", in: "query", description: "dates de fermeture propres a l'entreprise, separees par des virgules", schema: { type: "string" } },
        ],
        responses: { 200: { description: "verdict et motif" } },
      },
    },
    "/v1/add": {
      get: {
        summary: "Ajouter ou retirer des jours",
        parameters: [
          { name: "date", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "days", in: "query", required: true, schema: { type: "integer" } },
          { name: "calendar", in: "query", schema: { type: "string", enum: ["ouvres", "ouvrables", "calendaires"] } },
          { name: "zone", in: "query", schema: { type: "string", enum: Object.keys(ZONES) } },
          { name: "closed", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "date resultat" } },
      },
    },
    "/v1/count": {
      get: {
        summary: "Compter les jours entre deux dates",
        parameters: [
          { name: "from", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "to", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "calendar", in: "query", schema: { type: "string", enum: ["ouvres", "ouvrables", "calendaires"] } },
          { name: "zone", in: "query", schema: { type: "string", enum: Object.keys(ZONES) } },
          { name: "inclusive", in: "query", schema: { type: "boolean", default: true } },
        ],
        responses: { 200: { description: "compte" } },
      },
    },
    "/v1/deadline": {
      get: {
        summary: "Echeance d'un delai, avec report legal",
        description:
          "unit=months applique l'article 641 du code de procedure civile, rollover=next_business_day applique l'article 642.",
        parameters: [
          { name: "from", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "delay", in: "query", required: true, schema: { type: "integer", minimum: 0 } },
          { name: "unit", in: "query", schema: { type: "string", enum: ["days", "months", "years"], default: "days" } },
          { name: "calendar", in: "query", schema: { type: "string", enum: ["ouvres", "ouvrables", "calendaires"] } },
          { name: "rollover", in: "query", schema: { type: "string", enum: ["none", "next_business_day", "previous_business_day"] } },
          { name: "zone", in: "query", schema: { type: "string", enum: Object.keys(ZONES) } },
          { name: "closed", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "echeance brute et echeance reportee" } },
      },
    },
    "/v1/next": { get: { summary: "Jour ouvre suivant", parameters: [{ name: "date", in: "query", required: true, schema: { type: "string", format: "date" } }], responses: { 200: { description: "date" } } } },
    "/v1/previous": { get: { summary: "Jour ouvre precedent", parameters: [{ name: "date", in: "query", required: true, schema: { type: "string", format: "date" } }], responses: { 200: { description: "date" } } } },
    "/v1/zones": { get: { summary: "Zones et calendriers disponibles", responses: { 200: { description: "reference" } } } },
    "/v1/batch": {
      post: {
        summary: "Jusqu'a 100 operations en un appel",
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
