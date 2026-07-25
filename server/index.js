const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 8787;

// In-memory only: fine for a personal, local stub. Do not use as-is in production.
const pushTokens = new Set();

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function forwardToExpoPush(title, body) {
  if (pushTokens.size === 0) return;
  const messages = Array.from(pushTokens).map((to) => ({ to, title, body }));
  const payload = JSON.stringify(messages);
  const request = https.request(
    'https://exp.host/--/api/v2/push/send',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    },
    (res) => res.resume()
  );
  request.on('error', (err) => console.error('Expo push forward failed:', err.message));
  request.write(payload);
  request.end();
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/register-token') {
    const raw = await readBody(req);
    try {
      const { token } = JSON.parse(raw);
      if (typeof token !== 'string' || !token) throw new Error('invalid token');
      pushTokens.add(token);
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 400, { ok: false, error: 'invalid payload' });
    }
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    const raw = await readBody(req);
    try {
      const { title, body } = JSON.parse(raw);
      if (typeof title !== 'string' || typeof body !== 'string') {
        throw new Error('invalid payload');
      }
      forwardToExpoPush(title, body);
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 400, { ok: false, error: 'invalid payload' });
    }
  }

  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, registeredTokens: pushTokens.size });
  }

  sendJson(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`Webhook stub listening on http://localhost:${PORT}`);
});
