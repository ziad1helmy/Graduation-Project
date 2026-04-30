# LifeLink Flutter Integration Guide

This document serves as the primary developer contract between the LifeLink Node.js Backend and the Flutter Client Application. 

## 1. Base Configuration

- **Base URL (Local)**: `http://localhost:5000` or `http://10.0.2.2:5000` (for Android Emulator)
- **API Prefix**: All routes are accessible via the `/api/v1` prefix (e.g., `/api/v1/auth/login`).
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
1. **Login/Signup**: Call `POST /api/v1/auth/login`. 
2. **Secure Storage**: Extract `accessToken` and `refreshToken` from the response. Store them using `flutter_secure_storage`.
3. **Session Usage**: Attach `Authorization: Bearer <accessToken>` to all protected API calls.
4. **Token Refresh**: Access tokens expire quickly (e.g., 15m). When you receive a `401 Unauthorized`, automatically call `POST /api/v1/auth/refresh-token` sending the `refreshToken` in the body. Update your stored tokens and retry the failed request.
5. **Logout**: Call `POST /api/v1/auth/logout` sending the `refreshToken` to blacklist it, then clear your local secure storage.

### 2FA & OTP
If a user has 2FA enabled, the login response will return `requires2FA: true` and a `tempToken`. Use this `tempToken` to hit `POST /api/v1/auth/2fa/verify` with the user's OTP code to receive the final access tokens.

---

## 3. Donor Flow

Donors interact with requests and manage their profile.

- **Discovery**: Use `GET /api/v1/donor/requests` to view available hospital requests. The backend automatically filters this based on the donor's blood type and ranks them via the Haversine geo-scoring algorithm.
- **Matching & Responses**: Use `POST /api/v1/donor/respond/:requestId` to accept a request and propose an appointment time.
- **Availability**: Use `PUT /api/v1/donor/availability` to toggle the `isAvailable` flag.
- **History**: Fetch past activity using `GET /api/v1/donor/history`.

---

## 4. Hospital Flow

Hospitals broadcast needs and finalize donations.

- **Creating Requests**: Use `POST /api/v1/hospital/request` to broadcast a need. Use `POST /api/v1/hospital/requests/create-emergency` for critical push-notified broadcasts.
- **Manage Requests**: `GET /api/v1/hospital/requests` to list active requests and view donor matches.
- **Finalize Donations**: Donations use a strict state machine (`pending` → `scheduled` → `completed` or `cancelled`). Use `PUT /api/v1/hospital/donations/:id/status` to mark a donation as `completed`.

---

## 5. Rewards & Gamification

Gamification is automatically handled by the backend when a donation completes.

- **Points Allocation**: When a hospital marks a donation as `completed`, the `reward.service` automatically allocates points to the donor using atomic `$inc` operations to prevent duplicates.
- **Leaderboard**: Fetch the top donors using `GET /api/v1/rewards/leaderboard`.
- **Tiers**: Tiers (Bronze, Silver, Gold, Platinum) are calculated dynamically on the backend based on lifetime points.

---

## 6. Notifications

The system utilizes Firebase Cloud Messaging (FCM) for real-time alerts.

- **Device Registration**: Immediately after a successful login (or app launch), call `POST /api/v1/auth/fcm-token` with the device's FCM token.
- **Structure**: Notifications contain a `type` (`match`, `request`, `milestone`, `appointment`), a `title`, and a `message`. 
- **In-App Polling**: If push notifications are disabled, you can poll `GET /api/v1/notifications` to populate an in-app inbox. Use `PATCH /api/v1/notifications/:id/read` to mark them as seen.

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

Every route listed here is available under the `/api/v1` prefix. Use `Authorization: Bearer <accessToken>` for protected endpoints.

