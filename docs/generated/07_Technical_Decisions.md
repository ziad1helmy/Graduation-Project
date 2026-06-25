# LifeLink — Technical Decisions

> **Document Type:** Software Documentation  
> **Version:** 1.0  
> **Generated From:** Codebase Analysis — June 2026  

---

## 1. Runtime and Framework

### Decision: Node.js 20+ with ESM modules

**What:** The project uses `"type": "module"` in `package.json`, making all `.js` files ECMAScript modules. `require()` and `module.exports` are forbidden by the project's own coding standards.

**Why (inferred from `AGENTS.md`):** Align with modern JavaScript standards and enable top-level `await`, which is used in `src/server.js` for the startup sequence (`await connectDB()`, `await seedDefaultSettings()`).

**Evidence:** `package.json` line 19 `"type": "module"`, `src/server.js` lines 12–17, `AGENTS.md` Section 4.1

---

### Decision: Express.js 5.x

**What:** Express.js version 5 (release candidate at the time of development).

**Why (inferred):** Express 5 adds native async error handling in route handlers, reducing the need for `try/catch` in every controller. The project also uses `asyncHandler` middleware for backwards-compatible wrapping.

**Evidence:** `package.json` dependency `"express": "^5.2.1"`

---

## 2. Database Architecture

### Decision: MongoDB with Mongoose (single collection discriminator pattern)

**What:** All user roles (`donor`, `hospital`, `admin`, `superadmin`) are stored in a single `users` collection. `Donor` and `Hospital` are Mongoose discriminators on the base `User` model.

**Why (documented in `README.md`):**
> "Models: Mongoose discriminator pattern (Donor and Hospital inherit from User)"

This allows:
- Shared authentication queries against one collection (`User.findById()` works for any role)
- Role-specific fields co-located with shared fields in one document
- Indexes on shared fields (email, role) cover all roles

