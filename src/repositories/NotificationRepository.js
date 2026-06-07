/**
 * NotificationRepository - Data access layer for Notification model
 */

import { BaseRepository } from './BaseRepository.js';
import Notification from '../models/Notification.model.js';
import logger from '../utils/logger.js';

class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification, 'Notification');
  }

  async findUserInbox(userId, options = {}) {
    try {
      const { skip = 0, limit = 50, lean = true, unreadOnly = false } = options;
      const filter = { recipientId: userId };
      if (unreadOnly) {
        filter.isRead = false;
      }
      return await this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();
    } catch (error) {
      logger.error('Failed to find user notifications', { error: error.message, userId });
      throw error;
    }
  }

  async markAsRead(notificationId) {
    try {
      return await this.updateById(notificationId, { isRead: true, readAt: new Date() });
    } catch (error) {
      logger.error('Failed to mark notification as read', { error: error.message, notificationId });
      throw error;
    }
  }

  async markMultipleAsRead(notificationIds) {
    try {
      return await this.updateMany({ _id: { $in: notificationIds } }, { isRead: true, readAt: new Date() });
    } catch (error) {
      logger.error('Failed to mark notifications as read', { error: error.message });
      throw error;
    }
  }

  async countUnread(userId) {
    try {
      return await this.count({ recipientId: userId, isRead: false });
    } catch (error) {
      logger.error('Failed to count unread notifications', { error: error.message, userId });
      throw error;
    }
  }
}

export default new NotificationRepository();
