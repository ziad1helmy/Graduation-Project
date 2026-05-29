# LifeLink Rewards & Gamification System

---

## Overview

LifeLink uses a points-based gamification system to incentivize repeat donations. Donors earn points for donations, unlock badges at milestones, advance through tiers, and can redeem points for rewards.

All reward logic lives in `src/services/reward.service.js` and `src/services/rewardsConfig.service.js`.

---

## Points System

### How Points Are Earned

Points are awarded automatically when a donation is marked as `completed`:

```
donation.service.updateDonationStatus(donationId, 'completed')
    └── rewardService.onDonationCompleted(donorId, donationId, isEmergency)
            └── rewardService.awardPoints(donorId, { action: 'BLOOD_DONATION', donationId, isEmergency })
```

### Point Values (Configurable via Admin)

Default point values stored in `RewardsConfig` model (seeded on startup):

| Action | Default Points |
|--------|---------------|
| Blood donation | 100 |
| Plasma donation | 80 |
| Platelet donation | 90 |
| Emergency bonus (critical urgency) | +50% multiplier |

> All values are configurable via `PUT /admin/rewards/config` without code changes.

### Points Ledger

Every point award or deduction creates a `PointsTransaction` document:

```javascript
{
  donorId: ObjectId,
  transactionType: String,  // BLOOD_DONATION, REDEMPTION, TIER_BONUS, BADGE_BONUS
  pointsAmount: Number,     // positive (earn) or negative (redeem)
  referenceId: String,      // e.g. "donation_<donationId>"
  description: String,
  metadata: Object,         // additional context
  createdAt: Date
}
```

The donor's current balance is stored directly on `Donor.pointsBalance` for fast reads.

---

## Tier System

Donors advance through tiers based on cumulative `pointsBalance`:

| Tier | Minimum Points | Tier Bonus on Unlock |
|------|---------------|---------------------|
| Bronze | 0 | — |
| Silver | 500 | +25 points |
| Gold | 1500 | +50 points |
| Platinum | 5000 | +100 points |

Thresholds and bonus values are configurable via the admin rewards config API.

**Tier evaluation** runs every time points are awarded:
```
currentPoints = donor.pointsBalance
for tier in [Platinum, Gold, Silver, Bronze] (descending):
  if currentPoints >= tier.threshold:
    newTier = tier
    break

if newTier !== donor.currentTier:
  donor.currentTier = newTier
  awardTierBonus(donorId, newTier.bonus)
```

---

## Badge System

Badges are unlocked based on donation count milestones. Badges are defined in the `Badge` collection (seeded on startup).

### Default Badges

| Badge | Trigger | Points Required |
|-------|---------|----------------|
| Bronze Donor | 1st donation | — |
| Silver Donor | 5 donations | — |
| Gold Donor | 10 donations | — |
| Platinum Donor | 25 donations | — |
| Super Donor | 50 donations | — |
| Blood Champion | 100 donations | — |
| Emergency Hero | 1 emergency donation | — |
| Frequent Donor | 3 donations in 90 days | — |

Badge checking runs after every donation completion:

```
getDonorBadges(donorId) → compare completedDonations count vs each badge.requirement
for each unlocked badge not yet in donor.badges:
  add to donor.badges
  create BADGE_BONUS PointsTransaction (if badge has bonus points)
  log activity
```

### Badge Response Shape

```javascript
{
  badges: [
    {
      badgeName: "Bronze Donor",
      description: "...",
      unlockStatus: "UNLOCKED" | "LOCKED",
      progressCurrent: 3,     // current donation count
      progressTarget: 5,      // required for this badge
      unlockedAt: Date | null,
    }
  ]
}
```

---

## Redemption System

Donors can redeem points for rewards (gift cards, discounts, etc.).

### Redemption Rules (Configurable)
- Maximum redemption per day: configurable (default: 1000 points)
- Maximum redemption per month: configurable (default: 5000 points)
- Minimum balance required after redemption: configurable

### Redemption Flow

```
POST /rewards/redeem { rewardId, quantity }
    │
    ├── Load reward definition
    ├── Check donor balance >= reward.pointsCost * quantity
    ├── Check daily/monthly redemption limits
    ├── Deduct points from donor.pointsBalance
    ├── Create PointsTransaction (type: REDEMPTION, negative amount)
    └── Log activity
```

---

## Leaderboard

The public leaderboard ranks donors by `pointsBalance` within a configurable time window.

```
GET /rewards/leaderboard?limit=10&days=30
    │
    └── analytics.service.getLeaderboard(limit, days)
           └── Donor.find({
                 isSuspended: false,
                 isEmailVerified: true,
                 lastDonationDate: { $gte: startDate }
               })
               .sort({ pointsBalance: -1 })
               .limit(limit)
```

**Note**: Leaderboard includes only donors who donated within the last `days` days. Donors with no recent donations are excluded regardless of total balance.

---

## Admin Rewards Configuration

Admins can configure all reward values without code changes:

```
GET  /admin/rewards/config    → Returns current config
PUT  /admin/rewards/config    → Updates config (validated)
```

Configurable values:
- Points per donation type
- Emergency bonus multiplier
- Tier thresholds
- Tier bonuses
- Redemption daily/monthly limits

Changes take effect immediately (config is read on each `awardPoints` call, not cached).
