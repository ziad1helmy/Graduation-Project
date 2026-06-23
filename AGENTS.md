# LifeLink — Project Rules for AI Agents (v2)

> **Purpose.** This document is the operating contract between human
> maintainers and any AI agent (or human contributor) writing code in
> this repository. It is enforced by the `.agents/skills/` guard skills
> (`clean-code-guard`, `docs-guard`, `test-guard`) and by review.
>
> **How to use this file.** Read it end-to-end once. Before every change,
> re-read the section that covers the area you're touching. The rules
> are ordered: orientation → planning → implementation → verification →
> delivery, followed by standing references.

---

## 0. Phase 0 — Orientation (before writing any code)

You cannot safely edit a file you have not read. Before producing any
diff, do all of the following:

1. **Read the target file in full.** Not a skim. Read it.
2. **Read at least one neighbor in the same layer** (e.g. if editing a
   controller, read one sibling controller). Match its style, import
   order, error mapping, and logging conventions exactly.
3. **Read its callers and tests.** `git grep` the exported symbol. Open
   every integration test that references it. You are not done
   orienting until you can name every consumer of the symbol.
4. **Read `package.json`** to confirm scripts and dependency set.
5. **Read `openapi.yaml`** for any endpoint you will touch.
6. **Read the relevant `src/models/*.model.js`** if you will touch data
   shape, indexes, or discriminator fields.
7. **Read `src/utils/` and `src/repositories/`** to know what helpers
   and data access patterns already exist. Reuse before you write.
   (See Section 11 for the catalog.)

If any of these are missing or unclear, **stop and ask the maintainer**
before guessing. Hallucinated APIs and duplicate utilities are the
single most common AI failure mode in this codebase.

---

## 1. Phase 1 — Planning (before any diff)

Write down, in the PR description or commit body:

1. **Intent.** What behavior changes, in one sentence.
2. **Touch list.** Every file you will edit, grouped by layer
   (routes / controllers / services / repositories / models / utils /
   tests / `openapi.yaml` / `public/swagger-custom.js`).
3. **Cross-file impact.** Use the table in Section 6. List every caller
   and dependent of every symbol you're changing.
4. **API contract delta.** Will `openapi.yaml` change? Which paths,
   schemas, status codes, security blocks?
5. **Test plan.** Which existing tests will need updates? Which new
   tests will you add? (See Section 13 for the testing philosophy.)
6. **Definition of done.** A bullet list of concrete, checkable
   criteria. Example:
   - [ ] `npm test` green
   - [ ] `openapi.yaml` parses
   - [ ] No new ESLint warnings
   - [ ] `clean-code-guard` passes
   - [ ] No new utility duplicating `src/utils/*`
   - [ ] All callers reviewed and listed in PR

A PR without a planning section is a blocker.

---

## 2. Project structure

| Path | Purpose | Hard rules |
|------|---------|------------|
| `src/routes/*.routes.js` | Express routers. One file per domain. | No business logic. No `req.body` validation here. |
| `src/controllers/*.controller.js` | Request/response shape, HTTP error mapping. | No direct DB access. No `req`/`res` leaking into services. |
| `src/services/*.service.js` | Business logic. | No `req`/`res`. No HTTP status codes. Throw `HttpError`. |
| `src/repositories/*.js` | Data access layer (`BaseRepository` + domain repos). | Services call repos, not models directly. |
| `src/models/*.model.js` | Mongoose models. | Indexes declared in schema. No queries here. |
| `src/middlewares/*.middleware.js` | Express middleware. | Pure-ish: `req → mutated req / next()`. |
| `src/validation/*.validation.js` | Pure validators. | Return `{ valid, errors }`. No side effects. |
| `src/utils/*.js` | Stateless helpers. | No DB, no `req`. Single responsibility. |
| `src/constants/*.js` | Domain constants (`events.js`, `donation.constants.js`, etc.). | Separate from `src/utils/errorCodes.js`. |
| `src/workers/*.worker.js` | Long-running background processes. | Different lifecycle from routes. |
| `scripts/*.js` | One-off scripts. | Idempotent where possible. Documented header. |
| `tests/unit/*.test.js` | Vitest unit tests. | No DB, no network. |
| `tests/integration/*.test.js` | Vitest integration tests. | Full app, real DB (memory replset). |
| `tests/qa/*.test.js` | QA/Refactor tests. | Does not fit unit/integration pyramid. Acknowledged. |
| `tests/e2e/*.test.js` | Vitest e2e. | Realistic flows, no mocks of internal layers. |
| `openapi.yaml` | **Source of truth** for the public API. | Hand-edited. No inline generation. |
| `public/swagger-custom.js` | Swagger UI path-to-group mapping. | Keep in sync with `openapi.yaml` paths. |

