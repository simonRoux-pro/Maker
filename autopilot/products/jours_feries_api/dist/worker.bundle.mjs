/**
 * Fichier genere par build.mjs, ne pas modifier a la main.
 * Source: engine.mjs + worker.mjs du meme dossier.
 *
 * A coller dans l'editeur Cloudflare Workers. Aucune dependance.
 */

/**
 * Moteur de calcul des jours feries, jours ouvres et delais en droit francais.
 *
 * Pur calcul: aucune dependance, aucun appel reseau, aucun etat. Tout est
 * deterministe et testable, ce qui est la seule raison pour laquelle on peut
 * le vendre sans le surveiller.
 *
 * Perimetre assume: 1982 a 2100. Le 8 mai n'est ferie sans interruption que
 * depuis la loi du 2 octobre 1981, donc avant 1982 le calcul serait faux et
 * on refuse plutot que de mentir.
 */

export const MIN_YEAR = 1982;
export const MAX_YEAR = 2100;

const DAY = 86400000;

/** Zones: metropole, Alsace-Moselle et collectivites d'outre-mer. */
export const ZONES = {
  metropole: { label: "France metropolitaine" },
  "alsace-moselle": { label: "Bas-Rhin, Haut-Rhin, Moselle" },
  guadeloupe: { label: "Guadeloupe" },
  "saint-martin": { label: "Saint-Martin" },
  "saint-barthelemy": { label: "Saint-Barthelemy" },
  martinique: { label: "Martinique" },
  guyane: { label: "Guyane" },
  reunion: { label: "La Reunion" },
  mayotte: { label: "Mayotte" },
};

/** Jour supplementaire propre a chaque collectivite: abolition de l'esclavage. */
const ABOLITION = {
  mayotte: [4, 27],
  martinique: [5, 22],
  guadeloupe: [5, 27],
  "saint-martin": [5, 28],
  guyane: [6, 10],
  "saint-barthelemy": [10, 9],
  reunion: [12, 20],
};

/**
 * useClosed: une fermeture d'entreprise retire un jour ouvre, mais ne retire
 * pas un jour calendaire. Un delai en jours calendaires ne s'allonge pas
 * parce que la boite est fermee, il se reporte seulement a son echeance.
 */
export const CALENDARS = {
  // jours ouvres: du lundi au vendredi, feries exclus
  ouvres: { weekend: [0, 6], skipHolidays: true, useClosed: true },
  // jours ouvrables: du lundi au samedi, feries exclus
  ouvrables: { weekend: [0], skipHolidays: true, useClosed: true },
  // jours calendaires: tous les jours, feries et fermetures inclus
  calendaires: { weekend: [], skipHolidays: false, useClosed: false },
};

export class InputError extends Error {}

// ---------------------------------------------------------------- dates

export function parseDate(value, field = "date") {
  if (value instanceof Date) return utc(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InputError(`${field} invalide, format attendu AAAA-MM-JJ`);
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = utc(y, m, d);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== m || date.getUTCDate() !== d) {
    throw new InputError(`${field} inexistante: ${value}`);
  }
  checkYear(y, field);
  return date;
}

export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function utc(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function checkYear(year, field = "annee") {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new InputError(`${field} hors perimetre, ${MIN_YEAR} a ${MAX_YEAR} seulement`);
  }
}

function shift(date, days) {
  return new Date(date.getTime() + days * DAY);
}

// ---------------------------------------------------------------- feries

