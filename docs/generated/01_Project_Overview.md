# LifeLink — Project Overview

> **Document Type:** Software Documentation  
> **Version:** 1.0  
> **Generated From:** Codebase Analysis — June 2026  

---

## 1. System Description

**LifeLink** is a REST API backend for an emergency blood donation management platform. It serves as the authoritative server between a **Flutter mobile application** (iOS/Android) and external services (MongoDB, Firebase FCM, Resend email).

The system is built with **Node.js 20+ (ESM)** and **Express.js 5.x**, using **MongoDB** via Mongoose as its primary data store.

**Source:** `README.md`, `src/app.js`

---

## 2. Problem Statement

Blood shortages are critical emergencies where minutes matter. Two foundational gaps exist in the current healthcare landscape:

1. **Hospitals** lack a unified digital channel to quickly locate compatible, eligible donors in their geographic area.
2. **Donors** have no single platform to discover nearby blood requests, manage their medical eligibility, and receive recognition for their life-saving contributions.

**Source:** `README.md` — Problem Statement section

---

## 3. Objectives

Based on the implemented feature set, the system is designed to:

| Objective | Evidence |
|-----------|----------|
| Connect hospitals to compatible donors in real time | `src/services/matching.service.js`, `src/services/notification.service.js` |
| Enforce medical eligibility rules before a donor can be matched | `src/services/eligibility.service.js` |
| Support full donation lifecycle (request → match → accept → verify → complete) | `src/models/Donation.model.js`, `src/models/Request.model.js` |
| Incentivize repeat donations through a gamified rewards system | `src/services/reward.service.js`, `src/models/DonorPoints.model.js` |
| Provide administrative control and analytics | `src/controllers/admin.controller.js`, `src/services/analytics.service.js` |
| Deliver real-time emergency alerts via push notifications | `src/utils/fcm.js`, `src/services/notification.service.js` |

---

## 4. Target Users

The system defines four distinct user roles, enforced by Mongoose discriminators and role-based middleware:

| Role | Description | Evidence |
|------|-------------|----------|
| `donor` | Registered individuals who donate blood, plasma, or platelets | `src/models/Donor.model.js` |
| `hospital` | Medical institutions that create blood requests and verify donations | `src/models/Hospital.model.js` |
| `admin` | Platform administrators who manage users and system settings | `src/models/User.model.js` (role enum) |
| `superadmin` | Elevated administrators with full system access | `src/models/User.model.js` (role enum) |

**Source:** `src/models/User.model.js` — `role` field enum: `['donor', 'hospital', 'admin', 'superadmin']`

---

## 5. Core Features

### 5.1 Authentication & Identity
- Multi-role registration and login (donor / hospital / admin / superadmin)
- Email OTP verification (6-digit, 10-minute TTL, SHA-256 hashed in DB)
- JWT access tokens (default 7-day TTL) + refresh tokens (default 30-day TTL)
- Refresh token blacklisting via MongoDB collection
- Admin login requires a third-factor `adminKey` (bcrypt-hashed at rest)
- Separate login endpoints per role: `POST /auth/login`, `POST /auth/hospital/login`, `POST /auth/admin/login`
- Password reset via OTP email flow
- FCM device token lifecycle management (register, replace, remove on logout)

**Source:** `src/services/auth.service.js`, `src/routes/auth.routes.js`

### 5.2 Blood Request Lifecycle
- Hospitals create requests specifying: type (blood / plasma / platelets), blood type(s), urgency (low / medium / high / critical), quantity, deadline, and location
- Request transitions: `pending → in-progress → completed / cancelled`
- Urgency-based arrival deadlines: critical = 1 hr, high = 4 hr, medium = 8 hr, low = 24 hr
- Background worker auto-expires donations with missed arrival deadlines and re-opens requests

**Source:** `src/models/Request.model.js`, `src/workers/requestEscalation.worker.js`, `src/constants/request-timeout.constants.js`

### 5.3 Donor Matching Engine
- Blood-type compatibility matrix (all universal compatibility rules)
- Haversine formula geo-distance calculation between donor location and hospital location
- Configurable matching radius (default: 30 km standard, 60 km for critical/emergency urgency)
- Composite scoring combining blood type compatibility and geographic proximity
- Eligibility pre-check runs before any notification is sent

**Source:** `src/services/matching.service.js`, `src/utils/geo.js`, `src/utils/blood-type.js`

### 5.4 Donor Eligibility Engine
- Minimum age: 17 years
- Donation cooldowns by type: blood = 56 days, plasma = 14 days, platelets = 7 days, double red cells = 7 days; gender-adjusted for blood (male: 84 days, female: 112 days)
- Minimum hemoglobin level: 12.5 g/dL
- Travel deferral: 28-day deferral after return from malaria-risk countries (static list in `src/data/malariaRiskCountries.json`)
- Manual temporary deferral with configurable reason
- Suspension block: suspended or deleted accounts are ineligible

