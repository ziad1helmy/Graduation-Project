# 🩸 LifeLink

> **Emergency Blood Donation Management Platform**  
> A production-hardened REST API connecting hospitals with compatible donors through real-time matching, push notifications, and a gamified rewards system.

---

## Problem Statement

Blood shortages are critical emergencies where minutes matter. Hospitals lack a unified digital channel to quickly reach compatible, eligible donors in their area. Donors have no single platform to discover nearby requests, manage their eligibility, and be rewarded for their life-saving contributions.

LifeLink solves this by providing:
- A hospital-facing portal to post blood requests and broadcast emergencies
- A donor-facing mobile-optimized API for discovering requests, accepting them, and tracking impact
- An intelligent matching engine using blood-type compatibility + geo-proximity scoring
- Firebase Cloud Messaging (FCM) push notifications for real-time emergency alerts
- A tiered points + badges rewards system to incentivize repeat donations

---

## Core Features (Currently Implemented)

| Feature | Status |
|---|---|
| Multi-role authentication (donor / hospital / admin / superadmin) | ✅ Complete |
| Email OTP verification + password reset via OTP | ✅ Complete |
| JWT access + refresh tokens with blacklisting | ✅ Complete |
| FCM push notification registration & delivery | ✅ Complete |
| Blood request creation & lifecycle management | ✅ Complete |
| Donor eligibility engine (age, hemoglobin, intervals, travel) | ✅ Complete |
| Blood-type compatibility matching matrix | ✅ Complete |
| Geo-proximity scoring (Haversine distance) | ✅ Complete |
| QR code generation & verification for donation handoff | ✅ Complete |
| Appointment booking system | ✅ Complete |
| Points + tier rewards system | ✅ Complete |
| Badges & gamification engine | ✅ Complete |
| Admin dashboard & analytics | ✅ Complete |
| Maintenance mode with admin bypass | ✅ Complete |
| Audit logging | ✅ Complete |
| Activity/timeline feed | ✅ Complete |
| Notification inbox (in-app + FCM) | ✅ Complete |
| Hospital discovery & search | ✅ Complete |
| Donor health history management | ✅ Complete |
| Arabic/English localization support | ✅ Complete (en.json only) |
| Rate limiting (general + auth) | ✅ Complete |
| NoSQL injection sanitization | ✅ Complete |
| Soft-delete user accounts | ✅ Complete |
| Leaderboard | ✅ Complete |
| OpenAPI / Swagger docs | ✅ Complete |
| Webhook endpoint | 🔶 Stub (no handler logic) |
| Async notification queue | ❌ Not implemented (synchronous FCM) |
| Docker / CI/CD pipeline | ❌ Not implemented |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (ESM modules) |
| Framework | Express.js 5.x |
| Database | MongoDB (Mongoose 9.x ODM) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Push Notifications | Firebase Admin SDK (FCM HTTP v1) |
| Email | Resend API + Nodemailer |
| QR Codes | qrcode library |
| Security | Helmet, express-rate-limit, custom NoSQL sanitizer |
| Testing | Vitest + SuperTest + mongodb-memory-server |
| API Docs | Swagger UI (OpenAPI 3.x) |
| Logging | Custom structured logger (winston-style) |

## Project Coverage

- Authentication: login/register, OTP, email verification, refresh, logout, reset/forgot password, FCM token lifecycle.
- Donor: profile, availability, matches, responses, donation eligibility, dashboard/recent activity, urgent request flows, health history.
- Hospital: profile, request CRUD, close request, monthly reports, staff, blood-bank settings, notification preferences, blood inventory summary.
- Appointments: **Schedule Donation** (4-step flow: location → date/time → user details → review) and **Reschedule Donation** (update existing appointment date, time, and donation type) — both fully implemented in the Flutter frontend and integrated with backend APIs. Includes: available-slot fetching, donor booking, appointment list, appointment-by-ID, reschedule via PATCH, and donor cancellation.
- Donations: completion endpoint and donor appointment listing alias. Support for blood, plasma, and platelets donations with type-specific cooldowns.
- Rewards: points/history, earning rules, catalog/listing aliases, redeem aliases, badges, redemptions, leaderboard, type-specific point multipliers.
- Analytics: personal donation stats, leaderboard, donation type statistics, system dashboard metrics (donor, admin).
- Admin: system health, maintenance, rewards config management, analytics/alerts, donor/hospital management, admin management, role-permissions management.
- Discovery/Help/Support/Notifications: hospital discovery endpoints, FAQ/documents, contact/support messaging, notification listing and mark-read.

---

## Architecture Summary

```
Flutter App (iOS/Android)
        │
        ▼
  LifeLink REST API (Express.js)
        │
  ┌─────┼─────┐
  │     │     │
 Auth  Core  Admin
 Flow  Logic  Panel
        │
   MongoDB Atlas
        │
   Firebase FCM
   Resend Email
```

