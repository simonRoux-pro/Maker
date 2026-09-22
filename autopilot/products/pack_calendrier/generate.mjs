/**
 * Fabrique le pack calendrier vendu en telechargement.
 *
 * Reutilise le moteur de l'API jours feries: une seule implementation des
 * regles, deux produits. Si une regle change, les deux suivent.
 *
 *   node generate.mjs            -> dist/
 *   node generate.mjs --years 2026-2035
 *
 * Tout est deterministe: deux executions donnent des fichiers identiques,
 * a l'horodatage pres, ce qui rend le pack verifiable.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ZONES, holidays } from "../jours_feries_api/engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, "dist");

export const DEFAULT_RANGE = { from: 2026, to: 2035 };

/**
 * Les noms du moteur sont sans accent, par choix, pour rester surs en ASCII
 * dans une reponse d'API. Un produit payant, lui, doit etre ecrit en francais
 * correct.
 */
const DISPLAY = {
  "Jour de l'an": "Jour de l'an",
  "Lundi de Paques": "Lundi de Pâques",
  "Fete du Travail": "Fête du Travail",
  "Victoire 1945": "Victoire 1945",
  Ascension: "Ascension",
  "Lundi de Pentecote": "Lundi de Pentecôte",
  "Fete nationale": "Fête nationale",
  Assomption: "Assomption",
  Toussaint: "Toussaint",
  "Armistice 1918": "Armistice 1918",
  Noel: "Noël",
  "Vendredi saint": "Vendredi saint",
  "Saint Etienne": "Saint Étienne",
  "Abolition de l'esclavage": "Abolition de l'esclavage",
};

const ZONE_LABEL = {
  metropole: "France métropolitaine",
  "alsace-moselle": "Alsace-Moselle",
  guadeloupe: "Guadeloupe",
  "saint-martin": "Saint-Martin",
  "saint-barthelemy": "Saint-Barthélemy",
  martinique: "Martinique",
  guyane: "Guyane",
  reunion: "La Réunion",
  mayotte: "Mayotte",
};

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function display(name) {
  return DISPLAY[name] ?? name;
}

