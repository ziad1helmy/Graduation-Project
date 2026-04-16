# LifeLink Authentication System Overview

This document describes the implemented authentication and account-security behavior in LifeLink.

## 1. Signup

1. Client sends `POST /auth/signup` with role-specific payload (`donor` or `hospital`).
2. Input is validated by `validateRegister`.
3. User is created through discriminator model (`Donor` or `Hospital`).
4. Password is hashed by model pre-save middleware.
5. Access and refresh tokens are issued.
6. Email verification token is generated, hashed for storage, and emailed.
7. In non-production mode, `verificationToken` may be returned in response for E2E/local testing.

## 2. Email Verification

1. `GET /auth/verify-email?email=...` creates a fresh verification token and sends email.
2. `GET /auth/verify-email-token?token=...` hashes token and validates against stored hash + expiry.
3. On success:
   - account marked verified
   - verification token fields cleared
   - verification timestamp recorded
4. Login is blocked until verification succeeds.

## 3. Login

1. Client sends `POST /auth/login` with email/password.
2. Service verifies user exists, email is verified, and password matches.
3. On success, returns access token + refresh token + user payload.

## 4. Refresh Token

1. Client sends `POST /auth/refresh-token` with refresh token.
2. Service checks token hash against blacklist store.
3. Service verifies JWT with refresh secret.
4. Service validates token issue time is not older than `passwordChangedAt`.
5. On success, a new access token is issued.

## 5. Logout (Blacklist)

1. Client sends `POST /auth/logout` with refresh token.
2. Service verifies refresh token.
3. SHA-256 hash of token is upserted into blacklist collection with token expiry (`exp`) as `expiresAt`.
4. TTL index automatically removes expired blacklist entries.

## 6. Forgot Password

1. Client sends `POST /auth/forgot-password` with email.
2. Endpoint always returns success to prevent account enumeration.
3. If user exists:
   - reset token generated
   - reset token hash + expiry saved
   - password reset email sent

## 7. Reset Password

1. Client sends `POST /auth/reset-password` with reset token and new password.
2. Service hashes token and validates hash + expiry.
3. Password is updated and re-hashed by model middleware.
4. `passwordChangedAt` is updated to invalidate previously issued sessions.
5. Reset token fields are cleared.
6. Confirmation email is sent.

## Security Design

- Password hashing: bcrypt in user pre-save middleware.
- Token hashing: SHA-256 for email verification and reset tokens in database.
- Token expiration: verification and reset tokens include expiry timestamps.
- Blacklist strategy: hashed refresh tokens persisted with TTL expiry cleanup.
- Session invalidation: access/refresh tokens issued before `passwordChangedAt` are rejected.
- Rate limiting: production limit is 5 requests/minute/IP for protected route groups.

## Email Flow

- SMTP transport is used when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are configured.
- Verification and reset messages use HTML templates with bilingual layout.
- `EMAIL_LOGO_URL` controls template logo branding.
- Confirmation emails are sent after email verification and password reset.

## Development vs Production Behavior

- Development:
  - SMTP may be absent; sending can be skipped without blocking core auth flow.
  - Verification token and URL can be logged for local testing.
  - Rate limiter supports test bypass header `x-test-mode: true`.
- Production:
  - SMTP transport is expected for email operations.
  - Rate limiting is strict (`5/min/IP`) with no bypass.

## E2E Testing

Run:

`npm run test:auth-flow`

The script validates end-to-end auth behavior:

1. Signup
2. Login rejection before verification
3. Refresh flow
4. Logout blacklisting
5. Blacklisted refresh rejection
6. Email verification
7. Post-verification login

This script is useful for regression checks after auth/security changes.
