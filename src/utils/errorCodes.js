/**
 * Centralised error message constants.
 *
 * Using constants instead of raw strings prevents typo-induced bugs
 * when controllers match `error.message` against service-layer throws.
 * If a message ever needs to change, it only changes in ONE place.
 *
 * Convention:
 *   ERR.<DOMAIN>_<CONDITION>
 *   e.g.  ERR.AUTH_INVALID_CREDENTIALS
 */

export const ERR = Object.freeze({
  // ── Validation ──────────────────────────────
  VALIDATION_ERROR:                'Validation failed',
  VALIDATION_FAILED:               'One or more fields failed validation',

  // ── Authentication ──────────────────────────
  AUTH_INVALID_CREDENTIALS:        'Invalid credentials',
  AUTH_ACCOUNT_SUSPENDED:          'Account is suspended. Contact support.',
  AUTH_ACCOUNT_BANNED:             'Account banned',
  AUTH_EMAIL_NOT_VERIFIED:         'Email address is not verified',
  AUTH_INVALID_ROLE:               'Invalid role for this account',

  AUTH_INVALID_ADMIN_CODE:         'Invalid admin code',
  AUTH_REFRESH_TOKEN_REQUIRED:     'Refresh token is required',
  AUTH_REFRESH_TOKEN_INVALID:      'Invalid refresh token',
  AUTH_RESET_TOKEN_INVALID:        'Invalid or expired reset token',
  AUTH_INVALID_PASSWORD:           'Invalid password',
  AUTH_CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
  AUTH_INVALID_ADMIN_KEY:          'Invalid admin key',
  AUTH_USER_NOT_FOUND:             'User not found',
  AUTH_ACCOUNT_NOT_FOUND:          'Account not found',
  AUTH_VERIFICATION_TOKEN_INVALID: 'Invalid or expired verification token',

  // ── Registration ────────────────────────────
  EMAIL_ALREADY_EXISTS:            'Email is already registered',
  UNDERAGE_DONOR:                  'eligibility.minimumAge',
  LOCATION_INVALID_PAIR:           'Both lat and lng must be provided together',
  LOCATION_OUT_OF_RANGE:           'Coordinates are outside valid range',

  // ── Donor Eligibility ───────────────────────
  DONOR_NOT_ELIGIBLE:              'eligibility.donorNotEligible',
  DONOR_LOW_HEMOGLOBIN:            'eligibility.hemoglobinBelowMinimum',
  DONOR_TRAVEL_DEFERRAL:           'eligibility.travelDeferral',
  DONOR_TEMPORARY_DEFERRAL:        'eligibility.temporarilyDeferred',
  DONOR_DONATION_INTERVAL:         'eligibility.donationCooldownActive',
  DONOR_UNDERAGE:                  'eligibility.minimumAge',

  // ── FCM ─────────────────────────────────────
  FCM_TOKEN_REQUIRED:              'fcmToken is required',

  // ── OTP ─────────────────────────────────────
  OTP_INVALID:                     'Invalid OTP',
  OTP_INVALID_OR_EXPIRED:          'Invalid or expired OTP',
  OTP_ATTEMPTS_EXCEEDED:           'OTP attempts exceeded',


  // ── Admin ───────────────────────────────────
  ADMIN_CANNOT_SUSPEND:            'Cannot suspend admin accounts',
  ADMIN_CANNOT_DELETE:             'Cannot delete admin accounts',
  ADMIN_EMAIL_EXISTS:              'Email already registered',
  ADMIN_CANNOT_DELETE_SELF:        'Cannot delete your own account',
  ADMIN_EMAIL_CHANGE_VERIFY_REQUIRED: 'Email changed — check your inbox to re-verify your address',
  ADMIN_ROLE_NOT_FOUND:            'Role not found',
  ADMIN_ROLE_IS_SYSTEM:            'Cannot modify a system role',
  ADMIN_ROLE_ALREADY_EXISTS:       'Role already exists',
  DONOR_ALREADY_BANNED:            'User is already banned',
  DONOR_NOT_BANNED:                'User is not banned',

  // ── Requests ────────────────────────────────
  REQUEST_ALREADY_FULFILLED:       'Request is already fulfilled',
  REQUEST_ALREADY_CANCELLED:       'Request is already cancelled',
  REQUEST_NOT_FOUND:               'eligibility.requestNotFound',

  // ── Matching ────────────────────────────────
  DONOR_NOT_FOUND:                 'eligibility.donorNotFound',

  // ── Generic ─────────────────────────────────
  NOT_FOUND:                       'Resource not found',
  UNAUTHORIZED:                    'Unauthorized',
  FORBIDDEN:                       'Forbidden',

  // ── Appointments ──────────────────────────────
  APPOINTMENT_NOT_FOUND:           'Appointment not found',
  APPOINTMENT_ALREADY_EXISTS:      'You already have an active appointment at this hospital',
  APPOINTMENT_CANNOT_CANCEL:       'This appointment cannot be cancelled',
});

export default ERR;
