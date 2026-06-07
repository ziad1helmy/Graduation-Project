import Activity from '../models/Activity.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import Hospital from '../models/Hospital.model.js';
import { paginationMeta } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';

/**
 * Activity Service
 *
 * Manages the append-only activity log for user timelines.
 * All methods are fire-and-forget safe — errors are logged but never thrown upstream.
 *
 * Core responsibilities:
 *  1. Create activity records (write path)
 *  2. Query user timeline with pagination and filtering (read path)
 *  3. Deduplication — ensure the same event never creates duplicate activities
 *  4. Dashboard aggregation — return latest N items efficiently
 *
 * This service is a CONSUMER — called by other services, never the reverse.
 * Other services import and call activityService.logActivity() after their actions succeed.
 */

// ──────────────────────────────────────────────
//  Write Path: Create Activities
// ──────────────────────────────────────────────

/**
 * Log an activity — main write entry point.
 *
 * Called by other services (donation, reward, donor controller) when user actions occur.
 * Performs deduplication and inserts the activity.
 *
 * @param {string|ObjectId} userId - User who performed the action
 * @param {object} payload - Activity data
 * @param {string} payload.type - Activity type (donation, reward, emergency_response, profile_update)
 * @param {string} payload.action - Granular action verb (e.g. "completed_donation")
 * @param {string} payload.title - Display-ready title for mobile UI
 * @param {string} payload.description - Summary sentence
 * @param {string} [payload.referenceId] - ID of related entity (for dedup + deep-linking)
 * @param {string} [payload.referenceType] - Type of referenced entity
 * @param {object} [payload.metadata] - Denormalized snapshot of event data
 * @param {string} [payload.icon] - Icon identifier for mobile UI
 *
 * @returns {Promise<Activity|null>} The created activity, or null if deduplicated (skipped)
 *
 * Fire-and-forget safe: call from other services without awaiting. Errors are logged.
 *
 * @example
 * // In donation.service.js, after donation.create() succeeds:
 * activityService.logActivity(donorId, {
 *   type: 'donation',
 *   action: 'created_donation',
 *   title: 'Blood Donation Submitted',
 *   description: 'Submitted A+ blood donation request to Cairo Hospital',
 *   referenceId: donation._id.toString(),
 *   referenceType: 'Donation',
 *   metadata: { bloodType: 'A+', hospitalName: 'Cairo Hospital', quantity: 1 },
 *   icon: 'heart',
 * }).catch(err => logger.error('Activity log failed', { userId: donorId, error: err.message }));
 */
export const logActivity = async (userId, payload) => {
  try {
    // Validate required fields
    if (!userId) throw new Error('userId is required');
    if (!payload.type) throw new Error('payload.type is required');
    if (!payload.action) throw new Error('payload.action is required');
    if (!payload.title) throw new Error('payload.title is required');
    if (!payload.description) throw new Error('payload.description is required');

    const normalizedReferenceId = payload.referenceId ? String(payload.referenceId) : null;

    // Deduplication: check if this exact activity already exists
    if (normalizedReferenceId) {
      const existing = await Activity.findOne({
        userId,
        action: payload.action,
        referenceId: normalizedReferenceId,
      });

      if (existing) {
        // Activity already logged for this event — skip silently
        return null;
      }
    }

    // Create the activity
    const activity = await Activity.create({
      userId,
      type: payload.type,
      action: payload.action,
      title: payload.title,
      description: payload.description,
      referenceId: normalizedReferenceId,
      referenceType: payload.referenceType || null,
      metadata: payload.metadata || {},
      icon: payload.icon || null,
    });

    logger.info('Activity logged', {
      userId: userId.toString(),
      type: payload.type,
      action: payload.action,
      referenceId: normalizedReferenceId,
    });

    return activity;
  } catch (error) {
    // Fix #2 (HIGH): Emit a structured, filterable alert event so log
    // aggregators / alerting rules can detect audit trail gaps by searching
    // for event='ACTIVITY_LOG_FAILURE'. Previously only a generic error was logged.
    logger.error('ACTIVITY_LOG_FAILURE', {
      event: 'ACTIVITY_LOG_FAILURE',
      userId: String(userId),
      type: payload?.type,
      action: payload?.action,
      referenceId: payload?.referenceId ? String(payload.referenceId) : null,
      error: error.message,
    });

    // When the caller flags this log as critical (e.g. donation completion,
    // points awarding), re-throw so the caller can decide to roll back or alert.
    if (payload?.critical === true) {
      throw error;
    }

    return null;
  }
};

// ──────────────────────────────────────────────
//  Read Path: Query Timelines
// ──────────────────────────────────────────────

/**
 * Get user's activity timeline with pagination.
 *
 * Core timeline query used by the `/donor/activity` endpoint.
 * Returns paginated activities sorted newest-first.
 *
 * @param {string|ObjectId} userId - User to fetch activities for
 * @param {object} filters - Query filters
 * @param {number} [filters.page=1] - Page number (1-indexed)
 * @param {number} [filters.limit=20] - Activities per page (max 100)
 *
 * @returns {Promise<{activities: Activity[], pagination: object}>}
 *  - activities: Array of activity documents (newest first)
 *  - pagination: {total, page, limit, totalPages, hasNextPage, hasPrevPage}
 *
 * @example
 * const result = await activityService.getUserTimeline(donorId, {
 *   page: 1,
 *   limit: 20
 * });
 * console.log(result.activities); // [{ type, action, title, ... }, ...]
 * console.log(result.pagination); // { total: 42, page: 1, ... }
 */