**Source:** `src/services/eligibility.service.js`

### 5.5 QR Code Verification Flow
- A QR token is generated per donation when a donor accepts a request
- Hospital scans the QR on-site to confirm donor identity
- Includes a verification checklist: ID verified, questionnaire completed, consent signed
- Atomic completion: donation marked `completed`, request quantity decremented, donor points awarded

**Source:** `src/models/Donation.model.js`, `src/controllers/request.controller.js`

### 5.6 Appointment System
- Donors can book a donation appointment at a hospital (4-step flow: location → date/time → user details → review)
- Available time slots fetched dynamically based on hospital working hours and `slotsPerHour` configuration
- Reschedule support (PATCH endpoint) with reschedule history tracking (max 10 entries)
- Unique partial index prevents duplicate active appointments per donor-hospital pair

**Source:** `src/models/Appointment.model.js`, `src/services/appointment.service.js`

### 5.7 Rewards & Gamification
- Points awarded per completed donation by type: blood = 200 pts, plasma = 150 pts, platelets = 175 pts, double red cells = 175 pts
- Four tiers based on lifetime points: bronze (0–999), silver (1000–2499), gold (2500–4999), platinum (5000+)
- Badge system with rarity levels (COMMON, RARE, EPIC, LEGENDARY) tied to donation milestones and emergency responses
- Reward catalog with redeemable items (coffee vouchers, movie tickets, gym memberships, etc.)
- Leaderboard ranking donors by lifetime points

**Source:** `src/services/reward.service.js`, `src/models/DonorPoints.model.js`, `src/models/Badge.model.js`

### 5.8 Notification System
- Dual-channel: in-app `Notification` documents + Firebase Cloud Messaging (FCM) push
- Notification types: `match`, `request`, `milestone`, `emergency`, `system`, `admin`, `appointment`
- Idempotency key prevents duplicate notifications on retry
- Auto-delete TTL: notifications expire after 90 days
- Notification outbox worker for deferred delivery

**Source:** `src/models/Notification.model.js`, `src/services/notification.service.js`, `src/workers/notificationOutbox.worker.js`

### 5.9 Admin Dashboard
- User management: list, suspend, delete, restore donors and hospitals
- System settings: maintenance mode toggle, configuration management
- Analytics: total donors, completed donations, system health metrics
- Reward catalog and configuration management
- Audit log for admin actions

**Source:** `src/controllers/admin.controller.js`, `src/services/admin.service.js`

### 5.10 Analytics
- Donor personal stats: lifetime donations by type, total points, tier progress
- System-wide leaderboard
- Donation type distribution statistics
- Admin dashboard metrics

**Source:** `src/services/analytics.service.js`, `src/routes/analytics.routes.js`

### 5.11 Activity Timeline
- Append-only event log per user covering all meaningful actions
- Display-ready `title` and `description` pre-rendered at write time
- Auto-pruned after 365 days via MongoDB TTL index

**Source:** `src/models/Activity.model.js`, `src/services/activity.service.js`

---

## 6. Scope Boundaries (Not Implemented)

| Gap | Source |
|-----|--------|
| Docker / docker-compose configuration | `README.md` — Known Limitations |
| CI/CD pipeline (GitHub Actions) | `README.md` — Known Limitations |
| Redis-backed rate limiting (currently in-memory) | `README.md` — Known Limitations |
| Async job queue (Bull/BullMQ) — workers use `setInterval` | `docs/PROJECT_STATUS.md` |
| Arabic (`ar.json`) localization — only `en.json` exists | `README.md` — Known Limitations |
| Webhook handler logic — endpoint exists but is a stub | `README.md` — Known Limitations |

---

## Confidence Report

**Verified Facts:**
- All features listed in Section 5 are traceable to source files in `src/`.
- Role names come directly from `User.model.js` role enum.
- Eligibility thresholds come directly from `eligibility.service.js` constants.
- Point values per donation type come directly from `reward.service.js` `POINTS_BY_TYPE` constant.
- Known limitations come from `README.md` and `docs/PROJECT_STATUS.md`.

**Assumptions:** None.

**Missing Information:**
- Flutter app source code is not in this repository; mobile-side behavior is inferred from API contracts and README.
- No LICENSE file was read; README states MIT License but the file was not found.

**Potential Uncertainty:**
- `nodemailer` is listed in `package.json` but primary email appears to be Resend; the precise fallback logic was not fully traced.
