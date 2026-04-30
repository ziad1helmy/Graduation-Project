import { describe, it, expect, vi, beforeEach } from 'vitest';
import maintenanceMiddleware, { invalidateMaintenanceCache } from '../../../src/middlewares/maintenance.middleware.js';

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

vi.mock('../../../src/models/SystemSettings.model.js', () => ({
  default: {
    findOne: vi.fn(({ key }) => {
      if (key === 'maintenance_mode') return { value: true };
      if (key === 'maintenance_message') return { value: 'Down for maintenance' };
      return null;
    }),
  },
}));

describe('Maintenance middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateMaintenanceCache();
  });

  it('allows admin/superadmin to bypass maintenance', async () => {
    const req = { user: { role: 'admin' } };
    await maintenanceMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 503 when maintenance mode is enabled', async () => {
    const req = { user: { role: 'donor' } };
    await maintenanceMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('fails open when settings lookup throws', async () => {
    // make the model throw
    const SystemSettings = await import('../../../src/models/SystemSettings.model.js');
    SystemSettings.default.findOne.mockImplementation(() => { throw new Error('DB down'); });

    const req = { user: { role: 'donor' } };
    await maintenanceMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
