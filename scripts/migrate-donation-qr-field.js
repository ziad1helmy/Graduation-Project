/**
 * Migration script: Rename Donation.qrExpires → Donation.qrExpiresAt
 *
 * The Donation model previously stored the donation-level QR expiration in a
 * field called `qrExpires`. The Appointment and Request models use the
 * `qrExpiresAt` convention. To keep response payloads consistent and stop
 * forcing every reader to remember the legacy name, this script renames the
 * field in-place.
 *
 * This script is IDEMPOTENT — safe to run multiple times:
 * - Skips documents that already have `qrExpiresAt` set
 * - Only writes `qrExpiresAt` if the document has a non-null `qrExpires`
 *
 * Usage: node scripts/migrate-donation-qr-field.js
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import Donation from '../src/models/Donation.model.js';

const log = {
  info: (msg) => console.log(`ℹ ${msg}`),
  success: (msg) => console.log(`✓ ${msg}`),
  warning: (msg) => console.log(`⚠ ${msg}`),
  error: (msg) => console.log(`✗ ${msg}`),
};

const run = async () => {
  const candidates = await Donation.find({
    qrExpiresAt: { $in: [null, undefined] },
    qrExpires: { $exists: true, $ne: null },
  }).select('_id qrExpires qrExpiresAt');

  log.info(`Found ${candidates.length} donation(s) to migrate.`);

  let migrated = 0;
  for (const donation of candidates) {
    await Donation.updateOne(
      { _id: donation._id },
      { $set: { qrExpiresAt: donation.qrExpires }, $unset: { qrExpires: 1 } },
    );
    migrated += 1;
  }

  log.success(`Migrated ${migrated} donation(s).`);

  const stale = await Donation.countDocuments({ qrExpires: { $exists: true } });
  if (stale > 0) {
    log.warning(`${stale} donation(s) still have a legacy \`qrExpires\` field. Inspect manually.`);
  } else {
    log.success('No legacy `qrExpires` field remaining on Donation documents.');
  }
};

(async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    log.info('Connected to MongoDB.');
    await run();
    await mongoose.disconnect();
    log.info('Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    process.exit(1);
  }
})();
