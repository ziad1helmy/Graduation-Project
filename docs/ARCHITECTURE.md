# LifeLink System Architecture

> Canonical architecture document. Last audited: May 2026.

---

## Overview

LifeLink is a **3-tier REST API** backend built on Node.js / Express, designed to serve mobile clients (Flutter) and web dashboards (Admin panel). It follows a strict **Controller → Service → Model** layering pattern with no business logic in controllers and no direct DB access in services without going through Mongoose models.

---

## Architectural Layers

```
┌────────────────────────────────────────────────────────────────────┐
│                        Client Layer                                │
│         Flutter Mobile App (Donor/Hospital)  |  Admin Web Panel    │
└────────────────────────────┬───────────────────────────────────────┘
                             │ HTTPS / REST JSON
┌────────────────────────────▼───────────────────────────────────────┐
│                     Middleware Layer                                │
│  helmet │ cors │ rate-limit │ maintenanceMode │ authMiddleware      │
│  roleMiddleware │ NoSQL sanitizer │ errorHandler                    │
└────────────────────────────┬───────────────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────────────┐
│                    Controller Layer (15 controllers)               │
│  HTTP request parsing │ Input validation │ Response shaping        │
│  No business logic — delegates everything to Service layer         │
└────────────────────────────┬───────────────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────────────┐
│                     Service Layer (14 services)                    │
│  Business logic │ Orchestration │ External service calls           │
│  auth, admin, matching, notification, reward, donation,            │
│  eligibility, analytics, activity, hospital, campaign,             │
│  rewardsConfig, donation, fcm utils                                │
└──────────────┬─────────────────────────────────┬───────────────────┘
               │                                 │
┌──────────────▼───────────┐     ┌───────────────▼────────────────┐
│     MongoDB (Mongoose)    │     │     External Services           │
│  25 models               │     │  Firebase FCM (push notif)      │
│  Discriminator pattern   │     │  Resend (email delivery)        │
│  Full-text + 2dsphere    │     │  (future: Redis, queues)        │
│  indexes                 │     └────────────────────────────────┘
└──────────────────────────┘
```

---

## Startup Sequence

```
server.js starts
    │
    ├── validateEnv() — fail fast if required env vars missing
    ├── connectDB()   — Mongoose connect with retry logic
    ├── seedDefaultSettings()   — system settings (maintenance_mode)
    ├── seedDefaultRewards()    — rewards config (points/tier values)
    ├── seedDefaultRolePermissions() — admin/superadmin permission matrix
    └── app.listen(PORT)
```

All seeds use `$setOnInsert` + upsert to be idempotent.

---

## Module Map

### `src/app.js` — Express Application Setup

- Registers security middleware: `helmet`, `cors`, `express-rate-limit`, `express-mongo-sanitize`
- Registers maintenance mode middleware (before all routes)
- Mounts all 18 route groups under `/api` or root prefix
- Registers global error handler as last middleware
- Handles 404 for unknown routes

### `src/config/`

| File | Purpose |
|------|---------|
| `env.js` | Loads `.env` (dev only via dotenv), exports typed `env` object |
| `db.js` | Mongoose connection with retry + graceful shutdown |
| `swagger.js` | OpenAPI spec loader and Swagger UI mount |

### `src/models/` (25 Mongoose Models)

**Discriminator hierarchy:**
```
User (base)
├── Donor      (__t: 'donor')
└── Hospital   (__t: 'hospital')
```

All three share the same `users` MongoDB collection. Role-specific fields are isolated in their discriminator schemas.

**Independent models (separate collections):**

| Model | Collection | Purpose |
|-------|-----------|---------|
| Request | requests | Blood/organ donation requests |
| Donation | donations | Donation lifecycle tracking |
| Appointment | appointments | Scheduled donation appointments |
| Notification | notifications | In-app notification inbox |
| AuditLog | auditlogs | Admin action audit trail |
| SystemSettings | systemsettings | KV store (maintenance mode, etc.) |
| RefreshTokenBlacklist | refreshtokenblacklists | Revoked refresh tokens |
| OneTimeOtp | onetimeotps | Password reset OTPs |
| TwoFactor | twofactors | 2FA secrets and backup codes |
| PointsTransaction | pointstransactions | Reward points ledger |
| RewardsConfig | rewardsconfigs | Configurable points values |
| Badge | badges | Badge definitions |
| Campaign | campaigns | Points multiplier campaigns |
| Activity | activities | Donor activity/timeline feed |
| HospitalSettings | hospitalsettings | Per-hospital config |
| RolePermission | rolepermissions | Admin role permission matrix |
| HelpDocument | helpdocuments | In-app help content |
| SupportMessage | supportmessages | User-submitted support tickets |
| WaitlistEntry | waitlistentries | Hospital waitlist slots |

