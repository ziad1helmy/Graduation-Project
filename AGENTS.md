# LifeLink — Project Rules for AI Agents

These rules apply to every code change made in this repository. They are
enforced by the project's `.agents/skills/` guard skills (clean-code-guard,
docs-guard, test-guard) and by the project maintainers during review.

> **Read this file and at least one neighbor in the area you are editing
> before writing any code.** Match the file's existing style, import
> order, error handling, and logging conventions.

---

## 1. Project structure

| Path | Purpose |
|------|---------|
| `src/routes/*.routes.js` | Express routers. One file per domain. |
| `src/controllers/*.controller.js` | Request/response shape and HTTP-level error mapping. |
| `src/services/*.service.js` | Business logic. No direct req/res access. |
| `src/models/*.model.js` | Mongoose models (User, Donor, Hospital, Request, etc.). |
| `src/middlewares/*.middleware.js` | Express middleware (auth, role, rate-limit, maintenance). |
| `src/validation/*.validation.js` | Pure validators. Return `{ valid, errors }`. |
| `src/utils/*.js` | Stateless helpers. |
| `scripts/*.js` | One-off scripts (migrations, seeds, smoke tests). |
| `tests/unit/*.test.js` | Vitest unit tests, isolated. |
| `tests/integration/*.test.js` | Vitest integration tests, full app. |
| `openapi.yaml` | **Source of truth** for the public API. |
| `public/swagger-custom.js` | Swagger UI path-to-group mapping. |

---

## 2. API surface changes — update `openapi.yaml`

The OpenAPI spec is the public contract of this API. The Flutter client,
postman collections, and integration tests all read from it. **If you
change the API surface, you must update `openapi.yaml`.**

### What counts as an API surface change

Any of the following require an `openapi.yaml` update:

- Adding a new route (`router.post(...)`, `router.get(...)`, etc.).
- Removing or renaming a route.
- Changing the HTTP method on an existing route.
- Adding, removing, renaming, or retyping a request body field.
- Adding, removing, or retyping a response field.
- Changing a response status code (e.g., `200` → `204`, adding a new error code).
- Changing an authentication or authorization requirement.
- Changing a rate-limit or maintenance-mode behavior that callers depend on.
- Changing a path parameter (`/users/:id` → `/users/:userId`).

### How to keep the spec in sync

1. Edit `openapi.yaml` (this is the **source of truth**).
2. If you added or renamed a path, update `public/swagger-custom.js` to
   map it to the correct Swagger UI group (User Management, Requests &
   Moderation, etc.).
3. Verify the spec parses:
   ```bash
   node -e "import('yaml').then(m => { const fs = require('fs'); const text = fs.readFileSync('openapi.yaml','utf8'); const p = m.default.parse(text); console.log('YAML valid:', Object.keys(p.paths).length, 'paths'); })"
   ```

### Route files have inline reminders

Look for the comment block at the top of `src/routes/admin.routes.js`,
`auth.routes.js`, and the other routers:

```js
// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────
```

This is intentional. There is no inline JSDoc swagger generation —
the spec lives in one place so it can be reviewed holistically.

---

## 3. Cross-file impact — review before committing

A change in one file can break or change the behavior of other files
without any compile-time or test-time signal. **You must review
callers and dependents before editing, and list them in the commit
message or PR description.**

### Common cross-file impact areas

| If you change... | You must also review... |
|------------------|------------------------|
| A User model field, enum, or index | Every service that reads/writes it, every controller that exposes it, the OpenAPI spec, factories in `tests/helpers/factories.js`. |
| A service function signature, return shape, or error message | The controller that calls it (error mapping), integration tests that assert on the error message, and the OpenAPI spec response examples. |
| An auth/role middleware | Every router that uses it. The route table in `openapi.yaml` (`security` blocks). |
| `src/app.js` mount points or middleware order | All routes affected, the rate-limit behavior, the maintenance-mode behavior, the auth flow. |
| An `errorCodes.js` constant | Every place that throws or matches on that string. |
| A validator in `src/validation/*.js` | The controller that uses it, the integration tests, and the OpenAPI spec (`400` response examples). |
| An environment variable in `src/config/env.js` | The `.env.example` file, deployment scripts, and any code that reads the variable. |
| The `User` discriminator fields for donor or hospital | The `Donor` or `Hospital` model files, the migration script `scripts/migrate-users.js`, and any factory in `tests/helpers/factories.js`. |
| A user-management service (e.g. `updateDonor`, `updateAdmin`) | The route, the controller, the OpenAPI spec body schema, and any existing integration tests for that endpoint. |

### What to do before opening a PR

