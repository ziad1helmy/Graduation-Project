# Analytics & Campaigns System Documentation

## Overview

The LifeLink platform now includes advanced analytics and seasonal campaign features to track donor engagement and boost participation through targeted incentives.

---

## Analytics System

### Endpoints

#### 1. **Get My Stats** (Donor)
```
GET /analytics/my-stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "donorId": "6a0252b113d82beaf54e02f5",
    "fullName": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "bloodType": "O+",
    "pointsBalance": 2500,
    "totalPointsEarned": 5000,
    "totalDonations": 8,
    "donationsByType": {
      "blood": 5,
      "plasma": 2,
      "platelets": 1,
      "organ": 0
    },
    "lastDonationDate": "2026-05-10T15:30:00Z",
    "joinDate": "2026-01-15T10:20:00Z"
  }
}
```

#### 2. **Get Leaderboard** (Donor)
```
GET /analytics/leaderboard?limit=10&days=30
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (int, default: 10) - Number of top donors to return
- `days` (int, default: 30) - Time period in days

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "Last 30 days",
    "count": 5,
    "leaderboard": [
      {
        "rank": 1,
        "_id": "6a0252b113d82beaf54e02f5",
        "fullName": "Ahmed Hassan",
        "email": "ahmed@example.com",
        "bloodType": "O+",
        "pointsBalance": 5000,
        "lastDonationDate": "2026-05-10T15:30:00Z"
      },
      {
        "rank": 2,
        "_id": "6a0252b213d82beaf54e02f6",
        "fullName": "Fatima Ali",
        "email": "fatima@example.com",
        "bloodType": "A+",
        "pointsBalance": 4500,
        "lastDonationDate": "2026-05-09T14:20:00Z"
      }
    ]
  }
}
```

#### 3. **Get Donation Type Stats** (Donor)
```
GET /analytics/donation-types
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDonations": 150,
    "byType": {
      "blood": {
        "count": 100,
        "avgPoints": 200
      },
      "plasma": {
        "count": 30,
        "avgPoints": 150
      },
      "platelets": {
        "count": 15,
        "avgPoints": 175
      },
      "organ": {
        "count": 5,
        "avgPoints": 500
      }
    }
  }
}
```

#### 4. **Get Dashboard Summary** (Admin)
```
GET /analytics/dashboard
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2026-05-12T10:30:00Z",
    "totalActiveDonors": 1250,
    "totalCompletedDonations": 5420,
    "totalPointsDistributed": 987600,
    "donationsByType": {
      "blood": { "count": 3500, "avgPoints": 200 },
      "plasma": { "count": 1200, "avgPoints": 150 },
      "platelets": { "count": 450, "avgPoints": 175 },
      "organ": { "count": 270, "avgPoints": 500 }
    },
    "topDonorsThisMonth": [...]
  }
}
```

---

## Campaign System

### What are Campaigns?

Campaigns are **seasonal or promotional events** that apply **point multipliers** to donations, encouraging participation during specific periods.

**Example:**
- **Campaign:** Summer Blood Drive 2026
- **Multiplier:** 2.0x (double points)
- **Duration:** June 1 - August 31, 2026
- **Applicable Types:** Blood, Plasma, Platelets

When a donor completes a blood donation during this campaign:
- Base points: 200
- Campaign multiplier: 2.0x
- **Final points awarded: 400**

### Multiplier Rules

- **Base multiplier:** 1.0x (no bonus)
- **Campaign range:** 1.0x - 3.0x
- **Stacking:** If multiple campaigns apply, the **highest multiplier wins** (NOT cumulative)
- **Priority:** Campaigns with higher multipliers are prioritized

