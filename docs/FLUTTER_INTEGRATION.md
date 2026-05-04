# LifeLink Flutter Integration Guide

This document serves as the primary developer contract between the LifeLink Node.js Backend and the Flutter Client Application. 

## 1. Base Configuration

- **Base URL (Local)**: `http://localhost:5000` or `http://10.0.2.2:5000` (for Android Emulator)
- **Base URL (Production)**: `https://graduation-project-cy61.onrender.com`
- **Swagger Documentation**: Accessible at `http://localhost:5000/api-docs`. This is the absolute source of truth for all request/response schemas.

### Required Headers
```http
Content-Type: application/json
Authorization: Bearer <accessToken>
```
*(Note: Exclude the Authorization header for public endpoints like login and signup).*

---

## 2. Authentication Flow

The backend employs a Dual-Token JWT strategy (Access Token + Refresh Token).

### Step-by-Step Flow
1. **Login/Signup**: Call `POST /auth/login`. 
2. **Secure Storage**: Extract `accessToken` and `refreshToken` from the response. Store them using `flutter_secure_storage`.
3. **Session Usage**: Attach `Authorization: Bearer <accessToken>` to all protected API calls.
4. **Token Refresh**: Access tokens expire quickly (e.g., 15m). When you receive a `401 Unauthorized`, automatically call `POST /auth/refresh-token` sending the `refreshToken` in the body. Update your stored tokens and retry the failed request.
5. **Logout**: Call `POST /auth/logout` sending the `refreshToken` to blacklist it, then clear your local secure storage.

### 2FA & OTP
If a user has 2FA enabled, the login response will return `requires2FA: true` and a `tempToken`. Use this `tempToken` to hit `POST /auth/2fa/verify` with the user's OTP code to receive the final access tokens.

---

## 3. Donor Flow

Donors interact with requests and manage their profile.

- **Discovery**: Use `GET /donor/requests` to view available hospital requests. The backend automatically filters this based on the donor's blood type and ranks them via the Haversine geo-scoring algorithm.
- **Matching & Responses**: Use `POST /donor/respond/:requestId` to accept a request and propose an appointment time.
- **Availability**: Use `PUT /donor/availability` to toggle the `isAvailable` flag.
- **History**: Fetch past activity using `GET /donor/history`.

---

## 4. Hospital Flow

Hospitals broadcast needs and finalize donations.

- **Creating Requests**: Use `POST /hospital/request` to broadcast a need. Use `POST /hospital/requests/create-emergency` for critical push-notified broadcasts.
- **Manage Requests**: `GET /hospital/requests` to list active requests and view donor matches.
- **Finalize Donations**: Donations use a strict state machine (`pending` → `scheduled` → `completed` or `cancelled`). Use `PUT /hospital/donations/:id/status` to mark a donation as `completed`.

---

## 5. Rewards & Gamification

Gamification is automatically handled by the backend when a donation completes.

- **Points Allocation**: When a hospital marks a donation as `completed`, the `reward.service` automatically allocates points to the donor using atomic `$inc` operations to prevent duplicates.
- **Leaderboard**: Fetch the top donors using `GET /rewards/leaderboard`.
- **Tiers**: Tiers (Bronze, Silver, Gold, Platinum) are calculated dynamically on the backend based on lifetime points.

---

## 6. Notifications

The system utilizes Firebase Cloud Messaging (FCM) for real-time alerts.

- **Device Registration**: Immediately after a successful login (or app launch), call `POST /auth/fcm-token` with the device's FCM token.
- **Structure**: Notifications contain a `type` (`match`, `request`, `milestone`, `appointment`), a `title`, and a `message`. 
- **In-App Polling**: If push notifications are disabled, you can poll `GET /notifications` to populate an in-app inbox. Use `PATCH /notifications/:id/read` to mark them as seen.

---

## 7. Error Handling

The backend strictly enforces a standardized JSON response envelope.

### Standard Response Format
```json
{
  "success": false,
  "message": "Human readable error message",
  "details": ["Optional array of validation errors"]
}
```

### Common HTTP Status Codes
- **400 Bad Request**: Validation failure (check `details` array).
- **401 Unauthorized**: Missing, invalid, or expired Access Token. Trigger your refresh flow.
- **403 Forbidden**: Valid token, but the user lacks the correct Role (e.g., a Donor trying to hit a Hospital endpoint).
- **404 Not Found**: The requested resource ID does not exist.
- **429 Too Many Requests**: Rate limit exceeded (e.g., spamming OTP resends).

---

## 8. Important Notes

- **Role-Based UI**: The `role` string (`donor`, `hospital`, `admin`) is returned in the login response. Use this to explicitly route the user to the correct Flutter dashboard.
- **Avoid Hardcoding IDs**: Never hardcode MongoDB `ObjectId` strings in the app logic. Always rely on the dynamic IDs returned in the JSON lists.
- **Use Swagger**: If this markdown document contradicts the Swagger UI (`/api-docs`), **Swagger is always correct**. It is generated directly from the backend routing code.

---

## 9. Demo Accounts

To bypass email verification and OTP loops during local UI development, run `npm run seed` on the backend terminal to generate these verified demo accounts:

- **Donor**: 
  - Email: `donor@test.com`
  - Password: `SecurePass@123`
- **Hospital**:
  - Email: `hospital@test.com`
  - Password: `SecurePass@123`

---

## 10. All Project Endpoints

Every route listed here is available under the `` prefix. Use `Authorization: Bearer <accessToken>` for protected endpoints.