**Layering is one-directional:** `routes → controllers → services →
repositories → models`. A service may not import a controller. A model
may not import a service. A util may not import a controller, service,
or model.

**Route Mounting:** Routes are mounted at the root in `app.js` (e.g.,
`/auth`, `/donor`, `/admin`). **There is no `/api` prefix.** Do not add
`/api` to route strings.

---

## 3. API surface changes — update `openapi.yaml`

The OpenAPI spec is the public contract. The Flutter client, Postman
collections, and integration tests all read from it.

### 3.1 What counts as an API surface change

Any of the following requires an `openapi.yaml` update:

- Adding, removing, or renaming a route.
- Changing the HTTP method on an existing route.
- Changing a path parameter (e.g. `/users/:id` → `/users/:userId`).
- Adding, removing, renaming, or retyping a request body / query /
  header field.
- Adding, removing, or retyping a response field.
- Changing a response status code (including adding a new error code).
- Changing authentication or authorization requirements.
- Changing rate-limit or maintenance-mode behavior callers depend on.
- Changing pagination shape, sort syntax, or filter semantics.

### 3.2 How to keep the spec in sync

1. Edit `openapi.yaml` first (it is the source of truth).
2. If a path was added or renamed, update `public/swagger-custom.js`
   to map it to the correct Swagger UI group.
3. Verify the spec parses:
   ```bash
   node -e "import('yaml').then(m => { const fs = require('fs'); const text = fs.readFileSync('openapi.yaml','utf8'); const p = m.default.parse(text); console.log('YAML valid:', Object.keys(p.paths).length, 'paths'); })"
   ```
4. Re-run integration tests that assert on response shape.

### 3.3 No inline swagger

Every router file begins with the reminder block:

```js
// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────
```

Do not add inline `@swagger` / `@openapi` JSDoc anywhere. The spec lives
in one place so it can be reviewed holistically.

---

## 4. Code style

### 4.1 ESM only

`package.json` has `"type": "module"`. Use `import`/`export` everywhere.
`require` and `module.exports` are forbidden.

### 4.2 Import order (enforced in every file)

1. Node built-ins (`node:fs`, `node:path`, …).
2. Third-party packages (`express`, `mongoose`, …).
3. Internal absolute (`src/...`) — use the project's alias if one
   exists, otherwise relative paths.
4. Relative (`./`, `../`).
5. Type imports last, if applicable.

Separate each group with a blank line. Sort alphabetically within a
group. Match the existing file — do not introduce a second style.

### 4.3 Naming

- **Files:** `kebab-case.js` for utilities, `<name>.controller.js`,
  `<name>.service.js`, `<name>.routes.js`, `<name>.middleware.js`,
  `<name>.model.js`, `<name>.validation.js`.
- **Identifiers:** `camelCase` for variables and functions,
  `PascalCase` for classes and Mongoose models, `UPPER_SNAKE_CASE`
  for constants.
- **Route paths:** `/kebab-case` for multi-word segments
  (`/forgot-password`, not `/forgotPassword`).

### 4.4 JSDoc for non-swagger functions

Public service functions and exported utilities get a short JSDoc block
with `@param`, `@returns`, and `@throws {HttpError}` where applicable.
One sentence is enough. Do not document trivia (`// increment i`).

### 4.5 Comments

- Comments explain **why**, never **what**.
- Delete commented-out code before committing.
- A `TODO` must include an owner or ticket: `// TODO(@alice, #123): …`.

### 4.6 Function size and shape

- A controller handler ≤ 40 lines. If longer, extract a helper into the
  service or a private function in the same file.
- A service function ≤ 60 lines. Beyond that, decompose.
- No function takes more than 4 positional arguments. Use an options
  object beyond that.
- No boolean flag parameters. If you need a flag, the function does two
  things — split it.

### 4.7 Response wrapper — mandatory

All controllers must use the wrapper in `src/utils/response.js`:

```js
response.success(res, 200, 'Message', data);
response.error(res, 400, 'message', details?); // details is optional
```

