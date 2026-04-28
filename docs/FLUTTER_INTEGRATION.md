# LifeLink Flutter Integration

## Base URL
- Local backend: `http://localhost:5000`
- Compatibility aliases: the same auth routes are also mounted under `/api/v1/auth/*`
- Swagger UI: `http://localhost:5000/api-docs` (development only)

## Required Headers
- `Content-Type: application/json`
- `Authorization: Bearer <accessToken>` for protected endpoints
- `x-test-mode: true` is development-only and bypasses auth rate limits for E2E/local testing

## Auth Flow
1. `POST /auth/signup` or `POST /auth/register`
2. Verify email with `POST /auth/verify-email-token`
3. `POST /auth/login`
4. If login returns `requires2FA: true`, complete `POST /auth/2fa/verify`
5. Keep the access token in memory/secure storage and refresh with `POST /auth/refresh-token`
6. Register the current FCM token with `POST /auth/fcm-token` after login and on token refresh

## JWT Usage
- Access token: signed with `JWT_SECRET`, sent as `Bearer <token>`
- Refresh token: signed with `JWT_REFRESH_SECRET` or `JWT_SECRET`, sent in the request body to refresh/logout endpoints
- Tokens issued before a password reset are rejected by auth middleware

## Important Endpoints
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/signup` | Creates donor or hospital account; returns tokens and, in development, `verificationToken` |
| POST | `/auth/login` | Returns tokens when email/password are valid; returns `requires2FA` + `tempToken` when 2FA is enabled |
| POST | `/auth/refresh-token` | Exchanges a refresh token for a new access token |
| POST | `/auth/logout` | Blacklists the provided refresh token |
| POST | `/auth/verify-email` | Sends a verification email for the supplied address |
| POST | `/auth/verify-email-token` | Marks the account verified when the token is valid |
| POST | `/auth/send-otp` | Starts password-reset OTP flow |
| POST | `/auth/verify-otp` | Returns a short-lived `resetToken` |
| POST | `/auth/reset-password` | Accepts `token`/`reset_token` plus `password`/`new_password` |
| GET | `/auth/me` | Returns the authenticated user |
| POST | `/auth/2fa/setup` | Starts 2FA setup for the authenticated user |
| POST | `/auth/2fa/confirm-setup` | Confirms 2FA with `code`/`otp`/`otp_code` |
| POST | `/auth/2fa/verify` | Completes login with `tempToken` + 2FA code |
| POST | `/auth/2fa/disable` | Disables 2FA for the authenticated user |
| POST | `/auth/fcm-token` | Registers the current device FCM token |
| PUT | `/auth/fcm-token` | Replaces stored FCM tokens with the provided token |
| DELETE | `/auth/fcm-token` | Removes the provided FCM token |

## Request / Response Examples

### Login success
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "user_id": "66f100000000000000000001",
    "user_role": "donor",
    "user_name": "Test Donor",
    "user": {
      "_id": "66f100000000000000000001",
      "fullName": "Test Donor",
      "email": "donor@test.com",
      "role": "donor"
    }
  }
}
```

### 2FA login challenge
```json
{
  "success": true,
  "message": "2FA verification required",
  "data": {
    "requires2FA": true,
    "tempToken": "eyJ...",
    "message": "2FA verification required"
  }
}
```

