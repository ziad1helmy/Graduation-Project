import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

const deriveKey = (userId) => {
  const secret = env.ADMIN_KEY_ENCRYPTION_KEY || env.JWT_SECRET;
  return crypto.scryptSync(secret, 'lifelink-admin-key-' + userId, KEY_LENGTH);
};

export const encryptAdminKey = (plaintext, userId) => {
  const key = deriveKey(userId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decryptAdminKey = (stored, userId) => {
  const parts = stored.split(':');
  if (parts.length !== 3) return null;

  const [ivHex, authTagHex, encrypted] = parts;
  try {
    const key = deriveKey(userId);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
};

export const isEncryptedKey = (stored) => {
  return typeof stored === 'string' && stored.split(':').length === 3;
};
