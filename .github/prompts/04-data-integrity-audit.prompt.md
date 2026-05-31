# LifeLink Phase 04 - Data Integrity & Consistency Audit

**Date:** May 31, 2026  
**Phase:** 04 - Data Integrity & Consistency Analysis  
**Context:** Follows Phase 01 (API Inventory), Phase 02 (API Duplication), Phase 03 (Flow Audit)  
**Scope:** Database schema, entity relationships, referential integrity, data lifecycle, state consistency, uniqueness constraints, historical preservation  
**Status:** Analysis and Planning Phase (No modifications performed)

---

# Executive Summary

The LifeLink backend maintains **25 interconnected data models** spanning user management, blood request coordination, donation lifecycle, appointment scheduling, reward systems, and activity tracking. **Data integrity is generally robust**, with centralized state machines and immutable audit logs preventing most common corruption scenarios.

**Overall Data Integrity Health: GOOD** with **HIGH-PRIORITY consistency gaps** that can create orphaned records and data inconsistencies under specific failure scenarios.

**Critical Findings:**
- ✅ **Immutable audit trails** — PointsTransaction and AuditLog prevent accidental data mutation
- ✅ **Strong referential relationships** — Donations, Appointments, and Requests properly link to parent entities
- ✅ **Tier-based point calculations** — Stored alongside transaction logs for auditability
- ⚠️ **Weak cascade behavior** — Soft-deleted users leave orphaned records in multiple collections
- ⚠️ **Missing foreign key constraints** — MongoDB relationships are logical only, not enforced at DB level
- ⚠️ **Circular ownership ambiguities** — Hospital rejection workflow leaves donations in "accepted" state without re-matching
- ⚠️ **Activity deletion risks** — Activity records are auto-pruned after 365 days, creating audit gaps
- ⚠️ **Notification cleanup undefined** — No clear deletion policy for read notifications
- ⚠️ **Badge progress orphaning** — UserBadge records persist after badge deletion, creating invalid references
- ⚠️ **Appointment rescheduling inconsistencies** — Multiple appointments can reference the same request without conflict resolution
- 🔴 **Donation-Appointment decoupling** — Donation can exist without appointment; status mismatches can occur
- 🔴 **DonorPoints out-of-sync risk** — Balance tracking is separate from PointsTransaction log, vulnerable to reconciliation failures
- 🔴 **Request quantity tracking ambiguity** — Multiple donations can total beyond request requirement with no cap

**Severity Breakdown:**
- Critical (data loss, corruption, orphans): 3
- High (integrity gaps, state inconsistencies): 5
- Medium (unclear ownership, edge cases): 6
- Low (cosmetic, performance-related): 4

---

# Data Model Overview

## Model Inventory

| Model | Purpose | Ownership | Lifecycle | Soft-Delete | Key Relationships |
|-------|---------|-----------|-----------|-------------|-------------------|
| **User** | Base entity for all roles | Self | Created → Active → Suspended → Deleted | Yes (deletedAt) | Donor, Hospital, Admin discriminators |
| **Donor** | Donor-specific profile | User (donor role) | Inherits from User | Inherited | Donations, Appointments, DonorPoints |
| **Hospital** | Hospital-specific profile | User (hospital role) | Inherits from User | Inherited | Requests, Appointments, Donations |
| **Request** | Blood request posting | Hospital | Pending → Accepted → In-Progress → Completed/Cancelled | No | Donations (1:many), Hospital (N:1) |
| **Donation** | Donor acceptance of request | System | Pending → Scheduled → Completed/Cancelled/Rejected | No | Donor (N:1), Request (N:1), Appointment (0:1) |
| **Appointment** | Donation appointment | System | Pending → Confirmed → Completed/Cancelled | No | Donor (N:1), Hospital (N:1), Request (0:1), Donation (0:1) |
| **DonorPoints** | Points balance snapshot | Donor | Created → Updated | No | Donor (1:1) |
| **PointsTransaction** | Immutable points event | System | Immutable append-only | No | Donor (N:1), RewardRedemption (0:1) |
| **Badge** | Static badge definition | Admin | Created → Active/Archived | No | UserBadge (1:many) |
| **UserBadge** | Donor badge progress | System | Created → Locked/Unlocked | No | Donor (N:1), Badge (N:1) |
| **RewardCatalog** | Reward definition | Admin | Created → Active/Archived | No | RewardRedemption (1:many) |
| **RewardRedemption** | Reward redemption record | System | PENDING → CONFIRMED → DELIVERED/EXPIRED/CANCELLED | No | Donor (N:1), RewardCatalog (N:1) |
| **Activity** | User event log | System | Append-only, TTL auto-prune after 365d | No | Donor/Hospital (N:1), various referenceIds |
| **Notification** | Push/in-app notification | System | Created → Read/Unread | No | User (N:1), various relatedIds |
| **AuditLog** | Admin action log | System | Immutable append-only | No | Admin User (N:1), various targetIds |
| **Appointment** | Donation scheduling | System | Pending → Confirmed → Completed/Cancelled | No | Donor, Hospital, Request, Donation |

---

# Entity Relationship Analysis

## Core Entity Relationships

### 1. User → Donor/Hospital/Admin Hierarchy

**Purpose:** Role-based polymorphic user system using Mongoose discriminators.

**Relationships:**
```
User (base)
├── Donor (discriminator: 'donor')
│   ├── oneToMany: Donation (User._id → Donation.donorId)
│   ├── oneToMany: Appointment (User._id → Appointment.donorId)
│   ├── oneToOne: DonorPoints (User._id ↔ DonorPoints.donorId)
│   ├── oneToMany: UserBadge (User._id → UserBadge.donorId)
│   └── oneToMany: RewardRedemption (User._id → RewardRedemption.donorId)
├── Hospital (discriminator: 'hospital')
│   ├── oneToMany: Request (User._id → Request.hospitalId)
│   └── oneToMany: Appointment (User._id → Appointment.hospitalId)
└── Admin/Superadmin (discriminator: 'admin')
    └── oneToMany: AuditLog (User._id → AuditLog.adminId)
```

**Dependencies:**
- Donor existence depends on valid User with role='donor'
- Hospital existence depends on valid User with role='hospital'
- Soft-deleted users (deletedAt != null) should cascade logic to dependent entities

**Ownership Rules:**
- ✅ User owns Donor/Hospital profile via discriminator
- ⚠️ No cascade enforcement — deleting User does NOT delete Donor/Hospital profiles
- ⚠️ Soft-deleted User records leave active dependent records (Donations, Appointments, etc.)

---

### 2. Request → Donation → Appointment Pipeline

**Purpose:** End-to-end blood request fulfillment: Hospital posts request → Donors respond → Appointments scheduled → Donations completed.

**Relationships:**
```
Request (posted by Hospital)
├── 1:N Donation
│   ├── Each Donation references Request._id
│   ├── Each Donation references Donor._id (who accepted)
│   └── 0:1 Appointment (optional — donation can exist without appointment)
└── 1:N Appointment
    ├── Each Appointment references Request._id (may be null)
    ├── Each Appointment references Donor._id
    ├── Each Appointment references Hospital._id
    └── 0:1 Donation (may be null)
```

**Dependencies:**
- Donation requires valid Request._id (no soft-delete on Request)
- Donation requires valid Donor._id
- Appointment requires valid Donor._id and Hospital._id
- Appointment.requestId may be null for standalone appointments

**Ownership Rules:**
- ✅ Hospital owns Request
- ⚠️ Unclear: Does Donation ownership belong to Donor or Request?
- ⚠️ Unclear: Who owns Appointment — Donor, Hospital, or System?

---

### 3. Donation ↔ Appointment Bidirectional Relationship

**Purpose:** Link donation completion to appointment records; track QR verification and donation completion.

**Relationships:**
```
Donation (what donor gives)
└── 0:1 Appointment (optional — donation can exist without appointment)
    ├── donorId (same as Donation.donorId)
    ├── requestId (same as Donation.requestId)
    ├── status: ['pending', 'confirmed', 'completed', 'cancelled']
    └── Appointment.qrToken (unique token for donation verification)

Appointment (when donation happens)
└── 0:1 Donation (optional — appointment can exist without donation)
```

**Dependencies:**
- Donation.appointmentId → Appointment._id (optional)
- Appointment.status != 'cancelled' does NOT prevent Donation cancellation
- Donation.status changes are not synchronized with Appointment.status changes

**Ownership Rules:**
- ⚠️ **CRITICAL**: Donation can have status='completed' while Appointment.status='pending'
- ⚠️ **CRITICAL**: Appointment can be cancelled while Donation remains 'scheduled'
- ⚠️ No transaction wraps Donation + Appointment status updates

---

### 4. Request → DonationQty Fulfillment

**Purpose:** Track how many units Hospital needs vs. how many Donors have pledged.

**Relationships:**
```
Request (needs X units)
├── Request.unitsNeeded: number (target quantity)
├── Request.status: tracks overall progress
└── 1:N Donation (all pledges for this request)
    └── Each Donation.quantity (units this donor pledges)

Fulfillment Validation:
- Sum(Donation.quantity where status in ['pending', 'scheduled', 'completed'])
- Can exceed Request.unitsNeeded with no error
```

**Dependencies:**
- No hard cap on total pledged quantities
- No validation preventing multiple donors from oversatisfying request
- No rejection of "excess" donations

**Ownership Rules:**
- ⚠️ **HIGH**: System allows Request to be "over-fulfilled" without explicit acceptance/rejection logic
- ⚠️ **HIGH**: Unclear when Hospital should reject "excess" donations

---

### 5. DonorPoints ↔ PointsTransaction Dual Tracking

**Purpose:** Maintain both real-time balance (DonorPoints.pointsBalance) and immutable audit log (PointsTransaction).

**Relationships:**
```
DonorPoints (snapshot balance)
├── donorId: ObjectId (unique index)
├── pointsBalance: number (current spendable)
├── lifetimePointsEarned: number (cumulative)
└── tier: enum ['bronze', 'silver', 'gold', 'platinum']

PointsTransaction (append-only audit log)
├── donorId: ObjectId
├── pointsAmount: number (±value)
├── transactionType: enum (BLOOD_DONATION, PLASMA_DONATION, REWARD_REDEEMED, etc.)
├── balanceAfter: number (snapshot after transaction)
└── referenceId: string (deduplication key)
```

