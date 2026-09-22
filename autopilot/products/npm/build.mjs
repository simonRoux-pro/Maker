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

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const PACKAGES = [
  { name: "jours-ouvres-france", product: "jours_feries_api" },
  { name: "identifiants-france", product: "identifiants_api" },
];

const HEADER = `/**
 * Fichier genere: copie du moteur utilise par l'API hebergee.
 * Ne pas modifier a la main, voir products/npm/build.mjs.
 */

`;

for (const pkg of PACKAGES) {
  const engine = join(here, "..", pkg.product, "engine.mjs");
  writeFileSync(
    join(here, pkg.name, "index.mjs"),
    HEADER + readFileSync(engine, "utf8"),
    "utf8",
  );

  // les tests du moteur suivent la copie: un paquet publie sans ses tests a
  // jour est un paquet dont personne ne peut verifier qu'il vaut le moteur
  const tests = readFileSync(
    join(here, "..", pkg.product, "test", "engine.test.mjs"),
    "utf8",
  ).replace('from "../engine.mjs"', 'from "../index.mjs"');
  writeFileSync(join(here, pkg.name, "test", "engine.test.mjs"), tests, "utf8");

  const manifest = JSON.parse(readFileSync(join(here, pkg.name, "package.json"), "utf8"));
  const count = (tests.match(/\bit\(/g) || []).length;
  console.log(`${pkg.name}@${manifest.version} assemble, ${count} tests copies`);
}
