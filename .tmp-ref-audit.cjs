const fs = require('fs');
const path = require('path');

const root = process.cwd();
const routesDir = path.join(root, 'src', 'routes');
const controllersDir = path.join(root, 'src', 'controllers');
const servicesDir = path.join(root, 'src', 'services');

const read = (p) => fs.readFileSync(p, 'utf8');
const listJs = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

function exportedNamesFromFile(filePath) {
  const txt = read(filePath);
  const names = new Set();
  for (const m of txt.matchAll(/export\s+const\s+(\w+)\s*=/g)) names.add(m[1]);
  for (const m of txt.matchAll(/export\s+function\s+(\w+)\s*\(/g)) names.add(m[1]);
  for (const m of txt.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g)) names.add(m[1]);

  const def = txt.match(/export\s+default\s*\{([\s\S]*?)\};?/);
  if (def) {
    const body = def[1];
    for (const m of body.matchAll(/\b(\w+)\b\s*(?=,|$)/g)) names.add(m[1]);
  }

  return names;
}

const controllerExports = {};
for (const f of listJs(controllersDir)) {
  controllerExports[f] = exportedNamesFromFile(path.join(controllersDir, f));
}

const serviceExports = {};
for (const f of listJs(servicesDir)) {
  serviceExports[f] = exportedNamesFromFile(path.join(servicesDir, f));
}

const routeControllerIssues = [];
for (const f of listJs(routesDir)) {
  const txt = read(path.join(routesDir, f));
  const importMap = new Map();

  for (const m of txt.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+'\.\.\/controllers\/([^']+)'/g)) {
    importMap.set(m[1], m[2]);
  }
  for (const m of txt.matchAll(/import\s+(\w+)\s+from\s+'\.\.\/controllers\/([^']+)'/g)) {
    importMap.set(m[1], m[2]);
  }

  for (const [alias, ctrlFile] of importMap.entries()) {
    const exported = controllerExports[ctrlFile] || new Set();
    const callRe = new RegExp(alias + '\\.(\\w+)', 'g');
    for (const cm of txt.matchAll(callRe)) {
      const method = cm[1];
      if (!exported.has(method)) {
        routeControllerIssues.push({ routeFile: f, controller: ctrlFile, method });
      }
    }
  }
}

const controllerServiceIssues = [];
for (const f of listJs(controllersDir)) {
  const txt = read(path.join(controllersDir, f));
  const importMap = new Map();

  for (const m of txt.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+'\.\.\/services\/([^']+)'/g)) {
    importMap.set(m[1], m[2]);
  }

  for (const [alias, serviceFile] of importMap.entries()) {
    const exported = serviceExports[serviceFile] || new Set();
    const callRe = new RegExp(alias + '\\.(\\w+)', 'g');
    for (const cm of txt.matchAll(callRe)) {
      const method = cm[1];
      if (!exported.has(method)) {
        controllerServiceIssues.push({ controllerFile: f, service: serviceFile, method });
      }
    }
  }
}

console.log('ROUTE_CONTROLLER_ISSUES', routeControllerIssues.length);
for (const i of routeControllerIssues) {
  console.log(`${i.routeFile} -> ${i.controller}.${i.method}`);
}

console.log('CONTROLLER_SERVICE_ISSUES', controllerServiceIssues.length);
for (const i of controllerServiceIssues) {
  console.log(`${i.controllerFile} -> ${i.service}.${i.method}`);
}