**Dependencies:**
- PointsTransaction is source of truth; DonorPoints is derived cache
- DonorPoints.pointsBalance = Sum(PointsTransaction.pointsAmount) for that donor
- No atomic constraint between Donation completion → PointsTransaction creation → DonorPoints increment

**Ownership Rules:**
- ✅ PointsTransaction records are immutable (strict: true on schema)
- ⚠️ **CRITICAL**: DonorPoints can drift from PointsTransaction sum if:
  - Donation completion fails mid-transaction
  - PointsTransaction created but DonorPoints.increment() fails
  - No reconciliation process exists

---

### 6. UserBadge → Badge Referential Integrity

**Purpose:** Track donor progress toward and unlocking of static badges.

**Relationships:**
```
Badge (static seed data)
├── badgeId: ObjectId
├── unlockCondition: enum (completedDonations, emergencyResponses)
├── unlockThreshold: number
└── 1:N UserBadge (donor progress records)

UserBadge (dynamic progress)
├── donorId: ObjectId
├── badgeId: ObjectId (FK to Badge)
├── unlockStatus: enum ['LOCKED', 'UNLOCKED']
├── progressCurrent: number
└── unlockedAt: Date
```

**Dependencies:**
- UserBadge.badgeId MUST reference valid Badge
- No cascade delete: If Badge is deleted, UserBadge records orphaned

**Ownership Rules:**
- ⚠️ **HIGH**: Badge deletion leaves orphaned UserBadge records with invalid badgeId
- ⚠️ **HIGH**: No archive/soft-delete on Badge to preserve historical progress

---

### 7. RewardRedemption Lifecycle Tracking

**Purpose:** Record each reward redemption with confirmation code and delivery status.

**Relationships:**
```
RewardRedemption (redemption event)
├── donorId: ObjectId (FK to Donor)
├── rewardId: ObjectId (FK to RewardCatalog)
├── pointsSpent: number (at time of redemption)
├── confirmationCode: string (unique)
├── status: enum ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'EXPIRED']
└── expiresAt: Date (default +30 days)

PointsTransaction (corresponding debit)
├── donorId: ObjectId
├── pointsAmount: negative number
├── transactionType: 'REWARD_REDEEMED'
├── referenceId: string (links to RewardRedemption._id for dedup)
└── balanceAfter: number
```

**Dependencies:**
- RewardRedemption.rewardId must reference valid RewardCatalog item
- PointsTransaction with referenceId=RewardRedemption._id must exist
- No cascade if RewardCatalog item is deleted

**Ownership Rules:**
- ⚠️ **HIGH**: If RewardCatalog item deleted, RewardRedemption orphaned
- ⚠️ **MEDIUM**: Expiration logic (expiresAt) not validated on read; expired redemptions may be processed

---

## Missing Relationships

| Gap | Impact | Severity |
|-----|--------|----------|
| No explicit FK constraint from Donation.appointmentId → Appointment | Orphaned donations possible if appointment deleted | HIGH |
| No constraint from Appointment.requestId → Request | Orphaned appointments if request cancelled | HIGH |
| No constraint from UserBadge.badgeId → Badge | Orphaned progress records after badge deletion | MEDIUM |
| No constraint from RewardRedemption.rewardId → RewardCatalog | Orphaned redemptions if catalog item deleted | MEDIUM |
| No constraint linking Activity.referenceId to actual entity | Broken deep-links if entity deleted | MEDIUM |
| No constraint from Notification.relatedId to entity | Broken notifications if entity deleted | LOW |

---

# Referential Integrity Review

## Weak Relationships Analysis

### Issue 1: Donation Without Appointment

**Scenario:** Donation can exist with appointmentId=null, creating ambiguity about when/if fulfillment occurs.

**Data Path:**
```
Request.status = 'pending'
├── Donation (accepted by donor, appointmentId=null)
│   └── status = 'pending' (no appointment scheduled)
└── Hospital cannot track fulfillment readiness
```

**Orphan Risk:** MEDIUM
- Donation pending indefinitely without appointment date
- Hospital cannot verify when blood will be donated
- No automated cleanup for stale pending donations

**Evidence:**
```javascript
// Donation.model.js
appointmentId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Appointment',
  default: null,  // ← Allows donation without appointment
}
```

**Question:** When appointmentId=null, is donation still active? What triggers appointment creation?

---

### Issue 2: Appointment Without Donation Link

**Scenario:** Appointment can exist with no corresponding Donation record (donation line-item created later or never).

**Data Path:**
```
Appointment (confirmed)
├── status = 'confirmed'
├── donationId = null (no donation record yet)
└── Hospital verifies appointment but donation not in system
```

**Orphan Risk:** HIGH
- Appointment confirmed but no donation record to track blood collection
- Hospital has no way to record donation details (hemoglobin, units collected, etc.)
- Activity logs may reference appointment but not donation

**Evidence:**
```javascript
// Appointment.model.js
// No field linking to Donation
// Only Donation.appointmentId references Appointment
```

**Question:** Can appointment exist without donation? What's the flow?

---

### Issue 3: Hospital Deletion Leaves Orphaned Requests/Appointments

**Scenario:** Hospital user soft-deleted; all associated Requests and Appointments become owned by ghost Hospital.

**Data Path:**
```
Hospital User (deletedAt = <date>)
├── Request (hospitalId → deleted User._id)
│   └── Now inaccessible through normal Hospital queries
└── Appointment (hospitalId → deleted User._id)
    └── Donor still sees appointment but Hospital is "deleted"
```

**Orphan Risk:** CRITICAL
- Request.hospitalId references soft-deleted User
- Queries filtering on hospitalId=X will skip these records
- Mobile apps cannot display requests from "deleted" hospitals
- No clear re-assignment logic

**Evidence:**
```javascript
// Request.model.js
hospitalId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',  // Can soft-delete
  required: true,
}

// When Hospital user is soft-deleted:
// User.deletedAt = <date>
// Request.hospitalId still points to that deleted User
```

**Question:** Should soft-deleted hospitals cascade to cancel/reassign pending requests?

---

### Issue 4: Donor Deletion Leaves Orphaned Donations/Appointments

**Scenario:** Donor user soft-deleted; all Donations and Appointments remain in system with orphaned donorId.

**Data Path:**
```
Donor User (deletedAt = <date>)
├── Donation (donorId → deleted User._id)
│   ├── status = 'scheduled' (awaiting fulfillment from deleted donor)
│   └── Hospital waiting for donation from ghost donor
└── Appointment (donorId → deleted User._id)
    ├── status = 'confirmed'
    └── Donor can no longer access for rescheduling
```

**Orphan Risk:** CRITICAL
- Hospital has appointment for deleted donor
- No way to re-match or reschedule
- DonorPoints, UserBadge, Activity records orphaned by FK

**Evidence:**
```javascript
// User.model.js — soft delete
deletedAt: { type: Date, default: null }

// When Donor deleted:
// User.deletedAt = <date>
// Donation.donorId still points to deleted user
// DonorPoints.donorId still points to deleted user
```

**Question:** Should donor deletion cascade-cancel pending donations and appointments?

---

### Issue 5: Request Status vs. Donation Status Mismatch

**Scenario:** Request marked 'completed' but associated Donations still 'pending' or 'cancelled'.

**Data Path:**
```
Request (status = 'completed')
├── Donation #1 (status = 'completed') ✓
├── Donation #2 (status = 'pending') ✗ Mismatch!
└── Donation #3 (status = 'cancelled') ✗ Mismatch!
```

**Consistency Risk:** HIGH
- Request closure logic doesn't validate all donations are in terminal state
- Hospital may report "fulfilled" but donor obligations remain

**Evidence:**
- No transaction wrapping Request.status change + Donation.status validation
- Request lifecycle service updates Request without checking Donation substates

**Question:** What validation prevents request completion if donations are pending?

---

### Issue 6: Badge Deletion Leaves UserBadge Orphans

**Scenario:** Badge marked inactive; UserBadge records still reference it.

**Data Path:**
```
Badge (deleted or archived)
└── UserBadge (badgeId → orphaned Badge._id)
    ├── donorId = XXX
    ├── badgeId = YYY (deleted badge)
    ├── unlockStatus = 'UNLOCKED'
    └── progressCurrent = 10
```

**Orphan Risk:** MEDIUM
- Donors' badge progress references non-existent badge
- Mobile app shows badge with missing metadata
- Badge leaderboard queries may fail

**Evidence:**
```javascript
// Badge.model.js — no soft-delete
// Deletion is hard-delete, no archival

// UserBadge.model.js
badgeId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Badge',
  required: true,
  // No cascade delete or cleanup
}
```

**Question:** Should badges be soft-deleted or archived instead of hard-deleted?

---

### Issue 7: Notification Foreign Key Orphaning

**Scenario:** User deleted; Notifications still reference deleted user.

**Data Path:**
```
User (deleted)
└── Notification (userId → deleted User._id)
    ├── Notification cannot be delivered to user
    ├── User query with userId filter skips this
    └── Orphaned notification pollutes collection
```

**Orphan Risk:** LOW (cleanup-able)
- Notifications not mission-critical after delivery
- But collection grows with orphaned records
- Query performance degrades with orphaned docs

**Evidence:**
```javascript
// Notification.model.js
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true,
}
// No cascade delete
```

**Question:** Should orphaned notifications be auto-deleted when user deleted?

---

## Summary: Referential Integrity Risks

| Relationship | Constraint | Risk | Severity |
|---|---|---|---|
| Donation → Appointment | Optional (default: null) | Ambiguous fulfillment timing | HIGH |
| Appointment → Donation | No link | Can exist without donation | HIGH |
| Request → Hospital | Optional soft-delete | Orphaned requests if hospital deleted | CRITICAL |
| Donation → Donor | Optional soft-delete | Orphaned donations if donor deleted | CRITICAL |
| UserBadge → Badge | No cascade | Orphaned progress if badge deleted | MEDIUM |
| RewardRedemption → RewardCatalog | No cascade | Orphaned redemptions if catalog deleted | MEDIUM |
| Activity → Entity | Via referenceId | Broken deep-links if entity deleted | MEDIUM |
| Notification → User | Optional soft-delete | Orphaned notifications if user deleted | LOW |

