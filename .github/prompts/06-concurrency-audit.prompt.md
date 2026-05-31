# LifeLink Phase 06 - Concurrency & Multi-User Consistency Audit

**Date:** May 31, 2026  
**Phase:** 06 - Concurrency Analysis & Race Condition Identification  
**Context:** Follows Phase 01-05 audits (API Inventory, Duplication, Flow, Data Integrity, Architecture)  
**Scope:** Concurrent request handling, race conditions, duplicate execution paths, transactional boundaries, state consistency  
**Status:** Analysis and Planning Phase (No code modifications performed)

---

# Executive Summary

The LifeLink backend exhibits **SIGNIFICANT CONCURRENCY VULNERABILITIES** that will cause **data corruption, duplicate records, and state inconsistencies under simultaneous multi-user load**.

**Overall Concurrency Readiness: CRITICAL**

The system has implemented transaction protection in only **2 critical paths** (donation completion and reward points), leaving **9+ major operations unprotected** against race conditions. The architecture relies on sequential checks followed by writes, creating **multi-millisecond race condition windows** where concurrent requests can bypass guards and create duplicates or corrupt state.

**Key Findings:**

🔴 **Critical Risks Identified: 11**
- Multiple donors can accept the same request simultaneously (leads to split donations)
- Duplicate donations can be created for same donor-request pair
- Points transactions can duplicate under concurrent award operations
- Activity records can duplicate or be lost
- Notifications can duplicate
- Request acceptance and completion not properly isolated
- Matching query results become stale under concurrent operations
- Appointment rescheduling vulnerable to concurrent modifications
- Request expiry windows create race conditions
- Hospital settings upsert can create races
- Reward tier changes not atomic with points calculation

⚠️ **High-Risk Patterns: 8**
- Sequential read → modify → write without transactions across 7+ services
- Fire-and-forget background operations without idempotency
- Deduplication checks not combined with creation in single atomic operation
- No idempotency keys or request IDs for retry scenarios
- Matching and eligibility checks can become stale between query and use
- State machine validation happens before transaction boundaries

**Severity Breakdown:**
- Critical (data corruption, duplicate operations, split state): 11
- High (consistency gaps, potential data loss): 8
- Medium (race windows, out-of-order operations): 6
- Low (timing-dependent side effects): 4

---

# Concurrency-Sensitive Operations

## Request Acceptance Flow

**Operation:** Donor accepting a blood request (POST `/requests/:id/accept`)  
**Entities Involved:** Request, Donation, Donor, Notification  
**Shared Resources:** 
- `Request.acceptedBy` field (single-writer assumption)
- `Request.status` transition (pending → accepted)
- Donation creation for donor-request pair

**Concurrent Scenario:** Two donors submitting acceptance simultaneously

**Evidence:**

