import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/activity.service.js', () => ({
  getUserTimeline: vi.fn(),
}));

import * as activityService from '../../src/services/activity.service.js';
import * as activityController from '../../src/controllers/activity.controller.js';

const makeRes = () => {
  const res = { json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('activity.controller', () => {
  it('formats timeline activities for the UI', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00.000Z'));

    activityService.getUserTimeline.mockResolvedValue({
      activities: [
        {
          _id: '5f9d4a1b9d7c2e3c4f5a6b7c',
          type: 'donation',
          action: 'completed_donation',
          title: 'Donation Completed',
          description: 'Successfully completed donation of 1 unit(s)',
          icon: 'heart',
          createdAt: new Date('2026-05-06T12:00:00.000Z'),
          metadata: {
            hospitalName: 'Cairo Hospital',
          },
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    const req = {
      user: { userId: '507f1f77bcf86cd799439011' },
      query: { page: '1', limit: '20', type: 'donation' },
    };
    const res = makeRes();

    await activityController.getTimeline(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.activities).toEqual([
      {
        id: '5f9d4a1b9d7c2e3c4f5a6b7c',
        title: 'Donation Completed',
        hospital: 'Cairo Hospital',
        points: 200,
        createdAt: '2026-05-06T12:00:00.000Z',
        relativeTime: '3 days ago',
        type: 'donation',
        status: 'success',
        icon: 'heart',
      },
    ]);
  });

  it('rejects invalid page, limit, and type filters', async () => {
    const res = makeRes();

    await activityController.getTimeline(
      { user: { userId: '507f1f77bcf86cd799439011' }, query: { page: 'abc' } },
      res,
      vi.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: false });

    const res2 = makeRes();
    await activityController.getTimeline(
      { user: { userId: '507f1f77bcf86cd799439011' }, query: { type: 'unknown' } },
      res2,
      vi.fn()
    );

    expect(res2.status).toHaveBeenCalledWith(400);
    expect(res2.json.mock.calls[0][0].message).toContain('Invalid type');
  });
});