---

# Record Lifecycle Review

## Creation Phase

### Donation Creation

**Trigger:** Donor accepts Request via `POST /donor/requests/{id}/accept`

**Process:**
```
1. Validate Donor eligibility (age, health, last donation, deferral status)
2. Create Donation (donorId, requestId, status='pending', appointmentId=null)
3. Create Activity log entry (action='donation_accepted')
4. Send Notification to Hospital
5. Return Donation record to donor
```

**Consistency Check:**
- ✅ Donor validation prevents ineligible donations
- ✅ Request validated as 'pending' before accepting
- ⚠️ **ISSUE**: Appointment NOT created automatically
  - Donor has donation but no scheduled appointment
  - Hospital cannot see when blood will be collected

**Data State After:**
```
Donation {
  donorId: <valid>,
  requestId: <valid>,
  status: 'pending',
  appointmentId: null,  // ← Problematic
  createdAt: <now>
}

Activity {
  userId: <donorId>,
  type: 'donation',
  action: 'accepted',
  referenceId: <donationId>
}

Request {
  status: 'pending' (unchanged),
  // Donation count increments but no state change
}
```

---

### Appointment Creation

**Trigger:** Donor schedules appointment via `POST /appointments` or `POST /donations/schedule-appointment`

**Process:**
```
1. Validate Donor can attend (not deferred, health checks pass)
2. Validate Hospital availability
3. Create Appointment (donorId, hospitalId, requestId, status='pending', qrToken)
4. Link to existing Donation if appointmentId provided
5. Generate QR token for verification
6. Send Notification to donor and hospital
```

**Consistency Check:**
- ✅ QR token generated uniquely per appointment
- ⚠️ **ISSUE**: Appointment can exist without Donation
  - Mobile app allows scheduling without accepting request
  - Hospital sees appointment but no donation record

**Data State After:**
```
Appointment {
  donorId: <valid>,
  hospitalId: <valid>,
  requestId: <may be null>,
  status: 'pending',
  qrToken: '<unique>',
  qrExpiresAt: <now + 2h>
}

// Donation NOT automatically updated
Donation {
  appointmentId: null  // Not linked!
}
```

---

### DonorPoints Creation

**Trigger:** First Donation completion or profile signup

**Process:**
```
1. Donor completes blood donation
2. Hospital marks Donation.status = 'completed' via PATCH /donations/{id}/complete
3. Reward service calculates points earned
4. Create PointsTransaction (donorId, pointsAmount, type, referenceId)
5. Increment DonorPoints.pointsBalance += pointsAmount
6. Increment DonorPoints.lifetimePointsEarned += pointsAmount
7. Calculate new tier from lifetimePointsEarned
8. Update DonorPoints.tier
9. Create Activity log entry
10. Award badge if applicable
```

**Consistency Check:**
- ✅ Points immutably logged in PointsTransaction
- ⚠️ **ISSUE**: No atomic transaction wraps steps 4-8
  - If step 6 fails, PointsTransaction exists but balance unchanged
  - No rollback mechanism

**Data State After:**
```
PointsTransaction {
  donorId: <valid>,
  pointsAmount: 100,
  transactionType: 'BLOOD_DONATION',
  referenceId: '<donationId>',
  balanceAfter: 100,
  createdAt: <now>
}

DonorPoints {
  pointsBalance: 100,
  lifetimePointsEarned: 100,
  tier: 'bronze'
}

Activity {
  userId: <donorId>,
  type: 'reward',
  action: 'points_earned',
  referenceId: '<transactionId>'
}
```

---

## Update Phase

### Donation Status Transition: pending → scheduled

**Trigger:** Appointment created and confirmed

**Process:**
```
1. Validate Donation exists and status='pending'
2. Update Donation.status = 'scheduled'
3. Update Donation.appointmentId = <appointmentId>
4. Update Appointment.status = 'confirmed'
5. Create Activity log (action='donation_scheduled')
6. Send notification to Hospital
```

**Consistency Check:**
- ⚠️ **ISSUE**: No transaction wrapping Donation + Appointment updates
  - If Donation update fails, Appointment already confirmed
  - States diverge

**Data State After:**
```
Donation {
  status: 'scheduled',
  appointmentId: <valid>,
  scheduledDate: <appointmentDate>
}

Appointment {
  status: 'confirmed',
  qrToken: '<active>'
}

Activity {
  action: 'donation_scheduled'
}
```

---

### Donation Status Transition: scheduled → completed

**Trigger:** Hospital scans QR token and marks donation complete

**Process:**
```
1. Validate Appointment.qrToken matches provided token
2. Validate Appointment.qrScannedAt is null (not already completed)
3. Create Donation (or PATCH if exists):
   - status = 'completed'
   - completedDate = <now>
   - unitsCollected, hemoglobinLevel, weight from hospital input
   - verifiedAt = <now>
4. Update Appointment:
   - status = 'completed'
   - qrScannedAt = <now>
5. Trigger reward service:
   - Calculate points for BLOOD_DONATION
   - Create PointsTransaction
   - Increment DonorPoints
6. Create Activity log
7. Check if Request.quantity now satisfied
8. Update Request.status if fulfilled
```

**Consistency Check:**
- ✅ QR token prevents double-completion
- ⚠️ **ISSUE**: Multiple donations can fulfill same request without explicit cap
  - No validation: Sum(completedDonations) cannot exceed Request.unitsNeeded
  - Hospital may over-accept donations

**Data State After:**
```
Donation {
  status: 'completed',
  completedDate: <now>,
  unitsCollected: 1,
  verifiedAt: <now>
}

Appointment {
  status: 'completed',
  qrScannedAt: <now>
}

PointsTransaction {
  pointsAmount: 100,
  referenceId: '<donationId>'
}

DonorPoints {
  pointsBalance: 100,
  lifetimePointsEarned: 100
}

Request {
  status: 'completed' (if threshold met)
}
```

---

### Request Status Transition: pending → completed

**Trigger:** Hospital confirms sufficient donations collected

**Process:**
```
1. Validate Request exists and status='pending'
2. Query all Donations where requestId=X and status='completed'
3. Sum unitsCollected from all donations
4. If sum >= Request.unitsNeeded:
   - Update Request.status = 'completed'
   - Create Activity log (action='request_completed')
   - Send Notification to all accepted donors
5. Else:
   - Reject with error
```

**Consistency Check:**
- ⚠️ **ISSUE**: No validation that accepted-but-uncompleted donations are cancelled
  - Request marked complete but Donation still 'pending'/'scheduled'
  - Donor left in limbo — donation neither confirmed nor rejected

**Data State After:**
```
Request {
  status: 'completed',
  updatedAt: <now>
}

// Donations in various states
Donation #1 { status: 'completed' }
Donation #2 { status: 'scheduled' } ← Mismatch!
Donation #3 { status: 'pending' } ← Mismatch!

// Activity does not reflect partial fulfillment
Activity {
  action: 'request_completed'
  // No mention of unfulfilled donations
}
```

---

## Deletion Phase

### Soft-Delete: User (Donor)

**Trigger:** Admin marks donor as soft-deleted

**Process:**
```
1. Update User.deletedAt = <now>
2. Update User.isSuspended = true
3. Invalidate all FCM tokens for this user
4. Query all dependent entities:
   - Donation (where donorId=X)
   - Appointment (where donorId=X)
   - DonorPoints (where donorId=X)
   - UserBadge (where donorId=X)
   - RewardRedemption (where donorId=X)
   - Activity (where userId=X)
   - Notification (where userId=X)
5. → No automatic cleanup or cascading!
6. Create AuditLog entry (action='user.suspend')
```

**Consistency Check:**
- 🔴 **CRITICAL**: No cascade — orphaned records remain
- 🔴 **CRITICAL**: Scheduled donations still reference deleted donor
  - Hospital awaits donation from non-existent donor
  - No re-matching or cancellation

**Data State After Deletion:**
```
User {
  deletedAt: <date>,
  isSuspended: true,
  fcmTokens: []
}

Donation {
  donorId: <orphaned User._id>,
  status: 'scheduled' (unchanged)
  // Orphaned! Cannot be fulfilled
}

Appointment {
  donorId: <orphaned User._id>,
  status: 'confirmed' (unchanged)
  // Orphaned! Cannot be rescheduled
}

DonorPoints {
  donorId: <orphaned User._id>
  // Orphaned but not cleaned
}

Activity {
  userId: <orphaned User._id>
  // Orphaned, lost after 365d TTL anyway
}
```

**Orphan Cascade:**
- ❌ Donation status NOT updated to 'cancelled'
- ❌ Appointment status NOT updated to 'cancelled'
- ❌ Hospital NOT notified of cancellation
- ❌ Request status NOT adjusted (may remain 'pending' waiting for orphaned donation)
- ❌ DonorPoints NOT archived or purged
- ❌ UserBadge NOT cleaned

---

### Soft-Delete: User (Hospital)

**Trigger:** Admin marks hospital as soft-deleted

**Process:**
```
1. Update User.deletedAt = <now>
2. Update User.isSuspended = true
3. Query dependent entities:
   - Request (where hospitalId=X)
   - Appointment (where hospitalId=X)
4. → No automatic cleanup or cascading!
5. Create AuditLog entry
```

**Consistency Check:**
- 🔴 **CRITICAL**: Orphaned Requests remain 'pending'
  - Donors still see hospital requests
  - But hospital is "deleted"
  - No re-posting from active hospital

**Data State After Deletion:**
```
User {
  deletedAt: <date>,
  isSuspended: true
}

Request {
  hospitalId: <orphaned User._id>,
  status: 'pending'
  // Orphaned! Donors cannot accept from deleted hospital
}

Appointment {
  hospitalId: <orphaned User._id>,
  status: 'confirmed'
  // Orphaned! Hospital staff cannot verify
}
```

---

### Hard-Delete: Badge

**Trigger:** Admin removes badge from system

**Process:**
```
1. Delete Badge record (hard delete)
2. Query UserBadge where badgeId=<deleted badge>
3. → No automatic cleanup or archival!
4. AuditLog entry created
```

