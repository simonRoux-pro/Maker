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
