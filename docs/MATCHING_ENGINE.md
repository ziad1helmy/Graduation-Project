# LifeLink Matching Engine

---

## Overview

The matching engine connects blood donation requests to compatible, eligible, nearby donors. It lives entirely in `src/services/matching.service.js` and is called synchronously on request creation and by the broadcast endpoint.

---

## Blood-Type Compatibility Matrix

The engine implements standard ABO/Rh compatibility rules:

| Recipient Blood Type | Compatible Donor Types |
|---------------------|----------------------|
| A+ | A+, A-, O+, O- |
| A- | A-, O- |
| B+ | B+, B-, O+, O- |
| B- | B-, O- |
| AB+ | All types (universal recipient) |
| AB- | AB-, A-, B-, O- |
| O+ | O+, O- |
| O- | O- (universal donor for O-) |

The matrix is stored as a JavaScript object in the service file and looked up by key `bloodTypes[requestBloodType]` returning an array of compatible donor blood types.

---

## Donor Pre-Filtering Criteria

Before geo-scoring, donors are filtered to eligible candidates:

```javascript
Donor.find({
  bloodType: { $in: compatibleBloodTypes },
  isAvailable: true,
  isSuspended: false,
  isEmailVerified: true,
  deletedAt: null,
  // location presence check (optional — donors without location are less useful)
})
```

---

## Geo-Proximity Scoring

Once compatible donors are retrieved, each is scored using **Haversine distance** between:
- **Donor**: `donor.location.coordinates` (lat/lng)
- **Hospital**: `request.hospitalId.lat` / `request.hospitalId.long`

```
Haversine formula:
a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlng/2)
c = 2·asin(√a)
distance = R·c  (R = 6371 km)
```

**Score calculation** (conceptual):
```
compatibilityScore = isExactMatch ? 1.0 : 0.7  (exact blood type vs compatible)
distanceScore = max(0, 1 - distance/maxDistance)
finalScore = (compatibilityScore * 0.6) + (distanceScore * 0.4)
```

Donors are sorted descending by final score. Closer, exact-match donors rank first.

---

## Eligibility Pre-Check

For each scored donor, the eligibility service is invoked before they are included in the notification list:

```javascript
const eligibility = await eligibilityService.canDonate(donor, { donationType: request.type });
if (!eligibility.eligible) continue; // Skip ineligible donors
```

This ensures FCM notifications are only sent to donors who are actually able to donate, avoiding false alarms.

---

## Key Functions

### `findCompatibleDonors(request)`

Used by `notification.service.broadcastRequest()`.

```
Input: Request document (with populated hospitalId)
Output: Array of compatible, eligible, scored Donor documents
```

1. Lookup compatible blood types from matrix
2. Query Donor collection for pre-filtered candidates
3. Haversine-score each candidate
4. Filter out ineligible donors
5. Return sorted array

### `findCompatibleRequests(donorId)`

Used by `GET /donor/matches` endpoint.

```
Input: Donor ObjectId
Output: Array of active requests compatible with the donor's blood type, with distance
```

1. Fetch donor with location and blood type
2. Fetch active requests (pending/in-progress) compatible with donor's blood type
3. Calculate distance for each request from donor's location
4. Return scored + sorted request list

### `checkEligibility(donor, request)`

Used by `donation.service.validateEligibility()`.

```
Input: Donor document, Request document
Output: { eligible: boolean, reason: string, nextEligibleDate?: Date }
```

Delegates to the eligibility service rules pipeline.

---

## Known Limitations

### No Native Geo-Query (No 2dsphere Index)

The current implementation loads **all blood-type-compatible donors** from MongoDB and performs distance calculations in application memory. For large donor pools, this creates:

1. A large result set from MongoDB
2. O(n) in-memory Haversine calculations
3. No spatial pre-filtering

**Production recommendation**: 
1. Store donor location as GeoJSON Point: `{ type: 'Point', coordinates: [longitude, latitude] }`
2. Add: `donorSchema.index({ location: '2dsphere' })`
3. Use MongoDB `$near` to pre-filter donors within a radius before scoring:
   ```javascript
   Donor.find({
     location: {
       $near: {
         $geometry: { type: 'Point', coordinates: [hospitalLng, hospitalLat] },
         $maxDistance: 50000  // 50km
       }
     },
     bloodType: { $in: compatibleTypes },
     ...
   })
   ```

### No Time-of-Day Availability

Donors don't have per-hour availability windows. The `isAvailable` flag is a binary toggle. Future enhancement: availability schedules (e.g., "available on weekdays 9am–6pm").

### No Multi-Request Deduplication

If a donor is compatible with multiple active requests, they may receive multiple FCM notifications in quick succession. No throttling or deduplication is applied between concurrent broadcasts.
