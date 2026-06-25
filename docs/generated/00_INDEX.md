# LifeLink — Generated Documentation Index

> **Generated From:** Full codebase analysis — June 2026  
> **Methodology:** Evidence-first. Every statement traces to a source file.  
> **Anti-hallucination:** Unverifiable claims are omitted or explicitly flagged.

---

## Documentation Files

| # | File | Contents |
|---|------|----------|
| 01 | [Project Overview](01_Project_Overview.md) | System description, problem statement, objectives, user roles, core features, scope boundaries |
| 02 | [System Architecture](02_System_Architecture.md) | High-level architecture, layer diagram, component responsibilities, data flows, external integrations, middleware chain |
| 03 | [Database Design](03_Database_Design.md) | All 25 entities, ER diagram, key schema descriptions, critical indexes, discriminator pattern |
| 04 | [API Documentation](04_API_Documentation.md) | All route groups, endpoint tables, auth requirements, request lifecycle, error codes |
| 05 | [User Flow](05_User_Flow.md) | Donor/hospital/admin journeys, state machines, verification flow, rewards flow, escalation workflow |
| 06 | [Deployment Guide](06_Deployment_Guide.md) | Prerequisites, required services, environment variables, startup sequence, production checklist |
| 07 | [Technical Decisions](07_Technical_Decisions.md) | Architectural patterns, design decisions with rationale, security decisions, all with source citations |
| 08 | [Limitations & Future Work](08_Limitations_And_Future_Work.md) | Verified current limitations, technical debt, prioritized roadmap |

---

## Project Map (Phase 1 Output)

### Modules

```
LifeLink API
├── Auth Module          — Registration, login, OTP, FCM tokens, token refresh/blacklist
├── Donor Module         — Profile, matches, eligibility, health history, dashboard
├── Hospital Module      — Profile, settings, blood inventory, monthly reports
├── Request Module       — Blood request CRUD, lifecycle, QR verification
├── Donation Module      — Donation record management, completion
├── Appointment Module   — Booking, available slots, rescheduling, QR check-in
├── Rewards Module       — Points, tiers, badges, catalog, redemption, leaderboard
├── Notification Module  — In-app inbox, FCM push, outbox worker
├── Analytics Module     — Personal stats, leaderboard, donation type stats, admin dashboard
├── Discovery Module     — Hospital search with geo-distance
├── Admin Module         — User management, system settings, maintenance mode, audit log
├── Activity Module      — Append-only user timeline
├── Support Module       — User-submitted support messages
├── Help Module          — FAQ / help documents
└── Webhook Module       — External webhook receiver (stub, no logic)
```

### Dependencies

```
Auth Module          → MongoDB (User, Donor, Hospital, RefreshTokenBlacklist, OneTimeOtp)
                     → Resend (email: OTP, password reset)
                     → Firebase FCM (token management)

Request Module       → MongoDB (Request, Donation)
                     → Matching Service → Eligibility Service
                     → Notification Service → FCM, MongoDB (Notification)

Appointment Module   → MongoDB (Appointment, Donation, Hospital)

Donation Module      → MongoDB (Donation, Request, DonorPoints, PointsTransaction, Activity)
                     → Reward Service (points, badges)

Rewards Module       → MongoDB (DonorPoints, PointsTransaction, Badge, UserBadge,
                                RewardCatalog, RewardRedemption, RewardsConfig)

Admin Module         → MongoDB (all collections)
                     → Analytics Service

Notification Module  → MongoDB (Notification, NotificationOutbox)
                     → Firebase FCM

Background Workers:
  Outbox Worker      → MongoDB (NotificationOutbox) → FCM
  Escalation Worker  → MongoDB (Request, Donation) → Notification Service
```

### External Service Dependencies

| Service | Purpose | Optional? |
|---------|---------|-----------|
| MongoDB (6.0+) | Primary database | **Required** |
| Firebase Admin SDK | FCM push notifications | Optional (disabled if env vars absent) |
| Resend | Transactional email | Optional (OTP/reset won't work without it) |

---

## Key Facts for Future Developers

| Topic | Answer | Source |
|-------|--------|--------|
| What language / version? | Node.js 20+, ESM modules only | `package.json` |
| What framework? | Express.js 5.x | `package.json` |
| What database? | MongoDB 6+ via Mongoose 9.x | `package.json`, `src/config/db.js` |
| How are routes mounted? | No `/api` prefix; root-level paths | `src/app.js` |
| How are users modeled? | Single `users` collection; Donor and Hospital are discriminators | `src/models/` |
| How is auth implemented? | Stateless JWT; refresh token blacklisted in MongoDB on logout | `src/middlewares/auth.middleware.js` |
| How are push notifications sent? | Firebase Admin SDK (FCM HTTP v1), synchronously | `src/utils/fcm.js` |
| How is email sent? | Resend API (primary); Nodemailer also listed as dependency | `package.json` |
| Where is the API spec? | `openapi.yaml` (318 KB) at project root; interactive at `/api-docs` | `src/app.js`, `openapi.yaml` |
| How are tests run? | `npm test` → Vitest + SuperTest + in-memory MongoDB | `package.json`, devDependencies |
| Is Docker available? | No | `README.md` Known Limitations |
| Overall completion? | ~80% (core production-ready; DevOps missing) | `README.md`, `docs/PROJECT_STATUS.md` |