### Campaign Properties

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Campaign name (e.g., "Summer Blood Drive") |
| `description` | string | Campaign goals and description |
| `active` | boolean | Campaign is currently active |
| `startDate` | date | Campaign start date |
| `endDate` | date | Campaign end date |
| `multiplier` | number | Points multiplier (1.0 - 3.0) |
| `donationTypes` | array | Eligible donation types: `["blood", "plasma", "platelets", "organ"]` |
| `bloodTypes` | array | Optional: Specific blood types (e.g., `["O+", "O-"]`) |
| `urgencyLevel` | string | Optional: Target urgency level (`low`, `medium`, `high`, `critical`) |
| `maxRedemptions` | number | Optional: Max donors eligible |
| `banner` | string | Campaign banner image URL |
| `tags` | array | Campaign tags for categorization |

### Campaign Endpoints

#### 1. **Get Active Campaigns** (Public)
```
GET /campaigns/active
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "624a5e4b3c7d8e9f0a1b2c3d",
      "name": "Summer Blood Drive 2026",
      "description": "Double your impact this summer",
      "multiplier": 2.0,
      "donationTypes": ["blood", "plasma"],
      "startDate": "2026-06-01T00:00:00Z",
      "endDate": "2026-08-31T23:59:59Z",
      "banner": "https://cdn.lifelink.com/summer-banner.jpg",
      "tags": ["seasonal", "summer"]
    }
  ]
}
```

#### 2. **List All Campaigns** (Admin)
```
GET /campaigns?status=active&donationType=blood
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `status` - Filter: `active`, `upcoming`, `expired`
- `donationType` - Filter: `blood`, `plasma`, `platelets`, `organ`
- `active` - Filter: `true`, `false`

**Response:**
```json
{
  "success": true,
  "data": [...]
}
```

#### 3. **Create Campaign** (Admin)
```
POST /campaigns
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Winter Emergency Drive",
  "description": "Help save lives this winter",
  "startDate": "2026-12-01T00:00:00Z",
  "endDate": "2026-12-31T23:59:59Z",
  "multiplier": 1.8,
  "donationTypes": ["blood", "organ"],
  "bloodTypes": [],
  "urgencyLevel": "critical",
  "maxRedemptions": 500,
  "banner": "https://cdn.lifelink.com/winter-banner.jpg",
  "tags": ["seasonal", "emergency"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "624a5e4b3c7d8e9f0a1b2c3e",
    "name": "Winter Emergency Drive",
    "multiplier": 1.8,
    "active": false,
    "createdAt": "2026-05-12T10:30:00Z"
  }
}
```

#### 4. **Update Campaign** (Admin)
```
PUT /campaigns/{campaignId}
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "multiplier": 2.5,
  "description": "Updated description"
}
```

#### 5. **Activate Campaign** (Admin)
```
POST /campaigns/{campaignId}/activate
Authorization: Bearer <admin_token>
```

#### 6. **Deactivate Campaign** (Admin)
```
POST /campaigns/{campaignId}/deactivate
Authorization: Bearer <admin_token>
```

#### 7. **Get Campaign Metrics** (Admin)
```
GET /campaigns/{campaignId}/metrics
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "campaignId": "624a5e4b3c7d8e9f0a1b2c3d",
    "campaignName": "Summer Blood Drive 2026",
    "period": "2026-06-01T00:00:00Z to 2026-08-31T23:59:59Z",
    "applicableDonations": 450,
    "uniqueDonors": 320,
    "totalMultipliedPoints": 405000,
    "baseTotalPoints": 202500,
    "averageMultiplier": 2.0,
    "pointsBoost": 200
  }
}
```

#### 8. **Delete Campaign** (Admin)
```
DELETE /campaigns/{campaignId}
Authorization: Bearer <admin_token>
```

---

## Points Calculation Examples

### Example 1: Blood Donation with Campaign
```
Donor completes blood donation during "Summer Blood Drive 2026" (2.0x multiplier)
- Donation Type: Blood
- Base Points: 200
- Campaign Multiplier: 2.0x
- Final Points: 200 × 2.0 = 400 points

Transaction Type: BLOOD_DONATION
Description: "Blood Donation - Successful (2.0x bonus)"
```

### Example 2: Plasma Donation with Multiple Campaigns
```
Two campaigns active:
1. "Summer Drive" - Applies to plasma - 1.5x multiplier
2. "Plasma Incentive" - Applies to plasma - 2.0x multiplier

