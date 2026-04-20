const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, buffer) => {
    if (error) {
      sendJson(res, 500, { error: 'Failed to read file' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
      'Content-Length': buffer.length
    });
    res.end(buffer);
  });
}

function resolveRequestedFile(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const requestedPath = cleanPath === '/' ? '/index.html' : cleanPath;
  const resolvedPath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return resolvedPath;
}

const server = http.createServer((req, res) => {
  const pathname = req.url || '/';

  if (pathname === '/healthz') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const resolvedPath = resolveRequestedFile(pathname);
  if (!resolvedPath) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.stat(resolvedPath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(res, resolvedPath);
      return;
    }

    const fallback = path.join(PUBLIC_DIR, 'index.html');
    fs.stat(fallback, (fallbackError, fallbackStats) => {
      if (fallbackError || !fallbackStats.isFile()) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }

      sendFile(res, fallback);
    });
  });
});

server.listen(PORT, () => {
  console.log(`BERGSTIEG running on http://127.0.0.1:${PORT}`);
});
