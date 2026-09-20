/**
 * Lancement local, sans dependance:
 *   node server.mjs           puis http://127.0.0.1:8787/v1/holidays?year=2026
 *
 * Sert au test manuel et au dry-run. La production tourne sur Cloudflare
 * Workers avec le meme handler.
 */

import { createServer } from "node:http";
import { handleRequest } from "./worker.mjs";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

createServer(async (req, res) => {
  const url = `http://${req.headers.host ?? `${host}:${port}`}${req.url}`;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(url, { method: req.method, headers: req.headers, body });
  const response = await handleRequest(request, process.env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, host, () => {
  console.log(`api locale sur http://${host}:${port}`);
});
