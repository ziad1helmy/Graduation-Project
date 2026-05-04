const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const root = process.cwd();
const appPath = path.join(root, 'src/app.js');
const yamlPath = path.join(root, 'openapi.yaml');

const app = fs.readFileSync(appPath, 'utf8');
const doc = yaml.load(fs.readFileSync(yamlPath, 'utf8'));

const importRe = /import\s+([a-zA-Z]+Routes)\s+from\s+'\.\/routes\/([^']+)'/g;
const useRe = /app\.use\('([^']+)'\s*,[^\n]*?([a-zA-Z]+Routes)\)/g;
const routeRe = /router\.(get|post|put|patch|delete)\('([^']+)'/g;

const imports = {};
for (const m of app.matchAll(importRe)) imports[m[1]] = m[2];

const mounts = [];
for (const m of app.matchAll(useRe)) mounts.push({ base: m[1], file: imports[m[2]] });

const live = new Set();
for (const mount of mounts) {
  if (!mount.file) continue;
  const txt = fs.readFileSync(path.join(root, 'src/routes', mount.file), 'utf8');
  for (const m of txt.matchAll(routeRe)) {
    const method = m[1].toUpperCase();
    const sub = m[2];
    const p = sub === '/' ? mount.base : `${mount.base}${sub}`;
    live.add(`${method} ${p.replace(/\\/g, '/')}`);
  }
}

const normalizePath = (p) => p.replace(/\{([^}]+)\}/g, ':$1');
const docSet = new Set();
for (const [p, methods] of Object.entries(doc.paths || {})) {
  for (const method of Object.keys(methods)) {
    if (/^(get|post|put|patch|delete)$/i.test(method)) {
      docSet.add(`${method.toUpperCase()} ${normalizePath(p)}`);
    }
  }
}

const missing = [...live].filter((e) => !docSet.has(e)).sort();
const dead = [...docSet].filter((e) => !live.has(e)).sort();
console.log(`LIVE=${live.size} DOC=${docSet.size} MISSING=${missing.length} DEAD=${dead.length}`);
console.log('---MISSING---');
console.log(missing.join('\n'));
console.log('---DEAD---');
console.log(dead.join('\n'));
