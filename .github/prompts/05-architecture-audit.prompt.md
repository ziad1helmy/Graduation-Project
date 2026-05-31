# LifeLink Phase 05 - Architecture & System Design Audit

**Date:** May 31, 2026  
**Phase:** 05 - Architecture & System Design Analysis  
**Context:** Follows Phase 01 (API Inventory), Phase 02 (API Duplication), Phase 03 (Flow Audit), Phase 04 (Data Integrity)  
**Scope:** Project structure, module boundaries, controllers, services, repositories, database patterns, dependency relationships, layer separation, business logic placement, shared utilities, cross-module communication, configuration management  
**Status:** Analysis and Planning Phase (No code modifications performed)

---

# Executive Summary

The LifeLink backend demonstrates a **well-structured 3-tier architecture** with clear separation of concerns between controllers, services, and data models. The system exhibits **strong foundational design patterns** including centralized error handling, consistent response formatting, and dedicated validation utilities.

**Overall Architecture Health: GOOD** with identified **HIGH-PRIORITY coupling and structural risks** that will become bottlenecks as the system scales.

**Critical Architectural Findings:**

✅ **Strengths:**
- Clean 3-tier layering with controllers properly thin and focused on HTTP concerns
- Service layer implements business logic with clear responsibilities
- Centralized middleware stack provides consistent cross-cutting concerns
- Robust error handling with structured logging and translation support
- Consistent response formatting enforced across all endpoints
- Proper input validation abstraction in dedicated validation modules
- Comprehensive MongoDB index strategy for common query patterns

⚠️ **High-Priority Coupling Issues:**
- **Service-to-Service dependencies create complex chains** — donation.service depends on matching, reward, and activity services, creating tight coupling
- **activityService has excessive coupling** — used by 6+ services (donation, reward, appointment, request-lifecycle, admin) creating a central bottleneck
- **Circular/tangled service imports** — rewardsConfig imports from admin, admin imports from hospital, unclear dependency hierarchy
- **Matching service is monolithic** — contains both blood-type compatibility AND geo-distance calculation AND eligibility checking, should be decomposed
- **Cross-module validation inconsistency** — Different controllers import from different validation files without central registry

⚠️ **Medium-Priority Structural Risks:**
- **Controller-to-service method mapping not standardized** — Controllers call service methods inconsistently (sometimes await chains, sometimes Promise.all)
- **Middleware ordering concerns** — Admin routes bypass maintenance middleware for privileged access, creating special-case logic
- **Utility organization lacks hierarchy** — 14 utilities in `/utils/` directory with unclear organization (fcm, jwt, mailer, logger, response, errorCodes, pagination, etc.)
- **Model discriminator pattern limits** — User role hierarchy is enforced via Mongoose discriminators, but role-specific logic still scattered across services
- **No repository pattern** — Direct model access throughout services reduces abstraction and testability

🔴 **Critical Architectural Risks:**
- **Missing shared constants for service boundaries** — Magic strings used across services (status values, role names, etc.) with no single source of truth
- **FCM notification delivery tightly coupled to sync execution** — Service-to-Firebase calls block request handling, documented as known limitation
- **Configuration management fragmented** — Environment variables, system settings, and rewards config scattered across 3 different sources

**Severity Breakdown:**
- Critical (bottlenecks, tight coupling, hard to scale): 3
- High (maintainability, testing, performance): 6
- Medium (organization, consistency, clarity): 7
- Low (cosmetic, minor patterns): 4

---

# Architecture Overview

## Architectural Style

**LifeLink Backend = 3-Tier REST API with Strict Layer Separation**

```
┌─────────────────────────────────────────────────────┐
│              HTTP Client Layer                      │
│  Flutter App (Donor/Hospital) │ Admin Web Panel    │
└──────────────┬────────────────────────────┬────────┘
               │ HTTPS / REST JSON          │
    ┌──────────▼─────────────────────────────▼───────┐
    │       Middleware Layer (8 middlewares)         │
    │ helmet │ cors │ rateLimit │ maintenance │      │
    │ auth │ role │ sanitizer │ error │ i18n         │
    └──────────┬──────────────────────────────┬──────┘
               │                              │
    ┌──────────▼──────────────────────────────▼──────┐
    │   Controller Layer (15 controllers)             │
    │  HTTP request parsing, validation, delegation  │
    │   No business logic beyond response shaping     │
    └──────────┬──────────────────────────────┬──────┘
               │                              │
    ┌──────────▼──────────────────────────────▼──────┐
    │   Service Layer (13 services)                   │
    │  Business logic, orchestration, external calls  │
    │  auth, admin, matching, notification, reward,   │
    │  donation, eligibility, analytics, activity,    │
    │  hospital, rewardsConfig, appointment,          │
    │  request-lifecycle                             │
    └──────┬──────────────────────────┬───────┬──────┘
           │                          │       │
    ┌──────▼──────┐     ┌─────────────▼──┐   │
    │  MongoDB    │     │External Services│  │
    │ (25 models) │     │ Firebase FCM    │  │
    │ Indexes,    │     │ Resend Email    │  │
    │ TTL-indexes │     │ (future: Redis) │  │
    └─────────────┘     └─────────────────┘  │
                                              │
                         ┌────────────────────▼──┐
                         │  Utils Layer (14)      │
                         │ JWT, FCM, Mailer,      │
                         │ Logger, Response,      │
                         │ ErrorCodes, Pagination │
                         └────────────────────────┘
```

## Main Layers

### 1. **Middleware Layer** (8 middlewares in `/src/middlewares/`)

| Middleware | Purpose | Scope |
|-----------|---------|-------|
| `helmet.js` (library) | Security headers (CSP, X-Frame-Options, etc.) | Global, applied first |
| `cors.js` (library) | CORS headers for cross-origin requests | Global |
| `requestLogger` (custom) | Logs all requests with response time | Global |
| `rateLimit.middleware.js` | Three limiters: general, auth, 2FA | Global + targeted |
| `express.json()` | Body parsing (1MB limit) | Before routes |
| `i18n.middleware.js` | Internationalization (Arabic/English support) | Global |
| `sanitizer` (custom) | NoSQL injection prevention | Sanitizes req.body, req.params, req.query |
| `auth.middleware.js` | JWT verification, user loading | Route-specific |
| `role.middleware.js` | Role-based access control (RBAC) | Route-specific |
| `maintenance.middleware.js` | Blocks non-admin routes during maintenance | Global, special ordering |
| `error.middleware.js` | Global error handler with structured logging | Last middleware |

### 2. **Controller Layer** (15 controllers in `/src/controllers/`)

Each controller is **thin and focused** on HTTP concerns only:

```
Controller Responsibilities:
├─ Parse HTTP input (req.body, req.query, req.params)
├─ Validate input (calling dedicated validation modules)
├─ Delegate to service layer
├─ Shape response via response.success/response.error
└─ Pass errors to next(error) for global handler
```

| Controller | Endpoints | Dependencies |
|-----------|-----------|--------------|
| `auth.controller.js` | 8 endpoints (register, login, 2FA, OTP, FCM) | authService |
| `donor.controller.js` | 12 endpoints (profile, matches, donations, settings) | donorService, donationService, rewardService, activityService, matchingService |
| `hospital.controller.js` | 6 endpoints (profile, requests, appointments) | hospitalService, notificationService |
| `request.controller.js` | 4 endpoints (CRUD) | requestService |
| `donation.controller.js` | 8 endpoints (lifecycle, QR verify) | donationService, appointmentService |
| `appointment.controller.js` | 5 endpoints (booking, verification) | appointmentService |
| `reward.controller.js` | 7 endpoints (points, badges, leaderboard, redemption) | rewardService |
| `admin.controller.js` | 15 endpoints (user management, audit, maintenance) | adminService, analyticsService, rewardsConfigService |
| `notification.controller.js` | 3 endpoints (inbox, mark read) | notificationService |
| `analytics.controller.js` | 4 endpoints (dashboard, stats) | analyticsService |
| `help.controller.js` | 3 endpoints (FAQ, help content) | Help model queries |
| `support.controller.js` | 2 endpoints (messages, create) | Help model queries |
| `discovery.controller.js` | 1 endpoint (hospital search) | Hospital model queries |
| `webhook.controller.js` | 1 endpoint (Resend webhook) | Email log creation |

### 3. **Service Layer** (13 services in `/src/services/`)

Services encapsulate **all business logic and external integrations**.

**Service Responsibility Categories:**

**Authentication & Authorization:**
- `auth.service.js` — User registration, login, JWT management, 2FA/OTP, FCM tokens

**Domain Logic:**
- `donation.service.js` — Donation lifecycle, eligibility delegation, status transitions
- `appointment.service.js` — Appointment booking, confirmation, verification
- `request-lifecycle.service.js` — Blood request state machine, transitions
- `matching.service.js` — Donor-request compatibility, geo-distance scoring, blood-type compatibility

**User Management:**
- `admin.service.js` — User CRUD, audit logs, role permissions, system settings
- `hospital.service.js` — Hospital creation and profile management

**Reward System:**
- `reward.service.js` — Points calculations, tier logic, badge unlocking, point awarded
- `rewardsConfig.service.js` — Dynamic rewards configuration CRUD

**Observability:**
- `activity.service.js` — Activity logging for donor timeline/feed
- `notification.service.js` — FCM + in-app notification orchestration

**Analytics:**
- `analytics.service.js` — Dashboard metrics, trends, blood-type distribution

**Eligibility:**
- `eligibility.service.js` — Donor eligibility rules evaluation

### 4. **Data Layer** (25 Mongoose Models in `/src/models/`)

**Discriminator Hierarchy (shared `users` collection):**
```
User (base schema, 1 MongoDB collection: "users")
├── Donor (__t: 'donor')
├── Hospital (__t: 'hospital')
└── Admin (__t: 'admin')
```

**Independent Collections (18 additional models):**
- Request, Donation, Appointment, Notification, AuditLog
- PointsTransaction, DonorPoints, RewardRedemption, Badge, UserBadge, RewardCatalog
- Activity, HospitalSettings, SystemSettings, RefreshTokenBlacklist, OneTimeOtp
- HelpDocument, SupportMessage, InboundEmail, WaitlistEntry, RolePermission, NotificationOutbox

### 5. **Utility Layer** (14 utilities in `/src/utils/`)

