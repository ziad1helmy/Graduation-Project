# LifeLink Phase 03 - End-to-End Flow Audit

**Date:** May 31, 2026  
**Phase:** 03 - Flow Analysis & Business Logic Audit  
**Context:** Follows Phase 01 (API Inventory) and Phase 02 (API Duplication) audits  
**Scope:** Complete end-to-end business flows from user action to system outcome  
**Status:** Analysis and Planning Phase (No modifications performed)

---

# Executive Summary

The LifeLink backend implements **12 major business flows** spanning authentication, blood request management, donation coordination, matching, notifications, rewards, and hospital operations. 

**Overall Flow Health: GOOD** with some noted gaps and inconsistencies.

**Key Observations:**
- ✅ **Core flows are complete** — Auth, Request Lifecycle, Donation Pipeline, Matching, and Notifications all follow logical end-to-end paths
- ⚠️ **State transitions are well-controlled** via centralized state machine, but cross-entity consistency gaps exist (particularly in rejection/cancellation flows)
- ⚠️ **Several flows have incomplete error paths** — fallback behavior unclear when operations fail mid-stream
- ⚠️ **Appointment rescheduling creates branching complexity** without documented constraints
- ⚠️ **Reward calculations depend on donation completion**, but edge cases (partial donations, emergency bonuses) not fully clarified
- ⚠️ **Emergency request flow bypasses some normal matching rules** — integration with standard request flow unclear
- 🔴 **Hospital rejection flow creates orphaned donations** — re-matching logic absent, donors left in "accepted" state
- 🔴 **Activity logging is fire-and-forget** — failures don't propagate, creating audit gaps

**Severity Breakdown:**
- Critical (business flow breaks): 2
- High (incomplete flows, gaps): 4
- Medium (unclear transitions, edge cases): 5
- Low (cosmetic, performance): 3

---

# Flow Inventory

| # | Flow Name | Primary Actors | Entry Point | Exit Point | Dependencies |
|---|-----------|---------------|------------|-----------|--------------|
| 1 | Authentication & Session Management | Donor/Hospital/Admin | Login POST /auth/login | Logout POST /auth/logout | Token system, 2FA service |
| 2 | Registration & Email Verification | Donor | POST /auth/signup | Email verified, account activated | Email service, OTP system |
| 3 | Blood Request Creation & Publishing | Hospital | POST /hospital/requests | Request broadcast | Matching engine, notification service |
| 4 | Blood Request Matching | System | Automatic on request creation | Donors notified of compatible requests | Donor eligibility, matching engine |
| 5 | Donor Discovery & Browsing | Donor | GET /donor/matches | Donor selects request | Matching engine, pagination |
| 6 | Donation Acceptance & Response | Donor | POST /donor/requests/{id}/accept | Donation created, appointment scheduled | Matching validation, appointment service |
| 7 | Appointment Scheduling & Verification | Donor/Hospital | POST /appointments (book) | Appointment confirmed, QR token issued | Hospital settings, availability check |
| 8 | Donation Completion & Fulfillment | Hospital | PATCH /donations/{id}/complete | Request closed (if qty reached), points awarded | Donation status machine, reward service |
| 9 | Hospital Acceptance/Rejection Workflow | Hospital | PATCH /requests/{id}/accept-donation | Donation accepted OR returned to pending | State machine, lifecycle service |
| 10 | Notification Broadcasting | System | POST /admin/requests/{id}/broadcast | Notifications sent to eligible donors | Matching engine, notification service, FCM |
| 11 | Reward Points & Tier Progression | System | On donation completion | Points awarded, tier evaluated, badges unlocked | Reward config, badge rules |
| 12 | Emergency Request Flow | Hospital/Donor | POST /hospital/requests (critical urgency) | Urgent donors notified, fast-track response | Standard request flow + emergency prioritization |

---

# Flow Analysis

## Flow 1: Authentication & Session Management

### Purpose
Establish and maintain authenticated user sessions across three user roles (Donor, Hospital, Admin).

### Actors
- **Donor** — Self-registered blood donor
- **Hospital** — Hospital staff (created by admin)
- **Admin/Superadmin** — Platform administrators
- **System** — Token management, refresh logic

### Entry Points
- `POST /auth/login` (Donor or Hospital role)
- `POST /auth/hospital/login` (Hospital-specific endpoint)
- `POST /auth/admin/login` (Admin-specific endpoint with 3-factor auth)
- `POST /auth/signup` (Donor-only registration)

### Process Steps

```
1. Client sends credentials (email + password + role-specific fields)
2. Server validates payload:
   - Email format, password strength
   - Role validation (donor/hospital/admin)
   - Hospital-specific: hospitalId required
   - Admin-specific: adminKey (third factor) required
3. Database lookup:
   - Find user by email + role
   - Load password hash (select +password)
   - Load status flags (deletedAt, isSuspended, isEmailVerified)
4. Password verification:
   - bcrypt.compare(providedPassword, storedHash)
   - Constant-time comparison (prevents timing attacks)
5. Pre-login checks:
   - User not soft-deleted (deletedAt === null)
   - User not suspended (isSuspended === false)
   - Email verified (isEmailVerified === true)
   - For hospital: hospitalId match
6. 2FA check:
   - Query TwoFactor document for userId
   - If 2FA enabled: Return tempToken (10m scoped), requires /auth/2fa/verify
   - If 2FA disabled: Generate accessToken + refreshToken
7. Token generation (if 2FA not required):
   - accessToken: HS256, 7d TTL, payload { userId, role, iat, exp }
   - refreshToken: HS256, 30d TTL, same payload
8. Response:
   - Client receives { accessToken, refreshToken, user, hospitalId? }
   - Client stores tokens (localStorage or secure storage)
9. Optional: FCM token registration
   - Client may POST /auth/fcm-token on login for push notifications
```

### Services Involved
- **auth.service.js** — User lookup, 2FA check, token generation
- **jwt.js utility** — Token signing/verification
- **User/Hospital models** — Data retrieval
- **TwoFactor model** — 2FA state
- **RefreshTokenBlacklist model** — Blacklist check

### Database Operations
- `User.findOne({ email, role })` with password selection
- `TwoFactor.findOne({ userId })`
- `RefreshTokenBlacklist.findOne({ tokenHash })` (on refresh)
- `User.updateOne({ $push: fcmTokens })` (async on login)

### External Integrations
- None (JWT is internal)

### Exit Conditions
- ✅ **Success**: User authenticated, tokens issued
- ❌ **Failure**: Email not found (400)
- ❌ **Failure**: Wrong password (401)
- ❌ **Failure**: Email not verified (403)
- ❌ **Failure**: User suspended or deleted (401)
- ⚠️ **Conditional**: 2FA required (202 with tempToken)

### Expected Outcome
Authenticated user can make protected API requests by including `Authorization: Bearer <accessToken>` header.

### Observed Implementation
✅ **Complete and correct.** Auth flow follows standard JWT patterns with proper error handling.

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| Refresh token secret not configured in production | Code Quality | High | If `JWT_REFRESH_SECRET` not set, falls back to `JWT_SECRET`. Per [SECURITY.md](../SECURITY.md), this creates risk. |
| Password change invalidates tokens | Feature | Low | When user changes password, old tokens are checked against `passwordChangedAt` in refresh flow — good practice. |
| Admin login requires 3-factor auth | Design | N/A | Email + password + adminKey (plaintext key). Key leaked → admin compromised. See [SECURITY.md](../SECURITY.md). |
| FCM token capped at 10 per user | Design | Low | Reasonable limit prevents spam. Old tokens evicted. |

### Risks

- **High**: If refresh secret not configured, fallback to access secret reduces security. Recommend mandatory config check at startup.
- **Medium**: Admin key stored plaintext — if DB compromised, admin accounts at risk even without password.

### Open Questions

1. What is the intended behavior if `JWT_REFRESH_SECRET` is not configured? Should the system reject startup?
2. Is the 10-token cap per user appropriate for multi-device scenarios?
3. Should admin login require a TOTP-based 2FA in addition to adminKey?

---

## Flow 2: Registration & Email Verification

### Purpose
Allow new donors to self-register and verify their email address before first login.

### Actors
- **Donor** — End-user creating account
- **System** — OTP generation, email sending
- **Email service** — Firebase or SMTP

### Entry Points
- `POST /auth/signup` (public endpoint)

### Process Steps

```
1. Client submits registration data:
   - email, password, confirmPassword, role (always 'donor')
   - Donor-specific fields: phoneNumber, dateOfBirth, bloodType, gender, location
2. Validation:
   - validateRegister() runs field-by-field checks
   - Email uniqueness check in DB
   - Phone number format (11 digits)
   - Blood type in valid set (A+, A-, B+, B-, AB+, AB-, O+, O-)
   - Location coordinates normalized (supports lat/lng, latitude/longitude, nested)
3. Password hashing:
   - bcryptjs.hash(password, 10) — 10 salt rounds
4. User creation:
   - Donor.create({ email, password (hashed), phoneNumber, dateOfBirth, bloodType, gender, location })
   - User document created with role='donor' discriminator (__t='donor')
   - isEmailVerified = false (by default)
5. OTP generation:
   - user.createEmailVerificationOtp() — generates 6-digit OTP
   - OTP hashed with SHA-256 before storing (emailVerificationOtp field)
   - OTP expires in 10 minutes (emailVerificationOtpExpires field)
6. Email sending (async, fire-and-forget):
   - sendEmailVerificationEmail() called with 2-second timeout
   - If email send fails after 2s, logged as warning (does not block signup)
   - If email send succeeds, normal completion
7. Token generation:
   - Access + refresh tokens issued immediately (user logged in before email verification)
   - User can use app before verifying email
8. Response:
   - Client receives { user, accessToken, refreshToken, verificationEmail, locationRequired? }
   - locationRequired flag set if location not provided during signup
```

