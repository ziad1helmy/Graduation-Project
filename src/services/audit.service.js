import AuditLog from '../models/AuditLog.model.js';
import { logger } from '../utils/logger.js';

/**
 * Create an audit log entry.
 *
 * This is a standalone thin wrapper around AuditLog.create().
 * It lives in its own module so any service can emit audit events
 * without depending on the heavy admin.service.js bundle.
 *
 * @param {string} adminId - Admin who performed the action
 * @param {string} action  - Action identifier (e.g. 'user.verify')
 * @param {string} [targetType] - Entity type affected
 * @param {string} [targetId]   - Entity ID affected
 * @param {Object} [changes]    - Optional field-level diff
 */
export const logAudit = async (adminId, action, targetType = null, targetId = null, changes = null) => {
  try {
    await AuditLog.create({ adminId, action, targetType, targetId, changes });
  } catch (error) {
    // Audit logging should never break the main operation
    logger.error('Audit log error', {
      message: error.message,
    });
  }
};
