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

<!-- Removed duplicate quick-reference table; consolidated below -->

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

## Endpoints & Examples
Below are the main endpoints with concise example requests and responses. Keep `Authorization: Bearer <accessToken>` for protected routes.

### Auth
- POST /auth/signup
  Request JSON (donor):
  ```json
  {"fullName":"Test Donor","email":"donor@test.com","password":"SecurePass@123","role":"donor","phoneNumber":"01012345678"}
  ```
  Response (201):
  ```json
  {"success":true,"message":"User registered","data":{"accessToken":"...","refreshToken":"..."}}
  ```

- POST /auth/login
  Request JSON:
  ```json
  {"email":"donor@test.com","password":"SecurePass@123"}
  ```
  Success response (2FA off):
  ```json
  {"success":true,"message":"Login successful","data":{"accessToken":"...","refreshToken":"...","user":{"_id":"...","role":"donor"}}}
  ```
  2FA challenge response:
  ```json
  {"success":true,"message":"2FA verification required","data":{"requires2FA":true,"tempToken":"..."}}
  ```

- POST /auth/refresh-token
  Request JSON:
  ```json
  {"refreshToken":"..."}
  ```
  Response (200):
  ```json
  {"success":true,"message":"Token refreshed","data":{"accessToken":"..."}}
  ```

- POST /auth/logout
  Request JSON:
  ```json
  {"refreshToken":"..."}
  ```
  Response (200):
  ```json
  {"success":true,"message":"Logged out successfully"}
  ```

### Donor (requires donor role)
- GET /donor/profile
  Response (200):
  ```json
  {"success":true,"message":"Donor profile retrieved","data":{"_id":"...","fullName":"Test Donor","email":"donor@test.com"}}
  ```

- GET /donor/requests
  Response (200):
  ```json
  {"success":true,"message":"Requests retrieved","data":{"requests":[],"pagination":{"page":1,"limit":10}}}
  ```

- POST /donor/respond/:requestId
  Request JSON:
  ```json
  {"quantity":1}
  ```
  Response (201):
  ```json
  {"success":true,"message":"Response submitted","data":{"donorId":"...","requestId":"...","status":"pending"}}
  ```

### Hospital (requires hospital role)
- POST /hospital/request
  Request JSON:
  ```json
  {"type":"blood","bloodType":"O+","urgency":"high","requiredBy":"2026-05-01T00:00:00.000Z","quantity":2}
  ```
  Response (201):
  ```json
  {"success":true,"message":"Donation request created","data":{"_id":"...","status":"pending"}}
  ```

### Discovery (public)
- GET /hospitals
  Response (200):
  ```json
  {"success":true,"message":"Hospitals list","data":{"hospitals":[],"pagination":{"page":1}}}
  ```

### Notifications (authenticated)
- GET /notifications
  Response (200):
  ```json
  {"success":true,"message":"Notifications retrieved","data":{"notifications":[],"pagination":{}}}
  ```

### Rewards
- POST /rewards/catalog/:rewardId/redeem
  Request JSON:
  ```json
  {"delivery_preference":"IN_APP"}
  ```
  Response (200):
  ```json
  {"success":true,"message":"Redemption confirmed","data":{"redemptionId":"..."}}
  ```

### Admin (admin/superadmin)
- POST /admin/users/hospital
  Request JSON:
  ```json
  {"fullName":"City Hospital","email":"hospital@test.com","password":"SecurePass@123","hospitalName":"City Hospital","hospitalId":123,"licenseNumber":"LIC-001"}
  ```
  Response (201):
  ```json
  {"success":true,"message":"Hospital created","data":{"_id":"..."}}
  ```

### Help & Support
- GET /help/faq
  Response (200): {"success":true,"message":"FAQ retrieved","data":{"faqs":[]}}

- POST /support/contact
  Request JSON:
  ```json
  {"subject":"App issue","message":"Description..."}
  ```
  Response (201):
  ```json
  {"success":true,"message":"Support request submitted"}
  ```

Notes:
- The file previously contained a short quick-reference table which was removed to avoid duplication.
- Many endpoints have compatibility aliases under `/api/v1/*` (notably `/api/v1/auth/*` and `/api/v1/hospitals`).
- For protected endpoints include `Authorization: Bearer <accessToken>` and consider `x-test-mode: true` during local E2E testing.