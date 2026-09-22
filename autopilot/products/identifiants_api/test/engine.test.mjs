import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InputError,
  checkIban,
  checkNir,
  checkRib,
  checkSiren,
  checkSiret,
  checkVat,
  ribKey,
  vatBreakdown,
  vatFromSiren,
} from "../engine.mjs";

describe("IBAN", () => {
  it("accepte des IBAN publiquement connus comme valides", () => {
    for (const iban of [
      "FR1420041010050500013M02606",
      "DE89370400440532013000",
      "GB82WEST12345698765432",
      "BE68539007547034",
      "NL91ABNA0417164300",
    ]) {
      assert.equal(checkIban(iban).valid, true, iban);
    }
  });

  it("refuse un IBAN dont un chiffre a change", () => {
    const res = checkIban("FR1420041010050500013M02607");
    assert.equal(res.valid, false);
    assert.equal(res.reason, "cle de controle incorrecte");
  });

  it("ignore espaces, points et tirets", () => {
    assert.equal(checkIban("FR14 2004 1010 0505 0001 3M02 606").valid, true);
    assert.equal(checkIban("de89-3704-0044-0532-0130-00").valid, true);
  });

  it("verifie la longueur propre a chaque pays", () => {
    const res = checkIban("FR142004101005050001");
    assert.equal(res.valid, false);
    assert.match(res.reason, /longueur/);
  });

  it("refuse un pays hors perimetre plutot que de deviner", () => {
    const res = checkIban("ZZ68539007547034");
    assert.equal(res.valid, false);
    assert.match(res.reason, /hors perimetre/);
  });

  it("decoupe le BBAN et reformate", () => {
    const res = checkIban("FR1420041010050500013M02606");
    assert.equal(res.bban, "20041010050500013M02606");
    assert.equal(res.check_digits, "14");
    assert.equal(res.formatted, "FR14 2004 1010 0505 0001 3M02 606");
  });
});

describe("cle RIB", () => {
  it("retrouve la cle portee par un IBAN francais valide", () => {
    // le BBAN de FR1420041010050500013M02606 se termine par sa cle, 06
    assert.equal(ribKey("20041", "01005", "0500013M026").key, "06");
  });

  it("convertit les lettres du numero de compte", () => {
    const avec = ribKey("20041", "01005", "0500013M026");
    const sans = ribKey("20041", "01005", "05000134026");
    assert.equal(avec.key, sans.key, "M vaut 4 dans la table officielle");
  });

  it("verifie une cle fournie", () => {
    assert.equal(checkRib("20041", "01005", "0500013M026", "06").valid, true);
    const faux = checkRib("20041", "01005", "0500013M026", "07");
    assert.equal(faux.valid, false);
    assert.match(faux.reason, /06/);
  });

  it("refuse des longueurs incorrectes", () => {
    assert.throws(() => ribKey("2004", "01005", "0500013M026"), InputError);
    assert.throws(() => ribKey("20041", "01005", "0500013M02"), InputError);
  });
});

describe("SIREN et SIRET", () => {
  it("valide un SIREN correct", () => {
    assert.equal(checkSiren("732829320").valid, true);
    assert.equal(checkSiren("732 829 320").valid, true);
  });

  it("refuse un SIREN dont un chiffre a change", () => {
    assert.equal(checkSiren("732829321").valid, false);
  });

  it("refuse une longueur incorrecte", () => {
    assert.match(checkSiren("73282932").reason, /9 chiffres/);
  });

  it("applique l'exception La Poste", () => {
    const res = checkSiret("35600000009075");
    assert.equal(res.valid, true);
    assert.equal(res.rule, "la_poste");
    assert.equal(res.siren, "356000000");
    // le meme numero echouerait a Luhn
    assert.equal(checkSiret("35600000009076").valid, false);
  });

  it("decoupe SIREN et NIC", () => {
    const res = checkSiret("35600000009075");
    assert.equal(res.nic, "09075");
  });
});