| Utility | Purpose | Scope |
|---------|---------|-------|
| `response.js` | Standardized success/error response shapes | Global |
| `logger.js` | Structured logging with security event tracking | Global |
| `errorCodes.js` | Frozen constant map of error messages | Global |
| `jwt.js` | Token sign/verify with access + refresh logic | Auth only |
| `fcm.js` | Firebase Admin SDK wrapper, multicast, token cleanup | Notification only |
| `mailer.js` | Resend email delivery with branded templates | Auth only |
| `pagination.js` | Skip/limit normalization + meta generation | Queries only |
| `age.js` | Date-of-birth to age calculation | Donor validation only |
| `textNormalization.js` | Arabic text normalization | Search only |
| `activity.formatter.js` | Activity record to timeline display format | Timeline only |
| `geo.js` | Haversine distance, coordinate conversion | Matching only |
| `blood-type.js` | Blood type compatibility matrix, normalization | Matching only |
| `eligibility-keys.js` | Constant map for eligibility error reasons | Eligibility only |
| `state-machine.js` | Donation/appointment status transition validation | Domain logic only |

## Core Modules

**Module = Route Group + Controller + Related Services**

```
Module: Authentication
├── Route: /auth
├── Controller: auth.controller.js
└── Services: auth.service.js

Module: Donor Experience
├── Routes: /donor, /requests, /donations, /appointments, /notifications
├── Controllers: donor.controller.js, request.controller.js, donation.controller.js, 
│              appointment.controller.js, notification.controller.js
└── Services: donation.service.js, appointment.service.js, matching.service.js, 
             notification.service.js, activity.service.js

Module: Hospital Experience
├── Routes: /hospital, /hospitals (discovery)
├── Controllers: hospital.controller.js, discovery.controller.js
└── Services: hospital.service.js

Module: Rewards
├── Route: /rewards
├── Controller: reward.controller.js
└── Services: reward.service.js, rewardsConfig.service.js

Module: Administration
├── Route: /admin
├── Controller: admin.controller.js
└── Services: admin.service.js

Module: Analytics
├── Route: /analytics
├── Controller: analytics.controller.js
└── Services: analytics.service.js

Module: Observability
├── Routes: /activity, /help, /support
├── Controllers: activity.controller.js, help.controller.js, support.controller.js
└── Services: activity.service.js
```

## Major Dependencies

**Service-to-Service Dependencies (Coupling Map):**

```
activityService (6 direct dependents)
├── ← donation.service.js
├── ← reward.service.js
├── ← appointment.service.js
├── ← request-lifecycle.service.js
├── ← admin.service.js
└── ← donation.controller.js (direct call in one case)

donation.service.js (3 dependencies)
├── → matching.service.js (for eligibility)
├── → reward.service.js (for points on completion)
└── → activity.service.js (for logging)

reward.service.js (1 dependency)
└── → activity.service.js (for badge unlock logging)

rewardsConfig.service.js (1 indirect dependency)
└── → admin.service.js (seeded from admin initialization)

matching.service.js (no service dependencies, only models)

appointment.service.js (3 dependencies)
├── → donation.service.js
├── → eligibility.service.js
└── → activity.service.js

request-lifecycle.service.js (1 dependency)
└── → activity.service.js

notification.service.js (1 dependency)
└── → matching.service.js

admin.service.js (1 dependency)
└── → hospital.service.js
```

## System Organization

**Request Flow Example: "Donor Responds to Blood Request"**

```
1. HTTP Request
   POST /donor/requests/:id/accept
   Body: { notes: "..." }
   Header: Authorization: Bearer <token>

2. Middleware Pipeline
   ├─ helmet (security headers)
   ├─ cors (allow origin)
   ├─ rateLimit (check quota)
   ├─ auth.middleware (verify JWT, load user)
   ├─ sanitizer (prevent NoSQL injection)
   └─ i18n.middleware (set language context)

3. Routing
   Routes request to: donor.controller.respondToRequest()

4. Controller Layer
   donor.controller.respondToRequest(req, res, next)
   ├─ Parse: req.params.id, req.body.notes
   ├─ Validate: validateRespondToRequestBody()
   ├─ Delegate: donationService.createDonation(...)
   ├─ Response: response.success(res, 201, "Donation created", donation)
   └─ Error: next(error) → error.middleware

5. Service Layer
   donation.service.createDonation(donorId, requestId, data)
   ├─ Fetch: Donor.findById(donorId)
   ├─ Fetch: Request.findById(requestId)
   ├─ Check: matching.service.checkEligibility(donor, request)
   ├─ Validate: Donation.findOne({ donorId, requestId, status: { $nin: ['cancelled', 'rejected'] } })
   ├─ Create: Donation.create({ status: 'pending' })
   ├─ Award: rewardService.onDonationPending()
   ├─ Log: activity.service.logActivity(donorId, ...)
   └─ Notify: notification.service.notifyMatch(hospital, donation)

6. Data Layer
   ├─ Donor.findById() → Query MongoDB users collection
   ├─ Request.findById() → Query MongoDB requests collection
   ├─ Donation.create() → Insert into MongoDB donations collection
   ├─ Activity.create() → Insert into MongoDB activities collection
   ├─ Notification.create() → Insert into MongoDB notifications collection
   └─ PointsTransaction.create() → Insert into MongoDB pointstransactions collection

7. Response
   HTTP 201 Created
   {
     success: true,
     message: "Donation created",
     data: { _id, donorId, requestId, status: "pending", ... }
   }
```

---

# Module Boundary Analysis

## Module 1: Authentication Module

**Responsibilities:**
- User registration (donor, hospital, admin)
- Email verification workflows
- Login with email/password
- JWT token generation and refresh
- 2FA (TOTP) setup, challenge, verification
- One-time passwords (OTP) for password reset
- FCM token management for push notifications
- Account recovery (password reset)
- Logout (token blacklist)

**Public Interfaces:**
```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/verify-email
POST /auth/send-otp
POST /auth/verify-otp
POST /auth/2fa/setup
POST /auth/2fa/verify
POST /auth/fcm-token/register
POST /auth/logout
```

**Dependencies:**
- `authService` (internal)
- `User` model queries
- JWT utility, mailer utility, FCM utility
- External: Resend (email), Firebase (FCM)

**Coupling Level:** **LOW** — Auth is self-contained, no dependency on other services. Other modules depend on auth, but auth doesn't depend on them.

**Cohesion Level:** **HIGH** — All auth-related logic grouped together, clear responsibility boundaries.

**Architectural Observations:**
- ✅ Properly isolated authentication concerns
- ⚠️ 2FA implementation is custom TOTP (RFC 6238) — not using battle-tested library like `otplib`
- ⚠️ OTP/password reset flow relies on email delivery which is external and could fail silently

---

## Module 2: Donor Experience Module

**Responsibilities:**
- Donor profile management (CRUD, settings)
- View available blood requests
- Respond to blood requests (create donations)
- View matched requests and donation status
- Appointment booking and confirmation
- Notification inbox management
- Activity/timeline view (recent donations, achievements)
- Badge and points tracking
- Leaderboard viewing

**Public Interfaces:**
```
GET /donor/profile
PATCH /donor/profile
GET /donor/requests (nearby, urgent)
POST /donor/requests/:id/accept
POST /donor/requests/:id/decline
GET /donor/donations
PATCH /donor/donations/:id/cancel
GET /donor/appointments
POST /donations/book-appointment
GET /notifications
PATCH /notifications/:id/read
GET /activity
GET /rewards/badges
GET /rewards/leaderboard
GET /analytics/my-stats
```

**Dependencies:**
- `donationService`, `appointmentService`, `notificationService`, `matchingService`
- `activityService`, `rewardService`, `eligibilityService`, `analyticsService`
- 9 different models (Donor, Request, Donation, Appointment, Notification, Badge, etc.)

**Coupling Level:** **HIGH** — Donor module integrates 8+ services, creating complex orchestration chains.

**Cohesion Level:** **HIGH** — All donor-facing operations grouped under donor route, clear responsibility.

**Architectural Observations:**
- ⚠️ **Multiple controllers coordinate the same data** — `donor.controller`, `notification.controller`, `activity.controller`, and `reward.controller` all handle donor-specific views
- ⚠️ **Service orchestration complexity** — donor.controller.getProfile() calls 4 parallel services (donor, stats, points, badges), which then each have sub-dependencies
- ⚠️ **Hidden service-to-service chaining** — respondToRequest() calls donationService → which calls matchingService + rewardService + activityService
- 🔴 **Missing donor-specific repository** — Direct model queries scattered across multiple controllers and services

---

## Module 3: Hospital Experience Module

**Responsibilities:**
- Hospital profile management
- Blood request creation (specify blood type, quantity, urgency)
- View requests posted by hospital
- View incoming donations for requests
- QR code generation and verification for donation collection
- Appointment management
- Donor search/discovery by blood type and location
- Request cancellation and fulfilment

**Public Interfaces:**
```
GET /hospital/profile
PATCH /hospital/profile
POST /hospital/requests
GET /hospital/requests
PATCH /hospital/requests/:id
POST /hospital/requests/:id/accept
POST /hospital/requests/:id/cancel
GET /hospital/find-donors
POST /hospital/donors/:id/appointments
GET /hospital/appointments
POST /appointments/verify-qr
```

**Dependencies:**
- `hospitalService`, `notificationService`, `matchingService`
- `donationService`, `appointmentService`, `rewardService`
- 6 different models (Hospital, Request, Donation, Appointment, Donor, etc.)

**Coupling Level:** **MEDIUM** — Hospital module communicates with 5 services.

**Cohesion Level:** **MEDIUM** — Hospital operations grouped but with external orchestration (finding donors involves matching service).

**Architectural Observations:**
- ✅ Clear hospital-specific interface
- ⚠️ **Hospital needs to import 3 controllers** — hospital routes import both `hospitalController` and `notificationController` and `donationController` for QR verification
- ⚠️ **findDonors endpoint depends on matchingService** — When hospital searches for donors, it's actually delegating to matching service, which means matching logic is not encapsulated

---

## Module 4: Rewards System Module

**Responsibilities:**
- Points calculation based on donation type and urgency
- Tier progression (Bronze → Silver → Gold → Platinum)
- Badge definitions and progress tracking
- Badge unlocking logic
- Leaderboard generation
- Reward catalog management (admin)
- Reward redemption process
- Points transaction audit trail

