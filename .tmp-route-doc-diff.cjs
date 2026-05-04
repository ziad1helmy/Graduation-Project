const fs = require('fs');
const path = require('path');

const root = process.cwd();
const appPath = path.join(root, 'src/app.js');
const openapiPath = path.join(root, 'openapi.json');

const app = fs.readFileSync(appPath, 'utf8');

const importRe = /import\s+([a-zA-Z]+Routes)\s+from\s+'\.\/routes\/([^']+)'/g;
const useRe = /app\.use\('([^']+)'\s*,[^\n]*?([a-zA-Z]+Routes)\)/g;
const routeRe = /router\.(get|post|put|patch|delete)\('([^']+)'/g;

const imports = {};
for (const m of app.matchAll(importRe)) {
  imports[m[1]] = m[2];
}

const mounts = [];
for (const m of app.matchAll(useRe)) {
  mounts.push({ base: m[1], varName: m[2], file: imports[m[2]] });
}

const live = new Set();
for (const mount of mounts) {
  if (!mount.file) continue;
  const routeFilePath = path.join(root, 'src/routes', mount.file);
  const txt = fs.readFileSync(routeFilePath, 'utf8');

  for (const m of txt.matchAll(routeRe)) {
    const method = m[1].toUpperCase();
    const sub = m[2];
    const p = sub === '/' ? mount.base : `${mount.base}${sub}`;
    live.add(`${method} ${p.replace(/\\/g, '/')}`);
  }
}

const openapi = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
const doc = new Set();
for (const [p, obj] of Object.entries(openapi.paths || {})) {
  for (const method of Object.keys(obj)) {
    if (/^(get|post|put|patch|delete)$/i.test(method)) {
      doc.add(`${method.toUpperCase()} ${p}`);
    }
  }
}

const missingInDocs = [...live].filter((e) => !doc.has(e)).sort();
const deadInDocs = [...doc].filter((e) => !live.has(e)).sort();

console.log(`LIVE=${live.size} DOC=${doc.size} MISSING_IN_DOCS=${missingInDocs.length} DEAD_IN_DOCS=${deadInDocs.length}`);
console.log('---MISSING_IN_DOCS---');
for (const e of missingInDocs) console.log(e);
console.log('---DEAD_IN_DOCS---');
for (const e of deadInDocs) console.log(e);
