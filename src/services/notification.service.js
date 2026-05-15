import mongoose from 'mongoose';
import Donor from '../models/Donor.model.js';
import Notification from '../models/Notification.model.js';
import { sendToMultiple } from '../utils/fcm.js';
import {
  buildEmergencyRequestFcmData,
  buildEmergencyRequestNotificationData,
  buildEmergencyRequestNotificationContent,
} from '../utils/emergency-notification.js';
import { logger } from '../utils/logger.js';

/**
 * Notification Service - Manages user notifications for matches, requests, and milestones
 */

/**
 * Create and send a match notification to hospital
 * @param {string} userId - Hospital user ID
 * @param {Object} donation - Donation document
 * @param {Object} request - Request document
 * @returns {Object} - Created notification
 */
export const notifyMatch = async (userId, donation, request) => {
  try {
    const notification = await Notification.create({
      userId,
      type: 'match',
      title: 'New Donor Matched',
      message: `A donor has matched your ${request.type === 'blood' ? request.bloodType + ' blood' : request.organType + ' organ'} request`,
      relatedId: donation._id,
      relatedType: 'Donation',
      data: {
        donationId: donation._id,
        requestId: request._id,
        requestType: request.type,
      },
    });

    return notification;
  } catch (error) {
    logger.error('Error creating match notification', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Create and send a request notification to donors
 * Notifies donors about a new request they might be able to help with
 * @param {Array} donorIds - Array of donor user IDs
 * @param {Object} request - Request document (populated with hospital info)
 * @returns {Array} - Array of created notifications
 */
export const notifyRequest = async (donorIds, request) => {
  try {
    if (!Array.isArray(donorIds) || donorIds.length === 0) {
      return [];
    }

    const populatedRequest = typeof request?.populate === 'function'
      ? await request.populate('hospitalId', 'fullName hospitalName address location contactNumber')
      : request;

    const donors = await Donor.find({ _id: { $in: donorIds } })
      .select('_id fullName location fcmTokens settings')
      .lean(false);

    if (donors.length === 0) {
      return [];
    }

    const isEmergency = request.isEmergency || ['high', 'critical'].includes(request.urgency);
    const notificationType = isEmergency ? 'emergency' : 'request';
    const notifications = await Notification.insertMany(
      donors.map((donor) => {
        const content = buildEmergencyRequestNotificationContent(populatedRequest, donor);
        const notificationData = buildEmergencyRequestNotificationData(populatedRequest, donor);

        return {
          userId: donor._id,
          type: notificationType,
          title: content.title,
          message: content.body,
          relatedId: request._id,
          relatedType: 'Request',
          data: notificationData,
        };
      })
    );

    await Promise.allSettled(
      donors
        .filter((donor) => Array.isArray(donor.fcmTokens) && donor.fcmTokens.length > 0)
        .map((donor) => {
          const content = buildEmergencyRequestNotificationContent(populatedRequest, donor);
          const data = buildEmergencyRequestFcmData(populatedRequest, donor);
          const options = {
            channelId: 'emergency_requests',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            apnsCategory: 'emergency_request',
            titleLocKey: data.title_loc_key,
            bodyLocKey: data.body_loc_key,
            bodyLocArgs: [data.bloodType || '', data.hospitalName || ''],
          };

          return sendToMultiple(donor.fcmTokens, content.title, content.body, data, options);
        })
    );

    return notifications;
  } catch (error) {
    logger.error('Error creating request notifications', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Create a milestone achievement notification
 * @param {string} userId - User ID
 * @param {Object} achievement - Achievement details
 * @returns {Object} - Created notification
 */
export const notifyMilestone = async (userId, achievement) => {
  try {
    const notification = await Notification.create({
      userId,
      type: 'milestone',
      title: `Achievement Unlocked: ${achievement.title}`,
      message: achievement.message || `Congratulations! You've unlocked: ${achievement.title}`,
      relatedId: achievement.id,
      relatedType: 'Achievement',
      data: {
        achievementId: achievement.id,
        achievementType: achievement.type,
        points: achievement.points || 0,
      },
    });

    return notification;
  } catch (error) {
    logger.error('Error creating milestone notification', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Mark a notification as read
 * @param {string} notificationId - Notification ID
 * @returns {Object} - Updated notification
 */
export const markAsRead = async (notificationId) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { returnDocument: 'after' }
    );

    return notification;
  } catch (error) {
    logger.error('Error marking notification as read', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Mark one notification as read for a specific user.
 * @param {string} userId - User ID
 * @param {string} notificationId - Notification ID
 * @returns {Object|null} - Updated notification or null if not found
 */
export const markAsReadForUser = async (userId, notificationId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true },
      { returnDocument: 'after' }
    );
    return notification;
  } catch (error) {
    logger.error('Error marking user notification as read', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Mark multiple notifications as read
 * @param {string} userId - User ID
 * @param {Array} notificationIds - Array of notification IDs (optional, if not provided, marks all as read)
 * @returns {Object} - Update result
 */
export const markMultipleAsRead = async (userId, notificationIds = null) => {
  try {
    const filter = { userId };
    if (notificationIds && Array.isArray(notificationIds)) {
      filter._id = { $in: notificationIds };
    }

    const result = await Notification.updateMany(filter, { read: true });

    return result;
  } catch (error) {
    logger.error('Error marking notifications as read', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Get unread notifications for a user
 * @param {string} userId - User ID
 * @returns {Array} - Array of unread notifications
 */
export const getUnreadNotifications = async (userId) => {
  try {
    const notifications = await Notification.find({ userId, read: false }).sort({
      createdAt: -1,
    });

    return notifications;
  } catch (error) {
    logger.error('Error fetching unread notifications', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Get all notifications for a user with pagination
 * @param {string} userId - User ID
 * @param {Object} options - {skip, limit, read, type}
 * @returns {Object} - {notifications, total}
 */
export const getUserNotifications = async (userId, options = {}) => {
  try {
    const { skip = 0, limit = 10, read = null, type = null } = options;

    const filter = { userId };
    if (read !== null) filter.read = read;
    if (type) filter.type = type;

    const notifications = await Notification.find(filter)
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Notification.countDocuments(filter);

    return { notifications, total };
  } catch (error) {
    logger.error('Error fetching user notifications', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Get one notification for a specific user.
 * @param {string} userId - User ID
 * @param {string} notificationId - Notification ID
 * @returns {Object|null} - Notification or null if not found
 */
export const getNotificationForUser = async (userId, notificationId) => {
  try {
    return await Notification.findOne({ _id: notificationId, userId });
  } catch (error) {
    logger.error('Error fetching user notification', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @returns {Object} - Deleted notification
 */
export const deleteNotification = async (notificationId) => {
  try {
    const notification = await Notification.findByIdAndDelete(notificationId);

    return notification;
  } catch (error) {
    logger.error('Error deleting notification', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Delete one notification for a specific user.
 * @param {string} userId - User ID
 * @param {string} notificationId - Notification ID
 * @returns {Object|null} - Deleted notification or null if not found
 */
export const deleteNotificationForUser = async (userId, notificationId) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: notificationId, userId });
    return notification;
  } catch (error) {
    logger.error('Error deleting user notification', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Clear all notifications for a user
 * @param {string} userId - User ID
 * @returns {Object} - Deletion result
 */
export const clearAllNotifications = async (userId) => {
  try {
    const result = await Notification.deleteMany({ userId });

    return result;
  } catch (error) {
    logger.error('Error clearing notifications', {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Get notification statistics for a user
 * @param {string} userId - User ID
 * @returns {Object} - Statistics
 */
export const getNotificationStats = async (userId) => {
  try {
    const total = await Notification.countDocuments({ userId });
    const unread = await Notification.countDocuments({ userId, read: false });
    const byType = await Notification.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    return {
      total,
      unread,
      read: total - unread,
      byType: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };
  } catch (error) {
    logger.error('Error getting notification stats', {
      message: error.message,
    });
    throw error;
  }
};
