import { vi } from 'vitest';

/**
 * Creates a mock Express response object with chainable spy methods.
 * @returns {object} Mock Express response
 */
export const makeMockRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res;
};

/**
 * Creates a mock Express request object with custom overrides.
 * @param {object} [overrides={}] - Overrides for body, query, params, user, headers, etc.
 * @returns {object} Mock Express request
 */
export const makeMockReq = (overrides = {}) => {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    user: null,
    originalUrl: '/test',
    ...overrides,
  };
};

/**
 * Generates a mock user object for auth contexts.
 * @param {object} [overrides={}] - Custom user property overrides
 * @returns {object} Mock user
 */
export const mockUser = (overrides = {}) => {
  return {
    _id: '507f1f77bcf86cd799439011',
    email: 'mockuser@example.com',
    fullName: 'Mock User',
    role: 'donor',
    isEmailVerified: true,
    ...overrides,
  };
};
