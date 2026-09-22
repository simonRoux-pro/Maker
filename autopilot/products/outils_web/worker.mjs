/**
 * Sert le site public des outils gratuits.
 *
 * Aucune protection par secret, contrairement aux deux APIs: ce site a
 * vocation a etre lu par les moteurs de recherche et par n'importe qui.
 * Aucun appel serveur non plus, les outils calculent dans le navigateur.
 */

import { FILES } from "./pages.generated.mjs";

const TYPES = {
  html: "text/html; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

// le contenu ne change qu'a chaque deploiement, il se cache franchement
const CACHE = "public, max-age=3600";

function typeOf(path) {
  if (path.endsWith(".xml")) return TYPES.xml;
  if (path.endsWith(".txt")) return TYPES.txt;
  return TYPES.html;
}

const NOT_FOUND = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page introuvable</title></head>
<body style="font-family:system-ui;max-width:640px;margin:80px auto;padding:0 16px">
<h1>Page introuvable</h1>
<p><a href="/">Revenir aux outils</a></p>
</body></html>
`;

export function handleRequest(request) {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Méthode non autorisée", { status: 405 });
  }

  // une barre finale ne doit pas faire deux adresses pour une meme page
  let path = url.pathname.replace(/\/+$/, "") || "/";
  if (!FILES.has(path) && FILES.has(`${path}/`)) path = `${path}/`;

  const body = FILES.get(path);
  if (body === undefined) {
    return new Response(NOT_FOUND, {
      status: 404,
      headers: { "Content-Type": TYPES.html, "Cache-Control": "no-store" },
    });
  }

  return new Response(request.method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      "Content-Type": typeOf(path),
      "Cache-Control": CACHE,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

export default { fetch: handleRequest };
