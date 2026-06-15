# LifeLink Project Status — Implementation Audit

> Forensic audit of the current implementation state. Last updated: June 2026.

---

## Summary

| Category | Status |
|----------|--------|
| **Core API** | ✅ Production-ready |
| **Auth & Security** | ✅ Production-ready |
| **Matching Engine** | ✅ Complete (sync, not geo-indexed) |
| **Notifications** | 🔶 Functional but synchronous |
| **Rewards / Gamification** | ✅ Complete |
| **Admin Panel** | ✅ Complete |
| **Hospital System** | ✅ Complete |
| **Appointment System** | ✅ Complete |
| **Analytics** | ✅ Complete |
| **Hospital Request Flow** | ✅ Complete (accept, verify QR, confirm, expire, re-broadcast) |
| **Request Escalation Worker** | ✅ Complete (arrival expiry + urgency-based rebroadcast) |
| **Testing** | 🔶 Partial coverage (721 tests, 63 files) |
| **DevOps** | ❌ Not started |
#### Async Infrastructure
- **Status**: Partial — notification outbox worker and request escalation worker implemented
- **Scope**: `src/workers/notificationOutbox.worker.js` (outbox processing) and `src/workers/requestEscalation.worker.js` (arrival expiry + re-broadcast)
- **Gap**: No Redis-based job queue (Bull/BullMQ) — workers use in-process `setInterval`
- **Impact**: Medium — suitable for single-instance deployments; needs Bull/BullMQ for horizontal scaling
- **Recommended fix**: Migrate to Bull/BullMQ with Redis for production multi-instance deployments
| **i18n** | 🔶 en.json only |

---

## Detailed Feature Audit

### ✅ FULLY IMPLEMENTED

#### Authentication System
- [x] Donor registration (email + password + blood type + location)
- [x] Email OTP verification (6-digit, 10-min TTL, SHA-256 hashed)
- [x] Login with role validation (donor / hospital / admin)
- [x] JWT access token (7d) + refresh token (30d)
- [x] Refresh token rotation with MongoDB blacklist
- [x] Password change (authenticated)
- [x] Forgot password via OTP email
- [x] Reset password with OTP verification
- [x] FCM token registration, replacement, and removal
- [x] FCM token removed on logout (fire-and-forget)
- [x] Token validation endpoint (`POST /auth/validate-token`)
- [x] Separate hospital login endpoint
- [x] Admin login with `adminKey` third-factor

#### Blood Request System
- [x] Hospital creates request (blood, plasma, platelets, blood type, urgency, quantity, location)
- [x] Request lifecycle: pending → in-progress → completed / cancelled / fulfilled
- [x] Request urgency: low / medium / high / critical
- [x] Request types: blood / plasma / platelets
- [x] Donor can browse requests (paginated, filtered by type/urgency)
- [x] Donor can view "urgent" requests (high/critical only, with declined filter)
- [x] Donor can decline urgent requests (creates cancelled Donation record)
- [x] Donor responds to request (creates pending Donation, decrements request quantity)
- [x] Auto-close request when quantity reaches 0
- [x] Hospital accepts/rejects matched donors via QR token
- [x] QR token generated per request, scanned by hospital on donation day
- [x] Request broadcast: admin can manually trigger match broadcast
- [x] **Hospital Request flow**: donor accepts → QR generated on Donation → hospital verifies QR → hospital confirms → donation/request completed atomically
- [x] **Arrival deadlines**: urgency-based windows (critical 1hr, emergency 2hr, high 4hr, medium 8hr, low 24hr)
- [x] **No-arrival timeout**: donation expired, request reopened, QR invalidated, re-broadcast to compatible donors
- [x] **Re-broadcast escalation worker**: background job processes arrival expirations and re-broadcasts pending requests based on urgency intervals
- [x] **Donor accepted-request endpoints**: GET /requests/accepted, GET /requests/accepted/:id
- [x] **Admin expire-arrival**: POST /requests/:id/expire-arrival (manual override for no-arrival timeout)
- [x] **Confirm endpoint**: POST /requests/:id/confirm — hospital confirms donor arrival, re-checks eligibility, atomic completion

