import SystemSettings from '../models/SystemSettings.model.js';
import response from '../utils/response.js';

/**
 * Maintenance mode middleware.
 *
 * Checks if the system is in maintenance mode.
 * Admin and superadmin requests bypass maintenance mode.
 * All other requests receive 503 Service Unavailable.
 */
export default async function maintenanceMiddleware(req, res, next) {
  try {
    // Allow admin routes to pass through regardless of maintenance mode
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
      return next();
    }

    const setting = await SystemSettings.findOne({ key: 'maintenance_mode' });

    if (setting && setting.value === true) {
      const msgSetting = await SystemSettings.findOne({ key: 'maintenance_message' });
      const message = msgSetting?.value || 'System is under maintenance. Please try again later.';

      return response.error(res, 503, message);
    }

    return next();
  } catch (error) {
    // If settings check fails, let the request through (fail-open)
    return next();
  }
}