### Refresh token
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJ...",
    "access_token": "eyJ..."
  }
}
```

### FCM token registration
```json
{
  "success": true,
  "message": "FCM token registered successfully",
  "data": {
    "fcmToken": "fcm-device-token-from-flutter",
    "tokenCount": 1
  }
}
```

### Error format
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

## Demo / Test Accounts
- Seed script: `npm run seed`
  - Donor: `donor@test.com` / `SecurePass@123`
  - Hospital: `hospital@test.com` / `SecurePass@123`
- Full demo dataset: `npm run seed-demo` also seeds additional verified demo users and hospitals

## Startup
1. `npm install`
2. Set `.env` with at least `MONGO_URI` and `JWT_SECRET`
3. Start the backend: `npm start`
4. Optional for local testing: `npm run seed`
5. Health check: `GET /health`
6. Swagger UI is only available when `NODE_ENV !== 'production'`

## Notes
- Error responses use the same envelope as success responses: `success`, `message`, and optional `details`.
- Password reset, email verification, and 2FA tokens are short-lived, purpose-scoped tokens, not normal access JWTs.

## All Endpoints
Below is a concise list of available API endpoints grouped by area. Use the `Authorization: Bearer <accessToken>` header for protected routes.

- **Auth**:
  - POST /auth/signup
  - POST /auth/register
  - POST /auth/login
  - POST /auth/logout
  - POST /auth/refresh-token
  - POST /auth/forgot-password
  - POST /auth/reset-password
  - POST /auth/send-otp
  - POST /auth/verify-otp
  - POST /auth/2fa/setup
  - POST /auth/2fa/confirm-setup
  - POST /auth/2fa/verify
  - POST /auth/2fa/disable
  - POST /auth/verify-email
  - POST /auth/verify-email-token
  - GET  /auth/me
  - POST /auth/fcm-token
  - PUT  /auth/fcm-token
  - DELETE /auth/fcm-token

- **Donor** (requires donor role):
  - GET  /donor/profile
  - PUT  /donor/profile
  - GET  /donor/requests
  - GET  /donor/matches
  - POST /donor/respond/:requestId
  - GET  /donor/history
  - PUT  /donor/availability

- **Hospital** (requires hospital role):
  - GET  /hospital/profile
  - PUT  /hospital/profile
  - POST /hospital/request
  - GET  /hospital/requests
  - GET  /hospital/requests/:requestId
  - PUT  /hospital/requests/:requestId
  - DELETE /hospital/requests/:requestId
  - GET  /hospital/donations
  - GET  /hospital/blood-bank-settings
  - PUT  /hospital/blood-bank-settings
  - GET  /hospital/notification-preferences
  - PUT  /hospital/notification-preferences
  - GET  /hospital/reports/monthly
  - GET  /hospital/staff
  - POST /hospital/staff
  - DELETE /hospital/staff/:id

- **Discovery (public)**:
  - GET /hospitals
  - GET /hospitals/nearby
  - GET /hospitals/:id

- **Notifications** (authenticated):
  - GET   /notifications
  - PATCH /notifications/:id/read
  - PATCH /notifications/read-all
  - DELETE /notifications/:id

- **Rewards** (authenticated; donor/admin sections):
  - GET  /rewards/points
  - GET  /rewards/points/history
  - GET  /rewards/badges
  - GET  /rewards/catalog
  - POST /rewards/catalog/:rewardId/redeem
  - GET  /rewards/redemptions
  - GET  /rewards/leaderboard
  - POST /rewards/admin/users/:userId/points/adjust
  - PATCH /rewards/admin/catalog/:rewardId/status
  - GET  /rewards/admin/analytics

- **Admin** (admin/superadmin):
  - GET  /admin/profile
  - GET  /admin/system/health
  - POST /admin/system/maintenance
  - GET  /admin/system/maintenance
  - GET  /admin/audit-logs
  - GET  /admin/users
  - GET  /admin/users/stats
  - POST /admin/users/hospital
  - GET  /admin/users/:id
  - PATCH /admin/users/:id/verify
  - PATCH /admin/users/:id/unverify
  - PATCH /admin/users/:id/suspend
  - PATCH /admin/users/:id/unsuspend
  - DELETE /admin/users/:id
  - GET  /admin/requests
  - GET  /admin/requests/stats
  - GET  /admin/requests/:id
  - GET  /admin/requests/:id/donations
  - PATCH /admin/requests/:id/fulfill
  - PATCH /admin/requests/:id/cancel
  - POST /admin/requests/:id/broadcast
  - GET  /admin/analytics/dashboard
  - GET  /admin/analytics/donations
  - GET  /admin/analytics/blood-types
  - GET  /admin/analytics/top-donors
  - GET  /admin/analytics/growth
  - POST /admin/emergency/broadcast
  - GET  /admin/emergency/critical
  - GET  /admin/emergency/shortage-alerts

- **Help**:
  - GET /help/faq
  - GET /help/documents/:type

- **Support**:
  - POST /support/contact

Notes:
 - Many endpoints have compatibility aliases under `/api/v1/*` (notably `/api/v1/auth/*` and `/api/v1/hospitals`).
 - For protected endpoints include `Authorization: Bearer <accessToken>` and consider `x-test-mode: true` during local E2E testing.