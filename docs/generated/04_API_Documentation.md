# LifeLink — API Documentation

> **Document Type:** Software Documentation  
> **Version:** 1.0  
> **Generated From:** Codebase Analysis — June 2026  

> **Complete specification:** The authoritative, machine-readable API contract is in `openapi.yaml` at the project root (318 KB). This document provides a human-readable system-level overview.  
> **Interactive docs:** Available at `http://localhost:5000/api-docs` when the server is running.

---

## 1. API Conventions

| Convention | Value |
|-----------|-------|
| Base URL | `http://localhost:5000` (development) |
| Protocol | HTTP/HTTPS REST |
| Content Type | `application/json` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Response shape | `{ success: Boolean, message: String, data: Object | null }` |
| Pagination shape | `{ data: [], total, page, limit, totalPages }` |
| No global `/api` prefix | Routes mount at `/auth`, `/donor`, `/hospital`, etc. |

**Source:** `src/utils/response.js` (response wrapper), `src/app.js` (route mounts), `AGENTS.md` Section 4.7

---

## 2. Authentication Requirements

| Route Group | Auth Required | Additional Requirement |
|------------|--------------|----------------------|
| `POST /auth/signup` | No | — |
| `POST /auth/login` | No | — |
| `POST /auth/hospital/login` | No | — |
| `POST /auth/admin/login` | No | Requires `adminKey` in body |
| `POST /auth/verify-email-otp` | No | — |
| `POST /auth/forgot-password` | No | — |
| `POST /auth/reset-password` | No | — |
| All `/donor/*` routes | Yes | Role: `donor` |
| All `/hospital/*` routes | Yes | Role: `hospital` |
| All `/admin/*` routes | Yes | Role: `admin` or `superadmin` |
| All `/rewards/*` routes | Yes | Role: `donor` |
| All `/requests/*` routes | Yes | Varies by endpoint |
| All `/donations/*` routes | Yes | Varies by endpoint |
| All `/notifications/*` routes | Yes | — |
| All `/analytics/*` routes | Yes | — |
| `GET /hospitals/*` (discovery) | Yes | — |
| `GET /help/*` | No | Public |
| `POST /support` | Yes | — |

**Source:** `src/middlewares/auth.middleware.js`, `src/app.js` middleware chains per route

---

## 3. API Groups

### 3.1 Authentication — `/auth`

Handles user identity and session management.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/auth/signup` | Register a new donor account | None |
| `POST` | `/auth/login` | Login (donor) | None |
| `POST` | `/auth/hospital/login` | Login (hospital) | None |
| `POST` | `/auth/admin/login` | Login (admin/superadmin) + adminKey | None |
| `POST` | `/auth/verify-email` | Request email OTP | None |
| `POST` | `/auth/verify-email-otp` | Verify email with OTP code | None |
| `POST` | `/auth/logout` | Logout + blacklist refresh token | Bearer |
| `POST` | `/auth/refresh-token` | Exchange refresh token for new access token | None |
| `POST` | `/auth/forgot-password` | Request password reset OTP email | None |
| `POST` | `/auth/reset-password` | Reset password with OTP | None |
| `POST` | `/auth/change-password` | Change password (authenticated) | Bearer |
| `POST` | `/auth/validate-token` | Check if access token is valid | Bearer |
| `POST` | `/auth/fcm-token` | Register FCM device token | Bearer |
| `DELETE` | `/auth/fcm-token` | Remove FCM device token | Bearer |

**Token TTLs:** Access token: 7 days (default). Refresh token: 30 days (default). Both configurable via env vars.

**Source:** `src/routes/auth.routes.js`, `src/services/auth.service.js`

---

### 3.2 Donor — `/donor`

Donor profile, blood request interaction, matches, and health data.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/donor/profile` | Get authenticated donor's profile |
| `PUT` | `/donor/profile` | Update donor profile |
| `DELETE` | `/donor/profile` | Soft-delete donor account |
| `GET` | `/donor/matches` | Get compatible open blood requests (matching engine) |
| `GET` | `/donor/dashboard` | Donor dashboard summary |
| `POST` | `/donor/availability` | Toggle donation opt-in/opt-out |
| `GET` | `/donor/eligibility` | Check current donation eligibility |
| `GET` | `/donor/health-history` | Get health history |
| `PUT` | `/donor/health-history` | Update health history |
| `GET` | `/donor/donations` | List donor's donation history |
| `GET` | `/donor/activity` | Donor activity/timeline feed |

**Source:** `src/routes/donor.routes.js`, `src/controllers/donor.controller.js`

---

### 3.3 Hospital — `/hospital`