Never call `res.json()` directly. The wrapper enforces the
`{ success, message, data }` shape that every test and client depends on.

### 4.8 Async route handlers — mandatory

Use `asyncHandler(fn)` from `src/middlewares/asyncHandler.js`. Never
write `try { ... } catch (error) { next(error); }` in a controller. If
you need domain-specific error mapping, throw `HttpError` inside the
service; `asyncHandler` forwards it to the global error middleware.

---

## 5. Error handling philosophy

### 5.1 Use `HttpError` for business errors

`src/utils/HttpError.js` exports `HttpError(statusCode, message, details?)`.
Services and controllers throw it. The global error middleware
(`src/middlewares/error.middleware.js`) maps it to a JSON response.

```js
// Good — in a service
if (!user) throw new HttpError(404, 'User not found');

// Bad — in a service
return res.status(404).json({ ... }); // services have no res
```

### 5.2 Status code taxonomy

| Code | Use for |
|------|---------|
| 200  | Successful read or update with a body. |
| 201  | Resource created. |
| 204  | Successful delete or no-content update. |
| 400  | Malformed input. Use `validation/*.js` first; reserve 400 in controllers for shape errors the validator can't see. |
| 401  | Missing or invalid auth token. |
| 403  | Authenticated but not allowed (role mismatch, ownership). |
| 404  | Resource not found. Don't leak existence of private resources — return 404, not 403, when the caller can't see the resource. |
| 409  | Conflict (duplicate email, version mismatch). |
| 422  | Valid shape but semantically invalid (e.g. blood type incompatible). Prefer 400 unless you have a strong reason. |
| 429  | Rate limited. |
| 500  | Unexpected. Never throw deliberately. |

### 5.3 Error messages

- User-facing. No stack traces, no internal paths, no Mongoose raw
  messages. Map them.
- Stable. Tests assert on them. Changing a message is a contract
  change — update tests and `openapi.yaml` examples in the same commit.
- Lowercase, no trailing period, ≤ 80 chars when possible.

### 5.4 `errorCodes.js`

Centralized string constants for error codes (`ERR` object). If you add
one, `git grep` every place that throws or matches on strings in that
domain and consolidate.

---

## 6. Cross-file impact — review before committing

A change in one file can break callers with no compile-time or
test-time signal. **Review every caller and dependent before editing,
and list them in the PR description.**

| If you change… | You must also review… |
|----------------|------------------------|
| A `User` model field, enum, or index | Every repository/service that reads/writes it; every controller that exposes it; `openapi.yaml`; factories in `tests/helpers/factories.js`; the `Donor` and `Hospital` discriminators; migration scripts (`scripts/*.js`). |
| A service function signature, return shape, or error message | The controller that calls it (error mapping); integration tests asserting on the message; `openapi.yaml` response examples; every other service that composes it. |
| An auth/role middleware | Every router that uses it; the `security` blocks in `openapi.yaml`; the auth and admin integration tests. |
| `src/app.js` mount points or middleware order | All routes; rate-limit behavior; maintenance-mode behavior; the auth flow; the healthcheck. |
| An `errorCodes.js` constant | Every place that throws or matches on that string. |
| A validator in `src/validation/*.js` | The controller that uses it; integration tests; `openapi.yaml` `400` response examples. |
| An environment variable in `src/config/env.js` | `.env.example`; deployment scripts; every code site that reads it; the README. |
| A `User` discriminator field | The `Donor` / `Hospital` model files; migration scripts; factories; the OpenAPI schemas for those roles. |
| A user-management service (`updateDonor`, `updateAdmin`, …) | The route; the controller; `openapi.yaml` body schema; existing integration tests for that endpoint; the auth tests if role/email is involved. |
| A `src/utils/*.js` exported symbol | Every importer (run `git grep`); the unit tests in `tests/unit/` that pin it. |
| A `src/repositories/*.js` method | Every service that calls it; integration tests that assert on the data shape. |
| A middleware order in a router | Integration tests for every endpoint in that router; rate-limit assertions. |
| A Mongoose index | Query performance (use `.explain()`); migration cost on production data — flag it in the PR. |
| A rate-limit configuration | Every route it covers; integration tests that assert on 429. |
| `src/middlewares/error.middleware.js` | Every error path in every controller; the error shape in `openapi.yaml`. |