describe("TVA intracommunautaire", () => {
  it("calcule la cle francaise", () => {
    const res = vatFromSiren("732829320");
    assert.equal(res.key, "44");
    assert.equal(res.vat_number, "FR44732829320");
  });

  it("verifie une cle francaise par le calcul", () => {
    const res = checkVat("FR44732829320");
    assert.equal(res.valid, true);
    assert.equal(res.checked, "checksum");

    const faux = checkVat("FR45732829320");
    assert.equal(faux.valid, false);
    assert.match(faux.reason, /44/);
  });

  it("dit clairement qu'il ne verifie que la forme hors de France", () => {
    const res = checkVat("DE123456789");
    assert.equal(res.valid, true);
    assert.equal(res.checked, "format");
    assert.match(res.note, /non verifiee/);
  });

  it("refuse un format incorrect", () => {
    assert.equal(checkVat("DE12345").valid, false);
    assert.equal(checkVat("NL123456789X99").valid, false);
  });

  it("accepte le format neerlandais avec son B", () => {
    assert.equal(checkVat("NL123456789B01").valid, true);
  });

  it("refuse un pays hors Union europeenne", () => {
    const res = checkVat("CH123456789");
    assert.equal(res.valid, false);
    assert.match(res.reason, /hors perimetre/);
  });

  it("ne pretend pas recalculer une ancienne cle alphabetique", () => {
    const res = checkVat("FRAB732829320");
    assert.equal(res.checked, "format");
    assert.match(res.note, /alphabetique/);
  });
});

describe("numero de securite sociale", () => {
  it("valide un NIR publiquement cite comme exemple", () => {
    const res = checkNir("2 69 05 49 588 157 80");
    assert.equal(res.valid, true);
    assert.equal(res.sex, "femme");
    assert.equal(res.birth_year, "69");
    assert.equal(res.department, "49");
  });

  it("rejette une cle fausse", () => {
    const res = checkNir("269054958815781");
    assert.equal(res.valid, false);
    assert.match(res.reason, /80/);
  });

  it("gere la Corse, que beaucoup d'implementations rejettent", () => {
    const res = checkNir("180122A12345602");
    assert.equal(res.valid, true);
    assert.equal(res.corsica, true);
    assert.equal(res.department, "2A");
  });

  it("refuse une longueur incorrecte", () => {
    assert.match(checkNir("26905495881578").reason, /15 caracteres/);
    assert.match(checkNir("2690549588157800").reason, /15 caracteres/);
  });

  it("signale un mois conventionnel", () => {
    const res = checkNir("199" + "99" + "75" + "123" + "456" + "00");
    assert.equal(res.birth_month, "99");
    assert.match(res.note, /etranger/);
  });
});

describe("ventilation de TVA", () => {
  it("calcule le TTC depuis le HT", () => {
    assert.deepEqual(vatBreakdown({ amount: 100, rate: 20 }), {
      ht: 100, tva: 20, ttc: 120, rate: 20, from: "ht",
    });
  });

  it("retrouve le HT depuis le TTC", () => {
    const res = vatBreakdown({ amount: 120, rate: 20, from: "ttc" });
    assert.equal(res.ht, 100);
    assert.equal(res.tva, 20);
  });

  it("donne toujours trois montants qui s'additionnent", () => {
    for (const amount of [19.99, 33.33, 0.01, 1234.56, 7.77]) {
      for (const rate of [20, 10, 5.5, 2.1]) {
        const r = vatBreakdown({ amount, rate });
        assert.equal(
          Math.round((r.ht + r.tva) * 100) / 100,
          r.ttc,
          `${amount} a ${rate} pourcent`,
        );
      }
    }
  });

  it("accepte un taux nul", () => {
    const res = vatBreakdown({ amount: 50, rate: 0 });
    assert.equal(res.tva, 0);
    assert.equal(res.ttc, 50);
  });

  it("refuse une entree absurde", () => {
    assert.throws(() => vatBreakdown({ amount: -1 }), InputError);
    assert.throws(() => vatBreakdown({ amount: 10, rate: 150 }), InputError);
    assert.throws(() => vatBreakdown({ amount: 10, from: "net" }), InputError);
  });
});
