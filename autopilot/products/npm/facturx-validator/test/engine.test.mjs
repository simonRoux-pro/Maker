import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { InputError, checksPerformed, extract, validate } from "../index.mjs";
import { VALIDE, modifier } from "./fixtures.mjs";

describe("facture conforme", () => {
  const res = validate(VALIDE);

  it("est declaree valide", () => {
    assert.equal(res.valid, true, JSON.stringify(res.errors));
    assert.equal(res.errors.length, 0);
    assert.equal(res.warnings.length, 0);
  });

  it("reconnait le profil", () => {
    assert.equal(res.profile, "BASIC");
  });

  it("restitue les donnees lisibles par un humain", () => {
    assert.equal(res.invoice.number, "FA-2026-0001");
    assert.equal(res.invoice.issue_date, "2026-09-15");
    assert.equal(res.invoice.type, "facture commerciale");
    assert.equal(res.invoice.currency, "EUR");
    assert.equal(res.invoice.seller.name, "Atelier Dupont");
    assert.equal(res.invoice.seller.vat_number, "FR44732829320");
    assert.equal(res.invoice.buyer.name, "Societe Martin");
    assert.equal(res.invoice.lines, 2);
    assert.equal(res.invoice.grand_total, 1200);
  });

  it("annonce son perimetre au lieu de le laisser deviner", () => {
    assert.ok(res.checks_performed >= 15);
    assert.match(res.scope, /ne couvre pas l'integralite/);
  });
});

describe("mentions obligatoires manquantes", () => {
  const sansCode = (source, code) => {
    const res = validate(source);
    return res.errors.concat(res.warnings).find((e) => e.code === code);
  };

  it("detecte un numero de facture absent", () => {
    const xml = modifier(VALIDE, "<ram:ID>FA-2026-0001</ram:ID>", "<ram:ID></ram:ID>");
    assert.ok(sansCode(xml, "BT-1"));
  });

  it("detecte une date invalide", () => {
    const xml = modifier(VALIDE, "20260915", "20260931");
    const erreur = sansCode(xml, "BT-2");
    assert.ok(erreur);
    assert.match(erreur.message, /AAAAMMJJ/);
  });

  it("detecte une devise absente", () => {
    const xml = modifier(VALIDE, "<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>", "");
    assert.ok(sansCode(xml, "BT-5"));
  });

  it("detecte un vendeur sans nom", () => {
    const xml = modifier(VALIDE, "<ram:Name>Atelier Dupont</ram:Name>", "");
    assert.ok(sansCode(xml, "BT-27"));
  });

  it("avertit sur un numero de TVA vendeur absent sans bloquer", () => {
    const xml = modifier(VALIDE, '<ram:ID schemeID="VA">FR44732829320</ram:ID>', "");
    const res = validate(xml);
    assert.ok(res.warnings.some((w) => w.code === "BT-31"));
    assert.equal(res.valid, true, "une TVA absente avertit, elle ne condamne pas");
  });

  it("avertit sur un profil inconnu", () => {
    const xml = modifier(VALIDE, "urn:factur-x.eu:1p0:basic", "urn:exemple:inconnu");
    const res = validate(xml);
    assert.ok(res.warnings.some((w) => w.code === "BT-24-PROFIL"));
    assert.equal(res.profile, null);
  });
});

describe("coherence arithmetique", () => {
  const erreur = (xml, code) => validate(xml).errors.find((e) => e.code === code);

  it("BR-CO-10, somme des lignes fausse", () => {
    const xml = modifier(VALIDE, "<ram:LineTotalAmount>800.00</ram:LineTotalAmount>",
      "<ram:LineTotalAmount>700.00</ram:LineTotalAmount>");
    const e = erreur(xml, "BR-CO-10");
    assert.ok(e);
    assert.match(e.message, /900\.00.*1000\.00/);
  });

  it("BR-CO-15, total toutes taxes faux", () => {
    const xml = modifier(VALIDE, "<ram:GrandTotalAmount>1200.00</ram:GrandTotalAmount>",
      "<ram:GrandTotalAmount>1100.00</ram:GrandTotalAmount>");
    assert.ok(erreur(xml, "BR-CO-15"));
  });

  it("BR-CO-16, net a payer faux", () => {
    const xml = modifier(VALIDE, "<ram:DuePayableAmount>1200.00</ram:DuePayableAmount>",
      "<ram:DuePayableAmount>1000.00</ram:DuePayableAmount>");
    const e = erreur(xml, "BR-CO-16");
    assert.ok(e);
    assert.match(e.message, /1200\.00/);
  });

  it("BR-CO-16 accepte un acompte deduit", () => {
    let xml = modifier(VALIDE, "<ram:TotalPrepaidAmount>0.00</ram:TotalPrepaidAmount>",
      "<ram:TotalPrepaidAmount>300.00</ram:TotalPrepaidAmount>");
    xml = modifier(xml, "<ram:DuePayableAmount>1200.00</ram:DuePayableAmount>",
      "<ram:DuePayableAmount>900.00</ram:DuePayableAmount>");
    assert.equal(validate(xml).valid, true);
  });

  it("BR-CO-17, TVA incoherente avec son taux", () => {
    let xml = modifier(VALIDE, "<ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>",
      "<ram:RateApplicablePercent>10.00</ram:RateApplicablePercent>");
    const e = erreur(xml, "BR-CO-17");
    assert.ok(e);
    assert.match(e.message, /100\.00/);
  });

  it("tolere un ecart d'un centime, pas davantage", () => {
    const juste = modifier(VALIDE, "<ram:GrandTotalAmount>1200.00</ram:GrandTotalAmount>",
      "<ram:GrandTotalAmount>1200.01</ram:GrandTotalAmount>");
    assert.equal(validate(juste).errors.some((e) => e.code === "BR-CO-15"), false);
    const trop = modifier(VALIDE, "<ram:GrandTotalAmount>1200.00</ram:GrandTotalAmount>",
      "<ram:GrandTotalAmount>1200.50</ram:GrandTotalAmount>");
    assert.ok(validate(trop).errors.some((e) => e.code === "BR-CO-15"));
  });
});

describe("entrees hostiles ou illisibles", () => {
  it("refuse une DOCTYPE, donc les entites externes", () => {
    const res = validate('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>');
    assert.equal(res.readable, false);
    assert.equal(res.errors[0].code, "XML");
    assert.match(res.errors[0].message, /DOCTYPE/);
  });

  it("refuse un XML mal forme sans lever d'exception", () => {
    const res = validate("<a><b></a>");
    assert.equal(res.valid, false);
    assert.equal(res.readable, false);
  });

  it("refuse une racine qui n'est pas une facture CII", () => {
    const res = validate("<Invoice><ID>1</ID></Invoice>");
    assert.equal(res.readable, false);
    assert.match(res.errors[0].message, /CrossIndustryInvoice/);
  });

  it("extract leve une erreur typee sur une racine etrangere", () => {
    assert.throws(() => extract("<autre/>"), InputError);
  });

  it("annonce la liste des controles exerces", () => {
    const liste = checksPerformed();
    assert.ok(liste.length >= 15);
    assert.ok(liste.every((c) => c.code && c.level && c.sujet));
  });
});
