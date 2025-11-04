// Minimal static file server for ./frontend without extra deps
// Usage: node scripts/serve-frontend.cjs [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.argv[2]) || 5173;
const root = path.join(process.cwd(), 'frontend');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function send(res, status, body, headers = {}){
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-cache' }, headers));
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = path.join(root, urlPath);
    if (urlPath.endsWith('/')) filePath = path.join(root, urlPath, 'index.html');
    if (!path.resolve(filePath).startsWith(root)) return send(res, 403, 'Forbidden');

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        // fallback to index.html for unknown paths
        const indexPath = path.join(root, 'index.html');
        return fs.readFile(indexPath, (e, data) => {
          if (e) return send(res, 404, 'Not found');
          send(res, 200, data, { 'Content-Type': types['.html'] });
        });
      }
      const ext = path.extname(filePath).toLowerCase();
      fs.readFile(filePath, (e, data) => {
        if (e) return send(res, 500, 'Server error');
        send(res, 200, data, { 'Content-Type': types[ext] || 'application/octet-stream' });
      });
    });
  } catch (e) {
    send(res, 500, 'Server error');
  }
});

server.listen(port, () => {
  console.log(`Serving frontend at http://localhost:${port}`);
});