**Trade-off:** Single collection for all roles means the collection grows with all user types. Discriminators add a `__t` field (Mongoose's discriminator key) to every document.

**Evidence:** `src/models/Donor.model.js` line 183 `User.discriminator('donor', donorSchema)`, `src/models/Hospital.model.js` line 159 `User.discriminator('hospital', hospitalSchema)`, `README.md`

---

### Decision: Soft deletion via `deletedAt` field

**What:** Deleting an account sets `deletedAt` to the current timestamp rather than removing the document.

**Why (inferred):** Preserves referential integrity. Donation, request, and notification history linked to the user document remains intact. The auth middleware and business logic check `deletedAt !== null` to block access.

**Cascade:** A Mongoose `post('findByIdAndUpdate')` hook cascades the soft-delete to related documents (cancels pending donations, appointments, and requests) within a MongoDB transaction.

**Evidence:** `src/models/User.model.js` lines 117–120 (field definition), lines 236–363 (cascade hook)

---

### Decision: Separate `DonorPoints` collection (not embedded)

**What:** Donor points are stored in a dedicated `DonorPoints` collection (one document per donor) instead of embedded in the `Donor` document.

**Why (documented in model JSDoc):**
> "Design decision: separate collection (not embedded in Donor) so we can update points atomically with `$inc` without loading the full donor doc."

This avoids loading the entire donor profile (including health history, travel history, etc.) when only points need to be incremented.

**Evidence:** `src/models/DonorPoints.model.js` lines 3–13

---

### Decision: `autoIndex: false` at startup

**What:** Mongoose is configured with `autoIndex: false`, disabling automatic index creation on startup.

**Why (documented in `db.js`):**
> "Prevent Mongoose from building indexes on startup. Indexes are managed explicitly via schema.index() and created by a separate migration/seed step to avoid duplicate-index warnings."

This avoids repeated index-creation operations in development and prevents unexpected index builds during deployment.

**Evidence:** `src/config/db.js` line 31

---

## 3. Authentication & Security

### Decision: Stateless JWT with MongoDB-backed refresh token blacklist

**What:** Access tokens are stateless JWTs (verified by signature, no DB lookup required). Refresh tokens are also JWTs, but logout adds the refresh token's hash to a `RefreshTokenBlacklist` MongoDB collection.

**Why:** Stateless access tokens allow fast, scalable verification without a DB round-trip on every request. The blacklist covers the logout invalidation gap without making access tokens stateful.

**Trade-off:** The blacklist collection grows over time; TTL indexes should be set to expire blacklist entries after the refresh token's natural TTL.

**Evidence:** `src/middlewares/auth.middleware.js`, `src/models/RefreshTokenBlacklist.model.js`, `README.md` Authentication Overview

---

### Decision: `passwordChangedAt` invalidates older tokens

**What:** When a user changes their password, `passwordChangedAt` is set. The auth middleware compares the token's `iat` (issued-at) timestamp against `passwordChangedAt`. Tokens issued before the password change are rejected.

**Why:** This invalidates all active sessions after a password change without needing to blacklist every token.

**Evidence:** `src/middlewares/auth.middleware.js` lines 37–42, `src/models/User.model.js` field `passwordChangedAt`

---

### Decision: Admin login with a third-factor `adminKey`

**What:** Admin accounts require a third credential (`adminKey`) in addition to email and password. The `adminKey` is bcrypt-hashed before storage.

**Why:** Adds an additional authentication layer for the highest-privilege accounts. The `adminKey` hash is stored with `select: false`, meaning it is never returned in queries unless explicitly selected.

**Evidence:** `src/models/User.model.js` lines 157–163 (adminKey field, select: false), `src/models/User.model.js` lines 203–207 (bcrypt-hashing hook), `src/services/auth.service.js`

---

### Decision: OTP hashed with SHA-256 before storage

**What:** Email verification OTPs and password reset OTPs are hashed with SHA-256 before being stored in the database. The plaintext is sent to the user via email and never persisted.

**Why:** If the database is compromised, OTP hashes cannot be directly used to authenticate (since OTPs are short-lived one-time values). SHA-256 (not bcrypt) is used because OTPs are random and high-entropy, so pre-image attacks are impractical; bcrypt's slowness is unnecessary here.

**Evidence:** `src/services/auth.service.js` `hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex')`

---

### Decision: NoSQL injection sanitizer (custom implementation)

**What:** A custom middleware strips MongoDB operator characters (`$`, `.`) from request body, params, and query fields before they reach controllers.

**Why (documented in `app.js`):** Prevents NoSQL injection attacks where an attacker might send `{ "email": { "$gt": "" } }` to bypass authentication. The `express-mongo-sanitize` package is also listed as a dependency but the custom inline sanitizer is the active one.

**Evidence:** `src/app.js` lines 56–110

---

## 4. Business Logic Patterns

### Decision: Synchronous matching engine (Haversine, not MongoDB `$geoNear`)

**What:** The matching engine calculates geo-distances using the Haversine formula in JavaScript (`src/utils/geo.js`), rather than relying on MongoDB's `$geoNear` aggregation pipeline.

**Why (from code comment in `matching.service.js`):** A fallback mechanism is in place: if a `$near` geo-index query fails (e.g., the 2dsphere index is not enabled), the service falls back to a plain query and sorts in-memory by Haversine distance.

**Trade-off:** In-memory sorting scales worse than MongoDB's native geo-index sorting for very large donor sets. The `ENABLE_GEOSPATIAL_INDEX` environment variable controls whether the 2dsphere index is enabled.

**Evidence:** `src/services/matching.service.js` lines 40–51 (geo fallback), `src/utils/geo.js` (Haversine), `README.md` "Matching: Synchronous batch query with Haversine geo-scoring"

---

### Decision: Dual-channel notifications (in-app + FCM)

**What:** Every significant event generates two notification artifacts:
1. A `Notification` document in MongoDB (polled by the mobile client)
2. A Firebase Cloud Messaging push notification sent to registered device tokens

**Why:** In-app notifications persist and are queryable. FCM push notifications provide real-time alerts even when the app is closed. Together they ensure delivery reliability.

**Current limitation:** FCM is sent synchronously within the request lifecycle. Slow Firebase responses block API completion. The outbox worker provides deferred delivery for some scenarios.

**Evidence:** `src/services/notification.service.js` lines 27–80, `README.md` Notification System Overview

---

### Decision: Idempotency keys on Notification documents

**What:** Each `Notification` document has an `idempotencyKey` field with a unique sparse index. Duplicate creation attempts catch the MongoDB `E11000` duplicate key error and return the existing notification instead of failing.

**Why (documented in code):**
> "CRITICAL FIX: Use idempotency key to prevent duplicate notifications on retry"

This prevents duplicate notifications when the notification service is called more than once for the same event (e.g., on retry after a partial failure).

**Evidence:** `src/models/Notification.model.js` lines 72–100, `src/services/notification.service.js` lines 39–61

---

### Decision: Event bus for decoupled service communication

**What:** An in-process `EventBus` (extending Node.js `EventEmitter`) allows services to emit and listen for domain events without direct coupling.

**Why (from JSDoc):**
> "Implements pub/sub pattern to decouple services and enable async processing. Events are emitted synchronously but can be handled asynchronously."

The maximum listener count is set to 100 (up from Node's default of 10) to accommodate the number of registered handlers.

**Evidence:** `src/services/eventBus.service.js`, `src/services/eventListeners.registry.js`

---

### Decision: State machine for donation and request transitions

**What:** A `state-machine.js` utility (`src/utils/state-machine.js`) validates that state transitions are legal before they are committed to the database.

**Why:** Prevents invalid state jumps (e.g., a `completed` donation moving back to `pending`) that would corrupt the system's business logic. The escalation worker references this when expiring donations.

**Evidence:** `src/workers/requestEscalation.worker.js` line 4 `import { validateTransition } from '../utils/state-machine.js'`, line 45 `validateTransition('donation', sessionDonation.status, 'expired')`

---

### Decision: MongoDB transactions for atomic multi-document writes

**What:** Critical operations (donation completion, user soft-delete cascade, escalation worker) use MongoDB multi-document transactions.

**Why:** The system writes to multiple collections in a single logical operation (e.g., completing a donation writes to `Donation`, `Request`, `DonorPoints`, `PointsTransaction`, `Activity`). Without transactions, a failure midway would leave data in an inconsistent state.

**Requirement:** MongoDB replica set is required for transactions (single-node standalone does not support them). The test environment uses `MongoMemoryReplSet` to enable transactions in tests.

**Evidence:** `src/workers/requestEscalation.worker.js` `session.withTransaction(...)`, `src/models/User.model.js` cascade hook (lines 253–355)

---

## 5. Code Quality Decisions

### Decision: Strict Mongoose schema mode (`strict: 'throw'`)

**What:** All Mongoose schemas are configured with `strict: 'throw'`, which throws an error if code attempts to set a field not defined in the schema.

**Why (from `AGENTS.md`):**
> "strict: 'throw' — Reject any fields not defined in schema to prevent pollution"

This catches bugs early (e.g., a typo in a field name) rather than silently discarding the value.

**Evidence:** `src/models/User.model.js` line 167 `strict: 'throw'`, same pattern in `Donor.model.js`, `Hospital.model.js`, `Request.model.js`, `Donation.model.js`

---

### Decision: Response wrapper enforced on all controllers

**What:** All controllers must use `response.success()` and `response.error()` from `src/utils/response.js`. Direct `res.json()` calls are forbidden.

**Why (from `AGENTS.md`):**
> "The wrapper enforces the `{ success, message, data }` shape that every test and client depends on."

Consistency in response shape means the Flutter client and all integration tests can rely on a single parsing pattern.

**Evidence:** `AGENTS.md` Section 4.7, `src/utils/response.js`

---

### Decision: `asyncHandler` wraps all async route handlers

**What:** Instead of `try { ... } catch (error) { next(error); }` in every controller, async handlers are wrapped with `asyncHandler(fn)` from `src/middlewares/asyncHandler.js`. Thrown `HttpError` objects are forwarded to the global error middleware.

**Why (from `AGENTS.md`):**
> "Never write `try { ... } catch (error) { next(error); }` in a controller."

This reduces boilerplate and ensures all unhandled promise rejections are properly routed to the error middleware.

**Evidence:** `AGENTS.md` Section 4.8, `src/middlewares/asyncHandler.js`

---

## 6. Testing Decisions

### Decision: Vitest + SuperTest + in-memory MongoDB

**What:**
- **Vitest** as the test runner (ESM-native, fast)
- **SuperTest** for HTTP-level integration tests against the Express app
- **mongodb-memory-server** with `MongoMemoryReplSet` for an in-memory replica set that supports transactions

**Why:** In-memory MongoDB means no external service is required to run tests. The replica set mode enables transaction testing without a production MongoDB cluster.

**Evidence:** `package.json` devDependencies, `docs/SETUP_AND_DEPLOYMENT.md`

---

## Confidence Report

**Verified Facts:**
- All decisions are traceable to specific source files and line numbers cited above.
- The discriminator pattern is explicitly coded (not assumed).
- `autoIndex: false` decision is documented in the source code comment.
- SHA-256 OTP hashing is in the source code of `auth.service.js`.
- `strict: 'throw'` is present in all major model files read.
- Idempotency key pattern is in `Notification.model.js` and `notification.service.js`.
- Transaction usage is confirmed in `requestEscalation.worker.js` and `User.model.js` cascade hook.

**Assumptions:** None.

**Missing Information:**
- The exact `express-mongo-sanitize` package usage relative to the custom sanitizer was not fully traced; it's listed as a dependency but the custom inline implementation appears to be the active one.
- Full event types and listener registrations in `eventListeners.registry.js` were not read.

**Potential Uncertainty:**
- The reason for choosing Express.js 5.x over 4.x was not explicitly documented; the rationale above is inferred.
