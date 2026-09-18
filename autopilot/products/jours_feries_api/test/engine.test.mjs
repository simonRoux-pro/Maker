import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InputError,
  addDays,
  countDays,
  deadline,
  easterSunday,
  formatDate,
  holidays,
  isBusinessDay,
  nextBusinessDay,
  previousBusinessDay,
} from "../engine.mjs";

describe("Paques", () => {
  it("retrouve les dates connues", () => {
    assert.equal(formatDate(easterSunday(2024)), "2024-03-31");
    assert.equal(formatDate(easterSunday(2025)), "2025-04-20");
    assert.equal(formatDate(easterSunday(2026)), "2026-04-05");
    assert.equal(formatDate(easterSunday(2027)), "2027-03-28");
    assert.equal(formatDate(easterSunday(2038)), "2038-04-25");
  });
});

describe("jours feries", () => {
  it("compte 11 jours en metropole", () => {
    assert.equal(holidays(2026).length, 11);
  });

  it("donne les dates exactes de 2026", () => {
    const byName = Object.fromEntries(holidays(2026).map((h) => [h.name, h.date]));
    assert.equal(byName["Lundi de Paques"], "2026-04-06");
    assert.equal(byName["Ascension"], "2026-05-14");
    assert.equal(byName["Lundi de Pentecote"], "2026-05-25");
    assert.equal(byName["Victoire 1945"], "2026-05-08");
  });

  it("ajoute le vendredi saint et la Saint Etienne en Alsace-Moselle", () => {
    const dates = holidays(2026, "alsace-moselle").map((h) => h.date);
    assert.equal(dates.length, 13);
    assert.ok(dates.includes("2026-04-03"));
    assert.ok(dates.includes("2026-12-26"));
  });

  it("ajoute l'abolition de l'esclavage en outre-mer", () => {
    const cases = {
      reunion: "2026-12-20",
      martinique: "2026-05-22",
      guadeloupe: "2026-05-27",
      guyane: "2026-06-10",
      mayotte: "2026-04-27",
      "saint-martin": "2026-05-28",
      "saint-barthelemy": "2026-10-09",
    };
    for (const [zone, date] of Object.entries(cases)) {
      const list = holidays(2026, zone);
      assert.equal(list.length, 12, zone);
      assert.ok(list.some((h) => h.date === date), `${zone} attend ${date}`);
    }
  });

  it("reste trie", () => {
    const dates = holidays(2026, "alsace-moselle").map((h) => h.date);
    assert.deepEqual(dates, [...dates].sort());
  });

  it("refuse une zone inconnue", () => {
    assert.throws(() => holidays(2026, "corse-du-nord"), InputError);
  });

  it("refuse les annees hors perimetre", () => {
    assert.throws(() => holidays(1981), InputError);
    assert.throws(() => holidays(2101), InputError);
    assert.equal(holidays(1982).length, 11);
  });
});

describe("validation des dates", () => {
  it("refuse un format libre", () => {
    assert.throws(() => isBusinessDay("8 mai 2026"), InputError);
    assert.throws(() => isBusinessDay("2026-5-8"), InputError);
  });

  it("refuse une date inexistante", () => {
    assert.throws(() => isBusinessDay("2026-02-30"), InputError);
    assert.throws(() => isBusinessDay("2026-13-01"), InputError);
  });
});

describe("jour ouvre", () => {
  it("exclut un ferie et donne le motif", () => {
    const res = isBusinessDay("2026-05-08");
    assert.equal(res.business_day, false);
    assert.equal(res.reason, "ferie: Victoire 1945");
  });

  it("distingue ouvres et ouvrables le samedi", () => {
    assert.equal(isBusinessDay("2026-05-09", { calendar: "ouvres" }).business_day, false);
    assert.equal(isBusinessDay("2026-05-09", { calendar: "ouvrables" }).business_day, true);
    assert.equal(isBusinessDay("2026-05-10", { calendar: "ouvrables" }).business_day, false);
  });

  it("compte tout en calendaires", () => {
    assert.equal(isBusinessDay("2026-05-08", { calendar: "calendaires" }).business_day, true);
  });

  it("tient compte des fermetures declarees", () => {
    const res = isBusinessDay("2026-07-20", { closed: "2026-07-20,2026-07-21" });
    assert.equal(res.business_day, false);
    assert.equal(res.reason, "fermeture declaree");
  });
});