#### Matching Engine
- [x] Blood-type compatibility matrix (full universal compatibility rules)
- [x] Haversine geo-distance calculation (Donor.location ↔ Hospital.lat/long)
- [x] Composite scoring: compatibility rank + distance weight
- [x] `findCompatibleDonors(request)` — used for notifications on request creation
- [x] `findCompatibleRequests(donor)` — used for `/donor/matches` endpoint
- [x] Eligibility pre-check per donor before sending notification

#### Donor Eligibility Engine
- [x] Minimum age: 17 years
- [x] Donation interval: 56 days (blood), 14 days (plasma), 7 days (platelets)
- [x] Gender-based intervals: male 84 days, female 112 days (fallback when no type)
- [x] Temporary deferral support (admin-set `temporaryDeferralUntil`)
- [x] Travel deferral: 28 days after return from malaria-risk countries (JSON dataset)
- [x] Hemoglobin level: minimum 12.5 g/dL
- [x] All rules composable via `canDonate()` — returns first failing rule

#### Notification System
- [x] Dual-channel: in-app (`Notification` doc) + FCM push
- [x] FCM multicast batch send (500 tokens per batch, auto-chunked)
- [x] Invalid token cleanup on FCM delivery failure
- [x] Notification types: match, emergency, appointment, reward, system
- [x] Notification inbox: list, mark read, mark all read, delete
- [x] Unread count endpoint
- [x] Emergency broadcast: admin sends to all donors matching blood type
- [x] `broadcastRequest`: finds compatible donors, sends match notifications
- [x] `notifyMatch`: tells hospital a donor has responded
- [x] `notifyAppointmentStatus`: appointment confirmation/cancellation notifications
- [x] Donor settings: `pushNotifications` and `emergencyAlerts` flags respected in notification logic

#### Rewards & Gamification
- [x] Points awarded on donation completion (`onDonationCompleted`)
- [x] Emergency bonus points (critical urgency multiplier)
- [x] Tier system: Bronze → Silver → Gold → Platinum (configurable thresholds)
- [x] Tier bonus on tier upgrade
- [x] Badge system: Bronze Donor, Silver Donor, Gold Donor, Platinum Donor, Super Donor, Emergency Hero, Frequent Donor, Blood Champion
- [x] Badge progress tracking (current donations vs. target)
- [x] Points history (paginated transaction ledger)
- [x] Points summary (balance, total earned, tier, next tier progress)
- [x] Rewards redemption (subtract points, log transaction)
- [x] Redemption limits (daily, monthly, per-item configurable)
- [x] Leaderboard (sorted by `pointsBalance`, configurable time window)
- [x] Admin-configurable rewards (point values, tiers, redemption limits via API)

#### Admin System
- [x] Superadmin can create, update, delete admins
- [x] Admin role permissions matrix (stored in `RolePermission` model)
- [x] User management: list, search, get details, verify, unverify, suspend, unsuspend, soft-delete
- [x] Donor management: update, ban, unban (aliases to suspend/unsuspend)
- [x] Hospital management: create, suspend, unsuspend
- [x] Request management: list, stats, details, fulfill, cancel, broadcast
- [x] System health endpoint (DB state, uptime, memory)
- [x] Maintenance mode: enable/disable with message (cached, cache invalidated on change)
- [x] Audit log: all admin actions logged with adminId, action, targetType, targetId
- [x] Analytics: dashboard summary, donation trends, blood type distribution, top donors, growth metrics
- [x] Emergency: broadcast, critical requests list, shortage alerts
- [x] Blood inventory summary (aggregated from requests)

