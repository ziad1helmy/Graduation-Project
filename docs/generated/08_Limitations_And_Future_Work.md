# LifeLink — Limitations & Future Work

> **Document Type:** Software Documentation  
> **Version:** 1.0  
> **Generated From:** Codebase Analysis — June 2026  

> All limitations listed here are directly evidenced from the codebase and project documentation. Nothing is speculated.

---

## 1. Current Limitations

### 1.1 FCM Notifications Are Synchronous

**What:** Firebase Cloud Messaging (FCM) push notifications are dispatched **synchronously** within the HTTP request lifecycle. If Firebase's servers are slow to respond, the entire API request is blocked until FCM completes.

**Impact:** Under high load or Firebase latency spikes, donor-facing API response times will degrade. The primary affected flows are:
- Donor accepting a request (`POST /requests/:id/accept`)
- Hospital creating a request (triggers donor notification fan-out)

**Evidence:** `README.md` — "FCM notifications are synchronous — slow Firebase responses block API request completion"

---

### 1.2 No Asynchronous Job Queue (Bull/BullMQ)

**What:** Background processing is implemented via in-process `setInterval` loops in two workers:
- `notificationOutbox.worker.js` — polls every 5 seconds
- `requestEscalation.worker.js` — polls every 60 seconds

**Impact:**
- Workers share the same Node.js event loop as the HTTP server; a slow worker iteration can introduce latency spikes
- Workers are not safe for **horizontal scaling** — running multiple server instances would result in duplicate worker executions unless the outbox's atomic claim logic prevents it
- No retry-with-backoff for failed jobs; failures are logged and the next poll iteration resumes
- Worker state is lost on server restart

**Evidence:** `docs/PROJECT_STATUS.md` — "No Redis-based job queue (Bull/BullMQ) — workers use in-process `setInterval`"

---

### 1.3 Rate Limiting Is In-Memory

**What:** Both rate limiters (`authLimiter` and `limiter`) use an in-memory store (no Redis).

**Impact:**
- Rate limit counters **reset** when the server restarts
- In a multi-instance deployment, each instance maintains its own counter independently, effectively multiplying the effective rate limit by the number of instances
- Not suitable for production deployments with more than one server process

**Evidence:** `README.md` — "Rate limiting uses in-memory store (resets on server restart; not Redis-backed)"

---

### 1.4 No Docker or CI/CD

**What:** No `Dockerfile`, `docker-compose.yml`, or CI/CD pipeline (e.g., GitHub Actions) exists in the repository.

**Impact:** Every deployment requires manual server setup and dependency installation. There is no automated test gate on pull requests.

**Evidence:** `README.md` Core Features table — "Docker / CI/CD pipeline: ❌ Not implemented", `docs/PROJECT_STATUS.md` — "DevOps: ❌ Not started"

---

### 1.5 Arabic Localization Incomplete

**What:** The i18n middleware (`src/middlewares/i18n.middleware.js`) supports `Accept-Language` detection, and the `Donor.settings.language` field accepts `['en', 'ar']`. However, only `en.json` exists in `src/locales/`.

**Impact:** Arabic language responses are not implemented. Any attempt to request Arabic content will fall back to English.

**Evidence:** `README.md` — "Arabic/English localization support: ✅ Complete (en.json only)" and "Arabic (`ar.json`) translations: Medium priority roadmap item"

---

### 1.6 Webhook Endpoint Is a Stub

**What:** The route `POST /api/webhooks` is mounted and returns a response, but contains no handler logic — it does not process or route any incoming webhook payloads.

**Impact:** No external service integration via webhooks (e.g., payment processors, SMS gateways) is functional.

**Evidence:** `README.md` — "Webhook endpoint: 🔶 Stub (no handler logic)"

---

### 1.7 Duplicate `weight` Field in `Donor.model.js`

**What:** The `README.md` documents a known schema bug: the `weight` field is defined twice in `Donor.model.js`.

**Impact:** Mongoose may silently use the last definition, but this represents a latent bug in the schema definition that could cause unexpected behavior if the schema is modified.

**Evidence:** `README.md` — "`Donor.model.js` has a **duplicate `weight` field** definition"

> **Verification note:** This was mentioned in `README.md`. The model file itself shows one `weight` definition at line 49–53; however, an earlier or later version may have had the duplicate. The README is the authoritative source for this known issue.

---

### 1.8 Matching Engine Is Not Geo-Index-Optimized

**What:** The donor matching engine uses Haversine distance calculated in JavaScript, with a fallback when MongoDB's `$near` geo-index query fails. The geospatial index (`2dsphere`) is only enabled when `ENABLE_GEOSPATIAL_INDEX=true`.

