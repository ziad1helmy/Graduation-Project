# Flutter Integration Guide — Rewards & Achievements Module

> **Status:** Backend fully implemented, tested, and connected to real donor data.
> All mocked or static rewards data in Flutter must be removed.

---

## Ground Rules

The backend handles **all** calculation logic. Flutter's only job is to display what the API returns.

Never hardcode in Flutter:
- Tier names or thresholds
- Required points for any tier or reward
- Achievement unlock conditions or progress
- Reward catalog items or their costs
- Point values for any earning activity

---

## Screen Initialization

When the Rewards screen opens, fire these three requests in parallel.

---

### 1 — Points & Tier Summary

**Endpoint:** `GET /rewards/points`

This feeds the top section of the Rewards screen: the points balance, tier badge, progress bar, and "points to next tier" label.

| UI Element | Field from Response |
|---|---|
| Displayed points balance | `pointsBalance` |
| Current tier label | `currentTier` |
| Next tier label | `nextTier` |
| Points remaining to next tier | `pointsToNextTier` |
| Progress bar fill | `progressPercentage` (0–100) |
| Tier benefit bullets | `tierBenefits[currentTier]` |
| Total earned (for history display) | `lifetimePointsEarned` |

> `progressPercentage` is already calculated by the backend. Do not recompute it from `pointsBalance` or `lifetimePointsEarned`.

> Tiers are lowercase strings: `bronze`, `silver`, `gold`, `platinum`.

---

### 2 — Achievements / Badges

**Endpoint:** `GET /rewards/badges`

This feeds the Achievements tab. Every badge in the list is returned whether locked or unlocked, with real progress already computed.

| UI Element | Field from Response |
|---|---|
| Achievement title | `badgeName` |
| Achievement description | `badgeDescription` |
| Icon identifier | `badgeIcon` |
| Category label | `category` |
| Rarity indicator | `rarity` |
| Lock / unlock state | `unlockStatus` (`LOCKED` or `UNLOCKED`) |
| Progress bar / counter | `progressCurrent` / `progressTarget` |
| Progress percentage | `progressPercentage` |
| Unlock timestamp | `unlockedAt` (null if locked) |

**Top-level response fields** (for the summary row):

| UI Element | Field from Response |
|---|---|
| Unlocked count | `unlockedCount` |
| Total count | `totalCount` |
| Completion percentage | `completionPercentage` |
| Total donations stat | `stats.totalDonations` |
| Total emergency responses | `stats.totalEmergencyResponses` |
| Days as donor | `stats.daysAsDonor` |

**What the backend calculates for you:**
- Donation count progress
- Emergency response count progress
- First donation detection
- Which achievements are newly unlocked vs. previously unlocked

---

### 3 — Rewards Catalog

**Endpoint:** `GET /rewards/catalog`

This feeds the Rewards tab with redeemable items.

| UI Element | Field from Response |
|---|---|
| Reward name | `name` |
| Points cost | `pointsCost` |
| Card icon | `iconType` |
| Card accent color | `colorCode` |
| Redeem button enabled | `available` |
| Category chip | `category` |

> The redeem button must be disabled when `available` is `false` **or** when `pointsBalance < pointsCost`.

**Supported filter query parameters:**
- `category` — `FOOD`, `ENTERTAINMENT`, `HEALTH`, `STATUS`, or `ALL`
- `sort_by` — `COST_ASC`, `COST_DESC`, or `POPULARITY`
- `status` — `ACTIVE` (default), `INACTIVE`, or `ALL`

---

## Reward Redemption Flow

**Endpoint:** `POST /rewards/catalog/:rewardId/redeem`

**Request body fields:**
- `delivery_preference` — `IN_APP` or `EMAIL`
- `delivery_contact` — email address (only required when preference is `EMAIL`)

**On success**, the response contains a `confirmationCode` to display to the donor.

**Error states to handle:**

| HTTP Status | Meaning | UI Action |
|---|---|---|
| 200 | Redeemed successfully | Show confirmation code |
| 409 `INSUFFICIENT_POINTS` | Balance too low | Show shortfall from `details.shortfall` |
| 409 Daily limit | Daily cap reached | Show "try again tomorrow" message |
| 409 Monthly limit | Monthly cap reached | Show "try again next month" message |
| 400 | Reward inactive | Show "no longer available" message |

