import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as notificationController from '../../src/controllers/notification.controller.js';
import * as notificationService from '../../src/services/notification.service.js';
import { makeMockReq, makeMockRes } from '../helpers/mocks.js';

vi.mock('../../src/services/notification.service.js', () => ({
  getUserNotifications: vi.fn(),
  getUnreadNotifications: vi.fn(),
  markAsReadForUser: vi.fn(),
  markMultipleAsRead: vi.fn(),
  clearAllNotifications: vi.fn(),
  deleteNotificationForUser: vi.fn(),
  getNotificationForUser: vi.fn(),
}));

describe('Notification Controller', () => {
  const userId = '507f1f77bcf86cd799439011';
  const validId = '507f1f77bcf86cd799439022';
  const invalidId = 'not-a-valid-id';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNotifications', () => {
    it('returns notifications and unreadCount', async () => {
      const req = makeMockReq({
        user: { userId },
        query: { page: '1', limit: '20' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      notificationService.getUserNotifications.mockResolvedValue({
        notifications: [{ _id: '1', title: 'Test 1' }],
        total: 1,
      });
      notificationService.getUnreadNotifications.mockResolvedValue([{ _id: '1' }]);

      await notificationController.getNotifications(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.notifications).toHaveLength(1);
      expect(payload.data.unreadCount).toBe(1);
    });
  });

  describe('markNotificationRead', () => {
    it('returns 400 for invalid notification id', async () => {
      const req = makeMockReq({
        user: { userId },
        params: { id: invalidId },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await notificationController.markNotificationRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toBe('notification.error_invalid_notification_id');
    });

    it('returns 404 when notification is not found', async () => {
      const req = makeMockReq({
        user: { userId },
        params: { id: validId },
      });
      const res = makeMockRes();
      const next = vi.fn();

      notificationService.markAsReadForUser.mockResolvedValue(null);

      await notificationController.markNotificationRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json.mock.calls[0][0].message).toBe('notification.error_not_found');
    });

    it('returns 200 and marked notification when found', async () => {
      const req = makeMockReq({
        user: { userId },
        params: { id: validId },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockNotification = { _id: validId, title: 'Read me', read: true };
      notificationService.markAsReadForUser.mockResolvedValue(mockNotification);

      await notificationController.markNotificationRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.notification).toEqual(mockNotification);
    });
  });

  describe('markAllNotificationsRead', () => {
    it('marks all read and returns modifiedCount', async () => {
      const req = makeMockReq({ user: { userId } });
      const res = makeMockRes();
      const next = vi.fn();

      notificationService.markMultipleAsRead.mockResolvedValue({ modifiedCount: 5 });

      await notificationController.markAllNotificationsRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.modifiedCount).toBe(5);
    });
  });

  describe('deleteAllNotifications', () => {
    it('clears all notifications and returns deletedCount', async () => {
      const req = makeMockReq({ user: { userId } });
      const res = makeMockRes();
      const next = vi.fn();

      notificationService.clearAllNotifications.mockResolvedValue({ deletedCount: 10 });

      await notificationController.deleteAllNotifications(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.deletedCount).toBe(10);
    });
  });

  describe('deleteNotificationById', () => {
    it('returns 400 for invalid notification id', async () => {
      const req = makeMockReq({
        user: { userId },
        params: { id: invalidId },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await notificationController.deleteNotificationById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when notification to delete is not found', async () => {
      const req = makeMockReq({
        user: { userId },
        params: { id: validId },
      });
      const res = makeMockRes();
      const next = vi.fn();

      notificationService.deleteNotificationForUser.mockResolvedValue(null);

      await notificationController.deleteNotificationById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 200 when successfully deleted', async () => {
      const req = makeMockReq({
        user: { userId },
        params: { id: validId },
      });
      const res = makeMockRes();
      const next = vi.fn();

      notificationService.deleteNotificationForUser.mockResolvedValue({ _id: validId });

      await notificationController.deleteNotificationById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toBe('notification.deleted');
    });
  });

  describe('getNotificationById', () => {
    it('returns 400 for invalid notification id', async () => {
      const req = makeMockReq({
        user: { userId },
        params: { id: invalidId },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await notificationController.getNotificationById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when notification is not found', async () => {
      const req = makeMockReq({
        user: { userId },
        params: { id: validId },
      });
      const res = makeMockRes();
      const next = vi.fn();

      notificationService.getNotificationForUser.mockResolvedValue(null);

      await notificationController.getNotificationById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 200 and notification when found', async () => {
      const req = makeMockReq({
        user: { userId },
        params: { id: validId },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockNotification = { _id: validId, title: 'Single notification' };
      notificationService.getNotificationForUser.mockResolvedValue(mockNotification);

      await notificationController.getNotificationById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.notification).toEqual(mockNotification);
    });
  });
});