### 6.1 Before opening a PR

1. `git grep` (or editor find-in-files) for every symbol you changed.
   Verify every call site still works.
2. `npm test`.
3. If you touched auth, user model, or admin flow:
   ```bash
   npx vitest run tests/integration/admin.integration.test.js tests/integration/auth.integration.test.js
   ```
4. If you touched `openapi.yaml`, update `public/swagger-custom.js`
   when paths changed, and re-run the spec parse check from Section 3.2.
5. `npx eslint .` — no new warnings.
6. `npm audit --audit-level=moderate` if you changed dependencies.

### 6.2 Update tests before refactoring, not after

When a change touches a controller handler or service function with an
existing integration test, **update the test in the same commit, before
running the suite.** A failing test on a known refactor is a planning
failure, not a discovery.

Concretely, before editing any file under `src/controllers/` or
`src/services/`:

1. `git grep` the exported handler/function name. Note every test file
   under `tests/integration/` that references it.
2. Skim each test and check whether the refactor changes any of:
   - HTTP status code for a given input.
   - Error code, message, or response shape on a failure path.
   - Success response shape (field names, nesting, metadata like
     `distanceKm`, `pagination`, `unreadCount`).
   - Query/body parameter names.
   - Middleware order (auth, role, rate limit) on the route.
3. If any change, update the test in the same commit.
4. If the new contract is stricter (new required alias, previously
   optional field now mandatory), add a test case that pins the new
   behavior.

The "AI test smell" this prevents: a controller is refactored, an
assertion on `res.body.data.foo` becomes stale, the test still passes
because `foo` is now `undefined` and the assertion is loose, and the
regression ships.

---

## 7. Performance and database rules

### 7.1 Queries

- **Always pass projections** to read queries when you don't need every
  field. `.select('-password -__v')` at minimum on user-bearing
  queries.
- **Use `.lean()`** on read-only queries that don't need Mongoose
  getters/virtuals. Convert at the service boundary, not the controller.
- **Avoid N+1.** Use `.populate()` once, or aggregate. If you must loop,
  batch with `$in`.
- **Paginate every list endpoint.** Default page size ≤ 50, hard cap
  100. Reuse the pagination shape already used elsewhere (use
  `src/utils/pagination.js`).
- **Use indexes.** If you add a query filter, confirm an index covers
  it. Add indexes in the schema, not in ad-hoc `createIndex` calls.

### 7.2 Transactions

The test DB is a replica set (`MongoMemoryReplSet`), so transactions
work. Use a transaction when a service writes to ≥ 2 collections or
performs a read-then-write that must be atomic. Keep transactions
short. Never call a controller or send a response inside a transaction.

### 7.3 Caching

Use `src/utils/cache.js` (or `src/utils/analytics-cache.js` for
analytics) for expensive endpoints. Key by the arguments that change
the result. Set a TTL. Invalidate on write. Prefer cache miss → compute
→ set, not read-through magic.

### 7.4 Async and concurrency

- No `await` in tight loops over arrays of unknown size. Use
  `Promise.all` with bounded concurrency.
- No `Promise.all` over unbounded arrays (e.g. user-provided lists).
  Chunk.
- No `await` inside `.map` if you don't mean to fan out. Use `for…of`.

### 7.5 Memory

- Stream large responses (CSV exports, analytics dumps). Do not
  `.find().then(rows => res.json(rows))` for unbounded collections.
- Avoid building large intermediate objects. Use aggregation pipelines
  and let MongoDB do the work.

---

## 8. Security rules

- **No bypassing `authMiddleware`.** The only unauthenticated routes
  are under `/auth/*` (login, signup, forgot-password, verify-email,
  verify-email-otp, verify-otp). Adding a new unauthenticated route is
  a security event — flag it in the PR and require maintainer sign-off.
- **No `email` or `role` in admin-update endpoints.** Admins change
  their own email via the self-service profile flow; role changes are
  not supported via the admin-update path.
- **No deleting admin/superadmin via the generic
  `DELETE /admin/users/:id` endpoint.** The service-layer guard stays.
- **No plaintext secrets.** `adminKey` is bcrypt-hashed before storage;
  passwords are bcrypt-hashed by the `User` pre-save hook. Never log
  them, never return them in responses, never put them in error
  messages.
- **Validate everything from the client.** Use `src/validation/*.js`
  for every request body, query, and param. Validate type, presence,
  length, enum, and shape. Reject early.
