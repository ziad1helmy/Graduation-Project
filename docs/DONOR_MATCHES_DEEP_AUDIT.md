# GET /donor/matches Deep Audit

Last audited: May 31, 2026

This audit traces the live implementation, not the prose documentation.

## Route Trace

- Route: [src/routes/donor.routes.js](../src/routes/donor.routes.js) mounts `GET /matches` to `donorController.getMatches`.
- Controller: [src/controllers/donor.controller.js](../src/controllers/donor.controller.js) loads the authenticated donor and calls `matchingService.findCompatibleRequests(donor._id)`.
- Matching engine: [src/services/matching.service.js](../src/services/matching.service.js) performs eligibility checks, request filtering, distance calculation, and final ranking.
- Eligibility engine: [src/services/eligibility.service.js](../src/services/eligibility.service.js) enforces donation cooldown, temporary deferral, travel deferral, and active-donation blocking.

## Eligibility Rules

| Rule | File | Method | Enforcement Status |
|---|---|---|---|
| Blood type incompatible | [src/services/matching.service.js](../src/services/matching.service.js) | `evaluateMatch()` / `checkEligibility()` | Implemented |
| ABO incompatible | [src/services/matching.service.js](../src/services/matching.service.js) and [src/utils/blood-type.js](../src/utils/blood-type.js) | `isBloodTypeCompatible()` | Implemented |
| Rh incompatible | [src/services/matching.service.js](../src/services/matching.service.js) and [src/utils/blood-type.js](../src/utils/blood-type.js) | `isBloodTypeCompatible()` | Implemented |
| Donor participation disabled | [src/controllers/donor.controller.js](../src/controllers/donor.controller.js) and [src/services/matching.service.js](../src/services/matching.service.js) | `getMatches()` / `findCompatibleRequests()` | Implemented |
| Donor is suspended | [src/middlewares/auth.middleware.js](../src/middlewares/auth.middleware.js) and [src/services/matching.service.js](../src/services/matching.service.js) | auth gate / `findCompatibleRequests()` | Implemented |
| Donor is inactive | [src/middlewares/auth.middleware.js](../src/middlewares/auth.middleware.js) | `authMiddleware()` | Implemented at auth layer via `deletedAt`; no separate donor inactive flag exists in the matching service |
| Donor has an active donation | [src/services/eligibility.service.js](../src/services/eligibility.service.js) and [src/services/matching.service.js](../src/services/matching.service.js) | `hasActiveDonationInProgress()` / `canDonate()` / `findCompatibleRequests()` | Implemented |
| Donor is inside donation cooldown | [src/services/eligibility.service.js](../src/services/eligibility.service.js) | `evaluateDonationIntervalRule()` | Implemented |
| Donor has a temporary deferral | [src/services/eligibility.service.js](../src/services/eligibility.service.js) | `evaluateTemporaryDeferralRule()` | Implemented |
| Donor has a travel deferral | [src/services/eligibility.service.js](../src/services/eligibility.service.js) | `evaluateTravelDeferralRule()` | Implemented |
| Donor already responded to the request | [src/services/matching.service.js](../src/services/matching.service.js) | `findCompatibleRequests()` | Implemented |
| Donor already has an appointment for the request | [src/services/matching.service.js](../src/services/matching.service.js) | `findCompatibleRequests()` | Implemented, and stricter than requested: any active appointment blocks all donor matches |
| Donor already has an accepted donation | [src/services/matching.service.js](../src/services/matching.service.js) and [src/controllers/request.controller.js](../src/controllers/request.controller.js) | `findCompatibleRequests()` / request acceptance flow | Implemented through request status + existing donation/appointment blocking; there is no standalone `accepted` donation status in the donation model |
| Request is completed | [src/services/matching.service.js](../src/services/matching.service.js) | `buildRequestQuery()` / `isRequestMatchable()` | Implemented |
| Request is cancelled | [src/services/matching.service.js](../src/services/matching.service.js) | `buildRequestQuery()` / `isRequestMatchable()` | Implemented |
| Request is expired | [src/services/matching.service.js](../src/services/matching.service.js) and [src/controllers/request.controller.js](../src/controllers/request.controller.js) | `buildRequestQuery()` / `isRequestMatchable()` | Implemented |

## Distance Verification

- Distance source for donor matches: donor coordinates from `donor.location.coordinates` in `findCompatibleRequests()` via `getDonorLocationPoint()` / `extractDonorLocation()`.
- Request/hospital coordinates source: `request.locationHospital`, `request.hospitalLocation`, `request.hospitalLocationGeo`, and populated `request.hospitalId.location`.
- Radius source: `MATCHING_DISTANCE_KM` from [src/config/env.js](../src/config/env.js), defaulting to `30` km in [src/services/matching.service.js](../src/services/matching.service.js).
- Matching distance configuration: `DEFAULT_MATCHING_DISTANCE_KM` is resolved once at module load and used unless an explicit radius override is passed into the service.
- Actual filtering logic:
  - `buildRequestGeoQuery()` applies a MongoDB `$near` prefilter when donor coordinates are available.
  - `evaluateMatch()` recalculates Haversine distance with [src/utils/geo.js](../src/utils/geo.js).
  - Any result with `distanceKm > radiusKm` is rejected with `eligibility.outsideMatchingRadius`.

