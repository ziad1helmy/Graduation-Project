# LifeLink Backend API

LifeLink is a Node.js + Express backend for donor-hospital donation workflows. This repository is the verified stabilization branch prepared for Flutter client integration.

## Architecture

```mermaid
graph TB
    subgraph Client
        FL["Flutter App"]
        PM["Postman / cURL"]
    end

    subgraph Middleware Chain
        HL["helmet()"]
        CO["cors()"]
        MS["request sanitizer"]
        RL["rateLimiter"]
        MM["maintenanceMode"]
        AU["authMiddleware"]
        RO["roleMiddleware"]
    end

    subgraph Routes
        AR["/auth"]
        DR["/donor"]
        HR["/hospital"]
        RW["/rewards"]
        NT["/notifications"]
        AD["/admin"]
        DC["/discovery"]
        HP["/help & /support"]
    end

    subgraph Services
        AS["auth.service"]
        MS2["matching.service"]
        DS["donation.service"]
        RS["reward.service"]
        NS["notification.service"]
        ADS["admin.service"]
        ANS["analytics.service"]
    end

    subgraph Data Layer
        MG["MongoDB Atlas"]
        MN["Mongoose ODM"]
    end

    subgraph Utilities
        JWT["jwt.js"]
        GEO["geo.js (Haversine)"]
        PG["pagination.js"]
        EC["errorCodes.js"]
        ML["mailer.js"]
        FCM["fcm.js"]
    end

    FL --> HL
    PM --> HL
    HL --> CO --> MS --> RL --> MM --> AU --> RO
    RO --> AR & DR & HR & RW & NT & AD & DC & HP
    AR --> AS
    DR & HR --> MS2 & DS
    RW --> RS
    NT --> NS
    AD --> ADS & ANS
    AS & MS2 & DS & RS & NS & ADS --> MN --> MG
    MS2 --> GEO
    AS --> JWT & ML
    NS --> FCM
```

### Layered MVC+S Pattern

| Layer | Responsibility | Example |
|-------|---------------|---------|
| **Route** | HTTP verb mapping, Swagger docs | `auth.routes.js` |
| **Middleware** | Auth, rate-limiting, validation, maintenance bypass | `auth.middleware.js` |
| **Controller** | Request normalization, error-to-HTTP mapping | `auth.controller.js` |
| **Service** | Business logic, transactions, DB queries | `auth.service.js` |
| **Model** | Schema, indexes, discriminators, statics | `User.model.js` |
| **Utility** | Cross-cutting: JWT, geo, pagination, error codes | `jwt.js`, `geo.js` |

### Key Design Decisions

- **Mongoose Discriminators** — `Donor` and `Hospital` share the `users` collection via discriminator inheritance, enabling polymorphic queries.
- **Haversine Geo-Matching** — Real distance-based scoring between donors and hospitals using the `geo.js` utility. Nearby donors rank higher.
- **Atomic Gamification** — Points awards use efficient `$inc` operations with idempotent checks against the `PointsTransaction` collection to prevent double-awards.
- **Dual JWT Tokens** — Short-lived access tokens + long-lived refresh tokens with blacklist support.
- **Maintenance Bypass** — Admin requests bypass maintenance mode; the check is cached in-memory (30s TTL) to avoid per-request DB hits.

## Core Business Flows

1. **Hospital Request Creation**: Hospitals broadcast specific blood or organ requests (e.g., Critical O- blood).
2. **Matching Engine**: The system identifies eligible donors based on blood compatibility and calculates a priority score using the Haversine distance formula (prioritizing nearby donors).
3. **Donor Response**: Matched donors accept the request and schedule an appointment.
4. **Donation Completion**: Upon successful donation, the system transitions the state to `completed` and automatically triggers gamification rewards.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Environment Configuration**:
   Copy the example environment file and fill in required values (e.g. MongoDB URI).
   ```bash
   cp .env.example .env
   ```
3. **Start the Development Server**:
   ```bash
   npm start
   ```
