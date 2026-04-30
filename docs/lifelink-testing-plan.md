# LifeLink — Complete Unit Testing Plan for Copilot

## Context & Constraints

- Framework: **Vitest** + **MongoDB Memory Server**
- Pattern: **MVC+S** (Route → Middleware → Controller → Service → Model)
- Existing tests: 76 tests across 6 files — **do not modify them**
- DB isolation: already solved via `pool: 'forks'`, `maxWorkers: 1`, global `afterAll(clearTestDB)`
- Mocking rule: **mock external I/O only** (mailer, FCM, Atlas) — never mock Mongoose or MongoDB Memory
- Each new file must follow the same factory pattern used in `tests/helpers/factories.js`
- Run `npx vitest run` after each file and fix before moving to the next

---

## Delivery Order — Work Phase by Phase

---

## Phase 1 — Services (Highest Priority)

### File 1: `tests/unit/auth.service.test.js`

**Before writing:** Read `src/services/auth.service.js` fully.

Mock these externals at the top of the file:
```js
vi.mock('../../src/utils/mailer.js', () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }))
vi.mock('../../src/utils/jwt.js', () => ({
  generateAccessToken: vi.fn(() => 'mock-access-token'),
  generateRefreshToken: vi.fn(() => 'mock-refresh-token'),
  verifyRefreshToken: vi.fn()
}))
```

Write exactly these test cases — one `describe` block per group:

**`register()`**
- registers a new donor with valid data and returns sanitized user (no password field)
- registers a new hospital with valid data
- throws DUPLICATE_EMAIL error when email already exists
- calls `sendVerificationEmail` exactly once after successful registration
- hashes the password (stored hash !== plain text)

**`login()`**
- returns accessToken + refreshToken for valid credentials
- throws INVALID_CREDENTIALS when email not found
- throws INVALID_CREDENTIALS when password is wrong
- throws EMAIL_NOT_VERIFIED when user exists but isVerified is false

**`refreshToken()`**
- issues a new accessToken when refreshToken is valid
- throws INVALID_TOKEN when refreshToken is expired or tampered

**`verifyEmail()`**
- marks user as verified when token is correct
- throws INVALID_TOKEN when token is wrong or expired

**`forgotPassword()`**
- calls `sendPasswordResetEmail` with the correct email
- does NOT throw or leak info when email does not exist (silent fail)

**`resetPassword()`**
- updates password hash when reset token is valid
- throws INVALID_TOKEN when token is wrong

Target: **~22 tests**

---

### File 2: `tests/unit/donation.service.test.js`

**Before writing:** Read `src/services/donation.service.js` fully.

No external mocks needed. Use `createDonor()` and `createHospital()` factories.

**`createDonationRequest()`**
- hospital can create a request with valid blood type and quantity
- throws VALIDATION_ERROR when quantity is missing
- throws NOT_FOUND when hospital ID does not exist

**`getDonationRequests()`**
- returns paginated list of open requests
- returns empty array when no requests exist
- filters by blood type when query param provided

**`acceptDonationRequest()`** (donor action)
- donor with matching blood type can accept an open request
- throws BLOOD_TYPE_MISMATCH when donor blood type is incompatible
- throws NOT_FOUND when request ID is invalid
- throws CONFLICT when request is already accepted by another donor

**`completeDonation()`** (hospital confirms)
- marks request as completed
- triggers reward points award (check that donor points increased)
- throws FORBIDDEN when a different hospital tries to complete it

**`cancelDonationRequest()`**
- hospital can cancel its own open request
- throws FORBIDDEN when another hospital tries to cancel it
- throws CONFLICT when request is already completed

Target: **~15 tests**

---

### File 3: `tests/unit/admin.service.test.js`

**Before writing:** Read `src/services/admin.service.js` fully.

**`getAllUsers()`**
- returns paginated list of all users (donors + hospitals)
- filters by role when query param provided

**`getUserById()`**
- returns full user document for valid ID
- throws NOT_FOUND for invalid ID

**`banUser()` / `unbanUser()`**
- sets `isBanned: true` on target user
- sets `isBanned: false` on banned user
- throws NOT_FOUND when user ID is invalid

**`setMaintenanceMode()`**
- sets maintenance flag to true in DB
- sets maintenance flag to false in DB

**`deleteUser()`**
- removes user document from DB
- throws NOT_FOUND for invalid ID

Target: **~12 tests**

---

### File 4: `tests/unit/analytics.service.test.js`

**Before writing:** Read `src/services/analytics.service.js` fully.

**`getDonationStats()`**
- returns total donations count
- returns breakdown by blood type
- returns correct count after new donations are added

**`getUserStats()`**
- returns total donor count
- returns total hospital count

**`getTopDonors()`**
- returns donors sorted by points descending
- limits result to N donors when limit param provided

Target: **~8 tests**

---

### File 5: `tests/unit/notification.service.test.js`

**Before writing:** Read `src/services/notification.service.js` fully.

Mock FCM at the top:
```js
vi.mock('../../src/utils/fcm.js', () => ({ sendPushNotification: vi.fn(() => Promise.resolve()) }))
```

**`createNotification()`**
- saves notification document to DB
- calls `sendPushNotification` when user has FCM token
- does NOT call `sendPushNotification` when user has no FCM token

