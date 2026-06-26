import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Strip single-line comments (//) before parsing JSON
const loadJSON = (file) => {
  const raw = readFileSync(join(__dirname, '../locales', file), 'utf8');
  const stripped = raw.replace(/\/\/.*$/gm, '');
  return JSON.parse(stripped);
};

const en = loadJSON('en.json');
const ar = loadJSON('ar.json');

const LOCALES = { en, ar };

function pickLang(req) {
  // 1. authenticated user's preference
  const userLang = req.user?.settings?.language;
  if (userLang && (userLang === 'ar' || userLang === 'en')) return userLang;

  // 2. explicit query param ?lang=ar
  const q = (req.query?.lang || '').toLowerCase();
  if (q === 'ar' || q === 'en') return q;

  // 3. Accept-Language header
  const al = req.headers['accept-language'];
  if (al && typeof al === 'string') {
    if (al.split(',').some((s) => s.trim().startsWith('ar'))) return 'ar';
  }

  // default
  return 'en';
}

function getNested(obj, keyPath) {
  return keyPath.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), obj);
}

function render(template, vars = {}) {
  return String(template).replace(/{{\s*([\w\.]+)\s*}}/g, (_, name) => {
    const val = getNested(vars, name) || vars[name];
    return val === undefined ? '' : String(val);
  });
}

export default function i18nMiddleware(req, res, next) {
  const lang = pickLang(req);
  const locale = LOCALES[lang] || LOCALES.en;

  req.locale = locale;
  req.lang = lang;
  req.t = (key, vars = {}) => {
    const val = getNested(locale, key) ?? getNested(LOCALES.en, key) ?? key;
    return render(val, vars);
  };

  res.locals.lang = lang;
  res.locals.t = req.t;

  next();
}
