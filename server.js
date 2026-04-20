const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
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
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

// Cache policy: short cache for HTML so updates ship fast, long cache for
// hashed-ish assets. We don't ship hashed URLs yet, so assets get a
// one-hour cache with revalidation.
const CACHE_CONTROL = {
  '.html': 'no-cache',
  '.js': 'public, max-age=3600, must-revalidate',
  '.css': 'public, max-age=3600, must-revalidate'
};

function log(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

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
      log(`readFile error for ${filePath}: ${error.message}`);
      sendJson(res, 500, { error: 'Failed to read file' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
      'Content-Length': buffer.length,
      'X-Content-Type-Options': 'nosniff'
    };
    if (CACHE_CONTROL[ext]) {
      headers['Cache-Control'] = CACHE_CONTROL[ext];
    }
    res.writeHead(200, headers);
    res.end(buffer);
  });
}

function resolveRequestedFile(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const requestedPath = cleanPath === '/' ? '/index.html' : cleanPath;
  const resolvedPath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!resolvedPath.startsWith(PUBLIC_DIR + path.sep) && resolvedPath !== PUBLIC_DIR) {
    return null;
  }

  return resolvedPath;
}

// Static asset paths that must 404 cleanly instead of falling back to
// index.html. Otherwise a missing JS/CSS/image silently returns HTML and
// clients fail in confusing ways.
const STRICT_EXTENSIONS = new Set(['.js', '.css', '.json', '.map', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp', '.woff', '.woff2']);

const server = http.createServer((req, res) => {
  const pathname = req.url || '/';

  if (pathname === '/healthz') {
    sendJson(res, 200, { ok: true, service: 'bergstieg' });
    return;
  }

  // Browsers always ask for /favicon.ico. Return an empty 204 until an icon
  // is shipped so it doesn't spam logs or fall through to the SPA handler.
  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
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

    const ext = path.extname(resolvedPath).toLowerCase();
    if (STRICT_EXTENSIONS.has(ext)) {
      sendJson(res, 404, { error: 'Not found', path: pathname });
      return;
    }

    // SPA fallback for any other path.
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

server.on('error', (error) => {
  log(`server error: ${error.message}`);
});

server.listen(PORT, () => {
  log(`BERGSTIEG listening on http://127.0.0.1:${PORT}`);
});

function shutdown(signal) {
  log(`received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  // Safety net: force exit if close hangs on open sockets.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