1. Run `git grep` (or your editor's find-in-files) for the symbol you
   changed. Verify every call site still works.
2. Run the full test suite: `npm test`.
3. If the change is in the user model or auth flow, also run the auth
   and admin integration tests explicitly:
   ```bash
   npx vitest run tests/integration/admin.integration.test.js tests/integration/auth.integration.test.js
   ```
4. If you changed `openapi.yaml`, update `public/swagger-custom.js` if path
   mappings changed.

### Update integration tests when refactoring controllers or services

When a change touches a controller handler or service function that has
an existing integration test under `tests/integration/`, update the
test **before** you run the suite — do not let the test fail and then
"fix it after." A failing test on a known refactor is a planning
failure, not a discovery.

Concretely, before editing any file under `src/controllers/` or
`src/services/`:

1. `git grep` (or your editor's find-in-files) for the exported
   handler/function name. Note every test file under `tests/integration/`
   that references it.
2. Skim each test and check whether the refactor changes any of:
   - The HTTP status code returned for a given input.
   - The error code, message, or response shape on a failure path.
   - The success response shape (field names, nesting, included
     metadata like `distanceKm`, `pagination`, `unreadCount`).
   - The query/body parameter names the endpoint accepts.
   - The order of middleware (auth, role, rate limit) on the route.
3. If any of those change, update the test in the same commit. If the
   new contract is stricter (e.g. a new alias is required, or a
   previously-optional field is now mandatory), add a new test case
   that pins the new behavior.
4. For the shared utilities in `src/utils/`, the same rule applies
   to the unit tests under `tests/unit/` that import them — if a
   utility changes its argument shape, return shape, or alias set,
   update the unit test that pins that contract in the same change.

The "AI test smell" this prevents: a controller is refactored, an
assertion on `res.body.data.foo` becomes stale, the test still
passes because `foo` is now `undefined` and the assertion is loose,
and the regression ships. The fix is to make the test pin the new
contract before the refactor is considered done.

---

## 4. Skill guards

Before any code change is presented as done, the agent should run the
relevant guard skill. These are the project's official review layers:

- **clean-code-guard** — run after implementing code. Catches Clean Code,
  SOLID, DRY/KISS/YAGNI violations, and the LLM-specific failure modes
  documented in the skill. Use it as a guard pass before delivery.
- **docs-guard** — run after writing or changing documentation. Verifies
  every function reference, flag, endpoint, and code sample against the
  source. Catches docs-vs-code drift.
- **test-guard** — run after writing or changing tests. Prevents test
  bloat, weak assertions, and AI-generated test smell.

The skills live under `.agents/skills/<name>/SKILL.md`. Read the SKILL
file to know what the guard checks before you trigger it.

---

## 5. Code patterns that are easy to miss

### ESM modules only
`package.json` has `"type": "module"`. Use `import`/`export` everywhere. Never use `require`/`module.exports`.

### Response wrapper — mandatory
All controllers must use `response.success(res, 200, 'Message', data)` or `response.error(res, 400, 'message')`. Never call `res.json()` directly. The wrapper lives in `src/utils/response.js` and enforces `{ success, message, data }` shape.

### User model is a discriminator base
Donor and Hospital are Mongoose discriminators (`Donor` and `Hospital` extend `User`). Any field added to `User.model.js` is inherited by both. Donor-specific fields go in `src/models/Donor.model.js`, hospital-specific in `src/models/Hospital.model.js`.

### Environment config is dynamic
`src/config/env.js` exports a getter (`getEnv()`), not a static object. Always `import { env } from '../config/env.js'` — the object is recreated on each import so new env vars are picked up in tests.

### Reuse existing utilities
- Blood type compatibility: `src/utils/blood-type.js` has `getCompatibleDonorTypesForRequest()` and `BLOOD_TYPE_COMPATIBILITY`. Do not duplicate compatibility maps.
- Caching: `src/utils/cache.js` provides Redis (if `REDIS_URL` is set) or in-memory fallback. Use it for expensive analytics endpoints.
- Age calculation: `src/utils/age.js` has `calculateAge(dateOfBirth)`.
- Response wrapper: `src/utils/response.js` (see above).
- Geo and location utilities: `src/utils/geo.js` has `parseLatLng(query)` for parsing lat/lng/long/latitude/longitude query params, `extractLocation(obj, type)` for pulling coordinates out of any request/donor/hospital document shape, `extractGeoPoint(location)` for the same plus GeoJSON arrays, `calculateDistance(loc1, loc2)` (Haversine), `findNearby`, `sortByProximity`, and `getLocationScore`. Do not re-implement Haversine or coordinate extraction in controllers.
- Formatting utilities: `src/utils/format.js` has `formatDistance(km)` and `formatEstimatedTime(km)`. Do not duplicate.
- Query and data utilities: `src/utils/query.js` has `toNumber`, `isValidObjectId`, `toLocation`, `parseBooleanQuery`, and `toPlainObject`. Do not redefine these locally in controllers or services.
- Typed errors: `src/utils/HttpError.js` exports `HttpError(statusCode, message, details?)`. Throw it instead of calling `response.error()` from inside `try/catch` blocks — the global error middleware in `src/middlewares/error.middleware.js` maps it to a JSON response.
- Async route handlers: `src/middlewares/asyncHandler.js` exports `asyncHandler(fn)` to wrap async controllers and forward thrown errors to Express. Use it instead of `try { ... } catch (error) { next(error); }` in every controller.

---

## 6. Test commands

| Command | What it runs |
|---------|--------------|
| `npm test` | Full vitest suite (unit + integration + e2e). |
| `npx vitest run tests/unit/<file>` | One unit test file. |
| `npx vitest run tests/integration/<file>` | One integration test file. |
| `node scripts/migrate-admin-keys.js` | One-off migration for the bcrypt adminKey change. Run once before deploying the security fix. |

### Test infrastructure
- Uses `mongodb-memory-server` with a **replica set** (`MongoMemoryReplSet`) so transactions work.
- `tests/helpers/db.js` exports `setupTestDB()` — call it in every test file that hits the database.
- `tests/helpers/factories.js` exports `createDonor()`, `createHospital()`, `createRequest()`, `createDonation()`, `createAdmin()`. Use these instead of manual model creation.
- Tests run in parallel by default. Each test file gets its own database connection. Use `nextNum()` for unique values to avoid collisions.

---

## 7. Forbidden patterns

These are project-level rules. Violating them is a blocker, not a
preference.

- **No inline JSDoc `@swagger` / `@openapi` annotations in route
  files.** All spec lives in `openapi.yaml`. There is a comment
  reminder in every router that says so.
- **No route or middleware that bypasses the global `authMiddleware`**.
  The only unauthenticated routes are under `/auth/*` (login, signup,
  forgot-password, verify-email, verify-email-otp, verify-otp).
- **No duplicating shared utilities.** Do not redefine `formatDistance`,
  `formatEstimatedTime`, `toNumber`, `isValidObjectId`, `toLocation`,
  `parseBooleanQuery`, `toPlainObject`, or a local `parseLatLng`/
  `extractLocation` in a controller or service. Import them from
  `src/utils/format.js`, `src/utils/query.js`, or `src/utils/geo.js`
  instead. The same applies to local Haversine re-implementations.
- **No `try { ... } catch (error) { next(error); }` in controllers.**
  Use `asyncHandler(fn)` from `src/middlewares/asyncHandler.js`
  instead. Domain-specific error mapping belongs inside a `try`
  block that re-throws `HttpError`, not a generic `next(error)`.
- **No accepting `email` or `role` in admin-update endpoints.** Admins
  change their own email via the self-service profile flow; role
  changes are not supported via the admin-update path.
- **No plaintext secrets in the database.** `adminKey` is bcrypt-hashed
  before storage; passwords are bcrypt-hashed by the User pre-save hook.
- **No deleting an admin or superadmin via the generic `DELETE
  /admin/users/:id` endpoint.** Service layer rejects this; do not
  remove that guard.
- **No new endpoints without a corresponding OpenAPI section and
  Swagger UI group mapping.** (See rule 2.)

---

## 8. Commit hygiene

- One logical change per commit. If you touch `openapi.yaml` and the
  related route/controller, include both in the same commit.
- The commit message should name the endpoint(s) or module(s) affected
  and call out any cross-file impact explicitly.
- Do not commit `.env`, secrets, or generated-only artifacts that
  belong in `.gitignore` (`node_modules`, `coverage`, etc.).

---

## 9. Recent breaking changes to know

### Analytics dashboard (`GET /analytics/dashboard`)
The response shape was completely rewritten. It no longer returns `{ users: { total, donors, hospitals }, requests: { active, critical }, donations: { pending, completed }, alerts: {} }`. The new shape is `{ totalDonors, totalDonorsGrowth, activeRequests, activeRequestsGrowth, criticalCases, criticalCasesGrowth, successfulDonations, successfulDonationsGrowth, weeklyTrends, criticalAlerts, bloodTypeDistribution, topDonors, aiInsights }`. Update tests and docs accordingly.

### `getDonationTrends()` return type
Previously returned an array with `.dailyTrends` and `.regionalBreakdown` properties attached. Now returns a plain object `{ trends: [], dailyTrends: [], regionalBreakdown: [] }`. The field names also changed: `region` → `governorate`, `completedDonations` → `completed`, and `dailyTrends` items now use a `date` string instead of `year/month/day`.

---

## 10. When in doubt

- If a change affects the API surface, update `openapi.yaml`.
- If a change touches an auth or user-management file, run the
  relevant guard skill before considering the work done.
- If you find a pre-existing failure in `npm test`, do not paper over
  it. Flag it in the commit message and ask the maintainer before
  "fixing" it as part of your change — it may be intentional or
  scoped to a separate effort.
