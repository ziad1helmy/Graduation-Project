import Donor from '../models/Donor.model.js';
import Notification from '../models/Notification.model.js';
import SystemSettings from '../models/SystemSettings.model.js';

const MISSED_DONATION_WARNING_LEVELS = [1, 2];

const getThreshold = async () => {
  const setting = await SystemSettings.findOne({ key: 'max_missed_donations_before_ban' });
  return setting ? Math.max(1, Number(setting.value) || 3) : 3;
};

/**
 * Increment a donor's missed donation counter and auto-suspend after threshold.
 * Sends a warning notification at levels 1 and 2, a suspension notification at level 3.
 *
 * @param {object} opts
 * @param {string} opts.donorId
 * @param {string} opts.donationId
 * @param {string} [opts.requestId]
 * @param {string} [opts.reason]
 * @param {object} [opts.session] - MongoDB session for transactional writes
 * @returns {Promise<{ count: number, suspended: boolean, warned: boolean } | null>}
 */
export const trackMissedDonation = async ({ donorId, donationId, requestId, reason, session } = {}) => {
  if (!donorId) return null;

  const donor = await (session
    ? Donor.findById(donorId).session(session)
    : Donor.findById(donorId)
  );
  if (!donor) return null;

  donor.missedDonationCount = (donor.missedDonationCount || 0) + 1;
  if (!donor.missedDonationDates) donor.missedDonationDates = [];
  donor.missedDonationDates.push(new Date());

  const threshold = await getThreshold();
  let suspended = false;
  if (donor.missedDonationCount >= threshold) {
    donor.isSuspended = true;
    donor.suspendedReason = `Auto-suspended after ${threshold} missed donations`;
    suspended = true;
  }

  await (session ? donor.save({ session }) : donor.save());

  const remaining = Math.max(0, threshold - donor.missedDonationCount);

  if (suspended) {
    await (Notification.create([{
      userId: donor._id,
      type: 'system',
      title: 'Account Suspended',
      message: 'Your account has been suspended due to 3 missed donations. Please contact support to reactivate.',
      relatedId: donationId,
      relatedType: 'Donation',
      data: { donationId, requestId, missedCount: donor.missedDonationCount, reason },
    }], session ? { session } : {}).catch(() => {}));
  } else if (MISSED_DONATION_WARNING_LEVELS.includes(donor.missedDonationCount)) {
    await (Notification.create([{
      userId: donor._id,
      type: 'system',
      title: 'Missed Donation Warning',
      message: `You have ${donor.missedDonationCount} missed donation(s). After ${remaining} more, your account will be suspended.`,
      relatedId: donationId,
      relatedType: 'Donation',
      data: { donationId, requestId, missedCount: donor.missedDonationCount, reason, remaining },
    }], session ? { session } : {}).catch(() => {}));
  }

  return {
    count: donor.missedDonationCount,
    suspended,
    warned: !suspended && MISSED_DONATION_WARNING_LEVELS.includes(donor.missedDonationCount),
  };
};