### Services Involved
- **auth.service.js** — Registration orchestration
- **Donor model** — User creation, OTP storage
- **mailer.js utility** — Email sending
- **jwt.js utility** — Token generation

### Database Operations
- `Donor.create({ ...fields })` — new user document
- `User.findOne({ email })` — uniqueness check
- `User.updateOne({ emailVerificationOtp, emailVerificationOtpExpires })` — via save hook

### External Integrations
- **Firebase Cloud Messaging** or **Email service** — OTP delivery (fire-and-forget, 2s timeout)

### Exit Conditions
- ✅ **Success**: User created, tokens issued, OTP sent
- ❌ **Failure**: Email already exists (400, "Email already registered")
- ❌ **Failure**: Phone validation fails (400)
- ❌ **Failure**: Blood type invalid (400)
- ⚠️ **Partial**: Email send fails but user created (tokens issued, OTP stored)

### Expected Outcome
Donor can log in immediately, but subsequent logins require email verification. OTP sent to email; donor calls `POST /auth/verify-email-otp` to mark email verified.

### Observed Implementation
✅ **Mostly complete.** One gap: **location is optional during signup but required for matching later.**

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| Email send is fire-and-forget | Design | Medium | If email service fails silently beyond 2s timeout, donor won't receive OTP. User will be confused on next login. |
| OTP expires in 10 minutes | Design | Low | Reasonable TTL. No resend limit documented. |
| Location optional at signup | Design | Medium | Signup response includes `locationRequired` flag, but no forced redirect to set location. Donor can remain without location indefinitely. |
| Tokens issued before email verified | Design | Medium | User can use app (dashboard, search) before verifying email. On next login, email verification is enforced. Inconsistent state possible. |
| Password reset creates second OTP | Design | Low | Both email verification and password reset use OTPs, but different purposes. Schema has separate fields for each. |

### Risks

- **Medium**: Location missing for donors who skip setting it post-signup. These donors cannot receive matching notifications (no coordinates). No alerting or enforcement.
- **Medium**: If email service is down during signup, users created without OTP, cannot verify on login.
- **Low**: OTP sent in plaintext email (standard but not encrypted).

### Open Questions

1. Should location be mandatory at signup, or should the app enforce it post-verification?
2. What happens if a donor never verifies their email? Can they continue using app indefinitely?
3. Should there be a resend OTP rate limit to prevent brute force?

---

## Flow 3: Blood Request Creation & Publishing

### Purpose
Allow hospitals to create blood requests and publish them to donor network for matching and response.

### Actors
- **Hospital staff** — Creates request
- **System** — Matching engine, notification broadcaster

### Entry Points
- `POST /hospital/requests` (hospital-authenticated endpoint)

### Process Steps

```
1. Hospital submits request data:
   - type: 'blood', 'plasma', or 'platelets'
   - bloodType: if type='blood', e.g. 'O+', 'AB-' (comma-separated list supported)
   - urgency: 'low', 'medium', 'high', or 'critical'
   - quantity: integer, units needed
   - description, notes (optional)
   - location (optional, defaults to hospital location)
2. Validation:
   - type is required, valid enum
   - bloodType required if type='blood'
   - urgency required, valid enum
   - quantity > 0
3. Request creation:
   - Request.create({ hospitalId, type, bloodType, urgency, quantity, ... })
   - Automatically generated fields: status='pending', createdAt
   - QR token generated (stored but not yet used)
4. Automatic matching (synchronous):
   - matchingService.findCompatibleDonors(request) called immediately
   - Returns array of eligible donors within radius
5. Notification broadcasting (async, fire-and-forget):
   - For each compatible donor:
     * Create Notification document
     * Send FCM push (with retry logic, up to 3 attempts)
     * Set notificationType: 'emergency' if urgency in ['high', 'critical']
6. Activity logging (async, fire-and-forget):
   - Log 'blood_requested' activity in Activity collection
   - Does not block request creation
7. Response:
   - Client receives { request, matchedDonorCount }
```

### Services Involved
- **request.service.js** or **hospital.controller.js** — Request creation orchestration
- **matching.service.js** — Compatible donor finding
- **notification.service.js** — Notification creation and FCM dispatch
- **activity.service.js** — Activity logging
- **Request model** — Data persistence

### Database Operations
- `Request.create({ hospitalId, type, bloodType, urgency, quantity, ... })`
- `Donor.find({ bloodType: { $in: compatibleTypes }, isAvailable, isSuspended: false, ... })` (via matching)
- `Notification.insertMany([...])` for each compatible donor
- `Activity.insertOne({ ... })` (async, fire-and-forget)

### External Integrations
- **Firebase Cloud Messaging** — Push notifications to donors

### Exit Conditions
- ✅ **Success**: Request created, donors notified (or queued for FCM)
- ❌ **Failure**: Invalid blood type (400)
- ❌ **Failure**: Hospital not found (401)
- ⚠️ **Partial**: Request created, notification fails (request persisted, FCM failed)
- ⚠️ **Partial**: Request created, activity logging fails (async failure, not raised)

### Expected Outcome
Hospital sees request confirmed with matched donor count. Donors with compatible blood type receive push notifications with request details.

### Observed Implementation
✅ **Complete.** Request creation and matching are synchronized; notifications are async (appropriate).

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| Notification failures don't block request | Design | Medium | If FCM service down, request created but donors don't get notified. No retry in UI or alerting to hospital. |
| Activity logging is async, failures ignored | Design | Medium | Activity may not be logged if service fails. Audit trail incomplete. |
| No request deduplication | Design | Low | Hospital can create duplicate requests if they retry POST. No idempotency key. |
| Emergency (critical) requests bypass some matching filters | Design | High | Emergency flow discussed separately; unclear if all normal rules apply. |
| QR token generated but timing unclear | Design | Low | QR token created at request time, but expires after appointment date + 24h. Edge case if request drags on. |

### Risks

- **High**: Emergency request matching rules not fully documented in this flow. See Flow 12.
- **Medium**: Notification failures could leave hospital unaware that request was not broadcast.
- **Low**: No rate limiting on request creation per hospital per day.

### Open Questions

1. Should notification failures retry with exponential backoff, or fail-open?
2. Is there a max limit on requests per hospital per day?
3. Should emergency requests follow different notification rules?

---

## Flow 4: Blood Request Matching

### Purpose
Identify and score donors compatible with a blood request based on blood type, location, eligibility, and preference.

### Actors
- **System** — Matching engine

### Entry Points
- **Automatic** on request creation (via Flow 3)
- **Manual** `POST /admin/requests/{id}/broadcast` (admin triggers re-match)

### Process Steps

```
1. Fetch request with populated hospital data
2. Extract hospital location (lat/lng from hospital.location or hospital fields)
3. Lookup blood type compatibility matrix:
   - For recipient blood type, find compatible donor types
   - Example: Recipient O+ → compatible donors: O+, O-
   - Example: Recipient AB+ → all types compatible
4. Database query for compatible donors:
   - Fetch Donor.find({
       bloodType: { $in: [compatible types] },
       isAvailable: true,
       isSuspended: false,
       isEmailVerified: true,
       deletedAt: null,
       role: 'donor',
       isOptedIn: true  (if donor opted out of matching, excluded)
     })
   - Result: unscored list of candidates
5. Haversine distance scoring:
   - For each donor, calculate distance from donor.location to hospital.location
   - Haversine formula: distance = 6371 * 2 * asin(sqrt(sin²(Δlat/2) + cos(lat1)*cos(lat2)*sin²(Δlng/2)))
   - If distance > MATCHING_DISTANCE_KM (default 30km), exclude
6. Eligibility check (per donor):
   - eligibilityService.canDonate(donor, request)
   - Checks: age >= 17, not temporary deferred, not travel deferred, hemoglobin >= 12.5, no active donation in progress
   - If ineligible, exclude
7. Scoring and ranking:
   - compatibilityScore = isExactMatch ? 1.0 : 0.7
   - distanceScore = max(0, 1 - distance/maxDistance)
   - finalScore = (compatibilityScore * 0.6) + (distanceScore * 0.4)
   - Sort descending by finalScore
8. Return matched donors array
```

### Services Involved
- **matching.service.js** — All matching logic
- **eligibility.service.js** — Donor eligibility evaluation
- **geo.js utility** — Haversine distance calculation

### Database Operations
- `Request.findById(requestId).populate('hospitalId')`
- `Donor.find({ bloodType: { $in: [...] }, ... })` (pre-filter query)
- `Donation.find({ donorId: { $in: [...] }, ... })` (check for active donations)
- `Appointment.find({ donorId: { $in: [...] }, ... })` (check for confirmed appointments)

