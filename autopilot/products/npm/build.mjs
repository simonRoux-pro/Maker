/**
 * Assemble les paquets npm a partir des moteurs des APIs.
 *
 * Une seule implementation des regles, plusieurs produits qui s'en servent:
 * les deux APIs vendues, le pack telechargeable, le site public, et ces deux
 * bibliotheques. Le fichier index.mjs de chaque paquet est une copie, jamais
 * une reecriture.
 *
 *   node build.mjs
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const PACKAGES = [
  { name: "jours-ouvres-france", product: "jours_feries_api" },
  { name: "identifiants-france", product: "identifiants_api" },
  // ce moteur tient en deux fichiers, l'analyseur XML et les regles
  { name: "facturx-validator", product: "facturx_api", parts: ["xml.mjs", "engine.mjs"] },
];

const HEADER = `/**
 * Fichier genere: copie du moteur utilise par l'API hebergee.
 * Ne pas modifier a la main, voir products/npm/build.mjs.
 */

`;

/**
 * Concatene plusieurs fichiers d'un moteur en un module unique, en retirant
 * les imports internes et les re-exports devenus doubles.
 */
function assemble(product, parts) {
  const sources = parts.map((part) =>
    readFileSync(join(here, "..", product, part), "utf8"),
  );
  const merged = sources
    .map((source) =>
      source
        .replace(/^import\s*\{[\s\S]*?\}\s*from\s*"\.\/[\w.]+";\n/gm, "")
        .replace(/^export \{ XmlError \};\n/m, ""),
    )
    .join("\n");

  const exported = [...merged.matchAll(/^export (?:class|function|const) (\w+)/gm)]
    .map((m) => m[1]);
  const duplicates = exported.filter((n, i) => exported.indexOf(n) !== i);
  if (duplicates.length) {
    throw new Error(`exports en double dans ${product}: ${duplicates.join(", ")}`);
  }
  return merged;
}

for (const pkg of PACKAGES) {
  const contenu = pkg.parts
    ? assemble(pkg.product, pkg.parts)
    : readFileSync(join(here, "..", pkg.product, "engine.mjs"), "utf8");
  writeFileSync(join(here, pkg.name, "index.mjs"), HEADER + contenu, "utf8");

  // les tests du moteur suivent la copie: un paquet publie sans ses tests a
  // jour est un paquet dont personne ne peut verifier qu'il vaut le moteur
  const tests = readFileSync(
    join(here, "..", pkg.product, "test", "engine.test.mjs"),
    "utf8",
  ).replace('from "../engine.mjs"', 'from "../index.mjs"');
  writeFileSync(join(here, pkg.name, "test", "engine.test.mjs"), tests, "utf8");

  // certains moteurs ont des jeux d'essai a cote de leurs tests
  const fixtures = join(here, "..", pkg.product, "test", "fixtures.mjs");
  if (existsSync(fixtures)) {
    writeFileSync(
      join(here, pkg.name, "test", "fixtures.mjs"),
      readFileSync(fixtures, "utf8"),
      "utf8",
    );
  }

  const manifest = JSON.parse(readFileSync(join(here, pkg.name, "package.json"), "utf8"));
  const count = (tests.match(/\bit\(/g) || []).length;
  console.log(`${pkg.name}@${manifest.version} assemble, ${count} tests copies`);
}
