/**
 * Fichier genere par build.mjs, ne pas modifier a la main.
 * Source: engine.mjs + worker.mjs du meme dossier.
 *
 * A coller dans l'editeur Cloudflare Workers. Aucune dependance.
 */

/**
 * Validation des identifiants d'entreprise et bancaires, France et SEPA.
 *
 * Pur calcul: aucune base de donnees, aucun appel reseau, aucune dependance.
 * On ne dit jamais si une entreprise existe, on dit si un identifiant est
 * formellement valide. C'est une distinction que la documentation repete,
 * parce que c'est la seule source de malentendu possible sur ce produit.
 */

export class InputError extends Error {}

// ------------------------------------------------------------------ IBAN

/**
 * Longueurs officielles de l'IBAN par pays, zone SEPA et micro-Etats
 * associes. Un pays absent de cette table est refuse explicitement plutot
 * que valide au juge: repondre "je ne sais pas" vaut mieux que se tromper.
 */
export const IBAN_LENGTHS = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28,
  IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31,
  NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27,
  VA: 22,
};

function cleanup(value, field) {
  if (typeof value !== "string") throw new InputError(`${field} doit etre une chaine`);
  return value.replace(/[\s.-]/g, "").toUpperCase();
}

/** mod 97 sur une chaine trop longue pour un entier, chiffre par chiffre. */
function mod97(digits) {
  let rest = 0;
  for (const char of digits) {
    rest = (rest * 10 + Number(char)) % 97;
  }
  return rest;
}

function toDigits(value) {
  let out = "";
  for (const char of value) {
    if (char >= "0" && char <= "9") out += char;
    else if (char >= "A" && char <= "Z") out += String(char.charCodeAt(0) - 55);
    else throw new InputError(`caractere invalide dans l'IBAN: ${char}`);
  }
  return out;
}

export function checkIban(input) {
  const iban = cleanup(input, "iban");
  if (iban.length < 5) return { iban, valid: false, reason: "trop court" };

  const country = iban.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(country)) {
    return { iban, valid: false, reason: "les deux premiers caracteres doivent etre un code pays" };
  }
  const expected = IBAN_LENGTHS[country];
  if (!expected) {
    return {
      iban, valid: false, country,
      reason: `pays hors perimetre: ${country}, zone SEPA seulement`,
    };
  }
  if (iban.length !== expected) {
    return {
      iban, valid: false, country,
      reason: `longueur ${iban.length}, attendue ${expected} pour ${country}`,
    };
  }
  if (!/^[A-Z0-9]+$/.test(iban)) {
    return { iban, valid: false, country, reason: "caracteres non alphanumeriques" };
  }

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const valid = mod97(toDigits(rearranged)) === 1;
  return {
    iban,
    valid,
    country,
    check_digits: iban.slice(2, 4),
    bban: iban.slice(4),
    formatted: iban.replace(/(.{4})/g, "$1 ").trim(),
    reason: valid ? null : "cle de controle incorrecte",
  };
}

// ------------------------------------------------------------------ RIB

/** Table officielle de conversion des lettres pour la cle RIB. */
const RIB_LETTERS = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

function accountToDigits(account) {
  let out = "";
  for (const char of account) {
    if (char >= "0" && char <= "9") out += char;
    else if (char in RIB_LETTERS) out += String(RIB_LETTERS[char]);
    else throw new InputError(`caractere invalide dans le numero de compte: ${char}`);
  }
  return out;
}

/**
 * Cle RIB francaise: 97 - ((89*banque + 15*guichet + 3*compte) mod 97).
 * Les lettres du numero de compte sont converties avant le calcul.
 */
export function ribKey(bank, branch, account) {
  const b = cleanup(bank, "bank");
  const g = cleanup(branch, "branch");
  const c = cleanup(account, "account");
  if (!/^\d{5}$/.test(b)) throw new InputError("le code banque fait 5 chiffres");
  if (!/^\d{5}$/.test(g)) throw new InputError("le code guichet fait 5 chiffres");
  if (!/^[0-9A-Z]{11}$/.test(c)) throw new InputError("le numero de compte fait 11 caracteres");

  const sum =
    89 * Number(b) + 15 * Number(g) + 3 * mod97BigParts(accountToDigits(c));
  const key = 97 - (sum % 97);
  return {
    bank: b,
    branch: g,
    account: c,
    key: String(key === 97 ? 0 : key).padStart(2, "0"),
  };
}

// le numero de compte converti depasse l'entier sur 11 chiffres, on reduit
function mod97BigParts(digits) {
  return mod97(digits);
}

export function checkRib(bank, branch, account, key) {
  const computed = ribKey(bank, branch, account);
  const given = cleanup(key, "key");
  if (!/^\d{2}$/.test(given)) throw new InputError("la cle RIB fait 2 chiffres");
  return {
    ...computed,
    given_key: given,
    valid: computed.key === given,
    reason: computed.key === given ? null : `cle attendue ${computed.key}`,
  };
}

