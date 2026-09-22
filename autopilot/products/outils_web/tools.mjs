/**
 * Les controleurs d'interface, un par page, injectes dans le navigateur.
 *
 * Ils sont ecrits en chaines plutot qu'en modules separes parce qu'ils sont
 * concatenes dans la page avec le moteur: une page, un fichier, aucun appel
 * reseau supplementaire.
 */

const FORM = (fields, button = "Calculer") => `
<form id="f">
  ${fields}
  <button type="submit">${button}</button>
</form>
<output id="out" aria-live="polite"></output>`;

const ZONE_SELECT = `
<label>Zone
  <select name="zone">
    <option value="metropole">France métropolitaine</option>
    <option value="alsace-moselle">Alsace-Moselle</option>
    <option value="guadeloupe">Guadeloupe</option>
    <option value="martinique">Martinique</option>
    <option value="guyane">Guyane</option>
    <option value="reunion">La Réunion</option>
    <option value="mayotte">Mayotte</option>
    <option value="saint-martin">Saint-Martin</option>
    <option value="saint-barthelemy">Saint-Barthélemy</option>
  </select>
</label>`;

const CALENDAR_SELECT = `
<label>Calendrier
  <select name="calendar">
    <option value="ouvres">jours ouvrés, lundi à vendredi</option>
    <option value="ouvrables">jours ouvrables, lundi à samedi</option>
    <option value="calendaires">jours calendaires, tous les jours</option>
  </select>
</label>`;

const HELPERS = `
const LABELS = { ouvres: "jours ouvrés", ouvrables: "jours ouvrables",
  calendaires: "jours calendaires" };
const $ = (s) => document.querySelector(s);
const out = (html) => { $("#out").innerHTML = html; };
const ok = (html) => out('<div class="result ok">' + html + "</div>");
const ko = (msg) => out('<div class="result ko">' + msg + "</div>");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fr = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("fr-FR",
  { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
function guard(fn) {
  return (event) => {
    event.preventDefault();
    try { fn(new FormData($("#f"))); }
    catch (err) { ko(esc(err.message)); }
  };
}`;