### Admin
- `GET /admin/profile`
- `GET /admin/system/health`
- `GET /admin/system-health`
- `GET /admin/system-health/check`
- `POST /admin/system/maintenance`
- `GET /admin/system/maintenance`
- `POST /admin/maintenance-mode`
- `GET /admin/maintenance-mode/status`
- `GET /admin/statistics`
- `GET /admin/dashboard`
- `GET /admin/alerts`
- `GET /admin/blood-inventory-summary`
- `GET /admin/audit-logs`
- `GET /admin/donors`
- `GET /admin/hospitals`
- `GET /admin/donors/:id`
- `GET /admin/hospitals/:id`
- `GET /admin/admins`
- `GET /admin/admins/:id`
- `PUT /admin/donors/:id`
- `POST /admin/donors/:id/ban`
- `POST /admin/donors/:id/unban`
- `PUT /admin/hospitals/:id/status`
- `POST /admin/admins`
- `PUT /admin/admins/:id`
- `DELETE /admin/admins/:id`
- `GET /admin/permissions/roles`
- `GET /admin/permissions/roles/:role`
- `POST /admin/permissions/roles`
- `PUT /admin/permissions/roles/:role`
- `GET /admin/users`
- `GET /admin/users/stats`
- `POST /admin/users/hospital`
- `GET /admin/users/:id`
- `PATCH /admin/users/:id/verify`
- `PATCH /admin/users/:id/unverify`
- `PATCH /admin/users/:id/suspend`
- `PATCH /admin/users/:id/unsuspend`
- `DELETE /admin/users/:id`
- `GET /admin/requests`
- `GET /admin/requests/stats`
- `GET /admin/requests/:id`
- `GET /admin/requests/:id/donations`
- `PATCH /admin/requests/:id/fulfill`
- `PATCH /admin/requests/:id/cancel`
- `POST /admin/requests/:id/broadcast`
- `GET /admin/analytics/dashboard`
- `GET /admin/analytics/donations`
- `GET /admin/analytics/blood-types`
- `GET /admin/analytics/top-donors`
- `GET /admin/analytics/growth`
- `POST /admin/emergency/broadcast`
- `GET /admin/emergency/critical`
- `GET /admin/emergency/shortage-alerts`

### Appointment
- `POST /appointment/`
- `GET /appointment/my-appointments`
- `DELETE /appointment/:appointmentId`

### Auth
- `POST /auth/signup`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh-token`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/password-reset`
- `POST /auth/send-otp`
- `POST /auth/verify-otp`
- `POST /auth/2fa/setup`
- `POST /auth/2fa/confirm-setup`
- `POST /auth/2fa/verify`
- `POST /auth/2fa/disable`
- `GET /auth/me`
- `POST /auth/validate-token`
- `POST /auth/verify-email`
- `POST /auth/verify-email-token`
- `POST /auth/fcm-token`
- `PUT /auth/fcm-token`
- `DELETE /auth/fcm-token`

### Discovery
- `GET /discovery/`
- `GET /discovery/nearby`
- `GET /discovery/:id`

### Donation
- `GET /donation/my-appointments`
- `POST /donation/complete`

### Donor
- `GET /donor/profile`
- `PUT /donor/profile`
- `GET /donor/requests`
- `GET /donor/matches`
- `POST /donor/respond/:requestId`
- `GET /donor/donation-eligibility`
- `GET /donor/health-history`
- `PATCH /donor/health-history`
- `GET /donor/donations`
- `GET /donor/dashboard`
- `GET /donor/recent-activity`
- `GET /donor/urgent-requests`
- `GET /donor/urgent-requests/:requestId`
- `POST /donor/urgent-requests/:requestId/accept`
- `POST /donor/urgent-requests/:requestId/decline`
- `GET /donor/points`
- `GET /donor/badges`
- `GET /donor/redemptions`
- `GET /donor/notifications`
- `PATCH /donor/notifications/:id/mark-read`
- `GET /donor/history`
- `PUT /donor/availability`

### Help
- `GET /help/faq`
- `GET /help/documents/:type`

### Hospital
- `GET /hospital/profile`
- `PUT /hospital/profile`
- `POST /hospital/request`
- `POST /hospital/requests/create-emergency`
- `GET /hospital/dashboard`
- `POST /hospital/requests/:requestId/close`
- `GET /hospital/requests`
- `GET /hospital/requests/:requestId`
- `GET /hospital/requests/:requestId/responses`
- `PUT /hospital/requests/:requestId`
- `DELETE /hospital/requests/:requestId`
- `GET /hospital/donations`
- `GET /hospital/blood-bank-settings`
- `PUT /hospital/blood-bank-settings`
- `GET /hospital/blood-inventory`
- `GET /hospital/notification-preferences`
- `PUT /hospital/notification-preferences`
- `GET /hospital/reports/monthly`
- `GET /hospital/staff`
- `POST /hospital/staff`
- `DELETE /hospital/staff/:id`

### Notification
- `GET /notification/`
- `PATCH /notification/:id/read`
- `PATCH /notification/read-all`
- `GET /notification/:id`
- `DELETE /notification/:id`

### Reward
- `GET /reward/points`
- `GET /reward/`
- `GET /reward/points/history`
- `GET /reward/badges`
- `GET /reward/catalog`
- `GET /reward/history`
- `POST /reward/catalog/:rewardId/redeem`
- `POST /reward/:rewardId/redeem`
- `GET /reward/redemptions`
- `GET /reward/leaderboard`
- `POST /reward/admin/users/:userId/points/adjust`
- `PATCH /reward/admin/catalog/:rewardId/status`
- `GET /reward/admin/analytics`

### Support
- `POST /support/contact`