describe("arithmetique", () => {
  it("saute le ferie et le week-end", () => {
    assert.equal(addDays("2026-05-06", 3).result, "2026-05-12");
  });

  it("recule", () => {
    assert.equal(addDays("2026-05-12", -3).result, "2026-05-06");
  });

  it("ne bouge pas a zero", () => {
    assert.equal(addDays("2026-05-09", 0).result, "2026-05-09");
  });

  it("avance jour par jour en calendaires", () => {
    assert.equal(addDays("2026-05-06", 3, { calendar: "calendaires" }).result, "2026-05-09");
  });

  it("compte 17 jours ouvres en mai 2026", () => {
    const res = countDays("2026-05-01", "2026-05-31");
    assert.equal(res.count, 17);
    assert.equal(res.calendar_days, 31);
  });

  it("gere les bornes exclues", () => {
    // du lundi 11 au vendredi 15 mai 2026, jeudi 14 est l'Ascension
    const inclusif = countDays("2026-05-11", "2026-05-15");
    const exclusif = countDays("2026-05-11", "2026-05-15", { inclusive: false });
    assert.equal(inclusif.count, 4);
    assert.equal(inclusif.calendar_days, 5);
    assert.equal(exclusif.count, 2);
  });

  it("refuse un intervalle inverse", () => {
    assert.throws(() => countDays("2026-05-31", "2026-05-01"), InputError);
  });

  it("donne le jour ouvre suivant et precedent", () => {
    assert.equal(nextBusinessDay("2026-05-07").result, "2026-05-11");
    assert.equal(previousBusinessDay("2026-05-11").result, "2026-05-07");
  });
});

describe("echeances", () => {
  it("proroge une echeance tombant un ferie, article 642", () => {
    const res = deadline("2026-05-07", { delay: 1, calendar: "calendaires" });
    assert.equal(res.raw_deadline, "2026-05-08");
    assert.equal(res.deadline, "2026-05-11");
    assert.equal(res.rolled, true);
  });

  it("ne proroge pas sans besoin", () => {
    const res = deadline("2026-04-03", { delay: 14, calendar: "calendaires" });
    assert.equal(res.deadline, "2026-04-17");
    assert.equal(res.rolled, false);
  });

  it("laisse l'echeance brute si rollover none", () => {
    const res = deadline("2026-05-07", { delay: 1, calendar: "calendaires", rollover: "none" });
    assert.equal(res.deadline, "2026-05-08");
    assert.equal(res.rolled, false);
  });

  it("peut reculer au jour ouvre precedent", () => {
    const res = deadline("2026-05-07", {
      delay: 1,
      calendar: "calendaires",
      rollover: "previous_business_day",
    });
    assert.equal(res.deadline, "2026-05-07");
  });

  it("ecrase sur le dernier jour du mois, article 641", () => {
    assert.equal(deadline("2026-01-31", { delay: 1, unit: "months", rollover: "none" }).raw_deadline, "2026-02-28");
    assert.equal(deadline("2028-01-31", { delay: 1, unit: "months", rollover: "none" }).raw_deadline, "2028-02-29");
    assert.equal(deadline("2026-03-15", { delay: 3, unit: "months", rollover: "none" }).raw_deadline, "2026-06-15");
  });

  it("gere les annees", () => {
    assert.equal(deadline("2026-06-15", { delay: 2, unit: "years", rollover: "none" }).raw_deadline, "2028-06-15");
  });

  it("proroge aussi sur une fermeture d'entreprise", () => {
    // 18 juillet 2026 est un samedi, la boite est fermee jusqu'au lundi 20
    const res = deadline("2026-07-17", {
      delay: 1,
      calendar: "calendaires",
      closed: "2026-07-18,2026-07-19,2026-07-20",
    });
    assert.equal(res.raw_deadline, "2026-07-18");
    assert.equal(res.deadline, "2026-07-21");
  });

  it("une fermeture ne rallonge pas un decompte calendaire", () => {
    const sans = addDays("2026-07-17", 3, { calendar: "calendaires" });
    const avec = addDays("2026-07-17", 3, {
      calendar: "calendaires",
      closed: "2026-07-18,2026-07-19",
    });
    assert.equal(sans.result, avec.result);
  });

  it("mais elle retire bien un jour ouvre", () => {
    const sans = countDays("2026-06-01", "2026-06-05");
    const avec = countDays("2026-06-01", "2026-06-05", { closed: "2026-06-03" });
    assert.equal(sans.count - avec.count, 1);
  });

  it("refuse un delai negatif ou non entier", () => {
    assert.throws(() => deadline("2026-05-07", { delay: -1 }), InputError);
    assert.throws(() => deadline("2026-05-07", { delay: 1.5 }), InputError);
  });

  it("refuse une unite inconnue", () => {
    assert.throws(() => deadline("2026-05-07", { delay: 1, unit: "semaines" }), InputError);
  });
});
