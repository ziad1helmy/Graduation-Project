import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authController from '../../src/controllers/auth.controller.js';
import * as authService from '../../src/services/auth.service.js';
import { ERR } from '../../src/utils/errorCodes.js';
import { HttpError } from '../../src/utils/HttpError.js';
import { makeMockReq, makeMockRes } from '../helpers/mocks.js';

vi.mock('../../src/services/auth.service.js', () => ({
  register: vi.fn(),
  loginUser: vi.fn(),
  loginAdmin: vi.fn(),
  loginHospital: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
  getMe: vi.fn(),
  registerFcmToken: vi.fn(),
  replaceFcmToken: vi.fn(),
  removeFcmToken: vi.fn(),
  verifyOtp: vi.fn(),
  verifyEmail: vi.fn(),
  verifyEmailOtp: vi.fn(),
}));

const expectHttpError = (next, statusCode, messagePattern) => {
  expect(next).toHaveBeenCalledTimes(1);
  const err = next.mock.calls[0][0];
  expect(err).toBeInstanceOf(HttpError);
  expect(err.statusCode).toBe(statusCode);
  if (messagePattern) expect(err.message).toMatch(messagePattern);
};

describe('Auth Controller', () => {
  const userId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('returns 201 when registration is successful', async () => {
      const req = makeMockReq({
        body: { email: 'donor@test.com', password: 'Password123', role: 'donor', first_name: 'John', last_name: 'Doe' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockResult = {
        user: { _id: userId, email: 'donor@test.com', fullName: 'John Doe', role: 'donor' },
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      };
      authService.register.mockResolvedValue(mockResult);

      await authController.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(callArgs.data.user.fullName).toBe('John Doe');
    });

    it('returns 403 when role is not donor (public signups are donor-only)', async () => {
      const req = makeMockReq({
        body: { email: 'hospital@test.com', password: 'Password123', role: 'hospital' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await authController.register(req, res, next);

      expectHttpError(next, 403, /Public signup is available for donors only/);
    });

    it('returns 400 when registration fails validation', async () => {
      const req = makeMockReq({
        body: { email: 'donor@test.com', password: 'Password123', role: 'donor' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      authService.register.mockRejectedValue(new Error('Validation failed: Email already exists'));

      await authController.register(req, res, next);

      expectHttpError(next, 400, /Validation failed/);
    });
  });

  describe('loginUser', () => {
    it('returns 200 on successful login', async () => {
      const req = makeMockReq({
        body: { email: 'donor@test.com', password: 'Password123!', role: 'donor' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockResult = {
        user: { _id: userId, email: 'donor@test.com', role: 'donor', fullName: 'John Doe' },
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      };
      authService.loginUser.mockResolvedValue(mockResult);

      await authController.loginUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.access_token).toBe('access_token');
    });

    it('returns 403 when user account is suspended', async () => {
      const req = makeMockReq({
        body: { email: 'donor@test.com', password: 'Password123!', role: 'donor' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      authService.loginUser.mockRejectedValue(new Error(ERR.AUTH_ACCOUNT_SUSPENDED));

      await authController.loginUser(req, res, next);

      expectHttpError(next, 403, new RegExp(ERR.AUTH_ACCOUNT_SUSPENDED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });

    it('returns 401 for invalid credentials', async () => {
      const req = makeMockReq({
        body: { email: 'donor@test.com', password: 'WrongPassword123!', role: 'donor' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      authService.loginUser.mockRejectedValue(new Error(ERR.AUTH_INVALID_CREDENTIALS));

      await authController.loginUser(req, res, next);

      expectHttpError(next, 401);
    });
  });

  describe('loginAdmin', () => {
    it('accepts adminCode as an adminKey alias', async () => {
      const req = makeMockReq({
        body: {
          email: 'admin@lifelink.demo',
          password: 'AdminPass@123',
          adminCode: 'ADM001',
        },
      });
      const res = makeMockRes();
      const next = vi.fn();

      authService.loginAdmin.mockResolvedValue({
        admin: { _id: userId, email: 'admin@lifelink.demo', role: 'admin' },
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      });

      await authController.loginAdmin(req, res, next);

      expect(authService.loginAdmin).toHaveBeenCalledWith({
        email: 'admin@lifelink.demo',
        password: 'AdminPass@123',
        adminCode: 'ADM001',
        adminKey: 'ADM001',
        role: 'admin',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.access_token).toBe('access_token');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('returns 200 on successful logout', async () => {
      const req = makeMockReq({
        body: { refreshToken: 'valid_refresh_token' },
        user: { userId },
      });
      const res = makeMockRes();
      const next = vi.fn();

      authService.logout.mockResolvedValue({});

      await authController.logout(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toBe('Logged out successfully');
    });

    it('returns 400 when refresh token is missing or invalid', async () => {
      const req = makeMockReq({
        body: {},
      });
      const res = makeMockRes();
      const next = vi.fn();

      authService.logout.mockRejectedValue(new Error(ERR.AUTH_REFRESH_TOKEN_REQUIRED));

      await authController.logout(req, res, next);

      expectHttpError(next, 400);
    });
  });

  describe('refreshToken', () => {
    it('returns 200 with new access token', async () => {
      const req = makeMockReq({
        body: { refreshToken: 'valid_refresh_token' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      authService.refreshToken.mockResolvedValue({ accessToken: 'new_access_token' });

      await authController.refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.accessToken).toBe('new_access_token');
    });
  });

  describe('changePassword', () => {
    it('returns 200 on success', async () => {
      const req = makeMockReq({
        user: { userId },
        body: { currentPassword: 'Password123!', newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      authService.changePassword.mockResolvedValue({});

      await authController.changePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toBe('Password changed successfully');
    });

    it('returns 400 on incorrect current password', async () => {
      const req = makeMockReq({
        user: { userId },
        body: { currentPassword: 'Password123!', newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      authService.changePassword.mockRejectedValue(new Error(ERR.AUTH_CURRENT_PASSWORD_INCORRECT));

      await authController.changePassword(req, res, next);

      expectHttpError(next, 400, new RegExp(ERR.AUTH_CURRENT_PASSWORD_INCORRECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });

    it('returns 400 when the new password matches the current password', async () => {
      const req = makeMockReq({
        user: { userId },
        body: { currentPassword: 'Password123!', newPassword: 'Password123!', confirmPassword: 'Password123!' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await authController.changePassword(req, res, next);

      expectHttpError(next, 400);
    });
  });

  describe('loginHospital', () => {
    it('returns 200 on successful hospital login', async () => {
      const req = makeMockReq({ body: { email: 'ops@cairocare.demo', password: 'HospitalPass@123', role: 'hospital', hospitalId: 'HOSP-CAIRO-001' } });
      const res = makeMockRes();
      const next = vi.fn();

      const mockResult = {
        user: { _id: userId, email: 'ops@cairocare.demo', role: 'hospital', fullName: 'Cairo Care' },
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      };
      authService.loginHospital.mockResolvedValue(mockResult);

      await authController.loginHospital(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.access_token).toBe('access_token');
    });

    it('returns 400 when hospitalId is missing', async () => {
      const req = makeMockReq({ body: { email: 'ops@cairocare.demo', password: 'HospitalPass@123', role: 'hospital' } });
      const res = makeMockRes();
      const next = vi.fn();

      await authController.loginHospital(req, res, next);

      expectHttpError(next, 400);
    });

    it('returns 401 when hospitalId is invalid', async () => {
      const req = makeMockReq({ body: { email: 'ops@cairocare.demo', password: 'HospitalPass@123', role: 'hospital', hospitalId: 'BAD-ID' } });
      const res = makeMockRes();
      const next = vi.fn();

      const err = new Error('Invalid hospital ID');
      err.statusCode = 401;
      authService.loginHospital.mockRejectedValue(err);

      await authController.loginHospital(req, res, next);

      expectHttpError(next, 401);
    });

    it('returns 400 for malformed payload', async () => {
      const req = makeMockReq({ body: { email: 'not-an-email', password: 'short', role: 'hospital', hospitalId: 'HOSP-CAIRO-001' } });
      const res = makeMockRes();
      const next = vi.fn();

      await authController.loginHospital(req, res, next);

      expectHttpError(next, 400);
    });
  });

  describe('FCM Token Endpoints', () => {
    it('registerFcmToken returns 200 on success', async () => {
      const req = makeMockReq({
        user: { userId },
        body: { fcmToken: 'fcm_token_123' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      authService.registerFcmToken.mockResolvedValue({ registered: true });

      await authController.registerFcmToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('registerFcmToken returns 400 when token missing', async () => {
      const req = makeMockReq({
        user: { userId },
        body: {},
      });
      const res = makeMockRes();
      const next = vi.fn();

      authService.registerFcmToken.mockRejectedValue(new Error(ERR.FCM_TOKEN_REQUIRED));

      await authController.registerFcmToken(req, res, next);

      expectHttpError(next, 400);
    });
  });
});