**Consistency Check:**
- 🔴 **CRITICAL**: UserBadge orphaned
  - Donors still have progress toward deleted badge
  - Leaderboard queries may fail
  - Mobile app shows badge with missing metadata

**Data State After Deletion:**
```
Badge {
  _id: <deleted>,
  // Removed from collection
}

UserBadge {
  badgeId: <orphaned badge._id>,
  unlockStatus: 'UNLOCKED',
  progressCurrent: 5
  // Orphaned reference!
}

Activity {
  action: 'badge_unlocked',
  referenceId: '<orphaned badge._id>'
  // Broken reference
}
```

---

## Archival Phase: Activity Auto-Pruning

**Policy:** Activity records auto-deleted after 365 days via MongoDB TTL index

**Process:**
```javascript
// Activity index
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
```

**Consistency Check:**
- 🔴 **CRITICAL**: Historical audit trail lost after 1 year
  - Cannot reconstruct donation history beyond 365 days
  - Tax/compliance records may be affected
  - No archival to cold storage

**Data State After Expiry:**
```
// After 365 days
Activity {
  // Auto-removed by MongoDB TTL
}

// Original Activity lost forever
// But PointsTransaction still exists (no TTL)
// Audit gap: Activity history incomplete
```

**Question:** Should Activity records archive to cold storage instead of delete?

---

# Uniqueness Analysis

## Constraint Review

### 1. User.email (Unique per role + db)

**Constraint:** `{ email: 1, role: 1 }` unique index

**Scenario:** Can two donors share email? Can donor + hospital share email?

```
// Valid
User #1 { email: 'alice@example.com', role: 'donor' }
User #2 { email: 'alice@example.com', role: 'hospital' } ← Different role

// Valid
User #3 { email: 'bob@example.com', role: 'donor' }
User #4 { email: 'bob@example.com', role: 'admin' } ← Different role
```

**Uniqueness Guarantee:** ✅ Enforced at DB level

**Questions:**
- Should same person hold multiple roles? (Donor + Hospital + Admin)
- Current design allows; clarify if intended

---

### 2. Donor.phoneNumber (Unique per donor)

**Constraint:** No unique index on Donor.phoneNumber

**Scenario:** Multiple donors with same phone?

```
// Possible
Donor #1 { phoneNumber: '201001234567' }
Donor #2 { phoneNumber: '201001234567' } ← Duplicate allowed
```

**Uniqueness Guarantee:** ❌ NOT enforced

**Risk:** HIGH
- Duplicate registrations
- Phone verification SMS sent to multiple accounts
- OTP received by wrong account
- Donor confusion during eligibility checks

**Evidence:**
```javascript
// Donor.model.js
phoneNumber: {
  type: String,
  required: true,
  validate: { validator: /^[0-9]{11}$/ },
  // No unique: true
}
```

**Recommendation:** Add unique index on phoneNumber (with sparse: true for optional cases)

---

### 3. DonorPoints.donorId (Unique)

**Constraint:** `{ donorId: 1 }` unique index

**Scenario:** Multiple DonorPoints records per donor?

```
// Only one allowed
DonorPoints #1 { donorId: '...' }
DonorPoints #2 { donorId: '...' } ← Would violate unique
```

**Uniqueness Guarantee:** ✅ Enforced at DB level

**Status:** OK

---

### 4. UserBadge (Donor, Badge) Pair

**Constraint:** `{ donorId: 1, badgeId: 1 }` unique index

**Scenario:** Duplicate badge progress?

```
// Only one allowed
UserBadge #1 { donorId: 'X', badgeId: 'Y' }
UserBadge #2 { donorId: 'X', badgeId: 'Y' } ← Would violate unique
```

**Uniqueness Guarantee:** ✅ Enforced at DB level

**Status:** OK

---

### 5. PointsTransaction.referenceId (Deduplication)

**Constraint:** No unique index on referenceId alone

**Scenario:** Duplicate points awarded?

```
// Could both exist
PointsTransaction #1 {
  referenceId: 'donation-ABC',
  pointsAmount: 100,
  transactionType: 'BLOOD_DONATION'
}

PointsTransaction #2 {
  referenceId: 'donation-ABC',
  pointsAmount: 100,
  transactionType: 'BLOOD_DONATION'
} ← Duplicate allowed!
```

**Uniqueness Guarantee:** ❌ NOT enforced

**Risk:** CRITICAL
- Points awarded twice for same donation
- DonorPoints balance inflated
- PointsTransaction audit log duplicates

**Evidence:**
```javascript
// PointsTransaction.model.js
referenceId: {
  type: String,
  default: null,
  // No unique constraint
}

// Deduplication via application logic only
```

**Question:** Is referenceId intended as deduplication key? If yes, add unique index.

---

### 6. RewardRedemption.confirmationCode (Unique)

**Constraint:** `{ confirmationCode: 1 }` unique index

**Scenario:** Duplicate confirmation codes?

```
// Only one allowed
RewardRedemption #1 { confirmationCode: 'RWD-2026-ABC123' }
RewardRedemption #2 { confirmationCode: 'RWD-2026-ABC123' } ← Would violate
```

**Uniqueness Guarantee:** ✅ Enforced at DB level

**Status:** OK

**Note:** Code generated via `crypto.randomBytes(3).toString('hex')` — collision risk extremely low

---

### 7. Appointment.qrToken (Unique)

**Constraint:** `{ qrToken: 1 }` unique, sparse index

**Scenario:** Duplicate QR tokens?

```
// Only one active allowed
Appointment #1 { qrToken: '<token>', status: 'confirmed' }
Appointment #2 { qrToken: '<token>', status: 'confirmed' } ← Would violate
```

**Uniqueness Guarantee:** ✅ Enforced at DB level (sparse allows null)

**Status:** OK

---

### 8. Badge.badgeName (Unique)

**Constraint:** `{ badgeName: 1 }` unique index

**Scenario:** Duplicate badge definitions?

```
// Only one allowed
Badge #1 { badgeName: 'First Donation' }
Badge #2 { badgeName: 'First Donation' } ← Would violate
```

**Uniqueness Guarantee:** ✅ Enforced at DB level

**Status:** OK

---

### 9. Hospital.hospitalId (Unique)

**Constraint:** `{ hospitalId: 1 }` unique, indexed

**Scenario:** Duplicate hospital IDs?

```
// Only one allowed
Hospital #1 { hospitalId: 'HOSP-001' }
Hospital #2 { hospitalId: 'HOSP-001' } ← Unique enforced
```

**Uniqueness Guarantee:** ✅ Enforced at DB level

**Status:** OK

---

## Summary: Uniqueness Risks

| Field | Constraint | Gap | Severity |
|-------|-----------|-----|----------|
| Donor.phoneNumber | None | Duplicate registrations | HIGH |
| PointsTransaction.referenceId | None (app logic only) | Duplicate point awards | CRITICAL |
| Donation (donor, request) | None | Multiple donations per donor per request | MEDIUM |
| Appointment (donor, request, date) | None | Multiple appointments same donor/request | MEDIUM |
| Notification (user, type, referenceId) | None | Duplicate notifications | LOW |

---

# State Consistency Review

## State Machine Definitions

### Donation State Machine

```
States: ['pending', 'scheduled', 'completed', 'cancelled', 'rejected']

Valid Transitions:
  pending ──→ scheduled   (appointment confirmed)
  pending ──→ cancelled   (donor or hospital cancels)
  pending ──→ rejected    (hospital rejects medical eval)
  scheduled ──→ completed (hospital marks complete, scans QR)
  scheduled ──→ cancelled (rescheduling cancelled)
  pending/scheduled ──→ rejected (medical evaluation fails)
```

**State Rules:**
- ✅ State machine centralized in `state-machine.js`
- ✅ Transitions validated before state change
- ⚠️ **ISSUE**: No automatic state progression
  - Donation stuck in 'pending' indefinitely if appointment never created
  - No timeout/expiration logic

**Inconsistency Scenarios:**
```
# Scenario 1: Donation pending longer than appointment TTL
Donation {
  status: 'pending',
  appointmentId: null,
  createdAt: 7 days ago
}
Appointment { /* None exists */ }
# Unclear: Is this abandoned or in-progress?

# Scenario 2: Appointment cancelled but donation still scheduled
Donation {
  status: 'scheduled',
  appointmentId: <orphaned>
}
Appointment {
  status: 'cancelled',
  cancelledAt: <now>
}
# Donor still owes blood; appointment cancelled
```

---

### Request State Machine

```
States: ['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'expired']

Valid Transitions:
  pending ──→ in-progress (first donation received)
  pending ──→ expired    (deadline passed)
  in-progress ──→ completed (quantity threshold met)
  in-progress ──→ cancelled (hospital cancels)
  pending/in-progress ──→ cancelled (emergency resolved)
```

**State Rules:**
- ✅ State transitions validated
- ⚠️ **ISSUE**: No auto-expiration at deadline
  - Request can remain 'pending' beyond requiredBy date
  - No cleanup or notification to donors

**Inconsistency Scenarios:**
```
# Scenario 1: Request completed but donations still pending
Request {
  status: 'completed',
  requiredBy: <date>,
  unitsNeeded: 5
}
Donation #1 { status: 'completed', quantity: 3 } ✓
Donation #2 { status: 'pending', quantity: 2 } ✗ Mismatch!
Donation #3 { status: 'scheduled', quantity: 1 } ✗ Mismatch!
# Hospital marked fulfilled; but donations unfulfilled

# Scenario 2: Request expired with active donations
Request {
  status: 'expired',
  requiredBy: <past date>
}
Donation { status: 'scheduled', appointmentDate: <future> }
# Donation appointment still active for expired request!
```

---

### Appointment State Machine

```
States: ['pending', 'confirmed', 'completed', 'cancelled']

Valid Transitions:
  pending ──→ confirmed (donor confirms appointment)
  confirmed ──→ completed (QR scanned, blood taken)
  pending/confirmed ──→ cancelled (rescheduling or cancellation)
```

**State Rules:**
- ✅ State transitions validated
- ⚠️ **ISSUE**: Cancelled appointment doesn't auto-cancel donation
  - Donation status unaffected
  - Donation remains 'scheduled' to cancelled appointment

