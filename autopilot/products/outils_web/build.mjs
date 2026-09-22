/**
 * Fabrique le site public: une page HTML autonome par outil.
 *
 * Chaque page embarque le moteur dont elle a besoin, celui des jours feries
 * ou celui des identifiants, exactement le meme code que les APIs vendues.
 * Une seule implementation des regles, trois produits qui s'en servent.
 *
 *   node build.mjs   ->   dist/*.html, dist/robots.txt, dist/sitemap.xml
 *                         pages.generated.mjs, consomme par le worker
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PAGES, SITE } from "./pages.mjs";
import { TOOLS } from "./tools.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, "dist");
const BASE = process.env.BASE_URL ?? "https://outils.pro-simon-roux.workers.dev";

/** Les moteurs sont des modules ES: dans une page, ils s'inlinent tels quels. */
const ENGINES = {
  holidays: readFileSync(join(here, "..", "jours_feries_api", "engine.mjs"), "utf8"),
  identifiers: readFileSync(join(here, "..", "identifiants_api", "engine.mjs"), "utf8"),
};

const CSS = `
:root{--bg:#fbfbfc;--panel:#fff;--ink:#16181d;--muted:#5f6672;--line:#e4e7eb;
--accent:#1b4fd8;--ok:#136c43;--ko:#a3242b}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0f1114;
--panel:#171a1f;--ink:#e9ebee;--muted:#98a0ab;--line:#262b32;--accent:#7fa5ff;
--ok:#4ec98a;--ko:#f0726f}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);line-height:1.65;
font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:0 16px 64px}
header{border-bottom:1px solid var(--line);margin-bottom:28px}
header .wrap{padding-top:16px;padding-bottom:16px;display:flex;gap:16px;
align-items:baseline;flex-wrap:wrap}
header a.brand{font-weight:600;color:var(--ink);text-decoration:none}
header nav{display:flex;gap:14px;flex-wrap:wrap;font-size:14px}
header nav a{color:var(--muted);text-decoration:none}
header nav a:hover{color:var(--accent)}
h1{font-size:30px;line-height:1.25;margin:0 0 12px}
h2{font-size:20px;margin:36px 0 10px}
p{margin:0 0 14px}
.lead{font-size:18px;color:var(--muted)}
a{color:var(--accent)}
.tool{background:var(--panel);border:1px solid var(--line);border-radius:12px;
padding:18px;margin:24px 0 8px}
form{display:grid;gap:14px}
label{display:grid;gap:6px;font-size:14px;color:var(--muted)}
input,select{font:inherit;padding:10px;border-radius:8px;border:1px solid var(--line);
background:var(--bg);color:var(--ink);width:100%}
button{font:inherit;font-weight:600;padding:11px 18px;border-radius:8px;border:0;
background:var(--accent);color:#fff;cursor:pointer}
.hint{font-size:13px;color:var(--muted);margin:0}
output{display:block;margin-top:16px}
.result{padding:14px;border-radius:10px;border:1px solid var(--line)}
.result strong{font-size:19px;display:block;margin-bottom:4px}
.result.ok strong{color:var(--ok)}
.result.ko strong{color:var(--ko)}
.result p{margin:4px 0 0;font-size:15px;color:var(--muted)}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:15px}
td{padding:6px 0;border-bottom:1px solid var(--line)}
td:last-child{text-align:right;color:var(--muted)}
.cards{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
margin:24px 0}
.card{display:grid;gap:4px;padding:16px;background:var(--panel);border:1px solid var(--line);
border-radius:12px;text-decoration:none;color:var(--ink)}
.card span{font-size:14px;color:var(--muted)}
.card:hover{border-color:var(--accent)}
footer{border-top:1px solid var(--line);margin-top:48px;padding-top:20px;
font-size:14px;color:var(--muted)}
@media(max-width:560px){h1{font-size:25px}.wrap{padding:0 14px 48px}}
`;

/** Favicon en ligne: evite une requete 404 sur chaque page. */
const FAVICON = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<rect width="32" height="32" rx="6" fill="#1b4fd8"/>' +
    '<rect x="6" y="9" width="20" height="17" rx="2" fill="#fff"/>' +
    '<rect x="6" y="9" width="20" height="5" fill="#0f2f8a"/>' +
    '<rect x="10" y="17" width="5" height="5" rx="1" fill="#1b4fd8"/></svg>',
);

const NAV = PAGES.filter((p) => p.path !== "/")
  .map((p) => `<a href="${p.path}">${p.slug.replace(/-/g, " ")}</a>`)
  .join("");

const FOOTER = `
<h2>Les mêmes calculs, ailleurs</h2>
<p>Ces outils appellent exactement le même moteur que notre API, utilisable
depuis votre code : <a href="${SITE.api_holidays}">API jours fériés et délais</a>.</p>
<p>Un pack de calendriers prêts à importer dans Outlook ou Google Agenda,
couvrant 2026 à 2035 pour les neuf zones, est également disponible.</p>`;

function page(def) {
  const tool = TOOLS[def.slug];
  const script = tool
    ? `<script type="module">\n${ENGINES[def.engine]}\n${tool.script}\n</script>`
    : "";
  const body = tool ? def.body.replace('<div class="tool" id="tool"></div>',
    `<div class="tool">${tool.html}</div>`) : def.body;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${def.title}</title>
<meta name="description" content="${def.description}">
<link rel="canonical" href="${BASE}${def.path}">
<link rel="icon" href="data:image/svg+xml,${FAVICON}">
<meta property="og:title" content="${def.title}">
<meta property="og:description" content="${def.description}">
<meta property="og:type" content="website">
<style>${CSS}</style>
</head>
<body>
<header><div class="wrap">
  <a class="brand" href="/">${SITE.name}</a>
  <nav>${NAV}</nav>
</div></header>
<main class="wrap">
${body}
<footer>${FOOTER}</footer>
</main>
${script}
</body>
</html>
`;
}

export function buildSite() {
  const files = new Map();
  for (const def of PAGES) files.set(def.path, page(def));

  files.set(
    "/robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`,
  );
  files.set(
    "/sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      PAGES.map((p) => `  <url><loc>${BASE}${p.path}</loc></url>`).join("\n") +
      `\n</urlset>\n`,
  );
  return files;
}

function main() {
  const files = buildSite();
  mkdirSync(DIST, { recursive: true });

  const entries = [];
  for (const [path, content] of files) {
    const name = path === "/" ? "index.html"
      : path.includes(".") ? path.slice(1)
      : `${path.slice(1)}.html`;
    writeFileSync(join(DIST, name), content, "utf8");
    entries.push([path, content]);
  }

  writeFileSync(
    join(here, "pages.generated.mjs"),
    "// Fichier genere par build.mjs, ne pas modifier a la main.\n" +
      "export const FILES = new Map(" +
      JSON.stringify(entries) +
      ");\n",
    "utf8",
  );

  const bytes = [...files.values()].reduce((t, c) => t + Buffer.byteLength(c, "utf8"), 0);
  console.log(`${files.size} fichiers, ${(bytes / 1024).toFixed(0)} ko, base ${BASE}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