- **Pattern**: Controller → Service → Model (strict 3-tier)
- **Auth**: Stateless JWT with refresh token blacklist in MongoDB
- **Models**: Mongoose discriminator pattern (Donor and Hospital inherit from User)
- **Matching**: Synchronous batch query with Haversine geo-scoring
- **Notifications**: Dual-channel (in-app Notification doc + FCM push), fire-and-forget for FCM

---

## Folder Structure

```
LifeLink/
├── src/
│   ├── app.js              # Express app setup, middleware, route mounting
│   ├── server.js           # Entry point: DB connect, seed, listen
│   ├── config/
│   │   ├── db.js           # MongoDB connection
│   │   ├── env.js          # Environment variable config
│   │   └── swagger.js      # OpenAPI/Swagger spec
│   ├── constants/
│   │   └── rewards.constants.js
│   ├── controllers/        # HTTP request handlers (15 controllers)
│   ├── middlewares/        # auth, role, error, rateLimit, maintenance
│   ├── models/             # 25 Mongoose models
│   ├── routes/             # 18 route files
│   ├── services/           # Business logic layer (14 services)
│   ├── utils/              # Shared utilities (FCM, JWT, mailer, geo, etc.)
│   ├── validation/         # Input validation (manual, no Joi/Zod)
│   ├── locales/            # en.json translations
│   └── data/               # Static data (malariaRiskCountries.json)
├── tests/
│   ├── unit/               # Unit tests (vitest)
│   ├── integration/        # Integration tests (supertest + in-memory MongoDB)
│   ├── e2e/                # Smoke tests
│   └── helpers/            # Test factories and DB helpers
├── scripts/                # CLI utilities (seed, smoke, openapi gen)
├── config/
│   └── service-account.json  # Firebase service account (⚠️ DO NOT COMMIT)
├── docs/                   # All documentation
│   ├── archive/            # Historical/legacy docs
│   └── feature-research/   # Deep-dive subsystem docs
├── public/                 # Static files
├── openapi.yaml            # Full OpenAPI 3 specification
├── package.json
├── .env.example
└── README.md
```

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- MongoDB 6+ (local or Atlas)
- Firebase project with Admin SDK credentials
- Resend account for email

### 1. Clone & Install

```bash
git clone <repo-url>
cd LifeLink
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start Development Server

```bash
npm run dev
```

The API starts on `http://localhost:5000` by default.

## E2E / Smoke Tests Notes

- The project includes smoke/E2E helper scripts under `scripts/` such as `scripts/smoke.js` and `scripts/fcm-e2e.js`.
- For automated E2E runs the server supports an `x-test-mode` header that helps bypass rate limits and supports test automation flows.
- `scripts/fcm-e2e.js` now auto-creates and auto-verifies a unique test donor account per run (helps avoid stale/unverified accounts during CI). Remove or revert this behavior if you prefer a fixed seeded account.

If you intend to run CI against a persistent test environment, ensure either:

- The seed script is run with verified accounts (`npm run seed`) or
- CI provides environment setup to pre-verify test email addresses.

## Flutter Appointment Scheduling

Both the **Schedule Donation** and **Reschedule Donation** workflows are **fully implemented** in the Flutter frontend and **fully integrated** with the backend appointment management APIs.

### Schedule Donation (4-Step Wizard)

A guided multi-step flow for booking a new donation appointment:

| Step | Screen | Description |
|------|--------|-------------|
| 1 | Choose Location | Nearby hospitals and blood banks with real-time distances |
| 2 | Select Date & Time | Date picker + dynamic available time slots + donation type |
| 3 | Confirm User Details | Pre-filled profile info (name, phone, email) with validation |
| 4 | Review & Confirm | Full summary + preparation tips before final submission |
| ✅ | Confirmation Screen | Success message, next steps, appointment summary + QR Code |

**Backend API:** `POST /donations/book-appointment` → returns the created appointment object with its QR token.

### Reschedule Donation

Donors can modify an existing upcoming (`pending` / `confirmed`) appointment:

- View existing appointment details.
- Select a new date and available time slot (fetched from API).
- Optionally update the donation type.
- Review updated details before confirming.
- Existing appointment updated via `PATCH /donations/book-appointment/:appointmentId`.
- A fresh confirmation screen and updated QR Code are displayed on success.

### Key Capabilities

- ✅ Multi-step progress indicator on all steps.
- ✅ Form validation enforced on every required field (client + server).
- ✅ Pre-filled user profile information from `GET /donor/profile`.
- ✅ Dynamic time slots from `GET /donations/book-appointment/available-slots`.
- ✅ QR Code generated by backend and displayed in Flutter confirmation screens.
- ✅ Responsive mobile UI with smooth step transitions.
- ✅ Full backend API integration for both creating and updating appointments.

**Full documentation:** [docs/FLUTTER_DONATION_SCHEDULING.md](docs/FLUTTER_DONATION_SCHEDULING.md)

---

## Technical Documentation

Detailed architectural notes, request collections, and OpenAPI files are located in the [`/docs`](docs/README.md) directory.

- **[docs/README.md](docs/README.md)**: Architecture, Auth Flows, and Testing details.
- **[docs/LifeLink-Auth-API.postman_collection.json](docs/LifeLink-Auth-API.postman_collection.json)**: Importable Postman workspace.
- **[openapi.yaml](openapi.yaml)**: OpenAPI / Swagger source of truth.

