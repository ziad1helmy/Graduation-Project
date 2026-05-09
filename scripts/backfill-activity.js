import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Activity from '../src/models/Activity.model.js';
import Donation from '../src/models/Donation.model.js';
import Request from '../src/models/Request.model.js';
import '../src/models/User.model.js';
import { POINTS_CONFIG } from '../src/models/PointsTransaction.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

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

const getMongoUri = () => process.env.MONGO_URI || process.env.MONGODB_URI || '';

const isProductionLikeUri = (uri) => {
  const normalized = String(uri || '').toLowerCase();
  return normalized.includes('prod') || normalized.includes('production') || normalized.includes('atlas');
};

const getHospitalName = (request) => {
  if (!request) return null;
  return request.hospitalName || request.hospitalId?.hospitalName || request.hospitalId?.fullName || null;
};

const normalizeDonationReferenceId = (referenceId) => {
  if (!referenceId) return null;

  const raw = String(referenceId).trim();
  const matches = raw.match(/[a-f0-9]{24}$/i);
  return matches ? matches[0] : raw;
};

const buildDonationActivityUpdate = async (activity) => {
  const currentHospital = activity.metadata?.hospitalName || activity.metadata?.hospital || null;
  const currentPoints = activity.metadata?.pointsAmount ?? null;

  if (currentHospital && (currentPoints !== null || activity.action !== 'completed_donation')) {
    return null;
  }

  const donationId = normalizeDonationReferenceId(activity.referenceId);
  const donation = donationId
    ? await Donation.findOne({ _id: donationId, donorId: activity.userId }).lean()
    : null;

  const requestIdFallback = normalizeDonationReferenceId(activity.metadata?.requestId);
  const fallbackDonation = !donation && requestIdFallback
    ? await Donation.findOne({ donorId: activity.userId, requestId: requestIdFallback }).lean()
    : null;

  const sourceDonation = donation || fallbackDonation;

  if (!sourceDonation) return null;

  const request = sourceDonation.requestId
    ? await Request.findById(sourceDonation.requestId).populate('hospitalId', 'hospitalName fullName').lean()
    : null;
  const hospitalName = getHospitalName(request);

  const metadata = { ...(activity.metadata || {}) };
  let changed = false;

  if (hospitalName && !metadata.hospitalName) {
    metadata.hospitalName = hospitalName;
    changed = true;
  }

  if (activity.action === 'completed_donation' && metadata.pointsAmount == null) {
    metadata.pointsAmount = POINTS_CONFIG.BLOOD_DONATION;
    changed = true;
  }

  if (activity.action === 'cancelled_donation' && metadata.status == null) {
    metadata.status = 'cancelled';
    changed = true;
  }

  if (activity.action === 'created_donation' && metadata.status == null) {
    metadata.status = 'pending';
    changed = true;
  }

  if (!changed) return null;

  return {
    _id: activity._id,
    metadata,
  };
};

const main = async () => {
  const uri = getMongoUri();

  if (!uri) {
    throw new Error('Missing MONGO_URI or MONGODB_URI');
  }

  if (process.env.NODE_ENV === 'production' || isProductionLikeUri(uri)) {
    throw new Error('Refusing to run activity backfill against a production-like MongoDB URI');
  }

  log.info('Connecting to MongoDB...');
  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });
  log.success('Connected to MongoDB.');

  const query = {
    type: 'donation',
    action: { $in: ['created_donation', 'completed_donation', 'cancelled_donation'] },
    $or: [
      { 'metadata.hospitalName': { $exists: false } },
      { 'metadata.hospitalName': null },
      { 'metadata.pointsAmount': { $exists: false } },
      { 'metadata.status': { $exists: false } },
    ],
  };

  const totalCandidates = await Activity.countDocuments(query);
  log.info(`Found ${totalCandidates} candidate activities.`);

  let inspected = 0;
  let updated = 0;
  let skipped = 0;

  const cursor = Activity.find(query).sort({ createdAt: 1 }).lean().cursor();

  for await (const activity of cursor) {
    inspected += 1;

    try {
      const update = await buildDonationActivityUpdate(activity);
      if (!update) {
        skipped += 1;
        continue;
      }

      await Activity.updateOne(
        { _id: update._id },
        { $set: { metadata: update.metadata } },
        { runValidators: false }
      );

      updated += 1;
    } catch (error) {
      skipped += 1;
      log.warning(`Skipped activity ${activity._id}: ${error.message}`);
    }
  }

  log.success(`Backfill complete. Inspected=${inspected}, Updated=${updated}, Skipped=${skipped}`);
};

main()
  .catch((error) => {
    log.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      log.info('MongoDB connection closed.');
    }
  });