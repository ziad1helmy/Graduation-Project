# System Review

Date: 2026-05-09
Updated: 2026-05-09 after critical and high-priority fixes

## Scope

This review is based on inspecting the repository structure, core service/controller/router layers, selected models and validation, and a test run with `npm.cmd test`.

## Findings

### 1. Critical: public signup can create `admin` accounts directly

Status: Fixed

The public `/auth/signup` route is exposed in `src/routes/auth.routes.js`, the validator allows `admin` as a registration role in `src/validation/auth.validation.js`, and the signup service will create `admin` or even `superadmin` users in `src/services/auth.service.js` when that role reaches it.

Why this matters:

- A public registration route should not be able to create privileged accounts.
- This is a serious privilege-escalation risk.

Recommended fix:

- Remove `admin` and `superadmin` from public registration validation.
- Enforce admin creation only through the protected superadmin flow.
- Add tests that explicitly prove `/auth/signup` rejects privileged roles.

Applied changes:

- Public signup now rejects every role except `donor`.
- Service-level registration also rejects non-donor roles as defense in depth.
- Hospitals must now be created through the admin-controlled hospital creation flow instead of public signup.

Relevant files:

- `src/routes/auth.routes.js`
- `src/validation/auth.validation.js`
- `src/services/auth.service.js`

### 2. High: route/API drift is causing real 404 regressions

Status: Fixed

The app mounts:

- `/rewards` in `src/app.js`
- `/appointments` in `src/app.js`
- `/notifications` in `src/app.js`

But tests and some documented/mobile-facing expectations still use:

- `/donor/points`
- `/donor/badges`
- `/donor/redemptions`
- `/donor/notifications`
- `/donations/book-appointment`

The underlying route files confirm the mismatch:

- `src/routes/reward.routes.js`
- `src/routes/appointment.routes.js`
- `src/routes/notification.routes.js`

Why this matters:

- Clients will hit 404 for endpoints they still expect to exist.
- This is already visible in the test suite, so it is not theoretical.

Recommended fix:

- Either restore compatibility aliases for old endpoints, or update all clients, tests, and docs together.
- Do not leave both naming schemes half-supported.

Applied changes:

- Restored `/donor/points`, `/donor/badges`, `/donor/redemptions`, and `/donor/notifications`.
- Restored `/donor/donations` as a compatibility alias for donation history.
- Restored the legacy `/donations/book-appointment` route base.
- Updated appointment booking responses to include `_id` again for compatibility.

Relevant files:

- `src/app.js`
- `src/routes/reward.routes.js`
- `src/routes/appointment.routes.js`
- `src/routes/notification.routes.js`
- `tests/integration/donor.integration.test.js`
- `tests/integration/appointment.integration.test.js`

### 3. Medium: appointment response contract is inconsistent

Status: Fixed

In `src/controllers/appointment.controller.js`, `bookAppointment` returns `appointmentId` instead of returning the created object with a normal `_id` field and full payload shape.

Why this matters:

- Even after fixing the route path, the endpoint contract still differs from what tests and likely clients expect.
- This creates avoidable frontend/backward-compatibility issues.

Recommended fix:

- Return a consistent resource payload such as `_id`, `status`, `appointmentDate`, and related fields.
- Keep naming aligned across controllers.

Applied changes:

- Updated `bookAppointment` and `getAppointmentById` to return the full standard appointment document payload.
- Retained legacy fields inside `bookAppointment` for backward compatibility with existing tests and clients.

Relevant file:

- `src/controllers/appointment.controller.js`

### 4. Medium: `adminKey` is handled like a secret but is also returned and listable

Status: Fixed for routine read paths

Admin creation returns the plaintext `adminKey` in `src/services/admin.service.js`, and admin listing explicitly selects `adminKey` in `src/services/admin.service.js`.

Why this matters:

- If `adminKey` is a true login secret, it should not be readable in normal list/detail flows.
- If it is not meant to be secret, it should not be used as a login factor.

Recommended fix:

- Decide whether `adminKey` is a one-time bootstrap secret or a real second factor.
- If it is sensitive, stop returning it from list/detail endpoints.
- Consider hashing/storing it differently if it must remain a credential.

Applied changes:

- Removed `adminKey` exposure from routine admin listing responses.
- Verified admin detail responses do not expose `adminKey`.
- The one-time admin creation flow still returns the generated key for provisioning.

Relevant files:

- `src/services/admin.service.js`
- `src/controllers/admin.controller.js`

### 5. Medium: reward redemption limit logic is incomplete and vulnerable to drift under concurrency

Status: Fixed

Seeded rewards include `dailyLimit`, but redemption logic only checks `monthlyLimit`. Also, the monthly check happens before the transaction and `redemptionCount` is incremented later outside the transaction.

Why this matters:

- `dailyLimit` is advertised in data but not enforced.
- Concurrent redemptions can oversubscribe limited rewards.
- `redemptionCount` can drift from the true number of redemptions.

Recommended fix:

- Enforce both daily and monthly limits if the model supports them.
- Move limit checks and counter updates into the transactional flow.
- Add concurrent redemption tests for limited rewards.

Applied changes:

- Added `dailyLimit` enforcement in reward redemption.
- Moved reward-limit checks into the transaction.
- Moved `redemptionCount` updates into the transaction instead of updating afterward.
- Added focused tests covering daily and monthly limit failures.

Relevant file:

- `src/services/reward.service.js`

## Test Evidence

Running `npm.cmd test` surfaced real failures before timing out:

- `tests/integration/donor.integration.test.js`
- `tests/integration/appointment.integration.test.js`
- `tests/unit/donor.controller.test.js`
- `tests/unit/appointment.controller.test.js`
- `tests/unit/appointment.service.test.js`
- `tests/unit/discovery.controller.test.js`

Key observed issues from the output:

- `/donor/points` returned 404
- `/donor/badges` returned 404
- `/donor/redemptions` returned 404
- `/donor/notifications` returned 404
- `/donations/book-appointment` returned 404
- `/donations/book-appointment/my-appointments` returned 404

This strongly suggests the route wiring and consumer expectations are out of sync.

Post-fix verification:

- `tests/unit/auth.validation.test.js`
- `tests/unit/auth.service.test.js`
- `tests/integration/donor.integration.test.js`
- `tests/integration/appointment.integration.test.js`
- `tests/unit/admin.service.test.js`
- `tests/unit/reward.service.test.js`
- `tests/integration/admin.integration.test.js`
- `tests/integration/rewards.integration.test.js`

These targeted suites passed after the fixes.

## Remaining Priority Fix Order

1. Continue reconciling API docs/tests with the canonical route structure.
2. ~~Reduce deprecated Mongoose `new` option usage to remove warnings in tests/runtime.~~ (Fixed by switching `new: true` to `returnDocument: 'after'` across all queries, and clearing duplicate schema indexes).

## Overall Assessment

The project has good breadth: clear feature coverage, a meaningful test suite, and fairly complete business domains. The biggest problems are not lack of functionality, but security boundaries and API consistency. Those are fixable, but they should be treated as high priority because they affect both production safety and client stability.
