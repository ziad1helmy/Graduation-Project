# LifeLink Reward & Points System — Complete Technical Architecture

**Last Updated:** May 9, 2026  
**Scope:** Backend Reward Engine Architecture, Data Flow, and Production Audit

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture & Components](#architecture--components)
4. [Database Design](#database-design)
5. [Complete Request Lifecycle](#complete-request-lifecycle)
6. [Points Calculation System](#points-calculation-system)
7. [Badge & Achievement System](#badge--achievement-system)
8. [Reward Redemption Flow](#reward-redemption-flow)
9. [Activity Logging System](#activity-logging-system)
10. [Tier Promotion System](#tier-promotion-system)
11. [Security & Abuse Prevention](#security--abuse-prevention)
12. [Scalability Review](#scalability-review)
13. [Identified Issues & Technical Debt](#identified-issues--technical-debt)
14. [Recommendations](#recommendations)
15. [Production Readiness Assessment](#production-readiness-assessment)

---

## Executive Summary

The LifeLink Reward System is a **points-based gamification engine** designed to incentivize blood and organ donors through a multi-tier system featuring:

- **Dynamic Points Economy**: Donors earn points from donations, emergency responses, profile completion, and tier promotions
- **Tier Progression**: Bronze → Silver → Gold → Platinum (lifetime-based, never downgrade)
- **Badge Achievements**: 7 unlockable badges tied to donation milestones and emergency response counts
- **Reward Redemption**: 6 catalog rewards (Coffee Vouchers, Movie Tickets, Health Check-ups, etc.) with daily/monthly limits
- **Activity Timeline**: Immutable audit log of all user actions with deduplication and TTL pruning

**Key Strengths:**
- Atomic transactions prevent race conditions on points deductions
- Deduplication prevents duplicate awards (unique constraints on reference IDs)
- Fire-and-forget activity logging ensures main flow never blocked
- Separate points collection for atomic $inc operations

**Critical Weaknesses:**
- Tight coupling between donation.service → reward.service → activity.service
- Badge checking happens asynchronously (fire-and-forget), creating eventual consistency
- No event queue; all side effects execute synchronously then fire-and-forget
- Activity timestamps can become inconsistent with actual events due to async logging
- Potential race condition if duplicate donations complete simultaneously before dedup check runs

---

## System Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Flutter)                          │
│  - View points/tier                                              │
│  - Browse reward catalog                                         │
│  - Redeem reward                                                 │
│  - View badge progress                                           │
│  - View activity feed                                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP/REST
┌─────────────────────▼───────────────────────────────────────────┐
│                    API LAYER (Controllers)                       │
│  reward.controller.js | donation.controller.js                  │
│  - GET /rewards/points                                          │
│  - GET /rewards/dashboard                                       │
│  - POST /rewards/{id}/redeem                                    │
│  - GET /rewards/leaderboard                                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                  BUSINESS LOGIC LAYER (Services)                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ reward.service.js (Primary Engine)                       │   │
│  │ - awardPoints() — atomic points grant                    │   │
│  │ - onDonationCompleted() — triggered reward logic         │   │
│  │ - checkAndUpdateBadges() — async badge evaluation        │   │
│  │ - redeemReward() — transactional points deduction        │   │
│  │ - getPointsSummary() — tier calculations                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ donation.service.js (Triggers)                           │   │
│  │ - updateDonationStatus() → calls rewardService           │   │
│  │ - onDonationCompleted() → ENTRY POINT                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ activity.service.js (Logging)                            │   │
│  │ - logActivity() — create activity records                │   │
│  │ - getUserTimeline() — retrieve activity feed             │   │
│  │ - Deduplication on (userId, action, referenceId)         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│              DATA ACCESS LAYER (Models & Indexes)                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ DonorPoints (1 per donor)                                │   │
│  │ - idx: donorId (unique)                                  │   │
│  │ - idx: lifetimePointsEarned (for leaderboard)            │   │
│  │ - Atomic operations: $inc on balance + lifetime          │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PointsTransaction (immutable log)                         │   │
│  │ - idx: donorId + createdAt (timeline)                    │   │
│  │ - idx: referenceId (partial, unique for dedup)           │   │
│  │ - idx: transactionType                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Badge (static, seeded at startup)                         │   │
│  │ - idx: unlockCondition + unlockThreshold                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ UserBadge (one per donor-badge pair)                      │   │
│  │ - idx: (donorId, badgeId) — unique                       │   │
│  │ - Upserted by badge checker                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ RewardCatalog (admin-managed catalog)                     │   │
│  │ - idx: status, category, pointsCost                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ RewardRedemption (transaction log)                        │   │
│  │ - idx: (donorId, createdAt)                              │   │
│  │ - idx: status                                            │   │
│  │ - Confirmation code auto-generated                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Activity (immutable timeline with TTL)                    │   │
│  │ - idx: (userId, createdAt) — primary timeline            │   │
│  │ - idx: (userId, action, referenceId) — unique dedup      │   │
│  │ - TTL: 365 days (auto-pruned)                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Donation (tracks donation state)                          │   │
│  │ - idx: (donorId, status)                                 │   │
│  │ - Triggers reward awarding on completion                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture & Components

### Core Components

#### 1. **Reward Service** (`src/services/reward.service.js`)

The **primary business logic engine** for the entire rewards system.

**Main Responsibilities:**
- Point awarding with atomic transactions
- Badge evaluation and unlocking
- Reward redemption with daily/monthly limits
- Tier promotion with bonus point awarding
- Leaderboard generation
- Admin point adjustments

**Key Functions:**

| Function | Purpose | Transactional | Async |
|----------|---------|---------------|-------|
| `awardPoints()` | Atomic points grant with tier recalc | ✅ Yes | ✗ No |
| `onDonationCompleted()` | Entry point: triggered by donation.service | ✗ No | ✓ Partial (badge check is fire-and-forget) |
| `checkAndUpdateBadges()` | Evaluate all badges for a donor | ✗ No | ✓ Fire-and-forget in onDonationCompleted |
| `redeemReward()` | Transactional points deduction | ✅ Yes | ✓ Activity logging is fire-and-forget |
| `getPointsSummary()` | Fetch current balance and tier | ✗ No | ✗ No |
| `getLeaderboard()` | Top N donors by lifetime points | ✗ No | ✗ No |
| `adminAdjustPoints()` | Manual points correction | ✅ Yes | ✗ No |

**Deduplication Strategy:**
```javascript
// Before awarding points, check if reference already processed
const existing = await PointsTransaction.findOne({ 
  donorId, 
  referenceId: normalizedReferenceId, 
  transactionType: type 
});
if (existing) return null; // Already awarded

// Inside transaction, MongoDB unique constraint provides final safety
{
  unique: true,
  partialFilterExpression: { referenceId: { $type: 'string' } }
}
```

---

#### 2. **Donation Service** (`src/services/donation.service.js`)

The **trigger point** for the reward system. Handles donation lifecycle and notifies reward engine.

**Key Function - `updateDonationStatus()`:**
```javascript
if (status === 'completed') {
  // 1. Update lastDonationDate
  await Donor.findByIdAndUpdate(donation.donorId, { 
    lastDonationDate: new Date() 
  });

  // 2. Log completion activity (fire-and-forget)
  activityService.logActivity(...);

  // 3. CRITICAL: Trigger reward system (fire-and-forget)
  Request.findById(donation.requestId)
    .select('urgency')
    .then((req) => {
      const isEmergency = req?.urgency === 'critical';
      return rewardService.onDonationCompleted(
        donation.donorId, 
        donation._id, 
        isEmergency  // Emergency multiplier
      );
    })
    .catch((e) => logger.error('Reward trigger error', { message: e.message }));
}
```

**Fire-and-Forget Pattern Issue:**
The critical reward logic runs in a `.then()` without awaiting the main flow. This means:
- ✅ Donation update completes instantly
- ⚠️ Points may not be credited immediately
- ⚠️ If reward service crashes, points are silently lost

---

#### 3. **Activity Service** (`src/services/activity.service.js`)

The **immutable audit log** for all user actions. Supports deduplication and timeline querying.

**Core Principle:** Fire-and-forget safe—errors are logged, never thrown upstream.

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `logActivity()` | Create activity with deduplication |
| `getUserTimeline()` | Paginated activity feed (newest first) |
| `getLatestActivities()` | Dashboard shortcut (no pagination) |

**Deduplication Logic:**
```javascript
if (normalizedReferenceId) {
  const existing = await Activity.findOne({
    userId,
    action: payload.action,
    referenceId: normalizedReferenceId
  });
  if (existing) return null; // Skip duplicate
}

// Then create with unique index enforcement:
{
  unique: true,
  partialFilterExpression: { referenceId: { $type: 'string' } }
}
```

---

#### 4. **Points Configuration** (`src/models/PointsTransaction.model.js`)

Single source of truth for all point values:

```javascript
export const POINTS_CONFIG = {
  BLOOD_DONATION: 200,              // Base points per donation
  EMERGENCY_RESPONSE: 100,          // Bonus for critical urgency
  PROFILE_COMPLETION: 50,           // One-time onboarding bonus
  FIRST_DONATION: 100,              // One-time first donation bonus
  TIER_BONUS_SILVER: 50,            // Promotion bonus → silver
  TIER_BONUS_GOLD: 150,             // Promotion bonus → gold
  TIER_BONUS_PLATINUM: 500,         // Promotion bonus → platinum
};
```

---

### Supporting Components

#### Badge System

**Model Structure:**
```
Badge (static catalog)
  ├─ badgeName: String (unique)
  ├─ unlockCondition: 'completedDonations' | 'emergencyResponses'
  ├─ unlockThreshold: Number
  ├─ pointsReward: Number (bonus on first unlock)
  └─ rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'

UserBadge (per donor-badge pair)
  ├─ donorId (FK)
  ├─ badgeId (FK)
  ├─ unlockStatus: 'LOCKED' | 'UNLOCKED'
  ├─ progressCurrent: Number
  ├─ progressTarget: Number
  └─ unlockedAt: Date
```

**Badge Evaluation Algorithm:**
```
For each badge in system:
  1. Calculate metric (completedDonations or emergencyResponses count)
  2. Check if metric >= badge.unlockThreshold
  3. Upsert UserBadge with progressCurrent, progressTarget
  4. If newly unlocked (wasn't before):
     a. Award pointsReward
     b. Log activity
     c. Send notification
     d. Return in array
```

**Seeded Badges (7 total):**
| Badge | Condition | Threshold | Points |
|-------|-----------|-----------|--------|
| First Timer | Completed Donations | 1 | 0 |
| Regular Donor | Completed Donations | 5 | 50 |
| Life Saver | Completed Donations | 10 | 100 |
| Hero | Completed Donations | 20 | 200 |
| Legend | Completed Donations | 50 | 500 |
| Emergency Responder | Emergency Responses | 10 | 200 |
| Community Helper | Emergency Responses | 25 | 500 |

---

#### Reward Catalog & Redemption

**RewardCatalog Model:**
```
{
  name: String,
  description: String,
  pointsCost: Number,
  category: 'FOOD' | 'ENTERTAINMENT' | 'HEALTH' | 'STATUS',
  iconType: String,
  status: 'ACTIVE' | 'INACTIVE' | 'LIMITED',
  dailyLimit: Number (optional),
  monthlyLimit: Number (optional),
  redemptionCount: Number
}
```

**Seeded Rewards (6 total):**
| Reward | Cost | Category | Limit |
|--------|------|----------|-------|
| Coffee Voucher | 500 | FOOD | ∞ |
| Movie Tickets | 1000 | ENTERTAINMENT | 5/day, 50/month |
| Restaurant Gift Card | 1500 | FOOD | ∞ |
| Health Check-up | 2000 | HEALTH | ∞ |
| Premium Badge | 2500 | STATUS | ∞ |
| Gym Membership | 3000 | HEALTH | ∞ |

**RewardRedemption Model:**
```
{
  donorId: ObjectId,
  rewardId: ObjectId,
  pointsSpent: Number,
  confirmationCode: String (auto-generated, unique),
  status: 'CONFIRMED' | 'DELIVERED' | 'EXPIRED' | 'CANCELLED',
  deliveryMethod: 'IN_APP' | 'EMAIL',
  expiresAt: Date (default +30 days)
}
```

---

### Tier System

**Tier Thresholds (based on `lifetimePointsEarned`):**

| Tier | Min Lifetime | Max Lifetime | Key Benefit |
|------|--------------|--------------|------------|
| Bronze | 0 | 999 | Access to basic rewards |
| Silver | 1000 | 2499 | +50 bonus points on tier promotion; early access to limited rewards |
| Gold | 2500 | 4999 | +150 bonus points; exclusive gold rewards |
| Platinum | 5000+ | ∞ | +500 bonus points; VIP support; all exclusive rewards |

**Tier Promotion Algorithm:**
```javascript
// Calculate from lifetime (never decreases)
static calculateTier(lifetimePoints) {
  if (lifetimePoints >= 5000) return 'platinum';
  if (lifetimePoints >= 2500) return 'gold';
  if (lifetimePoints >= 1000) return 'silver';
  return 'bronze';
}

// On points grant, if tier changed:
const newTier = DonorPoints.calculateTier(updatedLifetime);
if (newTier !== oldTier) {
  const bonus = { silver: 50, gold: 150, platinum: 500 }[newTier];
  await awardPoints(donorId, bonus, 'TIER_BONUS', ...);
  // Log activity & send notification
}
```

---

## Database Design

### Entity Relationship Diagram

```
User (base user record)
├─ Donor (extends User via discriminator or ref)
│  ├─ DonorPoints (1:1)
│  │  └─ PointsTransaction (1:N) — immutable audit log
│  │
│  ├─ UserBadge (1:N) — progress toward each badge
│  │  └─ Badge (reference to static catalog)
│  │
│  ├─ RewardRedemption (1:N) — redemption history
│  │  └─ RewardCatalog (reference to catalog)
│  │
│  ├─ Donation (1:N) — donation lifecycle
│  │  └─ Request (reference)
│  │
│  └─ Activity (1:N) — audit timeline with TTL
│
Hospital (extends User)
├─ Request (1:N)
│  └─ Donation (1:N) — linked donations
│
Badge (static, ~7 records)
├─ UserBadge (N:M join)
│
RewardCatalog (static, ~6 records)
├─ RewardRedemption (N:N join)
```

### Collection Sizes (Estimated at Scale)

| Collection | Records (1M donors) | Size/Index Strategy |
|------------|------------------|-------------------|
| DonorPoints | 1M | Small, frequently updated via $inc |
| PointsTransaction | 15-30M | Large, append-only; needs indexes on (donorId, createdAt) |
| Badge | ~7 | Tiny, immutable |
| UserBadge | 7M | Medium, compound index on (donorId, badgeId) |
| RewardCatalog | ~6 | Tiny, rarely changes |
| RewardRedemption | 5-10M | Medium, index on (donorId, createdAt) for history queries |
| Activity | 50-100M | Very large, TTL index removes old records daily |

---

## Complete Request Lifecycle

### Scenario: Donor Completes Blood Donation (Critical Urgency)

```
TIMELINE:

[1] Hospital marks appointment as scanned via QR:
    POST /appointments/verify-qr { qrToken: "demo-qr-aya-critical" }
    
    ↓ (donation.controller.js::verifyQr)
    
[2] Create Donation record:
    Donation.create({
      donorId: aya._id,
      requestId: criticalRequest._id,
      quantity: 1,
      status: 'completed',
      completedDate: now
    })
    
    ↓ (donation.controller.js)
    
[3] Update Donor lastDonationDate:
    Donor.findByIdAndUpdate(aya._id, { lastDonationDate: now })
    
    ↓ (async, parallel paths)
    
[4a] LOG ACTIVITY (fire-and-forget):
     activityService.logActivity(aya._id, {
       type: 'donation',
       action: 'qr_verified',
       title: 'Donation Verified',
       description: 'Hospital QR verified',
       referenceId: donation._id.toString(),
       metadata: { ... }
     })
     
     → Checks dedup: Activity.findOne({ userId, action, referenceId })
     → If new, Activity.create(...)
     → Returns immediately; no await
    
[4b] TRIGGER REWARD SYSTEM (fire-and-forget):
     Request.findById(criticalRequest._id).select('urgency')
       .then(req => {
         const isEmergency = req?.urgency === 'critical'; // ← TRUE
         return rewardService.onDonationCompleted(aya._id, donation._id, true);
       })
       .catch(err => logger.error(...))
     
     → Immediately returns HTTP 200 to client
     → Reward logic continues in background...

[5] AWARD POINTS (sync, blocking):
    awardPoints(aya._id, 200, 'BLOOD_DONATION', 'Blood Donation - Successful', `donation_${donation._id}`)
    
    → Start MongoDB session
    → Dedup check: PointsTransaction.findOne({ 
         donorId: aya._id, 
         referenceId: `donation_${donation._id}`,
         transactionType: 'BLOOD_DONATION'
       })
       → Not found (first time)
    
    → Atomic update: DonorPoints.findOneAndUpdate(
         { donorId: aya._id },
         { 
           $inc: { 
             pointsBalance: 200,          // ← now 1050
             lifetimePointsEarned: 200    // ← now 950
           }
         },
         { upsert: true, returnDocument: 'after', session }
       )
    
    → Calculate new tier:
       newTier = calculateTier(950) → 'bronze'
       oldTier = 'bronze'
       tierChanged = false
    
    → Create PointsTransaction:
       PointsTransaction.create([{
         donorId: aya._id,
         pointsAmount: 200,
         transactionType: 'BLOOD_DONATION',
         description: 'Blood Donation - Successful',
         referenceId: `donation_${donation._id}`,
         balanceAfter: 1050
       }], { session })
    
    → Commit transaction
    → Return { account, transaction, tierChanged: false, ... }

[6] AWARD EMERGENCY BONUS (sync, blocking):
    awardPoints(aya._id, 100, 'EMERGENCY_RESPONSE', 'Emergency Response Bonus', `emergency_${donation._id}`)
    
    → Same atomic flow as step [5]
    → Now pointsBalance: 1150, lifetimePointsEarned: 1050
    → Dedup check ensures no duplicate

[7] CHECK & UPDATE BADGES (async, fire-and-forget):
    checkAndUpdateBadges(aya._id)
      .catch(err => logger.error('Badge check error', ...))
    
    → Parallel queries:
       • Badge.find() — all 7 badges
       • Donation.countDocuments({ donorId: aya._id, status: 'completed' }) → 1
       • Donation.aggregate() emergency requests → 0
    
    → For "First Timer" badge:
       • progressCurrent = 1
       • unlockThreshold = 1
       • isUnlocked = true (1 >= 1)
       
       → UserBadge.findOneAndUpdate(
            { donorId: aya._id, badgeId: firstTimerBadge._id },
            {
              $set: {
                progressCurrent: 1,
                progressTarget: 1,
                unlockStatus: 'UNLOCKED',
                unlockedAt: now
              },
              $setOnInsert: { donorId: aya._id, badgeId: firstTimerBadge._id }
            },
            { upsert: true, returnDocument: 'after' }
          )
       
       → Check if already awarded: PointsTransaction.exists({
            donorId: aya._id,
            referenceId: `badge_${firstTimerBadge._id}`
          })
          → Not found (first unlock)
       
       → Award 0 points (First Timer has pointsReward: 0)
       
       → Log activity: activityService.logActivity(..., badge_unlocked)
       → Send notification: Notification.create(...)
       → Add to newlyUnlocked array

[8] LOG ACTIVITY — POINTS EARNED (fire-and-forget):
    After awardPoints returns, if type !== 'TIER_BONUS':
    
    activityService.logActivity(aya._id, {
      type: 'reward',
      action: 'earned_points',
      title: 'Points Earned',
      description: 'Blood Donation - Successful',
      referenceId: `donation_${donation._id}`,
      metadata: {
        pointsAmount: 200,
        transactionType: 'BLOOD_DONATION',
        balanceAfter: 1050
      }
    }).catch(...)

[9] HTTP RESPONSE (returned at this step):
    200 OK {
      donation: {
        donationId: donation._id,
        type: 'Whole Blood',
        date: now,
        location: 'Cairo Care Hospital',
        status: 'confirmed'
      },
      pointsEarned: 200,  // ← Base points only (not emergency, not total)
      message: 'Donation verified successfully'
    }
    
    Client receives response immediately.
    Background jobs still running...

[10] (Background, no await) — Complete when badge checks finish:
     Badge updates, notifications, activity logs all write to DB
     If any fail, error is logged but doesn't affect response
```

---

### Step-by-Step Breakdown

#### Phase 1: Synchronous Donation Completion (Blocking)
1. Create Donation record
2. Update Donor.lastDonationDate
3. Return HTTP 200

**Elapsed Time: ~50ms**

#### Phase 2: Fire-and-Forget Reward Trigger (Non-blocking)
1. Fetch Request to check urgency
2. Call `rewardService.onDonationCompleted(donorId, donationId, isEmergency)`
   - This runs in the `.then()` of a promise, not awaited

**Elapsed Time: ~100-200ms (background)**

#### Phase 3: Synchronous Points Award (Inside Phase 2)
1. Dedup check
2. Atomic DonorPoints $inc
3. Create PointsTransaction
4. Calculate and potentially award tier bonus
5. Fire-and-forget: Log activity + notification

**Elapsed Time: ~200-300ms (inside background promise)**

#### Phase 4: Async Badge Checking (Fire-and-forget inside Phase 2)
1. Fetch all badges
2. Count completed donations and emergency responses
3. Upsert UserBadge records for each badge
4. For newly unlocked badges: award points, log activity, notify
5. Return array of new badge names (but result is not awaited)

**Elapsed Time: ~400-600ms (background, no await)**

#### Phase 5: Final Response
- Client has already received HTTP 200 by this point
- Points, badges, and activities are guaranteed to be created (or will be retried)
- If background process crashes, donor still sees the donation completed, but points may not be credited

---

## Points Calculation System

### Earning Points

**Fixed point values from `POINTS_CONFIG`:**

| Event | Base Points | Multiplier | Notes |
|-------|------------|-----------|-------|
| Blood Donation | 200 | 1x | Always 200 per completed donation |
| Profile Completion | 50 | 1x | One-time, on first profile update |
| First Donation | 100 | 1x | One-time, bonus on first completed donation |
| Emergency Response | 100 | 1x | Bonus if request.urgency === 'critical' |
| Tier Promotion | 50/150/500 | Tier-dependent | Silver: +50, Gold: +150, Platinum: +500 |

### Total Points Formula

For a completed donation on a critical request:

```
Total Points = 
  BLOOD_DONATION +
  EMERGENCY_RESPONSE +
  (FIRST_DONATION if !account.firstDonationAwarded) +
  (TIER_BONUS if tier upgraded)

Example (first critical donation):
  200 + 100 + 100 + (0 if no tier up) = 400 points
```

### Key Calculation Rules

1. **No Points Decay**: Lifetime points never decrease; they compound toward tier
2. **Atomic Balance**: Both `pointsBalance` and `lifetimePointsEarned` updated in single operation
3. **Deduplication**: Same event can only award points once (checked by referenceId)
4. **Tier Bonus Cascading**: Can trigger tier promotion, which awards bonus points, which may trigger another tier promotion (theoretically, but unlikely at current thresholds)

### Tier Calculation

```javascript
// Deterministic from lifetime points only
static calculateTier(lifetimePoints) {
  if (lifetimePoints >= 5000) return 'platinum';
  if (lifetimePoints >= 2500) return 'gold';
  if (lifetimePoints >= 1000) return 'silver';
  return 'bronze';
}

// Recalculated on every points award
// Stored in DonorPoints.tier for fast lookups
```

---

## Badge & Achievement System

### Badge Evaluation Algorithm

**Trigger**: Whenever donation status changes to `completed`

**Execution**: Fire-and-forget (async)

```javascript
export const checkAndUpdateBadges = async (donorId) => {
  // 1. Fetch all badge definitions and donor metrics
  const [allBadges, completedDonations, emergencyResponses] = await Promise.all([
    Badge.find().sort({ sortOrder: 1 }),
    Donation.countDocuments({ donorId, status: 'completed' }),
    Donation.aggregate([
      { $match: { donorId, status: 'completed' } },
      { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
      { $match: { 'request.urgency': 'critical' } },
      { $count: 'total' }
    ]).then(r => r[0]?.total || 0)
  ]);

  const metricMap = {
    completedDonations,
    emergencyResponses
  };

  const newlyUnlocked = [];

  // 2. For each badge, evaluate unlock condition
  for (const badge of allBadges) {
    const currentMetric = metricMap[badge.unlockCondition] ?? 0;
    const isUnlocked = currentMetric >= badge.unlockThreshold;

    // 3. Upsert UserBadge with latest progress
    const updated = await UserBadge.findOneAndUpdate(
      { donorId, badgeId: badge._id },
      {
        $set: {
          progressCurrent: Math.min(currentMetric, badge.unlockThreshold),
          progressTarget: badge.unlockThreshold,
          ...(isUnlocked ? { 
            unlockStatus: 'UNLOCKED', 
            unlockedAt: new Date() 
          } : {})
        },
        $setOnInsert: { donorId, badgeId: badge._id }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // 4. If just unlocked (transition LOCKED → UNLOCKED)
    if (isUnlocked && updated.unlockStatus === 'UNLOCKED' && updated.unlockedAt) {
      // Check if points already awarded
      const wasAlreadyUnlocked = await PointsTransaction.exists({
        donorId,
        referenceId: `badge_${badge._id}`
      });

      // Award points if not already done
      if (!wasAlreadyUnlocked && badge.pointsReward > 0) {
        await awardPoints(donorId, badge.pointsReward, 'BADGE_UNLOCK', 
          `Badge Unlocked: ${badge.badgeName}`, 
          `badge_${badge._id}`
        );
      }

      // Only log if first-time unlock
      if (!wasAlreadyUnlocked) {
        newlyUnlocked.push(badge.badgeName);
        
        // Fire-and-forget: log activity + notification
        activityService.logActivity(donorId, {
          type: 'reward',
          action: 'badge_unlocked',
          title: 'Badge Unlocked',
          description: `You've unlocked the ${badge.badgeName} badge`,
          referenceId: badge._id.toString(),
          referenceType: 'Badge',
          metadata: { badgeName: badge.badgeName, ... }
        }).catch(err => logger.error(...));

        Notification.create({
          userId: donorId,
          type: 'system',
          title: `🏆 Badge Unlocked: ${badge.badgeName}`,
          message: badge.badgeDescription,
          data: { badgeId: badge._id, rarity: badge.rarity }
        }).catch(() => {});
      }
    }
  }

  return newlyUnlocked;
};
```

### Badge Unlock Conditions

The system supports two types of unlock conditions:

1. **`completedDonations`**: Total count of donations with `status === 'completed'`
   - Example: First Timer unlocks at 1 completed donation
   - Example: Legend unlocks at 50 completed donations

2. **`emergencyResponses`**: Count of completed donations on critical requests
   - Detected via: `Donation.requestId` → Request where `urgency === 'critical'`
   - Example: Emergency Responder unlocks at 10 emergency responses

### Badge Unlock Path Issues

**Potential Race Condition:**
If two donations complete simultaneously for the same donor:
1. Donation A completes → triggers badge check
2. Donation B completes → triggers badge check (before Badge A finishes)
3. Both check completedDonations count
4. Both see count = 2 (if both just completed)
5. Both try to unlock "Regular Donor" badge at threshold 5
6. No collision (upsert), but potential inconsistency if timing is very tight

**Note**: This is not a critical issue because UserBadge upsert prevents duplicates via unique constraint on `(donorId, badgeId)`.

---

## Reward Redemption Flow

### Complete Redemption Transaction

**Entry Point**: `POST /rewards/{rewardId}/redeem`

```javascript
export const redeemReward = async (donorId, rewardId, { 
  deliveryMethod = 'IN_APP', 
  deliveryContact = null 
} = {}) => {
  // 1. Fetch reward and current points
  const [reward, account] = await Promise.all([
    RewardCatalog.findById(rewardId),
    getOrCreateAccount(donorId)
  ]);

  // 2. Validation checks (non-blocking)
  if (!reward) throw new Error('Reward not found', { statusCode: 404 });
  if (reward.status !== 'ACTIVE') throw new Error('Reward is not available', { statusCode: 400 });
  if (account.pointsBalance < reward.pointsCost) {
    throw new Error(`Insufficient points...`, {
      statusCode: 409,
      code: 'INSUFFICIENT_POINTS',
      details: { userPoints, requiredPoints, shortfall }
    });
  }

  // 3. Transactional redemption (atomic)
  const session = await mongoose.startSession();
  let updatedAccount;
  let redemption;
  const now = new Date();

  try {
    await session.withTransaction(async () => {
      // 3a. Lock reward during transaction (pessimistic locking)
      const lockedReward = await RewardCatalog.findOneAndUpdate(
        { _id: rewardId, status: 'ACTIVE' },
        { $set: { updatedAt: now } },  // Bump timestamp to extend lock window
        { returnDocument: 'after', session }
      );

      if (!lockedReward) {
        throw new Error('Reward is not available', { statusCode: 400 });
      }

      // 3b. Check daily limit
      if (lockedReward.dailyLimit) {
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);

        const dailyCount = await RewardRedemption.countDocuments(
          { 
            rewardId, 
            createdAt: { $gte: dayStart },
            status: { $nin: ['CANCELLED'] }
          },
          { session }
        );

        if (dailyCount >= lockedReward.dailyLimit) {
          throw new Error('Daily redemption limit reached', { statusCode: 409 });
        }
      }

      // 3c. Check monthly limit
      if (lockedReward.monthlyLimit) {
        const monthStart = new Date(now);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const monthlyCount = await RewardRedemption.countDocuments(
          { 
            rewardId,
            createdAt: { $gte: monthStart },
            status: { $nin: ['CANCELLED'] }
          },
          { session }
        );

        if (monthlyCount >= lockedReward.monthlyLimit) {
          throw new Error('Monthly redemption limit reached', { statusCode: 409 });
        }
      }

      // 3d. Deduct points (with atomic guard)
      updatedAccount = await DonorPoints.findOneAndUpdate(
        { 
          donorId, 
          pointsBalance: { $gte: lockedReward.pointsCost }  // ← ATOMIC GUARD
        },
        { $inc: { pointsBalance: -lockedReward.pointsCost } },
        { returnDocument: 'after', session }
      );

      if (!updatedAccount) {
        throw new Error('Insufficient points', { statusCode: 409 });
      }

      // 3e. Create redemption record
      redemption = await RewardRedemption.create(
        [{
          donorId,
          rewardId,
          pointsSpent: lockedReward.pointsCost,
          deliveryMethod,
          deliveryContact,
          status: 'CONFIRMED'
        }],
        { session }
      ).then(docs => docs[0]);

      // 3f. Create transaction log entry
      await PointsTransaction.create(
        [{
          donorId,
          pointsAmount: -lockedReward.pointsCost,
          transactionType: 'REWARD_REDEEMED',
          description: `Reward Redeemed: ${lockedReward.name}`,
          referenceId: String(redemption._id),
          balanceAfter: updatedAccount.pointsBalance
        }],
        { session }
      );

      // 3g. Increment redemption counter on reward
      await RewardCatalog.updateOne(
        { _id: rewardId },
        { $inc: { redemptionCount: 1 } },
        { session }
      );
    });
  } finally {
    session.endSession();
  }

  // 4. Fire-and-forget: log activity + notification (outside transaction)
  activityService.logActivity(donorId, {
    type: 'reward',
    action: 'redeemed_reward',
    title: 'Reward Redeemed',
    description: `Redeemed ${reward.name} for ${reward.pointsCost} points`,
    referenceId: redemption._id.toString(),
    referenceType: 'RewardRedemption',
    metadata: {
      rewardName: reward.name,
      pointsSpent: reward.pointsCost,
      confirmationCode: redemption.confirmationCode,
      remainingPoints: updatedAccount.pointsBalance
    }
  }).catch(err => logger.error('Activity log error', { message: err.message }));

  Notification.create({
    userId: donorId,
    type: 'system',
    title: '🎁 Reward Redeemed!',
    message: `Your ${reward.name} is confirmed. Code: ${redemption.confirmationCode}`,
  }).catch(() => {});

  // 5. Return response
  return {
    redemptionId: redemption._id,
    confirmationCode: redemption.confirmationCode,
    rewardName: reward.name,
    pointsSpent: reward.pointsCost,
    remainingPoints: updatedAccount.pointsBalance,
    redemptionStatus: redemption.status,
    expiresAt: redemption.expiresAt
  };
};
```

### Key Redemption Safeguards

| Safeguard | Mechanism | When It Triggers |
|-----------|-----------|------------------|
| **Points Sufficiency** | Pre-check + atomic guard (`pointsBalance: { $gte: cost }`) | If balance drops between check and deduction |
| **Daily Limits** | Count within transaction | If limit is reached mid-transaction |
| **Monthly Limits** | Count within transaction | If limit is reached mid-transaction |
| **Reward Availability** | Fetch within transaction | If reward deactivated between check and deduction |
| **Deduplication** | PointsTransaction unique constraint | If somehow double-redeemed (shouldn't happen) |

---

## Activity Logging System

### Activity Model & TTL

```javascript
const activitySchema = new mongoose.Schema(
  {
    userId: ObjectId,           // FK to User
    type: String,               // 'donation', 'reward', 'emergency_response', etc.
    action: String,             // 'completed_donation', 'badge_unlocked', etc.
    title: String,              // Display-ready title
    description: String,        // Summary sentence for UI
    referenceId: String,        // ID of related entity (for dedup + deep-linking)
    referenceType: String,      // Type of referenced entity ('Donation', 'Badge', etc.)
    metadata: Mixed,            // Denormalized event snapshot
    icon: String,               // Icon identifier for mobile UI
    createdAt: Date             // Auto-generated, used for sorting
  },
  {
    timestamps: { createdAt: true, updatedAt: false }  // No updatedAt
  }
);

// Indexes
activitySchema.index({ userId: 1, createdAt: -1 });                    // Primary timeline
activitySchema.index({ userId: 1, type: 1, createdAt: -1 });          // Per-type filtering
activitySchema.index(
  { userId: 1, action: 1, referenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { referenceId: { $type: 'string' } }     // Dedup only if referenceId exists
  }
);

// TTL Index — auto-delete after 365 days
activitySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);
```

### Activity Types & Actions (Comprehensive List)

**Current Seeded Activities:**

| Type | Action | When Logged | Triggered By |
|------|--------|------------|--------------|
| `donation` | `created_donation` | When donor initiates donation | donation.service::createDonation |
| `donation` | `completed_donation` | When donation status → completed | donation.service::updateDonationStatus |
| `donation` | `cancelled_donation` | When donation status → cancelled | donation.service::updateDonationStatus |
| `donation` | `qr_verified` | When hospital scans QR for donation | donation.controller::verifyQr |
| `reward` | `earned_points` | When any points award occurs | reward.service::awardPoints |
| `reward` | `badge_unlocked` | When badge transition LOCKED → UNLOCKED | reward.service::checkAndUpdateBadges |
| `reward` | `tier_promoted` | When tier upgraded (silver/gold/platinum) | reward.service::awardPoints |
| `reward` | `redeemed_reward` | When donor redeems a reward | reward.service::redeemReward |
| `profile_update` | `profile_completed` | When donor completes profile | donor.controller (inferred) |
| `appointment` | `appointment_created` | When appointment booked | appointment.service (inferred) |

### Activity Logging Deduplication

**Unique Constraint:**
```javascript
{
  unique: true,
  partialFilterExpression: { referenceId: { $type: 'string' } }
}
```

This ensures:
- Activities without `referenceId` can have duplicates (allowed)
- Activities with `referenceId` are deduplicated on `(userId, action, referenceId)` combination
- If same event is logged twice with same referenceId, second insert fails silently (caught in service)

**Example Dedup Scenarios:**

| Scenario | referenceId | Allowed? | Why |
|----------|-------------|----------|-----|
| Donation completed, activity logged once | `donation_123` | ✅ Yes | One entry |
| Donation completed, activity logged twice | `donation_123` | ❌ No | Unique constraint prevents duplicate |
| Badge unlocked, no referenceId | null | ✅ Yes | No constraint |
| Badge unlocked twice without referenceId | null | ✅ Yes | No constraint (allowed but shouldn't happen) |

---

## Tier Promotion System

### When Promotion Happens

**Trigger**: During `awardPoints()` when `lifetimePointsEarned` crosses threshold

```javascript
// Inside awardPoints transaction:
const account = await DonorPoints.findOneAndUpdate(
  { donorId },
  { $inc: { pointsBalance, lifetimePointsEarned } },
  { upsert: true, returnDocument: 'after', session }
);

const newTier = DonorPoints.calculateTier(account.lifetimePointsEarned);
const tierChanged = newTier !== account.tier;

if (tierChanged) {
  await DonorPoints.findByIdAndUpdate(account._id, { tier: newTier }, { session });
}
```

### Tier Bonus Awarding

**After Transaction Commits** (outside session):

```javascript
if (result?.tierChanged) {
  const tierBonusMap = {
    silver: 50,
    gold: 150,
    platinum: 500
  };
  const bonus = tierBonusMap[result.newTier];
  
  if (bonus) {
    // Recursive call: award tier bonus
    await awardPoints(
      donorId,
      bonus,
      'TIER_BONUS',
      `Tier promotion bonus: ${result.newTier}`,
      `tier_${result.newTier}_${donorId}`  // Dedup key
    );
  }

  // Fire-and-forget: log activity + notification
  activityService.logActivity(donorId, {
    type: 'reward',
    action: 'tier_promoted',
    title: 'Tier Promoted',
    description: `Congratulations! You've reached ${result.newTier} tier.`,
    metadata: {
      previousTier: result.previousTier,
      newTier: result.newTier,
      bonusPoints: bonus
    }
  }).catch(...);

  Notification.create({
    userId: donorId,
    type: 'system',
    title: `🎉 Tier Upgraded to ${result.newTier}!`,
    message: `Congratulations! You've reached ${result.newTier} tier...`
  }).catch(() => {});
}
```

### Edge Case: Cascading Promotions

**Theoretical Scenario:**
If a single donation awards enough points to jump multiple tiers:

```
Current: lifetime = 900, tier = bronze
Donation: +500 points
After: lifetime = 1400

Tier calculation:
  1400 >= 1000 → silver tier (from bronze)
  Award +50 bonus points
  New lifetime = 1450
  Still silver tier (1450 < 2500)
```

This doesn't cascade because tier is calculated on final lifetime, not recursively. So multi-tier jumps don't happen in practice.

---

## Security & Abuse Prevention

### Built-in Safeguards

#### 1. **Atomic Balance Guards**

All point deductions use atomic guards to prevent overdrafts:

```javascript
// Prevent spending more than available
updatedAccount = await DonorPoints.findOneAndUpdate(
  { 
    donorId, 
    pointsBalance: { $gte: cost }  // ← GUARD
  },
  { $inc: { pointsBalance: -cost } },
  { returnDocument: 'after', session }
);
if (!updatedAccount) throw 'Insufficient points'; // Failed to update = overdraft attempt
```

#### 2. **Deduplication on Awards**

Prevents double-awarding for the same event:

```javascript
// Check if already awarded
const existing = await PointsTransaction.findOne({
  donorId,
  referenceId: normalizedReferenceId,
  transactionType: type
});
if (existing) return null; // Skip
```

Plus MongoDB unique constraint provides additional safety.

#### 3. **One-Time Event Flags**

Prevents re-triggering of one-time bonuses:

```
DonorPoints schema:
  profileCompletionAwarded: Boolean (default: false)
  firstDonationAwarded: Boolean (default: false)

// Before awarding:
if (account.firstDonationAwarded) return; // Already done

// After awarding:
await DonorPoints.findOneAndUpdate({ donorId }, { firstDonationAwarded: true });
```

#### 4. **Reward Redemption Limits**

Daily and monthly caps prevent abuse:

```
RewardCatalog:
  dailyLimit: Number | null
  monthlyLimit: Number | null

// Check within transaction:
const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
const dailyCount = await RewardRedemption.countDocuments({
  rewardId,
  createdAt: { $gte: dayStart },
  status: { $nin: ['CANCELLED'] }
}, { session });

if (dailyCount >= reward.dailyLimit) throw 'Daily limit reached';
```

#### 5. **Immutable Transaction Log**

All point movements are recorded immutably:

```
PointsTransaction:
  - Never updated after creation
  - Always records balanceAfter for audit trail
  - Indexed on referenceId for lookups
```

---

### Potential Vulnerabilities

#### 1. **Race Condition: Concurrent Donation Completion**

**Scenario:**
Two doctors simultaneously mark the same donor's QR code as scanned:

```
[Time 0] Doctor A calls verifyQr(donor123)
[Time 0] Doctor B calls verifyQr(donor123)  ← Both start simultaneously

[Time 10ms] Doctor A: Donation.create() succeeds
[Time 10ms] Doctor B: Donation.create() succeeds

[Time 50ms] Doctor A: rewardService.onDonationCompleted() fires
[Time 50ms] Doctor B: rewardService.onDonationCompleted() fires

[Time 100ms] Doctor A: checkAndUpdateBadges → First Timer unlocks → award 0 points
[Time 100ms] Doctor B: checkAndUpdateBadges → First Timer already unlocked in DB
```

**Mitigation**: Deduplication on referenceId prevents double award, but donor still gets 2 donation records. This is a data integrity issue, not an abuse vector. Solution: Add `status === 'completed'` uniqueness constraint to Appointment or verify QR only once.

#### 2. **Timeout in Transaction → Orphaned Points**

**Scenario:**
Points awarded in transaction, but activity logging fails due to timeout:

```
1. Award points ✅ (committed)
2. Activity log timeout ❌ (rolled back or lost)
3. Donor sees points in account but not in activity feed
```

**Impact**: Minor UX issue, not a security issue. Points are correctly awarded; just missing from audit log.

**Mitigation**: Implement activity logging with retry logic or use event queue.

#### 3. **Admin Point Adjustment Abuse**

**Scenario:**
Compromised admin account grants unlimited points to attacker donor account.

**Mitigations:**
- Requires `admin` role (auth middleware)
- All adjustments logged with admin ID
- AuditLog trail tracks who adjusted what
- No upper bound on single adjustment amount (potential gap)

**Recommendation**: Implement admin point adjustment caps and send email notifications.

#### 4. **Badge Metric Manipulation**

**Scenario:**
If `Donation.status` can be manually set to `completed` without proper verification, badges unlock prematurely.

**Current Protection**: No direct API to set donation status; only via `updateDonationStatus()` which validates state transitions.

**Risk Level**: Low (requires compromised donation service or auth bypass)

#### 5. **Reward Catalog Manipulation**

**Scenario:**
Admin reduces reward `pointsCost` after donor has earned enough, then donor redeems at lower cost.

**Current Protection**: Price locked within redemption transaction (reward fetched fresh inside transaction).

**Mitigation**: Effective. Even if catalog changes, price read inside transaction is the current price. However, this allows price reductions, which may be intentional (seasonal sales).

#### 6. **Leaderboard Injection**

**Scenario:**
Attacker injects fake points into a donor account to top leaderboard.

**Protection**: Leaderboard reads from `DonorPoints.lifetimePointsEarned`, which only increases via atomic `$inc` operations. Cannot be directly modified without admin access.

**Risk Level**: Very low (requires database access or admin compromise)

---

## Scalability Review

### Performance at Different Scales

#### Scale 1: 100K Donors
- DonorPoints: ~100K small docs (~1KB each) → ~100MB
- PointsTransaction: ~1.5M docs → ~1.5GB
- UserBadge: ~700K docs → ~200MB
- Activity: ~5M docs → ~2.5GB
- **Total DB Size: ~5GB**
- **Query Performance: Good** (indexes are efficient)
- **Write Throughput: High** (atomic $inc is optimized)

#### Scale 2: 1M Donors
- DonorPoints: ~1M docs → ~1GB
- PointsTransaction: ~15M docs → ~15GB
- UserBadge: ~7M docs → ~2GB
- Activity: ~50M docs → ~25GB (auto-pruned after 365 days)
- **Total DB Size: ~43GB**
- **Query Performance: Good** (indexes handle well)
- **Write Throughput: Still good** (but activity logging may bottleneck)

#### Scale 3: 10M Donors
- Activity: ~500M docs → ~250GB (before TTL cleanup)
- PointsTransaction: ~150M docs → ~150GB
- **Total DB Size: ~500GB+**
- **Query Performance: Degrading** (activity queries may slow without proper sharding)
- **Write Throughput: May bottleneck** (activity logging becomes contention point)

---

### Identified Scalability Issues

#### 1. **Activity Collection Growth**

**Problem:**
- Every user action creates an activity record
- With 1M users donating monthly, = 1M activities/month
- 365-day TTL means max collection size ≈ 365M docs
- Indexes on (userId, createdAt) + dedup index = heavy index overhead

**Impact at Scale:**
- Index size grows to 100GB+
- New activity inserts compete with TTL deletion threads
- Timeline queries become slower as collection approaches size limit

**Solution:**
- Implement time-series collection (MongoDB 5.0+)
- Or: Archive old activities to separate historical collection
- Or: Implement pagination cursors instead of skip-based pagination

#### 2. **Badge Checking Query Complexity**

**Problem:**
```javascript
// On each donation:
Donation.aggregate([
  { $match: { donorId, status: 'completed' } },
  { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
  { $match: { 'request.urgency': 'critical' } },
  { $count: 'total' }
])
```

This aggregation:
- Scans all completed donations for this donor
- Joins with requests table
- Filters by urgency
- At 1M donors with avg 50 donations each: 50M Donation docs to scan

**Impact:**
- First completion: ~1ms (50 docs)
- 10th completion: ~1ms (50 docs, but now repeated 10 times)
- With high concurrency, this becomes O(N) per donor lifetime

**Solution:**
- Denormalize request.urgency into Donation collection
- Or: Cache emergency response count in DonorPoints
- Or: Implement materialized views

#### 3. **Fire-and-Forget Badge Checking**

**Problem:**
Badge checking is async and fire-and-forget:
```javascript
checkAndUpdateBadges(donorId).catch(e => logger.error(...));
```

At scale with 1000s of concurrent donations:
- 1000 background badge checks running simultaneously
- Each checks all 7 badges
- Each does aggregation on request join
- Database connection pool may exhaust

**Impact:**
- Badge unlocks delayed by 10+ seconds
- Donor doesn't see new badge immediately
- Notifications arrive late

**Solution:**
- Implement badge checking queue with rate limiting
- Or: Defer badge checking to off-peak hours
- Or: Move badge logic to event streaming (Kafka/Redis Streams)

#### 4. **Atomic Transactions on Hot Rows**

**Problem:**
DonorPoints.findOneAndUpdate with $inc is atomic, but at high concurrency:
- Multiple processes may wait for same donor's DonorPoints doc
- MongoDB locks the document during update
- Creates contention on hot rows (prolific donors)

**Impact:**
- Under 100 concurrent donors: negligible
- Under 1000 concurrent donors: ~10-50ms latency per update
- Under 10K concurrent donors: lineups form, latencies spike to 100-500ms

**Solution:**
- Implement point batching (accumulate awards, write once/minute)
- Or: Implement read replicas for reads, primary for writes
- Or: Use event-driven architecture with eventual consistency

#### 5. **Reward Redemption Limit Checks**

**Problem:**
Daily and monthly limits require count query within transaction:
```javascript
const dailyCount = await RewardRedemption.countDocuments({
  rewardId,
  createdAt: { $gte: dayStart },
  status: { $nin: ['CANCELLED'] }
}, { session });
```

At scale:
- Popular reward (Movie Tickets) with 1000 redemptions/day
- Each new redemption scans the 1000 existing redemptions
- If 100 concurrent redemptions: O(N²) behavior

**Impact:**
- Popular rewards become slower as daily redemptions increase
- At 1000/day, 100th redemption has ~100ms latency

**Solution:**
- Implement rolling counters (cache in Redis or counters collection)
- Or: Use event streaming to maintain limit counters

---

### Architecture Recommendations for Scale

#### Short Term (100K-500K donors)
1. ✅ **Current architecture is fine**
2. Monitor activity collection size; implement TTL if not present
3. Add index on Donation { donorId, status } if not present (needed for badge queries)
4. Implement request.urgency index for aggregation

#### Medium Term (500K-2M donors)
1. **Implement Activity Archiving**
   - Move activity >90 days old to archive collection weekly
   - Keeps hot collection small
   - Separate read path for historical data

2. **Denormalize Badge Metrics**
   ```
   DonorPoints {
     completedDonationCount: Number,
     emergencyResponseCount: Number,
     emergencyResponseCountUpdatedAt: Date
   }
   ```
   - Update these on each donation completion
   - Badge checker reads from DonorPoints instead of aggregation
   - Reduces badge checking latency from 100ms to 10ms

3. **Implement Reward Counter Cache**
   ```
   RewardCounter {
     rewardId: ObjectId,
     date: Date,
     dailyCount: Number,
     monthlyCount: Number
   }
   ```
   - Update on each redemption (outside transaction)
   - Limit check queries counter, not RewardRedemption
   - Reduces limit check latency

4. **Add Read Replicas**
   - All read-heavy queries (leaderboard, history, etc.) hit replicas
   - Writes still go to primary
   - Reduces primary contention

#### Long Term (2M+ donors)
1. **Event-Driven Architecture**
   - Donation completion → publishes DonationCompleted event
   - Separate reward service consumes events, processes async
   - Badge checker consumes events, updates cache asynchronously
   - Activity logger consumes events, writes to time-series collection
   - **Benefit**: Decouples services, enables horizontal scaling

2. **Materialized Views**
   ```
   DonorLeaderboard {
     donorId: ObjectId,
     lifetimePoints: Number,
     tier: String,
     rank: Number (calculated nightly)
   }
   ```
   - Leaderboard queries read from view, not DonorPoints
   - View updated once/day via batch job

3. **Microservices**
   - Separate reward service
   - Separate activity service
   - Separate badge service
   - Each can scale independently

4. **Time-Series Optimizations**
   ```
   // MongoDB time-series collection
   db.createCollection("activity", {
     timeseries: {
       timeField: "timestamp",
       metaField: "metadata",
       granularity: "hours"
     }
   })
   ```
   - Automatic compression and time-based partitioning
   - Queries 10-100x faster on large datasets

---

## Identified Issues & Technical Debt

### Critical Issues

#### 1. **Fire-and-Forget Points Award May Fail Silently**

**Location**: `donation.service.js::updateDonationStatus()`

```javascript
Request.findById(donation.requestId)
  .then(req => rewardService.onDonationCompleted(...))
  .catch(e => logger.error('Reward trigger error', ...));
```

**Problem:**
- If reward service throws an error, the donation is still marked complete
- Donor won't receive points, but donation appears successful
- Only logged; no retry mechanism
- Users may not notice for days

**Impact:** Medium (points loss, user dissatisfaction)

**Fix:**
```javascript
try {
  const req = await Request.findById(donation.requestId);
  const isEmergency = req?.urgency === 'critical';
  await rewardService.onDonationCompleted(donation.donorId, donation._id, isEmergency);
} catch (err) {
  logger.error('CRITICAL: Reward award failed', { donationId, error: err.message });
  // Option 1: Don't mark donation complete until reward succeeds
  // Option 2: Queue reward for retry, mark donation complete
  // Option 3: Send alert to admin
}
```

#### 2. **Badge Checking Never Awaited**

**Location**: `reward.service.js::onDonationCompleted()`

```javascript
checkAndUpdateBadges(donorId).catch((e) => logger.error('Badge check error', ...));
```

**Problem:**
- Badge updates happen asynchronously
- If database overloaded, badge updates delay by hours
- Donor doesn't see badge progress immediately
- Activity log for badge unlock may be timestamped much later

**Impact:** Low (eventual consistency issue, UX lag)

**Fix:**
```javascript
// Option 1: Make it awaited (blocks donation response)
await checkAndUpdateBadges(donorId);

// Option 2: Queue to external job processor
const queueBadgeCheck = async (donorId) => {
  await badgeCheckQueue.add({ donorId }, { priority: 'high' });
};
await queueBadgeCheck(donorId);

// Option 3: Implement badge check caching
```

#### 3. **Activity Timestamp Inconsistency**

**Problem:**
Activity created asynchronously after donation completes:
```
[T=0ms] Donation marked complete
[T=100ms] Activity logged
```

Donor's activity feed shows "Donation Completed" at T=100ms, but actually happened at T=0ms. For dense activity, this can cause timeline scrambling.

**Impact:** Low (UX confusion)

**Fix:**
Pass `timestamp` from donation to activity log:
```javascript
activityService.logActivity(donorId, {
  type: 'donation',
  action: 'completed_donation',
  timestamp: donation.completedDate,  // ← Use donation timestamp
  ...
});
```

---

### High-Priority Issues

#### 4. **Concurrent Donation Double-Tap Race Condition**

**Problem:**
Two doctors scan same QR token simultaneously:

```javascript
const appointment = await Appointment.findOne({ qrToken });
if (appointment.qrScannedAt) return error('QR already used');

// But if two requests reach here simultaneously before first updates:
appointment.status = 'completed';
appointment.qrScannedAt = new Date();
await appointment.save();  // ← Both succeed!
```

**Impact:** High (duplicate donations, duplicate points awarded)

**Fix:**
```javascript
const appointment = await Appointment.findOneAndUpdate(
  { qrToken, qrScannedAt: null },  // ← Only update if not yet scanned
  { 
    status: 'completed',
    qrScannedAt: new Date()
  },
  { returnDocument: 'after' }
);

if (!appointment) return error('QR already scanned');
```

#### 5. **No Idempotency on Reward Award**

**Problem:**
If client retries donation completion:
```
[Request 1] Mark donation complete → award points → return 200
[Request 2] (client retry) Mark donation complete → ??? → return 200
```

Second request will create a new Donation record (if endpoint allows) or update existing (if Donation has unique constraint).

**Current Dedup**: Only by referenceId in PointsTransaction, not by donation itself.

**Fix:**
- Add unique constraint on Donation: `{ donorId, appointmentId, status: 'completed' }`
- Ensure donation complete endpoint is idempotent

#### 6. **Missing Transaction Rollback Scenario**

**Problem:**
In `redeemReward()`, if session.withTransaction() fails after points deducted:

```javascript
await session.withTransaction(async () => {
  updatedAccount = await DonorPoints.findOneAndUpdate(
    { donorId, pointsBalance: { $gte: cost } },
    { $inc: { pointsBalance: -cost } }  // ← Deducted
  );

  redemption = await RewardRedemption.create([...]); // ← Fails

  // Transaction rolls back, DonorPoints restored
});
```

This works correctly (MongoDB handles rollback). But if error happens AFTER transaction:

```javascript
await session.withTransaction(async () { ... }); // ← Commits successfully

// Activity logging fails here (outside transaction)
activityService.logActivity(...).catch(err => ...);

Notification.create(...).catch(() => {}); // ← Silently fails
```

**Impact**: Medium (points deducted but activity/notification missing)

**Fix:**
Use event queue to ensure activity logging succeeds:
```javascript
await session.withTransaction(async () { ... });

// Don't fire-and-forget; queue for guaranteed processing
await activityQueue.add({ 
  type: 'reward_redeemed',
  donorId,
  redemption,
  timestamp: new Date()
});
```

#### 7. **No Audit Trail for Tier Promotion Logic**

**Problem:**
When tier promotes and bonus points awarded, no record of what triggered it:

```
PointsTransaction records:
  - BLOOD_DONATION: 200 points
  - (no explicit "TIER_PROMOTION" entry for the recalculation)
  - TIER_BONUS: 50 points (silver bonus)
```

Unclear if tier upgrade was automatic or manual. For compliance, need full trail.

**Fix:**
Log explicit TIER_PROMOTION transaction:
```javascript
if (tierChanged) {
  await PointsTransaction.create({
    donorId,
    pointsAmount: 0,  // No points for this record
    transactionType: 'TIER_PROMOTION',
    description: `Tier promoted: ${oldTier} → ${newTier}`,
    referenceId: `tier_promo_${donorId}_${oldTier}_${newTier}`,
    balanceAfter: account.pointsBalance
  });
}
```

---

### Medium-Priority Issues

#### 8. **Badge Points Reward Not Configurable Per Badge**

**Problem:**
Some badges have pointsReward: 0 (e.g., First Timer), others have 500 (e.g., Legend). If you wanted to change a reward post-deployment, you'd need to update PointsConfig and redeploy.

**Solution:**
Move badge pointsReward to Badge model (already done), but add endpoint to update badge rewards by admin without redeployment.

#### 9. **Leaderboard Doesn't Account for Tier Multipliers**

**Problem:**
Leaderboard shows `lifetimePointsEarned` equally for all tiers. Bronze and Platinum donors who earned 1000 points show equally high. But if tiers have multiplier benefits (e.g., silver gets +10% bonus), leaderboard should reflect this.

**Current**: Leaderboard is purely lifetime-based, not tier-adjusted. This is intentional (fairness), but undocumented.

**Solution:**
Add comment in code explaining leaderboard logic:
```javascript
// Leaderboard is ordered by raw lifetime points earned.
// Tier benefits (bonus multipliers) only apply to NEW donations,
// not retroactively to past points. This ensures fairness and simplicity.
```

---

### Low-Priority Issues

#### 10. **Inconsistent Error Handling**

**Problem:**
Some errors are logged, some thrown, some swallowed:

```javascript
// Logged but not thrown (fire-and-forget)
checkAndUpdateBadges(donorId).catch((e) => logger.error('Badge check error', ...));

// Thrown and propagated
if (!donor) throw new Error('Donor not found');

// Silently swallowed
Notification.create(...).catch(() => {});
```

**Solution:**
Standardize error handling:
- Critical errors: throw + log
- Side effects: queue or retry
- Non-critical: log only

---

## Recommendations

### Immediate Actions (Week 1)

1. **Fix Fire-and-Forget Reward Award**
   - Make reward service call awaited inside donation service
   - Add retry logic for transient failures
   - Priority: Critical

2. **Fix Concurrent QR Scan Double-Tap**
   - Use atomic update with uniqueness check on qrScannedAt
   - Priority: Critical

3. **Add Comprehensive Logging**
   - Log all points awards with context
   - Implement structured logging (JSON format)
   - Priority: High

### Short Term (Month 1)

4. **Implement Activity Deduplication Monitoring**
   - Track duplicate activity detection rates
   - Alert if >1% of activities are deduplicated (indicates bug)
   - Priority: Medium

5. **Add Admin Point Adjustment Caps**
   - Limit single adjustment to 10,000 points
   - Require email confirmation for >5,000 points
   - Log all adjustments with reason
   - Priority: High

6. **Implement Reward Redemption Audit Trail**
   - Log all redemption attempts (success and failure)
   - Track failure reasons (insufficient points, limit exceeded, etc.)
   - Priority: Medium

### Medium Term (Q2 2026)

7. **Migrate to Event-Driven Architecture**
   - Implement event bus (Kafka/RabbitMQ/Redis Streams)
   - Publish DonationCompleted events
   - Consume events in reward service, badge service, activity service
   - Benefits: Decoupling, horizontal scaling, auditability
   - Priority: High

8. **Implement Caching Layer**
   - Cache DonorPoints in Redis with 5-min TTL
   - Cache Badge definitions in memory
   - Cache Reward Catalog in memory
   - Reduces database load significantly
   - Priority: Medium

9. **Add Monitoring & Dashboards**
   - Track points awarded per day
   - Track badge unlock rates
   - Track reward redemption trends
   - Monitor for anomalies (e.g., sudden spike in emergency donations)
   - Priority: Medium

10. **Implement Scheduled Badge Recalculation**
    - Instead of on-demand, calculate badges in batch nightly
    - More predictable, avoids performance spikes
    - Can detect data inconsistencies
    - Priority: Low (nice-to-have)

---

## Production Readiness Assessment

### Overall Verdict: ⚠️ **PARTIALLY PRODUCTION-READY**

**Status**: Safe for production with **critical fixes required** before launch or scale.

### Readiness Scorecard

| Aspect | Score | Notes |
|--------|-------|-------|
| **Data Integrity** | 7/10 | Atomic transactions prevent overdrafts, but race conditions possible on concurrent writes |
| **Fault Tolerance** | 5/10 | Fire-and-forget logging may silently lose side effects; no retry mechanism |
| **Scalability** | 6/10 | Works fine up to 1M users; degradation at 5M+ users without optimizations |
| **Security** | 8/10 | Good safeguards against abuse; vulnerable if admin account compromised |
| **Auditability** | 7/10 | Immutable transaction log good, but activity timestamps inconsistent |
| **Monitoring** | 4/10 | Basic logging exists; no metrics/alerts for anomalies |
| **Documentation** | 6/10 | Code comments good, but no system architecture docs (until now) |
| **Error Handling** | 5/10 | Inconsistent patterns; silent failures in fire-and-forget code |
| **Testing** | ? | Unable to assess from code review alone |
| **Performance** | 7/10 | Good for current scale; query optimization needed for 2M+ users |

---

### Pre-Launch Checklist

- [ ] Fix fire-and-forget reward award (make awaited with retry)
- [ ] Fix concurrent QR scan race condition (atomic update)
- [ ] Implement comprehensive error logging and monitoring
- [ ] Add admin point adjustment caps and audit trail
- [ ] Document error scenarios and recovery procedures
- [ ] Test donation flow under concurrent load (1000+ simultaneous)
- [ ] Test reward redemption under concurrent load
- [ ] Validate deduplication logic under race conditions
- [ ] Set up alerts for anomalous points activity
- [ ] Create runbook for incident response (e.g., data inconsistency)

---

### Success Criteria for Production

1. **Zero points loss**: Every awarded point is accounted for in transaction log
2. **Zero duplicate awards**: Deduplication prevents duplicate points for same event
3. **Zero overdrafts**: Donors can never spend more points than they have
4. **<100ms latency**: P99 latency for points award <100ms
5. **99.9% availability**: Reward system stays up during normal operation
6. **Full auditability**: Every transaction logged with context and timestamp
7. **Graceful degradation**: If activity service fails, main flow continues
8. **Idempotency**: Retrying operations doesn't cause side effects

---

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Points awarded twice for same donation | Medium | High | Implement atomic QR scan update |
| Points lost due to fire-and-forget failure | Low | High | Queue reward processing, add retry |
| Database overload from activity logging | Low | Medium | Implement time-series collection, archiving |
| Tier promotion cascade loops | Very Low | Medium | Already prevented by threshold logic |
| Fraudulent admin adjustments | Low | Medium | Audit trail + email confirmation |
| Race condition on badge unlock | Medium | Low | Unique constraint prevents duplicates |
| Concurrent reward limit bypass | Low | Medium | Limit check inside transaction |

---

## Final Verdict

**The reward system is architecturally sound but has critical implementation gaps.**

### Strengths ✅
- Atomic transactions prevent overdrafts
- Deduplication prevents most double-awards
- Immutable transaction log enables auditability
- Tier system is elegant and fair
- Fire-and-forget pattern keeps main flow fast

### Weaknesses ❌
- Fire-and-forget reward award may silently fail
- No retry mechanism for transient failures
- Badge checking async causes eventual consistency
- Activity timestamps can become inconsistent
- No event-driven architecture; tight coupling
- Limited monitoring and alerting

### Must-Fix Before Scaling ⚠️
1. Make reward award synchronous or queue-backed
2. Fix concurrent QR scan race condition
3. Implement comprehensive error handling and monitoring
4. Add audit trail for all sensitive operations
5. Implement retry logic for critical paths

### Architecture Score: **7/10**
- Good for MVP/early stage
- Needs refactoring for enterprise scale (2M+ users)
- Eventual migration to event-driven recommended

---

**Generated by: System Architecture Review**  
**Date:** May 9, 2026  
**Status:** Ready for implementation planning
