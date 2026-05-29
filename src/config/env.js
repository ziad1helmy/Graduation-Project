import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const normalizeMultilinePrivateKey = (value) => {
  if (!value || typeof value !== 'string') return undefined;

  const trimmed = value.trim();

  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;

  return unquoted.replace(/\\n/g, '\n');
};

// ✅ Dynamic getter (no freezing bug)
const getEnv = () => ({
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  // Database
  MONGO_URI:
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/lifelink',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production' ? undefined : process.env.JWT_SECRET),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // App
  API_PREFIX: process.env.API_PREFIX || '/api',
  CORS_ORIGIN:
    process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? undefined : '*'),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  API_BASE_URL:
    process.env.API_BASE_URL ||
    `http://localhost:${parseInt(process.env.PORT, 10) || 5000}`,

  // Mail
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
  MAIL_FROM: process.env.MAIL_FROM || 'LifeLink <onboarding@resend.dev>',
  DEV_MAIL_TO: process.env.DEV_MAIL_TO, // ← redirects all dev emails to this address
  EMAIL_LOGO_URL: process.env.EMAIL_LOGO_URL,

  // Bcrypt
  BCRYPT_SALT_ROUNDS:
    parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) ||
    (process.env.NODE_ENV === 'production' ? 12 : 10),

  // Firebase
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: normalizeMultilinePrivateKey(
    process.env.FIREBASE_PRIVATE_KEY
  ),
  FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,

  // Matching
  MATCHING_DISTANCE_KM: process.env.MATCHING_DISTANCE_KM || '30',
});

const required = ['MONGO_URI', 'JWT_SECRET'];

function validateEnv() {
  const env = getEnv();

  const missing = required.filter((key) => !env[key]);

  if (env.IS_PRODUCTION) {
    if (!env.JWT_REFRESH_SECRET) {
      missing.push('JWT_REFRESH_SECRET');
    }
    if (!env.CORS_ORIGIN) {
      missing.push('CORS_ORIGIN');
    }
  }

  if (missing.length) {
    throw new Error(
      `[ENV ERROR] Missing required environment variables: ${missing.join(
        ', '
      )}. Check your environment configuration.`
    );
  }

  return env;
}

// ✅ IMPORTANT: keep backward compatibility
const env = getEnv();

export { env, getEnv, validateEnv };