#### Appointment System
- [x] Donor books appointment at hospital
- [x] Appointment has slot-based validation (hospital working hours + slots-per-hour config)
- [x] One active appointment per donor per hospital (unique constraint enforced)
- [x] QR token generated for each appointment (used for on-site verification)
- [x] Hospital scans QR → marks appointment as completed → donation marked complete
- [x] Appointment status: pending → confirmed → completed / cancelled
- [x] Appointment cancellation by donor
- [x] Appointment cancellation by hospital
- [x] Hospital-side appointment list with status filter

#### Analytics
- [x] Donor dashboard: name, blood type, donation status, stats, recent activity
- [x] Donor stats: total donations, points balance, lives saved estimate
- [x] Donation history (paginated, with points earned per donation via aggregation)
- [x] Admin dashboard: total users, requests, donations, critical alerts
- [x] Monthly donation trends (success rate, total units)
- [x] Blood type distribution (donor supply vs. active request demand)
- [x] Top donors (by completed donation count)
- [x] Platform growth metrics (user, request, donation growth by month)

#### Hospital Features
- [x] Hospital profile management
- [x] Hospital settings (working hours, slots per hour)
- [x] Hospital discovery / search for donors
- [x] Hospital donation history view
- [x] Hospital can accept/reject donor responses
- [x] Hospital can view matched donors for each request

#### Activity Feed
- [x] Activity logged on: donation creation, completion, cancellation, profile update, health history update, urgent request accept/decline
- [x] Latest 5 activities surfaced on donor dashboard
- [x] Full activity timeline paginated endpoint

#### Security
- [x] Rate limiting: 60 req/15min prod, 200 req/15min dev
- [x] Auth limiter: 20 req/15min prod
- [x] E2E test bypass header (`x-test-mode: true`, dev only)
- [x] Helmet security headers
- [x] CORS (configurable origin)
- [x] express-mongo-sanitize (NoSQL injection prevention)
- [x] Password hashing (bcryptjs, 10 rounds)
- [x] OTP and reset tokens hashed with SHA-256 before storage
- [x] Refresh token blacklist (MongoDB, TTL-indexed)
- [x] Soft delete: deleted users blocked at auth middleware
- [x] Admin key: third factor for admin login

---

### 🔶 PARTIALLY IMPLEMENTED / KNOWN GAPS

#### FCM Notifications — Synchronous
- **Status**: Works correctly but synchronously
- **Gap**: FCM calls are awaited in the request lifecycle. A slow Firebase response blocks request completion.
- **Impact**: High — production load with many donors can cause timeouts
- **Recommended fix**: Bull/BullMQ job queue with Redis

#### Rate Limiting — In-Memory Store
- **Status**: Works for single-instance deployments
- **Gap**: Rate limit counters live in process memory (reset on server restart)
- **Impact**: Medium — multi-instance deployments share no state
- **Recommended fix**: `rate-limit-redis` store

#### Testing Coverage
- **Status**: Infrastructure is in place (Vitest + mongodb-memory-server + supertest)
- **Gap**: Not all controllers and services have tests. Coverage percentage unknown without running `--coverage`.
- **Known tested**: Auth flows, some request flows, matching logic
- **Gap areas**: Reward service edge cases, notification delivery, appointment QR flow

#### Arabic Localization
- **Status**: `en.json` locale file exists with 40+ string keys
- **Gap**: No `ar.json` — Arabic-language clients will fall back to English keys
- **Donor settings**: `language` field exists (`en` or `ar`) but no i18n middleware consumes it at runtime

#### Webhook System
- **Status**: Route registered (`POST /api/webhooks`), controller exists
- **Gap**: No handler logic in `webhook.controller.js` — it's a stub returning 200
- **Impact**: Low (external integrations not yet required)

#### Matching — No Native Geo Index
- **Status**: Matching works via application-level Haversine math
- **Gap**: MongoDB `2dsphere` index not used for initial donor filtering. All eligible donors loaded into memory for scoring.
- **Impact**: Medium for large donor pools (1000+)
- **Recommended fix**: Add `location` field with GeoJSON format to Donor schema, add `2dsphere` index, use `$near` for pre-filtering