**After a successful redemption, refresh:**
- `GET /rewards/points`
- `GET /rewards/catalog`
- `GET /rewards/history`

---

## Redemption History

**Endpoint:** `GET /rewards/history`

Displays the donor's past redemptions. Each item includes the reward name, points spent, confirmation code, status, and expiry date.

**Supported filter:**
- `status` — `PENDING`, `CONFIRMED`, `DELIVERED`, `CANCELLED`, `EXPIRED`, or `ALL`

---

## Points Transaction History

**Endpoint:** `GET /rewards/points/history`

Displays the full earned/spent points log. Transaction types the backend produces:

| Type | Trigger |
|---|---|
| `BLOOD_DONATION` | Blood donation completed |
| `PLASMA_DONATION` | Plasma donation completed |
| `PLATELETS_DONATION` | Platelet donation completed |
| `ORGAN_DONATION` | Organ donation completed |
| `FIRST_DONATION` | One-time bonus on first-ever donation |
| `EMERGENCY_RESPONSE` | Donation on a critical-urgency request |
| `BADGE_UNLOCK` | Achievement unlocked with point reward |
| `TIER_BONUS` | Automatic bonus on tier promotion |
| `REWARD_REDEEMED` | Points spent on a reward |
| `ADMIN_ADJUSTMENT` | Manual admin correction |

**Supported filters:**
- `filter` — `ALL`, `EARNED`, `REDEEMED`, or `ADJUSTMENTS`
- `date_from` / `date_to` — ISO date strings

---

## Earning Rules

**Endpoint:** `GET /rewards/earning-rules`

Used for the "How to Earn Points" informational section. Returns all current point values from the live backend configuration.

Each item in the response array contains: `type`, `title`, `points`, and `category` (`donation` or `bonus`).

> Do not hardcode any of these values. The admin can update point values at any time through the backend config.

---

## Leaderboard

**Endpoint:** `GET /rewards/leaderboard`

Returns top donors ranked by `lifetimePointsEarned`. Accepts a `limit` query parameter (max 50, default 20).

Each entry contains: `rank`, `donorId`, `fullName`, `tier`, `lifetimePointsEarned`, `pointsBalance`.

---

## Badge Unlock Behavior

The backend now correctly fires the unlock event exactly once per badge.

Flutter must track the previous state locally within the session:

- Show the unlock animation **only** when the previous fetched state was `LOCKED` and the new state is `UNLOCKED`
- Do not show the animation on subsequent fetches if the badge was already `UNLOCKED`

The `unlockedAt` timestamp can be used as a secondary guard — it is set once and never overwritten.

---

## Tier Promotion Behavior

Tier promotion is automatic and instant. The moment a donation brings `lifetimePointsEarned` to or past a threshold, the backend:

1. Updates `DonorPoints.tier` in the database
2. Awards the tier bonus points
3. Sends an in-app notification to the donor

Flutter receives the updated tier on the next call to `GET /rewards/points`. No polling is needed — refresh on the triggers listed below.

---

## Recommended Refresh Triggers

| Event | Endpoints to Refresh |
|---|---|
| Donation completed | `/rewards/points`, `/rewards/badges`, `/rewards/history` |
| Reward redeemed | `/rewards/points`, `/rewards/catalog`, `/rewards/history` |
| Pull-to-refresh on Rewards screen | `/rewards/points`, `/rewards/badges`, `/rewards/catalog` |
| App foregrounded / tab switched back to Rewards | `/rewards/points` |

---

## UI Rules Summary

| Rule | Detail |
|---|---|
| Redeem button disabled | When `available = false` or `pointsBalance < pointsCost` |
| Progress bar | Use `progressPercentage` directly, no local math |
| Achievements order | Use the order returned by the backend (`sortOrder` field) |
| Locked badge opacity | Apply reduced opacity to cards where `unlockStatus = LOCKED` |
| Unlock date | Display `unlockedAt` formatted for locale; hide when null |
| Tier string display | Capitalize first letter only: `bronze` → `Bronze` |
| Tier color mapping | Map locally to display colors — but tier names come from backend |

---

## Donation Integration Note

The Rewards system is wired into the donation lifecycle. When a donation is confirmed:

- Points are awarded automatically by the backend
- Achievements recalculate automatically
- Tier is promoted automatically if threshold is crossed

Flutter does not need to call any rewards endpoint to trigger this. It only needs to **refresh** after the donation confirmation response arrives.