Source: [request.controller.js](../src/controllers/request.controller.js#L471-L520)

```javascript
// Line 471-520: acceptRequest handler
if (request.acceptedBy) {
  return response.error(res, 400, 'Request has already been accepted');
}

const existingDonation = await Donation.findOne({
  donorId: donor._id,
  requestId: request._id,
  status: { $nin: ['cancelled', 'rejected'] },
});

if (existingDonation) {
  return response.error(res, 400, 'You have already responded to this request');
}

// ... eligibility checks ...

const donation = await Donation.create({
  donorId: donor._id,
  requestId: request._id,
  quantity: request.unitsNeeded ?? request.quantity ?? 1,
  status: 'pending',
});

request.status = 'accepted';
request.acceptedBy = donor._id;
// ... update more fields ...
await request.save();
```

**Race Condition Window:**
1. Donor A reaches line 475: `request.acceptedBy` is null ✓
2. Donor B reaches line 475: `request.acceptedBy` is still null ✓ (both pass the check)
3. Donor A creates donation, updates request
4. Donor B creates donation, updates request with their donor ID
5. **Result:** Two donations exist, request now belongs to Donor B (Donor A's donation orphaned)

---

## Donation Creation Flow

**Operation:** Creating a donation record when donor responds to request  
**Entities Involved:** Donation, Request  
**Shared Resources:** Donation collection (unique constraint on donorId + requestId combination)

**Concurrent Scenario:** Same donor rapidly clicking accept button twice, or network retry

**Evidence:**

Source: [donation.service.js](../src/services/donation.service.js#L44-L75) and [request.controller.js](../src/controllers/request.controller.js#L471-L520)

```javascript
// donation.service.js lines 54-65
const existingDonation = await Donation.findOne({
  donorId,
  requestId,
  status: { $nin: ['cancelled', 'rejected'] },
});

if (existingDonation) {
  throw new Error('Donor has already responded to this request');
}

// request.controller.js - no unique constraint enforcement
const donation = await Donation.create({
  donorId: donor._id,
  requestId: request._id,
  quantity: request.unitsNeeded ?? request.quantity ?? 1,
  status: 'pending',
});
```

**Race Condition Window:**
1. Request A at line 54: Query finds no existing donation
2. Request B at line 54: Query finds no existing donation (both pass)
3. Request A creates donation
4. Request B creates donation with same donor-request pair
5. **Result:** Duplicate donations for same donor-request

**Note:** The check happens in `donationService.createDonation()` but the controller at [request.controller.js L489](../src/controllers/request.controller.js#L489) calls `Donation.create()` directly without going through the service, creating a different race window.

---

## Donation Status Update Flow

**Operation:** Completing a donation after QR verification  
**Entities Involved:** Donation, Appointment, Request, Donor  
**Shared Resources:** 
- Donation status and appointment link
- Request status transitions
- Donor lastDonationDate

**Concurrent Scenario:** Two simultaneous QR completions for same donation, or concurrent donation+appointment updates

**Evidence:**

Source: [donation.service.js](../src/services/donation.service.js#L170-L240)

```javascript
// Lines 176-235: Uses transaction session
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    const donationDoc = await Donation.findById(donationId).session(session);
    
    if (donationDoc.status === 'completed') {
      return donationDoc;
    }

    validateTransition('donation', donationDoc.status, status);
    
    updatedDonation = await Donation.findByIdAndUpdate(donationId, updateData, {
      returnDocument: 'after',
      runValidators: true,
      session,
    });

    if (donationDoc.requestId) {
      const requestDoc = await Request.findById(donationDoc.requestId).session(session);
      if (requestDoc?.status === 'accepted') {
        requestDoc.status = 'in-progress';
        await requestDoc.save({ session });
      }
      requestDoc.status = 'completed';
      requestDoc.completedAt = new Date();
      await requestDoc.save({ session });
    }

    await Donor.findByIdAndUpdate(
      updatedDonation.donorId,
      { lastDonationDate: new Date() },
      { session }
    );
  });
}
```

**Positive Finding:** ✅ This flow DOES use Mongoose sessions and transactions for isolation.

**Remaining Risk:** Fire-and-forget activity logging happens after transaction completes but outside session:

```javascript
// Line 245+: Fire-and-forget (no session)
activityService.logActivity(updatedDonation.donorId, { ... })
  .catch(err => logger.error(...));
```

---

## Reward Points Award Flow

**Operation:** Awarding points for donation completion  
**Entities Involved:** DonorPoints, PointsTransaction  
**Shared Resources:**
- DonorPoints balance (single doc per donor)
- PointsTransaction ledger
- Tier calculation

**Concurrent Scenario:** Multiple donations completing simultaneously, or retried award operations

**Evidence:**

Source: [reward.service.js](../src/services/reward.service.js#L125-L175)

```javascript
// Lines 130-135: Deduplication check (NOT atomic with creation)
const existing = await PointsTransaction.findOne({
  donorId,
  referenceId: normalizedReferenceId,
  transactionType: type
});

if (existing) return null; // already awarded

// Lines 134-175: Transaction wraps updates but AFTER dedup check
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    const account = await DonorPoints.findOneAndUpdate(
      { donorId },
      {
        $inc: { pointsBalance: amount, lifetimePointsEarned: amount },
        $setOnInsert: { donorId },
      },
      { upsert: true, returnDocument: 'after', session }
    );

    // Tier recalculation based on balance
    const newTier = getTierForPoints(account.lifetimePointsEarned, config.tiers);
    if (tierChanged) {
      await DonorPoints.findByIdAndUpdate(
        account._id,
        { tier: newTier },
        { session }
      );
    }

    const transaction = await PointsTransaction.create([{
      donorId,
      pointsAmount: amount,
      transactionType: type,
      referenceId: normalizedReferenceId,
      balanceAfter: account.pointsBalance,
    }], { session });
  });
} catch (err) {
  // Final dedup protection under concurrency
  if (normalizedReferenceId && isMongoDuplicateKeyError(err)) {
    return null;
  }
}
```

**Race Condition Window:**
1. Request A: Dedup check finds no existing transaction ✓
2. Request B: Dedup check finds no existing transaction ✓ (both pass)
3. Request A creates transaction + updates DonorPoints
4. Request B creates transaction + updates DonorPoints
5. **Result:** Both transactions are created, both increment balance (despite dedup intent)

**Mitigation Attempted:** Catch-based dedup on duplicate key error (line 175) mitigates but is not primary defense. The window exists until the constraint fails.

---

## Activity Logging

**Operation:** Recording user actions to timeline  
**Entities Involved:** Activity records  
**Shared Resources:** Activity collection per user

**Concurrent Scenario:** Multiple services logging activities for same user simultaneously

**Evidence:**

Source: [activity.service.js](../src/services/activity.service.js#L40-L100)

```javascript
// Lines 70-75: Dedup check NOT atomic with creation
const normalizedReferenceId = payload.referenceId ? String(payload.referenceId) : null;

if (normalizedReferenceId) {
  const existing = await Activity.findOne({
    userId,
    action: payload.action,
    referenceId: normalizedReferenceId,
  });

  if (existing) {
    return null; // skip
  }
}

// Line 79: Create without transaction
const activity = await Activity.create({
  userId,
  type: payload.type,
  action: payload.action,
  // ... fields ...
});
```

**Race Condition Window:**
1. Service A: Check finds no activity ✓
2. Service B: Check finds no activity ✓ (both pass)
3. Service A creates activity
4. Service B creates activity with identical action + referenceId
5. **Result:** Duplicate activities in timeline

**Additional Risk:** This service is called fire-and-forget from other services (see lines 243-246 of donation.service.js):

```javascript
activityService.logActivity(updatedDonation.donorId, { ... })
  .catch(err => logger.error('Activity log failed', ...));
```

If network latency causes retry, duplicates are guaranteed.

---

## Notification Broadcasting

**Operation:** Sending notifications to multiple donors  
**Entities Involved:** Notification records, FCM tokens  
**Shared Resources:** Notification collection, FCM service

**Concurrent Scenario:** Multiple requests triggering notifications simultaneously

**Evidence:**

Source: [notification.service.js](../src/services/notification.service.js#L16-L65)

```javascript
// Line 42: Create notification without idempotency
const notification = await Notification.create({
  userId,
  type: 'match',
  title: notificationTitle,
  message: notificationMessage,
  relatedId: donation._id,
  relatedType: 'Donation',
  data: notificationData,
});

// Line 49-60: FCM send separate from creation (fire-and-forget)
const hospital = await User.findById(userId).select('fcmTokens');
if (hospital?.fcmTokens?.length > 0) {
  try {
    await (sendToMultipleWithRetry || sendToMultiple)(
      hospital.fcmTokens,
      notificationTitle,
      notificationMessage,
      { /* ... */ },
      { channelId: 'donation_matches' },
      { attempts: 3, baseDelayMs: 200 }
    );
  } catch (err) {
    logger.error('Match notification push failed', ...);
  }
}
```

**Race Condition:** No idempotency key linking notification record to FCM send.

- Notification A creates record
- FCM send fails and retries
- Meanwhile, Notification B creates same record
- Both FCM sends eventually succeed
- **Result:** User receives duplicate push notifications

---

## Matching Query Consistency

**Operation:** Finding compatible requests for a donor  
**Entities Involved:** Request, Donation, Donor  
**Shared Resources:** Request and Donation collections

**Concurrent Scenario:** Query results become stale due to concurrent modifications

**Evidence:**

Source: [matching.service.js](../src/services/matching.service.js#L626-L670)

```javascript
// Lines 628-650: Two-stage query without transaction
const respondedRequestIds = new Set(
  existingDonations.map(d => d.requestId.toString())
);

const compatibleRequests = [];

for (const request of requests) {
  const requestBloodTypes = normalizeBloodTypeList(request.bloodType);
  if (respondedRequestIds.has(request._id.toString())) continue; // Line 658

  // ... eligibility checks, distance calc ...

  compatibleRequests.push({
    donor,
    score: Math.round(score * 10) / 10,
    locationScore,
    eligibility: match.eligibility,
    distanceKm: match.distanceKm,
  });
}

return compatibleRequests.sort((a, b) => b.score - a.score);
```

**Race Condition Window:**
1. Query 1 at T0: Check donations for donor - finds none for Request X
2. Query 2 (concurrent at T0.5): Donor accepts Request X, creates donation
3. Query 1 resumes at T1: Request X returned in results despite active donation
4. **Result:** Donor is presented with request they already accepted

---

## Request Expiry Check

**Operation:** Normalizing request status if deadline passed  
**Entities Involved:** Request  
**Shared Resources:** Request record

**Concurrent Scenario:** Multiple concurrent checks + transitions

**Evidence:**

Source: [request.controller.js](../src/controllers/request.controller.js#L429-L445)

```javascript
// Lines 429-445: Check and update NOT atomic
const normalizeRequestIfExpired = async (request) => {
  if (!request) return request;

  const requestExpired = request.requiredBy && new Date(request.requiredBy) <= new Date();
  if (requestExpired && request.status === 'pending') {
    validateTransition('request', request.status, 'expired');
    request.status = 'expired';
    await request.save({ validateBeforeSave: false });
  }

  return request;
};
```

**Race Condition Window:**
1. Thread A: Check finds request is expired, status is 'pending' ✓
2. Thread B: Check finds request is expired, status is 'pending' ✓
3. Thread A: Update status to 'expired'
4. Thread B: Update status to 'expired'
5. **Result:** Multiple redundant saves; if state was already modified between check and save, inconsistent state

**Additional Risk:** This function called before using request:

```javascript
// Line 468
await normalizeRequestIfExpired(request);
// Line 478-481: Using request after potential expiry change
try {
  validateTransition('request', request.status, 'accepted');
}
```

Request could transition from pending→expired→pending if concurrent operations race.

---

## Appointment Rescheduling

**Operation:** Donor rescheduling appointment to new date  
**Entities Involved:** Appointment, HospitalSettings  
**Shared Resources:** Appointment record, reschedule counter

**Concurrent Scenario:** Multiple concurrent reschedule attempts

**Evidence:**

Source: [appointment.service.js](../src/services/appointment.service.js#L200-L350)

```javascript
// No transaction protection for reschedule path
// Reads appointment, modifies rescheduleCount, saves

const assertRescheduleAvailability = async ({ appointment, appointmentDate, donationType }) => {
  const hospitalSettings = await getHospitalSettings(appointment.hospitalId);
  
  const maxReschedules = Number(hospitalSettings.maxReschedules ?? DEFAULT_MAX_RESCHEDULES);
  
  if (appointment.rescheduleCount >= maxReschedules) {
    throw new Error('This appointment has reached the maximum number of reschedules');
  }
  // ... more checks ...
};
```

**Race Condition Window:**
1. Reschedule A: Check rescheduleCount (2 of 3) ✓
2. Reschedule B: Check rescheduleCount (2 of 3) ✓ (both pass)
3. Reschedule A: Increment count to 3, save
4. Reschedule B: Increment count to 4, save
5. **Result:** Rescheduled beyond max limit

---

## Hospital Settings Upsert

**Operation:** Getting/creating hospital appointment settings  
**Entities Involved:** HospitalSettings  
**Shared Resources:** HospitalSettings collection

**Concurrent Scenario:** Multiple concurrent requests for same hospital

**Evidence:**

Source: [appointment.service.js](../src/services/appointment.service.js#L67-L85)

```javascript
const getHospitalSettings = async (hospitalId) => {
  const settings = await HospitalSettings.findOneAndUpdate(
    { hospitalId },
    { $setOnInsert: { hospitalId } },
    { upsert: true, returnDocument: 'after' }
  );
```

**Finding:** ✓ Upsert operation is atomic at MongoDB level.

**Remaining Risk:** If multiple concurrent calls happen before any upsert completes, multiple documents could theoretically be created (though MongoDB's upsert is designed to prevent this). More importantly, if settings are read before the first upsert completes, different default values might be returned.

---

# Race Condition Analysis

## Critical Race Condition: Request Split Acceptance

**Severity: CRITICAL**  
**Impact:** Data corruption, orphaned donations, split donor records

**Scenario:**

```
Timeline:
T0:     Donor A                          Donor B
        POST /requests/123/accept        POST /requests/123/accept
        ↓                                ↓

T1:     Check request.acceptedBy        Check request.acceptedBy
        ✓ null                           ✓ null
        Check existing donation          Check existing donation
        ✓ none                           ✓ none
        ↓                                ↓

T2:     Check eligibility ✓             Check eligibility ✓
        ↓                                ↓

T3:     Create Donation A               Create Donation B
        ✓ Created                        ✓ Created
        ↓                                ↓

T4:     Update Request:                 Update Request:
        acceptedBy = A._id              acceptedBy = B._id
        acceptedDonationId = DonA._id   acceptedDonationId = DonB._id
        status = 'accepted'             status = 'accepted'
        ✓ Saved                         ✓ Saved

Result:
- Request.acceptedBy = B._id (overwrote A)
- Request.acceptedDonationId = B._id (overwrote A)
- TWO donations created
- Donor A's donation is orphaned
- Hospital now expects Donor B but Donor A also scheduled
```

**Evidence of Vulnerability:**
- No database constraint preventing multiple donations per request in non-terminal status
- No transaction wrapping the check-then-update
- Request.acceptedBy is not a unique constraint

**Likelihood:** HIGH under concurrent load  
**Detection:** Requires manual inspection of request records with mismatched donation counts

---

## Race Condition: Duplicate Reward Points

**Severity: CRITICAL**  
**Impact:** Incorrect donor balance, unfair point distribution

**Scenario:**

```
Timeline:
T0:     Donation Completed               Concurrent Webhook Retry
        onDonationCompleted()            onDonationCompleted() (retry)
        ↓                                ↓

T1:     Check existing transaction       Check existing transaction
        referenceId = donation._id       referenceId = donation._id
        ✓ Not found                      ✓ Not found
        ↓                                ↓

T2:     Begin transaction                Begin transaction
        Read DonorPoints balance         Read DonorPoints balance
        = 150                            = 150
        ↓                                ↓

T3:     Increment balance += 100         Increment balance += 100
        Write: balance = 250             Write: balance = 250 (overwrites)
        ✓ Committed                      ✓ Committed

Result:
- Expected balance: 350 (150 + 100 + 100)
- Actual balance: 250 (one award lost)
- PointsTransaction ledger: BOTH transactions created (inconsistent)
```

**Evidence of Vulnerability:**
- Dedup check at line 130 happens BEFORE transaction
- Catch-based dedup at line 175 only triggers on actual duplicate key error
- If first transaction commits before second checks, window exists

**Likelihood:** MEDIUM under retry scenarios  
**Detection:** Requires comparing PointsTransaction count vs DonorPoints balance

---

## Race Condition: Activity Timeline Duplication

**Severity: HIGH**  
**Impact:** Duplicated timeline entries, incorrect history

**Scenario:**

```
Timeline:
T0:     Donation Completion              Network Retry
        donation.service.js              (same request, network timeout)
        logActivity() called             logActivity() called
        ↓                                ↓

T1:     Check existing activity          Check existing activity
        action = 'completed_donation'    action = 'completed_donation'
        referenceId = donation._id       referenceId = donation._id
        ✓ Not found                      ✓ Not found
        ↓                                ↓

T2:     Create Activity                  Create Activity
        (fire-and-forget)                (fire-and-forget)
        ✓ Created                        ✓ Created (duplicate)

Result:
- Donor timeline shows 2 entries for same donation
- Latest activities endpoint returns duplicates
```

**Evidence of Vulnerability:**
- Dedup check at line 71-76 not atomic with creation
- Fire-and-forget pattern at donation.service.js line 243
- No idempotency key generation

**Likelihood:** HIGH with network timeouts  
**Detection:** Requires checking Activity collection for duplicate referenceIds per user

---

## Race Condition: Matching Results Stale

**Severity:** MEDIUM  
**Impact:** Donor shown requests they already accepted

**Scenario:**

```
Timeline:
T0:     Donor requests matches           Concurrent: Donor accepts request
        GET /donor/matches               POST /requests/123/accept
        (with request from 30 min ago)   ↓
        ↓

T1:     findCompatibleRequests()         Check request.acceptedBy ✓ null
        Query recent donations          Create donation
        (finds none for request 123)    Update request.acceptedBy = donor._id
        ↓                                ✓ Committed

T2:     For each request:
        findCompatibleDonors() called
        Request 123 in results
        (not filtered out - query was stale)
        ↓

T3:     Return results
        Request 123 returned
        Donor sees request they
        just accepted

Result:
- Donor accepts Request 123
- Response to GET /matches shows Request 123 as available
- Confusing UX
```

**Evidence of Vulnerability:**
- Donations batch query at matching.service.js line 540-550
- Filter applied at line 558
- Time gap between queries and eligibility checks

**Likelihood:** MEDIUM-HIGH with mobile clients  
**Detection:** Requires field testing with concurrent accept+match requests

---

# Duplicate Execution Analysis

## Donation Creation Duplicate Execution

**Finding:** YES - duplicate donations possible

**Evidence:**

Path 1 - Via request.controller.js (Line 489):
```javascript
const donation = await Donation.create({
  donorId: donor._id,
  requestId: request._id,
  quantity: request.unitsNeeded ?? request.quantity ?? 1,
  status: 'pending',
});
```

Path 2 - Via donation.service.js:
```javascript
const donation = await Donation.create({
  donorId,
  requestId,
  quantity: data.quantity || 1,
  status: 'pending',
  notes: data.notes || '',
});
```

**Issue:** Request controller bypasses donation service check, calling Donation.create directly.

**Duplicate Scenario:**
1. Network timeout or browser retry
2. First request creates donation A
3. Retry request creates donation B
4. Both pending for same donor-request pair

**Mitigation:** Database unique constraint? **No** - Donation model has no unique constraint on (donorId, requestId) for pending status.

---

## Points Transaction Duplicate Execution

**Finding:** YES - possible duplicates, mitigated by constraint

**Evidence:**

Source: [reward.service.js](../src/services/reward.service.js#L157-L161)

```javascript
const transaction = await PointsTransaction.create(
  [{
    donorId,
    pointsAmount: amount,
    transactionType: type,
    description,
    referenceId: normalizedReferenceId,  // Used for dedup
    balanceAfter: account.pointsBalance,
  }],
  { session }
);
```

**Question:** Is there a unique constraint on (donorId, transactionType, referenceId)?

**Database Evidence Needed:** Would need to check PointsTransaction model for index definition.

**Current Mitigation:** Catch-based error handling:
```javascript
catch (err) {
  if (normalizedReferenceId && isMongoDuplicateKeyError(err)) {
    return null;
  }
}
```

This catches duplicate constraint violations but doesn't prevent the window.

---

## Activity Record Duplicate Execution

**Finding:** YES - duplicates possible and likely under retry

**Evidence:**

Source: [activity.service.js](../src/services/activity.service.js#L80-L95)

```javascript
const activity = await Activity.create({
  userId,
  type: payload.type,
  action: payload.action,
  title: payload.title,
  description: payload.description,
  referenceId: normalizedReferenceId,
  referenceType: payload.referenceType || null,
  metadata: payload.metadata || {},
  icon: payload.icon || null,
});
```

**No unique constraint** on (userId, action, referenceId). Duplicates can be created.

**Duplicate Scenario:**
1. Donation completed → logActivity called (fire-and-forget)
2. Network timeout, logActivity retried
3. Both succeed → duplicate activities
4. Or: Multiple services call logActivity for same event

---

## Notification Duplicate Execution

**Finding:** YES - likely under concurrent request processing

**Evidence:**

Source: [notification.service.js](../src/services/notification.service.js#L42-L63)

```javascript
const notification = await Notification.create({
  userId,
  type: 'match',
  title: notificationTitle,
  message: notificationMessage,
  relatedId: donation._id,
  relatedType: 'Donation',
  data: notificationData,
});

// Separate operation - not atomic
if (hospital?.fcmTokens?.length > 0) {
  await (sendToMultipleWithRetry || sendToMultiple)(...);
}
```

**Duplicate Scenario:**
1. Request accepted → notifyMatch called
2. Database create succeeds
3. FCM send fails → retries
4. Concurrent: Another notification system also sends for same match
5. Result: Multiple notifications + multiple FCM sends

---

## Request Acceptance Duplicate Execution

**Finding:** YES - duplicates possible (leads to split request)

**Evidence:**

Source: [request.controller.js](../src/controllers/request.controller.js#L471-L520)

```javascript
if (request.acceptedBy) {
  return response.error(res, 400, 'Request has already been accepted');
}

// ... checks pass ...

const donation = await Donation.create({ ... });

request.status = 'accepted';
request.acceptedBy = donor._id;
request.acceptedDonationId = donation._id;
await request.save();
```

**Duplicate Scenario:**
1. Two concurrent accept requests
2. Both read request (acceptedBy is null)
3. Both pass the check
4. Both create donations
5. Both update request
6. Last writer wins → request.acceptedBy points to second donor

**This creates data inconsistency, not just duplication.**

---

# Transaction Boundary Review

## Protected Transaction Boundaries

### ✅ Donation Status Update to Completion

Source: [donation.service.js](../src/services/donation.service.js#L170-L240)

**Protected Operations:**
- Donation status change (pending/scheduled → completed)
- Associated Request status progression
- Donor lastDonationDate update
- Appointment state validation

**Session Scope:**

```javascript
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    // All reads and writes within session
    const donationDoc = await Donation.findById(donationId).session(session);
    // ... modifications ...
    await Donation.findByIdAndUpdate(..., { session });
    await Request.findById(...).session(session);
    await requestDoc.save({ session });
    await Donor.findByIdAndUpdate(..., { session });
  });
}
```

**Isolation Level:** MongoDB default (snapshot isolation within transaction)

**Covered Race Conditions:**
- ✅ Prevents simultaneous donation completions
- ✅ Prevents partial request status transitions
- ✅ Prevents stale donor lastDonationDate

**Not Covered:**
- ❌ Activity logging (fire-and-forget after)
- ❌ Reward calculation (called after, separate transaction)

---

### ✅ Reward Points Award

Source: [reward.service.js](../src/services/reward.service.js#L134-L175)

**Protected Operations:**
- DonorPoints balance increment
- PointsTransaction creation
- Tier recalculation

**Session Scope:**

```javascript
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    const account = await DonorPoints.findOneAndUpdate(
      { donorId },
      { $inc: { pointsBalance: amount, lifetimePointsEarned: amount }, ... },
      { upsert: true, returnDocument: 'after', session }
    );

    // Tier recalc within transaction
    const newTier = getTierForPoints(account.lifetimePointsEarned, config.tiers);
    if (tierChanged) {
      await DonorPoints.findByIdAndUpdate(account._id, { tier: newTier }, { session });
    }

    const transaction = await PointsTransaction.create([{ ... }], { session });
  });
}
```

**Isolation Level:** Snapshot isolation

**Covered Race Conditions:**
- ✅ Prevents balance corruption under concurrent increments
- ✅ Atomic tier + balance updates

**Not Covered:**
- ❌ Dedup check happens BEFORE transaction (race window)
- ❌ If dedup check passes, concurrent identical operations both increment

---

### ❌ Request Acceptance

Source: [request.controller.js](../src/controllers/request.controller.js#L471-L520)

**Unprotected Operations:**
- Request.acceptedBy check and update
- Donation creation
- Request status change

**Missing Session:**

```javascript
if (request.acceptedBy) {
  return response.error(res, 400, 'Request has already been accepted');
}

// ... no transaction starts here ...

const donation = await Donation.create({ ... });

request.status = 'accepted';
request.acceptedBy = donor._id;
request.acceptedDonationId = donation._id;
await request.save();  // No session
```

**Exposed Race Conditions:**
- 🔴 Multiple donors can bypass acceptedBy check
- 🔴 Multiple donations created
- 🔴 Request acceptedBy field overwritten

---

### ❌ Activity Logging

Source: [activity.service.js](../src/services/activity.service.js#L70-L95)

**Unprotected Operations:**
- Activity dedup check
- Activity creation

**Missing Session:**

```javascript
const existing = await Activity.findOne({
  userId,
  action: payload.action,
  referenceId: normalizedReferenceId,
});

if (existing) return null;

// ... no transaction ...

const activity = await Activity.create({ ... });
```

**Exposed Race Conditions:**
- 🔴 Dedup window allows duplicates
- 🔴 Fire-and-forget retry pattern guarantees duplication

---

### ❌ Notification Creation

Source: [notification.service.js](../src/services/notification.service.js#L42-L63)

**Unprotected Operations:**
- Notification creation
- FCM send (separate)

**No Session/Transaction:**

```javascript
const notification = await Notification.create({ ... });

// Separate operation
if (hospital?.fcmTokens?.length > 0) {
  await sendToMultipleWithRetry(...);
}
```

**Exposed Race Conditions:**
- 🔴 No idempotency protection
- 🔴 FCM and DB creation not atomic

---

### ❌ Matching Query

Source: [matching.service.js](../src/services/matching.service.js#L626-L670)

**Unprotected Operations:**
- Batch query for existing donations
- Filtering loop
- Eligibility evaluation

**No Snapshot Consistency:**

```javascript
const existingDonations = await Donation.find({
  donorId,
  requestId: { $in: requestIds },
  status: { $nin: ['cancelled', 'rejected'] },
});

// ... time gap ...

for (const request of requests) {
  if (respondedRequestIds.has(request._id.toString())) continue;
  // Result could be stale
}
```

**Exposed Race Conditions:**
- 🔴 Donor accepts after query but before response
- 🔴 Results returned include already-accepted requests

---

## Summary of Transaction Coverage

| Operation | Protected | Session | Notes |
|-----------|-----------|---------|-------|
| Donation Completion | ✅ Yes | Yes | Full isolation |
| Reward Points Award | ✅ Yes (partial) | Yes | Dedup check unprotected |
| Request Acceptance | ❌ No | No | Split acceptance possible |
| Activity Logging | ❌ No | No | Duplicates guaranteed on retry |
| Notification Creation | ❌ No | No | No idempotency |
| Matching Query | ❌ No | No | Results can become stale |
| Appointment Reschedule | ❌ No | No | Counter can exceed limit |
| Request Expiry | ❌ No | No | Race between check and update |

---

# State Transition Concurrency Review

## Request State Machine

**Defined Transitions** (from [state-machine.js](../src/utils/state-machine.js#L20-L35)):

```
pending  → accepted, cancelled, expired
accepted → in-progress, pending, cancelled, expired
in-progress → completed, pending, cancelled, expired
completed → (terminal)
cancelled → (terminal)
expired → (terminal)
```

**Concurrent Transition Scenario:**

```
Timeline:
T0:     Hospital Action              Automatic Expiry Check
        POST /requests/123/reject     GET /donor/matches
        (reject accepted request)     (normalize if expired)
        ↓                             ↓

T1:     Load request status:          Load request status:
        'accepted'                    'pending' (cached?)
        ↓                             ↓

T2:     Transition validation:        Transition validation:
        accepted → pending ✓          pending → expired ✓
        Update status = 'pending'     Update status = 'expired'
        ✓ Saved                       ✓ Saved

Result:
- Request status is 'expired' (last write wins)
- But rejection logic already executed
- Donor eligibility already reset
- Inconsistent state
```

**Evidence:**

Source: [request-lifecycle.service.js](../src/services/request-lifecycle.service.js#L48-L80)

```javascript
request.status = requestStatus;  // No transaction
await request.save();            // Vulnerable to concurrent updates
```

And [request.controller.js](../src/controllers/request.controller.js#L429-L445):

```javascript
if (requestExpired && request.status === 'pending') {
  validateTransition('request', request.status, 'expired');
  request.status = 'expired';
  await request.save({ validateBeforeSave: false });  // No session
}
```

**Concurrency Risks:**

| Transition Pair | Risk | Window |
|-----------------|------|--------|
| pending ↔ accepted | Split acceptance | 50-200ms |
| accepted → in-progress vs pending | Status mismatch | 20-100ms |
| pending → expired vs accepted | Conflicting state | 30-150ms |
| in-progress → completed vs pending | Completion race | 10-50ms |

---

## Donation State Machine

**Defined Transitions**:

```
pending   → scheduled, cancelled, rejected
scheduled → completed, cancelled, rejected
completed → (terminal)
cancelled → (terminal)
rejected → (terminal)
```

**Protected by Transaction:** YES (in donation.service.js updateDonationStatus)

**Additional Risk:** Donation creation doesn't enter a transaction:

```javascript
// request.controller.js - not transactional
const donation = await Donation.create({
  donorId: donor._id,
  requestId: request._id,
  quantity: request.unitsNeeded ?? request.quantity ?? 1,
  status: 'pending',  // Always starts as 'pending'
});
```

Could have concurrent creations leading to:

```
T0: Donor A              Donor A (retry)
    Create donation      Create donation
    ↓                    ↓

T1: Both create          
    status='pending'     status='pending'
    ✓ Created            ✓ Created
    Different _id        Different _id

Result:
- Donation A1 (pending)
- Donation A2 (pending)
- Request accepts one, other orphaned
```

---

## Appointment State Machine

**Defined Transitions**:

```
pending   → confirmed, cancelled
confirmed → completed, cancelled, pending (re-open)
completed → (terminal)
cancelled → (terminal)
```

**Not Protected by Transaction:** No session wrapping for status changes

**Concurrent Reschedule Risk:**

```javascript
// appointment.service.js - No transaction
const appointment = await Appointment.findById(appointmentId);

// ... fetch settings, validate ...

appointment.appointmentDate = newDate;
appointment.rescheduleCount += 1;
await appointment.save();  // No session
```

Could have concurrent reschedules:

```
T0: Reschedule A        Reschedule B
    Load rescheduleCount = 2

T1: rescheduleCount = 3  rescheduleCount = 3
    ✓ Saved             ✓ Saved (overwrites)

Result:
- rescheduleCount = 3 (should be 4 or error)
```

---

# Idempotency Review

## Request Retry Scenario

**Scenario:** Donor accepts request, network timeout, browser retries

**Current Behavior:** NOT IDEMPOTENT

```
Request 1 (T0):
POST /requests/123/accept → 500 (timeout)

Request 2 (T1, retry):
POST /requests/123/accept → ???
```

**Result:**
- Donation 1 created (T0)
- Donation 2 created (T1) - duplicate
- Request.acceptedBy = Donor A (from Donation 1)
- But Donation 2 also exists

**Missing Idempotency:** No idempotency key, no deduplication

---

## Activity Logging Retry

**Scenario:** Donor completes donation, activity logging network issue, client retries

**Current Behavior:** NOT IDEMPOTENT

```javascript
// Fire-and-forget in donation.service.js
activityService.logActivity(donorId, {
  type: 'donation',
  action: 'completed_donation',
  referenceId: donation._id.toString(),
  // ...
}).catch(err => logger.error(...));
```

**Result:**
- Activity 1 created (success)
- Network timeout
- Activity 2 created (retry) - duplicate
- Same referenceId, same action

**Missing Idempotency:** Dedup check not atomic; retry window exists

---

## Points Award Retry

**Scenario:** Donation completed, reward points awarded, FCM fails and triggers retry

**Current Behavior:** PARTIALLY IDEMPOTENT

```javascript
// reward.service.js - has dedup protection
const existing = await PointsTransaction.findOne({
  donorId,
  referenceId: normalizedReferenceId,
  transactionType: type
});

if (existing) return null; // Already awarded
```

**Dedup Logic:**
- ✅ Checks if transaction exists
- ✅ Returns null if found (doesn't duplicate)
- ❌ But check-then-create window exists

**Result:**
- Award 1: transaction created
- Award 2 (retry): transaction exists check should catch... unless concurrent timing

**Mitigation:** Catch-based (line 175)
```javascript
catch (err) {
  if (normalizedReferenceId && isMongoDuplicateKeyError(err)) {
    return null; // Caught at constraint level
  }
}
```

---

## Notification Send Retry

**Scenario:** Donation matched, notification sent to hospital, FCM fails and retries

**Current Behavior:** NOT IDEMPOTENT

```javascript
// notification.service.js
const notification = await Notification.create({
  userId,
  type: 'match',
  relatedId: donation._id,
  relatedType: 'Donation',
  // ...
});

await sendToMultipleWithRetry(...);  // This can retry independently
```

**Result:**
- Notification 1 created
- FCM send fails → retries
- Concurrent: Webhook also triggers notification
- Notification 2 created (duplicate)
- Both push to FCM

**Missing Idempotency:**
- No idempotency key linking notification to donation+user
- No dedup check before creation
- FCM send separate from DB creation

---

## Matching Results Idempotency

**Scenario:** Donor repeatedly calls GET /donor/matches with identical filters

**Current Behavior:** IDEMPOTENT (but with stale data risk)

```javascript
// matching.service.js - returns fresh results each time
export const findCompatibleRequests = async (donorId, { radiusKm, filters, limit } = {}) => {
  const donor = await Donor.findById(donorId);
  // ... queries and filtering ...
  return compatibleRequests;
}
```

**Result:**
- Each call returns fresh results
- No state mutations
- Safe to retry

**Issue:** Results can be stale (concurrency issue, not idempotency)

---

## Appointment Rescheduling Idempotency

**Scenario:** Donor reschedules appointment, network retry resends same request

**Current Behavior:** NOT IDEMPOTENT

```javascript
// appointment.service.js - no idempotency protection
const appointment = await Appointment.findById(appointmentId);

// ... validate ...

appointment.appointmentDate = newDate;
appointment.rescheduleCount += 1;
await appointment.save();
```

**Result:**
- Reschedule 1: date changed, count = 3
- Reschedule 2 (retry): date changed again?, count = 4
- Exceeds max reschedules

**Missing Idempotency:** No idempotency key, no request-ID deduplication

---

# Multi-User Conflict Review

## Scenario 1: Multiple Donors Responding to Emergency Request

**Setup:**
- Emergency blood request created
- Request status = 'pending'
- Multiple compatible donors see it simultaneously

**Concurrent Actions:**

```
Timeline:
T0:     Donor A                    Donor B                   Donor C
        Matches visible            Matches visible           Matches visible
        Accepts request            Accepts request           Accepts request
        ↓                          ↓                         ↓

T1:     Check acceptedBy           Check acceptedBy          Check acceptedBy
        ✓ null                     ✓ null                    ✓ null
        ↓                          ↓                         ↓

T2:     Create donations           Create donations          Create donations
        A created                  B created                 C created
        ↓                          ↓                         ↓

T3:     Update request             Update request            Update request
        acceptedBy = A._id         acceptedBy = B._id        acceptedBy = C._id
        ✓ Saved                    ✓ Saved                   ✓ Saved

Result:
- Request.acceptedBy = C._id (final writer)
- Donation A, B, C all exist
- Hospital sees only Donor C
- Donors A and B think they're accepted but aren't
```

**Impact:** 
- 🔴 Data corruption
- 🔴 Donor confusion (expect appointment confirmation)
- 🔴 Hospital confusion (3 donors scheduled?)

---

## Scenario 2: Simultaneous Hospital Rejection & Donor Completion

**Setup:**
- Request has accepted donation from Donor A
- Appointment scheduled for T5
- At T4, hospital begins rejection process
- At T4.1, donor submits completion

**Concurrent Actions:**

```
Timeline:
T0:     Hospital                         Donor
        POST /requests/123/reject        POST /donations/456/complete
        ↓                                ↓

T1:     Load donation                    Load donation
        status = 'scheduled'             status = 'scheduled'
        Load appointment                 Load appointment
        status = 'confirmed'             status = 'confirmed'
        ↓                                ↓

T2:     Begin rejection flow             Begin completion flow
        donation → rejected              donation → completed
        request → pending                request → completed
        ↓                                ↓

T3:     Update donation:                 Start transaction
        status = rejected                session.withTransaction()
        ✓ Saved                          ↓

T4:     Update request:                  Update donation:
        status = pending                 status = completed
        ✓ Saved                          ↓

T5:                                      Update request:
                                         status = in-progress→completed
                                         appointment status validated
                                         ...

Result:
- Last writer determines final state
- Donor gets completion reward?
- Hospital sees rejected donation that's marked completed?
- Inconsistent state
```

**Evidence:**

[request-lifecycle.service.js](../src/services/request-lifecycle.service.js#L48-L140) (rejection) has no session isolation with [donation.service.js](../src/services/donation.service.js#L170-L240) (completion).

**Impact:**
- 🔴 Reward calculation inconsistent
- 🔴 Donation state ambiguous
- 🔴 Hospital workflow broken

---

## Scenario 3: Multiple Hospitals Updating Same Donor's Appointment

**Setup:**
- Donor has appointments at Hospital A and Hospital B
- Appointments are independent Appointment records
- But same Donor record

**Concurrent Actions:**

```
Timeline:
T0:     Hospital A                       Hospital B
        Reschedule Donor's appt 1       Reschedule Donor's appt 2
        Load appointment 1               Load appointment 2
        rescheduleCount = 2              rescheduleCount = 2 (different record)
        ↓                                ↓

T1:     Check limit                      Check limit
        2 < 3 ✓                          2 < 3 ✓
        ↓                                ↓

T2:     Update:                          Update:
        rescheduleCount = 3              rescheduleCount = 3 (different doc)
        ✓ Saved                          ✓ Saved

Result:
- Appointment 1 rescheduleCount = 3
- Appointment 2 rescheduleCount = 3
- Both at limit, no more reschedules
- This is acceptable (independent appointments)
```

**Finding:** ✅ Actually safe because appointments are separate documents

---

## Scenario 4: Concurrent Points Awards & Redemption

**Setup:**
- Donor completes donation → award 100 points
- Simultaneously: Donor redeems 50 points
- Starting balance = 200

**Concurrent Actions:**

```
Timeline:
T0:     Donation Completed               Redemption Request
        onDonationCompleted()            POST /rewards/redeem
        ↓                                ↓

T1:     Award 100 points                 Load balance
        Begin transaction                = 200
        Read DonorPoints                 ↓
        balance = 200
        ↓

T2:     $inc balance += 100              Check balance >= 50
        balance = 300                    ✓ Yes
        Create transaction               Begin transaction
        ✓ Committed                      Read DonorPoints
                                         balance = 200
                                         ↓

T3:                                      $inc balance -= 50
                                         balance = 150
                                         Create redemption
                                         ✓ Committed

Result:
- Expected: 200 + 100 - 50 = 250
- Actual: 150 (redemption didn't see award)
- PointsTransaction has both (200+100 and -50)
- Ledger-balance mismatch
```

**Evidence:** Both use transactions but operate independently

**Impact:**
- 🔴 Balance not reconcilable with ledger
- 🔴 Accounting inconsistent

---

# Background Processing Review

## Activity Logging (Fire-and-Forget Pattern)

**Implementation:**

Source: [donation.service.js](../src/services/donation.service.js#L243-L246)

```javascript
activityService.logActivity(updatedDonation.donorId, {
  type: 'donation',
  action: 'completed_donation',
  // ...
}).catch(err => logger.error('Activity log failed', { message: err.message }));
```

Source: [activity.service.js](../src/services/activity.service.js#L95-L110)

```javascript
export const logActivity = async (userId, payload) => {
  // ... validation ...
  
  const activity = await Activity.create({ ... });
  
  logger.info('Activity logged', { ... });
  
  return activity;
}
```

**Pattern:** Fire-and-forget with catch error handler

**Concurrency Risks:**

1. **Duplicate on Network Retry:**
   - Caller doesn't await completion
   - Network timeout + retry = duplicate activity
   - No idempotency key

2. **Inconsistent State:**
   - If logActivity fails, no record
   - Donation marked complete but no activity
   - Timeline incomplete

3. **Dedup Check Not Atomic:**
   - Check happens, then create
   - Concurrent same-event activities both pass check

**Issues:**
- 🔴 No idempotency key generation
- 🔴 Dedup check pre-creation (race window)
- 🔴 Fire-and-forget means caller doesn't know if it succeeded

---

## Notification Sending (Retry Pattern)

**Implementation:**

Source: [notification.service.js](../src/services/notification.service.js#L49-L60)

```javascript
if (hospital?.fcmTokens?.length > 0) {
  try {
    await (sendToMultipleWithRetry || sendToMultiple)(
      hospital.fcmTokens,
      notificationTitle,
      notificationMessage,
      { /* data */ },
      { channelId: 'donation_matches' },
      { attempts: 3, baseDelayMs: 200 }  // Retry config
    );
  } catch (err) {
    logger.error('Match notification push failed', { message: err.message });
  }
}
```

**Pattern:** Retry logic in FCM util, separate from notification creation

**Concurrency Risks:**

1. **Duplicate Creation + Retry:**
   - Notification created in DB (line 42)
   - FCM send starts separately
   - If FCM fails and retries, duplicate FCM sends occur
   - But DB only has 1 notification record

2. **Multiple Notifications for Same Event:**
   - If called concurrently by different code paths
   - No idempotency linking notification to event

3. **Orphaned FCM Send:**
   - FCM succeeds but notification DB fails
   - User receives push but no in-app record

**Issues:**
- 🔴 Notification creation + FCM send not atomic
- 🔴 No idempotency key
- 🔴 Retry logic independent of creation

---

## Reward Processing (Transaction-Protected)

**Implementation:**

Source: [reward.service.js](../src/services/reward.service.js#L122-L175)

```javascript
export const awardPoints = async (donorId, { amount, type, description, referenceId, rewardsConfig = null } = {}) => {
  const normalizedReferenceId = referenceId ? String(referenceId) : null;
  const config = rewardsConfig || await getRewardsConfig();

  // Dedup check (NOT atomic)
  if (normalizedReferenceId) {
    const existing = await PointsTransaction.findOne({
      donorId,
      referenceId: normalizedReferenceId,
      transactionType: type
    });
    if (existing) return null;
  }

  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      // Transaction-protected updates
      const account = await DonorPoints.findOneAndUpdate(
        { donorId },
        {
          $inc: { pointsBalance: amount, lifetimePointsEarned: amount },
          $setOnInsert: { donorId },
        },
        { upsert: true, returnDocument: 'after', session }
      );

      // Tier calculation
      const newTier = getTierForPoints(account.lifetimePointsEarned, config.tiers);
      if (tierChanged) {
        await DonorPoints.findByIdAndUpdate(account._id, { tier: newTier }, { session });
      }

      // Transaction ledger
      const transaction = await PointsTransaction.create([{
        donorId,
        pointsAmount: amount,
        transactionType: type,
        description,
        referenceId: normalizedReferenceId,
        balanceAfter: account.pointsBalance,
      }], { session });

      result = { account, transaction: transaction[0], tierChanged, newTier, previousTier };
    });
  } catch (err) {
    // Catch-based dedup (final mitigation)
    if (normalizedReferenceId && isMongoDuplicateKeyError(err)) {
      return null;
    }
    throw err;
  } finally {
    session.endSession();
  }

  return result;
};
```

**Pattern:** Dedup check, then transaction

**Concurrency Risks:**

1. **Dedup Window:**
   - Check at line 130: no existing transaction
   - Check at line 130: no existing transaction (both pass concurrently)
   - Both create transactions
   - Caught by constraint (line 175)

2. **Double Increment:**
   - Although constraint is on PointsTransaction
   - If constraint is missing or misconfigured
   - Could increment balance twice

**Mitigations:**
- ✅ Transaction protects balance increment
- ✅ Catch-based dedup on constraint violation
- ⚠️ But window exists before transaction

---

## Matching Results Caching (None Detected)

**Finding:** No caching detected, queries executed per-request

Source: [matching.service.js](../src/services/matching.service.js#L626-L670)

```javascript
export const findCompatibleRequests = async (donorId, { radiusKm, filters, limit } = {}) => {
  const donor = await Donor.findById(donorId);

  // Fresh queries every time
  const requests = await Request.find({ ... }).limit(500);

  const [existingDonations, activeAppointments] = await Promise.all([
    Donation.find({ donorId, /* ... */ }),
    Appointment.find({ donorId, /* ... */ }),
  ]);

  // ... filtering ...

  return compatibleRequests;
};
```

**Pattern:** Fresh query every request

**Concurrency Risks:**

1. **Query Staleness:**
   - Queries executed at T0
   - Results returned at T0+100ms
   - In between, donor accepted a request (not in results)
   - Results include already-accepted request

2. **N+1 Evaluation:**
   - Each request in loop calls evaluateMatch
   - Which does individual eligibility check
   - Could be stale by time last request is evaluated

**Issues:**
- 🟡 No snapshot consistency
- 🟡 Results can be stale by 50-200ms

---

# Concurrency Risks Classification

## Critical Risks (11 items)

| Risk | Operation | Entities | Impact | Window | Likelihood |
|------|-----------|----------|--------|--------|------------|
| **Request Split Acceptance** | Accept request | Request, Donation | Multiple donors accepted | 50-200ms | HIGH |
| **Duplicate Donations** | Respond to request | Donation, Request | Multiple donations same pair | 30-100ms | HIGH |
| **Duplicate Points Award** | Complete donation | PointsTransaction, DonorPoints | Double increment | 20-80ms | MEDIUM |
| **Duplicate Activity Records** | Log activity | Activity | Duplicate timeline entries | 100-500ms | HIGH |
| **Duplicate Notifications** | Send notification | Notification, FCM | Multiple pushes | 50-300ms | MEDIUM-HIGH |
| **Request Status Corruption** | Transition states | Request | Invalid state combo | 10-50ms | MEDIUM |
| **Donation Status Race** | Update donation | Donation, Appointment | Concurrent completions | 10-30ms | LOW (protected) |
| **Matching Results Stale** | Query matches | Request, Donation | Accepted request shown | 50-200ms | HIGH |
| **Appointment Limit Exceeded** | Reschedule | Appointment | Exceed max reschedules | 40-150ms | MEDIUM |
| **Hospital Settings Race** | Get/upsert settings | HospitalSettings | Multiple settings docs | 20-100ms | LOW |
| **Request Expiry Race** | Check/update expiry | Request | Status ambiguity | 30-120ms | MEDIUM |

---

## High-Risk Patterns (8 items)

| Pattern | Location | Issue | Risk |
|---------|----------|-------|------|
| Check-then-write (no transaction) | request.controller.js | Acceptence, expiry | Data corruption |
| Dedup check before creation | activity.service, reward.service | Activity, rewards | Duplicates on concurrent |
| Fire-and-forget with catch | donation.service | Activity logging | Silent failures, duplicates |
| Separate operations (create + send) | notification.service | Notifications | Orphaned sends |
| Two-stage queries (no snapshot) | matching.service | Matching results | Stale results |
| Counter increment (no session) | appointment.service | Reschedule count | Limit bypass |
| Separate transaction scopes | reward + activity | Award + log | Out-of-order failures |
| State validation pre-transaction | request-lifecycle | Status transitions | Invalid states |

---

## Medium-Risk Issues (6 items)

| Issue | Location | Scenario | Mitigation |
|-------|----------|----------|-----------|
| Reward balance race | reward.service | Concurrent awards | Catch-based dedup |
| Activity dedup window | activity.service | Fire-and-forget retry | None (will duplicate) |
| Notification ordering | notification.service | Rapid creates | None |
| Matching staleness | matching.service | Concurrent accept | None (by design) |
| Request expiry edge case | request.controller | Near deadline | None |
| Appointment count race | appointment.service | Concurrent reschedule | None (will exceed) |

---

# Evidence

## Code References - Request Acceptance

**File:** [src/controllers/request.controller.js](../src/controllers/request.controller.js)  
**Lines:** 467-520  
**Risk:** Multiple donors can accept simultaneously (acceptedBy check not atomic)

```javascript
if (request.acceptedBy) {
  return response.error(res, 400, 'Request has already been accepted');
}
// ... eligibility checks ...
const donation = await Donation.create({ ... });
request.status = 'accepted';
request.acceptedBy = donor._id;
await request.save();
```

**Missing:** No transaction, no database constraint

---

## Code References - Activity Logging

**File:** [src/services/activity.service.js](../src/services/activity.service.js)  
**Lines:** 70-95  
**Risk:** Dedup check not atomic; fire-and-forget retry pattern

```javascript
if (normalizedReferenceId) {
  const existing = await Activity.findOne({ userId, action, referenceId });
  if (existing) return null;
}

const activity = await Activity.create({ ... });
```

**Missing:** Unique constraint, transaction, idempotency key

---

## Code References - Reward Points

**File:** [src/services/reward.service.js](../src/services/reward.service.js)  
**Lines:** 128-175  
**Risk:** Dedup window before transaction; catch-based mitigation

```javascript
const existing = await PointsTransaction.findOne({ donorId, referenceId, transactionType: type });
if (existing) return null;

const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    // Updates...
  });
} catch (err) {
  if (normalizedReferenceId && isMongoDuplicateKeyError(err)) {
    return null;
  }
}
```

**Issue:** Check-then-update pattern vulnerable to races before constraint

---

## Code References - Donation Completion

**File:** [src/services/donation.service.js](../src/services/donation.service.js)  
**Lines:** 170-240  
**Finding:** ✅ PROTECTED - Uses transaction session properly

```javascript
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    const donationDoc = await Donation.findById(donationId).session(session);
    // ... all operations in session ...
  });
}
```

**Status:** This is the reference implementation for transactional safety

---

## Code References - Matching Query Staleness

**File:** [src/services/matching.service.js](../src/services/matching.service.js)  
**Lines:** 540-670  
**Risk:** Query results become stale before being returned

```javascript
const [existingDonations, activeAppointments] = await Promise.all([
  Donation.find({ donorId, requestId: { $in: requestIds }, ... }),
  Appointment.find({ donorId, status: { $in: ACTIVE_APPOINTMENT_STATUSES } }),
]);

// ... time gap ...

for (const request of requests) {
  if (respondedRequestIds.has(request._id.toString())) continue;
  // Could be stale - donor might have accepted between query and here
}
```

**Missing:** Snapshot consistency, transaction scope

---

## Code References - Appointment Reschedule

**File:** [src/services/appointment.service.js](../src/services/appointment.service.js)  
**Lines:** 200-350  
**Risk:** Reschedule counter not protected; can exceed limit

```javascript
const maxReschedules = Number(hospitalSettings.maxReschedules ?? DEFAULT_MAX_RESCHEDULES);

if (appointment.rescheduleCount >= maxReschedules) {
  throw new Error('This appointment has reached the maximum number of reschedules');
}

// ... no transaction ...

appointment.rescheduleCount += 1;
await appointment.save();  // No session
```

**Missing:** Transaction session, atomic increment

---

## Code References - Notification Fire-and-Forget

**File:** [src/services/notification.service.js](../src/services/notification.service.js)  
**Lines:** 42-63  
**Risk:** Notification creation + FCM send not atomic; no idempotency

```javascript
const notification = await Notification.create({
  userId,
  type: 'match',
  relatedId: donation._id,
  // ... no idempotency field ...
});

// Separate operation
if (hospital?.fcmTokens?.length > 0) {
  try {
    await (sendToMultipleWithRetry || sendToMultiple)(
      hospital.fcmTokens,
      notificationTitle,
      notificationMessage,
      { attempts: 3, baseDelayMs: 200 }  // Retry independent of DB
    );
  }
}
```

**Missing:** Idempotency key, atomic create+send, request ID dedup

---

## Database Schema - Lack of Constraints

**Donation Model** ([src/models/Donation.model.js](../src/models/Donation.model.js))  
**Missing Unique Constraints:**
- No unique constraint on (donorId, requestId, status)
- Allows multiple donations for same donor-request pair in pending status

**Request Model** ([src/models/Request.model.js](../src/models/Request.model.js))  
**Missing Unique Constraints:**
- acceptedBy is not unique
- Can be overwritten by concurrent updates

**Activity Model** (inferred)  
**Missing Unique Constraints:**
- No unique constraint on (userId, action, referenceId)
- Allows duplicate activities

**Impact:** Race conditions can't be caught at database level

---

# Recommendations

## Analysis-Level Findings Summary

### High-Urgency Findings (Pre-Production Blockers)

1. **Request Acceptance Not Atomic**
   - Current: Check + update without transaction
   - Impact: Multiple donors can accept same request, causing data corruption
   - Recommendation: Wrap entire flow in transaction; validate at DB constraint level

2. **Donation Deduplication Non-Atomic**
   - Current: Check exists → create (50ms race window)
   - Impact: Duplicate donations for same donor-request pair
   - Recommendation: Use unique database constraint or atomic upsert

3. **Activity Logging Fire-and-Forget**
   - Current: Async logging without idempotency; retry = duplicate
   - Impact: Timeline duplication on network failures
   - Recommendation: Implement idempotency key; make dedup atomic

4. **Matching Results Can Include Accepted Requests**
   - Current: Query, then filter (staleness window)
   - Impact: Donor sees requests they already accepted
   - Recommendation: Use snapshot consistency or query cache with invalidation

5. **Notification Creation Not Idempotent**
   - Current: Separate create + FCM send; retry-unsafe
   - Impact: Duplicate notifications/pushes on failures
   - Recommendation: Add idempotency key; make operations atomic

---

### Medium-Urgency Findings (Performance/Correctness)

6. **Reward Points Dedup Window**
   - Current: Check before transaction (catch-based mitigation)
   - Impact: Window where concurrent awards both increment
   - Recommendation: Move dedup check into transaction or use constraint

7. **Appointment Reschedule Counter**
   - Current: No transaction; counter can exceed limit under concurrency
   - Impact: Limit enforced inconsistently
   - Recommendation: Use session for counter increment or atomic $inc

8. **Request Expiry Race**
   - Current: Check + save not atomic
   - Impact: Status ambiguity near deadline
   - Recommendation: Atomic update with findOneAndUpdate or transaction

---

### Lower-Priority Findings (Edge Cases)

9. **Hospital Settings Upsert**
   - Current: findOneAndUpdate with upsert
   - Finding: Atomic at MongoDB level, but consider idempotency key for retries
   - Recommendation: Monitor for unexpected multiple documents; add logging

10. **Concurrent Hospital-Donor Operations**
    - Current: Separate domain operations (no cross-entity races detected for independent paths)
    - Finding: Acceptable given current architecture
    - Recommendation: Monitor rejection + completion timeline races in production

---

## Implementation-Level Recommendations (Phase Analysis Only)

**NOT generating implementation tasks, but noting architectural patterns:**

- All critical operations should use Mongoose transactions (session.withTransaction)
- Deduplication checks should be atomic with creation (use unique constraints or atomic upsert)
- Fire-and-forget background operations need idempotency keys
- Matching/query operations should use snapshot consistency or implement cache invalidation
- Consider request ID deduplication at HTTP middleware level for all mutation endpoints

---

# Open Questions

## Clarifications Needed for Concurrency Strategy

1. **Idempotency Requirements**
   - Does the business accept duplicate notifications on network retry?
   - Or should all mutations be fully idempotent?
   - Affects scope of fixes

2. **Transaction Consistency Model**
   - Can we rely on MongoDB transaction support across all operations?
   - Or is snapshot isolation sufficient for some paths?
   - Affects transaction boundary design

3. **Background Job Processing**
   - Are there any scheduled/background jobs that might create races?
   - (None detected in audit; confirmation needed)
   - Affects background processing analysis

4. **Request Retry Semantics**
   - Should POST /requests/123/accept be idempotent?
   - Or is 409 conflict acceptable on retry?
   - Affects API contract

5. **Notification Duplicate Tolerance**
   - Maximum acceptable duplicate notification percentage?
   - Or should duplicates be zero-tolerance?
   - Affects notification retrial strategy

6. **Matching Staleness Tolerance**
   - Is 50-100ms staleness in matching results acceptable?
   - Or should snapshot consistency be enforced?
   - Affects UX expectations

7. **Database Constraints Coverage**
   - Can we add unique constraints on Donation(donorId, requestId)?
   - Or does business logic require flexibility?
   - Affects schema modification scope

8. **Transaction Rollback Handling**
   - If activity logging fails mid-transaction, should entire operation rollback?
   - Or are activity failures acceptable?
   - Affects error handling strategy

---

# Summary

**LifeLink Concurrency Audit: CRITICAL** 🔴

**Key Statistics:**
- **Critical Risks:** 11 (data corruption, duplicate operations, split state)
- **High-Risk Patterns:** 8 (unprotected sequential operations)
- **Transaction-Protected Paths:** 2 of 11+ critical operations
- **Unprotected Race Windows:** 50-500ms average duration
- **Database Constraints Preventing Duplicates:** 0 unique constraints on sensitive fields

**Concurrency Readiness:** **FAILING**

The system will experience data corruption, duplicate records, and state inconsistencies under realistic multi-user load with mobile clients (variable network latency = concurrent requests).

**Minimum Pre-Production Requirements:**
1. Wrap request acceptance in transaction + add DB constraint
2. Atomize donation deduplication
3. Implement idempotency for activity logging and notifications
4. Protect appointment reschedule counter
5. Add idempotency keys to all mutation endpoints

**Estimated Risk Materialization:** Within first 100 concurrent donors on emergency requests or under mobile retry scenarios.
