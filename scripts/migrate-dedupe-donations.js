#!/usr/bin/env node
import { connectDB, disconnectDB } from '../src/config/db.js';
import Donation from '../src/models/Donation.model.js';
import Request from '../src/models/Request.model.js';
import mongoose from 'mongoose';
import { logger } from '../src/utils/logger.js';

const ACTIVE_STATUSES = ['pending', 'scheduled', 'completed'];

async function dedupe() {
  await connectDB();

  // Aggregate groups with more than one active donation per donor+request
  const groups = await Donation.aggregate([
    { $match: { status: { $in: ACTIVE_STATUSES } } },
    { $group: { _id: { donorId: '$donorId', requestId: '$requestId' }, count: { $sum: 1 }, ids: { $push: '$_id' }, docs: { $push: '$$ROOT' } } },
    { $match: { count: { $gt: 1 } } },
  ]).allowDiskUse(true);

  logger.info('Duplicate groups found', { count: groups.length });

  for (const g of groups) {
    const { donorId, requestId } = g._id;
    // Choose canonical: prefer acceptedDonationId linked ones or earliest createdAt
    const docs = g.docs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    let canonical = docs[0];

    // If any doc is referenced by request.acceptedDonationId, prefer it
    const req = await Request.findById(requestId).lean();
    if (req?.acceptedDonationId) {
      const match = docs.find((d) => String(d._id) === String(req.acceptedDonationId));
      if (match) canonical = match;
    }

    const toCancel = docs.filter((d) => String(d._id) !== String(canonical._id));
    for (const d of toCancel) {
      await Donation.findByIdAndUpdate(d._id, { status: 'cancelled', cancelledReason: 'dedupe:duplicate_active_donation', cancelledAt: new Date() });
      logger.info('Cancelled duplicate donation', { donationId: d._id, donorId, requestId });
    }

    // Ensure request.acceptedDonationId points to canonical if previously pointed to a cancelled one
    if (req && req.acceptedDonationId && String(req.acceptedDonationId) !== String(canonical._id)) {
      await Request.findByIdAndUpdate(requestId, { acceptedDonationId: canonical._id });
      logger.info('Updated request acceptedDonationId to canonical donation', { requestId, canonicalDonationId: canonical._id });
    }
  }

  // Create unique partial index on donorId + requestId excluding cancelled and rejected
  try {
    // Use explicit allowed active statuses for partial index to avoid unsupported $nin in older servers
    await Donation.collection.createIndex({ donorId: 1, requestId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ACTIVE_STATUSES } }, name: 'donor_request_unique_active' });
    logger.info('Created unique partial index on donations (donorId + requestId)');
  } catch (err) {
    logger.error('Index creation failed', { message: err.message });
  }

  await disconnectDB();
}

dedupe().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