#### Donor Schema — Duplicate `weight` Field
- **Status**: The `Donor.model.js` schema defines `weight` twice
- **Impact**: Low — Mongoose uses the last definition, but it's confusing technical debt

---

### ❌ NOT IMPLEMENTED

| Feature | Notes |
|---------|-------|
| Docker / docker-compose | No Dockerfile or compose file |
| CI/CD pipeline | No GitHub Actions / GitLab CI config |
| Redis integration | Rate limiting and caching are in-memory only |
| Async infrastructure | Outbox worker + escalation worker (in-process setInterval) |
| Webhook handlers | Route registered but handler is a stub |
| Arabic translations | `ar.json` locale file missing |
| ML-based predictive matching | No ML model or feature |
| APM / Monitoring | No Datadog, Sentry, or equivalent integration |
| Push notification scheduling | No deferred/scheduled push support |
| Blood bank inventory tracking | Schema field `bloodBanksAvailable` exists but no inventory management API |
| Admin notifications | Admins have no FCM notification registration |
| Hospital FCM notifications | FCM is donor-focused; hospitals receive notifications only if they have `fcmTokens` |

---

## Technical Debt Summary

| Issue | Severity | Location |
|-------|----------|----------|
| Synchronous FCM calls | High | `notification.service.js` |
| In-memory rate limit store | Medium | `rateLimit.middleware.js` |
| No `2dsphere` index on Donor.location | Medium | `Donor.model.js` |
| Duplicate `weight` field in Donor schema | Low | `Donor.model.js` |
| `console.error` used instead of structured logger in some controllers | Low | `donor.controller.js`, `analytics.service.js` |
| `console.log` statements in `bookAppointment` controller (removed in Phase 3B) | Low | `appointment.controller.js` (fixed) |
| `completeDonation` controller was ~435 lines (extracted to service in Phase 3B) | Fixed | `donation-completion.service.js` |
| Duplicate eligibility reason construction (extracted to shared helper in Phase 3B) | Fixed | `eligibility-reason.js` |
| `qrExpires` vs `qrExpiresAt` field name inconsistency across models | Low | `Donation.model.js`, `Appointment.model.js` |
| Missing `ar.json` locale | Low | `src/locales/` |
| `getDonorStats` in analytics.service.js uses N+1 query (loop with `await Request.findById`) | Medium | `analytics.service.js:239` |
| `service-account.json` path may be committed to repo | Critical | `config/service-account.json` |

---

## Estimated Completion by Subsystem

| Subsystem | Complete % |
|-----------|-----------|
| Authentication | 98% |
| Donor APIs | 95% |
| Hospital APIs | 90% |
| Request Management | 95% |
| Hospital Request Flow | 95% (accept, confirm, expire, re-broadcast, QR on Donation) |
| Request Escalation Worker | 90% (arrival expiry + re-broadcast; needs Bull/BullMQ for scale) |
| Matching Engine | 80% (functional, not geo-optimized) |
| Notification System | 75% (functional, not async) |
| Rewards / Gamification | 95% |
| Admin System | 95% |
| Analytics | 90% |
| Appointment System | 90% |
| Testing | 40% |
| DevOps / Infra | 5% |
| i18n | 20% |
| Webhooks | 5% |
| **Overall** | **~85%** |

---

## Phase 1A Implementation — Status Snapshot

- Phase 1A: Completed — transactional donor accept (`respondToRequest`) implemented.
- Tests: All unit and integration tests passed (675 tests across 58 files). The concurrency integration test `concurrent-respond.integration.test.js` verifies that only one donor can accept a given `Request` under concurrent attempts.
- Remaining immediate work: Phase 1B — Notification Outbox Worker (process `NotificationOutbox` entries and deliver hospital/donor notifications asynchronously).

### Completed
- Transactional conditional accept flow implemented (Donation creation + Request conditional update + NotificationOutbox write inside a single transaction).
- Concurrency test added and executed; no orphan donations observed in tested scenarios.

