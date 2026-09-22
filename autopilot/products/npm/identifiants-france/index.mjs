/**
 * Fichier genere: copie du moteur utilise par l'API hebergee.
 * Ne pas modifier a la main, voir products/npm/build.mjs.
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