// ------------------------------------------------------------------ SIREN

/** Luhn: on double un chiffre sur deux en partant de la droite. */
function luhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = Number(digits[i]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

const LA_POSTE_SIREN = "356000000";

export function checkSiren(input) {
  const siren = cleanup(input, "siren");
  if (!/^\d{9}$/.test(siren)) {
    return { siren, valid: false, reason: "un SIREN fait 9 chiffres" };
  }
  const valid = luhn(siren);
  return { siren, valid, reason: valid ? null : "cle de Luhn incorrecte" };
}

export function checkSiret(input) {
  const siret = cleanup(input, "siret");
  if (!/^\d{14}$/.test(siret)) {
    return { siret, valid: false, reason: "un SIRET fait 14 chiffres" };
  }
  const siren = siret.slice(0, 9);

  // La Poste echappe a Luhn: ses SIRET sont valides si la somme des chiffres
  // est un multiple de 5. C'est une exception officielle, pas un bricolage.
  if (siren === LA_POSTE_SIREN) {
    const sum = [...siret].reduce((total, d) => total + Number(d), 0);
    const valid = sum % 5 === 0;
    return {
      siret, siren, nic: siret.slice(9), valid, rule: "la_poste",
      reason: valid ? null : "somme des chiffres non multiple de 5",
    };
  }

  const valid = luhn(siret);
  return {
    siret, siren, nic: siret.slice(9), valid, rule: "luhn",
    reason: valid ? null : "cle de Luhn incorrecte",
  };
}

// ------------------------------------------------------------------ TVA

/** Cle de TVA intracommunautaire francaise: (12 + 3 * (SIREN mod 97)) mod 97. */
export function vatFromSiren(input) {
  const siren = cleanup(input, "siren");
  if (!/^\d{9}$/.test(siren)) throw new InputError("un SIREN fait 9 chiffres");
  const key = String((12 + 3 * (mod97(siren) % 97)) % 97).padStart(2, "0");
  return { siren, key, vat_number: `FR${key}${siren}`, siren_valid: luhn(siren) };
}

/**
 * Formats de TVA intracommunautaire des 27 Etats membres.
 *
 * Seule la France est verifiee par calcul de cle. Pour les autres, on
 * verifie la forme, pas la cle: le dire clairement vaut mieux que laisser
 * croire a une validation qui n'existe pas.
 */
export const VAT_FORMATS = {
  AT: /^U\d{8}$/, BE: /^[01]\d{9}$/, BG: /^\d{9,10}$/, CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/, DE: /^\d{9}$/, DK: /^\d{8}$/, EE: /^\d{9}$/,
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/, FI: /^\d{8}$/, FR: /^[A-Z0-9]{2}\d{9}$/,
  GR: /^\d{9}$/, HR: /^\d{11}$/, HU: /^\d{8}$/, IE: /^[A-Z0-9]{8,9}$/,
  IT: /^\d{11}$/, LT: /^(\d{9}|\d{12})$/, LU: /^\d{8}$/, LV: /^\d{11}$/,
  MT: /^\d{8}$/, NL: /^\d{9}B\d{2}$/, PL: /^\d{10}$/, PT: /^\d{9}$/,
  RO: /^\d{2,10}$/, SE: /^\d{12}$/, SI: /^\d{8}$/, SK: /^\d{10}$/,
};

export function checkVat(input) {
  const vat = cleanup(input, "vat");
  const country = vat.slice(0, 2);
  const rest = vat.slice(2);
  const pattern = VAT_FORMATS[country];
  if (!pattern) {
    return {
      vat, valid: false, country,
      checked: "none",
      reason: `pays hors perimetre: ${country}, Union europeenne seulement`,
    };
  }
  if (!pattern.test(rest)) {
    return { vat, valid: false, country, checked: "format", reason: "format incorrect" };
  }

  if (country !== "FR") {
    return {
      vat, valid: true, country, checked: "format",
      note: "forme conforme, cle non verifiee pour ce pays",
    };
  }

  const siren = rest.slice(2);
  const expected = vatFromSiren(siren);
  const given = rest.slice(0, 2);
  if (!/^\d{2}$/.test(given)) {
    // les anciennes cles alphabetiques existent et ne se recalculent pas
    return {
      vat, valid: true, country, checked: "format", siren,
      note: "ancienne cle alphabetique, non recalculable",
    };
  }
  const valid = given === expected.key;
  return {
    vat, valid, country, checked: "checksum", siren,
    expected_key: expected.key,
    siren_valid: expected.siren_valid,
    reason: valid ? null : `cle attendue ${expected.key}`,
  };
}

// ------------------------------------------------------------------ NIR

const CORSE = { "2A": "19", "2B": "18" };

const MONTHS_NIR = {
  "20": "mois inconnu", "30": "mois inconnu", "40": "mois inconnu",
  "50": "mois inconnu", "99": "personne nee a l'etranger",
};

/**
 * Numero de securite sociale, 15 caracteres: 13 de numero et 2 de cle.
 *
 * La cle vaut 97 moins le reste de la division du numero par 97. Les deux
 * departements corses s'ecrivent 2A et 2B, remplaces par 19 et 18 avant le
 * calcul: une implementation qui l'oublie rejette toute la Corse.
 */
export function checkNir(input) {
  const nir = cleanup(input, "nir");
  // 1 sexe + 2 annee + 2 mois + 2 departement + 3 commune + 3 ordre + 2 cle
  if (!/^[0-9]{5}(?:[0-9]{2}|2[AB])[0-9]{8}$/.test(nir)) {
    return { nir, valid: false, reason: "un NIR fait 15 caracteres, cle comprise" };
  }

  const number = nir.slice(0, 13);
  const given = nir.slice(13);
  const department = number.slice(5, 7);
  const normalized = department in CORSE
    ? number.slice(0, 5) + CORSE[department] + number.slice(7)
    : number;

  const expected = String(97 - (mod97(normalized) % 97)).padStart(2, "0");
  const valid = expected === given;
  const month = number.slice(3, 5);

  return {
    nir,
    valid,
    number,
    key: given,
    expected_key: expected,
    sex: number[0] === "1" ? "homme" : number[0] === "2" ? "femme" : "provisoire",
    birth_year: number.slice(1, 3),
    birth_month: month,
    department,
    corsica: department in CORSE,
    note: MONTHS_NIR[month] ?? null,
    reason: valid ? null : `cle attendue ${expected}`,
  };
}

// ------------------------------------------------------------------ TVA

/** Taux francais en vigueur. Metropole; l'outre-mer et la Corse different. */
export const VAT_RATES = [
  { rate: 20, label: "taux normal" },
  { rate: 10, label: "taux intermediaire" },
  { rate: 5.5, label: "taux reduit" },
  { rate: 2.1, label: "taux particulier" },
];

/**
 * Ventilation d'un montant entre hors taxes, TVA et toutes taxes comprises.
 *
 * L'arrondi se fait au centime sur la TVA, puis les deux autres montants en
 * decoulent: c'est la seule facon d'obtenir trois nombres qui s'additionnent
 * exactement, ce qu'une facture exige.
 */
export function vatBreakdown({ amount, rate = 20, from = "ht" } = {}) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) {
    throw new InputError("amount doit etre un nombre positif");
  }
  const r = Number(rate);
  if (!Number.isFinite(r) || r < 0 || r > 100) {
    throw new InputError("rate doit etre un pourcentage entre 0 et 100");
  }
  if (from !== "ht" && from !== "ttc") {
    throw new InputError('from doit valoir "ht" ou "ttc"');
  }

  const cents = (n) => Math.round(n * 100) / 100;
  let ht;
  let ttc;
  if (from === "ht") {
    ht = cents(value);
    ttc = cents(ht * (1 + r / 100));
  } else {
    ttc = cents(value);
    ht = cents(ttc / (1 + r / 100));
  }
  const tva = cents(ttc - ht);
  return { ht, tva, ttc: cents(ht + tva), rate: r, from };
}