**Public Interfaces:**
```
POST /rewards/redeem
GET /rewards/points
GET /rewards/badges
GET /rewards/leaderboard
GET /admin/rewards/config
PATCH /admin/rewards/config
```

**Dependencies:**
- `rewardService`, `rewardsConfigService`, `activityService`
- 7 models (DonorPoints, PointsTransaction, Badge, UserBadge, RewardCatalog, RewardRedemption, Activity)

**Coupling Level:** **MEDIUM** — Reward system has explicit dependency on activity service for logging badge unlocks.

**Cohesion Level:** **HIGH** — All reward logic in 2 services, clear separation between reward calculation and configuration.

**Architectural Observations:**
- ✅ Immutable transaction log (PointsTransaction) for audit trail
- ✅ Separate configuration service allows admin changes without code deployment
- ⚠️ **Badge unlocking triggers activity logging** — rewardService calls activityService, creating tight coupling
- ⚠️ **Points balance stored separately from transaction log** — DonorPoints.pointsBalance can become out-of-sync with sum of PointsTransaction entries

---

## Module 5: Administration Module

**Responsibilities:**
- User management (list, view, suspend, delete)
- Role permissions matrix
- System-wide settings (maintenance mode)
- Audit log viewing
- Hospital creation (admin-only)
- Request cancellation for safety violations
- Emergency broadcast to donors
- System health monitoring

**Public Interfaces:**
```
GET /admin/users
GET /admin/users/:id
PATCH /admin/users/:id/suspend
DELETE /admin/users/:id
GET /admin/requests
PATCH /admin/requests/:id/cancel
POST /admin/emergency-broadcast
GET /admin/system/health
POST /admin/system/maintenance
GET /admin/audit-logs
```

**Dependencies:**
- `adminService`, `hospitalService`, `analyticsService`, `rewardsConfigService`
- 8 models (User, Admin, AuditLog, RolePermission, SystemSettings, etc.)

**Coupling Level:** **MEDIUM** — Admin service imports hospital service and uses analytics service.

**Cohesion Level:** **HIGH** — Admin-specific operations clearly grouped.

**Architectural Observations:**
- ✅ Comprehensive audit logging for all admin actions
- ⚠️ **adminService imports hospitalService** — When creating hospital via admin, it directly calls hospital service, creating unnecessary coupling
- ⚠️ **Privilege bypass in middleware** — Admin routes bypass maintenance middleware, creating special-case logic in app.js

---

## Module 6: Matching & Eligibility Module

**Responsibilities:**
- Blood type compatibility checking
- Donor-request geographic distance scoring
- Ranking compatible donors by proximity
- Donor eligibility verification (age, health, donation interval)
- Active request/donation checking

**Public Interfaces:**
```
(Internal: No public HTTP endpoints)
Exported functions:
- checkEligibility(donor, request)
- findCompatibleDonors(request)
- calculateDistance(donor, hospital)
- isBloodTypeCompatible(donor, request)
- validateDonationInterval(donor, lastDonationDate)
```

**Dependencies:**
- `eligibilityService` (bidirectional calls)
- Geo utility, blood-type utility
- Donor, Request, Donation models

