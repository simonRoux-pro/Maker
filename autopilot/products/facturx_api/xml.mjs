/**
 * Analyseur XML minimal, sans dependance.
 *
 * Volontairement restreint a ce qu'une facture electronique contient. Il
 * refuse tout ce qui sert a attaquer un analyseur XML plutot que de tenter
 * de le gerer:
 *
 *   - aucune DOCTYPE, donc aucune entite externe: c'est la faille XXE, la
 *     plus classique sur les traitements de factures
 *   - aucune entite personnalisee, donc pas de bombe a expansion
 *   - profondeur et taille bornees
 *
 * Les noms sont exposes sans prefixe de namespace: une facture valide peut
 * declarer ram: ou rsm: autrement, seul le nom local compte.
 */

export class XmlError extends Error {}

const MAX_SIZE = 8 * 1024 * 1024;
const MAX_DEPTH = 100;

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
};

function decode(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, code) => {
    if (code[0] === "#") {
      const value = code[1] === "x" || code[1] === "X"
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) {
        throw new XmlError(`reference de caractere invalide: ${whole}`);
      }
      return String.fromCodePoint(value);
    }
    if (code in ENTITIES) return ENTITIES[code];
    throw new XmlError(`entite non autorisee: ${whole}`);
  });
}

/** Nom local, sans prefixe de namespace. */
export function localName(name) {
  const colon = name.indexOf(":");
  return colon === -1 ? name : name.slice(colon + 1);
}

/**
 * Noeud: { name, attributes, children, text }
 * text ne contient que le texte direct, pas celui des enfants.
 */
export function parse(source) {
  if (typeof source !== "string") throw new XmlError("le document doit etre une chaine");
  if (source.length > MAX_SIZE) throw new XmlError("document trop volumineux, 8 Mo maximum");
  if (/<!DOCTYPE/i.test(source)) {
    throw new XmlError("DOCTYPE refuse: les entites externes ne sont pas acceptees");
  }

  let index = 0;
  const stack = [];
  let root = null;

  const fail = (message) => {
    throw new XmlError(`${message} (position ${index})`);
  };

  while (index < source.length) {
    const open = source.indexOf("<", index);
    if (open === -1) break;

    if (open > index && stack.length) {
      stack[stack.length - 1].text += decode(source.slice(index, open));
    }

    // declaration, commentaire, CDATA
    if (source.startsWith("<?", open)) {
      const end = source.indexOf("?>", open);
      if (end === -1) fail("declaration non terminee");
      index = end + 2;
      continue;
    }
    if (source.startsWith("<!--", open)) {
      const end = source.indexOf("-->", open);
      if (end === -1) fail("commentaire non termine");
      index = end + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", open)) {
      const end = source.indexOf("]]>", open);
      if (end === -1) fail("section CDATA non terminee");
      if (stack.length) stack[stack.length - 1].text += source.slice(open + 9, end);
      index = end + 3;
      continue;
    }

    const close = source.indexOf(">", open);
    if (close === -1) fail("balise non terminee");
    const raw = source.slice(open + 1, close).trim();

    // fermeture
    if (raw.startsWith("/")) {
      const name = raw.slice(1).trim();
      const node = stack.pop();
      if (!node) fail(`fermeture sans ouverture: ${name}`);
      if (node.name !== name) fail(`fermeture ${name} pour une ouverture ${node.name}`);
      index = close + 1;
      continue;
    }

    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1).trim() : raw;
    const space = body.search(/\s/);
    const name = space === -1 ? body : body.slice(0, space);
    if (!name) fail("balise sans nom");

    const attributes = {};
    if (space !== -1) {
      const rest = body.slice(space);
      const pattern = /([\w.:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let match;
      while ((match = pattern.exec(rest)) !== null) {
        attributes[localName(match[1])] = decode(match[3] ?? match[4] ?? "");
      }
    }

    const node = { name, attributes, children: [], text: "" };
    if (stack.length) {
      stack[stack.length - 1].children.push(node);
    } else if (root) {
      fail("deux elements racine");
    } else {
      root = node;
    }
    if (!selfClosing) {
      stack.push(node);
      if (stack.length > MAX_DEPTH) fail("imbrication trop profonde");
    }
    index = close + 1;
  }

  if (stack.length) throw new XmlError(`balise non fermee: ${stack[stack.length - 1].name}`);
  if (!root) throw new XmlError("document vide ou sans element racine");
  return root;
}

// ---------------------------------------------------------------- lecture

/** Enfants directs portant ce nom local. */
export function children(node, name) {
  return node ? node.children.filter((c) => localName(c.name) === name) : [];
}

/** Premier enfant direct portant ce nom local. */
export function child(node, name) {
  return children(node, name)[0] ?? null;
}

/** Descend un chemin de noms locaux: path(root, "A", "B", "C"). */
export function path(node, ...names) {
  let current = node;
  for (const name of names) {
    current = child(current, name);
    if (!current) return null;
  }
  return current;
}

/** Texte d'un chemin, ou null. */
export function text(node, ...names) {
  const found = names.length ? path(node, ...names) : node;
  if (!found) return null;
  const value = found.text.trim();
  return value === "" ? null : value;
}
