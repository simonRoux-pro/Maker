/** Lancement local: node server.mjs puis http://127.0.0.1:8788 */

import { createServer } from "node:http";
import { handleRequest } from "./worker.mjs";

const port = Number(process.env.PORT ?? 8788);
const host = process.env.HOST ?? "127.0.0.1";

createServer(async (req, res) => {
  const request = new Request(`http://${host}:${port}${req.url}`, { method: req.method });
  const response = handleRequest(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, host, () => console.log(`site local sur http://${host}:${port}`));