**Inconsistency Scenarios:**
```
# Scenario 1: Appointment cancelled; donation still scheduled
Appointment {
  status: 'cancelled',
  cancelledAt: <now>
}
Donation {
  status: 'scheduled',
  appointmentId: <cancelled appointment>
}
# Donation has no appointment!

# Scenario 2: QR token expires; appointment still confirmed
Appointment {
  status: 'confirmed',
  qrToken: '<expired>',
  qrExpiresAt: <past date>
}
# Can still mark complete? QR token validation missing?
```

---

### BadgeProgress State Machine

```
States: ['LOCKED', 'UNLOCKED']

Valid Transitions:
  LOCKED ──→ UNLOCKED (progress threshold reached)
  UNLOCKED → LOCKED (never! Badges cannot be re-locked)
```

**State Rules:**
- ✅ One-way transition (irreversible)
- ⚠️ **ISSUE**: No way to adjust progress downward
  - If donation cancelled/rejected, progress not decremented
  - Badge progress overstated

**Inconsistency Scenarios:**
```
# Scenario: Donation cancelled after badge unlock
UserBadge {
  progressCurrent: 5,
  unlockStatus: 'UNLOCKED',
  unlockedAt: <date>
}

// Donation #5 cancelled
// Progress should be: 4
// Actual: Still 5 (no decrement logic)

Donation {
  status: 'cancelled'
}
# Badge progress not adjusted
```

---

### RewardRedemption State Machine

```
States: ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'EXPIRED']

Valid Transitions:
  PENDING ──→ CONFIRMED  (immediate, no wait)
  CONFIRMED ──→ DELIVERED (on fulfillment)
  CONFIRMED ──→ EXPIRED (if expiresAt passed)
  CONFIRMED ──→ CANCELLED (donor requests cancellation)
```

**State Rules:**
- ✅ Default to CONFIRMED on creation
- ⚠️ **ISSUE**: EXPIRED status not enforced
  - Redemption can be used after expiresAt

**Inconsistency Scenarios:**
```
# Scenario: Reward redeemed after expiration
RewardRedemption {
  status: 'CONFIRMED',
  expiresAt: <past date>
  createdAt: 30 days ago
}
# expiresAt is past, but status not updated
# Application must manually check expiration

# Scenario: Points refunded to cancelled redemption?
RewardRedemption {
  status: 'CANCELLED',
  pointsSpent: 100
}
# PointsTransaction reversed?
# DonorPoints refunded?
# No clear audit trail
```

---

## Circular Dependency: Donation → Appointment → Donation

**Issue:** Bidirectional weak reference creates ambiguity about ownership.

```
Donation ──→ Appointment (Donation.appointmentId)
Appointment ──→ Donation (implicit via donorId + requestId + status)

Which is source of truth?
- Donation.status = 'scheduled' but Appointment.status = 'pending'?
- Appointment.status = 'confirmed' but Donation.status = 'pending'?
```

**Inconsistency Example:**
```
// Hospital creates appointment (pending)
Appointment {
  status: 'pending',
  donorId: 'X',
  requestId: 'Y',
  appointmentDate: tomorrow
}

// Donor hasn't formally "accepted" yet
Donation { /* No record */ }

// Or:
Donation {
  status: 'pending',
  donorId: 'X',
  requestId: 'Y',
  appointmentId: null // Not linked!
}

// Appointment created separately
Appointment {
  status: 'pending',
  // Unlinked to Donation
}

// Who owns the relationship?
```

**Question:** Is Donation → Appointment a 1:1 or 1:0 relationship?

---

## Summary: State Consistency Risks

| Issue | Scenario | Severity |
|-------|----------|----------|
| Donation stuck in pending | No appointment created indefinitely | MEDIUM |
| Appointment cancelled; donation scheduled | Mismatch after cancellation | HIGH |
| Request completed; donations pending | Hospital unfulfilled obligations | HIGH |
| Request expired; donations active | Stale appointments for expired requests | MEDIUM |
| Badge progress not decremented | Abandoned donation inflates progress | MEDIUM |
| Reward expired; status not updated | Redemption usable after expiration | MEDIUM |
| Circular Donation-Appointment ref | Unclear ownership and state sync | HIGH |

---

# Historical Data Preservation Review

## Activity Auto-Pruning (TTL Policy)

**Current Policy:** Activity records auto-deleted after 365 days

```javascript
activitySchema.index({ createdAt: 1 }, 
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);
```

**Risk Analysis:**

| Business Need | Data Requirement | Preservation | Status |
|---|---|---|---|
| **Donation History** | Donor needs 5+ year history for health records | Activity TTL 1yr | ❌ LOST |
| **Tax Records** | Compliance requires 7 years of transaction records | Activity TTL 1yr | ❌ LOST |
| **Insurance Claims** | Hospital needs 2+ years for donor verification | Activity TTL 1yr | ⚠️ MARGINAL |
| **Dispute Resolution** | 1-year SOL requires 1yr min records | Activity TTL 1yr | ⚠️ MARGINAL |
| **User Analytics** | Marketing needs 2-3 year behavior trends | Activity TTL 1yr | ❌ LOST |
| **Platform Audit** | System audit needs 1+ year activity | Activity TTL 1yr | ✅ OK |

**Preservation Gap:**
```
Historical Questions Not Answerable After 1 Year:
- "How many times has this donor given blood?" (beyond 1yr)
- "What was this donor's activity in 2024?" (lost by 2026)
- "Did this hospital-donor interaction occur?" (no proof)
- "What caused this badge unlock?" (activity log gone)
```

**Solution Gap:**
- ❌ No cold storage archival
- ❌ No data warehouse migration
- ❌ No compliance document retention

**Questions:**
- What compliance/regulatory retention requirements apply?
- Should Activity archive to S3/cold storage before TTL?
- Should PointsTransaction (no TTL) be complemented by Activity?

---

## PointsTransaction Immutability

**Current Policy:** Immutable append-only (strict: true, no updates allowed)

```javascript
pointsTransactionSchema = new Schema({...}, {
  timestamps: true,
  strict: true,  // Prevent field additions
});

// Pre-save hook prevents updates
pointsTransactionSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    return next(new Error('Immutable'));
  }
  next();
});
```

**Preservation Guarantee:** ✅ EXCELLENT
- Every points event permanently recorded
- No edits or deletions possible
- Audit trail unbreakable

**Status:** OK

---

## Badge Progress Deletion

**Current Policy:** Hard deletion of Badge

**Scenario:**
```
// Badge deleted by admin
Badge.deleteOne({ _id: 'badge-123' });

// UserBadge records now orphaned
UserBadge {
  badgeId: 'badge-123',  // Deleted!
  progressCurrent: 5,
  unlockedAt: <date>
}

// What happened to this badge?
// Why did donor unlock it?
// No audit trail!
```

**Preservation Gap:** ❌ CRITICAL
- No way to answer: "Which badges have been deleted?"
- Badge history lost
- Donor achievement records become meaningless

**Questions:**
- Should deleted badges archive to BadgeArchive collection?
- Should UserBadge reference include badge snapshot (name, icon)?

---

## Request Deletion Policy

**Current Policy:** Requests are not hard-deleted (field says "no soft-delete")

**Scenario:**
```
Request {
  status: 'completed',
  createdAt: 2 years ago,
  completedAt: 1.5 years ago
  // No deletedAt field
}

// Request remains indefinitely
// Query performance degrades
```

**Preservation Status:** ⚠️ INDEFINITE
- Requests never deleted
- History preserved (good for audit)
- But collection grows unbounded

**Questions:**
- Should completed/cancelled requests archive after 2 years?
- Should requests >1yr old move to cold collection?

---

## Donation Completion Audit Trail

**Current Policy:** Donations reference Appointment for verification

**Components:**
```
Donation {
  completedDate: <when>,
  verifiedAt: <who verified>,
  unitsCollected: <amount>,
  hemoglobinLevel: <value>
}

Appointment {
  qrScannedAt: <when>,
  verificationStatus: 'verified'
}

PointsTransaction {
  referenceId: '<donationId>',
  balanceAfter: <snapshot>
}

Activity {
  action: 'donation_completed',
  referenceId: '<donationId>',
  createdAt: <when>,
  // Deleted after 365 days!
}
```

**Preservation Assessment:**
- ✅ Donation data immutable (never modified)
- ✅ PointsTransaction immutable
- ❌ Activity deleted after 1 year
- ⚠️ Full audit trail incomplete after 365 days

**Questions:**
- What compliance records must survive 365 days?
- Should completion audit trail archive?

---

# Data Integrity Risks

## Risk Classification

### CRITICAL Risks (Data Loss / Corruption / Orphan Cascade)

#### C1: Soft-Deleted Donor Leaves Orphaned Donations

**Description:** Donor soft-deleted; Donations remain with orphaned donorId; Hospital awaits blood from non-existent donor.

**Root Cause:** No cascade delete or cancellation when User.deletedAt set

**Impact:**
- Hospital cannot fulfill request (awaiting orphaned donor)
- Donor cannot reschedule/cancel donation
- Request stuck in 'pending' indefinitely
- DonorPoints balance orphaned (cannot reconcile)

**Affected Entities:**
- Donation (status='scheduled' with orphaned donorId)
- Appointment (status='confirmed' with orphaned donorId)
- DonorPoints (orphaned, cannot update)
- UserBadge (orphaned progress)

**Likelihood:** HIGH
- Donors may request account deletion
- Staff may soft-delete inactive donors
- No current warning or validation

**Evidence:**
```javascript
// User soft-delete has no cascade
User.findByIdAndUpdate(donorId, { deletedAt: new Date() });
// Donation still references this donor

// Hospital query for available donors
Request.find({ status: 'pending' });
Donation.find({ requestId: X, status: 'pending' });
// Donation with orphaned donorId still returned
// Hospital cannot contact donor (user deleted)
```

---

#### C2: Soft-Deleted Hospital Leaves Orphaned Requests

**Description:** Hospital soft-deleted; Requests remain 'pending' with orphaned hospitalId; Donors cannot fulfill requests from deleted hospital.

**Root Cause:** No cascade cancellation when Hospital User.deletedAt set

**Impact:**
- Donors still see hospital requests in browse UI
- But hospital is "deleted" — no staff to accept donations
- Request fulfillment impossible (no recipient)
- Donors donate blood with nowhere to send it