### In Progress
- Migration script to dedupe existing active donations and prepare DB for creating the unique partial index.
- Staging validation on a MongoDB replica-set to confirm transaction behavior under production-like conditions.

### Remaining
- Implement and deploy the outbox worker (Phase 1B).
- Run migration in staging, create the unique partial index (donorId + requestId partial index excluding cancelled/rejected), and validate before prod rollout.
- Controlled rollout: enable Phase1A behind a feature flag, deploy worker, flip flag, monitor metrics.

### Known Risks
- Hospitals will not receive immediate notifications until the outbox worker is deployed — this is an intentional design change for Phase 1A to guarantee transactional integrity.
- Applying the unique partial index without deduplication will fail; migration must run first.
- Transactions require a MongoDB replica-set; CI/staging must mirror this to prevent surprises during production rollout.

## Phase 1B Implementation — Notification Outbox Worker

- Status: Implemented and tested (integration tests pass).
- Scope: `src/workers/notificationOutbox.worker.js` — claims `NotificationOutbox` entries, processes `type: 'request'` and `type: 'match'`, delegates delivery to the existing `notification.service`, and updates outbox status (`pending` → `sent` / `failed`).
- Retry handling: entries increment `attempts` on claim; failed attempts set `status` back to `pending` (retryable) until a configurable max attempts threshold (default 5), after which `status` becomes `failed`.
- Idempotency / duplicate prevention: worker claims entries atomically via `findOneAndUpdate` (status `pending` → `ready`) so a single worker instance processes each entry; notification creation is delegated to `notification.service`, and the outbox is marked `sent` only after successful creation.

Verification (integration test results)

- Test: `tests/integration/notificationOutbox.integration.test.js` (2 tests)
	- `processes match outbox entries and creates hospital notification` — PASS
	- `processes request outbox entries and creates donor notifications` — PASS

Run summary
- Test Files: 1 passed (1)
- Tests: 2 passed (2)

End-to-end flow validated

Donor Accept → Outbox Entry Created → Worker Processes Entry → Hospital Notification Created → Notification Delivered

Notes / Next steps
- Deploy worker as a separate process or as a background job runner; ensure claim semantics or single runner per partition to avoid duplicates.
- Instrument outbox `failed` entries and add alerting/visibility for operational monitoring.

Phase 2 Verification (live run)
- **Result**: Completed a scripted live API sequence exercising request → match → donor notification → acceptance → appointment → QR verification → donation completion → rewards.
- **Findings**: All business-flow steps passed; rewards and analytics updated as expected.
- **Minor Issue**: An asynchronous badge-check task attempted DB operations after the script disconnected the DB, producing "Client must be connected before running operations" in logs. This is non-fatal in the live run but indicates badge processing runs inline/async without lifecycle coordination.
- **Recommendation**: Ensure badge/reward post-processing is executed by a background worker or awaited before process shutdown to avoid transient DB errors.

Fixes applied (final stabilization)
- **Issue found**: Asynchronous badge processing (`checkAndUpdateBadges`) was invoked fire-and-forget from `onDonationCompleted`, allowing badge DB work to continue after the app disconnected the DB. This produced "Client must be connected before running operations" during shutdown.
- **Fix applied**: Converted the badge check to an awaited call inside `onDonationCompleted` so badge DB work completes before the donation completion flow returns. See `src/services/reward.service.js` (replaced fire-and-forget with `await checkAndUpdateBadges(donorId)` guarded by try/catch).
- **Issue found**: Outbox worker could run during shutdown and attempt DB operations after disconnect because the worker interval wasn't cleared before `disconnectDB()`.
- **Fix applied**: Stop the outbox interval during shutdown and introduce a short grace period before disconnecting DB. See `src/server.js` (clearInterval(outboxInterval) and await small delay before disconnect).

