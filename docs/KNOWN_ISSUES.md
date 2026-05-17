# LifeLink Known Issues & Technical Debt

> This document tracks bugs, inconsistencies, and technical debt identified during the May 2026 forensic audit. Items are prioritized by severity.

---

## 🔴 Critical

### 1. Firebase Service Account File May Be Committed to Repository

**File**: `config/service-account.json`  
**Description**: The Firebase service account JSON file exists at `config/service-account.json`. If this file contains real credentials and is tracked by git, it constitutes a critical security vulnerability as it grants write access to the Firebase project.

**Immediate Actions Required**:
1. Check `git ls-files config/service-account.json` — if tracked, it MUST be removed
2. Rotate all Firebase service account credentials immediately if committed
3. Add `config/service-account.json` to `.gitignore`
4. Use environment variables (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) instead of the file path

**Current State**: `env.js` supports both `FIREBASE_SERVICE_ACCOUNT_PATH` and individual env vars. Prefer env vars.

---

## 🟠 High Severity

### 2. FCM Notifications Are Synchronous (Blocks Request Completion)

**Files**: `src/services/notification.service.js`, `src/utils/fcm.js`  
**Description**: All Firebase Cloud Messaging calls (`sendToMultiple`, `sendToOne`) are `await`ed within the HTTP request-response cycle. If Firebase is slow or rate-limits responses, the donor's or hospital's API call will hang.

**Impact**: Under moderate load (100+ concurrent users), this could cause:
- Request timeouts for donors accepting emergencies
- Node.js event loop blocking during multicast sends

**Recommended Fix**: Implement a message queue (Bull/BullMQ + Redis). Notification jobs are enqueued synchronously (fast) and processed asynchronously by a worker process.

---

### 3. N+1 Query in `analytics.service.getDonorStats`

**File**: `src/services/analytics.service.js`, line ~239  
**Description**:
```javascript
for (const donation of donations) {
  const request = await Request.findById(donation.requestId).lean(); // N+1!
  const donationType = request?.type || 'blood';
  // ...
}
```
For a donor with 50 donations, this fires 50 sequential DB queries.

**Recommended Fix**: Use `$lookup` aggregation pipeline or populate in the initial query:
```javascript
await Donation.find({ donorId, status: 'completed' })
  .populate('requestId', 'type')
  .lean();
```

---

## 🟡 Medium Severity

### 4. No MongoDB 2dsphere Index on Donor Location for Geo-Matching

**File**: `src/models/Donor.model.js`, `src/services/matching.service.js`  
**Description**: The matching service loads **all eligible donors** from MongoDB and performs Haversine distance calculations in JavaScript. There is no `2dsphere` index on the `location` field to pre-filter by proximity using MongoDB's native geo-query operators.

**Impact**: For large donor pools (1000+ donors), this creates a full collection scan + in-memory processing.

**Recommended Fix**:
1. Store donor location as GeoJSON: `{ type: 'Point', coordinates: [lng, lat] }`
2. Add index: `donorSchema.index({ location: '2dsphere' })`
3. Pre-filter with: `Donor.find({ location: { $near: { $geometry: hospitalGeoPoint, $maxDistance: 50000 } } })`

---

### 5. In-Memory Rate Limiting Store

**File**: `src/middlewares/rateLimit.middleware.js`  
**Description**: The `express-rate-limit` middleware uses the default in-memory store. Rate limit counters reset on server restart and are not shared between multiple instances.

**Impact**: In a multi-instance or serverless deployment, rate limits are per-instance and ineffective at the platform level.

**Recommended Fix**: Use `rate-limit-redis` with a shared Redis instance:
```javascript
import RedisStore from 'rate-limit-redis';
```

---

### 6. `JWT_REFRESH_SECRET` Falls Back to `JWT_SECRET`

**File**: `src/config/env.js`, line 34  
**Description**: If `JWT_REFRESH_SECRET` is not set, the refresh token uses the same secret as the access token.

**Impact**: If the `JWT_SECRET` is compromised, both token types are compromised. Access tokens and refresh tokens should use separate secrets.

**Recommended Fix**: Make `JWT_REFRESH_SECRET` a required environment variable.

---

## 🟢 Low Severity

### 7. Duplicate `weight` Field in Donor Schema

**File**: `src/models/Donor.model.js`  
**Description**: The `weight` field appears to be defined twice in the donor schema. Mongoose uses the last definition.

**Fix**: Remove the duplicate definition, keep only one.

---

### 8. `console.error` Used Instead of Structured Logger

**Files**: `src/controllers/donor.controller.js` (several catch blocks), `src/services/analytics.service.js`  
**Description**: Several catch blocks use `console.error()` directly instead of `logger.error()`. This means these error events are not captured by the structured logging pipeline.

**Affected patterns**:
```javascript
}).catch((error) => {
  console.error('Activity log error:', error.message); // should be logger.error(...)
});
```

**Fix**: Replace all `console.error` with `logger.error({ message: error.message, ... })`.

---

### 9. Missing `ar.json` Arabic Locale File

**File**: `src/locales/` directory  
**Description**: Only `en.json` exists. The Donor settings include a `language` field (`'en'` or `'ar'`), but there is no corresponding `ar.json` translation file, and no i18n middleware consumes the language setting at runtime.

**Fix**: Create `ar.json` with Arabic translations and implement i18n middleware that checks `req.user.settings.language`.

---

### 10. Webhook Controller Is a Stub

**File**: `src/controllers/webhook.controller.js`  
**Description**: The webhook route is registered and returns HTTP 200, but the handler contains no actual logic (no signature verification, no payload processing).

**Fix**: Implement webhook signature verification and payload dispatch, or remove the route if external webhooks are not required.

---

### 11. Mixed CRLF Line Endings in Admin Routes

**File**: `src/routes/admin.routes.js`  
**Description**: The file uses `\r\n` (Windows CRLF) line endings while the rest of the codebase uses `\n` (Unix LF). This is a cosmetic inconsistency but can cause issues with git diffs and linting.

**Fix**: Run `dos2unix src/routes/admin.routes.js` or configure `.editorconfig`/prettier to enforce LF.

---

### 12. Leaky `getAdminProfile` Error vs `listAdmins` Inconsistency

**File**: `src/controllers/admin.controller.js`  
**Description**: `listAdmins` is defined as an alias for `getAllAdmins` but the alias is bound before `getAllAdmins` is defined, relying on hoisting. This works due to `const` temporal dead zone behavior but is brittle.

---

### 13. `totalPoints` vs `pointsBalance` Field Inconsistency in Donor Dashboard Response

**File**: `src/controllers/donor.controller.js`, getDashboard handler  
**Description**:
```javascript
points: pointsSummary?.pointsBalance || pointsSummary?.totalPoints || 0,
```
The fallback to `totalPoints` suggests that `getPointsSummary` may return inconsistent field names in different scenarios. This should be standardized to always use `pointsBalance`.

---

## Resolved Issues

| Issue | Resolution |
|-------|-----------|
| `broadcastRequest` not triggering FCM | Fixed: matching service now called correctly in broadcast flow |
| FCM token not cleaned up on logout | Fixed: fire-and-forget `$pull` on logout |
| Admin login adminKey not validated | Fixed: string comparison added in `admin.service.loginAdmin` |
| Maintenance mode cache not invalidated on change | Fixed: `invalidateMaintenanceCache()` called in `setMaintenanceMode` |