### `src/controllers/` (15 Controllers)

Each controller contains only:
- Input parsing from `req.body`, `req.query`, `req.params`
- Input validation (calling validation helpers)
- Service delegation
- Response shaping via `utils/response.js`

| Controller | Handles |
|-----------|---------|
| `auth.controller.js` | Registration, login, 2FA, OTP, FCM tokens |
| `donor.controller.js` | Donor profile, requests, matches, donations, settings |
| `hospital.controller.js` | Hospital profile, requests, QR verification |
| `admin.controller.js` | All admin operations (delegating to admin service) |
| `request.controller.js` | Blood/organ request CRUD |
| `donation.controller.js` | Donation lifecycle |
| `appointment.controller.js` | Appointment booking |
| `reward.controller.js` | Points, badges, leaderboard, redemption |
| `notification.controller.js` | Notification inbox |
| `analytics.controller.js` | Donor-facing stats |
| `campaign.controller.js` | Campaign management |
| `helpDocument.controller.js` | Help content |
| `support.controller.js` | Support messages |
| `hospital.controller.js` | Hospital discovery |
| `webhook.controller.js` | Webhook receiver (stub) |

### `src/services/` (14 Services)

All business logic lives here.

| Service | Responsibility |
|---------|---------------|
| `auth.service.js` | Registration, login, 2FA, OTP, FCM token management, logout |
| `admin.service.js` | User management, audit logs, maintenance, role permissions |
| `matching.service.js` | Blood-type matrix + geo-distance donor-request matching |
| `notification.service.js` | FCM + in-app notification orchestration |
| `reward.service.js` | Points award, tier calculation, badge unlocking |
| `rewardsConfig.service.js` | Dynamic rewards configuration CRUD |
| `donation.service.js` | Donation lifecycle, eligibility delegation |
| `eligibility.service.js` | Donor eligibility rules evaluation |
| `analytics.service.js` | Dashboard metrics, trends, blood type distribution |
| `activity.service.js` | Activity log creation and retrieval |
| `campaign.service.js` | Campaign CRUD and points multiplier application |
| `hospital.service.js` | Hospital creation (admin) and profile |
| `donation.service.js` | Donation CRUD and status transitions |
| `helpDocument.service.js` | Help content CRUD |

### `src/middlewares/`

| Middleware | Purpose |
|-----------|---------|
| `auth.middleware.js` | JWT verification, user loading, suspension/soft-delete check |
| `role.middleware.js` | Role-based access control (RBAC) |
| `maintenance.middleware.js` | Blocks non-admin requests during maintenance |
| `rateLimit.middleware.js` | Three limiters: general, auth, strict-2FA |
| `error.middleware.js` | Global error handler with structured logging |

### `src/utils/`

| Utility | Purpose |
|---------|---------|
| `fcm.js` | Firebase Admin SDK wrapper, multicast batching, token cleanup |
| `jwt.js` | Token sign/verify helpers (access + refresh) |
| `mailer.js` | Email sending via Resend with branded templates |
| `response.js` | Standardized JSON response shapes |
| `logger.js` | Structured logging + security event logger |
| `errorCodes.js` | Frozen constant map of all error message strings |
| `pagination.js` | Page/skip/limit normalization + meta generation |
| `textNormalization.js` | Arabic text normalization utilities |
| `age.js` | Date-of-birth to age calculation |
| `activity.formatter.js` | Activity record → timeline display format |

---

## Data Flow: Blood Request → Donor Notification

