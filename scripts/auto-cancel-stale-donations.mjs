#!/usr/bin/env node

/**
 * Background Worker - Auto-cancel stale pending donations
 * 
 * Purpose: Enforce appointment scheduling deadline (14 days by default)
 * - Finds donations pending > 14 days without an appointment
 * - Auto-cancels them to prevent indefinite obligations
 * - Logs activity for affected donors and hospitals
 * - Prevents orphaned donations that clutter the system
 * 
 * Usage:
 *   node scripts/auto-cancel-stale-donations.mjs --env=production
 *   
 * Should be run periodically via cron or background job scheduler:
 *   0 2 * * * /usr/bin/node /app/scripts/auto-cancel-stale-donations.mjs >> /var/log/lifelink/auto-cancel.log 2>&1
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import Donation from '../src/models/Donation.model.js';
import Notification from '../src/models/Notification.model.js';
import Request from '../src/models/Request.model.js';

async function autoCancelStaleDonations() {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const staleDonations = await Donation.find(
        {
          status: 'pending',
          appointmentId: null,
          appointmentScheduleDeadline: { $lt: now },
          autoCompiledAt: null,
        },
        null,
        { session }
      ).populate([
        { path: 'donorId', select: '_id fullName email' },
        { path: 'requestId', select: '_id hospitalId' },
      ]);

      if (staleDonations.length === 0) {
        logger.info('Auto-cancel stale donations: No stale donations found');
        return;
      }

      logger.info(`Auto-cancel stale donations: Found ${staleDonations.length} donations to cancel`);

      const cancelledIds = [];
      const notifications = [];

      for (const donation of staleDonations) {
        // Update donation
        await Donation.findByIdAndUpdate(
          donation._id,
          {
            $set: {
              status: 'cancelled',
              autoCompiledAt: now,
              notes: (donation.notes || '') +
                '\n[Auto-cancelled] Appointment not scheduled within deadline (14 days)',
            },
          },
          { session }
        );

        cancelledIds.push(donation._id);

        // Notify donor
        if (donation.donorId) {
          notifications.push({
            userId: donation.donorId._id,
            type: 'donation_auto_cancelled',
            title: 'Donation Cancelled',
            message: `Your donation pledge has been automatically cancelled due to not scheduling an appointment within 14 days.`,
            relatedId: donation._id,
            relatedType: 'Donation',
            read: false,
            createdAt: now,
          });
        }

        // Notify hospital
        if (donation.requestId?.hospitalId) {
          notifications.push({
            userId: donation.requestId.hospitalId,
            type: 'donation_auto_cancelled',
            title: 'Donor Cancelled Pledge',
            message: `A donor's pledge for your request has been automatically cancelled due to not scheduling an appointment.`,
            relatedId: donation._id,
            relatedType: 'Donation',
            read: false,
            createdAt: now,
          });
        }
      }

      // Bulk insert notifications
      if (notifications.length > 0) {
        await Notification.insertMany(notifications, { session });
      }

      logger.info('Auto-cancel stale donations completed', {
        cancelledCount: staleDonations.length,
        notificationCount: notifications.length,
      });
    });
  } catch (error) {
    logger.error('Auto-cancel stale donations failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    logger.info('Auto-cancel stale donations: MongoDB connected');

    // Run the job
    await autoCancelStaleDonations();

    logger.info('Auto-cancel stale donations: Job completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Auto-cancel stale donations: Fatal error', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

main();
