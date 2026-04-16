# Authentication Implementation Guide

Last Updated: April 16, 2026

## Scope

This guide reflects the current implemented authentication behavior.

## Implemented Auth Endpoints

| Method | Path | Current Behavior |
|---|---|---|
| POST | /auth/signup | Registers donor/hospital, issues tokens, creates verification token, sends verification email |
| POST | /auth/login | Validates credentials and blocks unverified accounts |
| POST | /auth/logout | Blacklists refresh token hash with TTL-backed expiry |
| POST | /auth/refresh-token | Verifies refresh token, denies blacklisted/stale tokens, returns new access token |
| POST | /auth/forgot-password | Non-enumerating response; sends reset email only when account exists |
| POST | /auth/reset-password | Validates reset token, updates password, clears reset fields, invalidates old sessions |
| GET | /auth/me | Returns authenticated user payload |
| GET | /auth/verify-email | Generates and sends verification email |
| GET | /auth/verify-email-token | Verifies email token and marks account as verified |

## Security Behaviors

1. Passwords are hashed by model middleware (bcrypt pre-save).
2. Verification and reset tokens are stored as SHA-256 hashes.
3. Verification and reset tokens expire and are rejected after expiry.
4. Refresh-token blacklist prevents reuse after logout.
5. `passwordChangedAt` invalidates access/refresh tokens issued before password reset.
6. Forgot-password endpoint avoids user enumeration.
7. Rate limiting applies in production with a dev-only test bypass header (`x-test-mode: true`).

## Email Behavior

- SMTP is used when configured.
- Verification and reset emails use HTML templates.
- `EMAIL_LOGO_URL` controls branding image in templates.
- In development, if SMTP is not configured, email send can be skipped while preserving testability.

## Validation Coverage for Signup

### Base fields

- fullName required with length checks.
- email required with format checks.
- password required with complexity rules.
- role required and restricted to donor or hospital.

### Donor-specific fields

- phoneNumber required, 10-digit validation.
- dateOfBirth required and must be in the past.
- gender optional with enum validation.

### Hospital-specific fields

- hospitalName required.
- hospitalId required numeric.
- licenseNumber required.

## Notes

- Verify-email routes are intentionally GET and consume query params (`email`, `token`).
- Use `npm run test:auth-flow` for auth regression checks.