- **Sanitize output.** Never return `__v`, `password`, `adminKey`,
  `resetToken`, or `emailVerificationOtp` in responses. Use
  `toPlainObject()` from `src/utils/query.js` and `.select()`.
- **Rate-limit auth and write endpoints.** Reuse the existing limiter
  configuration; do not invent a new one.
- **No `eval`, no `new Function`, no `child_process.exec` with user
  input.** If you need any of these, you almost certainly have a
  design problem.
- **No new dependencies without justification.** State why an existing
  dep can't do the job. Run `npm audit` after install.

---

## 9. Logging conventions

- Use the project's logger from `src/utils/logger.js`. Do not introduce
  a new logger.
- Import via `import logger from './utils/logger.js'` (or named imports
  like `requestLogger`, `securityLogger`).
- Structure: `logger.info(message, dataObject)` — metadata goes in the
  second argument object, not interpolated into the string.
- Levels:
  - `error` — operation failed, human action may be required.
  - `warn` — recoverable, but worth noticing (rate limit hit, fallback
    to in-memory cache).
  - `info` — lifecycle events (server start, migration ran).
  - `debug` — verbose, off in production.
- **Never log secrets, tokens, passwords, or PII** beyond user IDs.
- Log at service boundaries: entry with key args (IDs, not bodies),
  exit with duration on slow paths. Do not log inside hot loops.

---

## 10. Environment and configuration

- `src/config/env.js` exports both `env` (a static object evaluated at
  module load) and `getEnv()` (a dynamic function).
- **Use `env`** for normal application code.
- **Use `getEnv()`** inside tests where environment variables change
  between test runs.
- Never read `process.env` outside `src/config/env.js`. Tests should
  not set env vars directly; use the config layer.
- Adding an env var requires:
  1. A default in `src/config/env.js` (fail-fast if required and
     missing).
  2. An entry in `.env.example` with a comment.
  3. A note in the README's configuration section.
  4. A line in the deployment script if it must be provisioned.

---

## 11. Reuse catalog — do not duplicate

Before writing a helper, check this list. Duplicating any of these in a
controller or service is a blocker.

| Utility | Location | Purpose |
|---------|----------|---------|
| Blood-type compatibility | `src/utils/blood-type.js` | `getCompatibleDonorTypesForRequest()`, `BLOOD_TYPE_COMPATIBILITY`. |
| Cache | `src/utils/cache.js` | Redis (if `REDIS_URL`) or in-memory fallback. |
| Analytics Cache | `src/utils/analytics-cache.js` | Analytics-specific cache wrapper. |
| Age | `src/utils/age.js` | `calculateAge(dateOfBirth)`. |
| Response wrapper | `src/utils/response.js` | `response.success`, `response.error`. |
| Geo | `src/utils/geo.js` | `parseLatLng`, `extractLocation`, `extractGeoPoint`, `calculateDistance` (Haversine), `findNearby`, `sortByProximity`, `getLocationScore`. |
| Format | `src/utils/format.js` | `formatDistance(km)`, `formatEstimatedTime(km)`. |
| Query | `src/utils/query.js` | `toNumber`, `isValidObjectId`, `toLocation`, `parseBooleanQuery`, `toPlainObject`. |
| Pagination | `src/utils/pagination.js` | `parsePagination()`, `paginationMeta()`. |
| Text Normalization | `src/utils/textNormalization.js` | Text normalization helpers. |
| Typed errors | `src/utils/HttpError.js` | `HttpError(statusCode, message, details?)`. |
| Error Codes | `src/utils/errorCodes.js` | `ERR` constant object for centralized error strings. |
| JWT | `src/utils/jwt.js` | JWT sign/verify helpers. |
| Mailer | `src/utils/mailer.js` | Email sending. |
| Email Templates | `src/utils/emailTemplates.js` | Email HTML templates. |
| State Machine | `src/utils/state-machine.js` | Donation/request state transitions. |
| FCM | `src/utils/fcm.js` | Firebase push notifications. |
| Domain Constants | `src/constants/*.js` | `events.js`, `donation.constants.js`, `request.constants.js`, `rewards.constants.js`, `request-timeout.constants.js`. |
| Async wrapper | `src/middlewares/asyncHandler.js` | `asyncHandler(fn)`. |