**Affected Entities:**
- Request (orphaned hospitalId, unfulfillable)
- Appointment (orphaned hospitalId, unverifiable)
- Donation (orphaned hospital recipient)

**Likelihood:** MEDIUM
- Hospitals may close/merge (planned deletion)
- Admin may suspend non-compliant hospital
- Current system doesn't handle this gracefully

**Evidence:**
```javascript
// Hospital soft-delete
User.findByIdAndUpdate(hospitalId, { deletedAt: new Date() });

// Request orphaned
Request {
  hospitalId: <soft-deleted User._id>,
  status: 'pending',
  unitsNeeded: 5
}

// Donors still match & accept
Donation { donorId: X, requestId: Y, status: 'scheduled' }

// Hospital staff cannot access UI (deleted user)
// Donation cannot be verified / completed
```

---

#### C3: DonorPoints Out-of-Sync with PointsTransaction

**Description:** DonorPoints.pointsBalance diverges from PointsTransaction sum due to non-atomic updates; Donor balance incorrect.

**Root Cause:** No atomic transaction wrapping PointsTransaction creation + DonorPoints increment; No reconciliation process

**Impact:**
- Donor balance overstated or understated
- Redemption may fail (insufficient points) or over-allow
- Reward system broken

**Scenario:**
```javascript
// Donation completed
Donation { status: 'completed' }

// Service calculates points: 100
// Step 1: Create PointsTransaction ✓
PointsTransaction {
  donorId: 'X',
  pointsAmount: 100,
  transactionType: 'BLOOD_DONATION',
  balanceAfter: 100
}

// Step 2: Increment DonorPoints ✗ FAILS
// (e.g., network timeout, DB crash)
// DonorPoints NOT updated

// Result:
DonorPoints { pointsBalance: 0 } ← Wrong!
PointsTransaction { balanceAfter: 100 } ← Correct!

// Sum(PointsTransaction) = 100
// DonorPoints.pointsBalance = 0
// Divergence!
```

**Likelihood:** LOW-MEDIUM
- Requires failure mid-transaction
- But no retry/rollback logic exists
- Over time, small divergences accumulate

**Evidence:**
- No atomic multi-document transaction
- Async operations not retried
- No background reconciliation job

---

### HIGH Risks (Integrity Gaps / State Inconsistencies)

#### H1: Appointment Cancelled; Donation Still Scheduled

**Description:** Hospital cancels appointment; Donation status unchanged; Donor still owes blood with no appointment.

**Root Cause:** No cascading state update when Appointment.status changed

**Impact:**
- Donor confused (appointment cancelled but donation "pending"?)
- Hospital cannot find donor (thinks appointment active)
- Unfulfilled blood obligation lingering
- Request may be marked "complete" but donations actually pending

**Scenario:**
```javascript
Donation {
  status: 'scheduled',
  appointmentId: 'appt-123'
}

Appointment {
  _id: 'appt-123',
  status: 'cancelled',
  cancelledAt: <now>
}

// Donation.status: 'scheduled'
// But appointment it references: cancelled
// State mismatch!

// Who cancels the donation?
// Implicit cascading? Explicit cancellation?
```

**Likelihood:** MEDIUM
- Donors reschedule frequently
- System doesn't enforce cancellation cascade

**Evidence:**
- No pre/post hook on Appointment cancellation
- Donation status not updated
- Activity log may show "appointment_cancelled" but not "donation_cancelled"

---

#### H2: Request Marked Complete; Donations Still Pending

**Description:** Hospital marks Request 'completed' even though some Donations still 'pending' or 'scheduled'; Unfulfilled donor obligations remain.

**Root Cause:** No validation that all donations are in terminal state before Request completion

**Impact:**
- Hospital reports blood received when donors haven't completed
- Donors left in limbo (donation obligation unclear)
- Request fulfillment ambiguous

**Scenario:**
```javascript
Request {
  _id: 'req-123',
  unitsNeeded: 5,
  status: 'completed',
  completedAt: <now>
}

Donation #1 {
  requestId: 'req-123',
  status: 'completed',
  quantity: 3
}

Donation #2 {
  requestId: 'req-123',
  status: 'pending',  // ← Mismatch!
  quantity: 2
}

// Request completed with pending donations
// Hospital says "we got enough blood"
// But Donor #2 still hasn't given blood!
```

**Likelihood:** MEDIUM
- Hospital completes request when threshold met
- But system doesn't auto-cancel excess donations
- Some donations remain pending indefinitely

**Evidence:**
```javascript
// Request completion logic (pseudocode)
completedDonations = Donation.find({
  requestId: X,
  status: 'completed'
});
totalUnits = completedDonations.reduce(sum quantity);
if (totalUnits >= Request.unitsNeeded) {
  Request.status = 'completed'; // ← No check on pending
}
```

---

#### H3: Donation Pending Without Appointment Indefinitely

**Description:** Donation created but appointment never scheduled; Donation stuck in 'pending' forever; Hospital cannot track when blood will be collected.

**Root Cause:** No enforcement that appointment must be scheduled; No timeout/expiration logic

**Impact:**
- Hospital cannot plan blood collection
- Donation fulfillment status unclear
- Request quantity unclear (is this pledge active?)

**Scenario:**
```javascript
Donation {
  status: 'pending',
  appointmentId: null,
  createdAt: 7 days ago,
  // No appointmentDate field
  // When will blood be collected?
}

Request {
  unitsNeeded: 5,
  status: 'pending',
  requiredBy: tomorrow
}

// Request due tomorrow
// But donation has no scheduled date!
// Can hospital fulfill?
```

**Likelihood:** MEDIUM
- Donors accept request but delay appointment scheduling
- No push notification reminding to book
- Donation counts toward fulfillment but not actually scheduled

**Evidence:**
- Donation.appointmentId optional (default: null)
- No required appointment date
- No timeout/auto-cancel for stale pending donations

---

#### H4: Badge Progress Not Reversed After Donation Cancellation

**Description:** Donation cancelled after badge unlock; Badge progress not decremented; Donor retains unearned badge.

**Root Cause:** No backward-edge recalculation when donation status changes; Badge progress one-way only

**Impact:**
- Donor badge counts overstated
- Leaderboard rankings incorrect
- Badge achievement meaningless

**Scenario:**
```javascript
// Donor completes 5 donations → badge unlocked
UserBadge {
  progressCurrent: 5,
  unlockStatus: 'UNLOCKED',
  unlockedAt: <date>,
  progressTarget: 5
}

// Donation #3 is cancelled (medical issue found)
Donation {
  status: 'cancelled'
}

// Expected: progressCurrent should become 4
// Actual: progressCurrent remains 5

UserBadge { progressCurrent: 5 } ← Still 5!
// Badge progress not adjusted
```

**Likelihood:** MEDIUM
- Donations sometimes cancelled for medical reasons
- Badge system doesn't recalculate backward
- No-re-lock policy prevents reversal

**Evidence:**
```javascript
// Badge unlock is one-way
UserBadge.unlockStatus = 'UNLOCKED'; // Never reverted
// No LOCKED transition back
```

---

#### H5: Request Expired; Appointments Still Active

**Description:** Request deadline passed; Request marked 'expired'; But Appointments still 'confirmed' and Donations still 'scheduled' for expired request; Donors donate blood for dead request.

**Root Cause:** No cascade cancellation when Request expires; No validation that appointments link to active requests

**Impact:**
- Donors complete donation for expired request
- Blood collected unnecessarily (hospital no longer needs it)
- Resource waste

**Scenario:**
```javascript
Request {
  _id: 'req-123',
  requiredBy: '2026-05-25', // ← Past date
  status: 'expired'
}

Appointment {
  requestId: 'req-123',
  status: 'confirmed',
  appointmentDate: '2026-06-01', // ← Future date
  // But request already expired!
}

Donation {
  requestId: 'req-123',
  status: 'scheduled',
  // Waiting for expired request fulfillment
}

// Donor shows up to donate for expired request
// Waste of donor time and resources
```

**Likelihood:** LOW
- System auto-expires past-due requests
- But no cascade cancel

**Evidence:**
- Request expiration is status change only
- No cascade to Appointment or Donation
- No notification to donors of expiration

---

#### H6: Multiple Donations for Same Donor-Request Pair

**Description:** Donor can accept same Request multiple times; Multiple Donations created with same (donorId, requestId); Duplicate pledges.

**Root Cause:** No unique constraint preventing duplicate acceptance

**Impact:**
- Request counts same donor twice
- Donor committed to give blood multiple times (unclear)
- System confusion about total pledged units

**Scenario:**
```javascript
Request { unitsNeeded: 5 }

// Donor accepts
Donation #1 {
  donorId: 'donor-X',
  requestId: 'req-Y',
  quantity: 1,
  status: 'pending'
}

// Donor accepts again (UI doesn't prevent)
Donation #2 {
  donorId: 'donor-X',
  requestId: 'req-Y',
  quantity: 1,
  status: 'pending'
}

// Hospital sees 2 pledges from same donor
// Donor expects 1 obligation
// Confusion!
```

**Likelihood:** MEDIUM
- Requires UI bug or double-click
- But no DB-level prevention

**Evidence:**
- No unique constraint on (donorId, requestId)
- Duplicate check is application logic only

---

### MEDIUM Risks (Edge Cases / Unclear Ownership)

#### M1: Circular Donation-Appointment Ownership

**Description:** Donation and Appointment bidirectionally reference each other; Unclear which is "source of truth" for state synchronization.

**Root Cause:** Two-way FK relationship without clear ownership

**Impact:**
- State synchronization ambiguity
- One-way updates miss dependent records
- Inconsistent data across reads

**Scenario:**
```javascript
// Donation references appointment
Donation {
  appointmentId: 'appt-123'
}

// Appointment loosely "references" donation via donorId+requestId
Appointment {
  donorId: 'donor-X',
  requestId: 'req-Y',
  // No explicit donationId
}

// If Donation status changes:
// Does Appointment status change too?
// If Appointment cancelled:
// Does Donation cancel?
// Unclear!
```

**Likelihood:** MEDIUM
- Occurs when transaction fails mid-update
- States diverge over time

