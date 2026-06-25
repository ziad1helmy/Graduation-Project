import cache from './cache.js';

const DASHBOARD_KEY = 'analytics:dashboard:v2';
const OVERVIEW_KEY = 'analytics:overview:v2';

export const invalidateAnalyticsCache = async () => {
  try {
    await Promise.all([cache.del(DASHBOARD_KEY), cache.del(OVERVIEW_KEY)]);
  } catch {
    // Analytics will refresh on next query
  }
};

export default invalidateAnalyticsCache;