### Admin
- `GET /api/v1/admin/profile`
- `GET /api/v1/admin/system/health`
- `GET /api/v1/admin/system-health`
- `GET /api/v1/admin/system-health/check`
- `POST /api/v1/admin/system/maintenance`
- `GET /api/v1/admin/system/maintenance`
- `POST /api/v1/admin/maintenance-mode`
- `GET /api/v1/admin/maintenance-mode/status`
- `GET /api/v1/admin/statistics`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/alerts`
- `GET /api/v1/admin/blood-inventory-summary`
- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/donors`
- `GET /api/v1/admin/hospitals`
- `GET /api/v1/admin/donors/:id`
- `GET /api/v1/admin/hospitals/:id`
- `GET /api/v1/admin/admins`
- `GET /api/v1/admin/admins/:id`
- `PUT /api/v1/admin/donors/:id`
- `POST /api/v1/admin/donors/:id/ban`
- `POST /api/v1/admin/donors/:id/unban`
- `PUT /api/v1/admin/hospitals/:id/status`
- `POST /api/v1/admin/admins`
- `PUT /api/v1/admin/admins/:id`
- `DELETE /api/v1/admin/admins/:id`
- `GET /api/v1/admin/permissions/roles`
- `GET /api/v1/admin/permissions/roles/:role`
- `POST /api/v1/admin/permissions/roles`
- `PUT /api/v1/admin/permissions/roles/:role`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/stats`
- `POST /api/v1/admin/users/hospital`
- `GET /api/v1/admin/users/:id`
- `PATCH /api/v1/admin/users/:id/verify`
- `PATCH /api/v1/admin/users/:id/unverify`
- `PATCH /api/v1/admin/users/:id/suspend`
- `PATCH /api/v1/admin/users/:id/unsuspend`
- `DELETE /api/v1/admin/users/:id`
- `GET /api/v1/admin/requests`
- `GET /api/v1/admin/requests/stats`
- `GET /api/v1/admin/requests/:id`
- `GET /api/v1/admin/requests/:id/donations`
- `PATCH /api/v1/admin/requests/:id/fulfill`
- `PATCH /api/v1/admin/requests/:id/cancel`
- `POST /api/v1/admin/requests/:id/broadcast`
- `GET /api/v1/admin/analytics/dashboard`
- `GET /api/v1/admin/analytics/donations`
- `GET /api/v1/admin/analytics/blood-types`
- `GET /api/v1/admin/analytics/top-donors`
- `GET /api/v1/admin/analytics/growth`
- `POST /api/v1/admin/emergency/broadcast`
- `GET /api/v1/admin/emergency/critical`
- `GET /api/v1/admin/emergency/shortage-alerts`

### Appointment
- `POST /api/v1/appointment/`
- `GET /api/v1/appointment/my-appointments`
- `DELETE /api/v1/appointment/:appointmentId`

### Auth
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh-token`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/password-reset`
- `POST /api/v1/auth/send-otp`
- `POST /api/v1/auth/verify-otp`
- `POST /api/v1/auth/2fa/setup`
- `POST /api/v1/auth/2fa/confirm-setup`
- `POST /api/v1/auth/2fa/verify`
- `POST /api/v1/auth/2fa/disable`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/validate-token`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/verify-email-token`
- `POST /api/v1/auth/fcm-token`
- `PUT /api/v1/auth/fcm-token`
- `DELETE /api/v1/auth/fcm-token`

### Discovery
- `GET /api/v1/discovery/`
- `GET /api/v1/discovery/nearby`
- `GET /api/v1/discovery/:id`

### Donation
- `GET /api/v1/donation/my-appointments`
- `POST /api/v1/donation/complete`

### Donor
- `GET /api/v1/donor/profile`
- `PUT /api/v1/donor/profile`
- `GET /api/v1/donor/requests`
- `GET /api/v1/donor/matches`
- `POST /api/v1/donor/respond/:requestId`
- `GET /api/v1/donor/donation-eligibility`
- `GET /api/v1/donor/health-history`
- `PATCH /api/v1/donor/health-history`
- `GET /api/v1/donor/donations`
- `GET /api/v1/donor/dashboard`
- `GET /api/v1/donor/recent-activity`
- `GET /api/v1/donor/urgent-requests`
- `GET /api/v1/donor/urgent-requests/:requestId`
- `POST /api/v1/donor/urgent-requests/:requestId/accept`
- `POST /api/v1/donor/urgent-requests/:requestId/decline`
- `GET /api/v1/donor/points`
- `GET /api/v1/donor/badges`
- `GET /api/v1/donor/redemptions`
- `GET /api/v1/donor/notifications`
- `PATCH /api/v1/donor/notifications/:id/mark-read`
- `GET /api/v1/donor/history`
- `PUT /api/v1/donor/availability`

### Help
- `GET /api/v1/help/faq`
- `GET /api/v1/help/documents/:type`

### Hospital
- `GET /api/v1/hospital/profile`
- `PUT /api/v1/hospital/profile`
- `POST /api/v1/hospital/request`
- `POST /api/v1/hospital/requests/create-emergency`
- `GET /api/v1/hospital/dashboard`
- `POST /api/v1/hospital/requests/:requestId/close`
- `GET /api/v1/hospital/requests`
- `GET /api/v1/hospital/requests/:requestId`
- `GET /api/v1/hospital/requests/:requestId/responses`
- `PUT /api/v1/hospital/requests/:requestId`
- `DELETE /api/v1/hospital/requests/:requestId`
- `GET /api/v1/hospital/donations`
- `GET /api/v1/hospital/blood-bank-settings`
- `PUT /api/v1/hospital/blood-bank-settings`
- `GET /api/v1/hospital/blood-inventory`
- `GET /api/v1/hospital/notification-preferences`
- `PUT /api/v1/hospital/notification-preferences`
- `GET /api/v1/hospital/reports/monthly`
- `GET /api/v1/hospital/staff`
- `POST /api/v1/hospital/staff`
- `DELETE /api/v1/hospital/staff/:id`

### Notification
- `GET /api/v1/notification/`
- `PATCH /api/v1/notification/:id/read`
- `PATCH /api/v1/notification/read-all`
- `GET /api/v1/notification/:id`
- `DELETE /api/v1/notification/:id`

### Reward
- `GET /api/v1/reward/points`
- `GET /api/v1/reward/`
- `GET /api/v1/reward/points/history`
- `GET /api/v1/reward/badges`
- `GET /api/v1/reward/catalog`
- `GET /api/v1/reward/history`
- `POST /api/v1/reward/catalog/:rewardId/redeem`
- `POST /api/v1/reward/:rewardId/redeem`
- `GET /api/v1/reward/redemptions`
- `GET /api/v1/reward/leaderboard`
- `POST /api/v1/reward/admin/users/:userId/points/adjust`
- `PATCH /api/v1/reward/admin/catalog/:rewardId/status`
- `GET /api/v1/reward/admin/analytics`

### Support
- `POST /api/v1/support/contact`