/**
 * Migration script: Hash plaintext adminKey values for existing admin/superadmin accounts.
 *
 * This script is IDEMPOTENT — safe to run multiple times:
 * - Skips accounts whose adminKey is already a bcrypt hash
 * - Skips accounts without an adminKey
 * - Replaces plaintext keys with their bcrypt hash
 *
 * IMPORTANT: This script MUST be run before deploying code that switches the
 * login path to bcrypt.compare(adminKey, hash). After this migration, plaintext
 * admin keys are unrecoverable from the database.
 *
 * Usage: node scripts/migrate-admin-keys.js
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import User from '../src/models/User.model.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
};

const BCRYPT_PREFIXES = ['$2a$', '$2b$', '$2y$'];

const isAlreadyHashed = (value) => {
  if (!value) return false;
  return BCRYPT_PREFIXES.some((prefix) => value.startsWith(prefix));
};

const run = async () => {
  const stats = {
    adminsScanned: 0,
    adminsMigrated: 0,
    adminsSkippedNoKey: 0,
    adminsSkippedAlreadyHashed: 0,
    errors: 0,
  };

  try {
    log.info('Connecting to MongoDB...');
    await mongoose.connect(env.MONGODB_URI);
    log.success('Connected');

    const cursor = User.find({
      role: { $in: ['admin', 'superadmin'] },
    })
      .select('_id email role adminKey')
      .cursor();

    for await (const user of cursor) {
      stats.adminsScanned++;

      if (!user.adminKey) {
        stats.adminsSkippedNoKey++;
        continue;
      }

      if (isAlreadyHashed(user.adminKey)) {
        stats.adminsSkippedAlreadyHashed++;
        continue;
      }

      try {
        const hash = await bcrypt.hash(user.adminKey, env.BCRYPT_SALT_ROUNDS || 10);
        await User.updateOne({ _id: user._id }, { $set: { adminKey: hash } });
        stats.adminsMigrated++;
        log.success(`Hashed adminKey for ${user.email} (${user.role})`);
      } catch (error) {
        stats.errors++;
        log.error(`Failed to hash adminKey for ${user.email}: ${error.message}`);
      }
    }

    console.log('\n' + colors.blue + '━'.repeat(60) + colors.reset);
    log.info('Migration Summary');
    console.log(colors.blue + '━'.repeat(60) + colors.reset);
    log.success(`Admins scanned: ${stats.adminsScanned}`);
    log.success(`Migrated to bcrypt hash: ${stats.adminsMigrated}`);
    log.info(`Skipped (no adminKey): ${stats.adminsSkippedNoKey}`);
    log.info(`Skipped (already hashed): ${stats.adminsSkippedAlreadyHashed}`);
    if (stats.errors > 0) {
      log.error(`Errors encountered: ${stats.errors}`);
    }
    console.log(colors.blue + '━'.repeat(60) + colors.reset + '\n');

    log.warning('After this migration, plaintext admin keys are unrecoverable from the database.');
    log.warning('Make sure all admins have securely stored their current adminKey values.');
  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
      log.info('Database connection closed');
    }
  }
};

run();