Verification result
- Re-ran full end-to-end live API sequence (hospital request → match → donor accept → appointment → QR verify → donation complete). No errors observed; donation completed, points awarded, badges unlocked, and analytics updated. Activity logs show `badge_unlocked` events and no "Client must be connected" errors after the fixes.

---

## Phase 3 — Hospital Request Flow Redesign

### Summary

Redesigned the Hospital Request donation flow so that QR generation, donation creation, and confirmation happen without appointments. The Appointment flow remains completely unchanged. Added arrival deadlines, no-arrival timeout with re-broadcast, and a background escalation worker.

### Key Changes

| Component | Change |
|-----------|--------|
| `Request` model | Added `arrivalDeadline` field |
| `Donation` model | Added `qrUsed`, `qrUsedAt`, `arrivalDeadline` fields |
| `request-timeout.constants.js` | Added `reBroadcastIntervalMs` per urgency level |
| State machine | Added `accepted→completed` for Request, `pending→completed` for Donation |
| `request-lifecycle.service.js` | QR invalidation on reject/cancel/expire, clears `arrivalDeadline` on request reopen |
| `request.controller.js` — `acceptRequest` | QR generated on Donation, arrivalDeadline set on both Donation and Request, minimal response payload |
| `request.controller.js` — `verifyQr` | Looks up Donation by qrToken, validates not expired/used, marks qrUsed, returns donation+request details |
| `request.controller.js` — `confirmRequest` | Hospital confirms donor → re-runs eligibility with `excludeDonationId` → if ineligible: rejects donation + reopens request + re-broadcasts → if eligible: atomic completion in transaction, updates lastDonationDate, fires rewards/activity/notifications. Guards: arrival deadline and QR expiry checks. |
| `request.controller.js` — `cancelRequest` | Invalidates QR on donation, clears arrivalDeadline, minimal response |
| `request.controller.js` — `expireArrival` | Admin endpoint for no-arrival timeout: expires donation, reopens request, invalidates QR, re-broadcasts |
| `request.controller.js` — `getAcceptedRequests` | `GET /requests/accepted` — donor's accepted requests with deadline status |
| `request.controller.js` — `getAcceptedRequestDetails` | `GET /requests/accepted/:id` — full details including QR, hospital info, eligibility status |
| `request.routes.js` | Added all new routes in correct order (static before `:id` patterns) |
| `requestEscalation.worker.js` | Background worker: arrival expiry processing, urgency-based re-broadcast, emergency re-broadcast |
| `server.js` | Added escalation worker interval (configurable `ESCALATION_POLL_INTERVAL_MS`, default 60s) |

### Urgency-Based Deadlines

| Urgency | Arrival Window | Re-broadcast Interval |
|---------|---------------|----------------------|
| critical | 1 hour | 15 minutes |
| emergency | 2 hours | 30 minutes |
| high | 4 hours | 1 hour |
| medium | 8 hours | 4 hours |
| low | 24 hours | 12 hours |

### Bug Fixes Applied

1. **Double reward processing** in `confirmRequest` — `onDonationCompleted` was called twice. Removed duplicate call.
2. **Missing guards** in `confirmRequest` — Added arrival deadline and QR expiry checks before allowing confirmation.
3. **Race condition prevention** — `acceptRequest` uses MongoDB transaction with `session.withTransaction` and unique partial index on `{donorId, requestId}` with filter `{status: 'pending'}`.

### Test Results

- 721 tests pass across 63 test files
- New tests: verify-qr donation-based flow, confirm flow, accepted endpoints, non-owner access denial, escalation worker (arrival expiry, re-broadcast, emergency re-broadcast)

### Next Steps

- Migrate escalation worker to Bull/BullMQ with Redis for production multi-instance deployments
- Add monitoring/alerting for escalation worker failures
- Consider WebSocket/SSE for real-time donor arrival updates
- Add i18n support for Hospital Request flow notification messages

---

## Phase 3B — Appointment Flow Clean-Code-Guard Audit

### Summary

