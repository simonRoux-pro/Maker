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

import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const PACKAGES = [
  { name: "jours-ouvres-france", source: ["jours_feries_api", "engine.mjs"] },
  { name: "identifiants-france", source: ["identifiants_api", "engine.mjs"] },
];

const HEADER = `/**
 * Fichier genere: copie du moteur utilise par l'API hebergee.
 * Ne pas modifier a la main, voir products/npm/build.mjs.
 */

`;

for (const pkg of PACKAGES) {
  const from = join(here, "..", ...pkg.source);
  const to = join(here, pkg.name, "index.mjs");
  writeFileSync(to, HEADER + readFileSync(from, "utf8"), "utf8");

  const manifest = JSON.parse(readFileSync(join(here, pkg.name, "package.json"), "utf8"));
  console.log(`${pkg.name}@${manifest.version} assemble`);
}
