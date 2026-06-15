# LifeLink REST API Reference

> All endpoints require `Authorization: Bearer <accessToken>` unless marked **Public**.  
> Base URL: `http://localhost:5000`  
> Interactive docs: `/api-docs`  
> Canonical spec: `/openapi.yaml`

---

## Auth Endpoints `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | Public | Register new donor |
| POST | `/auth/login` | Public | Donor login |
| POST | `/auth/hospital/login` | Public | Hospital login |
| POST | `/auth/admin/login` | Public | Admin login (requires adminKey) |
| POST | `/auth/logout` | Public | Logout + blacklist refresh token |
| POST | `/auth/refresh-token` | Public | Get new access token |
| POST | `/auth/forgot-password` | Public | Send password reset OTP |
| POST | `/auth/verify-otp` | Public | Validate OTP (pre-reset check) |
| POST | `/auth/reset-password` | Public | Reset password with OTP |
| POST | `/auth/verify-email` | Public | Resend email verification OTP |
| POST | `/auth/verify-email-otp` | Public | Verify email with OTP |
| POST | `/auth/change-password` | 🔒 | Change password (authenticated) |
| GET  | `/auth/me` | 🔒 | Get current user profile |
| POST | `/auth/validate-token` | 🔒 | Validate token + return user |
| POST | `/auth/fcm-token` | 🔒 | Register/append FCM token |
| PUT  | `/auth/fcm-token` | 🔒 | Replace all FCM tokens |
| DELETE | `/auth/fcm-token` | 🔒 | Remove FCM token |

### Request Bodies

**POST /auth/signup**
```json
{
  "role": "donor",
  "fullName": "Mohamed Yaser",
  "email": "donor@example.com",
  "password": "SecurePass123!",
  "phoneNumber": "01012345678",
  "dateOfBirth": "1995-05-15",
  "bloodType": "O+",
  "gender": "male",
  "location": { "coordinates": { "lat": 30.0444, "lng": 31.2357 } }
}
```

**POST /auth/login**
```json
{ "email": "donor@example.com", "password": "SecurePass123!" }
```

**POST /auth/hospital/login**
```json
{ "email": "hospital@example.com", "password": "SecurePass123!" }
```

**POST /auth/admin/login**
```json
{ "email": "admin@lifelink.com", "password": "AdminPass123!", "adminKey": "abc123def456..." }
```

---

## Donor Endpoints `/donor`

> All require donor role.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/donor/profile` | Get full donor profile with stats + badges |
| PATCH | `/donor/profile` | Update profile fields |
| GET | `/donor/dashboard` | Donor dashboard (stats, recent activity, badges) |
| GET | `/donor/requests` | Browse active requests (paginated, filtered) |
| GET | `/donor/matches` | Get requests matched to donor's blood type |
| POST | `/donor/requests/:requestId/respond` | Respond to (accept) a request |
| GET | `/donor/donations` | Donation history (paginated) |
| GET | `/donor/donations/eligibility` | Check eligibility for a request |
| PATCH | `/donor/availability` | Update availability status |
| GET | `/donor/urgent-requests` | Urgent (high/critical) requests |
| GET | `/donor/urgent-requests/:requestId` | Single urgent request details |
| POST | `/donor/urgent-requests/:requestId/decline` | Decline an urgent request |
| (removed) | `/donor/health-history` | Removed |
| GET | `/donor/settings` | Get notification settings |
| PUT | `/donor/settings` | Update notification settings |
| GET | `/donor/stats` | Donor statistics |
| GET | `/donor/recent-activity` | Recent activity feed |

### Query Parameters

**GET /donor/requests**
- `type`: `blood` | `plasma` | `platelets`
- `urgency`: `low` | `medium` | `high` | `critical`
- `page`: number (default 1)
- `limit`: number (default 10)

**GET /donor/urgent-requests**
- `page`, `limit`, `lat`, `lng` (optional: for distance calculation)

---

## Hospital Endpoints `/hospital`

> All require hospital role.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hospital/profile` | Hospital profile |
| PATCH | `/hospital/profile` | Update hospital profile |
| GET | `/hospital/settings` | Hospital settings |
| PUT | `/hospital/settings` | Update settings |
| POST | `/hospital/requests` | Create blood request |
| GET | `/hospital/requests` | List hospital's requests |
| GET | `/hospital/requests/:id` | Get request details |
| PATCH | `/hospital/requests/:id` | Update request |
| DELETE | `/hospital/requests/:id` | Cancel request |
| GET | `/hospital/requests/:id/donors` | List matched donors |
| POST | `/hospital/requests/:id/accept` | Accept a donor (QR token) |
| POST | `/hospital/requests/:id/reject-donor` | Reject a matched donor |
| GET | `/hospital/donations` | Hospital's donation history |
| GET | `/hospital/appointments` | List appointments |
| PATCH | `/hospital/appointments/:id` | Update appointment status |
| POST | `/hospital/appointments/:id/scan-qr` | Scan donor QR + complete appointment |

