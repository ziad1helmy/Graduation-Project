import response from '../utils/response.js';

/**
 * Role-based access control middleware.
 * Accepts one or more allowed roles.
 *
 * @example
 * // Single role
 * requireRole('admin')
 *
 * // Multiple roles
 * requireRole('admin', 'superadmin')
 */
export default function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return response.error(res, 401, 'Unauthorized');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return response.error(res, 403, 'Forbidden');
    }

    return next();
  };
}
