import SystemSettings from '../models/SystemSettings.model.js';
import response from '../utils/response.js';

/**
 * Maintenance mode middleware with in-memory caching.
 *
 * Checks if the system is in maintenance mode.
 * Admin and superadmin requests bypass maintenance mode.
 * All other requests receive 503 Service Unavailable.
 *
 * Cache refreshes every 30 seconds to avoid a DB hit on every request.
 */

let cachedMode = null;
let cachedMessage = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

export default async function maintenanceMiddleware(req, res, next) {
  try {
    // Allow admin routes to pass through regardless of maintenance mode
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
      return next();
    }

    // Refresh cache if expired
    if (Date.now() > cacheExpiry) {
      const [modeSetting, msgSetting] = await Promise.all([
        SystemSettings.findOne({ key: 'maintenance_mode' }),
        SystemSettings.findOne({ key: 'maintenance_message' }),
      ]);
      cachedMode = modeSetting?.value ?? false;
      cachedMessage = msgSetting?.value || 'System is under maintenance. Please try again later.';
      cacheExpiry = Date.now() + CACHE_TTL_MS;
    }

    if (cachedMode === true) {
      return response.error(res, 503, cachedMessage);
    }

    return next();
  } catch (error) {
    // If settings check fails, let the request through (fail-open)
    return next();
  }
}

/**
 * Invalidate the maintenance mode cache.
 * Call this from admin.service.setMaintenanceMode() to ensure
 * mode changes take effect immediately.
 */
export function invalidateMaintenanceCache() {
  cacheExpiry = 0;
}
