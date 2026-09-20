/**
 * Fabrique un worker en un seul fichier, a coller directement dans l'editeur
 * du tableau de bord Cloudflare. Aucun outil a installer cote operateur: pas
 * de node, pas de npx, pas de wrangler.
 *
 *   node build.mjs   ->   dist/worker.bundle.mjs
 *
 * La concatenation est volontairement betement simple: engine.mjs puis
 * worker.mjs sans sa ligne d'import. Les deux restent un seul module ES, donc
 * les exports croises continuent de fonctionner.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "dist", "worker.bundle.mjs");

const engine = readFileSync(join(here, "engine.mjs"), "utf8");
const worker = readFileSync(join(here, "worker.mjs"), "utf8");

// retire le bloc d'import de engine.mjs, devenu inutile une fois concatene
const stripped = worker.replace(/^import\s*\{[\s\S]*?\}\s*from\s*"\.\/engine\.mjs";\n/m, "");
if (stripped === worker) {
  throw new Error("le bloc d'import de engine.mjs n'a pas ete trouve, verifie worker.mjs");
}
const remaining = stripped.match(/^\s*import\s/m);
if (remaining) {
  throw new Error("il reste un import dans le bundle, il ne tiendra pas dans un seul fichier");
}

const header = `/**
 * Fichier genere par build.mjs, ne pas modifier a la main.
 * Source: engine.mjs + worker.mjs du meme dossier.
 *
 * A coller dans l'editeur Cloudflare Workers. Aucune dependance.
 */

`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, header + engine + "\n" + stripped, "utf8");

const size = Buffer.byteLength(header + engine + stripped, "utf8");
console.log(`dist/worker.bundle.mjs ecrit, ${(size / 1024).toFixed(1)} ko`);

// La specification, avec l'URL de production comme serveur. Elle sert aux
// imports qui veulent un fichier plutot qu'une URL.
const { openapiFor } = await import("./worker.mjs");
const baseUrl = process.env.BASE_URL ?? "https://maker.pro-simon-roux.workers.dev";
const specPath = join(here, "dist", "openapi.json");
writeFileSync(specPath, JSON.stringify(openapiFor(baseUrl), null, 2) + "\n", "utf8");
console.log(`dist/openapi.json ecrit, serveur ${baseUrl}`);