If you need a helper that doesn't exist, **add it to the right
`src/utils/*.js` file**, export it, write a unit test, then use it. Do
not inline a one-off in a controller "just this once."

---

## 12. Guard skills — run before delivery

Before any change is presented as done, run the relevant guard skill.
These are the project's official review layers.

| Guard | When to run | What it catches |
|-------|-------------|-----------------|
| `clean-code-guard` | After implementing code. | Clean Code, SOLID, DRY/KISS/YAGNI violations; LLM-specific failure modes (over-engineering, dead code, magic strings, leaky abstractions). |
| `docs-guard` | After writing or changing docs. | Docs-vs-code drift: every function reference, flag, endpoint, and code sample is verified against source. |
| `test-guard` | After writing or changing tests. | Test bloat, weak assertions, AI-generated test smell, missing failure-path coverage. |

The skills live under `.agents/skills/<name>/SKILL.md`. Read the SKILL
file before you trigger the guard — you should know what it checks.

A guard pass is **required**, not optional. If a guard fails, fix the
underlying issue; do not silence the guard.

---

## 13. Testing philosophy

### 13.1 Test pyramid

- **Unit** (`tests/unit/`): pure functions, validators, utils. No DB,
  no network. Fast.
- **Integration** (`tests/integration/`): full app, real in-memory DB,
  real middleware chain. Most of your tests live here.
- **E2E** (`tests/e2e/`): realistic multi-step flows. Few, slow, high
  value.
- **QA** (`tests/qa/`): targeted refactor/phase tests. Does not fit the
  standard pyramid but follows the same rules.

### 13.2 What to test

- Every public service function: happy path, every documented error
  path, edge cases (empty input, boundary values, null/undefined).
- Every controller: status code, response shape, error mapping,
  auth/role behavior.
- Every validator: valid input, each invalid input separately.
- Every middleware: success, failure, side effects on `req`.

### 13.3 How to test

- **AAA**: Arrange, Act, Assert. One concept per test.
- **No shared mutable state between tests.** Use `beforeEach` to reset.
- **Use factories.** `tests/helpers/factories.js` exports
  `createDonor()`, `createHospital()`, `createRequest()`,
  `createDonation()`, `createAdmin()`, and `buildDonor()` (plain object,
  no DB insert). Do not construct models by hand in tests.
- **Uniqueness:** Use the factory functions directly, as they internally
  handle uniqueness via a private `nextNum()`. Do not try to import
  `nextNum()` externally.
- **Assert on the contract, not the implementation.** Test the response
  shape and the observable side effect, not the internal call sequence.
- **Pin error messages.** `expect(res.body.message).toBe('User not
  found')`, not `expect(res.body.message).toBeTruthy()`.
- **Test the failure path.** For every happy path, ask: "what's the
  next-most-likely failure?" and write that test too.
- **No `expect(true).toBe(true)`.** Every test must assert something
  that would fail if the code were wrong.

### 13.4 Test infrastructure

- `mongodb-memory-server` with a **replica set** (`MongoMemoryReplSet`)
  so transactions work.
- `tests/helpers/db.js` exports `setupTestDB()` — call it in every test
  file that hits the database. It creates a replica set per test file.
- `afterEach` **clears ALL collections** via `clearDatabase()`, not just
  the ones the test touched. Tests can share state within a file across
  `it` blocks if they don't trigger a fresh setup.
- Tests run in parallel. Each file gets its own DB connection.
- Don't mock internal layers in integration tests. Mock only external
  systems (SMS, email, payment) and only when they're not idempotent
  in test mode.

### 13.5 Commands

| Command | What it runs |
|---------|--------------|
| `npm test` | Full vitest suite (unit + integration + e2e + qa). |
| `npx vitest run tests/unit/<file>` | One unit test file. |
| `npx vitest run tests/integration/<file>` | One integration test file. |
| `node scripts/<script>.js` | Scripts in `scripts/` are one-off, documented, idempotent migrations (e.g., `migrate-users.js`, `migrate-dedupe-donations.js`, `migrate-donation-qr-field.js`, `migrate-patient-type.js`). Run specific ones as needed before deploying related changes. |

---

## 14. Documentation rules

- **`README.md`** is the entry point. Update it when:
  - You add an env var.
  - You add a script.
  - You change the dev setup.
  - You add a new top-level feature.