Forensic audit of the appointment/donation verification and completion flow (the path that doesn't go through the Hospital Request `/requests/:id/accept` endpoint). Found 13 issues; fixed 9, accepted 4 as documented tech debt.

### Findings & Fixes

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| A1 | Critical | `verifyQr` appointment path: race condition — two concurrent QR scans could both pass the pre-fetch eligibility check and then both succeed because `findOneAndUpdate` used `{ _id }` instead of the atomic `{ qrToken, qrScannedAt: null }` filter | Fixed: changed to atomic `findOneAndUpdate({ qrToken, qrScannedAt: null, status: { $in: ['pending', 'confirmed'] } })` matching the donation path pattern |
| A2 | High | `confirmArrival` appointment path: `findByIdAndUpdate` with no status filter allows double-verification under concurrency | Fixed: changed to `findOneAndUpdate({ _id, verificationStatus: 'pending', qrScannedAt: { $ne: null } })` |
| A3 | High | `confirmArrival` donation path: same double-verification race as A2 | Fixed: atomic `findOneAndUpdate` with status guard |
| A4 | High | `rejectVerification` only supports appointments — no path to reject a Hospital Request donation | Fixed: added donation lookup branch with status guards + `rejectDonationLifecycle` call |
| A5 | Medium | `resetVerification` only supports appointments — no path to reset a Hospital Request donation's verification | Fixed: added donation lookup branch with state machine validation |
| A6 | Medium | `completeDonation` handler was ~435 lines (appointment + donation branches deeply nested) | Fixed: extracted into `donation-completion.service.js` with `completeAppointmentDonation` and `completeRequestDonation` functions |
| A7 | Medium | Duplicate eligibility reason construction in `completeDonation` (appointment vs donation paths) | Fixed: extracted into `eligibility-reason.js` shared helper (`buildSafetyRejectionReason`, `isDonorIneligible`) |
| A8 | Medium | `completeDonation` appointment path calls `rejectDonationLifecycle` with `donationStatus: 'rejected'` on ineligible donors | Verified safe — state machine allows `appointment.status='confirmed' → 'cancelled'` transition |
| A9 | Medium | `qrExpires` (Donation model) vs `qrExpiresAt` (Appointment model) field name inconsistency | Documented with inline comment in Donation model; API responses normalize to `qrExpiresAt`. Renaming the DB field requires a migration — tracked as post-release tech debt |
| A10 | Medium | `confirmArrival` donation path does not set `verificationSessionId` | Verified safe — `sessionId` is already set by `verifyQr`; `confirmArrival` only upgrades verification status. The `buildDonationVerificationPayload` picks up `verificationSessionId` from the populated document |
| A11 | Low | `completeDonation` goes `accepted → in-progress → completed` while Hospital Request flow goes `accepted → completed` | Intentional — appointment flow has an intermediate `in-progress` state |
| A12 | Low | `confirmArrival` donation path missing `validateOrphanState` call | Fixed: added `validateOrphanState('donation', updatedDonation)` after update |
| A13 | Low | `console.log` debug statements left in `bookAppointment` | Fixed: removed |

### Key Design Decisions

- `rejectVerification` and `resetVerification` now accept either an appointment ID or donation ID via `body.appointmentId || body.donationId || params.appointmentId`. The existing `appointmentVerify.routes.js` route `/:appointmentId/reject` and `/:appointmentId/rescan` work for both flows — the param name is cosmetic.
- `confirmArrival` already supported both appointment and donation IDs; no route change needed.
- `verifyQr` remains QR-token-based for both flows; the appointment path now uses the same atomic pattern as the donation path.

### Test Results

- 721 tests pass across 63 test files (all existing tests pass after refactoring)

### New Files

- `src/services/donation-completion.service.js` — extracted `completeAppointmentDonation` and `completeRequestDonation` from `donation.controller.js`
- `src/utils/eligibility-reason.js` — shared `buildSafetyRejectionReason` and `isDonorIneligible` helpers (formerly inline in controller)

