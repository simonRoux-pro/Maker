/**
 * Controle de conformite d'une facture electronique au format CII, celui que
 * Factur-X embarque dans son PDF.
 *
 * Perimetre annonce sans ambiguite: ce moteur verifie la structure, la
 * presence des mentions obligatoires et surtout la coherence arithmetique des
 * totaux, qui est l'endroit ou les vraies factures echouent. Il ne pretend pas
 * appliquer l'integralite des regles de la norme EN 16931, et chaque controle
 * exerce est nomme dans la reponse.
 *
 * Aucune dependance, aucun appel reseau, rien de conserve. Une facture qui
 * passe par ici n'est ecrite nulle part.
 */

import { XmlError, child, children, localName, parse, path, text } from "./xml.mjs";

export { XmlError };

export class InputError extends Error {}

/** Profils Factur-X, du plus pauvre au plus riche. */
export const PROFILES = [
  { id: "minimum", label: "MINIMUM", note: "donnees d'en-tete seulement, pas de detail de lignes" },
  { id: "basicwl", label: "BASIC WL", note: "sans lignes de detail" },
  { id: "basic", label: "BASIC", note: "lignes de detail simplifiees" },
  { id: "en16931", label: "EN 16931", note: "socle europeen complet" },
  { id: "extended", label: "EXTENDED", note: "extensions franco-allemandes" },
];

const TYPE_CODES = {
  "380": "facture commerciale",
  "381": "avoir",
  "384": "facture rectificative",
  "389": "autofacturation",
  "261": "avoir d'autofacturation",
};

/**
 * Le profil se lit dans le dernier segment de l'URN, apres le dernier diese.
 * Se contenter de chercher le nom du profil dans l'URN entiere conduit a
 * prendre EN 16931 pour tout le monde, puisque toutes les URN commencent par
 * urn:cen.eu:en16931:2017.
 *
 * Les noms les plus longs sont essayes d'abord: basicwl contient basic.
 */
function detectProfile(guideline) {
  if (!guideline) return null;
  const value = guideline.toLowerCase().trim();
  const segments = value.split("#");
  const last = segments[segments.length - 1];

  const candidates = [...PROFILES].sort((a, b) => b.id.length - a.id.length);
  for (const profile of candidates) {
    if (last.endsWith(profile.id) || last.endsWith(`:${profile.id}`)) return profile;
  }
  // une URN sans suffixe de profil designe le socle europeen lui-meme
  if (segments.length === 1 && value.includes("en16931")) {
    return PROFILES.find((p) => p.id === "en16931");
  }
  return null;
}