### External Integrations
- None (all logic local)

### Exit Conditions
- ✅ **Success**: Array of matched donors (may be empty)
- ❌ **Failure**: Request not found (return empty array or error)
- ❌ **Failure**: Hospital location missing (matching disabled for that request)

### Expected Outcome
Matched donors array sorted by compatibility score. First N donors (typically 10–50) will receive notifications.

### Observed Implementation
✅ **Implemented and working.** Matching logic is comprehensive with proper filtering and scoring.

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| No 2dsphere geospatial index | Performance | Medium | Matching loads all compatible donors into memory, then calculates distances in app. At scale (100k+ donors), could be slow. |
| Opt-in check is simple boolean | Design | Low | Donor can opt out of matching, but no granular control (e.g., per-urgency, per-type). |
| Matching distance configurable via ENV | Design | Low | Default 30km. No per-hospital override. |
| Exact blood type match scores higher | Design | Low | Good UX — exact match donors get priority. |

### Risks

- **Medium**: Performance degradation if donor pool grows large (100k+ donors within radius).
- **Low**: Opt-in logic simple — no way for donors to opt-in to emergency requests only.

### Open Questions

1. At what donor pool size would geospatial indexing become necessary?
2. Should matching rules differ for critical vs low-urgency requests?

---

## Flow 5: Donor Discovery & Browsing

### Purpose
Allow donors to discover compatible blood requests in their area and view details.

### Actors
- **Donor** — Browsing requests

### Entry Points
- `GET /donor/matches` (paginated, filtered)
- `GET /donor/matches?type=blood&urgency=high&radius=50` (with filters)

### Process Steps

```
1. Client requests matches:
   - GET /donor/matches?page=1&limit=20&type=blood&urgency=high
   - Optional filters: type, urgency, radiusKm
2. Fetch authenticated donor:
   - Donor.findById(req.user.userId)
   - Load: location, bloodType, isOptedIn, isAvailable
3. Query active requests:
   - Request.find({
       status: { $in: ['pending', 'in-progress'] },
       type: filteredType || any,
       urgency: filteredUrgency || any,
       bloodType: compatible with donor's type
     })
4. For each request:
   - Calculate distance from donor.location to hospital.location
   - Exclude if > radiusKm (or default 30km)
   - Check eligibility: can this donor donate right now?
   - Exclude if: temporarily deferred, travel deferred, active donation in progress, ineligible
   - Check if donor already responded: Donation.findOne({ donorId, requestId, status: { $nin: [...] } })
   - Exclude if already responded (unless cancelled/rejected)
5. Score and sort:
   - By urgency (critical > high > medium > low)
   - By distance (closest first)
   - By blood type match (exact > compatible)
6. Paginate results:
   - Apply limit + skip
   - Return array of requests with metadata
7. Response:
   - Client receives { matches: [...], pagination: { page, limit, total } }
```

### Services Involved
- **donor.controller.js** — Request handling
- **matching.service.js** — Compatibility evaluation
- **eligibility.service.js** — Donor eligibility

### Database Operations
- `Donor.findById(donorId)`
- `Request.find({ status: { $in: [...] }, type: ..., urgency: ... })`
- `Donation.find({ donorId, requestId: { $in: [...] }, status: { $nin: [...] } })`
- `Appointment.find({ donorId, status: { $in: ['pending', 'confirmed'] } })`

### External Integrations
- None

### Exit Conditions
- ✅ **Success**: Array of compatible requests (may be empty)
- ❌ **Failure**: Donor not found (401)
- ❌ **Failure**: Invalid filter parameters (400)

### Expected Outcome
Donor sees list of requests they can respond to, sorted by relevance (urgency + distance).

### Observed Implementation
✅ **Complete.** Donor browse endpoint applies all filtering and eligibility checks before showing requests.

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| Donors excluded if already responded | Design | Low | Good — prevents duplicate responses. Respects cancelled/rejected donations. |
| Active appointments block new matches | Design | High | If donor has confirmed appointment for request A, they cannot match other requests. Creates mutual exclusivity. See Flow 6. |
| Pagination doesn't pre-filter on eligibility | Design | Medium | Total count may include requests donor can't actually respond to. Pagination metadata misleading. |

### Risks

- **High**: Active appointment constraint very restrictive. Donor with one confirmed appointment cannot see other requests at all. No workaround documented.
- **Medium**: Pagination total inflated by ineligible requests — UX issue if donor reaches end of results and last page is mostly excluded.

### Open Questions

1. Is the active appointment constraint intentional? Should donors be able to multi-queue?
2. Should total count be filtered to only eligible requests?

---

## Flow 6: Donation Acceptance & Response

### Purpose
Record donor's intent to respond to a blood request and create initial donation/appointment records.

### Actors
- **Donor** — Accepts request
- **System** — State machine, appointment booking

### Entry Points
- `POST /donor/requests/{requestId}/accept` (donor-authenticated)
- `POST /urgent-requests/{requestId}/accept` (emergency request, same endpoint)

### Process Steps

```
1. Fetch and validate:
   - Request.findById(requestId)
   - Donor.findById(req.user.userId)
   - Check request status in ['pending', 'in-progress']
   - Check donation count limit (if applicable)
2. Pre-flight eligibility check:
   - eligibilityService.canDonate(donor, request)
   - Verify donor not deferred, eligibility OK, hemoglobin OK
3. Check for existing response:
   - Donation.findOne({ donorId, requestId, status: { $in: ['pending', 'scheduled'] } })
   - Prevent duplicate response
4. Check for active donation in progress:
   - If active, reject: "You have an active donation in progress"
5. Create Donation record:
   - Donation.create({
       donorId, requestId, status: 'pending',
       quantity: request.quantity,
       notes: optional
     })
   - Donation persisted as 'pending' (awaiting appointment)
6. Decrement request quantity:
   - Request.updateOne({ $inc: { quantity: -1 } })
   - If quantity now <= 0, auto-close request to 'completed'
   - Request accepted only once (acceptedDonorId, acceptedBy, acceptedAt set)
7. Validate state machine:
   - validateTransition('donation', null, 'pending') — donation is new
   - validateTransition('request', request.status, 'accepted') — request transitions
8. Create linked Appointment (auto-booked):
   - Appointment.create({
       donorId, hospitalId, requestId,
       appointmentDate: calculated from hospital settings + request urgency
       status: 'pending'
     })
   - QR token generated for verification
9. Log activity (async, fire-and-forget):
   - Activity logged as 'response', 'emergency_response' if urgent
   - Referenced to donation._id
10. Create notification to hospital (async):
   - Hospital notified: "A donor accepted your request"
   - Includes donor name, blood type (if shown), status
11. Response to donor:
   - Client receives { request, donation, appointment, ... }
```

### Services Involved
- **donor.controller.js** — Request handling
- **donation.service.js** — Donation creation
- **appointment.service.js** — Appointment auto-booking
- **matching.service.js** — Eligibility check
- **request-lifecycle.service.js** — State validation
- **notification.service.js** — Hospital notification
- **activity.service.js** — Activity logging

### Database Operations
- `Request.findById(requestId)` 
- `Donation.findOne({ donorId, requestId, status: { $in: [...] } })`
- `Donation.create({ donorId, requestId, status: 'pending', ... })`
- `Request.updateOne({ $inc: { quantity: -1 }, status: 'accepted', acceptedAt, ... })`
- `Appointment.create({ donorId, hospitalId, requestId, ... })`
- `Notification.insertOne({ ... })` (async)
- `Activity.insertOne({ ... })` (async)

### External Integrations
- **Push notification** — Hospital notified (optional, fire-and-forget)

### Exit Conditions
- ✅ **Success**: Donation created (pending), appointment booked, request accepted
- ❌ **Failure**: Request not found (404)
- ❌ **Failure**: Donor ineligible (400)
- ❌ **Failure**: Already responded (400)
- ❌ **Failure**: Active donation in progress (409)
- ⚠️ **Partial**: Donation created, appointment booking fails, notifications fail (async, not raised)

### Expected Outcome
Donor has 'pending' donation linked to request. Appointment created for specified date. Request status changes to 'accepted' with this donor marked. Donor can now schedule/reschedule appointment, or hospital can accept/reject on donation day.

### Observed Implementation
✅ **Mostly complete.** One issue: **Hospital rejection creates orphaned donation.**

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| Request auto-closes at quantity=0 | Design | Low | Good — prevents overbooking. Multiple donors can accept same request up to quantity. |
| Appointment auto-created in 'pending' | Design | Low | Donor must confirm appointment later via verification flow. Reasonable two-step process. |
| Request marked 'accepted' once | Design | High | Only first donor to accept gets marked as 'accepted'. Subsequent donors create donations but don't change request state. Unclear in code. |
| Active donation blocks new responses | Design | High | If donor has pending/scheduled donation, cannot respond to other requests. Mutual exclusivity enforced by eligibility check. |

### Risks