function utc(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function compact(iso) {
  return iso.replace(/-/g, "");
}

function years(range) {
  const out = [];
  for (let y = range.from; y <= range.to; y += 1) out.push(y);
  return out;
}

export function collect(zone, range = DEFAULT_RANGE) {
  return years(range).flatMap((year) =>
    holidays(year, zone).map((h) => ({
      ...h,
      year,
      name: display(h.name),
      weekday: WEEKDAYS[utc(h.date).getUTCDay()],
      zone,
    })),
  );
}

// ---------------------------------------------------------------- ICS

/** Repli des lignes a 75 octets, exige par la RFC 5545. */
function fold(line) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts = [];
  let start = 0;
  while (start < bytes.length) {
    const size = start === 0 ? 75 : 74;
    let end = Math.min(start + size, bytes.length);
    // ne jamais couper au milieu d'un caractere multi-octets
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    parts.push((start === 0 ? "" : " ") + bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return parts.join("\r\n");
}

export function toIcs(entries, zone, { stamp = "20260101T000000Z" } = {}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Autopilot//Jours feries France//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Jours fériés ${ZONE_LABEL[zone]}`,
    "X-WR-TIMEZONE:Europe/Paris",
  ];
  for (const entry of entries) {
    const next = new Date(utc(entry.date).getTime() + 86400000).toISOString().slice(0, 10);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${entry.date}-${zone}@jours-feries-france`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(entry.date)}`,
      `DTEND;VALUE=DATE:${compact(next)}`,
      `SUMMARY:${entry.name}`,
      "TRANSP:TRANSPARENT",
      "CATEGORIES:Jour férié",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------- CSV

function csvEscape(value) {
  const text = String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Point-virgule: c'est ce qu'attend Excel en configuration francaise. */
function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(";")).join("\r\n") + "\r\n";
}

export function toCsv(entries) {
  return csv([
    ["date", "jour", "nom", "annee", "zone"],
    ...entries.map((e) => [e.date, e.weekday, e.name, e.year, ZONE_LABEL[e.zone]]),
  ]);
}

/** Compte des jours ouvres et ouvrables de chaque mois, feries deduits. */
export function toMonthlyCsv(zone, range = DEFAULT_RANGE) {
  const feries = new Set(collect(zone, range).map((e) => e.date));
  const rows = [["annee", "mois", "jours_calendaires", "jours_ouvres", "jours_ouvrables"]];
  for (const year of years(range)) {
    for (let month = 1; month <= 12; month += 1) {
      const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
      let ouvres = 0;
      let ouvrables = 0;
      for (let day = 1; day <= days; day += 1) {
        const date = new Date(Date.UTC(year, month - 1, day));
        const iso = date.toISOString().slice(0, 10);
        const weekday = date.getUTCDay();
        if (feries.has(iso)) continue;
        if (weekday !== 0 && weekday !== 6) ouvres += 1;
        if (weekday !== 0) ouvrables += 1;
      }
      rows.push([year, MONTHS[month - 1], days, ouvres, ouvrables]);
    }
  }
  return csv(rows);
}

// ---------------------------------------------------------------- pack

const NOTICE = `Pack calendrier France 2026-2035
================================

Contenu, pour chacune des 9 zones:
  ics/    calendrier a importer dans Outlook, Google Agenda, Apple Calendrier
  csv/    liste des jours feries, ouvrable dans Excel
  mensuel/ nombre de jours ouvres et ouvrables de chaque mois

Zones couvertes: France metropolitaine, Alsace-Moselle, et les sept
collectivites d'outre-mer avec leur jour d'abolition de l'esclavage.

Les fichiers CSV utilisent le point-virgule comme separateur, qui est ce
qu'attend Excel en configuration francaise. Ouvrez-les directement, sans
assistant d'importation.

Les jours ouvres comptent du lundi au vendredi, feries deduits. Les jours
ouvrables comptent du lundi au samedi, feries deduits. Cette distinction
change les resultats en paie, en RH et dans un contrat commercial: verifiez
laquelle s'applique a votre cas.

Licence: usage libre, y compris commercial, au sein de votre organisation.
La revente du pack en l'etat n'est pas autorisee.

Une API existe pour les memes calculs en temps reel, avec le calcul
d'echeances et le report au premier jour ouvrable:
https://rapidapi.com/prosimonroux/api/french-public-holidays-business-days
`;

export function build(range = DEFAULT_RANGE, { stamp } = {}) {
  const files = new Map();
  for (const zone of Object.keys(ZONES)) {
    const entries = collect(zone, range);
    files.set(`ics/jours-feries-${zone}.ics`, toIcs(entries, zone, { stamp }));
    files.set(`csv/jours-feries-${zone}.csv`, toCsv(entries));
    files.set(`mensuel/jours-ouvres-${zone}.csv`, toMonthlyCsv(zone, range));
  }
  files.set("LISEZ-MOI.txt", NOTICE);
  return files;
}

function main() {
  const arg = process.argv.indexOf("--years");
  let range = DEFAULT_RANGE;
  if (arg !== -1 && process.argv[arg + 1]) {
    const [from, to] = process.argv[arg + 1].split("-").map(Number);
    range = { from, to };
  }
  rmSync(DIST, { recursive: true, force: true });
  const files = build(range);
  for (const [name, content] of files) {
    const target = join(DIST, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
  }
  const bytes = [...files.values()].reduce((t, c) => t + Buffer.byteLength(c, "utf8"), 0);
  console.log(
    `${files.size} fichiers, ${(bytes / 1024).toFixed(0)} ko, ` +
      `${range.from} a ${range.to}, ${Object.keys(ZONES).length} zones`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