/**
 * API de validation des identifiants d'entreprise et bancaires, France et SEPA.
 *
 * Meme architecture que l'API jours feries: Cloudflare Workers, aucune
 * dependance, aucun stockage, aucune donnee conservee. Un IBAN qui passe par
 * ici n'est ecrit nulle part.
 */


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
  nir: (p) => checkNir(required(p, "nir")),
  "vat-amount": (p) =>
    vatBreakdown({
      amount: Number(required(p, "amount")),
      rate: p.get("rate") === null || p.get("rate") === "" ? 20 : Number(p.get("rate")),
      from: p.get("from") ?? "ht",
    }),
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
    vat_rates: VAT_RATES,
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
    "GET /v1/nir?nir=269054958815780",
    "GET /v1/vat-amount?amount=100&rate=20&from=ht",
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
    "/v1/nir": {
      get: {
        summary: "Valider un numero de securite sociale",
        description:
          "Cle de controle sur 97. Les departements corses 2A et 2B sont remplaces par 19 et 18 avant le calcul, ce que beaucoup d'implementations oublient.",
        parameters: [stringParam("nir", true, "269054958815780")],
        responses: { 200: { description: "validite, sexe, annee, departement" } },
      },
    },
    "/v1/vat-amount": {
      get: {
        summary: "Ventiler un montant entre HT, TVA et TTC",
        description:
          "L'arrondi se fait au centime sur la TVA, les deux autres montants en decoulent, de sorte que les trois nombres s'additionnent exactement.",
        parameters: [
          stringParam("amount", true, "100"),
          stringParam("rate", false, "20"),
          stringParam("from", false, "ht"),
        ],
        responses: { 200: { description: "ht, tva, ttc" } },
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