- **Critical (Business Logic Break)**: Hospital rejection (Flow 9) doesn't re-open request for new donors. Donation cancelled, but request stays 'pending' with acceptedDonorId orphaned. No re-matching triggers. Donors unable to respond to request that was "rejected" by hospital.
- **High**: Active donation constraint prevents multi-queuing. Donors cannot apply to multiple requests.
- **Medium**: Appointment failures not propagated. Donation created but appointment fails silently.

### Open Questions

1. When hospital rejects a donation mid-flow, should request re-open for other donors?
2. Is the "one active donation" constraint documented in business rules?
3. Should appointment creation failures roll back donation creation?

---

## Flow 7: Appointment Scheduling & Verification

### Purpose
Allow donors to schedule and confirm appointments at hospital, with QR-based verification on donation day.

### Actors
- **Donor** — Books appointment
- **Hospital** — Verifies QR code on donation day
- **System** — Slot availability, QR token validation

### Entry Points
- `POST /appointments/book` (donor books appointment)
- `PATCH /appointments/{id}/confirm` (donor confirms appointment)
- `POST /appointments/verify-qr` (hospital scans QR on donation day)

### Process Steps

**Step 1: Book Appointment**
```
1. Donor submits appointment booking request:
   - appointmentDate (must be future, within hospital max-advance-days)
   - hospitalId (optional if already linked to request)
   - donationType (Whole Blood, Plasma, Platelets, Double Red Cells)
2. Fetch hospital and settings:
   - Hospital.findById(hospitalId)
   - HospitalSettings.findOne({ hospitalId })
   - Extract appointment window, daily capacity, hourly slots
3. Validate appointment date:
   - Must be within hospital working days (e.g., Mon-Sat)
   - Must be within opening hours (e.g., 09:00–17:00)
   - Must be >= minAdvanceHours from now (e.g., 0, same-day OK)
   - Must be <= maxAdvanceDays from now (e.g., 30 days out)
4. Check slot availability:
   - Query appointments for appointmentDate at hospital
   - Count booked appointments per hour
   - Ensure booked < hourlyCapacity
   - If full, suggest next available hour
5. Eligibility re-check:
   - Verify donor still eligible (can change between accept and booking)
   - Age, deferral, hemoglobin still OK
6. Create appointment:
   - Appointment.create({
       donorId, hospitalId, requestId, appointmentDate,
       status: 'pending',
       donationType: normalized,
       qrToken: crypto.randomBytes(32).toString('hex'),
       qrExpiresAt: appointmentDate + 24h
     })
7. Link donation:
   - Donation.updateOne({ $set: { appointmentId, status: 'scheduled' } })
8. Response:
   - Client receives { appointment, qrCode, donationType, rescheduleCount, ... }
```

**Step 2: Confirm Appointment**
```
1. Donor calls PATCH /appointments/{id}/confirm
2. Validate appointment state:
   - status must be 'pending'
   - appointmentDate in future
3. Update status:
   - Appointment.updateOne({ status: 'confirmed' })
   - Donation.updateOne({ status: 'scheduled' })
4. Optional: Send reminder notification
5. Response:
   - Client receives { appointment: confirmed }
```

**Step 3: Hospital Verifies on Donation Day**
```
1. Hospital staff scans QR code at appointment time
   - POST /appointments/verify-qr { qrToken }
2. Validate QR token:
   - Appointment.findOne({ qrToken })
   - Check qrExpiresAt > now (token not expired)
   - Check status = 'confirmed' (appointment is valid)
   - Check appointmentDate is today (within bounds)
3. Mark QR scanned:
   - Appointment.updateOne({ qrScannedAt: now })
4. Donation transitions:
   - Donation can now be marked as 'completed' by hospital
5. Response:
   - Client receives { appointment, donation, ready_to_complete: true }
```

### Services Involved
- **appointment.service.js** — Availability, slot management, booking
- **donor.controller.js** — API handling
- **eligibility.service.js** — Re-check before confirmation
- **Appointment model** — Data persistence

### Database Operations
- `Hospital.findById(hospitalId)`
- `HospitalSettings.findOne({ hospitalId })`
- `Appointment.find({ hospitalId, appointmentDate: { $gte, $lt } })`
- `Appointment.create({ ... })`
- `Donation.updateOne({ appointmentId, status: 'scheduled' })`

### External Integrations
- None (QR verification local)

### Exit Conditions
- ✅ **Success**: Appointment booked and confirmed
- ❌ **Failure**: Hospital not found (404)
- ❌ **Failure**: No slots available (409)
- ❌ **Failure**: Donor ineligible (400)
- ❌ **Failure**: QR token expired (401)
- ❌ **Failure**: QR token invalid (404)

### Expected Outcome
Donor has confirmed appointment on specified date at hospital. Hospital has QR token to verify on donation day. Appointment can be rescheduled or cancelled within constraints.

### Observed Implementation
✅ **Mostly complete.** Slot availability, QR generation, and confirmation flow implemented.

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| Appointment rescheduling allowed | Design | Medium | Donors can reschedule up to MAX_RESCHEDULES (default 3). Each reschedule creates new QR token. Old tokens invalidated. |
| Slot availability checked per hour | Design | Low | Good — prevents double-booking within hour. Capacity constraints enforced. |
| QR token expires 24h after appointment | Design | Low | Reasonable buffer for same-day verification. |
| Eligibility re-checked at booking | Design | Low | Good practice — donor status may change between accept and booking. |
| Hospital settings fetched per booking | Performance | Low | Settings lookups could be cached. Minor optimization. |

### Risks

- **Medium**: Rescheduling complexity. Each reschedule creates new QR, old one invalidated. Edge case: what if hospital scans old QR? (Should fail with "token invalid".)
- **Low**: Slot availability might get out of sync if appointments created outside normal flow (e.g., admin creates).

### Open Questions

1. What happens if hospital tries to verify QR on a day other than appointmentDate?
2. Is there a limit on same-day rescheduling (e.g., must reschedule >6 hours before)?
3. Should appointment cancellation refund points if donor earned any?

---

## Flow 8: Donation Completion & Fulfillment

### Purpose
Record that donation was completed, mark request as fulfilled (if quantity reached), award points, and update donor tier.

### Actors
- **Hospital** — Marks donation as completed
- **System** — Points calculation, request closure, activity logging

### Entry Points
- `PATCH /donations/{id}/complete` (hospital-authenticated)

### Process Steps

```
1. Hospital submits donation completion:
   - donationId, optional feedback (notes, bloodQuality)
2. Fetch donation:
   - Donation.findById(donationId)
   - Verify status = 'scheduled' (must be confirmed appointment)
3. Fetch linked request:
   - Request.findById(donation.requestId)
4. Validate state machine:
   - validateTransition('donation', 'scheduled', 'completed')
   - Update donation.status = 'completed'
   - Update donation.completedDate = now
5. Update request:
   - Request.updateOne({ quantity: $inc: -1 })
   - If quantity now <= 0, mark request.status = 'completed'
   - Request.updateOne({ completedAt: now })
6. Update donor stats:
   - Donor.updateOne({
       lastDonationDate: now,
       $inc: { totalDonations: 1 }
     })
7. Award points (async):
   - rewardService.onDonationCompleted(donorId, donationId, isEmergency?)
   - Points = POINTS_BY_TYPE[requestType] * (1 + emergencyBonus)
   - Calls awardPoints(donorId, amount, 'DONATION', ...)
   - Checks tier eligibility, unlocks badges
8. Log activity (async, fire-and-forget):
   - Activity.insertOne({ type: 'donation_completed', ... })
9. Optional: Send thank you notification
   - Notification to donor: "Donation received, X points awarded"
10. Response:
   - Client receives { donation: completed, request: updated, pointsAwarded, newBadges: [] }
```

### Services Involved
- **donation.service.js** — updateDonationStatus
- **reward.service.js** — Points awarding, tier calculation, badge unlock
- **request-lifecycle.service.js** — State validation
- **activity.service.js** — Activity logging
- **notification.service.js** — Thank you notification

### Database Operations
- `Donation.updateOne({ status: 'completed', completedDate })`
- `Request.updateOne({ quantity: $inc: -1, status: 'completed'? completedAt? })`
- `Donor.updateOne({ lastDonationDate, $inc: { totalDonations } })`
- `DonorPoints.updateOne({ $inc: { pointsBalance, lifetimePointsEarned } })`
- `PointsTransaction.insertOne({ ... })`
- `UserBadge.insertMany([...])` if badges unlocked
- `Activity.insertOne({ ... })` (async)

### External Integrations
- None (internal)

### Exit Conditions
- ✅ **Success**: Donation marked completed, points awarded, request closed if quantity=0
- ❌ **Failure**: Donation not found (404)
- ❌ **Failure**: Donation status not 'scheduled' (409)
- ❌ **Failure**: Request not found (500 — should not happen)
- ⚠️ **Partial**: Points awarded, activity logging fails (async, not raised)
- ⚠️ **Partial**: Badges unlocked, notification fails (async)

### Expected Outcome
Donation is complete, points transferred to donor account, tier evaluated, badges checked, request closed (if all units received), activity logged.