export const getUserTimeline = async (userId, filters = {}, projection = null) => {
  try {
    const page = Math.max(parseInt(filters.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    // Build query: always scoped to userId
    const query = { userId };

    // Optional filters
    if (filters.type) query.type = filters.type;
    if (filters.action) query.action = filters.action;

    // Fetch total matching documents (for pagination metadata)
    const total = await Activity.countDocuments(query);

    // Fetch paginated results — newest first
    const activities = await Activity.find(query, projection || '-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Return plain objects (faster)

    // Enrich activities with hospitalName when metadata lacks it.
    try {
      const requestIds = new Set();
      const hospitalIds = new Set();
      const donationIds = new Set();

      activities.forEach((act) => {
        if (!act.metadata) act.metadata = {};
        const meta = act.metadata || {};
        const hasHospital = meta.hospitalName || meta.hospital;
        if (!hasHospital) {
          if (meta.requestId) requestIds.add(meta.requestId);
          if (meta.hospitalId) hospitalIds.add(meta.hospitalId);
          if (!meta.requestId && act.referenceType === 'Donation' && act.referenceId) {
            donationIds.add(act.referenceId);
          }
        }
      });

      // If we have donations to resolve to requests, fetch them first
      if (donationIds.size > 0) {
        const donations = await Donation.find({ _id: { $in: Array.from(donationIds) } }).lean();
        donations.forEach((d) => {
          if (d.requestId) requestIds.add(String(d.requestId));
        });
      }

      // Fetch requests and map to hospital names
      const requestMap = new Map();
      if (requestIds.size > 0) {
        const requests = await Request.find({ _id: { $in: Array.from(requestIds) } })
          .populate('hospitalId', 'hospitalName name')
          .lean();

        requests.forEach((r) => {
          const hospitalName = r.hospitalName || r.hospitalId?.hospitalName || r.hospitalId?.name || null;
          requestMap.set(String(r._id), hospitalName);
        });
      }

      // Fetch hospitals directly when provided
      const hospitalMap = new Map();
      if (hospitalIds.size > 0) {
        const hospitals = await Hospital.find({ _id: { $in: Array.from(hospitalIds) } }).lean();
        hospitals.forEach((h) => {
          const name = h.hospitalName || h.name || null;
          hospitalMap.set(String(h._id), name);
        });
      }

      // Apply resolved names back to activities
      activities.forEach((act) => {
        const meta = act.metadata || {};
        if (!meta.hospitalName && !meta.hospital) {
          let found = null;
          if (meta.requestId) found = requestMap.get(String(meta.requestId));
          // fallback to hospitalId from metadata
          if (!found && meta.hospitalId) found = hospitalMap.get(String(meta.hospitalId));
          if (found) meta.hospitalName = found;
        }
      });
    } catch (e) {
      logger.warn('activity enrichment failed', { error: e.message });
    }

    return {
      activities,
      pagination: paginationMeta(total, page, limit),
    };
  } catch (error) {
    logger.error('getUserTimeline error', {
      userId: String(userId),
      error: error.message,
    });
    throw error;
  }
};

/**
 * Get the latest N activities for a user (dashboard shortcut).
 *
 * Optimized for dashboard display — no pagination overhead.
 * Returns only the most recent activities without a count query.
 *
 * @param {string|ObjectId} userId - User to fetch activities for
 * @param {number} [count=5] - Number of latest activities to return
 *
 * @returns {Promise<Activity[]>} Array of latest activities (newest first)
 *
 * @example
 * const latestActivities = await activityService.getLatestActivities(donorId, 5);
 * // Returns: [{ type, action, title, icon, createdAt }, ...]
 */
export const getLatestActivities = async (userId, count = 5) => {
  try {
    const normalizedCount = Math.max(Math.min(parseInt(count) || 5, 50), 1);

    const activities = await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .limit(normalizedCount)
      .select('-__v')
      .lean();

    return activities;
  } catch (error) {
    logger.error('getLatestActivities error', {
      userId: String(userId),
      error: error.message,
    });
    throw error;
  }
};

// ──────────────────────────────────────────────
//  Cleanup: GDPR & Account Deletion
// ──────────────────────────────────────────────

/**
 * Delete all activities for a user (GDPR / account deletion support).
 *
 * Called during account deletion workflows to purge user data.
 * This is a bulk delete operation — use with caution.
 *
 * @param {string|ObjectId} userId - User whose activities to delete
 *
 * @returns {Promise<{deletedCount: number}>} Number of deleted documents
 *
 * @example
 * const result = await activityService.deleteUserActivities(donorId);
 * console.log(`Deleted ${result.deletedCount} activities`);
 */
export const deleteUserActivities = async (userId) => {
  try {
    const result = await Activity.deleteMany({ userId });

    logger.info('User activities deleted', {
      userId: String(userId),
      deletedCount: result.deletedCount,
    });

    return {
      deletedCount: result.deletedCount,
    };
  } catch (error) {
    logger.error('deleteUserActivities error', {
      userId: String(userId),
      error: error.message,
    });
    throw error;
  }
};

// ──────────────────────────────────────────────
//  Exports
// ──────────────────────────────────────────────

export default {
  logActivity,
  getUserTimeline,
  getLatestActivities,
  deleteUserActivities,
};
