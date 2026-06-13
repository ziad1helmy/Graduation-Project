/**
 * Donor guard utilities — extract the repeated opt-in/location/active-appointment
 * guard logic from donor-facing endpoints into reusable helpers.
 *
 * The guard enforces (in order):
 *   1. Donor must exist (404).
 *   2. If opted out, return an empty list response with no error.
 *   3. If no location, return 422 LOCATION_REQUIRED.
 *   4. If has an active appointment, return an empty list with ACTIVE_APPOINTMENT_EXISTS.
 *
 * Callers compose the helper with the appropriate response shape.
 */

import Appointment from '../models/Appointment.model.js';
import { extractLocation } from '../utils/geo.js';
import response from '../utils/response.js';
import { paginationMeta } from '../utils/pagination.js';

/**
 * Run the standard donor guard checks. Returns one of:
 *   - { kind: 'not-found', message: 'Donor not found' }
 *   - { kind: 'opted-out',   buildResponse: (page, limit) => response payload }
 *   - { kind: 'no-location', response: built 422 LOCATION_REQUIRED }
 *   - { kind: 'active-appt', buildResponse: (page, limit) => response payload }
 *   - { kind: 'ok' }
 */
export const checkDonorMatchGuard = async (donor) => {
  if (!donor) {
    return { kind: 'not-found' };
  }
  if (donor.isOptedIn === false) {
    return { kind: 'opted-out' };
  }
  if (!extractLocation(donor, 'donor')) {
    return { kind: 'no-location' };
  }

  const activeAppointments = await Appointment.find({
    donorId: donor._id,
    status: { $in: ['pending', 'confirmed'] },
  });
  if (activeAppointments.length > 0) {
    return { kind: 'active-appt' };
  }
  return { kind: 'ok' };
};

/**
 * Standard "opted out" empty-list response.
 */
export const optedOutResponse = (res, listKey, page, limit, successMessage) =>
  response.success(res, 200, successMessage, {
    [listKey]: [],
    pagination: paginationMeta(0, page, limit),
  });

/**
 * Standard "active appointment" empty-list response with reason.
 */
export const activeAppointmentResponse = (res, listKey, page, limit, successMessage) =>
  response.success(res, 200, successMessage, {
    [listKey]: [],
    pagination: paginationMeta(0, page, limit),
    reason: 'ACTIVE_APPOINTMENT_EXISTS',
    message: 'You have an active appointment. Complete or cancel it to see new requests.',
  });