## Ranking Verification

The final donor-match order is determined by the `score` field returned from `findCompatibleRequests()`.

Current scoring behavior:

1. Start at `100`.
2. Add `20` when the donor blood type is an exact match for the request blood type.
3. Add an urgency bonus: `critical = 25`, `high = 15`, `medium = 5`, `low = 0`.
4. Average the running score with the location score from `geoUtil.getLocationScore(distanceKm, radiusKm)`.
5. Sort descending by `score`.

What ranking uses:

- Distance: yes, indirectly through `locationScore` and the radius gate.
- Emergency priority: yes, through the urgency bonus.
- Blood compatibility score: yes, through the exact-match bonus and the compatibility gate.
- Urgency: yes, through the urgency bonus.
- Creation date: not an explicit ranking input for `/donor/matches`; it only appears in the upstream request query fallback when no geo query is used.

## Response Payload Audit

The response shape for `GET /donor/matches` is:

```json
{
  "success": true,
  "message": "Matching requests retrieved successfully",
  "data": {
    "matches": [
      {
        "request": { "...raw populated request document..." },
        "score": 96.8,
        "locationScore": 73.5,
        "compatibility": {
          "bloodTypeMatch": true,
          "eligible": true,
          "distanceKm": 2.4
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1
    }
  }
}
```

Verified returned fields:

- Top level: `success`, `message`, `data`
- Data: `matches`, `pagination`
- Match item: `request`, `score`, `locationScore`, `compatibility`
- Compatibility block: `bloodTypeMatch`, `eligible`, `distanceKm`

What is not returned as a flattened field:

- `requestId` is not top-level; use `match.request._id`.
- `distanceKm` is not top-level; use `match.compatibility.distanceKm`.
- `compatibilityScore` is not a separate field; the service returns `score`.

Sensitive exposure check:

- The nested `request` object is the real Mongoose request document, so it includes request fields such as `hospitalContact`, `qrToken`, `qrCreatedAt`, and `qrExpiresAt` when present.
- The populated `hospitalId` path is limited to `address` and `location` in the matching service, so hospital credentials or private profile fields are not exposed by this endpoint.

## Matching Accuracy Verification

### Scenario 1

Matching donor + nearby request + compatible blood type

Expected: Returned

Status: Implemented and covered by matching service tests.

### Scenario 2

Matching donor + compatible blood type + outside radius

Expected: Not returned

Status: Implemented and covered by matching service tests.

### Scenario 3

Nearby request + wrong blood type

Expected: Not returned

Status: Implemented and covered by matching service tests.

### Scenario 4

Compatible request + active donation exists

Expected: Not returned

Status: Implemented and covered by matching service tests.

### Scenario 5

Compatible request + donor already responded

Expected: Not returned

Status: Implemented and covered by matching service tests.

### Scenario 6

Emergency request + compatible donor + nearby

Expected: Returned and ranked correctly

Status: Implemented. Ranking uses the urgency bonus and location score.

## Matching Consistency Audit

`GET /donor/matches` and the donor branch of `GET /requests/nearby` both call `matchingService.findCompatibleRequests()`.

Differences:

- `/donor/matches` always uses the default matching radius from `MATCHING_DISTANCE_KM` and does not accept matching filters.
- `/requests/nearby` can accept `radius`, `bloodType`, `type`, `urgency`, and `isEmergency` filters when called by a donor.
- `/requests/nearby` reshapes the match results into request payloads with `distanceKm` at the top level, while `/donor/matches` returns the raw request document nested under `request`.
- Non-donor callers of `/requests/nearby` do not use the donor eligibility path; they use request-centric nearby filtering instead.

## OpenAPI Update

The OpenAPI contract for `/donor/matches` has been updated to reflect the real nested response shape:

- `matches[].request` is a populated request document.
- `matches[].score` is the ranking score.
- `matches[].locationScore` is the location component of the score.
- `matches[].compatibility.distanceKm` is the actual distance value.
- Error responses document `401`, `403`, and `404`.

## Final Verdict

Can `GET /donor/matches` ever return a request that:

- does not match the donor's blood type
- is outside the allowed radius
- violates donor eligibility rules
- is already completed, cancelled, or expired

Answer: NO.

Code evidence:

- Blood compatibility and eligibility are enforced in [src/services/matching.service.js](../src/services/matching.service.js).
- Donation cooldown, temporary deferral, travel deferral, and active donation blocking are enforced in [src/services/eligibility.service.js](../src/services/eligibility.service.js).
- Request terminal states are excluded by request query and `isRequestMatchable()` in [src/services/matching.service.js](../src/services/matching.service.js).
- Suspended and deleted donors are blocked before the endpoint can be used in [src/middlewares/auth.middleware.js](../src/middlewares/auth.middleware.js).

Test evidence:

- Existing matching service unit tests cover incompatible blood type, radius exclusion, opt-out, suspension, active donations, active appointments, responded requests, and terminal request states in [tests/unit/matching.service.test.js](../tests/unit/matching.service.test.js).
- Additional regression tests in this change pin the temporary-deferral, travel-deferral, and response-shape behavior.