/** Dimanche de Paques, algorithme gregorien anonyme. */
export function easterSunday(year) {
  checkYear(year);
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

export function normalizeZone(zone) {
  const key = String(zone ?? "metropole").toLowerCase().trim();
  if (!(key in ZONES)) {
    throw new InputError(`zone inconnue: ${zone}, valeurs possibles ${Object.keys(ZONES).join(", ")}`);
  }
  return key;
}

/** Liste triee des jours feries legaux d'une annee pour une zone. */
export function holidays(year, zone = "metropole") {
  checkYear(year);
  const key = normalizeZone(zone);
  const easter = easterSunday(year);
  const list = [
    { date: utc(year, 1, 1), name: "Jour de l'an" },
    { date: shift(easter, 1), name: "Lundi de Paques" },
    { date: utc(year, 5, 1), name: "Fete du Travail" },
    { date: utc(year, 5, 8), name: "Victoire 1945" },
    { date: shift(easter, 39), name: "Ascension" },
    { date: shift(easter, 50), name: "Lundi de Pentecote" },
    { date: utc(year, 7, 14), name: "Fete nationale" },
    { date: utc(year, 8, 15), name: "Assomption" },
    { date: utc(year, 11, 1), name: "Toussaint" },
    { date: utc(year, 11, 11), name: "Armistice 1918" },
    { date: utc(year, 12, 25), name: "Noel" },
  ];

  if (key === "alsace-moselle") {
    list.push({ date: shift(easter, -2), name: "Vendredi saint" });
    list.push({ date: utc(year, 12, 26), name: "Saint Etienne" });
  }

  const abolition = ABOLITION[key];
  if (abolition) {
    list.push({
      date: utc(year, abolition[0], abolition[1]),
      name: "Abolition de l'esclavage",
    });
  }

  return list
    .sort((a, b) => a.date - b.date)
    .map((h) => ({ date: formatDate(h.date), name: h.name }));
}

// ---------------------------------------------------------------- jours

function holidaySet(year, zone) {
  return new Set(holidays(year, zone).map((h) => h.date));
}

function closedSet(closed) {
  if (!closed) return new Set();
  const values = Array.isArray(closed) ? closed : String(closed).split(",");
  return new Set(
    values
      .map((v) => String(v).trim())
      .filter(Boolean)
      .map((v) => formatDate(parseDate(v, "closed"))),
  );
}

function calendarOf(name) {
  const key = String(name ?? "ouvres").toLowerCase().trim();
  if (!(key in CALENDARS)) {
    throw new InputError(`calendrier inconnu: ${name}, valeurs possibles ${Object.keys(CALENDARS).join(", ")}`);
  }
  return { key, ...CALENDARS[key] };
}

/** Contexte reutilisable, pour ne pas recalculer les feries a chaque jour. */
function makeContext({ zone, calendar, closed }) {
  const zoneKey = normalizeZone(zone);
  const cal = calendarOf(calendar);
  const extra = closedSet(closed);
  const cache = new Map();
  const holidaysOf = (year) => {
    if (!cache.has(year)) cache.set(year, holidaySet(year, zoneKey));
    return cache.get(year);
  };
  return {
    zone: zoneKey,
    calendar: cal.key,
    closedCount: extra.size,
    isHoliday(date) {
      return holidaysOf(date.getUTCFullYear()).has(formatDate(date));
    },
    isOpen(date) {
      const iso = formatDate(date);
      if (cal.useClosed && extra.has(iso)) return false;
      if (cal.weekend.includes(date.getUTCDay())) return false;
      if (cal.skipHolidays && holidaysOf(date.getUTCFullYear()).has(iso)) return false;
      return true;
    },
    reasonClosed(date) {
      const iso = formatDate(date);
      if (cal.useClosed && extra.has(iso)) return "fermeture declaree";
      if (cal.weekend.includes(date.getUTCDay())) {
        return date.getUTCDay() === 0 ? "dimanche" : "samedi";
      }
      if (cal.skipHolidays) {
        const found = holidays(date.getUTCFullYear(), zoneKey).find((h) => h.date === iso);
        if (found) return `ferie: ${found.name}`;
      }
      return null;
    },
  };
}

export function isBusinessDay(date, options = {}) {
  const ctx = makeContext(options);
  const d = parseDate(date);
  const open = ctx.isOpen(d);
  return {
    date: formatDate(d),
    business_day: open,
    weekday: d.getUTCDay(),
    reason: open ? null : ctx.reasonClosed(d),
    calendar: ctx.calendar,
    zone: ctx.zone,
  };
}

/** Jour ouvre suivant ou precedent, le jour donne inclus s'il est ouvre. */
function roll(ctx, date, direction) {
  let cursor = date;
  let guard = 0;
  while (!ctx.isOpen(cursor)) {
    cursor = shift(cursor, direction);
    if (++guard > 400) throw new InputError("aucun jour ouvre trouve, verifie les fermetures declarees");
  }
  return cursor;
}

/**
 * Ajoute ou retire des jours. Le jour de depart n'est jamais compte.
 * En calendaires, on avance jour par jour sans rien sauter.
 */
export function addDays(date, count, options = {}) {
  const ctx = makeContext(options);
  const start = parseDate(date);
  if (!Number.isInteger(count)) throw new InputError("days doit etre un entier");
  const step = count >= 0 ? 1 : -1;
  let cursor = start;
  let remaining = Math.abs(count);
  let guard = 0;
  while (remaining > 0) {
    cursor = shift(cursor, step);
    if (ctx.isOpen(cursor)) remaining -= 1;
    if (++guard > 100000) throw new InputError("calcul trop long, reduis l'intervalle");
  }
  return {
    from: formatDate(start),
    days: count,
    result: formatDate(cursor),
    calendar: ctx.calendar,
    zone: ctx.zone,
  };
}

/** Compte les jours ouvres, ouvrables ou calendaires entre deux dates. */
export function countDays(from, to, options = {}) {
  const ctx = makeContext(options);
  const start = parseDate(from, "from");
  const end = parseDate(to, "to");
  const inclusive = options.inclusive !== false;
  if (end < start) throw new InputError("to doit etre posterieure ou egale a from");

  let cursor = inclusive ? start : shift(start, 1);
  const last = inclusive ? end : shift(end, -1);
  let count = 0;
  let total = 0;
  let guard = 0;
  while (cursor <= last) {
    total += 1;
    if (ctx.isOpen(cursor)) count += 1;
    cursor = shift(cursor, 1);
    if (++guard > 100000) throw new InputError("intervalle trop large, 100000 jours maximum");
  }
  return {
    from: formatDate(start),
    to: formatDate(end),
    inclusive,
    count,
    calendar_days: total,
    calendar: ctx.calendar,
    zone: ctx.zone,
  };
}

/** Ajout de mois avec ecrasement sur le dernier jour du mois, art. 641 CPC. */
function addMonths(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return utc(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(day, lastDay));
}

/**
 * Echeance d'un delai.
 *
 * unit = days: delai compte selon le calendrier choisi.
 * unit = months ou years: report sur le meme chiffre de mois, a defaut le
 * dernier jour du mois, conformement a l'article 641 du code de procedure
 * civile.
 *
 * rollover = next_business_day applique l'article 642: une echeance qui tombe
 * un samedi, un dimanche, un jour ferie ou un jour de fermeture est prorogee
 * au premier jour ouvrable suivant.
 *
 * Le report ne se fait jamais sur le calendrier du decompte: un delai compte
 * en jours calendaires se reporte quand meme sur un jour ouvre, sinon la
 * regle ne sert a rien. D'ou rollover_calendar, ouvres par defaut.
 */
export function deadline(from, options = {}) {
  const { delay, unit = "days", rollover = "next_business_day" } = options;
  if (!Number.isInteger(delay) || delay < 0) throw new InputError("delay doit etre un entier positif");
  if (!["none", "next_business_day", "previous_business_day"].includes(rollover)) {
    throw new InputError("rollover doit valoir none, next_business_day ou previous_business_day");
  }
  const ctx = makeContext(options);
  const rollCtx = makeContext({
    zone: options.zone,
    calendar: options.rollover_calendar ?? "ouvres",
    closed: options.closed,
  });
  const start = parseDate(from, "from");

  let raw;
  if (unit === "days") {
    raw = parseDate(addDays(from, delay, options).result);
  } else if (unit === "months") {
    raw = addMonths(start, delay);
  } else if (unit === "years") {
    raw = addMonths(start, delay * 12);
  } else {
    throw new InputError("unit doit valoir days, months ou years");
  }
  checkYear(raw.getUTCFullYear(), "echeance");

  let final = raw;
  if (rollover === "next_business_day") final = roll(rollCtx, raw, 1);
  if (rollover === "previous_business_day") final = roll(rollCtx, raw, -1);

  return {
    from: formatDate(start),
    delay,
    unit,
    raw_deadline: formatDate(raw),
    deadline: formatDate(final),
    rolled: formatDate(final) !== formatDate(raw),
    rollover,
    rollover_calendar: rollCtx.calendar,
    calendar: ctx.calendar,
    zone: ctx.zone,
  };
}

export function nextBusinessDay(date, options = {}) {
  const ctx = makeContext(options);
  const start = parseDate(date);
  const result = roll(ctx, shift(start, 1), 1);
  return { from: formatDate(start), result: formatDate(result), calendar: ctx.calendar, zone: ctx.zone };
}

export function previousBusinessDay(date, options = {}) {
  const ctx = makeContext(options);
  const start = parseDate(date);
  const result = roll(ctx, shift(start, -1), -1);
  return { from: formatDate(start), result: formatDate(result), calendar: ctx.calendar, zone: ctx.zone };
}

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