function amount(node, ...names) {
  const raw = text(node, ...names);
  if (raw === null) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Comparaison au centime: les factures se comparent a deux decimales. */
function near(a, b, tolerance = 0.01) {
  return Math.abs(a - b) <= tolerance + 1e-9;
}

function money(value) {
  return `${value.toFixed(2)}`;
}

/** Date au format 102 de la norme, AAAAMMJJ. */
function parseDate102(raw) {
  if (!raw || !/^\d{8}$/.test(raw)) return null;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

// ------------------------------------------------------------- extraction

/** Lit les donnees utiles sans juger: le jugement vient apres. */
export function extract(xml) {
  const root = parse(xml);
  if (localName(root.name) !== "CrossIndustryInvoice") {
    throw new InputError(
      `racine ${localName(root.name)}: attendu CrossIndustryInvoice, le format CII de Factur-X`,
    );
  }

  const context = child(root, "ExchangedDocumentContext");
  const guideline = text(
    context, "GuidelineSpecifiedDocumentContextParameter", "ID",
  );
  const document = child(root, "ExchangedDocument");
  const transaction = child(root, "SupplyChainTradeTransaction");
  const agreement = child(transaction, "ApplicableHeaderTradeAgreement");
  const settlement = child(transaction, "ApplicableHeaderTradeSettlement");
  const totals = child(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation");

  const party = (name) => {
    const node = child(agreement, name);
    if (!node) return null;
    const vat = children(node, "SpecifiedTaxRegistration")
      .map((r) => child(r, "ID"))
      .find((id) => id && id.attributes.schemeID === "VA");
    return {
      name: text(node, "Name"),
      vat_number: vat ? vat.text.trim() || null : null,
      country: text(path(node, "PostalTradeAddress"), "CountryID"),
    };
  };

  const lines = children(transaction, "IncludedSupplyChainTradeLineItem").map((line) => ({
    id: text(path(line, "AssociatedDocumentLineDocument"), "LineID"),
    name: text(path(line, "SpecifiedTradeProduct"), "Name"),
    net_amount: amount(
      path(line, "SpecifiedLineTradeSettlement", "SpecifiedTradeSettlementLineMonetarySummation"),
      "LineTotalAmount",
    ),
  }));

  const taxes = children(settlement, "ApplicableTradeTax").map((tax) => ({
    category: text(tax, "CategoryCode"),
    rate: amount(tax, "RateApplicablePercent"),
    basis: amount(tax, "BasisAmount"),
    amount: amount(tax, "CalculatedAmount"),
  }));

  const issueRaw = text(
    path(document, "IssueDateTime"), "DateTimeString",
  );

  return {
    guideline,
    profile: detectProfile(guideline),
    invoice_number: text(document, "ID"),
    type_code: text(document, "TypeCode"),
    issue_date: parseDate102(issueRaw),
    issue_date_raw: issueRaw,
    currency: text(settlement, "InvoiceCurrencyCode"),
    seller: party("SellerTradeParty"),
    buyer: party("BuyerTradeParty"),
    lines,
    taxes,
    totals: {
      line_total: amount(totals, "LineTotalAmount"),
      allowance_total: amount(totals, "AllowanceTotalAmount"),
      charge_total: amount(totals, "ChargeTotalAmount"),
      tax_basis_total: amount(totals, "TaxBasisTotalAmount"),
      tax_total: amount(totals, "TaxTotalAmount"),
      grand_total: amount(totals, "GrandTotalAmount"),
      prepaid_total: amount(totals, "TotalPrepaidAmount"),
      due_payable: amount(totals, "DuePayableAmount"),
    },
  };
}

// ------------------------------------------------------------- controles

/**
 * Chaque regle porte son identifiant de terme metier et un message en
 * francais. Les regles arithmetiques reprennent la numerotation BR-CO de la
 * norme, celles de presence sont nommees par leur terme.
 */
const RULES = [
  {
    code: "BT-24",
    level: "erreur",
    message: "identifiant de profil absent: impossible de savoir a quelle norme la facture pretend se conformer",
    check: (d) => Boolean(d.guideline),
  },
  {
    code: "BT-24-PROFIL",
    level: "avertissement",
    message: "profil non reconnu: la valeur ne correspond a aucun profil Factur-X connu",
    check: (d) => !d.guideline || Boolean(d.profile),
  },
  {
    code: "BT-1",
    level: "erreur",
    message: "numero de facture absent",
    check: (d) => Boolean(d.invoice_number),
  },
  {
    code: "BT-2",
    level: "erreur",
    message: "date d'emission absente ou invalide, le format attendu est AAAAMMJJ",
    check: (d) => Boolean(d.issue_date),
  },
  {
    code: "BT-3",
    level: "erreur",
    message: "code de type de document absent, 380 pour une facture, 381 pour un avoir",
    check: (d) => Boolean(d.type_code),
  },
  {
    code: "BT-3-CODE",
    level: "avertissement",
    message: "code de type de document inhabituel",
    check: (d) => !d.type_code || d.type_code in TYPE_CODES,
  },
  {
    code: "BT-5",
    level: "erreur",
    message: "devise absente",
    check: (d) => Boolean(d.currency),
  },
  {
    code: "BT-27",
    level: "erreur",
    message: "nom du vendeur absent",
    check: (d) => Boolean(d.seller && d.seller.name),
  },
  {
    code: "BT-31",
    level: "avertissement",
    message: "numero de TVA du vendeur absent: obligatoire des lors que l'operation est soumise a la TVA",
    check: (d) => Boolean(d.seller && d.seller.vat_number),
  },
  {
    code: "BT-44",
    level: "erreur",
    message: "nom de l'acheteur absent",
    check: (d) => Boolean(d.buyer && d.buyer.name),
  },
  {
    code: "BT-112",
    level: "erreur",
    message: "montant total toutes taxes comprises absent",
    check: (d) => d.totals.grand_total !== null,
  },
  {
    code: "BT-115",
    level: "erreur",
    message: "montant net a payer absent",
    check: (d) => d.totals.due_payable !== null,
  },
];

/** Regles arithmetiques, la ou les vraies factures echouent. */
function arithmetic(data) {
  const t = data.totals;
  const found = [];

  const lineSum = data.lines.reduce(
    (sum, line) => (line.net_amount === null ? sum : sum + line.net_amount),
    0,
  );
  if (data.lines.length && t.line_total !== null && !near(lineSum, t.line_total)) {
    found.push({
      code: "BR-CO-10",
      level: "erreur",
      message:
        `somme des lignes ${money(lineSum)} differente du total des lignes declare ` +
        `${money(t.line_total)}`,
    });
  }

  if (t.line_total !== null && t.tax_basis_total !== null) {
    const expected = t.line_total - (t.allowance_total ?? 0) + (t.charge_total ?? 0);
    if (!near(expected, t.tax_basis_total)) {
      found.push({
        code: "BR-CO-13",
        level: "erreur",
        message:
          `base hors taxes attendue ${money(expected)}, declaree ` +
          `${money(t.tax_basis_total)}`,
      });
    }
  }

  if (t.tax_basis_total !== null && t.tax_total !== null && t.grand_total !== null) {
    const expected = t.tax_basis_total + t.tax_total;
    if (!near(expected, t.grand_total)) {
      found.push({
        code: "BR-CO-15",
        level: "erreur",
        message:
          `total toutes taxes attendu ${money(expected)}, declare ${money(t.grand_total)}`,
      });
    }
  }

  if (t.grand_total !== null && t.due_payable !== null) {
    const expected = t.grand_total - (t.prepaid_total ?? 0);
    if (!near(expected, t.due_payable)) {
      found.push({
        code: "BR-CO-16",
        level: "erreur",
        message: `net a payer attendu ${money(expected)}, declare ${money(t.due_payable)}`,
      });
    }
  }

  for (const tax of data.taxes) {
    if (tax.basis === null || tax.rate === null || tax.amount === null) continue;
    const expected = Math.round(tax.basis * tax.rate) / 100;
    if (!near(expected, tax.amount, 0.02)) {
      found.push({
        code: "BR-CO-17",
        level: "erreur",
        message:
          `TVA a ${tax.rate} pourcent: attendue ${money(expected)} sur une base de ` +
          `${money(tax.basis)}, declaree ${money(tax.amount)}`,
      });
    }
  }

  const taxSum = data.taxes.reduce((sum, tax) => sum + (tax.amount ?? 0), 0);
  if (data.taxes.length && t.tax_total !== null && !near(taxSum, t.tax_total)) {
    found.push({
      code: "BR-CO-14",
      level: "erreur",
      message:
        `somme des lignes de TVA ${money(taxSum)} differente du total de TVA declare ` +
        `${money(t.tax_total)}`,
    });
  }

  return found;
}

/** Liste des controles exerces, pour que le perimetre soit verifiable. */
export function checksPerformed() {
  return [
    ...RULES.map((r) => ({ code: r.code, level: r.level, sujet: "mention obligatoire" })),
    { code: "BR-CO-10", level: "erreur", sujet: "somme des lignes" },
    { code: "BR-CO-13", level: "erreur", sujet: "base hors taxes" },
    { code: "BR-CO-14", level: "erreur", sujet: "somme des lignes de TVA" },
    { code: "BR-CO-15", level: "erreur", sujet: "total toutes taxes" },
    { code: "BR-CO-16", level: "erreur", sujet: "net a payer" },
    { code: "BR-CO-17", level: "erreur", sujet: "TVA par taux" },
  ];
}

export function validate(xml) {
  let data;
  try {
    data = extract(xml);
  } catch (err) {
    if (err instanceof XmlError || err instanceof InputError) {
      return {
        valid: false,
        readable: false,
        errors: [{ code: "XML", level: "erreur", message: err.message }],
        warnings: [],
        invoice: null,
        checks_performed: checksPerformed().length,
      };
    }
    throw err;
  }

  const found = [
    ...RULES.filter((rule) => !rule.check(data)).map((rule) => ({
      code: rule.code,
      level: rule.level,
      message: rule.message,
    })),
    ...arithmetic(data),
  ];

  const errors = found.filter((f) => f.level === "erreur");
  const warnings = found.filter((f) => f.level === "avertissement");

  return {
    valid: errors.length === 0,
    readable: true,
    profile: data.profile ? data.profile.label : null,
    errors,
    warnings,
    invoice: {
      number: data.invoice_number,
      issue_date: data.issue_date,
      type: data.type_code ? TYPE_CODES[data.type_code] ?? data.type_code : null,
      currency: data.currency,
      seller: data.seller,
      buyer: data.buyer,
      lines: data.lines.length,
      grand_total: data.totals.grand_total,
      due_payable: data.totals.due_payable,
    },
    checks_performed: checksPerformed().length,
    scope:
      "structure, mentions obligatoires et coherence arithmetique des totaux. " +
      "Ce controle ne couvre pas l'integralite des regles EN 16931.",
  };
}