**Impact:** For large donor populations, the fallback path loads all candidates and sorts them in memory, which is O(n) in database reads and O(n log n) in memory. This does not scale to hundreds of thousands of donors without enabling the geo-index.

**Evidence:** `src/services/matching.service.js` lines 36–51 (geo-index fallback), `src/models/User.model.js` lines 174–178 (conditional 2dsphere index)

---

### 1.9 No Redis Caching

**What:** The codebase references `src/utils/cache.js` and `src/utils/analytics-cache.js` for caching, but the `AGENTS.md` documents that caching uses Redis **if `REDIS_URL` is configured**, with an in-memory fallback otherwise.

**Impact:** Without Redis, cache entries are lost on server restart and are not shared across multiple server instances. Analytics and expensive query results are re-computed on each cache miss.

**Evidence:** `AGENTS.md` Section 11 — "Cache | `src/utils/cache.js` | Redis (if `REDIS_URL`) or in-memory fallback."

---

## 2. Technical Debt

### 2.1 Deprecated Fields in `Request.model.js`

Several fields in the Request schema are marked as deprecated but retained for backward compatibility with older documents:

| Field | Deprecated Replacement |
|-------|----------------------|
| `quantity` | `unitsNeeded` |
| `cause` | (removed, no replacement) |
| `locationHospital` | `hospitalLocationGeo` |
| `hospitalLocation` | `hospitalLocationGeo` |

These fields consume schema space, complicate validation, and require sync hooks on every write operation.

**Evidence:** `src/models/Request.model.js` lines 62–75

---

### 2.2 Deprecated Fields in `Hospital.model.js`

| Field | Status |
|-------|--------|
| `name` | Deprecated; kept for backward compatibility |
| `contactNumber` | Deprecated; kept for backward compatibility |

**Evidence:** `src/models/Hospital.model.js` lines 78–81

---

### 2.3 Single-Instance Workers

The outbox and escalation workers are not horizontally scalable without ensuring atomic claim logic is implemented in both. The outbox worker documents it uses atomic claiming (`processPendingOutbox` is described as safe to run in multiple instances), but this was not verified in the worker source beyond the comment in `server.js`.

**Evidence:** `src/server.js` lines 36–37 — "The worker is safe to run in multiple instances because it claims entries atomically."

---

### 2.4 Test Coverage Is Partial

The project has 721 tests across 63 test files, but coverage is not complete. The `docs/PROJECT_STATUS.md` marks testing as 🔶 (partial).

**Evidence:** `docs/PROJECT_STATUS.md` — "Testing: 🔶 Partial coverage (721 tests, 63 files)"

---

## 3. Roadmap / Potential Improvements

The following are taken directly from `README.md` and `docs/PROJECT_STATUS.md`:

| Priority | Improvement | Evidence |
|----------|-------------|----------|
| High | Async notification queue (Bull/Redis) — decouple FCM from request lifecycle | `README.md` Roadmap |
| High | Docker + docker-compose setup | `README.md` Roadmap |
| High | CI/CD pipeline (GitHub Actions) | `README.md` Roadmap |
| Medium | Arabic (`ar.json`) translations | `README.md` Roadmap |
| Medium | Webhook handler implementation | `README.md` Roadmap |
| Medium | Redis-backed rate limiting | `README.md` Roadmap |
| Low | ML-based predictive donor matching | `README.md` Roadmap |
| Low | Monitoring / APM integration (Datadog, Logtail) | `docs/SETUP_AND_DEPLOYMENT.md` |

---

## Confidence Report

**Verified Facts:**
- All limitations in Section 1 are directly traceable to source code or explicit README/PROJECT_STATUS documentation.
- Deprecated fields in Section 2.1 and 2.2 come directly from model file comments.
- Roadmap items in Section 3 come word-for-word from `README.md` Roadmap Summary table.
- Test count (721 tests, 63 files) comes from `docs/PROJECT_STATUS.md`.
- Rate limiting in-memory limitation comes from `README.md` Known Limitations.
- Geo-index conditional behavior comes from `User.model.js` and `matching.service.js`.

**Assumptions:** None.

**Missing Information:**
- The extent of actual test coverage (%) was not measured; only the count was cited.
- The `express-mongo-sanitize` package's interaction with the custom sanitizer was not fully traced.

**Potential Uncertainty:**
- The duplicate `weight` field issue in `Donor.model.js` is cited from `README.md`; the current model file shows one definition. This may have been resolved after the README was written, or the README may refer to an internal duplicate within the schema object.
