# LifeLink Points & Rewards System

## Overview

The LifeLink rewards system incentivizes blood and organ donations through a points-based mechanism. Donors earn type-specific points upon successful donation completion, with separate medical cooldown periods enforced per donation type.

---

## Points by Donation Type

| Donation Type | Points Awarded | Cooldown Period | Purpose |
|---|---|---|---|
| **Blood** | 200 points | 56 days | Standard whole blood donations |
| **Plasma** | 150 points | 14 days | Plasma apheresis (frequent donation eligible) |
| **Platelets** | 175 points | 7 days | Platelet apheresis (most frequent donation eligible) |
| **Organ** | 500 points | 365 days (1 year) | Organ donation (kidney, liver, heart, lung, pancreas, cornea) |

### Allocation Strategy
- **Blood donations (200 pts)**: Frequent, manageable cooldown; baseline reward
- **Plasma donations (150 pts)**: More frequent (14-day cooldown); essential for plasma-dependent patients
- **Platelets donations (175 pts)**: Most frequent (7-day cooldown); critical for cancer patients and post-surgical recovery
- **Organ donations (500 pts)**: Rare, critical need; significantly higher reward reflecting urgency and impact

---

## Reward Tiers

Donors advance through milestone-based tiers unlocking increasing benefits:

| Tier | Points Required | Unlock Benefits |
|---|---|---|
| **Bronze** | 0+ | Base access to rewards catalog |
| **Silver** | 1,000 | Priority matching, 5% point boost on donations |
| **Gold** | 2,500 | Expedited appointment scheduling, 10% point boost |
| **Platinum** | 5,000 | VIP support, 15% point boost, emergency alert eligibility |

### Tier Progression
- Tiers are cumulative; points never decrease
- Tier bonuses apply retroactively to all donations within a tier
- Donors retain all tier benefits even after "spending" points on rewards

---

## Points Transaction Flow

### When Points are Awarded

Points are awarded atomically (all-or-nothing) when a donation reaches `completed` status:

```
1. Hospital scans QR code → verifyQr() or scanQr() endpoint triggered
2. Appointment marked as "completed" + QR scannedAt timestamp set
3. Donation record created with status = "completed"
4. rewardService.onDonationCompleted() invoked
5. Donor's points + points balance updated in transaction
6. Points deduction (if redeeming) occurs in separate process
```

### Anti-Duplication
- **Unique Index**: `PointsTransaction` partial unique index on `(donorId, referenceId)` ensures one transaction per donation
- **Status Guard**: Donation can only trigger points once (must reach `completed` state exactly once)
- **QR Atomicity**: `Appointment.findOneAndUpdate()` with condition check prevents double-scanning

---

## Cooldown Enforcement

### Per-Type Cooldown Logic

The eligibility service enforces donation type-specific cooldowns:

```javascript
// In eligibility.service.js
const COOLDOWN_DAYS_BY_TYPE = {
  blood: 56,
  plasma: 14,
  platelets: 7,
  organ: 365,
};

// Eligibility check considers donation type
canDonate(donor, { donationType: 'blood' })
  // Checks if lastDonationDate + 56 days >= today
canDonate(donor, { donationType: 'plasma' })
  // Checks if lastDonationDate + 14 days >= today
canDonate(donor, { donationType: 'platelets' })
  // Checks if lastDonationDate + 7 days >= today
canDonate(donor, { donationType: 'organ' })
  // Checks if lastDonationDate + 365 days >= today
```

### Cooldown Application Points
- **Hospital matching**: `matching.service.js` calls `canDonate(donor, { donationType: request.type })`
- **Appointment booking**: Validates donor eligibility before booking
- **QR verification**: Final check before recording donation

---

## Redemption Catalog

Donors accumulate points and may redeem them for:

- Blood screening (health checkup)
- Priority matching notification (rush-list enrollment)
- Emergency donation alert badge (increased visibility)
- Loyalty merchandise (gift cards, branded items)
- Tier acceleration boosts

*Specific reward prices set in `RewardCatalog` collection.*

---

## Activity Logging

All point transactions logged with context:

```json
{
  "type": "reward",
  "action": "earned_points",
  "title": "Points Earned",
  "referenceId": "donation_<donationId>",
  "referenceType": "Donation",
  "metadata": {
    "donationType": "blood",
    "pointsAwarded": 200,
    "transactionType": "BLOOD_DONATION"
  }
}
```

---

## Implementation Details

### File Structure

- **Models**
  - `Donor.model.js` → Stores `pointsBalance`, tier fields
  - `PointsTransaction.model.js` → Ledger of all point events
  - `DonorPoints.model.js` → Optional points subfield
  - `RewardCatalog.model.js` → Available rewards + prices
  - `RewardRedemption.model.js` → Track redemptions

- **Services**
  - `reward.service.js` → `awardPoints()`, `onDonationCompleted()`, point calculation
  - `eligibility.service.js` → Per-type cooldown checks (`COOLDOWN_DAYS_BY_TYPE`)
  - `matching.service.js` → Donor eligibility for request type
  - `donation.service.js` → Donation lifecycle (triggers reward on completion)

- **Controllers**
  - `donation.controller.js` → QR verification endpoints
  - `reward.controller.js` → Donor reward profile, redemption endpoints

### Key Configuration

```javascript
// reward.service.js
export const POINTS_BY_TYPE = {
  blood: 200,
  plasma: 150,
  platelets: 175,
  organ: 500,
};

export const TRANSACTION_TYPE_BY_TYPE = {
  blood: 'BLOOD_DONATION',
  plasma: 'PLASMA_DONATION',
  platelets: 'PLATELETS_DONATION',
  organ: 'ORGAN_DONATION',
};
```

---

## Testing

**Unit Tests**: `tests/unit/reward.service.test.js`
- Per-type point awarding
- Per-type cooldown enforcement
- Deduplication via referenceId
- Tier promotion bonuses
- Fallback handling for missing requests

**Integration Tests**: `tests/integration/donation.integration.test.js`
- Full donation → points flow
- Matching with type-specific eligibility

**E2E Tests**: `tests/e2e/donation-smoke.e2e.test.js`
- Complete donation lifecycle with rewards

---

## Future Enhancements

1. **Social Rewards**: Bonus points for referral, milestone celebrations

2. **Admin Dashboard**: Reward analytics, point adjustments, fraud detection

3. **Tier Acceleration**: Temporary boosts for achieving milestones

---

## API Endpoints (Related)

| Endpoint | Method | Purpose |
|---|---|---|
| `/donations/verify-qr` | POST | Verify QR, record donation, award points |
| `/appointments/scan-qr` | POST | Legacy QR scan endpoint |
| `/rewards/my-rewards` | GET | Donor's earned points + balance |
| `/rewards/redeem` | POST | Redeem points for catalog item |
| `/rewards/leaderboard` | GET | Top donors by points |
| `/reward-catalogs` | GET | Available redemption options |

---

## Summary

The LifeLink points system balances:
- **Accessibility**: Blood donations reward frequently; achievable milestones
- **Impact**: Organ donations reward significantly; critical medical need
- **Fairness**: Per-type cooldowns respect medical guidelines
- **Transparency**: Activity logs audit all transactions
- **Scalability**: Atomic transactions prevent fraud; indexed lookups for performance

Donors are motivated to donate regularly while the system protects medical safety and operational integrity.
