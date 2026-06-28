/**
 * Migration script: Move existing adminReply/donorReply fields into replies array
 *
 * Previously, replies were stored as discrete scalar fields (adminReply, donorReply).
 * Now they are stored as a `replies` array. This script migrates any existing
 * data into the new array format without data loss.
 *
 * IDEMPOTENT — safe to run multiple times:
 * - Skips documents that already have a populated `replies` array
 * - Only migrates if adminReply or donorReply is non-null
 *
 * Usage: node scripts/migrate-support-replies.js
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import SupportMessage from '../src/models/SupportMessage.model.js';

const log = {
  info: (msg) => console.log(`ℹ ${msg}`),
  success: (msg) => console.log(`✓ ${msg}`),
  warning: (msg) => console.log(`⚠ ${msg}`),
  error: (msg) => console.log(`✗ ${msg}`),
};

const run = async () => {
  const candidates = await SupportMessage.find({
    $or: [
      { adminReply: { $ne: null, $exists: true } },
      { donorReply: { $ne: null, $exists: true } },
    ],
    replies: { $in: [null, []] },
  }).select('_id adminReply adminReplyAt adminReplyBy donorReply donorReplyAt replies');

  log.info(`Found ${candidates.length} support message(s) with legacy replies.`);

  let migrated = 0;
  for (const msg of candidates) {
    const pushOps = [];

    if (msg.adminReply) {
      pushOps.push({
        sender: 'admin',
        senderId: msg.adminReplyBy || msg.userId,
        text: msg.adminReply,
        createdAt: msg.adminReplyAt || msg.createdAt,
      });
    }

    if (msg.donorReply) {
      pushOps.push({
        sender: 'donor',
        senderId: msg.userId,
        text: msg.donorReply,
        createdAt: msg.donorReplyAt || msg.createdAt,
      });
    }

    if (pushOps.length > 0) {
      await SupportMessage.updateOne(
        { _id: msg._id },
        { $push: { replies: { $each: pushOps } } },
      );
      migrated += 1;
    }
  }

  log.success(`Migrated ${migrated} support message(s).`);
  log.success('Migration complete. Legacy adminReply/donorReply fields can be removed from the schema after verifying all data is intact.');
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