- **`CHANGELOG.md`** holds the "recent breaking changes" that used to
  live in Section 9 of this file. Move new entries there. Keep entries
  dated and linked to the PR.
- **Inline comments** explain why, not what (see Section 4.5).
- **JSDoc** on exported utilities and public service functions (see
  Section 4.4).
- **`openapi.yaml`** is the API docs (see Section 3).
- If you change docs, run `docs-guard` (see Section 12).

---

## 15. Git and commit hygiene

### 15.1 Atomic commits

- One logical change per commit. If you touch `openapi.yaml` and the
  route/controller that implements it, that's one commit.
- A commit must leave the tree green. `npm test` should pass on every
  commit, not just the last one on the branch.
- Keep diffs reviewable. A PR over ~400 lines needs a strong
  justification or should be split.

### 15.2 Commit message format

```
<type>(<scope>): <subject>

<body: what changed, why, cross-file impact>

<footer: breaking changes, ticket refs>
```

- `type`: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`,
  `perf`, `security`.
- `scope`: the domain (`auth`, `admin`, `requests`, `analytics`, …).
- `subject`: imperative, ≤ 72 chars, no period.
- **Cross-file impact section is required** if the change touches more
  than one layer. List every caller and dependent reviewed.

### 15.3 Never commit

- `.env`, secrets, tokens.
- `node_modules/`, `coverage/`, `*.log`, build artifacts.
- Generated files that belong in `.gitignore`.
- Commented-out code.
- `console.log` debug statements.

### 15.4 Branches and PRs

- Branch name: `<type>/<scope>-<short-desc>` (e.g.
  `feat/analytics-cache`).
- PR description must include the planning section from Section 1.
- PR must be green on CI before review.
- Address review comments with new commits, not force-pushes that
  hide history (unless explicitly asked to squash).

---

## 16. Forbidden patterns (blockers, not preferences)

- ❌ Inline `@swagger` / `@openapi` JSDoc in route files. The spec
  lives in `openapi.yaml`.
- ❌ Routes or middleware that bypass `authMiddleware`. Only `/auth/*`
  routes are unauthenticated.
- ❌ Duplicating shared utilities (see Section 11). Grep before you write.
- ❌ `try { ... } catch (error) { next(error); }` in controllers. Use
  `asyncHandler(fn)`.
- ❌ `require` / `module.exports`. ESM only.
- ❌ `res.json()` directly in controllers. Use the response wrapper.
- ❌ `req` / `res` leaking into services or repositories.
- ❌ Services throwing HTTP status codes via `res.status()`. Services
  throw `HttpError` with a status code; the global middleware maps it
  to the JSON response — never call `res.status()` from a service.
- ❌ Adding raw Mongoose queries inside services. Use or extend
  `src/repositories/*.js` instead.
- ❌ Accepting `email` or `role` in admin-update endpoints.
- ❌ Deleting admin/superadmin via the generic `DELETE /admin/users/:id`.
- ❌ Plaintext secrets anywhere. `adminKey` and passwords are
  bcrypt-hashed.
- ❌ New endpoints without an `openapi.yaml` section and a Swagger UI
  group mapping.
- ❌ Adding an `/api` prefix to route strings. Routes mount at the root.
- ❌ New dependencies without justification and `npm audit`.
- ❌ `eval`, `new Function`, `child_process.exec` with user input.
- ❌ `process.env` reads outside `src/config/env.js`.
- ❌ Logging secrets, tokens, passwords, or PII beyond IDs.
- ❌ Returning `__v`, `password`, `adminKey`, `resetToken`, or
  `emailVerificationOtp` in responses.
- ❌ Commented-out code in committed files.
- ❌ `expect(true).toBe(true)` or any tautological assertion.
- ❌ Mocking internal layers in integration tests.
- ❌ Force-pushing over review comments.

---

## 17. LLM-specific failure modes (read this twice)

These are the failure modes the guard skills exist to catch. They are
common, they are subtle, and they will ship regressions if you let
them.

1. **Hallucinated APIs.** Inventing a utility that doesn't exist
   (`src/utils/formatDistance.js`), or a Mongoose method that doesn't
   exist (`User.findActive()`). Always `git grep` before calling.
2. **Duplicate utilities.** Re-implementing `formatDistance`,
   `parseLatLng`, or Haversine inline because you didn't read Section 11.
3. **Loose assertions that pass on `undefined`.**
   `expect(res.body.data.foo).toBeDefined()` where `foo` was renamed to
   `bar`. The test passes; the regression ships. Pin the new contract.
4. **Tests that test the mock.** Mocking the service in an integration
   test, then asserting the service was called. You tested the mock,
   not the code.
5. **Over-engineering.** Adding a strategy pattern, a factory, an
   abstraction layer, or a config flag for a single concrete case.
   YAGNI.
6. **Dead code.** Leaving the old function "just in case" alongside
   the new one. Delete it.
7. **Magic strings.** Hardcoding `'donor'` in twenty places instead of
   using the existing role constant.
8. **Inconsistent error mapping.** Some controllers throw `HttpError`,
   others call `response.error()`, others return `res.json({ error })`.
   Pick the project's pattern (Section 5) and use it everywhere.
9. **Rewriting files to "improve" them while changing behavior.** A
   refactor PR that also fixes a bug silently is two PRs. Split.
10. **Ignoring `openapi.yaml`.** Adding a route and never updating the
    spec. The Flutter client breaks in production.
11. **Inventing a new logging pattern.** `console.log` in one file,
    `winston` in another, `pino` in a third. Use the project's logger.
12. **Silently changing env var names.** Renaming `JWT_SECRET` to
    `JWT_SECRET_KEY` and not updating `.env.example` or deployment.
13. **"Fixing" pre-existing test failures as part of an unrelated
    change.** Flag them in the PR. They may be intentional.
14. **Adding a new dependency when an existing one suffices.**
    `lodash` is already there. Don't add `underscore`.
15. **Writing a 200-line function because the task was complex.**
    Decompose. See Section 4.6.
16. **Copy-pasting a controller and renaming variables.** Extract the
    shared logic into a service function.
17. **Forgetting the discriminator.** Adding a field to `User` and not
    checking whether `Donor` and `Hospital` need different defaults.
18. **Assuming Mongoose validation runs.** It only runs on `save()` and
    `findOneAndUpdate` with `runValidators: true`. Read the call site.
19. **Treating `npm test` green as "done".** Green means tests pass.
    Done means guards pass, docs updated, cross-file impact reviewed,
    commit hygiene clean.
20. **Quietly expanding scope.** "While I was here, I refactored the
    auth middleware." Stop. Open a separate PR.
21. **Skipping the Repository layer.** Writing raw Mongoose queries
    inside a service instead of using `src/repositories/`. Services
    orchestrate; repositories query.

---

## 18. Definition of done

A change is done when **all** of the following are true:

- [ ] Phase 0 orientation complete (Section 0).
- [ ] Planning section in the PR description (Section 1).
- [ ] Code matches the layer's existing style (Section 4).
- [ ] No forbidden patterns (Section 16).
- [ ] `openapi.yaml` updated if API surface changed (Section 3).
- [ ] `public/swagger-custom.js` updated if paths changed.
- [ ] Cross-file impact reviewed and listed (Section 6).
- [ ] Tests updated **before** running the suite (Section 6.2).
- [ ] `npm test` green.
- [ ] Relevant guard skills passed (Section 12).
- [ ] No new ESLint warnings.
- [ ] No new dependencies, or justified + audited (Section 8).
- [ ] Docs updated (`README.md`, `CHANGELOG.md`, JSDoc) where relevant.
- [ ] Commit atomic, message follows Section 15.2.
- [ ] No secrets, no debug logs, no commented-out code (Section 15.3).
- [ ] LLM failure modes from Section 17 reviewed and ruled out.

If you cannot tick every box, the work is not done. Say so in the PR
and ask the maintainer.

---

## 19. When in doubt

- If a change affects the API surface, update `openapi.yaml`.
- If a change touches auth or user management, run the relevant guard
  skill before considering the work done.
- If you find a pre-existing failure in `npm test`, **do not paper
  over it.** Flag it in the PR and ask the maintainer before "fixing"
  it — it may be intentional or scoped to a separate effort.
- If a rule here conflicts with the codebase, trust the codebase's
  existing pattern in the file you're editing and flag the conflict
  in the PR. Do not silently introduce a second pattern.
- If a task feels too big for one commit, it is. Split it.
- If you're not sure whether something is a breaking change, treat it
  as one. Document it in `CHANGELOG.md` and the PR.

---

**End of rules. Read Section 0 and Section 17 before every change. Tick Section 18 before
every PR.**
