import { describe, it, expect, vi } from 'vitest';
import requireRole from '../../../src/middlewares/role.middleware.js';

const res = {
  status: vi.fn(() => res),
  json: vi.fn(),
};
const next = vi.fn();

vi.mock('../../../src/utils/response.js', () => ({
  default: {
    error: vi.fn((resObj, status, message) => {
      resObj.status(status).json({ message });
    }),
  },
}));

describe('Role middleware', () => {
  it('rejects when no user attached', () => {
    const middleware = requireRole('admin');
    const req = { user: null };
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects when user role not allowed', () => {
    const middleware = requireRole('admin', 'superadmin');
    const req = { user: { role: 'donor' } };
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next when role allowed (single)', () => {
    const middleware = requireRole('donor');
    const req = { user: { role: 'donor' } };
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next when role allowed (multiple)', () => {
    const middleware = requireRole('hospital', 'donor');
    const req = { user: { role: 'donor' } };
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
