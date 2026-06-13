import cache from './cache.js';

const DASHBOARD_KEY = 'analytics:dashboard';
const OVERVIEW_KEY = 'analytics:overview';

export const invalidateAnalyticsCache = async () => {
  try {
    await Promise.all([cache.del(DASHBOARD_KEY), cache.del(OVERVIEW_KEY)]);
  } catch {
    // Analytics will refresh on next query
  }
};

export default invalidateAnalyticsCache;
