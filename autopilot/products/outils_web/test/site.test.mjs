import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSite } from "../build.mjs";
import { PAGES } from "../pages.mjs";
import { handleRequest } from "../worker.mjs";

const files = buildSite();

function get(path, method = "GET") {
  return handleRequest(new Request(`https://outils.test${path}`, { method }));
}

describe("pages", () => {
  it("produit une page par outil, plus robots et sitemap", () => {
    assert.equal(files.size, PAGES.length + 2);
  });

  it("donne a chaque page un titre et une description uniques", () => {
    const titres = new Set();
    const descriptions = new Set();
    for (const def of PAGES) {
      assert.ok(def.title.length > 20, def.path);
      assert.ok(def.description.length > 80, def.path);
      titres.add(def.title);
      descriptions.add(def.description);
    }
    assert.equal(titres.size, PAGES.length);
    assert.equal(descriptions.size, PAGES.length);
  });

  it("porte les balises que les moteurs lisent", () => {
    const html = files.get("/jours-ouvres");
    assert.match(html, /<html lang="fr">/);
    assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+\/jours-ouvres">/);
    assert.match(html, /<meta name="description" content="[^"]{80,}">/);
    assert.match(html, /<meta property="og:title"/);
  });

  it("met du texte avant l'outil, pas seulement un formulaire", () => {
    for (const def of PAGES) {
      const texte = files.get(def.path).replace(/<[^>]+>/g, " ");
      assert.ok(texte.length > 1200, `${def.path} est trop maigre pour etre indexee`);
    }
  });

  it("n'appelle aucune ressource externe", () => {
    for (const [path, content] of files) {
      if (!path.endsWith("/") && path.includes(".")) continue;
      assert.equal(/src="http/.test(content), false, path);
      assert.equal(/<link rel="stylesheet"/.test(content), false, path);
    }
  });

  it("embarque le moteur dans les pages qui calculent", () => {
    assert.match(files.get("/jours-ouvres"), /function easterSunday/);
    assert.match(files.get("/iban"), /function checkIban/);
    // la page d'accueil ne calcule rien, elle reste legere
    assert.equal(/function easterSunday/.test(files.get("/")), false);
  });

  it("relie chaque page aux autres", () => {
    for (const def of PAGES) {
      const html = files.get(def.path);
      for (const autre of PAGES) {
        if (autre.path === "/") continue;
        assert.ok(html.includes(`href="${autre.path}"`), `${def.path} n'a pas de lien vers ${autre.path}`);
      }
    }
  });
});

describe("sitemap et robots", () => {
  it("liste toutes les pages", () => {
    const xml = files.get("/sitemap.xml");
    for (const def of PAGES) assert.ok(xml.includes(`${def.path}</loc>`), def.path);
  });

  it("autorise l'indexation et annonce le sitemap", () => {
    const robots = files.get("/robots.txt");
    assert.match(robots, /Allow: \//);
    assert.match(robots, /Sitemap: https:\/\/[^\s]+\/sitemap\.xml/);
  });
});

describe("service", () => {
  it("sert chaque page avec son type", async () => {
    assert.equal((await get("/")).status, 200);
    assert.match((await get("/sitemap.xml")).headers.get("Content-Type"), /xml/);
    assert.match((await get("/robots.txt")).headers.get("Content-Type"), /plain/);
  });

  it("traite la barre finale comme la meme page", async () => {
    assert.equal((await get("/iban/")).status, 200);
  });

  it("repond 404 sans mise en cache", async () => {
    const res = await get("/inexistant");
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
  });

  it("refuse les methodes d'ecriture", async () => {
    assert.equal((await get("/", "POST")).status, 405);
  });

  it("cache les pages et interdit le reniflage de type", async () => {
    const res = await get("/delai");
    assert.match(res.headers.get("Cache-Control"), /max-age=3600/);
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  });

  it("ne renvoie pas de corps sur une requete HEAD", async () => {
    const res = await get("/", "HEAD");
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "");
  });
});