Donor completes plasma donation:
- Donation Type: Plasma
- Base Points: 150
- Highest Campaign Multiplier: 2.0x (from "Plasma Incentive")
- Final Points: 150 × 2.0 = 300 points (NOT 150 × 1.5 × 2.0)
```

### Example 3: Organ Donation with No Campaign
```
Donor completes organ donation when no campaigns apply:
- Donation Type: Organ
- Base Points: 500
- Campaign Multiplier: 1.0x (default, no bonus)
- Final Points: 500 × 1.0 = 500 points

Transaction Type: ORGAN_DONATION
Description: "Organ Donation - Successful"
```

---

## Integration with Reward System

### Cooldown Periods (Per Donation Type)

| Type | Points | Cooldown | Notes |
|------|--------|----------|-------|
| Blood | 200 | 56 days | Whole blood donation |
| Plasma | 150 | 14 days | Plasma separation (frequent) |
| Platelets | 175 | 7 days | Platelet apheresis (most frequent) |
| Organ | 500 | 365 days | Organ donation (once per year) |

**Example:**
- Donor donates plasma on June 1
- Donor can donate plasma again on June 15 (14 days later)
- But can only donate blood on August 26 (56 days after last blood donation)

### First Donation Bonus

All donors receive a **one-time bonus** on their first donation:
- Default: 50 points (configurable)
- Applied regardless of donation type or campaign status

### Fire-and-Forget Error Handling

If the campaign service encounters an error:
1. Points are **still awarded** at base rate (1.0x multiplier)
2. Donation flow is **never blocked**
3. Error is logged for admin investigation
4. Retry logic available in admin dashboard

---

## Campaign Best Practices

### 1. **Seasonal Campaigns**
Plan campaigns around blood demand cycles:
- Winter (Dec-Jan): Higher demand
- Summer (Jun-Aug): Lower donor availability
- Ramadan: Lower donation rates in Muslim-majority areas

### 2. **Multiplier Strategy**
- **Standard:** 1.0x - 1.5x (ongoing incentives)
- **High Priority:** 1.5x - 2.0x (critical shortage)
- **Emergency:** 2.0x - 3.0x (critical situations)

### 3. **Targeting Specific Blood Types**
```json
{
  "name": "O+ Shortage Campaign",
  "multiplier": 2.5,
  "donationTypes": ["blood"],
  "bloodTypes": ["O+", "O-"],
  "urgencyLevel": "critical"
}
```

### 4. **Monitoring Campaign Performance**
Use the metrics endpoint to:
- Track donor participation
- Measure point distribution
- Optimize future campaigns
- Calculate ROI of multipliers

---

## Admin Dashboard Metrics

The dashboard provides system-wide insights:

- **Total Active Donors:** Verified, non-suspended donors
- **Completed Donations:** Total successful donations
- **Points Distributed:** Total points awarded across all donors
- **Donation Distribution:** Breakdown by type (blood, plasma, platelets, organ)
- **Top Donors:** Current leaderboard for period
- **Growth Metrics:** New registrations and donations over time

---

## API Response Standards

All endpoints follow this response format:

**Success (2xx):**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error (4xx, 5xx):**
```json
{
  "success": false,
  "message": "Error description"
}
```

**Pagination (where applicable):**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100
  }
}
```

---

## Testing

### Unit Tests
- Campaign service: 13 tests
- Analytics service: Integration tests in reward.service.test.js
- All tests passing (427/427)

### Manual Testing
```bash
# Get active campaigns
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/campaigns/active

# Get donor stats
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/analytics/my-stats

# Create campaign (admin)
curl -X POST \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{...}' \
  http://localhost:3000/campaigns
```

---

## Future Enhancements

- [ ] Real-time campaign notifications
- [ ] A/B testing framework for multipliers
- [ ] Predictive analytics for demand forecasting
- [ ] Mobile app campaign banners
- [ ] Social sharing bonuses during campaigns
- [ ] Referral campaign chains
- [ ] Time-based multiplier variations (rush hours)