**`getUserNotifications()`**
- returns notifications for the correct user only
- returns them sorted newest-first
- returns empty array when user has no notifications

**`markAsRead()`**
- sets `isRead: true` on target notification
- throws NOT_FOUND when notification ID is invalid
- throws FORBIDDEN when notification belongs to a different user

Target: **~9 tests**

---

## Phase 2 — Middleware

### File 6: `tests/unit/middleware/auth.middleware.test.js`

**Before writing:** Read `src/middleware/auth.middleware.js` fully.

Use `supertest` with a minimal Express app — do NOT spin up the full server.

Setup pattern:
```js
import express from 'express'
import request from 'supertest'
import { authMiddleware } from '../../../src/middleware/auth.middleware.js'

const app = express()
app.get('/test', authMiddleware, (req, res) => res.json({ userId: req.user.id }))
```

**Test cases:**
- passes and attaches `req.user` when Bearer token is valid
- returns 401 when Authorization header is missing
- returns 401 when token is expired
- returns 401 when token is tampered
- returns 401 when token belongs to a banned user

Target: **~5 tests**

---

### File 7: `tests/unit/middleware/role.middleware.test.js`

Same supertest pattern as above.

**Test cases:**
- allows donor to access donor-only route
- allows hospital to access hospital-only route
- returns 403 when donor tries to access hospital-only route
- returns 403 when hospital tries to access donor-only route
- allows admin to access any route

Target: **~5 tests**

---

### File 8: `tests/unit/middleware/maintenance.middleware.test.js`

**Before writing:** Read `src/middleware/maintenanceMode.js` fully. Note the 30s in-memory cache.

**Test cases:**
- returns 503 when maintenance mode is ON and user is a regular donor
- allows request through when maintenance mode is OFF
- admin request bypasses maintenance mode even when it is ON
- cache is used (DB is not hit twice within 30s TTL) — assert with a spy on the DB call

Target: **~4 tests**

---

## Phase 3 — Models

### File 9: `tests/unit/models/user.model.test.js`

**Before writing:** Read `src/models/User.model.js` fully.

**Test cases:**
- Donor discriminator saves to `users` collection with `role: 'donor'`
- Hospital discriminator saves to `users` collection with `role: 'hospital'`
- `bloodType` field rejects invalid values (e.g. `'XX'`)
- `email` field enforces uniqueness
- `password` field is not returned by default in queries (select: false)
- Donor-specific fields (e.g. `points`, `tier`) do not exist on Hospital documents
- Hospital-specific fields (e.g. `hospitalName`) do not exist on Donor documents

Target: **~7 tests**

---

## Phase 4 — Controllers (Error Mapping)

### File 10: `tests/unit/controllers/auth.controller.test.js`

**Before writing:** Read `src/controllers/auth.controller.js` fully.

Mock the entire auth service:
```js
vi.mock('../../../src/services/auth.service.js')
import * as authService from '../../../src/services/auth.service.js'
```

Use supertest with a minimal Express app that mounts only the auth controller.

**Test cases:**
- POST /auth/register → 201 when service succeeds
- POST /auth/register → 409 when service throws DUPLICATE_EMAIL
- POST /auth/login → 200 + tokens when service succeeds
- POST /auth/login → 401 when service throws INVALID_CREDENTIALS
- POST /auth/login → 403 when service throws EMAIL_NOT_VERIFIED
- POST /auth/refresh → 200 + new accessToken when service succeeds
- POST /auth/refresh → 401 when service throws INVALID_TOKEN

Target: **~7 tests**

---

## Constraints That Apply to Every File

1. **Never modify** existing test files or `tests/setup.js` or `vitest.config.js`
2. **Never mock Mongoose** — always use MongoDB Memory Server through the existing `connectTestDB()` / `clearTestDB()` helpers
3. **Always add** `afterAll(async () => await clearTestDB())` at the top-level describe in every new file that creates DB documents
4. **Never add** `beforeEach` DB wipes — only `afterAll`
5. **Mock external I/O only**: `mailer.js`, `fcm.js`, `jwt.js` where noted — nothing else
6. **Run after each file**: `npx vitest run` — fix all failures before proceeding to next file
7. **Follow factory pattern**: add any new factory helpers to `tests/helpers/factories.js`, never inline `new Model().save()` in test files
8. **Test names must be plain English sentences** — describe what the system does, not what the code does

---

## Final Verification

After all 10 files are written and passing individually:

```bash
npx vitest run   # run 1
npx vitest run   # run 2
npx vitest run   # run 3
```

All three runs must show **0 failed tests** before the work is done.

Update `README.md` test suite table to reflect the new totals.

---

## Expected Final State

| File | New Tests |
|---|---|
| `auth.service.test.js` | ~22 |
| `donation.service.test.js` | ~15 |
| `admin.service.test.js` | ~12 |
| `analytics.service.test.js` | ~8 |
| `notification.service.test.js` | ~9 |
| `auth.middleware.test.js` | ~5 |
| `role.middleware.test.js` | ~5 |
| `maintenance.middleware.test.js` | ~4 |
| `user.model.test.js` | ~7 |
| `auth.controller.test.js` | ~7 |
| **Total new** | **~94** |
| **Grand total** | **~170** |
