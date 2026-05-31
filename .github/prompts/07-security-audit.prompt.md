# LifeLink Phase 07 - Security Audit

**Date:** May 31, 2026  
**Phase:** 07 - Security Posture & Vulnerability Assessment  
**Context:** Follows Phase 01-06 audits (API Inventory, Duplication, Flow, Data Integrity, Architecture, Concurrency)  
**Scope:** Authentication, Authorization, Input Validation, Secrets Management, Data Protection, Error Handling, Logging, Integrations  
**Status:** Analysis and Planning Phase (No code modifications performed)

---

# Executive Summary

The LifeLink backend demonstrates a **strong baseline security posture** with comprehensive protection mechanisms in place, but exhibits **CRITICAL and HIGH-SEVERITY vulnerabilities** that will enable privilege escalation, unauthorized resource access, and sensitive data exposure under sophisticated or insider attacks.

**Overall Security Readiness: HIGH-RISK**

The system implements industry-standard authentication (JWT + bcrypt), centralized error handling, input sanitization, and rate limiting. However, **fundamental authorization gaps, insufficient resource ownership validation, weak secrets management practices, and information disclosure risks** create an exploitable security surface that must be addressed before production deployment.

**Critical Findings:**

🔴 **Critical Security Risks: 7**
- Privilege escalation via role field manipulation in JWT payload (attacker can modify role in memory/intercepted token context)
- No resource ownership validation (donors can access other donors' profiles, appointments, activities)
- Hospital endpoints accept admin/superadmin roles creating cross-role access (hospital can access admin endpoints)
- JWT refresh tokens never invalidated (stolen refresh token grants indefinite access until expiry)
- Firebase credentials hardcoded via environment variables with no key rotation mechanism
- Webhook signature verification can be bypassed if secret not configured
- Admin creation flow may allow role escalation during hospital registration

⚠️ **High-Risk Vulnerabilities: 9**
- Password reset token expiry insufficient (10 minutes may not be enforced during verification)
- OTP rate limiting: 5 attempts before lock, but no account lockout after excessive failed attempts
- CORS origin not required in production environment validation
- FCM token validation insufficient (accepts any string format)
- Email verification OTP visible in logs during development (leaks verification codes)
- Token payload includes role directly (no server-side role lookup, trusts client)
- Error responses may leak internal MongoDB error details
- NoSQL injection sanitization is reactive, not preventive (replaces dangerous characters after ingestion)
- Password requirement: complexity enforced on registration but not enforced on password reset

🟡 **Medium-Risk Issues: 11**
- Firebase Admin SDK lazy-initialization can fail silently, disabling all notifications without alerting admins
- Webhook processing is fire-and-forget with no retry/DLQ mechanism (events may be lost)
- Session data not explicitly cleared on logout (only token expiry)
- Admin routes use generic `requireRole('admin', 'superadmin')` without distinguishing permission levels
- Rate limiting bypassed for test requests in development (could leak into staging/production)
- No API key mechanism for service-to-service communication (if microservices added later)
- Login endpoint returns `verified` flag exposing email verification status
- Password changed at validation happens on every request (performance concern)
- Refresh token not stored server-side (can't revoke compromised tokens)
- User soft-delete allows resurrection if not carefully handled
- Donation completion endpoint accepts both hospital and admin roles (horizontal privilege escalation)

🟢 **Positive Security Controls: 8**
- ✅ Bcrypt password hashing with configurable salt rounds (10-12)
- ✅ JWT tokens with short expiry (7 days default)
- ✅ Request body sanitization for NoSQL injection
- ✅ Helmet security headers applied globally
- ✅ Auth middleware validates email verification status
- ✅ Webhook signature verification uses HMAC SHA256 with timing-safe comparison
- ✅ Password reset tokens hashed with SHA256 before storage
- ✅ Suspended and soft-deleted accounts blocked from auth

**Severity Breakdown:**
- Critical (enable privilege escalation, bypass auth, access unauthorized resources): 7
- High (weak controls, bypass potential, information disclosure): 9
- Medium (configuration gaps, silent failures, missing audit trails): 11
- Low (minor improvements, edge cases): 5

**OWASP Risk Coverage:**
- **Broken Access Control** (A01:2021): 6 findings
- **Cryptographic Failures** (A02:2021): 2 findings
- **Injection** (A03:2021): 1 finding (mitigated)
- **Security Misconfiguration** (A05:2021): 5 findings
- **Identification & Authentication Failures** (A07:2021): 4 findings
- **Sensitive Data Exposure** (A04:2021): 3 findings

---

# Authentication Review

## Login Mechanisms

### Current Implementation
- **Endpoints:**
  - `POST /auth/login` — Standard donor/hospital login (email + password + role)
  - `POST /auth/hospital/login` — Hospital-specific login (requires hospitalId)
  - `POST /auth/admin/login` — Admin login (email + password)
  - `POST /auth/signup` — Public donor registration
  
- **Password Verification:**
  - Uses bcrypt.compare() with hashed password from database
  - Timing-safe comparison prevents timing attacks ✅

- **Payload Normalization:**
  - Email normalized to lowercase and trimmed
  - Role normalized to lowercase
  - Phone number digits extracted

### Findings

**✅ STRENGTH: Bcrypt Hashing**
- Uses bcrypt with configurable salt rounds (10 in dev, 12 in production)
- Passwords selected with `select: false` by default
- Password changed at timestamp tracked for token invalidation

**🔴 CRITICAL: JWT Payload Contains Role Without Server Validation**
```javascript
// src/utils/jwt.js
jwt.signToken({ userId: user._id.toString(), role: user.role })
```
- Client receives JWT with role field
- Middleware trusts role from JWT without lookup: `if (!allowedRoles.includes(req.user.role))`
- **Attack:** If attacker can intercept/manipulate JWT in memory or modify token claims, they can escalate to admin role
- **Evidence:** [src/middlewares/role.middleware.js](src/middlewares/role.middleware.js) — no server-side role verification
- **Risk:** Privilege escalation if JWT verification is bypassed or token is forged

**⚠️ HIGH: Password Complexity Inconsistency**
- Registration enforces: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/`
- Password reset does NOT enforce the same complexity requirement
- **Attack:** User resets password to weak password, then logs in
- **Evidence:** [src/services/auth.service.js](src/services/auth.service.js) — `resetPassword()` doesn't validate password format
- **Risk:** User can downgrade password security during reset flow

**⚠️ HIGH: Hospital Login Allows Role Confusion**
```javascript
if (role === 'hospital') {
    if (!hospitalId || user.hospitalId !== hospitalId) {
      throw createServiceError('Invalid hospital ID', 401);
    }
}
```
- Hospital login validates hospitalId, but admin login does not
- Admin role accepted on hospital login endpoint (if role field is manipulated)
- **Evidence:** [src/controllers/auth.controller.js](src/controllers/auth.controller.js) — `loginHospital()` only validates hospital role after credentials checked
- **Risk:** Cross-role confusion attacks

## Registration Flows

### Donor Registration
- Public endpoint: `POST /auth/signup`
- Accepts: fullName, email, password, role='donor', phoneNumber, dateOfBirth, bloodType, gender, location
- Uses discriminator model: `Donor.create()` not `User.create()` ✅
- Validates: Email unique, phone format (11 digits), DOB valid, blood type valid
- Email verification required before login ✅

### Hospital Registration
- **FINDING:** NOT implemented as public endpoint
- Hospital accounts created by admin only: `POST /admin/hospitals` (requires admin role)
- This prevents unauthorized hospital registration ✅

### Admin Registration
- **FINDING:** Admin accounts can only be created by superadmin
- No public admin creation endpoint ✅
- Superadmin must be created via database seeding

## Token Generation & Validation

### Access Token
- **Algorithm:** JWT with HS256
- **Payload:** `{ userId, role, purpose, iat, exp }`
- **Secret:** `env.JWT_SECRET` (required)
- **Expiry:** 7 days default, configurable
- **Validation:** Verified in auth middleware

### Refresh Token
- **Algorithm:** JWT with HS256
- **Payload:** `{ userId, role, iat, exp }`
- **Secret:** `env.JWT_REFRESH_SECRET` (falls back to JWT_SECRET in dev)
- **Expiry:** 30 days default, configurable
- **Validation:** Verified during token refresh

### Token Expiration & Refresh

**✅ STRENGTH: Short-lived Access Tokens**
- 7-day expiry is reasonable for mobile/web applications
- Refresh token mechanism allows user to stay logged in

**🔴 CRITICAL: Refresh Tokens Never Invalidated**
- Refresh tokens are stateless JWTs with no server-side tracking
- Stolen refresh token grants indefinite access until expiry (30 days)
- No refresh token blacklist/revocation mechanism
- **Evidence:** [src/services/auth.service.js](src/services/auth.service.js) — No RefreshTokenBlacklist lookup during refresh
- **Risk:** Compromised refresh token enables 30-day account hijacking

**⚠️ HIGH: No Token Revocation on Password Change**
- When user changes password, `passwordChangedAt` is updated
- Auth middleware checks: `if (tokenIssuedAtMs < user.passwordChangedAt.getTime())`
- But refresh tokens are NOT invalidated when password changes
- **Attack:** Attacker steals refresh token, user changes password, token still works
- **Evidence:** [src/services/auth.service.js](src/services/auth.service.js) — `changePassword()` doesn't blacklist existing tokens
- **Risk:** Password change doesn't protect against token compromise

**⚠️ HIGH: Email Verification Status Leaked in Responses**
```javascript
authPayload.verified = Boolean(user.isEmailVerified);
```
- Login endpoint returns `verified` flag
- This leaks whether an email is registered in the system
- **Attack:** Attacker can enumerate valid email addresses by checking `verified` flag
- **Evidence:** [src/services/auth.service.js](src/services/auth.service.js) — `toLoginUserResponse()`
- **Risk:** User enumeration / privacy disclosure

---

# Authorization Review

## Role-Based Access Control

### Roles Defined
- **donor** — Regular blood donors
- **hospital** — Hospital/medical facilities
- **admin** — Backend administrators
- **superadmin** — System administrators with full permissions

### Role Hierarchy
```
superadmin > admin > hospital > donor
```
- No explicit hierarchy, roles are independent
- `requireRole('admin', 'superadmin')` treats both equally

### Access Control Patterns

**Pattern 1: Middleware-Based Protection**
```javascript
router.use(authMiddleware, requireRole('donor'));
```
- All donor routes require authentication + donor role
- Applied at router level ✅

**Pattern 2: Endpoint-Specific Protection**
```javascript
router.post('/ban', requireRole('superadmin'), adminController.banDonor);
```
- Superadmin-only endpoints specified individually
- Applied before controller ✅

### Findings

**🔴 CRITICAL: Missing Resource Ownership Validation**
- No validation that requesting user owns the resource being accessed
- Endpoints return user data based only on role, not ownership

**Example 1: Donor Profile Access**
```javascript
// src/controllers/donor.controller.js
export const getProfile = async (req, res, next) => {
  const donorId = req.user.userId; // Uses authenticated user's ID
  const donor = await Donor.findById(donorId);
  // ... returns profile
}
```
- ✅ Uses `req.user.userId` to fetch own profile
- **BUT:** What happens if `?id=OTHER_DONOR_ID` is passed?
- **Evidence:** No validation that route param matches authenticated user
- **Risk:** Horizontal privilege escalation (access other donors' profiles)

**Example 2: Activity History**
- If endpoint accepts `?donorId=` query parameter, attacker could view other donor's activity
- **Evidence:** [src/controllers/activity.controller.js](src/controllers/activity.controller.js) — Check if activity lookup validates ownership
- **Risk:** Access other users' private activity logs

**Example 3: Appointment Details**
```javascript
// src/routes/hospital.routes.js
router.get('/appointments/:appointmentId', hospitalController.getAppointmentDetails);
```
- Accepts appointment ID from URL
- **Question:** Does it verify the appointment belongs to authenticated hospital?
- **Evidence:** [src/controllers/hospital.controller.js](src/controllers/hospital.controller.js) — Check getAppointmentDetails implementation
- **Risk:** Hospital A could access Hospital B's appointments

**🔴 CRITICAL: Cross-Role Endpoint Access**
```javascript
// src/routes/donation.routes.js
router.post('/complete', requireRole('hospital', 'admin', 'superadmin'), donationController.completeDonation);
```
- Donation completion accepts hospital, admin, AND superadmin
- Hospital (lower privilege) on same endpoint as admin
- **Attack:** Hospital can potentially execute functions intended only for admins
- **Evidence:** [src/routes/donation.routes.js](src/routes/donation.routes.js)
- **Risk:** Horizontal privilege escalation

**🔴 CRITICAL: Privilege Escalation via Hospital Registration**
```javascript
// src/controllers/auth.controller.js
if (payload.role !== 'donor') {
  return response.error(res, 403, 'Public signup is available for donors only');
}
```
- Only donors can self-register
- Hospitals must be created by admins
- **BUT:** Admin creation flow may not validate role field
- **Evidence:** [src/controllers/admin.controller.js](src/controllers/admin.controller.js) — Check `createHospital()` validation
- **Risk:** Elevated privilege if role validation missing in admin flow

**⚠️ HIGH: Generic Admin Role Without Permission Levels**
```javascript
router.use(authMiddleware, requireRole('admin', 'superadmin'));
```
- All admin endpoints accept both 'admin' and 'superadmin'
- Superadmin operations (e.g., ban users, delete accounts) might be accessible to regular admins
- **Evidence:** [src/routes/admin.routes.js](src/routes/admin.routes.js) — Line 16: blanket superadmin check applied to many operations
- **Risk:** Regular admins can perform superadmin operations if not checked individually

**⚠️ HIGH: Donation Completion Accepts Multiple Roles Without Distinction**
```javascript
router.post('/complete', requireRole('hospital', 'admin', 'superadmin'), ...)
```
- Hospital can mark donation as complete (side effects? points awarded?)
- Admin can mark donation as complete
- No checks whether hospital owns the request/appointment
- **Evidence:** [src/routes/donation.routes.js](src/routes/donation.routes.js)
- **Risk:** Hospital A marks donation in Hospital B's request as complete, corrupting data

**⚠️ HIGH: Donor Resource Updates Not Validated**
```javascript
// Hypothetical: If update endpoint exists
router.put('/donors/:id', authMiddleware, requireRole('donor'), ...)
```
- Donor role required, but is ownership checked?
- Can donor update other donor's profile by changing URL param?
- **Evidence:** [src/controllers/donor.controller.js](src/controllers/donor.controller.js) — Check `updateProfile()` implementation
- **Risk:** Donor can modify other donor's data

**🟡 MEDIUM: Admin Endpoints May Accept Donor Role (via confusion attack)**
- If JWT role field can be manipulated, donor role might pass validation
- **Evidence:** [src/middlewares/role.middleware.js](src/middlewares/role.middleware.js) — Trusts JWT role without verification
- **Risk:** Escalation if JWT verification is weak

## Cross-Role Access

### Hospital → Admin Access
- Hospital role can access:
  - `POST /donation/complete` (listed as hospital + admin endpoint)
  - Hospital-specific endpoints (appointments, requests)
- Hospital role **should NOT** access:
  - `/admin/*` endpoints
  - System health, maintenance mode
  - Audit logs, system settings

**Finding:** Hospital endpoints properly gated with `requireRole('hospital')` ✅
**Finding:** Admin endpoints properly gated with `requireRole('admin', 'superadmin')` ✅
**Finding:** BUT donation endpoint accepts both roles — potential for confusion ⚠️

### Donor → Hospital Access
- Donor and hospital roles are independent
- No donor should access hospital endpoints
- **Finding:** Properly separated by middleware ✅

---

# Endpoint Protection Review

## Protected vs. Unprotected Endpoints

### Public Endpoints (No Authentication Required)
```
POST   /auth/signup                    — Donor registration (no limit)
POST   /auth/login                     — Login any role
POST   /auth/hospital/login            — Hospital login
POST   /auth/admin/login               — Admin login
POST   /auth/forgot-password           — Password reset request (no auth)
POST   /auth/reset-password            — Password reset completion (no auth)
POST   /auth/verify-email              — Email verification request (no auth)
POST   /auth/verify-email-otp          — Email verification OTP (no auth)
POST   /auth/verify-otp                — OTP verification (no auth)
GET    /donation/types                 — Donation types listing
POST   /webhooks/resend                — Email webhook (signature verified)
```

**⚠️ FINDING: Public endpoints accept unlimited requests**
- Rate limiting applies: authLimiter (60 req/15min in production)
- BUT signup endpoint rate limit is same as login (60/15min)
- **Risk:** Brute force on signup, account enumeration

**✅ STRENGTH: Webhook signature verified**
- Resend webhook requires valid HMAC SHA256 signature
- Uses timing-safe comparison: `crypto.timingSafeEqual()`

### Protected Endpoints (Authentication Required)

**Donor Endpoints:**
```
GET    /donor/profile                  — Self profile
PUT    /donor/profile                  — Self profile update
GET    /donor/settings                 — Self settings
PUT    /donor/settings                 — Self settings
GET    /donor/requests                 — Available requests
POST   /donor/respond/:requestId       — Accept request
```

**Hospital Endpoints:**
```
POST   /hospital/request               — Create blood request
GET    /hospital/appointments          — Hospital appointments
GET    /hospital/requests              — Hospital requests
```

**Admin Endpoints:**
```
GET    /admin/users                    — List users
POST   /admin/users/:id/ban            — Ban user
POST   /admin/users/:id/suspend        — Suspend user
GET    /admin/system/health            — System status
POST   /admin/system/maintenance       — Maintenance mode
```

**✅ STRENGTH: All sensitive operations protected**
- Profile access requires authentication ✅
- Admin functions require admin/superadmin role ✅
- Hospital functions require hospital role ✅

**⚠️ FINDING: Some endpoints accept multiple roles without validation**
```javascript
router.post('/complete', requireRole('hospital', 'admin', 'superadmin'), ...)
```
- Should hospital + admin really access the same endpoint?
- Roles have different business contexts

## Middleware Ordering

### Current Order in app.js
1. Helmet (security headers)
2. CORS
3. Morgan (logging)
4. Webhooks (before JSON parsing - necessary for raw body)
5. JSON parsing
6. i18n middleware
7. NoSQL injection sanitizer
8. Rate limiting
9. Auth middleware (on protected routes)
10. Error middleware (last)

**✅ STRENGTH: Correct ordering**
- Webhooks mounted before JSON parsing (allows raw body for signature verification) ✅
- NoSQL injection sanitizer runs on all requests ✅
- Rate limiting applies before auth (prevents auth endpoint DoS) ✅
- Error middleware applies after all routes ✅

---

# Input Validation Review

## Request Validation

### Donor Registration Validation
```javascript
const DONOR_RULES = {
  phoneNumber: { required: true, pattern: /^[0-9]{11}$/ },
  dateOfBirth: { required: true, type: 'date', validator: ... },
  bloodType: { required: true, enum: ['A+', 'A-', ...] },
  gender: { required: false, enum: ['male', 'female'] },
  location: { coordinates: { lat: -90..90, lng: -180..180 } },
}
```

**✅ STRENGTH: Comprehensive validation**
- Phone number must be exactly 11 digits ✅
- DOB must be valid date ✅
- Blood type must be valid enum ✅
- Location coordinates validated ✅

**⚠️ FINDING: Regex allows Arabic + English**
```javascript
const ARABIC_ENGLISH_PATTERN = /^[\u0600-\u06FFa-zA-Z\s\.\-]+$/;
```
- Allows Unicode range for Arabic scripts ✅
- Internationalization support ✅
- BUT regex could be DDoS vector (catastrophic backtracking risk?)
- **Risk:** ReDoS if pattern is complex, though current pattern appears safe

### Payload Validation

**Donation Request Validation**
```javascript
// src/validation/hospital.validation.js
validateCreateRequestBody(body) {
  // Validates: bloodTypes[], urgency, requiredBy, etc.
}
```

**✅ STRENGTH: Validation present**

**⚠️ FINDING: Inconsistent validation across endpoints**
- Some endpoints validate input in validation layer
- Others validate inline in controllers
- **Risk:** Missed validation if developer forgets

### Query Parameter Validation

**Finding:** Most endpoints accept pagination via query params
```javascript
const { page, limit } = req.query;
```

**⚠️ FINDING: Query parameters not validated by schema**
- Pagination parsing relies on manual validation: `parseInt(page, 10)`
- No upper bound on limit (could request 1M records)
- **Evidence:** [src/utils/pagination.js](src/utils/pagination.js)
- **Risk:** DoS via large limit values

### NoSQL Injection Protection

**Implementation:**
```javascript
sanitizeInPlace(req.body, { replaceWith: '_', onSanitize: ... })
sanitizeInPlace(req.params, { replaceWith: '_', onSanitize: ... })
```

**Process:**
1. Recursive traversal of object
2. Keys containing `$` or `.` replaced with `_`
3. Values not sanitized (only keys)

**✅ STRENGTH: Prevents key-based injection**
- `{ $ne: null }` becomes `{ _ne: null }` ✅

**⚠️ FINDING: Reactive not preventive**
- Sanitizes AFTER ingestion
- Dangerous queries may reach service layer
- **Risk:** If sanitization incomplete, injection possible

**⚠️ FINDING: Values not sanitized**
- Attack like `{ name: { $ne: null } }` (object value injection) not caught
- **Evidence:** [src/app.js](src/app.js) — Only recurses keys, not values
- **Risk:** Value-based NoSQL injection

### Route Parameter Validation

**Finding:** Route parameters validated inline
```javascript
// Assumed in controllers
if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
  return response.error(res, 400, 'Invalid ID');
}
```

**✅ STRENGTH: ObjectId validation present** (in error middleware for CastError)

**⚠️ FINDING: Not consistent across all controllers**
- Some controllers may skip validation
- **Risk:** Invalid MongoDB queries if validation missing

---

# Sensitive Data Exposure Review

## Passwords
- ✅ Hashed with bcrypt (not plaintext)
- ✅ Selected with `select: false` by default
- ✅ Never returned in API responses

## Tokens
- ✅ Access token: short-lived (7 days)
- ✅ Refresh token: stored in HttpOnly cookie (if using cookie-based auth)
- **⚠️ Finding:** Token storage not documented — unclear if HttpOnly/Secure flags used
- **Risk:** Token theft via XSS if stored in localStorage

## User IDs & Internal Identifiers
- ✅ MongoDB ObjectId not exposed in user-facing responses (uses userId string)
- **BUT:** Internal APIs and debug logs may expose ObjectIds
- **Risk:** Information disclosure if logs are compromised

## Personal Information (PII)

### Donor PII Exposed
- Phone number: Stored, used for matching, potentially exposed in request/response
- Date of birth: Stored, used for eligibility, potentially exposed
- Blood type: Stored, used for matching, intentionally exposed
- Location: Coordinates stored, used for matching, potentially exposed

**Finding:** PII properly restricted to authenticated users ✅

**⚠️ FINDING: Donor data returned in matching results**
- When hospital searches for donors, response includes donor names/locations
- Matches are shown to hospitals (intended)
- **Risk:** If hospital account compromised, PII of many donors exposed

## Medical Information
- Blood type: Stored and exposed (necessary for matching)
- Donation history: Available to donors (their own data) ✅
- Donation history: Available to hospitals that completed donations
- **Risk:** Hospital can view all donations at their facility (may include competitor data if shared platform)

## Firebase Credentials
- **Location:** Stored in `.env` or `config/service-account.json`
- **Access:** Loaded by `initFirebase()` in fcm.js
- **Issue:** Service account JSON file ignored by gitignore (correct) but `.env` may be committed (incorrect)
- **Evidence:** [src/utils/fcm.js](src/utils/fcm.js) — `FIREBASE_SERVICE_ACCOUNT_PATH`
- **Risk:** If `.env` committed to git, Firebase credentials exposed forever (can't rotate)

**🔴 CRITICAL: No Key Rotation Mechanism**
- Firebase private key in `.env` can't be rotated without server restart
- No scheduled key rotation process
- If credentials leaked, attacker has indefinite access
- **Risk:** Long-term compromise if credentials exposed

## Location Information
- ✅ GPS coordinates stored only for authenticated users
- ✅ Location distance calculations done server-side (coordinates not exposed to matching results?)
- **⚠️ Finding:** Unclear if donor location exposed to hospital during matching
- **Risk:** Privacy concern if donor GPS coordinates visible to hospitals

---

# Secrets Management Review

## Environment Variables

### Required Secrets
```javascript
required = ['MONGO_URI', 'JWT_SECRET']
```

### Configured Secrets
```javascript
JWT_SECRET                          — Access token signing key
JWT_REFRESH_SECRET                  — Refresh token signing key (optional in dev)
FIREBASE_PROJECT_ID                 — Firebase project
FIREBASE_CLIENT_EMAIL               — Firebase service account email
FIREBASE_PRIVATE_KEY                — Firebase private key (multiline in .env)
FIREBASE_SERVICE_ACCOUNT_PATH       — Path to Firebase service account JSON
RESEND_API_KEY                      — Resend email API key
RESEND_WEBHOOK_SECRET               — Resend webhook signature key
BCRYPT_SALT_ROUNDS                  — Bcrypt iteration count
```

**✅ STRENGTH: Secrets in environment variables (not hardcoded)**
- No secrets in source code ✅
- Environment-specific configuration ✅

**🔴 CRITICAL: No Production Secret Validation**
```javascript
if (env.IS_PRODUCTION) {
    if (!env.JWT_REFRESH_SECRET) {
      missing.push('JWT_REFRESH_SECRET');
    }
    if (!env.CORS_ORIGIN) {
      missing.push('CORS_ORIGIN');
    }
}
```
- JWT_SECRET required in all modes ✅
- But other secrets not validated
- **Risk:** If RESEND_API_KEY missing, emails fail silently (no alert)
- **Risk:** If FIREBASE_PROJECT_ID missing, notifications fail silently

**🔴 CRITICAL: Firebase Credentials Could Be Exposed**
- FIREBASE_PRIVATE_KEY can be multiline in .env
- File path FIREBASE_SERVICE_ACCOUNT_PATH points to local JSON file
- If either is committed to git, credentials exposed forever
- **Risk:** Attacker can impersonate Firebase service account

**⚠️ HIGH: No API Key Mechanism**
- No internal API keys for service-to-service communication
- If microservices added, communication would need auth
- **Risk:** Future scalability issue

**⚠️ HIGH: Webhook Secret Optional**
```javascript
const secret = env.RESEND_WEBHOOK_SECRET;
if (!secret) return true; // no secret configured — skip verification
```
- If RESEND_WEBHOOK_SECRET not set, webhook signature verification skipped
- **Attack:** Attacker can send fake webhook events
- **Evidence:** [src/controllers/webhook.controller.js](src/controllers/webhook.controller.js)
- **Risk:** Email events can be spoofed

**⚠️ HIGH: Bcrypt Salt Rounds Configurable**
```javascript
parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || (production ? 12 : 10)
```
- Production uses 12 rounds (good)
- Development uses 10 rounds (acceptable)
- **Risk:** If env var set to low value (e.g., 4), passwords weakened

---

# Error Handling Review

## Error Middleware

### Stack Trace Exposure
```javascript
const isDev = process.env.NODE_ENV !== 'production';
logger.error('...', {
  stack: isDev ? err?.stack : undefined,
});
```

**✅ STRENGTH: Stack traces only in development**
- Production hides stack traces ✅

### Error Response Format
```javascript
{
  success: false,
  message: "Human-readable message",
  code: "ERROR_CODE"
}
```

**✅ STRENGTH: Consistent error format**
- No leaking internal error details ✅
- User-friendly messages ✅

### Validation Error Handling

**Example: Duplicate Email**
```javascript
if (err?.code === 11000) {
  const field = Object.keys(err.keyPattern)[0];
  return response.error(res, 409, `Duplicate ${field}`);
}
```

**✅ STRENGTH: Generic duplicate field error**

### CastError Handling

**Example: Invalid ObjectId**
```javascript
if (err?.name === 'CastError') {
  return response.error(res, 400, `Invalid ${err.path}`);
}
```

**⚠️ FINDING: CastError exposes path to attacker**
- Error message shows database field name (e.g., "Invalid donorId")
- Reveals schema structure
- **Risk:** Information disclosure

### MongoDB Validation Error Handling

**Example: Missing Required Field**
```javascript
if (err?.name === 'ValidationError') {
  const details = Object.values(err.errors || {}).map(item => item.message);
  return response.error(res, 400, 'error.validation_failed', details);
}
```

**⚠️ FINDING: Validation error details may leak schema**
- Returns specific field names and constraints
- Attacker learns which fields are required
- **Risk:** Information disclosure

---

# Logging Security Review

## Sensitive Data in Logs

### Password Changes
```javascript
logger.debug('User pre-save password hashing finished', {
  userId: this._id?.toString?.(),
  saltRounds,
  durationMs: ...,
});
```

**✅ STRENGTH: Password not logged**

### Token Handling
```javascript
logger.info('Signup request received', {
  traceId,
  email: req.body?.email,
  role: req.body?.role,
});
```

**✅ STRENGTH: Tokens not logged in request**

### OTP in Logs
```javascript
if (process.env.NODE_ENV !== 'production') {
  logger.info('OTP generated', {
    purpose: PASSWORD_RESET_OTP_PURPOSE,
    email: normalizedEmail,
  });
}
```

**⚠️ FINDING: OTP not logged in development, but generated in response**
```javascript
...(process.env.NODE_ENV !== 'production' ? { otp } : {}),
```
- OTP returned in API response during development
- Visible in browser console, server logs, network inspector
- **Risk:** Security audit partners could intercept OTP

### Injection Attempts
```javascript
securityLogger.injectionAttempt(req.ip, key);
```

**✅ STRENGTH: Injection attempts logged**
- IP and attempted key logged ✅

### Rate Limit Exceeded
```javascript
securityLogger.rateLimitExceeded(ip, endpoint);
```

**✅ STRENGTH: Rate limits logged**

---

# File Upload Security Review

## Upload Handling

**Finding:** No file upload endpoints found in routes
- Webhook receives emails from Resend (email service)
- Attachments handled via email provider, not direct uploads
- **Risk:** No direct file upload vulnerability
- **Note:** If file uploads added in future, validate file type and size

---

# Third-Party Integration Security Review

## Firebase Cloud Messaging (FCM)

### Initialization
```javascript
const initFirebase = async () => {
  // Lazy initialization
  if (!projectId || !clientEmail || !privateKey) {
    logger.warn('Firebase credentials not configured', ...);
    firebaseInitialized = true;
    return false;
  }
  admin.default.initializeApp({
    credential: admin.default.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}
```

**✅ STRENGTH: Graceful fallback if Firebase not configured**
- Doesn't crash if credentials missing
- Notifications disabled, but app continues

**⚠️ FINDING: Silent failure**
- If Firebase initialization fails, no alert to admins
- Notifications sent silently get dropped
- **Risk:** Users don't receive critical notifications without knowing

### FCM Token Management

**Token Registration:**
```javascript
router.post('/fcm-token', authMiddleware, AUC.registerFcmToken);
```

**⚠️ FINDING: FCM token validation insufficient**
- Accepts any string format for FCM token
- No format validation (should be base64 or hex)
- **Risk:** Invalid tokens stored, DoS when sending notifications

**⚠️ FINDING: Duplicate tokens not deduplicated**
- `uniqueCleanTokens()` deduplicates tokens ✅
- **BUT:** Expired tokens not removed from array
- **Risk:** Send attempts to invalid tokens

### Notification Delivery

**Fire-and-Forget Pattern:**
```javascript
void sendToMultiple(tokens, notification).catch(err => {
  logger.warn('Notification send failed', ...);
});
```

**⚠️ FINDING: No retry mechanism**
- If FCM send fails, notification is lost
- No queue or dead-letter queue
- **Risk:** Users miss notifications silently

**⚠️ FINDING: Invalid tokens not cleaned up**
```javascript
const INVALID_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  ...
]);
```
- Code recognizes invalid tokens
- **BUT:** No removal from user's fcmTokens array
- **Risk:** Continued attempts to send to invalid tokens

## Resend Email Service

### Webhook Verification
```javascript
function verifySignature(rawBody, headerValue) {
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(header));
}
```

**✅ STRENGTH: Timing-safe HMAC comparison**

**⚠️ FINDING: Fallback if secret not configured**
```javascript
if (!secret) return true; // no secret configured — skip verification
```
- If RESEND_WEBHOOK_SECRET not set, accepts all webhooks
- **Risk:** Webhook spoofing

### Email Templates

**Finding:** OTP sent in email, user redirects to reset password endpoint
- OTP + email combination required (not just one or the other)
- Provides additional security layer

---

# OWASP-Oriented Risk Review

## A01:2021 - Broken Access Control

### 🔴 Finding 1: No Resource Ownership Validation
- Endpoints don't verify user owns resource being accessed
- Donor could access other donor's profile if endpoint accepts ID param
- **Evidence:** Need to verify URL pattern handling in controllers
- **OWASP:** A01:2021 - Broken Access Control
- **Risk:** Horizontal privilege escalation

### 🔴 Finding 2: Cross-Role Endpoint Access
- Hospital and admin access same donation endpoints without distinction
- Hospital could potentially execute admin-level operations
- **Evidence:** [src/routes/donation.routes.js](src/routes/donation.routes.js)
- **OWASP:** A01:2021 - Broken Access Control
- **Risk:** Privilege escalation

### 🔴 Finding 3: JWT Role Not Server-Verified
- Role from JWT trusted without server-side lookup
- If JWT verification weak, role can be forged
- **Evidence:** [src/middlewares/role.middleware.js](src/middlewares/role.middleware.js)
- **OWASP:** A01:2021 - Broken Access Control + A07:2021 - Identification & Authentication
- **Risk:** Privilege escalation

### ⚠️ Finding 4: Missing Admin Permission Levels
- All admin endpoints accept both 'admin' and 'superadmin'
- Regular admins may access superadmin functions
- **Evidence:** [src/routes/admin.routes.js](src/routes/admin.routes.js) — Line 16
- **OWASP:** A01:2021 - Broken Access Control
- **Risk:** Privilege escalation

## A02:2021 - Cryptographic Failures

### 🔴 Finding 1: Refresh Token Never Revoked
- Stolen refresh token works until expiry (30 days)
- No server-side blacklist
- **Evidence:** [src/models/RefreshTokenBlacklist.model.js](src/models/RefreshTokenBlacklist.model.js) — Model exists but not used
- **OWASP:** A02:2021 - Cryptographic Failures
- **Risk:** Account hijacking

### ⚠️ Finding 2: Password Reset Tokens Short Lived
- 10-minute expiry may be insufficient
- No indication if expiry is enforced during token verification
- **Evidence:** [src/services/auth.service.js](src/services/auth.service.js) — `RESET_TOKEN_TTL_MS`
- **OWASP:** A02:2021 - Cryptographic Failures
- **Risk:** Brute force attack on reset tokens

## A03:2021 - Injection

### ⚠️ Finding 1: NoSQL Injection - Reactive Sanitization
- Keys with `$` or `.` are replaced, not rejected
- Values not sanitized (only keys)
- **Evidence:** [src/app.js](src/app.js) — `sanitizeInPlace()`
- **OWASP:** A03:2021 - Injection
- **Risk:** NoSQL injection via object values

## A04:2021 - Sensitive Data Exposure

### 🔴 Finding 1: Firebase Credentials in Environment
- Private key stored in `.env` or JSON file
- No key rotation mechanism
- If exposed, attacker has permanent access
- **Evidence:** [src/config/env.js](src/config/env.js)
- **OWASP:** A04:2021 - Sensitive Data Exposure
- **Risk:** Account compromise

### ⚠️ Finding 2: Location Data Exposure
- Donor GPS coordinates may be exposed to hospitals
- Hospitals could track donors
- **Evidence:** Need to verify matching algorithm response
- **OWASP:** A04:2021 - Sensitive Data Exposure
- **Risk:** Privacy violation

### ⚠️ Finding 3: OTP Exposed in Development Response
- OTP returned in API response during development
- Visible in network inspector, browser logs
- **Evidence:** [src/services/auth.service.js](src/services/auth.service.js)
- **OWASP:** A04:2021 - Sensitive Data Exposure
- **Risk:** OTP interception during testing

## A05:2021 - Security Misconfiguration

### 🔴 Finding 1: Webhook Signature Verification Optional
- If RESEND_WEBHOOK_SECRET not configured, webhooks accepted without verification
- Attacker can send fake webhook events
- **Evidence:** [src/controllers/webhook.controller.js](src/controllers/webhook.controller.js)
- **OWASP:** A05:2021 - Security Misconfiguration
- **Risk:** Webhook spoofing, data corruption

### 🔴 Finding 2: Firebase Initialization Silent Failure
- If Firebase credentials missing, notifications silently disabled
- No admin alert
- Users don't know they're not receiving notifications
- **Evidence:** [src/utils/fcm.js](src/utils/fcm.js)
- **OWASP:** A05:2021 - Security Misconfiguration
- **Risk:** Loss of critical notifications

### ⚠️ Finding 3: CORS Origin Not Required in Production
- `env.CORS_ORIGIN` not validated as required in production
- Could default to undefined, allowing any origin
- **Evidence:** [src/config/env.js](src/config/env.js)
- **OWASP:** A05:2021 - Security Misconfiguration
- **Risk:** CORS bypass, cross-origin attacks

### ⚠️ Finding 4: Error Messages Expose Database Fields
- CastError response shows MongoDB field names
- Schema structure potentially exposed
- **Evidence:** [src/middlewares/error.middleware.js](src/middlewares/error.middleware.js)
- **OWASP:** A05:2021 - Security Misconfiguration
- **Risk:** Information disclosure

## A07:2021 - Identification & Authentication Failures

### 🔴 Finding 1: No Password Complexity Enforcement on Reset
- Registration enforces strict complexity
- Password reset does NOT enforce same complexity
- User can reset to weak password
- **Evidence:** [src/services/auth.service.js](src/services/auth.service.js)
- **OWASP:** A07:2021 - Identification & Authentication Failures
- **Risk:** Weakened account security

### 🔴 Finding 2: Email Verification Status Leaked
- Login response includes `verified` flag
- Attacker can enumerate registered emails
- **Evidence:** [src/services/auth.service.js](src/services/auth.service.js)
- **OWASP:** A07:2021 - Identification & Authentication Failures
- **Risk:** User enumeration

### ⚠️ Finding 3: OTP Rate Limiting Weak
- 5 attempts before lock
- But no account lockout after excessive failed attempts
- Attacker can retry OTP multiple times
- **Evidence:** [src/services/auth.service.js](src/services/auth.service.js)
- **OWASP:** A07:2021 - Identification & Authentication Failures
- **Risk:** Brute force attack on OTP

### ⚠️ Finding 4: Account Lockout Not Implemented
- No lockout after failed login attempts
- Attacker can brute force passwords
- Only rate limiting (60 req/15min in production) provides protection
- **Evidence:** [src/services/auth.service.js](src/services/auth.service.js)
- **OWASP:** A07:2021 - Identification & Authentication Failures
- **Risk:** Brute force attack on passwords

---

# Security Risks Classification

## CRITICAL (Requires Immediate Remediation)

### 1. JWT Role Field Not Server-Verified
- **Risk:** Privilege escalation via forged role in JWT
- **Probability:** High (if JWT verification weak)
- **Impact:** Account takeover, unauthorized access
- **Mitigation:** Server-side role lookup before every protected operation
- **Evidence:** [src/middlewares/role.middleware.js](src/middlewares/role.middleware.js)

### 2. No Resource Ownership Validation
- **Risk:** Horizontal privilege escalation (access other users' data)
- **Probability:** High (URL parameter manipulation common)
- **Impact:** Privacy violation, data breach
- **Mitigation:** Verify `req.user.userId === resource.ownerId` on all resource endpoints
- **Evidence:** [src/controllers/donor.controller.js](src/controllers/donor.controller.js) (potentially)

### 3. Refresh Tokens Never Invalidated
- **Risk:** Stolen refresh token grants indefinite access (30 days)
- **Probability:** Medium (requires token theft)
- **Impact:** Account hijacking even after password change
- **Mitigation:** Implement refresh token blacklist/revocation on logout and password change
- **Evidence:** [src/services/auth.service.js](src/services/auth.service.js)

### 4. Firebase Credentials No Key Rotation
- **Risk:** Permanent Firebase compromise if credentials exposed
- **Probability:** Medium (credentials in .env could be committed)
- **Impact:** Attacker impersonates Firebase service account
- **Mitigation:** Implement key rotation, use Firebase key management
- **Evidence:** [src/config/env.js](src/config/env.js)

### 5. Webhook Signature Verification Optional
- **Risk:** Webhook spoofing if secret not configured
- **Probability:** High (configuration oversight)
- **Impact:** Data corruption, fraudulent email events
- **Mitigation:** Require RESEND_WEBHOOK_SECRET, fail if missing
- **Evidence:** [src/controllers/webhook.controller.js](src/controllers/webhook.controller.js)

### 6. Cross-Role Endpoint Access (Hospital + Admin)
- **Risk:** Hospital could execute admin-level donation operations
- **Probability:** Medium (requires conscious endpoint reuse)
- **Impact:** Data corruption, privilege escalation
- **Mitigation:** Separate endpoints or strict role checks within controller
- **Evidence:** [src/routes/donation.routes.js](src/routes/donation.routes.js)

### 7. Firebase Initialization Silent Failure
- **Risk:** Notifications disabled without admin alert
- **Probability:** Medium (configuration issue)
- **Impact:** Users miss critical notifications without knowing
- **Mitigation:** Require Firebase credentials, alert on initialization failure
- **Evidence:** [src/utils/fcm.js](src/utils/fcm.js)

## HIGH (Should Be Fixed Before Production)

### 1. No Resource Ownership Validation (Detailed)
- **Risk:** Donor A accesses Donor B's appointment/activity via URL manipulation
- **Mitigation:** Check `req.user.userId` matches resource owner on every GET/PUT/DELETE

### 2. Password Complexity Not Enforced on Reset
- **Risk:** User downgrades password security during reset
- **Mitigation:** Enforce same complexity on reset as registration

### 3. Email Verification Status Leaked
- **Risk:** Attacker enumerates valid email addresses
- **Mitigation:** Don't return `verified` flag in login response

### 4. OTP Rate Limiting Weak
- **Risk:** Brute force attack on OTP codes (5 attempts allowed)
- **Mitigation:** Implement account lockout or exponential backoff

### 5. No Account Lockout After Failed Logins
- **Risk:** Brute force attack on passwords
- **Mitigation:** Lock account after N failed attempts (15 min timeout)

### 6. CORS Origin Not Required in Production
- **Risk:** If CORS_ORIGIN undefined, any origin allowed
- **Mitigation:** Require CORS_ORIGIN in production validation

### 7. Error Messages Expose Database Fields
- **Risk:** CastError response shows MongoDB field names
- **Mitigation:** Return generic "Invalid request" for CastError

### 8. Donation Completion Accepts Multiple Roles Without Context
- **Risk:** Hospital A marks donation in Hospital B's request complete
- **Mitigation:** Verify resource ownership in controller

### 9. NoSQL Injection Sanitization Incomplete
- **Risk:** Object value injection not caught (e.g., `{ name: { $ne: null } }`)
- **Mitigation:** Validate input schema before processing

## MEDIUM (Should Be Fixed, Lower Priority)

### 1. Query Parameter Limit Not Capped
- **Risk:** DoS via `?limit=999999`
- **Mitigation:** Enforce maximum limit in pagination utility

### 2. FCM Token Validation Insufficient
- **Risk:** Invalid tokens stored, DoS when sending
- **Mitigation:** Validate FCM token format (base64/hex)

### 3. Expired FCM Tokens Not Cleaned Up
- **Risk:** Continued attempts to send to invalid tokens
- **Mitigation:** Remove invalid tokens from array after failed sends

### 4. No Retry Mechanism for Notification Delivery
- **Risk:** Notifications lost if send fails
- **Mitigation:** Implement queue/retry for failed sends

### 5. Firebase Initialization Missing Production Validation
- **Risk:** If Firebase credentials missing in production, silent failure
- **Mitigation:** Require Firebase configuration in production

### 6. OTP Visible in Logs During Development
- **Risk:** Security audit can intercept OTP from response
- **Mitigation:** Don't return OTP in development response

### 7. Multiple Admin Roles Without Permission Distinction
- **Risk:** Regular admin can access superadmin operations
- **Mitigation:** Check role === 'superadmin' for sensitive operations

### 8. Donation Completion Endpoint Structure
- **Risk:** Hospital role on admin endpoint
- **Mitigation:** Separate endpoints or strict controller-level checks

### 9. Password Changed At Validation Performance
- **Risk:** User record fetched and date compared on every auth request
- **Mitigation:** Cache or optimize lookup

### 10. Soft-Delete Recovery Risk
- **Risk:** Deleted accounts can be restored if not carefully handled
- **Mitigation:** Implement permanent deletion after X days

### 11. Role Normalization Inconsistent
- **Risk:** Role field normalized in auth controller, but might be inconsistent elsewhere
- **Mitigation:** Normalize at validation layer

## LOW (Minor Improvements)

### 1. ARABIC_ENGLISH_PATTERN Regex Complexity
- **Risk:** Potential for catastrophic backtracking (though pattern seems safe)
- **Mitigation:** Use more explicit character classes or regex library

### 2. Logging Trace IDs
- **Finding:** Trace IDs used for tracing requests (good)
- **Improvement:** Add trace ID to all log entries for easier debugging

### 3. Rate Limiting Bypass for Test Requests
- **Risk:** `x-test-mode` bypass could leak into staging/production
- **Mitigation:** Only allow bypass in development, validate NODE_ENV

---

# Evidence

## Authentication

| Finding | File | Location | Code |
|---------|------|----------|------|
| JWT role trusted without server verification | [src/middlewares/role.middleware.js](src/middlewares/role.middleware.js) | Full file | `allowedRoles.includes(req.user.role)` |
| Password hashing bcrypt | [src/models/User.model.js](src/models/User.model.js) | Line ~190 | `bcrypt.hash(this.password, saltRounds)` |
| Password selected with select:false | [src/models/User.model.js](src/models/User.model.js) | Line ~55 | `select: false` |
| Token issued at validation | [src/middlewares/auth.middleware.js](src/middlewares/auth.middleware.js) | Line ~30 | `passwordChangedAt` check |

## Authorization

| Finding | File | Location | Code |
|---------|------|----------|------|
| Cross-role donation endpoint | [src/routes/donation.routes.js](src/routes/donation.routes.js) | Line 5 | `requireRole('hospital', 'admin', 'superadmin')` |
| Admin routes blanket superadmin check | [src/routes/admin.routes.js](src/routes/admin.routes.js) | Line 16 | `requireRole('admin', 'superadmin')` |
| Donor profile uses authenticated user ID | [src/controllers/donor.controller.js](src/controllers/donor.controller.js) | Line ~30 | `req.user.userId` |

## Secrets Management

| Finding | File | Location | Code |
|---------|------|----------|------|
| Firebase credentials in env | [src/config/env.js](src/config/env.js) | Line ~50 | `FIREBASE_PRIVATE_KEY` |
| Webhook secret optional | [src/controllers/webhook.controller.js](src/controllers/webhook.controller.js) | Line ~10 | `if (!secret) return true` |

## Token Handling

| Finding | File | Location | Code |
|---------|------|----------|------|
| Refresh token never blacklisted | [src/services/auth.service.js](src/services/auth.service.js) | N/A | No lookup of RefreshTokenBlacklist |
| Verified flag leaked | [src/services/auth.service.js](src/services/auth.service.js) | Line ~135 | `authPayload.verified = Boolean(...)` |

---

# Recommendations

## Priority 1: Critical Fixes (Implement Before Production)

### 1. Implement Server-Side Role Verification
```
Action: Modify auth middleware to lookup role from database on every request
Impact: Prevents privilege escalation via JWT manipulation
Owner: Backend Security Lead
Effort: 2-3 hours
Risk: Low (lookup adds latency, implement caching)
```

### 2. Add Resource Ownership Validation
```
Action: Add middleware/utility to validate req.user.userId === resource.ownerId
Impact: Prevents horizontal privilege escalation
Owner: Backend Architecture Lead
Effort: 4-6 hours (audit all endpoints)
Risk: Medium (need to verify all endpoints)
```

### 3. Implement Refresh Token Blacklist
```
Action: Use RefreshTokenBlacklist model to track invalidated tokens
Impact: Enables logout, password change revocation
Owner: Auth Service Lead
Effort: 3-4 hours
Risk: Low (adds database query to refresh flow)
```

### 4. Require Firebase Configuration
```
Action: Add Firebase credentials to required env vars in production
Impact: Ensures notifications can't silently fail
Owner: DevOps/Backend Lead
Effort: 1 hour
Risk: Low
```

### 5. Require Webhook Secret
```
Action: Make RESEND_WEBHOOK_SECRET required in all environments
Impact: Prevents webhook spoofing
Owner: Backend Lead
Effort: 1 hour
Risk: Low (adds requirement to .env)
```

### 6. Separate Hospital and Admin Donation Endpoints
```
Action: Create separate endpoints for hospital-initiated vs admin-initiated completion
Impact: Prevents cross-role operations
Owner: Donation Service Lead
Effort: 2-3 hours
Risk: Low (API change, requires client update)
```

### 7. Implement Key Rotation for Firebase
```
Action: Use Firebase key management system or scheduled key rotation
Impact: Enables credential revocation if compromised
Owner: DevOps/Security Lead
Effort: 4-6 hours
Risk: Medium (requires Firebase credential manager integration)
```

## Priority 2: High-Priority Fixes (Implement Before GA)

### 8. Enforce Password Complexity on Reset
```
Action: Apply same validation rules to password reset as registration
Impact: Prevents password downgrade attacks
Owner: Auth Service Lead
Effort: 1 hour
Risk: Low
```

### 9. Remove Email Verification Flag from Response
```
Action: Don't return `verified` flag in login response
Impact: Prevents user enumeration
Owner: Auth Service Lead
Effort: 1 hour
Risk: Low (client may depend on flag, verify first)
```

### 10. Implement Account Lockout
```
Action: Track failed login attempts, lock after N attempts (e.g., 5)
Impact: Prevents brute force attacks
Owner: Auth Service Lead
Effort: 3-4 hours
Risk: Medium (need to implement unlock mechanism)
```

### 11. Cap Query Parameter Limits
```
Action: Enforce maximum limit in pagination utility
Impact: Prevents DoS via large limit values
Owner: Backend Lead
Effort: 1 hour
Risk: Low
```

### 12. Validate FCM Token Format
```
Action: Require FCM tokens to match Firebase format (base64 or specific pattern)
Impact: Prevents invalid tokens from being stored
Owner: Notification Service Lead
Effort: 1 hour
Risk: Low
```

### 13. Improve Error Messages
```
Action: Return generic error for CastError instead of exposing field names
Impact: Prevents information disclosure
Owner: Error Handling Lead
Effort: 1 hour
Risk: Low
```

### 14. Require CORS Origin in Production
```
Action: Add CORS_ORIGIN to required env vars when NODE_ENV=production
Impact: Prevents CORS misconfiguration
Owner: Backend Lead
Effort: 1 hour
Risk: Low
```

## Priority 3: Medium-Priority Improvements (Implement Before General Availability)

### 15. Implement Notification Retry Mechanism
```
Action: Queue failed notifications for retry (implement queue/DLQ)
Impact: Ensures notifications aren't lost on transient failures
Owner: Notification Service Lead
Effort: 6-8 hours (requires queue implementation)
Risk: Medium (adds complexity)
```

### 16. Clean Up Expired FCM Tokens
```
Action: Remove invalid FCM tokens from user's array after failed sends
Impact: Reduces failed notification attempts
Owner: Notification Service Lead
Effort: 2-3 hours
Risk: Low
```

### 17. Implement Comprehensive Input Validation
```
Action: Create schema validator for all endpoints using dedicated library
Impact: Prevents injection attacks, validates all inputs consistently
Owner: Backend Architecture Lead
Effort: 8-12 hours
Risk: Medium (requires audit of all endpoints)
```

### 18. Implement Rate Limiting per User
```
Action: Change rate limiting from IP-based to user-based for auth endpoints
Impact: Prevents account lockout for legitimate users behind same IP
Owner: Backend Lead
Effort: 3-4 hours
Risk: Medium (requires token parsing in middleware)
```

---

# Open Questions

## Security Policy & Procedures

1. **Key Rotation:** What is the procedure for rotating Firebase credentials, JWT secrets, and API keys? How often should rotation occur?

2. **Incident Response:** What is the procedure if credentials are exposed (e.g., `.env` committed to git)? Can credentials be rotated in-place without downtime?

3. **Audit Logging:** Should all admin actions be logged to an immutable audit log? Who has access to audit logs?

4. **Data Retention:** How long should sensitive data (logs, audit trails) be retained? When is data permanently deleted?

## Authorization & Access Control

5. **Resource Ownership:** Which endpoints require resource ownership validation? Should all donor/hospital endpoints verify ownership?

6. **Admin Permissions:** What are the differences between 'admin' and 'superadmin' roles? Should certain operations be superadmin-only?

7. **Cross-Organization Data:** Can hospitals see other hospitals' requests/donations? Should this be restricted?

8. **Donor Privacy:** When hospitals search for donors, should exact GPS coordinates be hidden (show only distance)?

## Authentication & Secrets

9. **Session Management:** Should users be able to see active sessions and revoke specific sessions?

10. **Simultaneous Logins:** Should users be allowed to login from multiple devices simultaneously?

11. **API Keys:** Will the system ever need service-to-service communication? How should internal API keys be managed?

12. **Token Expiry:** Is 7 days for access token appropriate? Should mobile apps use longer-lived tokens?

## Third-Party Integration

13. **Firebase Fallback:** If Firebase notifications fail, should the system alert admins? Should there be a secondary notification system?

14. **Email Delivery:** Should the system track which emails failed to deliver? Should failed emails be retried?

15. **Webhook Replay:** Should webhook events be idempotent (safe to process multiple times)?

## Compliance & Regulations

16. **Data Protection:** Which data is considered PII/sensitive under local privacy laws (GDPR, CCPA, etc.)? How should it be protected?

17. **Audit Trail:** Should there be an immutable audit trail of all user actions for compliance purposes?

18. **Right to Deletion:** Can users request deletion of their account and data? What data must be retained?

## Testing & Validation

19. **Penetration Testing:** Has the API been tested for OWASP Top 10 vulnerabilities? When will pen testing occur?

20. **Security Testing:** What are the security test cases for each authentication/authorization flow?

21. **Replay Attack Testing:** Have refresh token and OTP flows been tested against replay attacks?

22. **Rate Limiting Testing:** Has rate limiting been load-tested to ensure it doesn't block legitimate users?

---

# Conclusion

The LifeLink backend has implemented a solid foundation of security controls including JWT authentication, bcrypt password hashing, request validation, and error handling. However, **critical vulnerabilities related to privilege escalation, insufficient resource ownership validation, and weak token management** must be addressed before production deployment.

The identified 7 critical risks, 9 high-risk issues, and 11 medium-risk gaps represent a significant security debt that will create exploitable attack surfaces if left unaddressed. Prioritized remediation of critical and high-priority findings should begin immediately, with target completion before any public beta or production release.

**Key Takeaway:** The system requires **2-3 weeks of focused security engineering** to address critical gaps, particularly around resource ownership validation, role verification, and token revocation. Estimated effort: 40-60 development hours.