### Observed Implementation
✅ **Complete.** Points flow, tier progression, badge unlocking all implemented.

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| Emergency bonus is +50% points | Design | Low | Critical urgency requests award 50% more points. Encourages emergency response. |
| Activity logging is async, failures ignored | Design | Medium | If activity service fails, completion still succeeds. Audit trail incomplete. |
| Points awarded even if donation had feedback issues | Design | Medium | No quality gates — if blood quality marked poor, still awarded full points. |
| Request closes when quantity reaches 0 | Design | Low | Good — auto-closes request to prevent orphaned quantities. |
| Tier promotion triggers badge unlock | Design | Low | Good — tier bonus points awarded separately from badge bonuses. |

### Risks

- **Medium**: Activity logging failures create audit gaps. Hospital won't know if logging failed.
- **Medium**: No feedback mechanism for blood quality. Poor-quality donations still credited.
- **Low**: Deduplication of points awards relies on referenceId uniqueness. If donation completed twice (retry), points awarded twice.

### Open Questions

1. Should there be a quality gate? If blood marked as unsuitable, should points still be awarded?
2. If donation completion fails after points awarded, what is the rollback mechanism?
3. Should tier bonus points (e.g., +50 on reaching Platinum) be combined with donation points or separate?

---

## Flow 9: Hospital Acceptance/Rejection Workflow

### Purpose
Allow hospital to validate donations on the day and accept/reject donors' responses.

### Actors
- **Hospital staff** — Reviews donation on collection day, accepts or rejects
- **System** — State machine, re-matching (if rejection), notifications

### Entry Points
- `PATCH /donations/{id}/accept` (hospital accepts donation as valid)
- `PATCH /donations/{id}/reject` (hospital rejects donation for any reason)

### Process Steps

**Hospital Accepts Donation:**
```
1. Hospital marks donation as accepted after QR scan:
   - PATCH /donations/{id}/accept
2. Donation state validation:
   - Donation.findById(donationId)
   - Must be in 'scheduled' status (appointment confirmed)
   - Must have qrScannedAt (QR verified)
3. State machine transition:
   - validateTransition('donation', 'scheduled', 'accepted')
   - Donation.updateOne({ status: 'accepted', acceptedAt: now })
4. Update request:
   - Request stays in current state (pending/accepted/in-progress)
5. Notification to donor:
   - "Your donation was accepted!"
6. Response:
   - Client receives { donation: accepted }
```

**Hospital Rejects Donation:**
```
1. Hospital marks donation as rejected:
   - PATCH /donations/{id}/reject { reason }
2. Donation state validation:
   - Must be in 'scheduled' status
3. State machine transition:
   - validateTransition('donation', 'scheduled', 'rejected')
   - Donation.updateOne({ status: 'rejected', rejectedAt: now, rejectionReason: reason })
4. Request re-evaluation:
   - Request.findById(donation.requestId)
   - ❌ BUG: Request does NOT re-open or re-broadcast
   - Request remains in 'accepted' state with orphaned acceptedDonorId
5. Appointment cancellation:
   - Appointment.updateOne({ status: 'cancelled' })
6. Donor notification:
   - "Your donation was rejected: {reason}"
7. Activity logging:
   - Activity logged as 'donation_rejected' (async, fire-and-forget)
8. Response:
   - Client receives { donation: rejected }
```

### Services Involved
- **donation.service.js** — Donation state updates
- **request-lifecycle.service.js** — State machine validation
- **notification.service.js** — Donor rejection notification
- **activity.service.js** — Rejection logging

### Database Operations
- `Donation.updateOne({ status: 'accepted'|'rejected', ... })`
- `Appointment.updateOne({ status: 'cancelled' })` (on rejection)
- `Request.findById(requestId)` (on rejection, but NO UPDATE)
- `Notification.insertOne({ userId: donorId, ... })` (async)

### External Integrations
- **Push notification** — Rejection message to donor

### Exit Conditions
- ✅ **Success (Accept)**: Donation marked accepted
- ✅ **Success (Reject)**: Donation marked rejected, appointment cancelled, donor notified
- ❌ **Failure**: Donation not found (404)
- ❌ **Failure**: Donation not in 'scheduled' status (409)

### Expected Outcome
Donation accepted or rejected. On rejection, request should re-open or re-broadcast to find alternative donors. **Currently, request remains in orphaned state.**

### Observed Implementation
❌ **Incomplete.** Hospital rejection does NOT trigger re-opening or re-broadcasting of request. Request remains 'accepted' with cancelled donation orphaned.

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| REQUEST ORPHANED ON DONATION REJECTION | Design | **CRITICAL** | When hospital rejects a donation, request stays 'accepted' with acceptedDonorId orphaned. Request doesn't re-open or re-broadcast. Stuck state. |
| No re-matching after rejection | Design | **CRITICAL** | No mechanism to find replacement donor for rejected donation. Hospital must manually create new request. |
| Rejection reason stored but unused | Design | Low | Reason logged, but no analytics or alerts on rejection patterns. |
| Appointment automatically cancelled | Design | Low | Good — cascading cancellation prevents dangling appointments. |
| Donor not re-offered on rejection | Design | **CRITICAL** | Donor marked as rejected for this request forever. If they re-qualify, can't re-apply. |

### Risks

- **CRITICAL**: Orphaned request states create confusion. Hospital can't find replacement donor. Donor stuck unable to re-apply if initially rejected.
- **CRITICAL**: No rollback from 'accepted' to 'pending'. Request quantitiy already decremented; re-opening would require reverse logic.
- **High**: If rejection reason indicates donor made a mistake (vs hospital inventory issue), donor is unfairly penalized.

### Open Questions

1. Should rejection automatically re-open the request for other donors?
2. Should rejected donors be allowed to re-apply immediately, or after a cooldown?
3. Should rejection create an audit trail for hospital tracking?
4. Is there a business reason to orphan the request vs re-opening it?

---

## Flow 10: Notification Broadcasting

### Purpose
System-wide broadcasting of blood requests to eligible donors via in-app and push notifications.

### Actors
- **Admin** — Manually triggers broadcast
- **System** — Matching engine, FCM dispatcher

### Entry Points
- `POST /admin/requests/{id}/broadcast` (admin-only endpoint)

### Process Steps

```
1. Admin initiates broadcast for a request:
   - POST /admin/requests/{id}/broadcast { requestId }
2. Fetch request:
   - Request.findById(requestId).populate('hospitalId')
3. Find compatible donors (matching service):
   - matchingService.findCompatibleDonors(request)
   - Returns array of eligible, nearby donors
4. For each compatible donor:
   - Create in-app Notification:
     * userId: donor._id
     * type: 'request' | 'emergency' (based on urgency)
     * title: formatted request info
     * body: donor-friendly message
     * data: structured request metadata
5. Send FCM push (async, retries):
   - For each notification:
     * Send push with 3 retry attempts
     * Exponential backoff (200ms, 400ms, 800ms)
     * Fire-and-forget (don't wait for all to complete)
6. Activity logging (async):
   - Activity logged as 'request_broadcast', with donor count
7. Response:
   - Client receives { request, donorsNotified: N, pushAttempts: M }
```

### Services Involved
- **admin.service.js** — Broadcast coordination
- **matching.service.js** — Compatible donor finding
- **notification.service.js** — In-app notification + FCM dispatch
- **activity.service.js** — Audit logging

### Database Operations
- `Request.findById(requestId).populate('hospitalId')`
- `Donor.find({ bloodType: { $in: [...] }, ... })` (via matching)
- `Notification.insertMany([...])` — batch insert for all compatible donors
- `Activity.insertOne({ ... })` (async)

### External Integrations
- **Firebase Cloud Messaging** — Push dispatch (up to 3 retries)

### Exit Conditions
- ✅ **Success**: Notifications created, FCM initiated (may still fail async)
- ❌ **Failure**: Request not found (404)
- ⚠️ **Partial**: Notifications created, FCM fails (async, not raised)

### Expected Outcome
All compatible donors receive in-app and push notification about blood request. Donors can tap notification to view request details and respond.

### Observed Implementation
✅ **Complete.** Broadcasting works end-to-end with matching and notification dispatch.

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| Manual broadcast separate from auto-broadcast | Design | Low | Request creation triggers automatic broadcast. Admin can manually trigger for re-matching. Good separation. |
| FCM failures don't block request | Design | Medium | If push service down, in-app notifications created but push dispatch fails. Donors may not see urgent requests. |
| No deduplication for donors already notified | Design | Medium | If request broadcast twice (manual + auto), donors get duplicate notifications. |

### Risks

- **Medium**: Duplicate notifications if broadcast called multiple times accidentally.
- **Medium**: FCM service failure leaves donors unaware of critical requests.

### Open Questions