4. **Verify Runtime**:
   Ensure the API is active by checking the health endpoint:
   ```bash
   curl http://127.0.0.1:5000/health
   ```
5. **View API Documentation**:
   Open your browser to view the complete Swagger UI:
   - **Local**: `http://localhost:5000/api-docs`
   - **Production**: `https://your-api-url/api-docs`

## Key Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start backend with runtime checks |
| `npm run dev` | Start backend in watch mode |
| `npm test` | Run Vitest test suite |
| `npm run test:watch` | Run tests in watch mode for TDD |
| `npm run seed` | Seed local database with verified test accounts |
| `npm run seed-demo` | Seed rich demo dataset (donors, hospitals, requests, rewards, admins) |
| `npm run smoke` | Run smoke flow checks against a running server |
| `npm run test:auth-flow` | Run E2E authentication smoke tests |
| `npm run generate:openapi` | Regenerate `openapi.json` from route JSDoc annotations |

## Implemented Endpoint Coverage

The following feature groups are implemented and exposed under root and compatibility aliases (`/api/v1/*` where applicable):

- Authentication: login/register, OTP, email verification, refresh, logout, reset/forgot password, 2FA, FCM token lifecycle.
- Donor: profile, availability, matches, responses, donation eligibility, dashboard/recent activity, urgent request flows, health history.
- Hospital: profile, request CRUD, close request, monthly reports, staff, blood-bank settings, notification preferences, blood inventory summary.
- Appointments: donor booking, donor appointment list, donor cancellation.
- Donations: completion endpoint and donor appointment listing alias. Support for blood, plasma, platelets, and organ donations with type-specific cooldowns.
- Rewards: points/history, earning rules, catalog/listing aliases, redeem aliases, badges, redemptions, leaderboard, type-specific point multipliers.
- Analytics: personal donation stats, leaderboard, donation type statistics, system dashboard metrics (donor, admin).
- Campaigns: active campaigns listing, admin campaign CRUD, campaign performance metrics, seasonal point multipliers (1.0x - 3.0x).
- Admin: system health, maintenance, rewards config management, analytics/alerts, campaigns management, donor/hospital management, admin management, role-permissions management.
- Discovery/Help/Support/Notifications: hospital discovery endpoints, FAQ/documents, contact/support messaging, notification listing and mark-read.

## Test Suite

