import mongoose from 'mongoose';
import response from '../utils/response.js';
import * as notificationService from '../services/notification.service.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export const getNotifications = async (req, res, next) => {
  try {
    const { read, type } = req.query;
    const { skip, limit, page } = parsePagination(req.query, 20);

    const readFilter = read === undefined ? null : String(read).toLowerCase() === 'true';
    const result = await notificationService.getUserNotifications(req.user.userId, {
      skip,
      limit,
      read: readFilter,
      type: type || null,
    });

    const unread = await notificationService.getUnreadNotifications(req.user.userId);

    return response.success(res, 200, 'Notifications retrieved successfully', {
      notifications: result.notifications,
      unreadCount: unread.length,
      pagination: paginationMeta(result.total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return response.error(res, 400, 'Invalid notification id');
    }

    const notification = await notificationService.markAsReadForUser(req.user.userId, req.params.id);
    if (!notification) {
      return response.error(res, 404, 'Notification not found');
    }

    return response.success(res, 200, 'Notification marked as read', { notification });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markMultipleAsRead(req.user.userId);
    return response.success(res, 200, 'All notifications marked as read', {
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotificationById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return response.error(res, 400, 'Invalid notification id');
    }

    const notification = await notificationService.deleteNotificationForUser(req.user.userId, req.params.id);
    if (!notification) {
      return response.error(res, 404, 'Notification not found');
    }

    return response.success(res, 200, 'Notification deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const getNotificationById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return response.error(res, 400, 'Invalid notification id');
    }

    const notification = await notificationService.getNotificationForUser(req.user.userId, req.params.id);
    if (!notification) {
      return response.error(res, 404, 'Notification not found');
    }

    return response.success(res, 200, 'Notification retrieved successfully', { notification });
  } catch (error) {
    next(error);
  }
};