```
1. Hospital creates blood request
   POST /hospital/requests → request.controller.createRequest
   → matchingService.findCompatibleDonors(request)
      → Blood-type compatibility matrix lookup
      → Haversine geo-distance scoring
      → Return ranked donor list
   → notificationService.broadcastRequest(donors, request)
      → Create Notification records for each donor
      → fcm.sendToMultiple(allFcmTokens, payload)
         → Firebase sends push to donor devices

2. Donor sees notification, opens app
   GET /donor/urgent-requests → donor.controller.getUrgentRequests
   (or triggered by push notification deep link)

3. Donor accepts request
   POST /donor/requests/:id/respond → donor.controller.respondToRequest
   → donationService.validateEligibility(donor, request)
   → Donation.create({ status: 'pending' })
   → notificationService.notifyMatch(hospital, donation, request)

4. Hospital verifies via QR scan
   POST /hospital/requests/:id/accept → request.controller.acceptRequest
   → QR token generated → Donation updated to 'scheduled'

5. Donation completed
   PATCH /donations/:id/complete → donation.controller.completeDonation
   → Donor.lastDonationDate updated
   → rewardService.onDonationCompleted(donorId, donationId, isEmergency)
      → Points awarded
      → Tier recalculated
      → Badges checked and unlocked
      → Activity logged
```

---

## Security Architecture

```
Layers of defense:
1. Rate Limiting     — Global (200/15m dev, 60/15m prod) + Auth (20/15m prod) + 2FA (10/15m prod)
2. Input Sanitization — express-mongo-sanitize prevents NoSQL injection
3. HTTP Security     — Helmet sets 11 security response headers
4. CORS             — Configurable origin via CORS_ORIGIN env
5. Authentication    — JWT HS256, 7d access / 30d refresh
6. Refresh Blacklist — Revoked tokens stored in MongoDB (TTL-indexed)
7. Soft Deletes     — Deleted users blocked at auth middleware
8. Suspension Check — Suspended users blocked at auth middleware
9. 2FA             — TOTP (custom HMAC-SHA1 implementation)
10. Admin Key       — Additional shared-secret required for admin login
11. Password Hashing — bcryptjs, default 10 rounds
12. OTP Hashing     — SHA-256 before storage
```

---

## Key Architectural Decisions

### Decision 1: Mongoose Discriminators for User Roles

**Why**: All three user types (donor, hospital, admin) share auth fields (email, password, FCM tokens). Using discriminators allows a single `users` collection with role-specific sub-schemas, enabling efficient auth queries without multi-collection joins.

**Trade-off**: `hospitalSchema.strict('throw')` prevents unknown fields silently — strict mode is set to `throw` rather than `true`, which means unknown fields in hospital documents raise hard errors rather than being silently stripped.

### Decision 2: Synchronous FCM Delivery

**Why**: Simplicity for an academic graduation project. No Redis dependency required.

**Risk**: Firebase SDK calls block the event loop if Firebase is slow/unavailable. This is documented as a known limitation requiring a queue-based solution for production scale.

### Decision 3: Manual Validation (No Joi/Zod)

**Why**: Team preference. All validation is in `/validation/` files that return `{ valid, errors }` shapes.

**Risk**: No runtime type inference. Validation logic can drift from actual model requirements.

### Decision 4: Custom TOTP Implementation

**Why**: Team built TOTP from scratch using Node.js `crypto` module (HMAC-SHA1, counter-based OTP).

**Trade-off**: Implements RFC 6238 logic correctly but lacks battle-hardened edge cases handled by libraries like `otplib`. Time drift window is not explicitly handled.

---

## Performance Characteristics

| Operation | Strategy |
|-----------|---------|
| Donor queries | Indexed on `bloodType`, `location`, `isAvailable`, `deletedAt` |
| Hospital queries | Indexed on `hospitalId`, `hospitalNameNormalized` |
| Request queries | Indexed on `status`, `urgency`, `bloodType`, `hospitalId` |
| Donation queries | Compound index: `donorId + status`, `requestId + status` |
| Notification queries | Indexed on `userId + isRead + createdAt` |
| Refresh token lookup | Indexed on `tokenHash`, TTL-indexed on `expiresAt` |
| OTP lookup | Indexed on `email + purpose + expiresAt` |

All pagination uses `skip + limit`. For large datasets (10k+ donors), cursor-based pagination should be implemented.

---

## Known Architectural Risks

1. **No async queue**: FCM calls are synchronous. A Firebase timeout blocks the entire request.
2. **In-memory rate limiting**: Rate limit counters reset on process restart. Redis store needed for multi-instance deployments.
3. **No 2dsphere index on Donor.location**: Geo-proximity matching uses Haversine math in application code, not MongoDB `$near` geo queries. This is less efficient for large donor pools.
4. **Duplicate `weight` field in Donor schema**: Two weight field declarations exist (lines ~80 and ~155 in Donor.model.js). This should be resolved.
5. **Leaky error messages in dev**: Some service-layer errors propagate stack traces in dev mode via the global error handler.