### Request Body: Create Request

```json
{
  "type": "blood",
  "bloodType": "O+",
  "urgency": "critical",
  "quantity": 3,
  "description": "Urgent surgery scheduled",
  "notes": "Patient has no pre-existing conditions"
}
```

---

## Requests Endpoints `/requests`

> Donor or Hospital role.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/requests` | Donor | List active requests |
| GET | `/requests/:id` | Donor/Hospital | Get request details |
| POST | `/requests/:id/accept` | Hospital | Accept donor, generate QR |
| POST | `/requests/:id/verify-qr` | Hospital | Verify QR scan |

---

## Donations Endpoints `/donations`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/donations` | Donor | List donor's donations |
| GET | `/donations/:id` | Donor/Hospital | Donation details |
| PATCH | `/donations/:id/complete` | Hospital | Mark donation complete |
| PATCH | `/donations/:id/cancel` | Donor | Cancel a donation |

---

## Appointment Endpoints `/donations/book-appointment`

> Donor role.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/donations/book-appointment` | Donor | Create a new appointment |
| PATCH | `/donations/book-appointment/:appointmentId` | Donor | Reschedule an existing appointment |
| GET | `/donations/book-appointment/my-appointments` | Donor | List donor's appointments |
| DELETE | `/donations/book-appointment/:appointmentId` | Donor | Cancel an appointment |

---

## Rewards Endpoints `/rewards`

> Donor role.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/rewards/summary` | Points balance, tier, next tier |
| GET | `/rewards/history` | Points transaction history |
| GET | `/rewards/badges` | Badge progress and status |
| GET | `/rewards/leaderboard` | Returns top N donors ranked by lifetime points |
| POST | `/rewards/redeem` | Redeem points for reward |

### Query Parameters

**GET /rewards/leaderboard**
- `limit`: number (default 10)
- `days`: number (default 30, filters donors who donated within last N days)

---

## Notifications Endpoints `/notifications`

> Donor or Hospital role.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | Get notification inbox (paginated) |
| GET | `/notifications/unread-count` | Count unread notifications |
| PATCH | `/notifications/:id/read` | Mark single notification as read |
| PATCH | `/notifications/read-all` | Mark all as read |
| DELETE | `/notifications/:id` | Delete notification |

---

## Analytics Endpoints `/analytics`

> Donor role.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/donor/stats` | Personal donation statistics |
| GET | `/analytics/donor/trends` | Personal donation trends over time |

---

## Hospitals Discovery `/hospitals`

> Public (or Donor role).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hospitals` | Search/list hospitals |
| GET | `/hospitals/:id` | Hospital public profile |

---

## Admin Endpoints `/admin`

> All require `admin` or `superadmin` role (except login).