The project test suite is built with [Vitest](https://vitest.dev/) + MongoDB Memory Server and validates 427 test cases covering utilities, validation, matching, reward logic, analytics, campaigns, and token flows.

Baseline suites:

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `geo.test.js` | 14 | Haversine distance, location scoring, proximity |
| `matching.service.test.js` | 14 | Blood type compatibility, geo-scoring, N+1 elimination |
| `reward.service.test.js` | 13 | Tier calculation, atomic transactions, idempotency |
| `auth.validation.test.js` | 18 | Login/register validation, role-specific rules |
| `pagination.test.js` | 11 | Page/skip parsing, limit clamping, meta calculation |
| `jwt.test.js` | 6 | Token signing, verification, expiry, tamper detection |

```bash
npm test
```

## Rewards Configuration

Reward earning values are now stored in MongoDB via the singleton `RewardsConfig` document and cached in memory by the backend service layer.

Default config fields:

- `points`: `bloodDonation`, `emergencyResponse`, `profileCompletion`, `referral`, `firstDonation`
- `tiers`: `bronze`, `silver`, `gold`, `platinum`
- `tierBonuses`: `silver`, `gold`, `platinum`

Relevant endpoints:

- `GET /rewards/earning-rules` - frontend-friendly earning rules payload.
- `GET /admin/rewards/config` - view current reward config.
- `PUT /admin/rewards/config` - update reward config; validates required fields and tier ordering.

The service caches the config in memory and refreshes the cache immediately after admin updates or startup seeding.

The suite runs in non-parallel mode (`maxWorkers: 1`) to keep Mongo memory tests deterministic.

## Test Accounts

For Flutter development, bypass SMTP verification by seeding the database with pre-verified accounts:

```bash
npm run seed
```

> [!WARNING]
> The seed script is strictly for **development environments only**. Built-in safeguards will actively prevent this script from executing against `NODE_ENV=production` or Atlas production clusters.

This generates:
- **Donor**: `donor@test.com` / `SecurePass@123`
- **Hospital**: `hospital@test.com` / `SecurePass@123`

## E2E / Smoke Tests Notes

- The project includes smoke/E2E helper scripts under `scripts/` such as `scripts/smoke.js` and `scripts/fcm-e2e.js`.
- For automated E2E runs the server supports an `x-test-mode` header that helps bypass rate limits and supports test automation flows.
- `scripts/fcm-e2e.js` now auto-creates and auto-verifies a unique test donor account per run (helps avoid stale/unverified accounts during CI). Remove or revert this behavior if you prefer a fixed seeded account.

If you intend to run CI against a persistent test environment, ensure either:

- The seed script is run with verified accounts (`npm run seed`) or
- CI provides environment setup to pre-verify test email addresses.

## Technical Documentation

Detailed architectural notes, request collections, and OpenAPI files are located in the [`/docs`](docs/README.md) directory.

- **[docs/README.md](docs/README.md)**: Architecture, Auth Flows, and Testing details.
- **[docs/LifeLink-Auth-API.postman_collection.json](docs/LifeLink-Auth-API.postman_collection.json)**: Importable Postman workspace.
- **[openapi.yaml](openapi.yaml)**: OpenAPI / Swagger source of truth.

## Analytics & Campaigns Features

### Analytics System

Track donor engagement and participation with detailed statistics:

- **Personal Stats** (`GET /analytics/my-stats`): Donor's lifetime donations by type, total points, tier progress
- **Leaderboard** (`GET /analytics/leaderboard`): Top donors by points over specified period
- **Donation Types Stats** (`GET /analytics/donation-types`): System-wide distribution of blood, plasma, platelets, and organ donations
- **Dashboard** (`GET /analytics/dashboard`, Admin only): System metrics including total donors, completed donations, and points distributed

**Documentation**: See [docs/ANALYTICS_CAMPAIGNS.md](docs/ANALYTICS_CAMPAIGNS.md)

### Seasonal Campaigns System

Boost donor participation with time-limited campaigns featuring point multipliers:

- **Campaign Properties**: Name, multiplier (1.0x - 3.0x), date range, eligible donation types, optional blood type targeting
- **Active Campaigns** (`GET /campaigns/active`): Public endpoint showing current promotional campaigns
- **Campaign Management** (Admin):
  - Create campaigns: `POST /campaigns`
  - Update campaigns: `PUT /campaigns/{id}`
  - Activate/Deactivate: `POST /campaigns/{id}/activate` and `POST /campaigns/{id}/deactivate`
  - View metrics: `GET /campaigns/{id}/metrics`
  - List all: `GET /campaigns` with filters

**Example Campaign**:
```json
{
  "name": "Summer Blood Drive 2026",
  "multiplier": 2.0,
  "donationTypes": ["blood", "plasma"],
  "startDate": "2026-06-01T00:00:00Z",
  "endDate": "2026-08-31T23:59:59Z",
  "tags": ["seasonal", "summer"]
}
```

### Points System with Type-Specific Cooldowns

Donation types now include independent cooldown periods:

| Type | Points | Cooldown | Use Case |
|------|--------|----------|----------|
| Blood | 200 | 56 days | Whole blood donation |
| Plasma | 150 | 14 days | Plasma apheresis (frequent) |
| Platelets | 175 | 7 days | Platelet apheresis (most frequent) |
| Organ | 500 | 365 days | Organ donation (annual limit) |

**Campaign Multiplier Example**:
```
Plasma donation during "Plasma Incentive" campaign (2.0x multiplier):
Base points: 150
Campaign multiplier: 2.0x
Final points awarded: 300 (150 × 2.0)
```

**Documentation**: See [docs/ANALYTICS_CAMPAIGNS.md](docs/ANALYTICS_CAMPAIGNS.md) for comprehensive API reference and integration guide.
