import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { build, collect, toCsv, toIcs, toMonthlyCsv } from "../generate.mjs";

const RANGE = { from: 2026, to: 2027 };

describe("contenu du pack", () => {
  it("couvre les neuf zones, en trois formats, plus la notice", () => {
    const files = build(RANGE);
    assert.equal(files.size, 9 * 3 + 1);
    assert.ok(files.has("ics/jours-feries-metropole.ics"));
    assert.ok(files.has("csv/jours-feries-reunion.csv"));
    assert.ok(files.has("mensuel/jours-ouvres-alsace-moselle.csv"));
    assert.ok(files.has("LISEZ-MOI.txt"));
  });

  it("est reproductible a l'identique", () => {
    const a = build(RANGE);
    const b = build(RANGE);
    assert.deepEqual([...a.entries()], [...b.entries()]);
  });

  it("compte le bon nombre de jours par zone et par an", () => {
    assert.equal(collect("metropole", RANGE).length, 22);
    assert.equal(collect("alsace-moselle", RANGE).length, 26);
    assert.equal(collect("reunion", RANGE).length, 24);
  });
});

describe("noms affiches", () => {
  it("retablit les accents que l'API laisse en ASCII", () => {
    const noms = collect("metropole", RANGE).map((e) => e.name);
    assert.ok(noms.includes("Lundi de Pâques"));
    assert.ok(noms.includes("Fête du Travail"));
    assert.ok(noms.includes("Noël"));
    assert.equal(noms.includes("Noel"), false);
  });

  it("donne le jour de la semaine en francais", () => {
    const jour = collect("metropole", RANGE).find((e) => e.date === "2026-01-01");
    assert.equal(jour.weekday, "jeudi");
  });
});

describe("format ICS", () => {
  const ics = toIcs(collect("metropole", RANGE), "metropole");

  it("respecte la structure d'un calendrier", () => {
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 22);
    assert.equal((ics.match(/END:VEVENT/g) || []).length, 22);
  });

  it("utilise des fins de ligne CRLF partout", () => {
    const seules = ics.split("\r\n").join("").includes("\n");
    assert.equal(seules, false, "aucun saut de ligne ne doit etre seul");
  });

  it("decrit des evenements d'une journee entiere", () => {
    assert.match(ics, /DTSTART;VALUE=DATE:20260101\r\nDTEND;VALUE=DATE:20260102/);
  });

  it("ne depasse jamais 75 octets par ligne", () => {
    for (const line of ics.split("\r\n")) {
      assert.ok(Buffer.byteLength(line, "utf8") <= 75, line);
    }
  });

  it("donne un identifiant unique a chaque evenement", () => {
    const uids = [...ics.matchAll(/UID:(.+)\r\n/g)].map((m) => m[1]);
    assert.equal(new Set(uids).size, uids.length);
  });
});

describe("format CSV", () => {
  it("utilise le point-virgule attendu par Excel en francais", () => {
    const lignes = toCsv(collect("metropole", RANGE)).split("\r\n");
    assert.equal(lignes[0], "date;jour;nom;annee;zone");
    assert.equal(lignes[1].split(";").length, 5);
  });

  it("protege les valeurs contenant un point-virgule", () => {
    const csv = toCsv([
      { date: "2026-01-01", weekday: "jeudi", name: "Un; deux", year: 2026, zone: "metropole" },
    ]);
    assert.match(csv, /"Un; deux"/);
  });
});

describe("comptes mensuels", () => {
  const rows = toMonthlyCsv("metropole", { from: 2026, to: 2026 })
    .trim()
    .split("\r\n")
    .slice(1)
    .map((line) => line.split(";"));

  it("donne douze mois", () => {
    assert.equal(rows.length, 12);
  });

  it("retrouve janvier 2026 a la main: 21 ouvres et 26 ouvrables", () => {
    assert.deepEqual(rows[0], ["2026", "janvier", "31", "21", "26"]);
  });

  it("compte moins de jours ouvres que d'ouvrables", () => {
    for (const [, , , ouvres, ouvrables] of rows) {
      assert.ok(Number(ouvres) < Number(ouvrables));
    }
  });

  it("totalise l'annee 2026 a 252 jours ouvres", () => {
    const total = rows.reduce((sum, r) => sum + Number(r[3]), 0);
    // 365 jours moins 104 samedis et dimanches font 261 jours de semaine.
    // En 2026, 9 des 11 feries tombent en semaine: le 15 aout est un samedi
    // et le 1er novembre un dimanche. 261 - 9 = 252.
    assert.equal(total, 252);
  });

  it("perd deux feries tombes le week-end en 2026", () => {
    const enSemaine = collect("metropole", { from: 2026, to: 2026 }).filter(
      (e) => e.weekday !== "samedi" && e.weekday !== "dimanche",
    );
    assert.equal(enSemaine.length, 9);
  });
});
