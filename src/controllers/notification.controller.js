import mongoose from 'mongoose';
import response from '../utils/response.js';
import * as notificationService from '../services/notification.service.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { isValidObjectId } from '../utils/query.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';


export const getNotifications = asyncHandler(async (req, res) => {
  const { read, type } = req.query;
  const { offset, limit, page } = parsePagination(req.query, 20);

  const readFilter = read === undefined ? null : String(read).toLowerCase() === 'true';
  // For donor responses keep relatedId, relatedType and updatedAt available for Flutter compatibility
  const projection = req.user?.role === 'donor' ? '-__v' : null;
  const result = await notificationService.getUserNotifications(req.user.userId, {
    offset,
    limit,
    read: readFilter,
    type: type || null,
    projection,
  });

  const unread = await notificationService.getUnreadNotifications(req.user.userId);

  return response.success(res, 200, 'Notifications retrieved successfully', {
    notifications: result.notifications,
    unreadCount: unread.length,
    pagination: paginationMeta(result.total, page, limit),
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return response.error(res, 400, 'Invalid notification id');
  }

  const notification = await notificationService.markAsReadForUser(req.user.userId, req.params.id);
  if (!notification) {
    return response.error(res, 404, 'Notification not found');
  }

  return response.success(res, 200, 'Notification marked as read', { notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markMultipleAsRead(req.user.userId);
  return response.success(res, 200, 'All notifications marked as read', { modifiedCount: result.modifiedCount || 0 });
});

export const deleteAllNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.clearAllNotifications(req.user.userId);
  return response.success(res, 200, 'All notifications deleted successfully', { deletedCount: result.deletedCount || 0 });
});

export const deleteNotificationById = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return response.error(res, 400, 'Invalid notification id');
  }

  const notification = await notificationService.deleteNotificationForUser(req.user.userId, req.params.id);
  if (!notification) {
    return response.error(res, 404, 'Notification not found');
  }

  return response.success(res, 200, 'Notification deleted successfully');
});

export const getNotificationById = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return response.error(res, 400, 'Invalid notification id');
  }

  const notification = await notificationService.getNotificationForUser(req.user.userId, req.params.id);
  if (!notification) {
    return response.error(res, 404, 'Notification not found');
  }

  return response.success(res, 200, 'Notification retrieved successfully', { notification });
});