1. Should there be a broadcast deduplication check (e.g., don't re-broadcast if < 1 hour since last)?
2. Should failed broadcasts queue for retry later?

---

## Flow 11: Reward Points & Tier Progression

### Purpose
Track donor engagement through points accumulation, tier advancement, and badge unlocking.

### Actors
- **Donor** — Performs donation actions
- **System** — Points calculation, tier evaluation, badge unlock

### Entry Points
- **Automatic** on donation completion (Flow 8)
- `GET /rewards/points` — View current points
- `GET /rewards/badges` — View earned badges
- `POST /rewards/redemptions` — Redeem points for rewards

### Process Steps

**Points Awarding:**
```
1. Donation marked as completed (Flow 8)
2. System calls rewardService.onDonationCompleted(donorId, donationId, isEmergency)
3. Calculate points:
   - Base: POINTS_BY_TYPE[requestType]
   - Plasma: 150, Blood: 200, Platelets: 175, Double Red Cells: 175
   - Emergency bonus: +50% if urgency = 'critical'
   - Example: 200 points base + 100 bonus (emergency) = 300 total
4. Deduplication check:
   - PointsTransaction.findOne({ donorId, referenceId: `donation_${donationId}`, transactionType })
   - If exists, skip (already awarded)
5. Award atomically:
   - DonorPoints.updateOne({ $inc: { pointsBalance, lifetimePointsEarned } })
   - PointsTransaction.insertOne({ ... }) (audit trail)
6. Evaluate tier promotion:
   - currentTier = getTierForPoints(account.lifetimePointsEarned, config.tiers)
   - If newTier > oldTier:
     * Award tier bonus points (e.g., +50 on Silver promotion)
     * Create second PointsTransaction for tier bonus
     * Log activity 'tier_promotion'
7. Check badge unlocks:
   - For each badge in SEED_BADGES:
     * Count completed donations for donor
     * Check badge.unlockThreshold
     * If threshold met and badge not yet earned, award:
       * Create UserBadge record
       * Award badge bonus points (if any)
       * Create PointsTransaction for badge bonus
8. Notify donor:
   - Send notification: "X points earned! You reached [Tier]!" (async)
```

**Point Redemption:**
```
1. Donor views reward catalog:
   - GET /rewards/catalog
   - Returns list of RewardCatalog entries with pointsCost
2. Donor selects reward to redeem:
   - POST /rewards/redemptions { rewardId }
3. Validate:
   - RewardCatalog.findById(rewardId)
   - Verify donor.pointsBalance >= reward.pointsCost
   - Check redemption limits (daily, monthly)
4. Deduct points:
   - DonorPoints.updateOne({ $inc: { pointsBalance: -pointsCost } })
   - PointsTransaction.insertOne({ transactionType: 'REDEMPTION', pointsAmount: -pointsCost })
5. Create redemption record:
   - RewardRedemption.insertOne({ donorId, rewardId, redeemedAt })
6. Send confirmation:
   - Notification: "Reward redeemed! Check email for details"
   - Email with voucher code / reward details (async)
7. Response:
   - Client receives { redemption, remainingPoints, nextReward }
```

### Services Involved
- **reward.service.js** — Points calculation, tier eval, badge unlock, redemption
- **rewardsConfig.service.js** — Config lookup (tiers, point values)
- **DonorPoints, PointsTransaction, UserBadge, RewardRedemption models** — Data persistence
- **notification.service.js** — Tier/badge achievement notifications

### Database Operations
- `DonorPoints.findOneAndUpdate({ $inc: { pointsBalance, lifetimePointsEarned } })`
- `PointsTransaction.insertOne({ ... })` (one or more entries per award)
- `UserBadge.insertMany([...])` (on badge unlock)
- `RewardCatalog.findById(rewardId)`
- `RewardRedemption.insertOne({ ... })`

### External Integrations
- None (internal)

### Exit Conditions
- ✅ **Success (Award)**: Points awarded, tier evaluated, badges checked
- ✅ **Success (Redeem)**: Points deducted, reward record created
- ❌ **Failure (Redeem)**: Insufficient points (400)
- ❌ **Failure (Redeem)**: Daily/monthly limit exceeded (429)
- ⚠️ **Partial**: Points awarded, notification fails (async)

### Expected Outcome
Donor's point balance increases, tier advances (with bonus points), badges unlocked (with bonus points), and notifications sent. Donor can redeem accumulated points for catalog rewards.

### Observed Implementation
✅ **Complete.** Points flow, tier logic, badge unlock all implemented and tested.

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| Emergency donations worth +50% more | Design | Low | Good incentive for urgent response. Encourages critical donation participation. |
| Tier bonuses awarded on promotion | Design | Low | Good UX — donors feel rewarded for reaching new tier. |
| Badge thresholds fixed in seed data | Design | Medium | Badges hardcoded (First Timer: 1 donation, Legend: 50 donations). No admin config. Inflexible. |
| Redemption limits per reward | Design | Low | Daily/monthly caps prevent abuse (e.g., redeeming all Movie Tickets in one day). |
| Deduplication by referenceId | Design | Low | Same donation won't award points twice, even if completion called twice. Idempotent. |

### Risks

- **Medium**: Badge thresholds not configurable. If LifeLink wants to adjust difficulty, code change required.
- **Low**: Points awarded even for partial/cancelled donations if "completed" status set prematurely.

### Open Questions

1. Should badge thresholds be configurable by admin?
2. Should partial donations award partial points, or all-or-nothing?
3. Should tier demotion be possible if points-used (redemption)?

---

## Flow 12: Emergency Request Flow

### Purpose
Fast-track high-urgency blood requests (high, critical) to prioritized donors with expedited notification and response.

### Actors
- **Hospital** — Creates request with critical urgency
- **System** — Matching engine, emergency notification broadcaster
- **Donor** — Receives emergency alert, responds quickly

### Entry Points
- `POST /hospital/requests` with `urgency: 'critical'` or `urgency: 'high'` (same endpoint as normal requests)
- `POST /urgent-requests/{id}/accept` (donor accepts emergency)

### Process Steps

**Emergency Request Creation:**
```
1. Hospital creates request with urgency='critical' or 'high' (Flow 3)
2. Request.create({ hospitalId, type, bloodType, urgency: 'critical', ... })
3. Matching engine treats emergency differently:
   - ⚠️ Unclear: Do emergency requests bypass some matching rules?
4. Notification broadcaster marks notifications as 'emergency' type:
   - notificationType = 'emergency' (vs 'request')
   - Emergency notification data includes: urgent flag, fast-track routing
5. FCM payload includes:
   - PRIORITY: high (vs default)
   - ACTION_IDS: ['accept', 'view'] (no 'decline' action per code)
6. Donors receive urgent notification with Accept/View buttons
```

**Emergency Donor Response:**
```
1. Donor taps notification or navigates to /urgent-requests
2. GET /urgent-requests (lists high/critical requests, paginated)
3. GET /urgent-requests/{id} (view request details)
4. POST /urgent-requests/{id}/accept:
   - Same logic as normal donation accept (Flow 6)
   - Donation created, appointment booked
5. Activity logged as 'emergency_response' (vs 'response')
6. Donor receives confirmation: "Emergency request accepted!"
```

**Emergency Decline (Removed in Phase 7):**
```
1. ⚠️ Note: Per code, 'decline' action removed in Phase 7
2. Old flow: Donor could decline emergency, creating cancelled Donation record
3. Current: Donors must accept or ignore (no explicit decline)
```

### Services Involved
- **request.service.js** — Request creation (same for normal/emergency)
- **matching.service.js** — Matching (unclear if modified for emergency)
- **notification.service.js** — Emergency notification content, FCM priority
- **donor.controller.js** — Emergency list/browse/accept endpoints
- **emergency-notification.js utility** — Notification formatting

### Database Operations
- Same as Flow 3 + Flow 6 (no difference in models)

### External Integrations
- **Firebase Cloud Messaging** — High-priority push notification

### Exit Conditions
- ✅ **Success**: Emergency request created, urgent donors notified
- ✅ **Success**: Donor accepts, appointment booked
- ⚠️ **Unclear**: What rules differ from normal requests?

### Expected Outcome
Emergency requests surface prominently in donor UI, recipients notified with high FCM priority, responses tracked separately as emergency contributions.

### Observed Implementation
⚠️ **Partially Unclear.** Emergency requests are created and notified, but integration with standard request flow is unclear.

### Findings

| Finding | Type | Severity | Details |
|---------|------|----------|---------|
| Emergency = high/critical urgency | Design | Low | Clear trigger: urgency field. No separate 'isEmergency' flag needed. |
| Emergency notifications have high priority | Design | Low | Good — FCM high-priority ensures delivery. |
| Decline action removed in Phase 7 | Design | Medium | Old workflow had decline option. Current: no explicit decline. Donors can ignore. Affects analytics. |
| Matching rules same for emergency | Design | **HIGH** | No evidence that emergency requests bypass normal eligibility/distance checks. Unclear if intentional. |
| Emergency response points +50% bonus | Design | Low | Good incentive. Encourages critical donation response. |

### Risks

- **High**: If emergency requests follow same matching rules as normal, matching distance constraint (30km) may exclude eligible nearby donors who should be prioritized for emergencies.
- **Medium**: Removed decline flow means no explicit "I can't help" signal from donors. Activity doesn't capture decline intention.
- **Medium**: Emergency request state machine same as normal — unclear if 'critical' should have different lifecycle.

### Open Questions

1. Should emergency requests ignore distance constraints to reach more donors?
2. Should emergency requests trigger different notification cadence (e.g., re-broadcast every 5min)?
3. Should emergency response be tracked separately for analytics/recognition?

---

# Flow Completeness Review

## Missing Steps / Gaps

| Gap | Impact | Severity |
|-----|--------|----------|
| Donation rejection doesn't re-open request | Request stuck in 'accepted' with cancelled donation orphaned. No replacement donor mechanism. | **CRITICAL** |
| Error recovery paths not fully documented | When operations fail (email send, FCM dispatch, appointment booking), fallback behavior unclear. | High |
| Appointment rescheduling constraints unclear | Can donors reschedule same-day? What if hospital marks donation complete before reschedule? | High |
| Emergency requests don't override distance constraint | Unclear if emergency requests bypass 30km matching radius. Code doesn't show difference. | High |
| Cross-entity state validation incomplete | Request, Donation, Appointment states must be synchronized. Validation rules incomplete (e.g., what if Donation 'completed' but Request still 'pending'?). | High |
| Activity logging is fire-and-forget | Failures in activity service don't propagate. Audit trail may be incomplete. No alerting. | Medium |
| Donor can't re-apply after rejection | Once rejected by hospital, donor can't re-apply to same request. No re-matching mechanism. | Medium |
| Location requirement not enforced | Donors can sign up without location. Later blocked from matching. No UX flow to update. | Medium |
| Appointment cancellation by donor not implemented | Code shows appointment model supports cancellation, but no endpoint for donor to cancel. | Medium |

---

# Flow Consistency Review

## Inconsistencies Across Flows

| Inconsistency | Type | Severity | Details |
|---|---|---|---|
| Request state naming | Semantic | Low | Called both 'status' and 'state' in documentation and code. Should standardize. |
| Donation state names | Semantic | Low | 'pending' (waiting for appointment) vs 'scheduled' (appointment confirmed) — names not intuitive. |
| Fire-and-forget error handling | Async handling | High | Activity, notifications, emails all fire-and-forget. Failures silent. Inconsistent with critical vs non-critical operations. |
| Points calculation | Business logic | Medium | Emergency donations get +50% bonus. Unclear if tier bonuses compound or replace. Tested but not documented. |
| Matching distance enforcement | Geo logic | High | Matching service enforces 30km default, but no override for emergency. Inconsistent rule application. |
| Eligibility check timing | Validation | Medium | Eligibility checked at accept time and at appointment booking time. Could pass one but fail other. Re-check not documented. |
| Role-based access control | Authorization | Low | Some endpoints use `requireRole('donor')` middleware; others implicit. Inconsistent pattern. |

---

# State Transition Review

## Request State Machine

```
pending ──→ accepted ──→ in-progress ──→ completed
   ↓                          ↓               ↓
   └──────→ cancelled ────────┘               └── (terminal)
   ↓
   └──────→ expired ──────────────────────────── (terminal)

rejected (not a valid request state; only donation state)
```

**Issues:**
- ✅ Transitions validated via centralized state machine
- ⚠️ accepted → pending (reopen after rejection) not clearly documented as valid
- 🔴 Rejection doesn't automatically re-open request (manual admin action required)

## Donation State Machine

```
pending ──→ scheduled ──→ completed (terminal)
   ↓            ↓
   └─→ rejected ┘ (terminal, no re-attempt)
   ↓
   └─→ cancelled (terminal)
```

**Issues:**
- ✅ Clear terminal states (completed, rejected, cancelled)
- ⚠️ Rejected donations can't be retried — donor must accept new donation
- 🔴 No 'accepted' state between scheduled and completed. Hospital marks complete directly.

## Appointment State Machine

```
pending ──→ confirmed ──→ completed (terminal)
   ↓            ↓
   └─→ cancelled ┘ (terminal)
```

**Issues:**
- ✅ Clear lifecycle
- ⚠️ No 'rescheduled' state — rescheduled appointment is new Appointment record (old cancelled)
- 🔴 Cancellation by donor not explicitly documented

---

# Failure Scenario Review

## Error Paths & Recovery

| Scenario | Current Handling | Gap | Severity |
|---|---|---|---|
| Email send fails during signup | Logged as warning, user created, tokens issued. OTP stored but not sent. | On next login, user can request OTP resend. Reasonable. | Low |
| FCM push fails during request broadcast | Async, failures logged but not raised. Notifications created but not delivered. | No retry. Donors unaware of requests. | **HIGH** |
| Appointment booking fails (full capacity) | Suggested next slot, but no automatic rebooking. | Donor must manually rebook. | Medium |
| Eligibility changes between accept and appointment | Re-check at booking catches most cases. Edge: donor age reaches 17 during accept→booking window. | Rare, but possible. | Low |
| Hospital rejects donation mid-flow | Donation cancelled, request orphaned in 'accepted' state. | No re-opening, re-matching, or re-notification. | **CRITICAL** |
| Request quantity decremented below 0 | Request auto-closes at quantity=0, but could go negative if multiple accepts race. | Race condition: concurrent donations may over-decrement. | Medium |
| Points awarded twice for same donation | Deduplication by referenceId prevents double-award. | Good. Idempotent. | Low |
| Activity service fails | Failures silent, audit trail incomplete. | No alerting or fallback logging. | **HIGH** |
| Donor changes location after signup | Location not re-fetched for matching. Donor may be out of range but still getting matches. | Stale location data. | Medium |

---

# Cross-Flow Dependencies

```
Authentication Flow
    ├── [depends on] JWT system, email service
    └── [used by] All protected endpoints

Registration Flow
    ├── [depends on] Email service, OTP system
    └── [feeds] Authentication Flow

Blood Request Flow
    ├── [depends on] Hospital role, location
    ├── [triggers] Matching Flow
    └── [triggers] Notification Flow

Matching Flow
    ├── [depends on] Donor eligibility, location, blood type
    ├── [feeds] Donor Discovery Flow
    └── [feeds] Notification Flow (emergency detection)

Donor Discovery Flow
    ├── [depends on] Matching Flow (compatibility)
    ├── [depends on] Eligibility Service (constraints)
    └── [feeds] Donation Acceptance Flow

Donation Acceptance Flow
    ├── [depends on] Eligibility Service
    ├── [triggers] Appointment Scheduling Flow
    └── [triggers] Notification Flow (hospital alert)

Appointment Scheduling Flow
    ├── [depends on] Hospital settings, availability
    ├── [depends on] Eligibility re-check
    └── [feeds] Donation Completion Flow

Donation Completion Flow
    ├── [depends on] Appointment verification
    ├── [triggers] Reward Points Flow
    ├── [triggers] Activity Logging
    └── [may trigger] Request Closure

Hospital Rejection Flow
    ├── [depends on] Donation state
    ├── [orphans] Request (CRITICAL GAP)
    └── [triggers] Notification (rejection to donor)

Reward Points Flow
    ├── [depends on] Donation Completion
    ├── [triggers] Tier Promotion
    └── [triggers] Badge Unlock

Notification Flow
    ├── [depends on] Matching (emergency detection)
    ├── [depends on] FCM service
    └── [async] Fire-and-forget

Emergency Request Flow
    ├── [depends on] Standard Request + Matching
    ├── [modifies] Notification (priority, content)
    └── [unclear] Does it bypass distance constraint?
```

---

# Evidence

## Code References

### Authentication Completeness
- [auth.service.js - loginUser](../../src/services/auth.service.js#L435) — Login logic with 2FA check
- [auth.middleware.js - authMiddleware](../../src/middlewares/auth.middleware.js) — Token verification, user context
- [AUTH_FLOW.md](../AUTH_FLOW.md) — Comprehensive flow documentation

### Request Creation
- [hospital.controller.js - createRequest](../../src/controllers/hospital.controller.js) — Request creation
- [request.routes.js](../../src/routes/request.routes.js) — Request endpoints

### Matching Logic
- [matching.service.js - findCompatibleDonors](../../src/services/matching.service.js#L317) — Donor finding, scoring
- [MATCHING_ENGINE.md](../MATCHING_ENGINE.md) — Matching algorithm documentation

### Donation Lifecycle
- [donation.service.js - createDonation](../../src/services/donation.service.js#L42) — Donation record creation
- [donation.service.js - updateDonationStatus](../../src/services/donation.service.js#L108) — Status transitions
- [request-lifecycle.service.js - rejectDonationLifecycle](../../src/services/request-lifecycle.service.js#L47) — Rejection handling

### State Machine
- [state-machine.js](../../src/utils/state-machine.js) — Centralized transition validation
- REQUEST_TRANSITIONS, DONATION_TRANSITIONS, APPOINTMENT_TRANSITIONS matrices

### Reward System
- [reward.service.js - awardPoints](../../src/services/reward.service.js) — Points calculation, tier eval, badge unlock
- [REWARDS_SYSTEM.md](../REWARDS_SYSTEM.md) — Points, tiers, badges documentation

### Emergency Requests
- [emergency-notification.js](../../src/utils/emergency-notification.js) — Emergency notification formatting
- [donor.controller.js - acceptUrgentRequest](../../src/controllers/donor.controller.js#L636) — Emergency accept endpoint

---

# Risks Summary

| Risk | Category | Severity | Business Impact |
|---|---|---|---|
| **Orphaned Request After Donation Rejection** | Flow Breakdown | 🔴 CRITICAL | Hospital cannot find replacement donor. Request stuck. Blood need unfulfilled. |
| **No Re-Matching After Rejection** | Flow Gap | 🔴 CRITICAL | Rejected donors cannot re-apply. Donor-hospital trust damaged. |
| **Emergency Requests Ignore Distance Constraint** | Unclear Spec | 🔴 CRITICAL | Uncertain whether emergency should bypass geography. May send notifications to too-far donors. |
| **Activity Logging Async Failures** | Audit Gap | 🔴 HIGH | Failures silent. Audit trail incomplete. Compliance/tracking issues. |
| **FCM Notification Failures** | Infrastructure | 🔴 HIGH | If push service down, donors don't learn of critical requests. Emergency requests not reaching donors. |
| **Appointment-Donor Mutual Exclusivity** | Constraint | 🟠 HIGH | Active appointment blocks all new matches. Donors cannot multi-queue. Reduces response rate. |
| **Location Not Enforced Post-Signup** | UX Gap | 🟠 HIGH | Donors can signup without location, then blocked from matching. No guided flow to update. |
| **Donor Eligibility Changes Between Accept/Booking** | Race Condition | 🟡 MEDIUM | Donor may pass eligibility check at accept but fail at booking (birthday, deferral, etc.). No automatic rollback. |
| **Badge Thresholds Hardcoded** | Config Gap | 🟡 MEDIUM | Badges not configurable by admin. Code change required to adjust difficulty. Inflexible. |
| **Email Service Timeout Silent** | Reliability | 🟡 MEDIUM | Email send fails silently after 2s timeout. Donor doesn't receive OTP. Can't verify email. |
| **Request Quantity Could Go Negative** | Race Condition | 🟡 MEDIUM | Concurrent donations may over-decrement quantity. Edge case with multiple accepts. |
| **Donation Completion Not Rollable** | Data Consistency | 🟡 MEDIUM | Once points awarded, no rollback mechanism if later found to be fraudulent. Manual intervention required. |
| **No Deduplication for Broadcasts** | Operational | 🟡 MEDIUM | Admin can manually broadcast multiple times, causing duplicate notifications. |
| **Role-Based Access Control Inconsistent** | Code Quality | 🟡 MEDIUM | Some endpoints use middleware, others implicit. Pattern inconsistent. Hard to audit. |

---

# Recommendations

## Analysis-Level Recommendations

### 1. **URGENT: Fix Donation Rejection Orphaning**
   - **Problem**: Hospital rejection leaves request in orphaned 'accepted' state.
   - **Recommendation**: 
     * Define rejection logic: Does request re-open to 'pending' or 'accepted'?
     * If re-open: Allow other donors to respond.
     * If closed: Hospital must manually create new request.
   - **Analysis Note**: Current behavior is neither. Must clarify intent before implementation.

### 2. **Clarify Emergency Request Matching Rules**
   - **Problem**: Unclear whether emergency requests bypass normal distance/eligibility constraints.
   - **Recommendation**:
     * Document: Do emergency requests match beyond 30km?
     * Document: Do emergency requests bypass eligibility checks?
     * Update matching service to apply conditional rules based on urgency.
   - **Analysis Note**: Code shows no difference in matching for emergency. Verify if intentional.

### 3. **Document Error Recovery Paths**
   - **Problem**: Fire-and-forget async operations (activity, notifications) fail silently.
   - **Recommendation**:
     * Define: What is the contract? Should failures propagate or be logged only?
     * For critical paths (notifications, points), consider blocking/sync.
     * For audit paths (activity), accept async but implement alerting on failures.
   - **Analysis Note**: Current pattern inconsistent. Establish policy before refactoring.

### 4. **Enforce Location at Signup or Post-Verification**
   - **Problem**: Donors can signup without location, then blocked from matching.
   - **Recommendation**:
     * Either: Make location mandatory at signup.
     * Or: Enforce location update post-verification with guided UX flow.
     * Prevent donors from reaching matching UI if location not set.
   - **Analysis Note**: Current state creates confusion and reduces donor engagement.

### 5. **Document Mutual Exclusivity Rules**
   - **Problem**: Active appointment blocks all new matches. Unclear if intentional or constraint.
   - **Recommendation**:
     * Confirm: Should donors be able to multi-queue?
     * If no: Document constraint prominently in donor UX.
     * If yes: Redesign eligibility checks to allow parallel donations (if medically safe).
   - **Analysis Note**: Constraint significantly reduces response rate. Verify business intent.

### 6. **Implement Idempotent Request Creation**
   - **Problem**: Hospital can create duplicate requests by retrying POST.
   - **Recommendation**:
     * Add idempotency key support (e.g., X-Idempotency-Key header).
     * Return same response if duplicate detected.
   - **Analysis Note**: Standard practice for POST endpoints. Low complexity.

### 7. **Implement Retry Logic for Critical Notifications**
   - **Problem**: FCM failures silent; donors not notified of critical requests.
   - **Recommendation**:
     * For high/critical requests: Implement persistent retry queue with exponential backoff.
     * For low/medium requests: Current best-effort acceptable.
     * Add alerting when critical notifications fail repeatedly.
   - **Analysis Note**: Business criticality varies by urgency. Tailor retry strategy.

### 8. **Make Badge Thresholds Configurable**
   - **Problem**: Badge unlock thresholds hardcoded in SEED_BADGES.
   - **Recommendation**:
     * Move badge definitions to Badge model documents.
     * Allow admin to create/edit badges via `/admin/badges` API.
     * Keep seed data as defaults for new deployments.
   - **Analysis Note**: Enables gamification flexibility without code changes.

### 9. **Clarify Tier Demotion Policy**
   - **Problem**: Unclear if donor tier can drop if points redeemed.
   - **Recommendation**:
     * Document: Should tier be based on current balance or lifetime maximum?
     * If lifetime: tier never decreases (current implementation).
     * If current: demotion possible (requires UX reconsideration).
   - **Analysis Note**: Current approach (lifetime basis) more rewarding to donors. Confirm intent.

### 10. **Add Failure Mode Documentation**
   - **Problem**: Unclear behavior when operations fail mid-flow.
   - **Recommendation**:
     * Document expected behavior for each fail scenario.
     * Create runbooks for operators: "If X fails, do Y."
     * Examples: "If appointment booking fails, suggest next available slot," "If points failed to award, contact support."
   - **Analysis Note**: Helps with incident response and customer support.

---

# Open Questions

## Business Logic Clarifications

1. **Donation Rejection**: When hospital rejects a donation, should the request re-open for other donors, or does hospital need to create a new request?

2. **Emergency Bypass Rules**: Should emergency (critical urgency) requests match donors beyond normal 30km radius?

3. **Multi-Queueing**: Can donors maintain multiple active donations simultaneously, or must each complete/cancel before accepting another?

4. **Location Requirement**: Should donors be forced to set location at signup, or can they update post-verification?

5. **Declined Donors**: After hospital rejects a donor, can the donor re-apply to the same request later (e.g., after 24h)?

6. **Tier Demotion**: If donor redeems points, does their tier drop if they fall below tier threshold, or is tier based on lifetime points?

7. **Activity Audit**: If activity logging fails, should the transaction (donation completion, points award) roll back, or is logging non-critical?

8. **Emergency Re-broadcast**: Should admin be able to re-broadcast critical requests after N minutes to re-notify donors?

9. **Appointment Overlap**: Can a donor have overlapping appointment times at different hospitals, or must they serialize?

10. **Blood Type Flexibility**: Can donors donate blood types different from their own (e.g., O+ donor donates O-)? (Answer: No, but policy not enforced in code currently).

## Technical Clarifications

11. **Geospatial Indexing**: At what donor/request scale should MongoDB 2dsphere geospatial index be added?

12. **Matching Performance**: Current in-memory Haversine scoring — at what scale does this become a bottleneck?

13. **FCM Retry Strategy**: Should retry logic be synchronous (block request) or async (fire-and-forget)?

14. **State Machine Override**: When should `isAdminOverride: true` be used for state transitions?

15. **QR Token Expiry**: Should QR token expire if appointment rescheduled, or remain valid across reschedules?

---

# Conclusion

LifeLink's backend flow architecture is **mostly complete** with well-defined state machines and clear entry/exit points for major user journeys. Core flows (Auth, Request Lifecycle, Matching, Donation Completion, Rewards) are implemented and functional.

However, **critical gaps exist** in error recovery, cross-entity consistency, and feature completeness. Notably:

- **Donation rejection creates orphaned requests** — a critical business logic flaw.
- **Emergency request integration unclear** — distance/eligibility constraints may not apply.
- **Async operation failures silent** — audit trail gaps and notification reliability concerns.
- **Donor constraints very restrictive** — active appointment blocks all new matches.

These issues should be **clarified and documented** before considering Phase 04 (optimization/refactoring). The analysis-level recommendations above provide a roadmap for business and technical alignment on the intended behavior.

---

**Audit Completed By**: Phase 03 Flow Analysis  
**Scope**: 12 major flows, state machines, cross-flow dependencies  
**Status**: Analysis and Planning (No code modifications)  
**Next Steps**: Business review of recommendations and clarifications; Phase 04 optimization planning