## Analytics Features

### Analytics System

Track donor engagement and participation with detailed statistics:

- **Personal Stats** (`GET /analytics/my-stats`): Donor's lifetime donations by type, total points, tier progress
- **Leaderboard** (`GET /analytics/leaderboard`): Top donors by points over specified period
- **Donation Types Stats** (`GET /analytics/donation-types`): System-wide distribution of blood, plasma, and platelets donations
- **Dashboard** (`GET /analytics/dashboard`, Admin only): System metrics including total donors, completed donations, and points distributed

Server starts on `http://localhost:5000`  
API docs at `http://localhost:5000/api-docs`  
Health check at `http://localhost:5000/health`

### 4. Seed Demo Data (Optional)

```bash
npm run seed-demo
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No | `development` \| `production` \| `test` |
| `PORT` | No | Server port (default: 5000) |
| `MONGO_URI` | **Yes** | MongoDB connection string |
| `JWT_SECRET` | **Yes** | Access token signing secret |
| `JWT_REFRESH_SECRET` | No | Refresh token secret (falls back to JWT_SECRET) |
| `JWT_EXPIRES_IN` | No | Access token TTL (default: `7d`) |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token TTL (default: `30d`) |
| `RESEND_API_KEY` | No | Resend email API key |
| `MAIL_FROM` | No | Sender email address |
| `FIREBASE_PROJECT_ID` | No | Firebase project ID (disables FCM if absent) |
| `FIREBASE_CLIENT_EMAIL` | No | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | No | Firebase private key (escape `\n` chars) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | No | Alternative: path to service-account.json |
| `CORS_ORIGIN` | No | CORS allowed origin (default: `*`) |
| `BCRYPT_SALT_ROUNDS` | No | bcrypt rounds (default: 10) |

---

## Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
```

Test infrastructure uses `mongodb-memory-server` — no real MongoDB needed for tests.

---

## API Overview

Base URL: `http://localhost:5000`  
Interactive docs: `/api-docs`

| Group | Base Path | Description |
|---|---|---|
| Auth | `/auth` | Register, login, OTP, FCM tokens |
| Donor | `/donor` | Profile, requests, matches, donations |
| Hospital | `/hospital` | Profile, requests management |
| Admin | `/admin` | Full system management |
| Requests | `/requests` | Blood request lifecycle |
| Donations | `/donations` | Donation booking + appointment |
| Rewards | `/rewards` | Points, badges, leaderboard |
| Notifications | `/notifications` | In-app notification inbox |
| Analytics | `/analytics` | Donor-facing analytics |
| Discovery | `/hospitals` | Hospital search |
| Help | `/help` | Help documents |
| Support | `/support` | Support messages |
| Webhooks | `/api/webhooks` | External webhook receiver (stub) |

---

## Authentication Overview

1. **Signup** (`POST /auth/signup`) — donor-only public registration
2. **Email OTP verification** — 6-digit OTP, 10-min TTL, SHA-256 hashed in DB
3. **Login** (`POST /auth/login`) — returns `accessToken` (7d) + `refreshToken` (30d)
4. **Hospital login** (`POST /auth/hospital/login`) — email + password only
5. **Admin login** (`POST /auth/admin/login`) — email + password + `adminKey`
6. **FCM Token** registration on login for push notifications

All protected routes require: `Authorization: Bearer <accessToken>`

---

## Notification System Overview

Notifications are dual-channel:
1. **In-app**: Stored in `Notification` collection, polled by client
2. **FCM push**: Sent via Firebase Admin SDK to registered device tokens

FCM is sent **synchronously** in request lifecycle (known limitation — see KNOWN_ISSUES.md). Token cleanup is fire-and-forget: invalid tokens detected during multicast are removed from user records automatically.

---

## Current Implementation Status

> **Overall estimated completion: ~80%** (production-ready core, missing DevOps + async queue)

See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for the full audit.

---

## Known Limitations

- FCM notifications are **synchronous** — slow Firebase responses block API request completion
- No background job queue (Bull/BullMQ) for async notification processing
- No Docker / Kubernetes configuration
- No CI/CD pipeline
- Webhook endpoint is a stub with no handler logic
- Arabic localization has only `en.json` (no `ar.json`)
- `Donor.model.js` has a **duplicate `weight` field** definition
- Rate limiting uses in-memory store (resets on server restart; not Redis-backed)

---

## Roadmap Summary

| Priority | Goal |
|---|---|
| High | Async notification queue (Bull/Redis) |
| High | Docker + docker-compose setup |
| High | CI/CD pipeline (GitHub Actions) |
| Medium | Arabic (`ar.json`) translations |
| Medium | Webhook handler implementation |
| Medium | Redis-backed rate limiting |
| Low | ML-based predictive matching |
| Low | Monitoring / APM integration |

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full roadmap.

---

## Contributors

- Development Team — Graduation Project, 2025–2026

---

## License

MIT License — See LICENSE file for details.