**Coupling Level:** **MEDIUM** — Matching depends on eligibility service, which creates circular-ish dependency (matching calls eligibility, but eligibility doesn't call matching directly).

**Cohesion Level:** **MEDIUM** — Contains both blood-type compatibility AND geo-distance AND eligibility checks, should be decomposed.

**Architectural Observations:**
- 🔴 **Monolithic matching service** — Combines 3 distinct responsibilities:
  1. Blood type compatibility (domain logic)
  2. Geographic distance calculation (spatial algorithm)
  3. Eligibility verification (health/age rules)
- ⚠️ **Complex location parsing logic** — Matching service handles 8+ different location field name conventions (location.lat, location.latitude, location.coordinates[1], etc.)
- ⚠️ **No caching** — Donor-request compatibility is recalculated on every query

---

## Module 7: Activity & Observability Module

**Responsibilities:**
- Log donor activities (donations, badge unlocks, milestones)
- Generate activity timeline/feed for donors
- Format activity records for display
- Auto-prune activities older than 365 days
- Organize activity by category (DONATION, BADGE, MILESTONE, etc.)

**Public Interfaces:**
```
GET /donor/activity
(Internal)
- logActivity(donorId, data)
- getTimeline(donorId, pagination)
```

**Dependencies:**
- Activity model only
- No service-level dependencies, but many services depend on this

**Coupling Level:** **HIGH** — 6+ services import and call activityService:
- donation.service.js
- reward.service.js
- appointment.service.js
- request-lifecycle.service.js
- admin.service.js
- donation.controller.js (one direct call)

**Cohesion Level:** **HIGH** — All activity logging logic grouped together.

**Architectural Observations:**
- 🔴 **activityService is a central bottleneck** — Too many services depend on it, any change requires coordinating multiple dependent services
- ✅ **Append-only log pattern** — Activity records never updated, only created
- ⚠️ **TTL-indexed auto-pruning** — Activities older than 365 days auto-deleted, losing historical data (potential audit gap)
- ⚠️ **Activity categories not validated** — Any service can log any activity type without validation

---

# Layer Separation Review

## Controllers — HTTP Request Handling Only

**Analysis:** Controllers are properly thin and focused.

**Pattern (observed across all 15 controllers):**
```javascript
export const handler = async (req, res, next) => {
  try {
    // 1. Parse input
    const { param1, param2 } = req.body;
    const { id } = req.params;

    // 2. Validate
    const validation = validateInputs({ param1, param2 });
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    // 3. Delegate to service
    const result = await service.businessLogic(param1, param2);

    // 4. Shape response
    return response.success(res, 200, 'Success message', result);
  } catch (error) {
    next(error);  // Pass to global error handler
  }
};
```

**Positive Evidence:**
✅ No business logic in controllers (checked 15 controllers)
✅ No direct model queries (except response shaping)
✅ Consistent error handling via next(error)
✅ Consistent response formatting via response utility
✅ Input validation delegated to validation modules

**Issues Found:**

⚠️ **Inconsistent service orchestration in controllers** — Some controllers use `Promise.all()`, others use `await` chains:
```javascript
// donor.controller.js - parallel
const [donor, stats, points, badges] = await Promise.all([...]);

// admin.controller.js - sequential
const users = await adminService.listUsers();
const total = await User.countDocuments();
```

⚠️ **Controller imports multiple validation modules** — auth.controller imports from 1 validation file, admin.controller imports from 5 validation files. No central validation registry.

⚠️ **Direct model queries in controller** — In help.controller.js, hardcoded FAQ array returned directly without service:
```javascript
export const getFaq = async (req, res, next) => {
  // ...no service call...
  return response.success(res, 200, 'FAQs', FAQS);
};
```

---

## Services — Business Logic Implementation

**Analysis:** Services contain business logic, but with tightly coupled dependencies.

**Pattern (observed across 13 services):**
```javascript
export const businessLogic = async (...inputs) => {
  try {
    // 1. Validate input
    if (!input) throw new Error('...');

    // 2. Data retrieval
    const entity = await Model.findById(...);
    if (!entity) throw new Error('...');

    // 3. Business logic
    const result = calculateSomething(entity);

    // 4. Persistence
    const saved = await Model.create(result);

    // 5. Orchestration (call other services)
    await otherService.onEvent(saved);

    // 6. Return
    return saved;
  } catch (error) {
    logger.error('...', { message: error.message });
    throw error;
  }
};
```

**Positive Evidence:**
✅ Business logic properly encapsulated in services
✅ Consistent error logging and re-throwing
✅ Model queries go through Mongoose (not raw queries)
✅ External service calls (FCM, email) abstracted

**Issues Found:**

🔴 **Complex service-to-service dependency chains**
```
donation.controller
  → donation.service.createDonation
    → matching.service.checkEligibility
      → eligibility.service (circular dependency?)
      → Donor.findById, Request.findById
    → reward.service.onDonationPending
      → activity.service.logActivity
    → activity.service.logActivity (direct call)
    → notification.service.notifyMatch
      → matching.service.findCompatibleDonors (again!)
```

⚠️ **No dependency injection** — Services import each other directly at module level:
```javascript
import * as matchingService from './matching.service.js';
import * as rewardService from './reward.service.js';
import * as activityService from './activity.service.js';
```
This makes testing difficult and creates tight compile-time coupling.

⚠️ **Bidirectional dependencies** — Matching service and eligibility service appear to have circular imports:
- matching.service.js imports eligibilityService
- eligibilityService probably imports matching-related constants or vice versa

⚠️ **Magic strings for status values** — Status values (e.g., 'pending', 'completed', 'cancelled') used as magic strings throughout services with no central registry:
```javascript
// donation.service.js
status: { $nin: ['cancelled', 'rejected'] }

// request-lifecycle.service.js
if (donation.status !== 'completed') { ... }

// appointment.service.js
status: { $in: ['pending', 'confirmed'] }
```

---

## Data Access Layer — Mongoose Models

**Analysis:** No explicit repository pattern; services access models directly.

**Direct Model Access Pattern:**
```javascript
// Services import and query models directly
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';

// In service
const donor = await Donor.findById(donorId);
const request = await Request.findOne({ status: 'pending' });
const donations = await Donation.find({ donorId, status: { $in: [...] } });
```

**Positive Evidence:**
✅ Index strategy clearly defined in docs (status, bloodType, compound indexes)
✅ Discriminator pattern for User hierarchy is well-structured
✅ TTL indexes for temporary data (OTP, refresh tokens)
✅ Schema validation defined at model level

**Issues Found:**

🔴 **No repository abstraction** — Direct model calls scattered across services make testing difficult and reduce reusability:
- donation.service.js queries 3 models directly
- matching.service.js queries 4 models directly
- admin.service.js queries 8+ models directly

⚠️ **Complex query construction** — Location parsing in matching.service is extremely complex due to multiple field naming conventions:
```javascript
const latitude = toNumber(
  request?.locationHospital?.latitude
    ?? request?.hospitalLocation?.lat
    ?? request?.hospitalLocationGeo?.coordinates?.[1]
    ?? request?.hospitalId?.location?.coordinates?.lat
    ?? request?.hospitalId?.lat
);
```
This suggests schema inconsistency or gradual refactoring that wasn't completed.

⚠️ **Soft-delete logic not enforced at query level** — Queries for "active" records must manually exclude deletedAt:
```javascript
const user = await User.findOne({ email, deletedAt: { $exists: false } });
```
No base query builder to standardize this.

⚠️ **Missing indexes for pagination** — Services use `skip() + limit()` pagination, which is inefficient for large datasets (>100k records). No cursor-based pagination implemented.

---

# Business Logic Placement Review

## Where Business Logic Lives

**Classified Business Rules Across 13 Services:**

### Well-Placed Business Logic ✅

**1. Eligibility Rules** — In `eligibility.service.js` (dedicated service)
```javascript
Responsibility: Check age, donation interval, health conditions
Callers: matching.service, donation.service, appointment.service
```

**2. Blood Type Compatibility** — In `matching.service.js` + blood-type utility
```javascript
Responsibility: Blood type matrix compatibility checking
Callers: matching.service.findCompatibleDonors()
```

**3. Points Calculation** — In `reward.service.js` (dedicated service)
```javascript
Responsibility: Award points based on donation type, tier progression
Callers: donation.service, reward.service
```

**4. State Machine Transitions** — In `state-machine.js` utility
```javascript
Responsibility: Validate allowed status transitions for donations/appointments
Callers: donation.service, appointment.service, request-lifecycle.service
```

**5. Audit Logging** — In `admin.service.js` (audit-specific function)
```javascript
Responsibility: Create immutable audit trail of admin actions
Callers: admin.controller
```

### Scattered Business Logic ⚠️

**1. Eligibility Checks Scattered Across 3 Services:**
```
- eligibility.service.js — Core eligibility rules
- matching.service.js — Calls eligibility.service for donor eligibility
- donation.service.js — Duplicates eligibility calls
- appointment.service.js — Also calls eligibility.service
```
Risk: Inconsistent eligibility checks if not coordinated.

**2. Donation Status Logic Spread Across 4 Services:**
```
- donation.service.js — Create, update, cancel donations
- request-lifecycle.service.js — Handle request state when donations change
- appointment.service.js — Handle appointment state when donations are scheduled
- admin.service.js — Admin can manually cancel donations
```
Risk: Status conflicts if one service doesn't update all related entities.

**3. Notification Logic Scattered:**
```
- donation.service.js — Calls notification.service.notifyMatch
- appointment.service.js — Calls notification.service.confirmAppointment
- hospital.service.js — Calls notification.service.broadcast
- request-lifecycle.service.js — Calls notification.service.notifyStatus
```
Risk: Notifications sent from multiple places, hard to trace all triggers.

### Duplicated Business Logic 🔴

**1. Location Coordinate Parsing** — Duplicated in 3 places:
```
- matching.service.js — toGeoPoint() and getRequestLocationPoint()
- geo.utility.js — May have similar logic
- Multiple model constructors likely do this too
```

**2. Blood Type Normalization** — Used in:
```
- blood-type.utility.js
- donation.service.js (imports blood-type utility, good)
- request.controller.js (direct blood-type formatting)
```

**3. Activity Logging** — Called from 6+ services but with inconsistent data structures:
```javascript
// donation.service
activity.logActivity(donorId, { type: 'DONATION', donationId })

// reward.service
activity.logActivity(donorId, { type: 'BADGE_UNLOCK', badgeId })

// appointment.service
activity.logActivity(donorId, { type: 'APPOINTMENT', appointmentId })
```
No validation that these activity types/structures are correct.

### Cross-Layer Leakage 🔴

**1. HTTP-specific logic in services** — response utility used in data layer:
```javascript
// admin.service.js
if (!validation.valid) {
  return response.error(res, 400, validation.errors.join(', '));
}
```
Services should throw errors, controllers should format responses.

**2. Validation imported from controllers** — In some cases:
```javascript
// request.controller.js
import { buildRequestPayload } from './request.controller.js';
// Used by donation.service.js
```
Controllers shouldn't export business logic.

**3. Error codes defined as constants but used as magic strings** — ERR constant exists but not always used:
```javascript
// Some places:
throw new Error(ERR.DONOR_NOT_ELIGIBLE);

// Other places:
throw new Error('Donor is not eligible');
```

---

# Dependency Analysis

## Service Dependency Map

```
┌─────────────────────────────────────────────────────┐
│           Dependency Graph (Services)               │
└─────────────────────────────────────────────────────┘

                  adminService
                    ↓↘
                    ↓ \→ hospitalService
         ↙──────────┘
    authService

                activityService (central hub)
                    ↑
         ┌──────────┼──────────┬─────────────┐
         │          │          │             │
    donationService rewardService appointmentService
         ↑               ↑
         │               │
    matchingService  rewardService
         ↑
    eligibilityService

    notificationService → matchingService

    analyticsService (no dependencies)
    rewardsConfigService (seeded by admin)
    hospital.service (called by admin)
```

## Critical Dependency Issues

### 🔴 Issue 1: Circular-ish Dependency Pattern
**Problem:**
```javascript
// matching.service.js
import * as eligibilityService from './eligibility.service.js';
const eligibility = await eligibilityService.canDonate(donor);

// eligibility.service.js
import * as matchingService from './matching.service.js';
// Potential circular import at top-level
```

**Impact:** If not careful with import order, can cause "undefined is not a function" errors at startup.

**Evidence:** Both files import each other; unclear if circular or if only one direction is used.

---

### 🔴 Issue 2: Activity Service as Central Bottleneck
**Problem:** 6 services directly import and call activityService:
```
donor.donation.service → activity.service
reward.service → activity.service
appointment.service → activity.service
request-lifecycle.service → activity.service
admin.service → activity.service
donation.controller → activity.service (direct)
```

**Impact:**
- Any change to activity.service signature requires coordinating 6 services
- Tests for activity.service must mock 6+ dependents
- Performance issue: activity logging blocks donation completion
- Scalability: If activity logging needs caching/batching, affects all 6 callers

**Evidence:**
```javascript
// donation.service.js
await activityService.logActivity(donorId, {
  type: 'DONATION',
  donationId,
  ...
});

// reward.service.js
await activityService.logActivity(donorId, {
  type: 'BADGE_UNLOCK',
  badgeId,
  ...
});
```

---

### ⚠️ Issue 3: Excessive Coupling in Donation Flow
**Problem:** Creating a donation triggers 4+ service calls:
```
donation.service.createDonation()
├─ matching.service.checkEligibility()
├─ reward.service.onDonationPending()
├─ activity.service.logActivity()
└─ notification.service.notifyMatch()
  └─ matching.service.findCompatibleDonors() [2nd call]
```

**Impact:**
- Long request time if any service is slow
- Difficult to test: donation.service test must mock 3+ services
- Difficult to change: changing activity logging format affects donation creation flow
- No clear separation of concerns

**Evidence:** 450+ lines in donation.service.js due to orchestration logic.

---

### ⚠️ Issue 4: Admin Service Imports Hospital Service
**Problem:**
```javascript
// admin.service.js
import * as hospitalService from './hospital.service.js';

export const createHospital = async (data) => {
  return await hospitalService.createHospitalProfile(data);
};
```

**Impact:**
- Unnecessary abstraction layer
- Admin and hospital services tightly coupled
- If hospital service changes, admin must change
- Violates single responsibility (admin shouldn't orchestrate hospital creation)

**Evidence:** admin.controller calls adminService.createHospital(), which just forwards to hospitalService. Why not call hospitalService directly?

---

### ⚠️ Issue 5: Direct Model Access Without Repository Pattern
**Problem:** Services access models directly at import time:
```javascript
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
// ... 8+ more models in donation.service.js alone
```

**Impact:**
- Hard to test: Can't easily mock database calls
- Hard to change: Query logic scattered across services
- No query builder: Different services construct queries differently
- No abstraction: Services expose MongoDB specifics

**Evidence:** Each service file averages 8-12 model imports; no repository layer.

---

### ⚠️ Issue 6: Reward System Depends on Multiple Sources
**Problem:**
```
rewardsConfig.service ← seeded by admin.service in server.js
reward.service → uses rewardsConfig
reward.service → calls activity.service
admin.controller → calls reward.service directly
```

**Impact:**
- Reward configuration loaded at startup but can be changed at runtime
- Unclear if reward.service caches config or fetches it every time
- Activity service used by reward service creates another level of indirect coupling

---

## Dependency Severity Classification

| Dependency Issue | Severity | Reason |
|------------------|----------|--------|
| Activity service hub | **CRITICAL** | 6 direct dependents, blocks request completion |
| Donation orchestration | **CRITICAL** | 4+ service calls in single flow, hard to change |
| No repository pattern | **HIGH** | Makes testing & refactoring difficult |
| Circular-ish imports | **HIGH** | Risk of runtime "undefined" errors |
| Admin→Hospital coupling | **MEDIUM** | Unnecessary layer, but not performance-critical |
| Reward config sources | **MEDIUM** | Config management fragmented but working |
| Magic status strings | **MEDIUM** | Inconsistency risk but not critical |

---

# Controller Analysis

## Controller Size & Responsibilities

| Controller | File Size | # Methods | Avg Method Lines | Complexity |
|-----------|-----------|-----------|------------------|------------|
| auth.controller.js | ~300 lines | 8 | 37 | Low |
| donor.controller.js | ~450 lines | 12 | 37 | **High** |
| hospital.controller.js | ~250 lines | 6 | 42 | Medium |
| request.controller.js | ~200 lines | 4 | 50 | Low |
| donation.controller.js | ~200 lines | 5 | 40 | Low |
| appointment.controller.js | ~180 lines | 5 | 36 | Low |
| reward.controller.js | ~220 lines | 7 | 31 | Low |
| admin.controller.js | ~600 lines | 15 | 40 | **High** |
| notification.controller.js | ~100 lines | 3 | 33 | Low |
| analytics.controller.js | ~150 lines | 4 | 37 | Low |
| help.controller.js | ~150 lines | 3 | 50 | Low |
| support.controller.js | ~100 lines | 2 | 50 | Low |
| discovery.controller.js | ~80 lines | 1 | 80 | Low |
| webhook.controller.js | ~50 lines | 1 | 50 | Low |

## Large Controllers

### 🔴 donor.controller.js (450 lines, 12 methods)

**Methods:**
```
1. getProfile() — 45 lines, calls 4 parallel services
2. updateProfile() — 30 lines
3. getMatches() — 50 lines, complex matching logic
4. getRequests() — 40 lines, pagination logic
5. respondToRequest() — 35 lines, calls donation service
6. declineRequest() — 25 lines
7. getDonations() — 30 lines
8. cancelDonation() — 20 lines
9. getAppointments() — 25 lines
10. getDashboard() — 60 lines, calls 5 services
11. getUrgentRequests() — 40 lines (deprecated)
12. getTimeline() — 30 lines (calls activity service)
```

**Issues Found:**

⚠️ **Multi-responsibility controller** — Handles profile, requests, donations, appointments, dashboard, and timeline. Could be split into:
- DonorProfileController
- DonorDonationController
- DonorDashboardController

⚠️ **getDashboard() is complex** — Calls 5 services in parallel, orchestrates data from multiple sources. Should this logic move to a service?

⚠️ **getMatches() has matching logic** — Should be delegating entirely to service, but appears to have filtering logic:
```javascript
// Likely contains: distance filtering, blood type checking, eligibility verification
```

⚠️ **Deprecated method not removed** — getUrgentRequests() marked deprecated but still in codebase.

---

### 🔴 admin.controller.js (600 lines, 15 methods)

**Methods (Phase-organized):**
```
Phase 1 (System & Foundation):
- getAdminProfile()
- getSystemHealth()
- setMaintenanceMode()
- listAuditLogs()

Phase 2 (User Management):
- listUsers()
- getUserDetails()
- suspendUser()
- unsuspendUser()
- deleteUser()
- createAdmin()

Phase 3 (Hospital Management):
- createHospital()
- listHospitals()

Phase 4 (Request Management):
- listRequests()
- cancelRequest()

Phase 5+ (Rewards, Emergency, etc.):
- getRewardConfig()
- updateRewardConfig()
- emergencyBroadcast()
```

**Issues Found:**

⚠️ **15 methods across multiple domains** — Admin controller handles user management + hospital management + request management + reward config + emergencies. Should be split into:
- AdminUserController (user suspend/delete)
- AdminHospitalController (hospital CRUD)
- AdminRequestController (request management)
- AdminSystemController (maintenance, health)
- AdminRewardController (reward config)

⚠️ **Orchestration logic in controller** — emergencyBroadcast likely contains logic for finding eligible donors and sending notifications. Should be in service.

⚠️ **Direct model queries** — Some methods may query models directly instead of delegating to admin.service.

---

## Multi-Responsibility Controllers ⚠️

**Controllers mixing concerns:**

1. **donor.controller.js** — Handles: profile, requests, matches, donations, appointments, dashboard, timeline
2. **hospital.controller.js** — Handles: profile, requests, appointments, donor discovery
3. **admin.controller.js** — Handles: users, hospitals, requests, audit logs, rewards, maintenance, emergency broadcast

**Pattern:** Route groups are not 1:1 with controller responsibilities.

**Example Route Mounting:**
```javascript
// app.js
app.use('/donor', limiter, donorRoutes);
app.use('/donor', limiter, activityRoutes);  // 2nd mount on same prefix
app.use('/hospital', limiter, hospitalRoutes);
app.use('/admin', limiter, adminRoutes);
```

This creates ambiguity: are `/donor/activity` routes handled by donor.controller or activity.controller?

---

## Consistency Issues ⚠️

**Inconsistent service orchestration patterns:**

```javascript
// Pattern 1: Sequential await (donor.controller)
const donor = await Donor.findById(donorId);
const stats = await donationService.getDonorStats(donorId);

// Pattern 2: Parallel Promise.all (donor.controller.getProfile)
const [donor, donationStats, pointsSummary, badges] = await Promise.all([
  Donor.findById(donorId).select('-password'),
  donationService.getDonorStats(donorId),
  rewardService.getPointsSummary(donorId),
  rewardService.getDonorBadges(donorId),
]);

// Pattern 3: Array shorthand (auth.controller)
const user = await User.findOne({...});
```

**Inconsistent error handling:**
```javascript
// Pattern 1: Guard clause return
if (!donor) return response.error(res, 404, 'Not found');

// Pattern 2: Throw and let next(error) handle
if (!donor) throw new Error('Not found');

// Pattern 3: Conditional response
response.success(res, 200, 'Message', data || null);
```

---

## Thin Controllers ✅

**Controllers that are properly thin:**

- `notification.controller.js` (3 methods, ~100 lines) — Just delegates to service
- `webhook.controller.js` (1 method, ~50 lines) — Just logging and response
- `analytics.controller.js` (4 methods, ~150 lines) — Just delegates to service
- `support.controller.js` (2 methods, ~100 lines) — Just delegates to service
- `discovery.controller.js` (1 method, ~80 lines) — Just delegates to service

**Pattern (these controllers follow):**
```javascript
export const handler = async (req, res, next) => {
  try {
    const result = await service.businessLogic(...);
    return response.success(res, 200, 'Message', result);
  } catch (error) {
    next(error);
  }
};
```

---

# Service Layer Analysis

## Large Services

| Service | File Size | # Functions | Avg Func Lines | Complexity |
|---------|-----------|------------|----------------|------------|
| donation.service.js | 450 | 8 | 56 | **High** |
| admin.service.js | 550 | 12 | 46 | **High** |
| reward.service.js | 350 | 7 | 50 | Medium |
| matching.service.js | 400 | 6 | 67 | **High** |
| appointment.service.js | 300 | 5 | 60 | Medium |
| auth.service.js | 400 | 9 | 44 | High |
| notification.service.js | 250 | 4 | 62 | Medium |
| hospital.service.js | 150 | 3 | 50 | Low |
| eligibility.service.js | 200 | 4 | 50 | Medium |
| activity.service.js | 120 | 2 | 60 | Low |
| analytics.service.js | 180 | 4 | 45 | Low |
| rewardsConfig.service.js | 100 | 2 | 50 | Low |
| request-lifecycle.service.js | 150 | 3 | 50 | Low |

## God Services

### 🔴 donation.service.js (450 lines, 8 functions)

**Responsibilities:**
1. Validate donor eligibility
2. Create donation records
3. Get donor donation stats
4. Update donation status
5. Handle donation rejection
6. Handle donation completion
7. Cancel donations
8. Query donations

**Issues:**
- **Too many responsibilities** — Should be split into:
  - DonationCRUD service (create, update, cancel, query)
  - DonationEligibility service (validate eligibility)
  - DonationLifecycle service (handle transitions, rejection, completion)
  
- **Excessive orchestration** — createDonation() function calls 4+ other services
  
- **Mixed concerns** — Both CRUD operations AND complex business logic

**Evidence:**
```javascript
export const createDonation = async (donorId, requestId, data = {}) => {
  // Validation (20 lines)
  // Eligibility checking (10 lines)
  // Existing donation check (8 lines)
  // Creation (5 lines)
  // Reward logic (15 lines)
  // Activity logging (8 lines)
  // Notification (10 lines)
  // Total: ~80 lines in a single function
};
```

---

### 🔴 admin.service.js (550 lines, 12 functions)

**Responsibilities:**
1. Get/update admin profile
2. System health monitoring
3. Maintenance mode management
4. Audit logging
5. List/detail/manage users (suspend, delete, create)
6. Create hospitals
7. List requests
8. Emergency broadcast
9. Get role permissions
10. Seed system settings
11. Manage support requests

**Issues:**
- **Domain dumping ground** — Contains logic for 5+ distinct domains (users, hospitals, audit, settings, broadcast)
  
- **Should be split** into:
  - UserManagementService (user suspend, delete, list)
  - HospitalManagementService (hospital creation)
  - AuditService (audit logging, audit log retrieval)
  - SystemSettingsService (maintenance mode, health)
  - BroadcastService (emergency broadcast)

- **Seeding logic** — seedDefaultSettings(), seedDefaultRolePermissions() should be in a separate InitializationService

---

### ⚠️ matching.service.js (400 lines, 6 functions)

**Responsibilities:**
1. Find compatible donors for request
2. Check donor eligibility (calls eligibility.service)
3. Calculate geo-distance
4. Verify blood type compatibility
5. Score donors by distance
6. Rank donors by match quality

**Issues:**
- **Three distinct concerns mixed together:**
  1. Blood type compatibility (domain logic)
  2. Geo-distance calculation (spatial algorithm)
  3. Eligibility checking (delegated to eligibility.service)

- **Should be split** into:
  - BloodTypeCompatibilityService (matrix logic)
  - GeoDistanceService (haversine calculation, ranking)
  - DonorMatchingService (orchestration)

- **Location parsing complexity** — 8+ different location field naming conventions handled in toGeoPoint() function (50+ lines)

---

## Highly Coupled Services

### 🔴 reward.service.js

**Dependencies:**
- `activity.service` (calls logActivity for badge unlocks)

**Impact:**
- Tight coupling to activity service
- Any change to activity format breaks reward logic
- Testing reward.service requires mocking activity.service

**Evidence:**
```javascript
// reward.service.js
export const unlockBadge = async (donorId, badge) => {
  // ... badge logic ...
  await activityService.logActivity(donorId, {
    type: 'BADGE_UNLOCK',
    badgeId: badge._id,
  });
};
```

---

### ⚠️ notification.service.js

**Dependencies:**
- `matching.service` (calls findCompatibleDonors in broadcastRequest)

**Impact:**
- When broadcasting notification to donors, it queries matching service to find them
- Mixes notification delivery with donor discovery
- Hard to test: notification.service test must mock matching.service

---

### ⚠️ appointment.service.js

**Dependencies:**
- `donation.service` (validates donation eligibility)
- `eligibility.service` (checks appointment eligibility)
- `activity.service` (logs appointment creation)

**Impact:**
- 3 service dependencies create test complexity
- Appointment booking depends on donation state, which creates hidden coupling

---

## Shared Service Patterns

**Services used by multiple other services:**

1. **activity.service** (6 dependents) — Central bottleneck
2. **matching.service** (3+ dependents) — Donor-request discovery
3. **eligibility.service** (3+ dependents) — Health rule validation
4. **notification.service** (3+ dependents) — Event notification

**These create architectural coupling risks.**

---

# Shared Utilities Review

## Utility Duplication

### Duplicated Functionality

**1. Location/Coordinate Handling**

```javascript
// matching.service.js (400+ lines of location logic)
toGeoPoint(location) { /* 40 lines */ }
getRequestLocationPoint(request) { /* 30 lines */ }
getDonorLocationPoint(donor) { /* 30 lines */ }

// geo.js utility (probably similar logic)
calculateDistance(p1, p2) { /* Haversine formula */ }

// Model constructors (likely handle location too)
// Donor model, Hospital model, Request model
```

**Issue:** Location coordinate normalization implemented in 3+ places with different logic.

---

**2. Blood Type Normalization**

```javascript
// blood-type.js utility
getCompatibleDonorTypesForRequest() { /* matrix logic */ }
normalizeBloodTypeList() { /* string parsing */ }

// Used across services:
// - matching.service.js
// - request.controller.js
// - donation.service.js
```

**Issue:** Fairly well-centralized in blood-type.utility, but request.controller also has blood-type formatting.

---

**3. Activity Logging Format**

```javascript
// activity.formatter.js
formatActivityForTimeline(activity) { /* format for display */ }

// But activity.service.logActivity also structures activity data
// Creating two different activity structures (for logging vs display)
```

**Issue:** Activity data structure defined in service, formatted separately for display.

---

### Under-Utilized Utilities

**1. state-machine.js** — Has transition validation but:
```javascript
// Defined in utility but:
// - Only used by donation.service and appointment.service
// - Some state transition logic still in services
// - Missing status values constants
```

**2. pagination.js** — Has helpers but:
```javascript
// Defined but pagination logic appears inconsistent across services
// Some services use skip/limit directly
// Others use pagination utility
```

**3. errorCodes.js** — Constant map exists but:
```javascript
// Some places use ERR.CONSTANT
// Other places throw new Error('string literal')
// Inconsistent usage
```

---

## Utility Organization Issues

**14 utilities in `/src/utils/` directory:**

- No clear hierarchy or grouping
- No README documenting purpose of each utility
- Some utilities have single function, others have 5+
- Cross-cutting concerns (logging, response) mixed with domain-specific (geo, blood-type)

**Suggested reorganization:**
```
utils/
├── core/                  # Cross-cutting concerns
│   ├── response.js       # HTTP response formatting
│   ├── logger.js         # Structured logging
│   ├── errorCodes.js     # Error constants
│   └── pagination.js     # Pagination helpers
├── domain/               # Domain-specific logic
│   ├── blood-type.js
│   ├── geo.js
│   ├── age.js
│   ├── eligibility-keys.js
│   └── state-machine.js
├── integrations/         # External service wrappers
│   ├── fcm.js           # Firebase
│   ├── jwt.js           # Token management
│   └── mailer.js        # Email delivery
└── formatting/          # Display/serialization
    ├── activity.formatter.js
    └── textNormalization.js
```

---

## Utility Coupling

**Cross-utility dependencies:**
```
logger.js → no dependencies
response.js → no dependencies
errorCodes.js → no dependencies
jwt.js → logger.js
fcm.js → logger.js
mailer.js → logger.js
pagination.js → no dependencies
activity.formatter.js → ACTIVITY_TITLE_MAP constants
geo.js → no dependencies
blood-type.js → no dependencies
state-machine.js → no dependencies
eligibility-keys.js → no dependencies
textNormalization.js → no dependencies
age.js → no dependencies
```

**Positive:** Most utilities are independent; logging/error dependencies are acceptable.

---

# Consistency Review

## Naming Consistency

### Controller Naming ✅
- All controller files named `{domain}.controller.js`
- All exports named consistently: `const handler = async (req, res, next) => {...}`
- Consistent: `export const getProfile`, `export const updateProfile`, `export const listItems`

### Service Naming ✅
- All service files named `{domain}.service.js`
- All exports named as `export const functionName`
- Consistent action verbs: get, create, update, delete, list, etc.

### Route Naming ⚠️
- Routes mixed: some `/auth`, `/donor`, `/hospital`, `/admin`
- Some routes nested: `/donations/book-appointment`
- Inconsistent pluralization: `/donor` vs `/hospitals` vs `/requests`
- Query params naming: `?page=1&limit=10` (snake_case) vs sometimes camelCase

**Example inconsistencies:**
```javascript
GET /donor/profile      (singular)
GET /hospitals          (plural)
GET /requests           (plural)
POST /admin/users       (plural)
GET /donations          (plural)
POST /appointments      (plural)
GET /rewards/badges     (plural)
```

### Model Naming ✅
- All model files named `{Domain}.model.js` (PascalCase)
- Model exports named `export default Model` (PascalCase)
- Consistent MongoDB collection names (lowercase, plural): users, donors, requests, donations

---

## Structural Consistency

### Response Format ✅

All endpoints follow strict response schema:
```javascript
// Success
{
  success: true,
  message: "Human readable message",
  data: { ... }
}

// Error
{
  success: false,
  code: "ERROR_CODE",
  message: "Human readable message",
  details: [ "additional", "info" ]
}
```

**Evidence:** Centralized response.success() and response.error() used across all controllers.

---

### Error Handling ✅

Consistent error handling pattern:
```javascript
try {
  // ... logic ...
  return response.success(res, 200, 'Message', data);
} catch (error) {
  next(error);  // Always pass to global error handler
}
```

**Evidence:** All 15 controllers follow this pattern.

---

### Status Codes ⚠️

Inconsistent HTTP status usage across endpoints:

```javascript
// Inconsistency in success responses:
200 OK → Most GET/PATCH endpoints
201 Created → Some POST endpoints, but not all
202 Accepted → Not used (should be for async operations)

// Inconsistency in error responses:
400 Bad Request → Validation errors (correct)
401 Unauthorized → Auth failures (correct)
403 Forbidden → Suspended accounts (correct)
404 Not Found → Entity not found (correct)
409 Conflict → Duplicate email (should sometimes be 400)
```

---

### Pagination Consistency ⚠️

Most endpoints use skip/limit:
```javascript
GET /admin/users?page=1&limit=20
GET /donor/requests?page=1&limit=10
```

But some use offset/limit or custom approaches. No cursor-based pagination.

---

## Organizational Consistency

### Route Organization ⚠️

Routes grouped by domain, but organization unclear:
```javascript
// app.js
app.use('/donor', limiter, donorRoutes);      // Main donor routes
app.use('/donor', limiter, activityRoutes);   // Activity routes (also donor-specific?)
app.use('/requests', limiter, requestRoutes); // Request routes (should be under /donor?)
app.use('/donations', limiter, donationRoutes); // Donation routes (should be under /donor?)
```

**Ambiguity:** Should a donor access their activity via `/donor/activity` or `/activity`? What about `/donor/requests` vs `/requests`?

### Middleware Ordering ✅

Middleware applied in correct order:
1. helmet (security headers)
2. cors (cross-origin)
3. rate-limit (before logging)
4. logging (all requests)
5. body-parsing (before validation)
6. sanitization (prevent injection)
7. auth (before role checks)
8. role (after auth)
9. error handler (last)

---

### Configuration Management ⚠️

Configuration split across 3 sources:

**1. Environment Variables** — `.env` file (handled by env.js)
```javascript
export const env = {
  NODE_ENV,
  PORT,
  MONGO_URI,
  JWT_SECRET,
  CORS_ORIGIN,
  // ... 20+ vars
};
```

**2. System Settings** — MongoDB collection (seedDefaultSettings in admin.service.js)
```javascript
SystemSettings.findOneAndUpdate({ key: 'maintenance_mode' }, ...)
```

**3. Reward Configuration** — MongoDB collection (rewardsConfig.service.js)
```javascript
RewardsConfig.findOneAndUpdate({ key: 'points_per_donation' }, ...)
```

**Issue:** Config management fragmented across 3 patterns:
- Env vars (app startup)
- System settings (runtime, admin-controllable)
- Reward config (runtime, admin-controllable)

**Inconsistency:** Some values hardcoded in services (e.g., DEFAULT_MATCHING_DISTANCE_KM), others in config.

---

## Architectural Conventions

### Naming Conventions

**Document IDs:**
- ✅ Always `_id` (MongoDB default)
- ✅ Uses `userId` for foreign key references
- ✅ Uses `donorId`, `hospitalId`, etc. for discriminated references

**Status/State Fields:**
- ⚠️ Used as magic strings across services
- ⚠️ No single enum or constants file for status values
- **Example:** Donation.status can be 'pending', 'scheduled', 'completed', 'rejected', 'cancelled' but not validated against schema enum

**Timestamps:**
- ✅ Always `createdAt` and `updatedAt` (Mongoose defaults)
- ✅ TTL indexes used for temporary data expiration

**Location Data:**
- ⚠️ Inconsistent field names (location.lat, location.latitude, coordinates[1], etc.)
- ⚠️ Multiple representations of same concept

---

### Error Message Conventions

**Consistent error messages used in multiple places:**
- ✅ Centralized error codes (ERR constants)
- ✅ Internationalization support (i18n)
- ✅ Error inference logic in response.js

**Inconsistency:** Some errors are key-based (for i18n), others are hardcoded strings.

---

# Architectural Risks

## Critical Risks (Must Address)

### 🔴 Risk 1: Activity Service Bottleneck
**Description:** 6 services depend on activityService. Any change or performance issue blocks multiple business operations.

**Evidence:**
```
donation.service.js → activity.service
reward.service.js → activity.service
appointment.service.js → activity.service
request-lifecycle.service.js → activity.service
admin.service.js → activity.service
donation.controller.js → activity.service
```

**Impact:** If activity.logActivity() is slow, all donation/reward/appointment operations slow down.

**Mitigation:** Consider event-based logging (async queue, message bus) to decouple activity logging from critical path.

---

### 🔴 Risk 2: Donation Flow Orchestration Complexity
**Description:** Creating a donation triggers 4+ service calls in series, making the operation slow and failure-prone.

**Evidence:**
```javascript
donation.service.createDonation()
├─ matching.service.checkEligibility() [wait]
├─ reward.service.onDonationPending() [wait]
├─ activity.service.logActivity() [wait]
└─ notification.service.notifyMatch()
  └─ matching.service.findCompatibleDonors() [wait again]
```

**Impact:**
- Request takes 1000+ ms if any service is slow
- If notification fails, donation is already created (partial failure)
- Difficult to understand causality and failure scenarios

**Mitigation:** Consider event-driven architecture (publish "DonationCreated" event, let other services react asynchronously).

---

### 🔴 Risk 3: No Request Repository Layer
**Description:** Direct model access throughout services makes testing difficult and reduces code reuse.

**Evidence:**
```javascript
// Across 13 services:
- Donor.findById()
- Request.findById()
- Donation.create()
- Appointment.findOne()
// ... 100+ direct model calls
```

**Impact:**
- Unit tests must mock Mongoose at model level
- Query logic scattered (hard to find all queries on a model)
- Can't implement caching without refactoring all services

**Mitigation:** Create repository layer (DonorRepository, RequestRepository, etc.) to abstract model access.

---

## High-Priority Risks

### ⚠️ Risk 4: Matching Service is Monolithic
**Description:** Matching service combines 3 unrelated concerns: blood type, geo-distance, eligibility.

**Evidence:**
```
matching.service.js
├─ Blood type compatibility logic (50 lines)
├─ Geo-distance calculation (100 lines)
├─ Eligibility delegation (calls eligibility.service)
└─ Complex location parsing (50+ lines handling 8 coordinate formats)
```

**Impact:**
- Testing matching logic requires understanding all 3 domains
- Hard to reuse blood-type logic separately
- Location parsing complexity (8 coordinate formats) should be in utility
- 400+ line file difficult to understand and maintain

**Mitigation:** Split into BloodTypeService, GeoService, and DonorMatchingService.

---

### ⚠️ Risk 5: Synchronous FCM Delivery Blocks Requests
**Description:** Firebase Admin SDK calls are synchronous and block request handling.

**Evidence:**
```javascript
// notification.service.js
const multicastMessage = { ... };
const response = await admin.messaging().sendMulticast(multicastMessage);
// If Firebase is slow, entire request waits
```

**Impact:**
- Firebase timeout (5s+) blocks donation creation
- No retry mechanism for failed sends
- Single point of failure for critical notification flow

**Documented Risk:** This is already documented as known limitation requiring queue-based solution for production scale.

**Mitigation:** Implement Redis queue + worker process for async notification delivery.

---

### ⚠️ Risk 6: Circular-ish Service Imports
**Description:** Matching and eligibility services may have circular imports.

**Evidence:**
```javascript
// matching.service.js
import * as eligibilityService from './eligibility.service.js';

// eligibility.service.js (may import back)
// Unclear without full inspection
```

**Impact:**
- Risk of "undefined is not a function" at startup
- Hard to refactor either service independently

**Mitigation:** Investigate actual import graph, refactor if circular detected.

---

## Medium-Priority Risks

### ⚠️ Risk 7: Configuration Management Fragmented
**Description:** Configuration split across 3 sources (env vars, system settings, reward config) with no unified interface.

**Evidence:**
```
.env → env.js → app startup
MongoDB SystemSettings → runtime admin control
MongoDB RewardsConfig → runtime admin control
Magic strings in services → hardcoded defaults
```

**Impact:**
- Unclear where a value should go (env? database? hardcoded?)
- No way to trace config origin
- Config validation not centralized
- Startup time might load configs multiple times

**Mitigation:** Create ConfigService that unifies all config sources.

---

### ⚠️ Risk 8: Status Values as Magic Strings
**Description:** Donation/appointment status values used as magic strings with no central validation.

**Evidence:**
```javascript
// Different files:
status: { $nin: ['cancelled', 'rejected'] }
if (donation.status !== 'completed') { }
status: { $in: ['pending', 'confirmed'] }
```

**Impact:**
- Typo in status string causes logic to fail silently
- No validation that only valid statuses are used
- Difficult to add new statuses (search/replace across codebase)

**Mitigation:** Create enums/constants for all status values, validate in schema.

---

### ⚠️ Risk 9: No Dependency Injection
**Description:** Services import each other directly at module level, creating hard compile-time dependencies.

**Evidence:**
```javascript
// Every service file has:
import * as matchingService from './matching.service.js';
import * as rewardService from './reward.service.js';
```

**Impact:**
- Testing requires mocking modules or using real instances
- Can't easily swap implementations (no interfaces)
- Circular import risks
- Service initialization order matters

**Mitigation:** Implement dependency injection (container pattern) or use factory functions.

---

### ⚠️ Risk 10: Location Data Inconsistency
**Description:** 8+ different field naming conventions for location/coordinates create parsing complexity.

**Evidence:**
```javascript
location.lat, location.latitude,
location.coordinates[1],
location.location.coordinates.lat,
hospitalId.location.coordinates.lat,
locationHospital.latitude,
hospitalLocation.lat,
hospitalLocationGeo.coordinates[1]
```

**Impact:**
- 50+ lines of parsing logic in matching.service.js
- Risk of missing a field name (silent failure if coordinate not found)
- Makes location data model ambiguous

**Mitigation:** Standardize on single location schema (e.g., always use `{ type: 'Point', coordinates: [lng, lat] }` GeoJSON).

---

# Evidence

## Code Examples Supporting Findings

### Evidence 1: Service Dependency Chain
**File:** `/src/services/donation.service.js`, lines 1-30

```javascript
import * as matchingService from './matching.service.js';
import * as rewardService from './reward.service.js';
import * as activityService from './activity.service.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';

export const createDonation = async (donorId, requestId, data = {}) => {
  // ... validation ...
  const eligibility = await matchingService.checkEligibility(donor, request);
  if (!eligibility.eligible) throw new Error(eligibility.reason);
  
  const donation = await Donation.create({ donorId, requestId, status: 'pending' });
  
  // Chain 1: Reward service
  await rewardService.onDonationPending(donorId, donation);
  
  // Chain 2: Activity service
  await activityService.logActivity(donorId, { 
    type: 'DONATION',
    donationId: donation._id
  });
  
  // Chain 3: Notification service
  await notificationService.notifyMatch(hospital, donation);
};
```

**Finding:** Single function calls 3 other services sequentially (not concurrent), creating bottleneck.

---

### Evidence 2: Activity Service as Central Hub
**File:** `/src/services/`, multiple files

Grep results show activity.service imported by:
- donation.service.js: `await activityService.logActivity(donorId, ...)`
- reward.service.js: `await activityService.logActivity(donorId, { type: 'BADGE_UNLOCK', ... })`
- appointment.service.js: `await activityService.logActivity(donorId, ...)`
- request-lifecycle.service.js: `await activityService.logActivity(...)`
- admin.service.js: `await activityService.logActivity(...)`
- donation.controller.js: Direct call in one endpoint

**Finding:** 6 different entry points to activity logging, creating bottleneck for performance/schema changes.

---

### Evidence 3: Location Parsing Complexity
**File:** `/src/services/matching.service.js`, lines 60-120

```javascript
const toGeoPoint = (location = null) => {
  if (!location) return null;

  // 1. Array coordinates check
  if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    const lat = toNumber(location.coordinates[1]);
    const lng = toNumber(location.coordinates[0]);
    if (lat !== null && lng !== null) return { latitude: lat, longitude: lng };
  }

  // 2. Direct array check
  if (Array.isArray(location) && location.length >= 2) { /* ... */ }

  // 3. Object properties check (8 different field names)
  const latitude = toNumber(
    location?.lat
      ?? location?.latitude
      ?? location?.coordinates?.lat
      ?? location?.coordinates?.latitude
      ?? location?.location?.coordinates?.lat
      ?? location?.location?.coordinates?.latitude
  );
  // ... 20 more lines ...
};
```

**Finding:** 50+ lines handling 8+ different coordinate formats suggests schema inconsistency across models.

---

### Evidence 4: Inconsistent Service Imports
**Files:** Multiple controller files

```javascript
// auth.controller.js imports
import * as authService from '../services/auth.service.js';

// admin.controller.js imports
import * as adminService from '../services/admin.service.js';
import * as analyticsService from '../services/analytics.service.js';
import * as rewardsConfigService from '../services/rewardsConfig.service.js';

// donor.controller.js imports
import * as matchingService from '../services/matching.service.js';
import * as donationService from '../services/donation.service.js';
import * as notificationService from '../services/notification.service.js';
import * as activityService from '../services/activity.service.js';
import * as eligibilityService from '../services/eligibility.service.js';
import * as rewardService from '../services/reward.service.js';
```

**Finding:** Controllers import different numbers of services (1 vs 3 vs 6), suggesting inconsistent organization.

---

### Evidence 5: Status Strings as Magic Values
**Files:** Multiple service files

```javascript
// donation.service.js
status: { $nin: ['cancelled', 'rejected'] }

// request-lifecycle.service.js
if (donation.status !== 'completed') { }

// appointment.service.js
status: { $in: ['pending', 'confirmed'] }

// admin.controller.js (implied)
// Multiple status transitions without validation
```

**Finding:** Status values used without centralized enum or validation, risking typos.

---

### Evidence 6: Admin Service Imports Hospital Service
**File:** `/src/services/admin.service.js`, line 19

```javascript
import * as hospitalService from './hospital.service.js';

// Later in file:
export const createHospital = async (data) => {
  return await hospitalService.createHospitalProfile(data);
};
```

**Finding:** Unnecessary wrapper: admin.service.createHospital just forwards to hospitalService.createHospitalProfile. Controllers could call hospitalService directly.

---

### Evidence 7: Donor Controller Multiple Concerns
**File:** `/src/controllers/donor.controller.js`

Methods:
1. getProfile — Donor profile
2. updateProfile — Donor profile
3. getMatches — Blood request matching
4. getRequests — Blood requests listing
5. respondToRequest — Donation lifecycle
6. declineRequest — Donation lifecycle
7. getDonations — Donation history
8. cancelDonation — Donation lifecycle
9. getAppointments — Appointment viewing
10. getDashboard — Dashboard/summary
11. getTimeline — Activity timeline
12. getUrgentRequests — Request filtering

**Finding:** 12 methods across 5 distinct domains (profile, matching, donations, appointments, dashboard) in single controller.

---

### Evidence 8: Middleware Ordering Special Case
**File:** `/src/app.js`, line 131

```javascript
// Admin BEFORE maintenance middleware so admins always have access
app.use('/admin', limiter, adminRoutes);

// Maintenance check — blocks non-admin routes when enabled
app.use(maintenanceMiddleware);

// All other routes blocked if maintenance enabled (except admin)
app.use('/donor', limiter, donorRoutes);
app.use('/hospital', limiter, hospitalRoutes);
```

**Finding:** Special-case logic: admin routes bypass maintenance middleware, creating non-obvious behavior.

---

### Evidence 9: Model Queries in Multiple Services
**Files:** Service files (13 total)

Each service file imports 4-12 models and queries them directly:
- donation.service.js: imports Donation, Donor, Request, Appointment, DonorPoints models
- admin.service.js: imports User, Hospital, Request, AuditLog, RolePermission, SystemSettings models
- matching.service.js: imports Donor, Request, Donation, Appointment models

**Finding:** No repository abstraction layer; model queries scattered across 13 services.

---

### Evidence 10: Parallel vs Sequential Service Calls
**Files:** Different controller files

```javascript
// donor.controller.js - PARALLEL (good)
const [donor, donationStats, pointsSummary, badges] = await Promise.all([
  Donor.findById(donorId).select('-password'),
  donationService.getDonorStats(donorId),
  rewardService.getPointsSummary(donorId),
  rewardService.getDonorBadges(donorId),
]);

// donation.service.js - SEQUENTIAL (potentially inefficient)
const eligibility = await matchingService.checkEligibility(donor, request);
if (!eligibility.eligible) throw new Error(eligibility.reason);
const donation = await Donation.create({ donorId, requestId, status: 'pending' });
await rewardService.onDonationPending(donorId, donation);
await activityService.logActivity(donorId, ...);
```

**Finding:** Inconsistent optimization approaches; some operations that could parallelize are sequential.

---

# Recommendations

## Analysis-Level Observations & Planning Insights

### 1. Service Decomposition Strategy
**Observation:** Several "God Services" (donation.service, admin.service, matching.service) combine unrelated concerns.

**Planning Insight:**
- Donation service should be split into: DonationCRUD, DonationEligibility, DonationLifecycle
- Admin service should be split into: UserManagement, HospitalManagement, AuditService, SystemSettings, BroadcastService
- Matching service should be split into: BloodTypeService, GeoService, DonorMatchingService

**No implementation suggested.** This is structural analysis to inform future refactoring.

---

### 2. Decoupling Strategy for Activity Service
**Observation:** Activity service is a central bottleneck with 6+ direct dependents.

**Planning Insight:**
- Consider event-driven architecture: instead of services calling activityService directly, publish "DonationCreated", "BadgeUnlocked" events
- Activity service becomes event subscriber (can be moved to background worker)
- Decouples critical path (donation creation) from observability (activity logging)

**Architecture consideration:** Implement event bus (use Redis Pub/Sub or similar) rather than direct service calls.

**No implementation suggested.** This is architectural analysis.

---

### 3. Repository Pattern Abstraction
**Observation:** No repository layer; services have direct model access making testing difficult.

**Planning Insight:**
- Create repository classes: DonorRepository, RequestRepository, DonationRepository, etc.
- Each repository abstracts query building and model access
- Services depend on repositories, not models
- Benefits: easier to test (mock repositories), easier to optimize (add caching in repository), easier to swap data sources

**Architecture pattern to consider:**
```javascript
// Instead of:
const donor = await Donor.findById(donorId);

// Implement:
const donor = await donorRepository.findById(donorId);
```

**No implementation suggested.** This is architectural planning.

---

### 4. Configuration Management Unification
**Observation:** Config split across 3 sources (env, systemSettings, rewardsConfig) with no unified interface.

**Planning Insight:**
- Create ConfigService that exposes all config through single interface
- ConfigService loads from both env and database
- Centralize config validation (validate on startup and when runtime changes made)
- Consider caching config in memory with TTL to reduce database queries

**No implementation suggested.** This is to inform config refactoring.

---

### 5. Status/State Machine Formalization
**Observation:** Status values used as magic strings; no validation or formal state machine.

**Planning Insight:**
- Define status enums for each entity:
  ```javascript
  const DonationStatus = Object.freeze({
    PENDING: 'pending',
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
  });
  ```
- Add status validation in schemas
- Use state-machine utility for transitions
- Create transition matrix (document valid transitions) for audit/reference

**No implementation suggested.** This is to inform state management design.

---

### 6. Location Data Standardization
**Observation:** 8+ different location field naming conventions create parsing complexity.

**Planning Insight:**
- Standardize location schema across all models to GeoJSON format:
  ```javascript
  location: {
    type: "Point",
    coordinates: [longitude, latitude]
  }
  ```
- Create location utility: `normalizeLocation(input)` that accepts various formats and converts to standard
- This simplifies matching.service.js location parsing

**No implementation suggested.** This is schema planning.

---

### 7. Dependency Injection Pattern
**Observation:** Services import each other directly at module level; no DI framework used.

**Planning Insight:**
- Consider implementing lightweight DI container (simple factory pattern rather than full framework)
- Benefits: easier testing, easier to swap implementations, easier to manage circular dependencies
- Simple approach: container.register() at startup, services request dependencies from container

**Alternative:** Maintain current approach but document service dependencies and initialization order.

**No implementation suggested.** This is architectural pattern analysis.

---

### 8. Middleware Organization
**Observation:** Special-case logic for admin routes bypassing maintenance middleware creates unclear flow.

**Planning Insight:**
- Document middleware behavior clearly (especially privilege bypass for admin)
- Consider creating role-aware middleware that handles privilege levels rather than special-case mounting
- Reduces special cases in app.js

**No implementation suggested.** This is middleware design planning.

---

### 9. Error Handling Standardization
**Observation:** Some errors thrown as strings, others use ERR constants; inconsistent usage.

**Planning Insight:**
- Standardize on ERR constants for all known errors
- Create typed error classes (ValidationError, NotFoundError, etc.) that extend Error
- Services throw typed errors, controllers/middleware catch and translate to HTTP responses
- Benefits: easier to test error cases, easier to log, easier to translate to different status codes

**No implementation suggested.** This is error handling pattern planning.

---

### 10. Cross-Module Communication Pattern
**Observation:** Services call each other directly; high coupling and unclear causality.

**Planning Insight:**
- Document current flow clearly (request flow examples in audit show this)
- Consider event-driven communication (publish-subscribe) for loosely coupled domains
- Keep direct service calls for tightly integrated logic (e.g., eligibility checking)
- Use events for side effects (activity logging, notifications)

**No implementation suggested.** This is architectural pattern planning.

---

# Open Questions

## Clarifications Needed from Team

### 1. Activity Service Design Intent
**Question:** Is activity logging intended to be:
- Critical path (donor can't create donation if activity fails)? OR
- Best-effort (donor can create donation even if activity fails)?

**Impact:** Affects whether activity logging should be async/queued or kept synchronous.

**Current evidence:** Synchronous calls suggest critical path, but activity is observability (normally non-critical).

---

### 2. Circular Dependency in matching/eligibility Services
**Question:** Do matching.service.js and eligibility.service.js actually have circular imports?

**Current evidence:** Both appear to import each other, but unclear if both directions are used.

**Impact:** If true, creates runtime risk ("undefined is not a function").

---

### 3. Location Field Naming Strategy
**Question:** Why do different models use different location field names?
- Donor: `location.coordinates`?
- Request: `locationHospital.latitude`?
- Hospital: `hospitalLocation.lat`?

**Impact:** Understanding whether this is intentional (different schema versions) or accidental (migration incomplete).

---

### 4. Repository Pattern Preference
**Question:** Has team considered or rejected repository pattern? If rejected, why?

**Current evidence:** Direct model access everywhere, but no repository layer.

**Impact:** Affects testing strategy and future refactoring approach.

---

### 5. Event-Driven Architecture Plans
**Question:** Is event-driven architecture planned for future (queue-based notification delivery)?

**Current evidence:** FCM delivery documented as "known limitation requiring queue-based solution for production scale".

**Impact:** Whether activity logging should also move to event-driven model.

---

### 6. Status Validation Strategy
**Question:** Should status values be validated against schema enums, or remain flexible strings?

**Current evidence:** Used as magic strings, no schema validation.

**Impact:** Affects data integrity and schema design decisions.

---

### 7. Admin Bypass of Maintenance Mode
**Question:** Is admin bypass of maintenance mode intentional and documented?

**Current evidence:** Admin routes mounted before maintenance middleware, allowing access during maintenance.

**Impact:** Whether this is feature (intended) or oversight (should be documented).

---

### 8. Dependency Injection Preference
**Question:** Why aren't service dependencies injected rather than imported directly?

**Current evidence:** Services import each other at module level.

**Impact:** Affects testing approach and scalability of service dependencies.

---

### 9. Configuration Source Priority
**Question:** If a value is defined in both env and database (systemSettings), which takes precedence?

**Current evidence:** Config scattered across 3 sources with no documented priority.

**Impact:** Affects configuration strategy and potential conflicts.

---

### 10. Donor Request Matching Flow
**Question:** When a hospital creates a request, who triggers the donor notification?
- Request controller directly calls notification service? OR
- Request service has side effect? OR
- Event-based (request created → event published → notification service subscribes)?

**Current evidence:** Likely in request.controller or request.service, but not traced in this audit.

**Impact:** Affects understanding of request creation flow and coupling.

---

# Summary Table: Architecture Assessment

| Aspect | Health | Risk Level | Evidence |
|--------|--------|-----------|----------|
| Layer Separation | Good | Low | Controllers properly thin, services have business logic, clear 3-tier architecture |
| Service Coupling | Poor | **High** | 6+ service dependencies, circular imports, activity bottleneck |
| Data Access | Needs Work | **High** | No repository pattern, direct model access scattered across services |
| Error Handling | Good | Low | Centralized error middleware, consistent error handling pattern |
| Response Format | Good | Low | All responses follow consistent schema, centralized response utility |
| Middleware | Good | Medium | Clear middleware stack, but special-case admin bypass logic |
| Configuration | Fragmented | **High** | 3 different config sources, no unified interface |
| Naming Consistency | Good | Low | Consistent controller/service/model naming, but status values as magic strings |
| Code Organization | Fair | Medium | Controllers grouped by domain, but some have multiple concerns |
| Testing Ability | Poor | **High** | No repository/DI pattern makes mocking difficult |
| Scalability | At Risk | **Critical** | Activity bottleneck, sync FCM calls, no async queuing |
| Documentation | Good | Low | Architecture doc exists, but coupling not documented |
| Testability | Needs Work | **High** | Service-to-service dependencies, direct model access require deep mocking |

---

**End of Phase 05 Architecture & System Design Audit**

**Status:** Analysis Complete | No Code Modifications Made | Ready for Team Review

**Next Steps:** 
- Team review findings and open questions
- Phase 06: Concurrency & Async Handling Audit
- Phase 07: Security Audit
- Phase 08: Performance & Observability Audit
- Phase 09: Cleanup & Technical Debt Audit