export const TOOLS = {
  "jours-ouvres": {
    html: FORM(`
  <label>Mode
    <select name="mode">
      <option value="count">compter entre deux dates</option>
      <option value="add">ajouter des jours à une date</option>
    </select>
  </label>
  <label>Date de début<input type="date" name="from" required></label>
  <label id="to-field">Date de fin<input type="date" name="to"></label>
  <label id="days-field" hidden>Nombre de jours<input type="number" name="days" value="10"></label>
  ${CALENDAR_SELECT}
  ${ZONE_SELECT}`),
    script: `${HELPERS}
const mode = $("[name=mode]");
function sync() {
  const add = mode.value === "add";
  $("#to-field").hidden = add;
  $("#days-field").hidden = !add;
  $("[name=to]").required = !add;
}
mode.addEventListener("change", sync); sync();
$("#f").addEventListener("submit", guard((d) => {
  const opts = { calendar: d.get("calendar"), zone: d.get("zone") };
  if (mode.value === "add") {
    const r = addDays(d.get("from"), Number(d.get("days")), opts);
    ok("<strong>" + fr(r.result) + "</strong><p>" + d.get("days") +
      " " + LABELS[r.calendar] + " après le " + fr(r.from) + ".</p>");
  } else {
    const r = countDays(d.get("from"), d.get("to"), opts);
    ok("<strong>" + r.count + " " + LABELS[r.calendar] + "</strong><p>sur " +
      r.calendar_days + " jours de calendrier, bornes comprises.</p>");
  }
}));`,
  },

  delai: {
    html: FORM(`
  <label>Date de départ<input type="date" name="from" required></label>
  <label>Délai<input type="number" name="delay" value="14" min="0" required></label>
  <label>Unité
    <select name="unit">
      <option value="days">jours</option>
      <option value="months">mois</option>
      <option value="years">années</option>
    </select>
  </label>
  ${CALENDAR_SELECT}
  <label>Report de l'échéance
    <select name="rollover">
      <option value="next_business_day">au premier jour ouvré suivant, article 642</option>
      <option value="none">aucun report</option>
      <option value="previous_business_day">au jour ouvré précédent</option>
    </select>
  </label>
  ${ZONE_SELECT}
  <label>Fermetures de l'entreprise, séparées par des virgules
    <input type="text" name="closed" placeholder="2026-07-20,2026-07-21"></label>`),
    script: `${HELPERS}
$("#f").addEventListener("submit", guard((d) => {
  const r = deadline(d.get("from"), {
    delay: Number(d.get("delay")), unit: d.get("unit"),
    calendar: d.get("calendar"), zone: d.get("zone"),
    rollover: d.get("rollover"), closed: d.get("closed") || null,
  });
  let html = "<strong>" + fr(r.deadline) + "</strong>";
  html += r.rolled
    ? "<p>L'échéance brute tombait le " + fr(r.raw_deadline) +
      ", reportée au premier jour ouvré suivant.</p>"
    : "<p>Aucun report nécessaire.</p>";
  ok(html);
}));`,
  },

  "jours-feries": {
    html: FORM(`
  <label>Année<input type="number" name="year" value="2026" min="1982" max="2100" required></label>
  ${ZONE_SELECT}`, "Afficher"),
    script: `${HELPERS}
$("#f").addEventListener("submit", guard((d) => {
  const list = holidays(Number(d.get("year")), d.get("zone"));
  const rows = list.map((h) => "<tr><td>" + fr(h.date) + "</td><td>" + esc(h.name) + "</td></tr>");
  ok("<strong>" + list.length + " jours fériés</strong><table>" + rows.join("") + "</table>");
}));
$("#f").dispatchEvent(new Event("submit"));`,
  },

  iban: {
    html: FORM(`
  <label>IBAN<input type="text" name="iban" placeholder="FR14 2004 1010 0505 0001 3M02 606" required
    autocomplete="off" spellcheck="false"></label>`, "Vérifier"),
    script: `${HELPERS}
$("#f").addEventListener("submit", guard((d) => {
  const r = checkIban(d.get("iban"));
  if (!r.valid) return ko("<strong>IBAN invalide</strong><p>" + esc(r.reason) + "</p>");
  ok("<strong>IBAN valide</strong><p>" + esc(r.formatted) + "</p><p>Pays " +
    esc(r.country) + ", clé " + esc(r.check_digits) + ".</p>");
}));`,
  },

  siret: {
    html: FORM(`
  <label>Numéro<input type="text" name="value" placeholder="732829320" required
    autocomplete="off" spellcheck="false"></label>
  <p class="hint">SIREN sur 9 chiffres, SIRET sur 14, ou numéro de TVA commençant par deux lettres.</p>`,
      "Vérifier"),
    script: `${HELPERS}
$("#f").addEventListener("submit", guard((d) => {
  const raw = d.get("value").replace(/[\\s.-]/g, "").toUpperCase();
  if (/^[A-Z]{2}/.test(raw)) {
    const r = checkVat(raw);
    if (!r.valid) return ko("<strong>Numéro de TVA invalide</strong><p>" + esc(r.reason) + "</p>");
    return ok("<strong>Numéro de TVA valide</strong><p>" +
      (r.checked === "checksum" ? "Clé recalculée." : "Forme conforme, clé non vérifiée pour ce pays.") + "</p>");
  }
  if (raw.length === 14) {
    const r = checkSiret(raw);
    if (!r.valid) return ko("<strong>SIRET invalide</strong><p>" + esc(r.reason) + "</p>");
    return ok("<strong>SIRET valide</strong><p>SIREN " + esc(r.siren) + ", NIC " + esc(r.nic) +
      (r.rule === "la_poste" ? ". Règle La Poste appliquée." : ".") + "</p>");
  }
  const r = checkSiren(raw);
  if (!r.valid) return ko("<strong>SIREN invalide</strong><p>" + esc(r.reason) + "</p>");
  const tva = vatFromSiren(raw);
  ok("<strong>SIREN valide</strong><p>Numéro de TVA intracommunautaire : <strong>" +
    esc(tva.vat_number) + "</strong></p>");
}));`,
  },

  "facture-electronique": {
    html: `
<form id="f">
  <label>XML de la facture, au format CII
    <textarea name="xml" rows="8" required spellcheck="false"
      placeholder="&lt;rsm:CrossIndustryInvoice ..."></textarea></label>
  <label>ou choisissez un fichier
    <input type="file" name="fichier" accept=".xml,text/xml,application/xml"></label>
  <button type="submit">Vérifier</button>
</form>
<output id="out" aria-live="polite"></output>`,
    script: `${HELPERS}
$("[name=fichier]").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) $("[name=xml]").value = await file.text();
});
$("#f").addEventListener("submit", guard((d) => {
  const r = validate(d.get("xml"));
  const liste = (items, titre) => items.length
    ? "<p><strong>" + titre + "</strong></p><table>" + items.map((i) =>
        "<tr><td>" + esc(i.message) + "</td><td>" + esc(i.code) + "</td></tr>").join("") + "</table>"
    : "";
  if (!r.readable) return ko("<strong>Document illisible</strong>" + liste(r.errors, "Cause"));
  const entete = r.invoice
    ? "<p>Facture " + esc(r.invoice.number || "sans numéro") +
      (r.invoice.issue_date ? " du " + fr(r.invoice.issue_date) : "") +
      (r.profile ? ", profil " + esc(r.profile) : "") + "</p>"
    : "";
  const pied = '<p class="hint">' + r.checks_performed + " contrôles exercés. " +
    esc(r.scope) + "</p>";
  if (r.valid) {
    ok("<strong>Facture conforme</strong>" + entete +
      liste(r.warnings, "Avertissements") + pied);
  } else {
    ko("<strong>" + r.errors.length + " anomalie(s)</strong>" + entete +
      liste(r.errors, "Erreurs") + liste(r.warnings, "Avertissements") + pied);
  }
}));`,
  },

  nir: {
    html: FORM(`
  <label>Numéro de sécurité sociale<input type="text" name="nir"
    placeholder="2 69 05 49 588 157 80" required autocomplete="off" spellcheck="false"></label>`,
      "Vérifier"),
    script: `${HELPERS}
$("#f").addEventListener("submit", guard((d) => {
  const r = checkNir(d.get("nir"));
  if (!r.valid) return ko("<strong>Numéro invalide</strong><p>" + esc(r.reason) + "</p>");
  const ne = r.sex === "femme" ? "née" : r.sex === "homme" ? "né" : "numéro provisoire,";
  ok("<strong>Numéro valide</strong><p>" + esc(r.sex) + ", " + ne + " en " +
    esc(r.birth_year) + ", département " + esc(r.department) +
    (r.corsica ? " (Corse)" : "") + ".</p>" +
    (r.note ? "<p>" + esc(r.note) + "</p>" : ""));
}));`,
  },

  tva: {
    html: FORM(`
  <label>Montant<input type="number" name="amount" step="0.01" min="0" value="100" required></label>
  <label>Ce montant est
    <select name="from">
      <option value="ht">hors taxes</option>
      <option value="ttc">toutes taxes comprises</option>
    </select>
  </label>
  <label>Taux
    <select name="rate">
      <option value="20">20 %, taux normal</option>
      <option value="10">10 %, taux intermédiaire</option>
      <option value="5.5">5,5 %, taux réduit</option>
      <option value="2.1">2,1 %, taux particulier</option>
    </select>
  </label>`),
    script: `${HELPERS}
const euros = (n) => n.toFixed(2).replace(".", ",") + " €";
$("#f").addEventListener("submit", guard((d) => {
  const r = vatBreakdown({
    amount: Number(d.get("amount")), rate: Number(d.get("rate")), from: d.get("from"),
  });
  ok("<strong>" + euros(r.ttc) + " TTC</strong><table>" +
    "<tr><td>Hors taxes</td><td>" + euros(r.ht) + "</td></tr>" +
    "<tr><td>TVA " + String(r.rate).replace(".", ",") + " %</td><td>" + euros(r.tva) + "</td></tr>" +
    "<tr><td>Toutes taxes</td><td>" + euros(r.ttc) + "</td></tr></table>");
}));`,
  },

  rib: {
    html: FORM(`
  <label>Code banque<input type="text" name="bank" placeholder="20041" required
    autocomplete="off" spellcheck="false"></label>
  <label>Code guichet<input type="text" name="branch" placeholder="01005" required
    autocomplete="off" spellcheck="false"></label>
  <label>Numéro de compte<input type="text" name="account" placeholder="0500013M026" required
    autocomplete="off" spellcheck="false"></label>
  <label>Clé, facultative<input type="text" name="key" placeholder="06"
    autocomplete="off" spellcheck="false"></label>`),
    script: `${HELPERS}
$("#f").addEventListener("submit", guard((d) => {
  const key = (d.get("key") || "").trim();
  if (key) {
    const r = checkRib(d.get("bank"), d.get("branch"), d.get("account"), key);
    return r.valid
      ? ok("<strong>Clé correcte</strong>")
      : ko("<strong>Clé incorrecte</strong><p>" + esc(r.reason) + "</p>");
  }
  const r = ribKey(d.get("bank"), d.get("branch"), d.get("account"));
  ok("<strong>Clé " + esc(r.key) + "</strong>");
}));`,
  },
};