**Evidence:**
- Appointment has no donationId field (no direct link)
- Status changes not transactional
- No pre/post hooks synchronizing states

---

#### M2: Notification Orphaning on User Deletion

**Description:** User soft-deleted; Notification records still reference deleted user; Orphaned notifications pollute collection.

**Root Cause:** No cascade delete on User → Notification

**Impact:**
- Orphaned notification records accumulate
- Query performance degrades (collection grows)
- Notification history becomes unusable

**Scenario:**
```javascript
User { _id: 'user-123', deletedAt: <date> }

Notification {
  userId: 'user-123', // ← Orphaned!
  message: '...',
  createdAt: <date>
}

// Notification cannot be delivered
// User doesn't exist
// Record pollutes collection forever
```

**Likelihood:** LOW-MEDIUM
- Donors delete accounts
- Notifications not auto-cleaned

**Evidence:**
- No cascade delete on User
- No cleanup job for orphaned notifications

---

#### M3: Request Quantity Ambiguity (Over-Fulfillment)

**Description:** Multiple Donations can total quantity beyond Request.unitsNeeded; No cap on total pledged; Hospital receives "excess" blood with no explicit acceptance.

**Root Cause:** No validation that Sum(Donation.quantity) ≤ Request.unitsNeeded

**Impact:**
- Hospital doesn't know if blood is excess or shortage
- Donations may be rejected implicitly (not explicitly)
- Donor confusion about fulfillment status

**Scenario:**
```javascript
Request { unitsNeeded: 5 }

Donation #1 { quantity: 2, status: 'pending' }
Donation #2 { quantity: 3, status: 'pending' }
Donation #3 { quantity: 2, status: 'pending' }
// Total: 7 units pledged
// Request only needs 5

// Hospital accepts first 5 units
// Donations #3 in limbo (pledged but not needed)
// Should be cancelled? Accepted? Unclear.
```

**Likelihood:** LOW
- System probably has business logic handling this
- But unclear from schema

**Evidence:**
- No database-level constraint
- Business logic must handle excess

---

#### M4: Activity Record TTL Audit Gap

**Description:** Activity records deleted after 365 days; Historical audit trail incomplete; Compliance/tax records lost.

**Root Cause:** MongoDB TTL index auto-deletes without archival

**Impact:**
- Cannot answer: "What was donor doing 18 months ago?"
- Tax/compliance records incomplete
- No evidence for disputes >1 year old

**Scenario:**
```
// Today: 2026-05-31
// Query donor activity from 2024: Missing!

Activity.find({ userId: X, createdAt: { $gt: '2024-06-01' } });
// Returns: Nothing (all activity >1 year deleted)

// Original record lost forever
// No audit trail
```

**Likelihood:** MEDIUM
- Current TTL policy (365 days)
- No archival configured

**Evidence:**
```javascript
activitySchema.index({ createdAt: 1 }, 
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);
```

---

### LOW Risks (Cosmetic / Minor Edge Cases)

#### L1: Reward Expiration Status Not Enforced

**Description:** Reward redemption past expiresAt date; Status not auto-updated to 'EXPIRED'; Redemption usable after expiration.

**Root Cause:** Application must manually check expiresAt; No auto-expiration logic

**Impact:**
- Donor uses expired reward
- Business rule violated implicitly
- System inconsistency

**Likelihood:** LOW
- Application should validate before delivery
- But DB schema allows

**Evidence:**
```javascript
RewardRedemption {
  status: 'CONFIRMED',
  expiresAt: <past date>,
  // Status not updated
}
```

---

#### L2: Multiple Appointments for Same Request-Donor Pair

**Description:** Donor can schedule multiple appointments for same Request; No unique constraint.

**Root Cause:** No unique index on (donorId, requestId, appointmentDate)

**Impact:**
- Duplicate appointment bookings
- Resource double-booking
- Donor confusion

**Scenario:**
```javascript
Appointment #1 {
  donorId: 'X',
  requestId: 'Y',
  appointmentDate: '2026-06-01'
}

Appointment #2 {
  donorId: 'X',
  requestId: 'Y',
  appointmentDate: '2026-06-01' // Same time!
}

// Double-booked!
```

**Likelihood:** LOW
- UI likely prevents duplicate bookings
- But DB allows

**Evidence:**
- No unique constraint
- Application logic prevents (probably)

---

# Evidence

## Model Relationships Table

| Parent → Child | Type | Constraint | Risk |
|---|---|---|---|
| User (Donor) → Donation | 1:N | FK soft-delete | Orphan if donor deleted |
| User (Donor) → Appointment | 1:N | FK soft-delete | Orphan if donor deleted |
| User (Donor) → DonorPoints | 1:1 | Unique FK | Orphan if donor deleted |
| User (Hospital) → Request | 1:N | FK soft-delete | Orphan if hospital deleted |
| User (Hospital) → Appointment | 1:N | FK soft-delete | Orphan if hospital deleted |
| Request → Donation | 1:N | FK none | Donations persist if request deleted |
| Donation ↔ Appointment | 0:1 | Bidirectional optional | State sync ambiguity |
| Donor → DonorPoints | 1:1 | Unique constraint | Good |
| DonorPoints → PointsTransaction | Derived | Calculated sum | Drift risk if failed transaction |
| Badge → UserBadge | 1:N | FK none | Orphan if badge deleted |
| RewardCatalog → RewardRedemption | 1:N | FK none | Orphan if catalog item deleted |
| User → Activity | 1:N | FK soft-delete | Orphan if user deleted |
| User → Notification | 1:N | FK soft-delete | Orphan if user deleted |

## State Machine Transitions Verified

| Entity | Valid Transitions | Enforcement | Gap |
|---|---|---|---|
| Donation | pending→scheduled→completed | state-machine.js | No auto-expiration if pending >N days |
| Request | pending→in-progress→completed | state-machine.js | No cascade to sub-donations |
| Appointment | pending→confirmed→completed | state-machine.js | Cancellation doesn't cascade |
| Badge Progress | LOCKED→UNLOCKED | state-machine.js | No reverse transition possible |
| Reward Status | CONFIRMED→DELIVERED/EXPIRED | Manual check | Status not auto-updated |

## Immutable Collections (Append-Only)

✅ **PointsTransaction** (strict: true, no updates)
✅ **AuditLog** (append-only by design)
⚠️ **Activity** (append-only but TTL-pruned)

---

# Recommendations

## Analysis-Level Recommendations

### 1. **Implement Cascade Cancellation on User Soft-Delete**

**Scope:** User soft-deletion should trigger cascading updates to dependent entities

**Affected Entities:**
- When Donor deleted → Cancel pending/scheduled Donations
- When Hospital deleted → Cancel pending/in-progress Requests

**Justification:**
- Prevents orphaned records
- Maintains referential integrity
- Reduces support burden (unclear obligations)

**Questions to Clarify:**
- Should notifications be sent to affected parties?
- Should cancelled donations be replaced with alternate donors?
- What happens to reward points earned from cancelled donations?

---

### 2. **Add Atomic Multi-Document Transactions for Donation-PointsTransaction-DonorPoints**

**Scope:** Donation completion → Points awarded must be atomic

**Operation:**
```
Transaction [
  1. Create PointsTransaction
  2. Increment DonorPoints.pointsBalance
  3. Update DonorPoints.tier
  4. Create Activity log
]
// All-or-nothing; if one fails, all rollback
```

**Justification:**
- Prevents DonorPoints-PointsTransaction drift
- Ensures balance accuracy
- No partial operations mid-stream

**Questions to Clarify:**
- Should retries auto-attempt on failure?
- What backoff strategy for transient failures?
- How to handle idempotency (duplicate submissions)?

---

### 3. **Add Appointment Scheduling Enforcement**

**Scope:** Donation cannot remain 'pending' without appointment indefinitely

**Options:**
- **A)** Require appointment within N days of acceptance
- **B)** Auto-cancel if appointment not scheduled within N days
- **C)** Change UI to require appointment at acceptance time

**Justification:**
- Clarifies Hospital's fulfillment expectations
- Reduces stale pending donations
- Enables request deadline enforcement

**Questions to Clarify:**
- What is reasonable N? (1 day, 7 days, 14 days?)
- Should auto-cancel notify donor with reason?
- Can donor re-accept after auto-cancel?

---

### 4. **Add Unique Constraint on (donorId, requestId) for Donations**

**Scope:** Prevent duplicate acceptance of same request by same donor

**Implementation:**
```javascript
donationSchema.index(
  { donorId: 1, requestId: 1 },
  { unique: true, sparse: true }
);
```

**Justification:**
- Prevents duplicate pledges
- Clarifies donor obligations
- Simplifies Hospital request fulfillment tracking

**Questions to Clarify:**
- Can donor change mind and re-accept after cancellation?
- Should this index be sparse (allow null requestId)?

---

### 5. **Add Soft-Delete and Archival for Badge**

**Scope:** Instead of hard-delete, soft-delete with archival

**Change:**
```javascript
// From:
Badge.deleteOne({ _id: X });

// To:
Badge.updateOne({ _id: X }, { 
  deletedAt: new Date(),
  status: 'archived'
});
```

**Justification:**
- Preserves UserBadge referential integrity
- Maintains historical context ("Why does this donor have progress toward deleted badge?")
- Allows badge re-activation

**Questions to Clarify:**
- Should archived badges appear in UI?
- Should new donors be able to unlock archived badges?

---

### 6. **Add Cascade Cancellation for Expired Requests**

**Scope:** When Request marked 'expired', auto-cancel related Appointments and Donations

**Trigger:** 
- Request.requiredBy < now() → auto-set Request.status = 'expired'
- Cascade: Cancel all Appointments and Donations for that Request

**Justification:**
- Prevents donations to dead requests
- Clears donor obligations
- Reduces confusion

**Questions to Clarify:**
- Should donors be notified of auto-cancellation?
- Should partial donations be recovered (refund points)?
- Can hospital manually override expiration?

---

### 7. **Add Request Quantity Cap Validation**

**Scope:** Validate total pledged ≤ requested (with grace margin)

**Implementation:**
```javascript
// Before accepting donation:
const totalPledged = await Donation.aggregate([
  { $match: { requestId: X, status: { $in: [...] } } },
  { $group: { _id: null, total: { $sum: '$quantity' } } }
]);

if (totalPledged + newDonation.quantity > Request.unitsNeeded * 1.1) {
  // Reject or warn
}
```