Hospital profile, settings, and blood request management.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/hospital/profile` | Get hospital profile |
| `PUT` | `/hospital/profile` | Update hospital profile |
| `GET` | `/hospital/settings` | Get hospital settings |
| `PUT` | `/hospital/settings` | Update hospital settings |
| `GET` | `/hospital/requests` | List hospital's blood requests |
| `GET` | `/hospital/blood-inventory` | Get blood bank inventory summary |
| `GET` | `/hospital/reports/monthly` | Monthly donation report |
| `GET` | `/hospital/staff` | List hospital staff |

**Source:** `src/routes/hospital.routes.js`, `src/controllers/hospital.controller.js`

---

### 3.4 Blood Requests — `/requests`

Full request lifecycle from creation to completion.

| Method | Path | Description | Auth Role |
|--------|------|-------------|-----------|
| `POST` | `/requests` | Create a new blood request | hospital |
| `GET` | `/requests` | List all open requests (paginated) | any |
| `GET` | `/requests/nearby` | Nearby requests with geo filter | donor |
| `GET` | `/requests/accepted` | Donor's accepted requests | donor |
| `GET` | `/requests/:id` | Get single request detail | any |
| `PUT` | `/requests/:id` | Update request | hospital |
| `DELETE` | `/requests/:id` | Cancel request | hospital |
| `POST` | `/requests/:id/accept` | Donor accepts (creates Donation) | donor |
| `POST` | `/requests/:id/decline` | Donor declines request | donor |
| `POST` | `/requests/:id/confirm` | Hospital confirms donor arrival + QR check | hospital |
| `POST` | `/requests/:id/close` | Hospital closes fulfilled request | hospital |
| `POST` | `/requests/:id/broadcast` | Admin broadcasts request to eligible donors | admin |
| `POST` | `/requests/:id/expire-arrival` | Admin manually expires a no-show donation | admin |

**Source:** `src/routes/request.routes.js`, `src/controllers/request.controller.js`

---

### 3.5 Donations — `/donations`

Donation completion and appointment booking.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/donations/book-appointment` | Book a new donation appointment |
| `GET` | `/donations/book-appointment/available-slots` | Get available time slots for a hospital on a date |
| `GET` | `/donations/book-appointment` | List donor's appointments |
| `GET` | `/donations/book-appointment/:appointmentId` | Get single appointment |
| `PATCH` | `/donations/book-appointment/:appointmentId` | Reschedule existing appointment |
| `DELETE` | `/donations/book-appointment/:appointmentId` | Cancel appointment |
| `POST` | `/donations/:donationId/complete` | Complete a donation (hospital-side) |

**Source:** `src/routes/appointment.routes.js`, `src/routes/donation.routes.js`

---

### 3.6 Appointment Verification — `/appointments`

QR code scanning and on-site verification flow.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/appointments/verify-qr` | Hospital scans donor QR code |
| `POST` | `/appointments/:id/verify` | Complete verification checklist |
| `POST` | `/appointments/:id/reject` | Reject donor at appointment |

**Source:** `src/routes/appointmentVerify.routes.js`, `src/controllers/appointment.controller.js`

---

### 3.7 Rewards — `/rewards`

Points, tiers, badges, leaderboard, and reward redemption.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rewards/points` | Donor's current points and tier |
| `GET` | `/rewards/history` | Points transaction history |
| `GET` | `/rewards/earning-rules` | View points earning rules |
| `GET` | `/rewards/catalog` | Redeemable reward catalog |
| `POST` | `/rewards/redeem` | Redeem points for a reward |
| `GET` | `/rewards/redemptions` | Donor's redemption history |
| `GET` | `/rewards/badges` | All badges with unlock status |
| `GET` | `/rewards/leaderboard` | Leaderboard (top donors by points) |
| `GET` | `/badges` | Alias → `/rewards/badges` |

**Source:** `src/routes/reward.routes.js`, `src/controllers/reward.controller.js`, `src/app.js` alias

---

### 3.8 Notifications — `/notifications`

In-app notification inbox.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/notifications` | List notifications (paginated, with unread count) |
| `PATCH` | `/notifications/:id/read` | Mark notification as read |
| `PATCH` | `/notifications/read-all` | Mark all notifications as read |

**Source:** `src/routes/notification.routes.js`, `src/controllers/notification.controller.js`

---

### 3.9 Analytics — `/analytics`

Statistics and leaderboard data.

| Method | Path | Description | Auth Role |
|--------|------|-------------|-----------|
| `GET` | `/analytics/my-stats` | Donor's personal lifetime stats | donor |
| `GET` | `/analytics/leaderboard` | Top donors leaderboard | any |
| `GET` | `/analytics/donation-types` | System-wide donation type distribution | any |
| `GET` | `/analytics/dashboard` | Admin system metrics | admin |

**Source:** `src/routes/analytics.routes.js`, `src/controllers/analytics.controller.js`

---

### 3.10 Hospital Discovery — `/hospitals`

Search and discover nearby hospitals.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/hospitals` | Search hospitals (with geo distance) |
| `GET` | `/hospitals/:id` | Get single hospital detail |