### System
| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/login` | Admin login |
| GET | `/admin/profile` | Admin profile |
| GET | `/admin/system/health` | System health |
| POST | `/admin/system/maintenance` | Set maintenance mode |
| GET | `/admin/system/maintenance` | Get maintenance status |
| GET | `/admin/statistics` | Platform statistics |
| GET | `/admin/dashboard` | Dashboard summary |
| GET | `/admin/alerts` | Active alerts |
| GET | `/admin/blood-inventory-summary` | Blood inventory by type |
| GET | `/admin/audit-logs` | Audit log (filterable) |

### User Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | List all users (filterable) |
| GET | `/admin/users/stats` | User statistics |
| POST | `/admin/users/hospital` | Create hospital account |
| GET | `/admin/users/:id` | Get user by ID |
| PATCH | `/admin/users/:id/verify` | Verify user email |
| PATCH | `/admin/users/:id/unverify` | Unverify user email |
| PATCH | `/admin/users/:id/suspend` | Suspend user |
| PATCH | `/admin/users/:id/unsuspend` | Unsuspend user |
| DELETE | `/admin/users/:id` | Soft-delete user |
| GET | `/admin/donors` | List donors |
| PUT | `/admin/donors/:id` | Update donor |
| POST | `/admin/donors/:id/ban` | Ban donor |
| POST | `/admin/donors/:id/unban` | Unban donor |
| GET | `/admin/hospitals` | List hospitals |
| PUT | `/admin/hospitals/:id/status` | Suspend/unsuspend hospital |

### Admin Management (Superadmin Only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/admins` | List all admins |
| GET | `/admin/admins/:id` | Get admin by ID |
| POST | `/admin/admins` | Create admin |
| PUT | `/admin/admins/:id` | Update admin |
| DELETE | `/admin/admins/:id` | Delete admin |

### Request Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/requests` | List all requests |
| GET | `/admin/requests/stats` | Request statistics |
| GET | `/admin/requests/:id` | Request details |
| GET | `/admin/requests/:id/donations` | Request's donations |
| PATCH | `/admin/requests/:id/fulfill` | Mark request fulfilled |
| PATCH | `/admin/requests/:id/cancel` | Cancel request |
| POST | `/admin/requests/:id/broadcast` | Broadcast to matching donors |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/analytics/dashboard` | Dashboard summary |
| GET | `/admin/analytics/donations` | Donation trends (`?months=6`) |
| GET | `/admin/analytics/blood-types` | Blood type distribution |
| GET | `/admin/analytics/top-donors` | Top donors (`?limit=10`) |
| GET | `/admin/analytics/growth` | Growth metrics (`?months=6`) |

### Emergency
| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/emergency/broadcast` | Send emergency broadcast to donors |
| GET | `/admin/emergency/critical` | List critical requests |
| GET | `/admin/emergency/shortage-alerts` | Blood shortage alerts |

### Rewards Configuration
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/rewards/config` | Get rewards config |
| PUT | `/admin/rewards/config` | Update rewards config |

### Role Permissions (Superadmin Only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/permissions/roles` | List role permissions |
| GET | `/admin/permissions/roles/:role` | Get role permissions |
| POST | `/admin/permissions/roles` | Create role |
| PUT | `/admin/permissions/roles/:role` | Update role permissions |
| DELETE | `/admin/permissions/roles/:role` | Delete role |

---

## Help & Support Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/help` | Public | List help documents |
| GET | `/help/:id` | Public | Get help document |
| POST | `/help` | Admin | Create help document |
| PUT | `/help/:id` | Admin | Update help document |
| DELETE | `/help/:id` | Admin | Delete help document |
| POST | `/support` | 🔒 | Submit support message |
| GET | `/support` | Admin | List support messages |
| PATCH | `/support/:id` | Admin | Update support message status |

---

## Webhook Endpoint

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks` | Public | Webhook receiver ⚠️ STUB |

> ⚠️ The webhook endpoint returns 200 but has no handler logic. See KNOWN_ISSUES.md.

---

## System Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Basic health check |
| GET | `/api-docs` | Public | Swagger UI |

---

## Standard Response Format

**Success**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human-readable message",
  "data": { ... }
}
```

**Error**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error description"
}
```

**Rate Limited**
```json
{
  "success": false,
  "code": "TOO_MANY_REQUESTS",
  "message": "Too many requests, please try again later"
}
```

---

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation error |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (valid token, wrong role or suspended) |
| 404 | Not Found |
| 409 | Conflict (duplicate email, etc.) |
| 429 | Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable (maintenance mode) |
