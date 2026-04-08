import dotenv from 'dotenv';

dotenv.config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/lifelink',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // App
  API_PREFIX: process.env.API_PREFIX || '/api',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // Bcrypt
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,
};

const required = ['MONGODB_URI', 'JWT_SECRET'];

function validateEnv() {
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Check your .env file or set them in the environment.'
    );
  }
}

export { env, validateEnv };