**Justification:**
- Prevents resource waste
- Makes fulfillment expectations clear
- Simplifies Hospital workflow

**Questions to Clarify:**
- What grace margin is acceptable? (10%, 20%?)
- Should excess donations be queued for future requests?
- Should Hospital be able to reject excess?

---

### 8. **Add Activity Archival to Cold Storage**

**Scope:** Before TTL expires, archive Activity to cold storage (S3, BigQuery)

**Implementation:**
```javascript
// Monthly job:
1. Query Activity records 30 days old
2. Batch export to S3 (compressed JSON)
3. Archive metadata to AuditArchive collection
4. Allow TTL to delete from hot collection
```

**Justification:**
- Preserves audit trail >1 year
- Meets compliance/tax requirements
- Maintains searchable history (query cold storage)

**Questions to Clarify:**
- What retention policy (3 years? 7 years? Perpetual?)
- What compliance/regulatory requirements apply?
- Should Activity be queryable from cold storage?

---

### 9. **Add Synchronized State Machine for Donation-Appointment Pair**

**Scope:** Ensure Donation.status and Appointment.status stay synchronized

**Rule:**
```
If Appointment.status = 'cancelled':
  Donation.status must become 'cancelled'
  
If Donation.status = 'cancelled':
  Appointment.status must become 'cancelled'
  
If Request.status = 'completed':
  All related Donations must be in terminal state
  (completed, cancelled, or rejected)
```

**Justification:**
- Eliminates state mismatch bugs
- Makes system behavior predictable
- Simplifies debugging

**Questions to Clarify:**
- Should synchronization be transactional or eventual?
- Who is the source of truth (Donation or Appointment)?
- How to handle circular cancellations?

---

### 10. **Add Foreign Key Constraints Documentation**

**Scope:** Document all FK relationships and expected null handling

**Deliverable:**
```markdown
## Foreign Key Relationships

### Donation → Appointment
- Type: Optional (0:1)
- Null Handling: Donation can exist without appointment
- Consistency: If appointment deleted, donation not auto-cancelled
- Risk: HIGH — Status mismatch possible

### Request → Donation
- Type: Mandatory (1:N)
- Null Handling: Request never null on Donation
- Consistency: If request deleted, donation orphaned
- Risk: HIGH — Orphan records

### UserBadge → Badge
- Type: Mandatory (1:N)
- Null Handling: Badge never null on UserBadge
- Consistency: If badge deleted, UserBadge orphaned
- Risk: MEDIUM — Orphan records
```

**Justification:**
- Makes constraints explicit
- Guides future development
- Enables audit tooling

---

## Data Reconciliation Recommendations (Analysis-Only)

### R1: Points Balance Reconciliation Tool

**Purpose:** Compare DonorPoints.pointsBalance against PointsTransaction sum; Identify drift

**Expected Deliverable:**
```
Reconciliation Report:
- Donor ID | Balance | Calculated | Drift | Status
- ABC123  | 100     | 100         | 0     | ✓ OK
- XYZ789  | 150     | 130         | +20   | ⚠️ DRIFT
```

---

### R2: Orphan Record Identification Tool

**Purpose:** Query for orphaned records (FK references to non-existent entities)

**Expected Deliverable:**
```
Orphan Report:
- Entity    | Orphan Count | Examples
- Donation  | 24           | [ID1, ID2, ...]
- Appt      | 7            | [ID3, ID4, ...]
- UserBadge | 5            | [ID5, ID6, ...]
```

---

### R3: State Consistency Audit

**Purpose:** Identify state mismatches (e.g., Donation 'completed' but Appointment 'pending')

**Expected Deliverable:**
```
Inconsistency Report:
- Issue                                    | Count | Examples
- Donation completed, Appt pending         | 3     | [ID1, ID2, ID3]
- Request completed, Donations pending    | 12    | [ID4, ID5, ...]
- Appt cancelled, Donation scheduled      | 8     | [ID6, ID7, ...]
```

---

# Open Questions

## Business Logic Clarification

1. **Donation Appointment Requirement**
   - Must every donation have a scheduled appointment before acceptance?
   - Or is appointment optional (e.g., walk-in donors)?
   - What is the flow for walk-in scenarios?

2. **Request Quantity Fulfillment**
   - Can hospital accept MORE donations than requested?
   - What is the grace margin (10%, 20%, etc.)?
   - Should excess donations be queued for future requests?

3. **Soft-Deleted User Handling**
   - When donor account deleted, should pending donations auto-cancel?
   - Should hospital be notified?
   - Can donor re-activate account and resume donation?

4. **Hospital Closure / Transfer**
   - When hospital closes, who takes over pending requests?
   - Should requests be reassigned to another hospital?
   - Or should they be marked completed/cancelled?

5. **Badge Progress Reversal**
   - If a donor's donation is cancelled/rejected, should badge progress decrease?
   - Can a donor be "re-locked" from UNLOCKED state?
   - Or are badges permanent once unlocked?

6. **Reward Expiration Policy**
   - Who triggers reward delivery after redemption?
   - What happens if delivery fails (wrong contact)?
   - Can donor re-use expired reward?

---

## Compliance & Retention

7. **Activity Historical Retention**
   - What compliance/regulatory requirements apply? (GDPR, SOX, medical records, tax?)
   - How long must Activity records be retained? (1yr, 3yr, 7yr, perpetual?)
   - Should Activity archive to cold storage before TTL?

8. **Donor Medical History**
   - Should hemoglobin levels, weight, health history be retained perpetually?
   - Or should donor profiles be purged after N years?
   - What are regulatory requirements for medical data?

9. **Request Lifecycle Archives**
   - How long should completed/expired requests be retained?
   - Should old requests move to cold storage collection?
   - Any compliance reasons to keep >2 years?

---

## Operational Decisions

10. **Emergency Request Bypass**
    - Do emergency requests bypass normal matching/eligibility rules?
    - Should emergency donations trigger immediate points?
    - Or are they subject to normal 72-hour deferral?

11. **Hospital Rejection Workflow**
    - When hospital rejects an accepted donation (medical eval fails), what happens?
    - Does donor get re-matched to other requests?
    - Are points refunded if partially awarded?

12. **Appointment Rescheduling Limits**
    - How many times can donor reschedule appointment?
    - Should there be a limit (e.g., 2 reschedules)?
    - What triggers auto-cancellation?

13. **QR Token Security**
    - What is risk of QR token exposure (photo, screenshot, sharing)?
    - Should QR token be time-limited (e.g., 2hr window)?
    - What happens if QR expires before appointment?

---

## Data Governance

14. **DonorPoints Reconciliation**
    - How often should points balance be reconciled against transaction log?
    - What is acceptable drift tolerance?
    - Who has authority to manually adjust balance?

15. **Badge Definition Lifecycle**
    - Can admin change badge unlock thresholds after creation?
    - Should existing progress recalculate retroactively?
    - How to handle "migrating" badges to new definitions?

16. **Request Cancellation Cascade**
    - When request cancelled, what should happen to donations?
    - All cancelled? Or allowed to complete for historical record?
    - Should donors keep points if request cancelled?

---

# Summary Table: Data Integrity Issues

| Issue | Severity | Type | Root Cause | Resolution |
|---|---|---|---|---|
| C1: Donor deletion orphans donations | 🔴 CRITICAL | Cascade | No cascade delete | Implement cascade cancellation |
| C2: Hospital deletion orphans requests | 🔴 CRITICAL | Cascade | No cascade delete | Implement cascade cancellation |
| C3: Points balance drift | 🔴 CRITICAL | Sync | Non-atomic transaction | Add multi-doc transaction |
| H1: Appointment cancel, donation pending | 🟠 HIGH | Consistency | No state sync | Add synchronized state machine |
| H2: Request complete, donations pending | 🟠 HIGH | Consistency | No validation | Add terminal state check |
| H3: Donation pending indefinitely | 🟠 HIGH | Lifecycle | No timeout | Enforce appointment within N days |
| H4: Badge progress not reversed | 🟠 HIGH | Consistency | One-way transition | Implement badge re-locking |
| H5: Request expired, appt active | 🟠 HIGH | Lifecycle | No cascade | Cascade cancellation on expiry |
| H6: Duplicate donations per donor | 🟠 HIGH | Uniqueness | No constraint | Add unique index (donor, request) |
| M1: Circular ownership ambiguity | 🟡 MEDIUM | Design | Two-way weak FK | Document clear ownership |
| M2: Notification orphaning | 🟡 MEDIUM | Cleanup | No cascade | Auto-delete orphaned notifications |
| M3: Request over-fulfillment | 🟡 MEDIUM | Validation | No cap | Add quantity cap validation |
| M4: Activity TTL audit gap | 🟡 MEDIUM | Retention | No archival | Archive to cold storage before TTL |
| L1: Reward expiration not enforced | 🟢 LOW | State | Manual check | Auto-update status at expiry |
| L2: Multiple appointments same donor | 🟢 LOW | Uniqueness | No constraint | Add unique index |

---

# Conclusion

The LifeLink data model is **fundamentally sound**, with centralized state machines and immutable audit logs preventing most common corruption scenarios. However, **three critical orphaning risks** exist when users are soft-deleted, and **several high-priority consistency gaps** can create state mismatches under failure scenarios or edge-case workflows.

**Priority Actions for Next Phase:**
1. Implement cascade cancellation on user soft-delete (addresses C1, C2)
2. Add atomic transactions for donation-points operations (addresses C3)
3. Add synchronized state machine for donation-appointment pairs (addresses H1)
4. Document FK relationship policies (enables future audit tooling)
5. Clarify business rules around appointment requirements and donation fulfillment (addresses H3, M3, H6)

**Next Phase Recommendations:**
- Phase 05: Implementation Plan (convert findings to technical tasks)
- Phase 06: Schema Migration Design (add constraints without downtime)
- Phase 07: Data Reconciliation (fix existing orphans/inconsistencies)

---

**Report Status:** ✅ Complete
**Recommendations:** Analysis-level only; no implementation performed
**Implementation Ready:** No (requires business clarification and technical design phase)
