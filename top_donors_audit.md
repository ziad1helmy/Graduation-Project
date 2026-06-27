# Top Donors — Bug Report & Audit

There are **three separate "top donors" endpoints** in this API. The Flutter team needs to know which one they're calling, because each has different shapes and different bugs.

---

## Endpoint Map

| # | Route | Handler | Ranked by |
|---|-------|---------|-----------|
| 1 | `GET /admin/analytics/top-donors` | `analyticsService.getTopDonors()` | Completed donation **count** |
| 2 | `GET /analytics/leaderboard` | `analyticsService.getLeaderboard()` | Points balance in a time window |
| 3 | `GET /rewards/leaderboard` | `rewardService.getLeaderboard()` | Lifetime points earned |

---

## Bug 1 — `/admin/analytics/top-donors`: Donors with no `DonorPoints` record are silently dropped

**File:** [`src/services/analytics.service.js#L362-L463`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/analytics.service.js#L362-L463)

**Root cause:**
The pipeline does `{ $unwind: '$donor' }` on line 400 — but there's no `preserveNullAndEmptyArrays: true` on this stage. If a donor document was soft-deleted *after* they donated (i.e. `deletedAt` is not null), or if the `users` lookup returns zero results for any reason, `$unwind` **silently removes that donor from the list** entirely.

```js
// Line 400 — no preserveNullAndEmptyArrays
{ $unwind: '$donor' },
```

**Effect:** A donor who completed 10 donations but whose user document doesn't pass the `$match` inside the lookup (e.g., their `deletedAt` is set, even wrongly) is completely invisible. Flutter sees fewer items than expected.

**Fix:**
```js
{ $unwind: { path: '$donor', preserveNullAndEmptyArrays: false } },
```
This is the intended behaviour (skip truly deleted users), but the real problem is the `$lookup` filter also excludes users where `deletedAt` is not explicitly `null` — it uses `$eq: ['$deletedAt', null]` which won't match documents where `deletedAt` field does not exist at all (common for users created before soft-delete was added).

**Fix for the lookup match:**
```js
// Current (broken for docs where deletedAt field is absent):
{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$donorId'] }, { $eq: ['$deletedAt', null] }] } } }

// Fixed (treat missing deletedAt as not deleted):
{ $match: { $expr: { $and: [
  { $eq: ['$_id', '$$donorId'] },
  { $or: [{ $eq: ['$deletedAt', null] }, { $not: { $ifNull: ['$deletedAt', false] } }] }
] } } }

// Simpler fix — use $in with [null, undefined] or move the filter:
{ $match: { $expr: { $eq: ['$_id', '$$donorId'] }, deletedAt: { $in: [null] } } }
```

---

## Bug 2 — `/admin/analytics/top-donors`: `totalDonations` vs `completedDonations` field name inconsistency

**The backend runtime response** recorded in `backend_future_flutter_expected_responses.md` (line 5842) shows the **raw aggregation shape** before mapping:

```json
{
  "_id": "...",
  "completedDonations": 12,
  "donor": { "fullName": "...", "bloodType": "A+" }
}
```

But the **actual service** (line 443-463) maps it and returns:
```js
{
  id: d.donorId.toString(),
  name: d.fullName,
  totalDonations: Math.floor(d.completedDonations),  // ← mapped to totalDonations
  ...
}
```

**The Flutter expected-response doc is outdated/wrong.** It shows the pre-mapping raw shape, not the real response. If the Flutter team built their model on `backend_future_flutter_expected_responses.md`, they are parsing the wrong fields (e.g. reading `completedDonations` which doesn't exist in the real response, or trying to access `donor.fullName` instead of top-level `name`).

**Real shape returned by the backend:**
```json
{
  "id": "...",
  "name": "Ziad Abdelghany",
  "email": "ziad@example.com",
  "phoneNumber": "01234567890",
  "bloodType": "A+",
  "totalDonations": 12,
  "points": 2400,
  "isEligibleToDonate": true,
  "isActive": true,
  "isVerified": true,
  "location": "Cairo, Cairo",
  "gender": "male",
  "age": 30,
  "weight": 75,
  "healthStatus": "healthy",
  "isBanned": false,
  "donorRank": 1,
  "createdAt": "2024-01-15T08:30:00.000Z"
}
```

---

## Bug 3 — `/analytics/leaderboard`: Missing donors due to two-query join bug

**File:** [`src/services/analytics.service.js#L524-L558`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/analytics.service.js#L524-L558)

**Root cause:** This function does two separate queries:
1. First fetches donors with `lastDonationDate >= startDate`
2. Then fetches `DonorPoints` sorted by `pointsBalance` descending, limited to `limit`
3. Joins them in JavaScript: `donors.find(d => d._id.toString() === account.donorId.toString())`

**Problem:** The `.limit(limit)` is applied to `DonorPoints` — NOT to the joined donors. A donor can have a high points balance but no recent donations, so they appear in the top `DonorPoints` records but not in `donors`. When the JS `.find()` fails to match them, they return `undefined` as `donor`. The spread `...donor` then spreads `undefined`, causing those entries to have `undefined` for `fullName`, `bloodType`, etc.

**Additionally:** The result array has `count: topDonors.length` but `topDonors` contains entries with undefined donor fields — Flutter gets items with all `null`/`undefined` values for name, blood type, email.

**Fix:** Use a single aggregation pipeline with `$lookup` (same pattern as `getTopDonors`), or at minimum filter out entries where `donor` is `undefined` before returning.

---

## Bug 4 — `/rewards/leaderboard`: No auth filter — includes suspended/deleted donors

**File:** [`src/services/reward.service.js#L810-L827`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/reward.service.js#L810-L827)

```js
const accounts = await DonorPoints.find({})   // ← no filter at all
  .sort({ lifetimePointsEarned: -1 })
  .limit(cappedLimit)
  .populate('donorId', 'fullName');
```

`DonorPoints.find({})` returns records for **all donors**, including suspended, soft-deleted, and unverified ones. `fullName` may be `null` if `donorId` was hard-deleted (orphaned `DonorPoints`). Flutter will see items where `fullName === null` or `donorId === null`.

---

## Summary Table

| Endpoint | Bug | Severity | Flutter Impact |
|----------|-----|----------|---------------|
| `GET /admin/analytics/top-donors` | Donors missing if `deletedAt` field is absent (not null, just absent) | High | Fewer items than expected |
| `GET /admin/analytics/top-donors` | Flutter expected-response doc shows wrong pre-mapping shape | High | Flutter parsing `donor.fullName`, `completedDonations` — fields that don't exist in real response |
| `GET /analytics/leaderboard` | Two-query join drops top-point donors who haven't donated recently; returns items with `undefined` fields | High | Items with missing name/bloodType/email |
| `GET /rewards/leaderboard` | No filter on suspended/deleted donors; orphaned `DonorPoints` yield null `fullName` | Medium | Null name entries in leaderboard |

---

## Recommended Actions (Priority Order)

1. **Fix the Flutter model first** — update the Flutter team's data model to use the actual API shape (fields: `id`, `name`, `totalDonations`, `donorRank`, etc.) not the `backend_future_flutter_expected_responses.md` shape.

2. **Fix `/admin/analytics/top-donors` lookup filter** — change `{ $eq: ['$deletedAt', null] }` to also match documents where `deletedAt` doesn't exist.

3. **Fix `/analytics/leaderboard`** — rewrite as a single aggregation pipeline to avoid the two-query mismatch. The `$limit` must come after the join, not before.

4. **Fix `/rewards/leaderboard`** — add a `deletedAt: null, isSuspended: false` filter, and handle orphaned `DonorPoints` where `populate` returns `null`.