**Source:** `src/routes/discovery.routes.js`, `src/controllers/discovery.controller.js`

---

### 3.11 Admin — `/admin`

Full system management. All routes require `admin` or `superadmin` role.

**User Management:**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/users` | List all users (paginated, filterable) |
| `GET` | `/admin/users/:id` | Get user detail |
| `PUT` | `/admin/users/:id` | Update user |
| `DELETE` | `/admin/users/:id` | Soft-delete user |
| `POST` | `/admin/users/:id/suspend` | Suspend user account |
| `POST` | `/admin/users/:id/restore` | Restore suspended/deleted user |

**System:**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/settings` | Get system settings |
| `PUT` | `/admin/settings` | Update system settings |
| `POST` | `/admin/maintenance/enable` | Enable maintenance mode |
| `POST` | `/admin/maintenance/disable` | Disable maintenance mode |
| `GET` | `/admin/health` | System health check |
| `GET` | `/admin/audit-log` | View audit log |

**Rewards Administration:**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/rewards/config` | Get rewards configuration |
| `PUT` | `/admin/rewards/config` | Update rewards configuration |
| `POST` | `/admin/rewards/catalog` | Add reward to catalog |
| `PUT` | `/admin/rewards/catalog/:id` | Update catalog item |
| `DELETE` | `/admin/rewards/catalog/:id` | Remove catalog item |

**Source:** `src/routes/admin.routes.js`, `src/controllers/admin.controller.js`

---

### 3.12 Help & Support

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/help` | List help documents | None |
| `GET` | `/help/:id` | Get help document | None |
| `POST` | `/support` | Submit support message | Bearer |

**Source:** `src/routes/help.routes.js`, `src/routes/support.routes.js`

---

### 3.13 Webhooks — `/api/webhooks`

> **Note from `README.md`:** The webhook endpoint exists but contains **no handler logic** (stub). No functional behavior is implemented.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhooks` | External webhook receiver (stub) |

**Source:** `src/routes/webhook.routes.js`, `README.md` Core Features table

---

## 4. Request Lifecycle — Full Flow

When a donor accepts a blood request:

```
POST /requests/:id/accept
  → authMiddleware (JWT check)
  → requireRole('donor')
  → rateLimiter
  → request.controller.acceptRequest()
    → eligibilityService.canDonate(donor)   [eligibility check]
    → matchingService.validateCompatibility() [blood type check]
    → Donation.create({ status: 'pending', qrToken: <uuid> })
    → Request.updateOne({ $inc: { unitsAccepted: 1 } })
    → notificationService.notifyMatch(hospital, donation, request)
      → Notification.create() [in-app]
      → fcm.sendToMultiple(hospital.fcmTokens) [push]
  → response.success(res, 201, 'Donation accepted', { donation })
```

---

## 5. Error Response Format

All errors follow the standard wrapper:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "details": { "field": "validation error" }
}
```

**HTTP Status Code Taxonomy:**

| Code | Use Case |
|------|---------|
| 200 | Successful read or update |
| 201 | Resource created |
| 204 | Successful delete (no body) |
| 400 | Malformed or invalid input |
| 401 | Missing or invalid auth token |
| 403 | Authenticated but unauthorized (wrong role, suspended, unverified email) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, duplicate booking) |
| 429 | Rate limited |
| 503 | Server in maintenance mode or DB degraded |

**Source:** `AGENTS.md` Section 5.2, `src/utils/response.js`, `src/middlewares/error.middleware.js`

---

## 6. Rate Limiting

Two in-memory rate limiters (not Redis-backed — resets on server restart):

| Limiter | Applied To | Limit |
|---------|-----------|-------|
| `authLimiter` | `/auth/*` | Strict (lower threshold) |
| `limiter` | All other routes | General (higher threshold) |

Exact limits are configured in `src/middlewares/rateLimit.middleware.js`. See that file for current values.

**Source:** `src/middlewares/rateLimit.middleware.js`, `src/app.js`

---

## Confidence Report

**Verified Facts:**
- All route groups come directly from `src/app.js` mount points.
- Endpoint tables were cross-referenced against the corresponding `src/routes/*.routes.js` files.
- Response format comes from `src/utils/response.js` pattern documented in `AGENTS.md`.
- Status code table comes from `AGENTS.md` Section 5.2.
- Webhook stub status comes from `README.md` Core Features table.

**Assumptions:** None.

**Missing Information:**
- Exact rate limit numbers (requests per window) were not read from `rateLimit.middleware.js`; that file is 7 KB and was not opened.
- Precise request/response body schemas for each endpoint are in `openapi.yaml` (318 KB, not read); this document provides route-level documentation only.
- Some hospital admin endpoints may exist in `admin.routes.js` (7.6 KB) that were not individually enumerated.

**Potential Uncertainty:**
- The `/donor/activity` route is mounted on the `/donor` prefix via `activity.routes.js`; its exact sub-path was inferred from context.
