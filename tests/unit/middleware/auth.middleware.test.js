import { describe, it, expect, vi } from 'vitest';
import authMiddleware from '../../../src/middlewares/auth.middleware.js';

// Mock response helper
const sendMock = vi.fn();
const res = {
  status: vi.fn(() => res),
  json: sendMock,
};

// Helper to capture next calls
const next = vi.fn();

vi.mock('../../../src/utils/response.js', () => ({
  default: {
    error: vi.fn((resObj, status, message) => {
      resObj.status(status).json({ message });
    }),
  },
}));

vi.mock('../../../src/utils/jwt.js', () => ({
  verifyToken: vi.fn((token) => {
    if (token === 'expired') {
      const err = new Error('expired');
      err.name = 'TokenExpiredError';
      throw err;
    }
    if (token === 'invalid') {
      const err = new Error('invalid');
      err.name = 'JsonWebTokenError';
      throw err;
    }
    return { userId: '507f1f77bcf86cd799439011', iat: Math.floor(Date.now() / 1000) };
  }),
  TokenExpiredError: class TokenExpiredError extends Error {},
  JsonWebTokenError: class JsonWebTokenError extends Error {},
}));

vi.mock('../../../src/models/User.model.js', () => ({
  default: {
    findById: vi.fn((id) => ({
      select: vi.fn(() => ({
        // default mocked user
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'test@example.com',
        fullName: 'Test User',
        isEmailVerified: true,
        role: 'donor',
        isSuspended: false,
        deletedAt: null,
        passwordChangedAt: null,
      })),
    })),
  },
}));

describe('Auth middleware', () => {
  it('rejects missing Authorization header', async () => {
    const req = { headers: {} };
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects malformed Authorization header', async () => {
    const req = { headers: { authorization: 'BadToken' } };
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects expired token', async () => {
    const req = { headers: { authorization: 'Bearer expired' } };
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();
  });

  it('rejects invalid token', async () => {
    const req = { headers: { authorization: 'Bearer invalid' } };
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('attaches user and calls next on valid token', async () => {
    const req = { headers: { authorization: 'Bearer goodtoken' } };
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeTruthy();
    expect(req.user.email).toBe('test@example.com');
  });
});
