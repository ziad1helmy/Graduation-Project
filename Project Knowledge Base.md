# Project Knowledge Base

---

# 1. Project Overview

## 1.1 Project Summary

**LifeLink** is a full-stack emergency blood donation management platform developed as a university graduation project (2025–2026). The system consists of a cross-platform mobile application built with Flutter (targeting iOS and Android), a RESTful backend API built with Node.js and Express.js, and an independently deployed AI-powered chatbot service. Together, these components form a unified platform that connects blood donors with hospitals in real time, manages the end-to-end donation lifecycle, and incentivises repeat donation through a gamified rewards system.

The backend API is deployed on Render (`https://graduation-project-cy61.onrender.com`) and communicates with the Flutter mobile client over HTTPS. The AI chatbot is deployed as a separate service on Render (`https://donation-chatbot-1fie.onrender.com`) and is integrated directly into the donor-facing mobile interface.

**Sources:** `Backend/README.md`, `Frontend/lib/core/resources/api_manger/api_constants.dart`, `Backend/docs/generated/01_Project_Overview.md`

---

## 1.2 Business Problem

Blood shortages constitute critical medical emergencies in which the speed of donor mobilisation directly determines patient outcomes. Two foundational gaps exist in the current healthcare landscape:

1. **Hospital-side gap:** Medical institutions lack a unified digital channel to rapidly locate compatible, eligible blood donors within their geographic area. Locating donors through manual phone calls or fragmented registry systems is too slow for emergency scenarios.

2. **Donor-side gap:** Potential donors have no single platform through which they can discover nearby blood requests, verify their own medical eligibility, receive real-time emergency alerts, or be recognised and rewarded for their life-saving contributions. This absence of engagement infrastructure contributes to low repeat-donation rates.

LifeLink addresses both gaps by providing a hospital-facing portal for posting blood requests and broadcasting emergency alerts, and a donor-facing mobile application for discovering requests, accepting them, booking donation appointments, and tracking personal impact through a rewards system.

**Source:** `Backend/README.md` — Problem Statement section

---

## 1.3 Project Objectives

The platform is designed to achieve the following measurable objectives, each traceable to an implemented system feature:

| Objective | Implementation Evidence |
|-----------|------------------------|
| Connect hospitals to compatible, eligible donors in real time | Matching engine (`matching.service.js`) + FCM push notifications (`notification.service.js`) |
| Enforce medical eligibility rules before a donor can be matched or confirmed | Donor eligibility engine (`eligibility.service.js`) |
| Support the full donation lifecycle from request creation to physical verification | Blood request lifecycle + QR-code verification flow (`Donation.model.js`, `Request.model.js`) |
| Provide a structured appointment booking system for planned donations | Four-step appointment wizard with dynamic slot allocation (`appointment.service.js`) |
| Incentivise repeat donations through a points, tier, and badge rewards system | Gamification engine (`reward.service.js`, `DonorPoints.model.js`, `Badge.model.js`) |
| Deliver real-time emergency alerts via mobile push notifications | Firebase Cloud Messaging integration (`fcm.js`, `notification.service.js`) |
| Provide administrative oversight, user management, and system analytics | Admin dashboard and analytics module (`admin.service.js`, `analytics.service.js`) |
| Offer an AI-powered assistant to answer donor questions conversationally | Integrated chatbot with text and voice interface (`AskApiDataSource`, `VoiceCallScreen`) |

**Source:** `Backend/README.md`, `Backend/docs/generated/01_Project_Overview.md`

---

## 1.4 Target Users

The system defines four distinct user roles, each with a separate authentication pathway and a dedicated interface within the mobile application:

| Role | Description | Entry Point |
|------|-------------|-------------|
| **Donor** | Registered individuals who donate blood, plasma, or platelets. Self-registration is available. | `POST /auth/signup` → email OTP verification → `POST /auth/login` |
| **Hospital** | Medical institutions that create blood requests, manage their donor pipeline, and verify donations on-site using QR codes. Hospital accounts are created by an administrator. | `POST /auth/hospital/login` |
| **Admin** | Platform administrators responsible for user management, system configuration, reward catalogue management, and analytics monitoring. Admin accounts are created by a superadmin. | `POST /auth/admin/login` (requires `adminKey` third factor) |
| **Superadmin** | Elevated administrators with full system access, including the creation and management of admin accounts and the assignment of role-based permissions. | Same admin login endpoint with elevated role permissions |

**Source:** `Backend/src/models/User.model.js` — `role` enum field: `['donor', 'hospital', 'admin', 'superadmin']`

---

## 1.5 Core Features

### Multi-Role Authentication and Identity Management
The system provides separate registration and login flows for each user role. Donor self-registration requires email OTP verification (6-digit code, 10-minute TTL, SHA-256 hashed). All sessions are managed via stateless JWT access tokens (7-day TTL) and refresh tokens (30-day TTL) with MongoDB-backed blacklisting. Admin login requires an additional `adminKey` third-factor credential. Firebase Cloud Messaging (FCM) device tokens are registered at login and removed at logout to maintain accurate push notification targeting.

### Blood Request Lifecycle Management
Hospitals create blood requests specifying the donation type (blood, plasma, or platelets), required blood type, urgency level (low, medium, high, or critical), quantity, deadline, and location. Requests transition through a defined state machine: `pending → in-progress → completed / cancelled`. Urgency-based arrival deadlines govern how long a donor has to appear after accepting a request (critical: 1 hour; high: 4 hours; medium: 8 hours; low: 24 hours).

### Intelligent Donor Matching Engine
When a hospital creates a blood request, the system automatically identifies compatible and geographically proximate donors using a composite scoring algorithm. The engine applies a complete blood-type compatibility matrix and calculates Haversine geo-distances between donor and hospital coordinates. A configurable matching radius (30 km standard; 60 km for critical and emergency urgency) is applied. Only donors who pass a full eligibility pre-check are notified.

### Donor Eligibility Engine
Before any donor can accept a request or be notified of a match, the system verifies eight eligibility criteria: account standing, absence of chronic conditions, no active concurrent donation, minimum age of 17 years, no active temporary deferral, no travel-based malaria deferral (28-day window after return from risk countries), satisfaction of type-specific donation cooldowns (blood: 56 days; plasma: 14 days; platelets: 7 days), and a minimum haemoglobin level of 12.5 g/dL where recorded.

### QR Code Donation Verification
Upon a donor accepting a request, the system generates a unique QR token attached to the corresponding donation record. On the day of donation, the hospital scans the QR code using the mobile application to identify the donor and initiate an on-site verification checklist (identity verified, health questionnaire completed, consent signed). Once confirmed, the donation is atomically marked as completed, the request quantity is decremented, and points are awarded to the donor.

### Appointment Booking System
Donors may proactively schedule a donation appointment at a nearby hospital through a guided four-step wizard: (1) choose a hospital from a geo-sorted list; (2) select an available date and time slot; (3) confirm personal details; (4) review and submit. Available slots are computed dynamically from the hospital's working hours and configured slots-per-hour capacity. Reschedule support is provided via a PATCH endpoint, with a history of up to ten reschedules tracked per appointment.

### Gamified Rewards System
Completed donations trigger an automatic, atomic point award: blood = 200 pts; platelets = 175 pts; double red cells = 175 pts; plasma = 150 pts. Donors progress through four tiers based on lifetime points: bronze (0–999), silver (1,000–2,499), gold (2,500–4,999), and platinum (5,000+). A badge system with four rarity levels (Common, Rare, Epic, Legendary) unlocks based on donation milestones and emergency response behaviour. A redeemable reward catalogue and a system-wide leaderboard complete the gamification layer.

### Dual-Channel Notification System
The system dispatches notifications through two concurrent channels: in-app notification documents stored in MongoDB (polled by the client), and Firebase Cloud Messaging (FCM) push notifications delivered to registered device tokens. A background notification outbox worker processes deferred deliveries. Notification types include match alerts, request updates, donation milestones, emergency broadcasts, appointment reminders, and system messages.

### Admin Dashboard and Analytics
The administrative interface provides full user lifecycle management (list, suspend, unsuspend, delete, restore), blood request oversight with the ability to manually broadcast, fulfil, or cancel requests, system health monitoring, maintenance mode control (blocking all non-admin traffic), reward catalogue and configuration management, audit logging of administrative actions, and analytics covering donor engagement, donation type distribution, and top-donor leaderboards.

### AI-Powered Conversational Assistant
A dedicated chatbot interface is integrated into the donor-facing mobile application, enabling donors to ask blood-donation-related questions in natural language. The chatbot supports both text-based interaction and a voice call mode (using speech-to-text input and text-to-speech output) in both English and Arabic. The chatbot communicates with an independently deployed AI service via a streaming Server-Sent Events (SSE) endpoint.

**Sources:** `Backend/README.md`, `Backend/docs/generated/01_Project_Overview.md`, `Frontend/lib/core/resources/api_manger/api_constants.dart`, `Frontend/lib/presentation/role/donor/tabs/chat_bot/voice_call_screen.dart`

---

## 1.6 System Modules

The system is composed of the following primary modules:

| Module | Technology Layer | Responsibility |
|--------|-----------------|----------------|
| **Flutter Mobile Application** | Frontend | Cross-platform donor, hospital, and admin UI with role-based navigation |
| **LifeLink REST API** | Backend | Core business logic, authentication, data persistence, and external service orchestration |
| **AI Chatbot Service** | AI / External | Conversational question-answering and voice assistant for blood donation guidance |
| **Authentication & Identity** | Backend | Multi-role JWT-based auth, OTP email verification, refresh token rotation |
| **Blood Request Management** | Backend | Full request lifecycle: creation, matching, acceptance, verification, completion |
| **Donor Matching Engine** | Backend | Blood-type compatibility + Haversine geo-proximity scoring |
| **Donor Eligibility Engine** | Backend | Medical eligibility rule enforcement before match or notification |
| **Appointment System** | Backend + Frontend | Four-step booking wizard, slot management, reschedule, QR confirmation |
| **QR Verification System** | Backend + Frontend | On-site donation handoff via QR token scan and checklist |
| **Notification System** | Backend | Dual-channel (in-app + FCM push) event-driven notifications |
| **Rewards & Gamification** | Backend | Points, tiers, badges, leaderboard, redeemable reward catalogue |
| **Analytics Module** | Backend | Donor personal stats, system-wide dashboards, donation type distribution |
| **Admin Management Module** | Backend + Frontend | User lifecycle, system health, maintenance mode, reward configuration |
| **Background Workers** | Backend | Request escalation worker (60s interval) and notification outbox worker (5s interval) |
| **Activity Timeline** | Backend | Append-only per-user event log with 365-day TTL |

**Sources:** `Backend/src/services/`, `Backend/src/workers/`, `Frontend/lib/presentation/role/`, `Frontend/lib/core/resources/api_manger/api_constants.dart`

---

## 1.7 High-Level Workflow

The primary end-to-end workflow of the system proceeds as follows:

**Donor Journey:**
1. A donor registers via the mobile application, completes email OTP verification, and logs in.
2. The donor receives FCM push notifications when a compatible blood request is created nearby.
3. The donor browses matched requests or views urgent requests on the home screen.
4. The donor accepts a request; the eligibility engine performs an eight-point pre-check.
5. If eligible, a donation record is created, a QR token is generated, and an arrival deadline is set.
6. On the day of donation, the donor presents the QR code at the hospital.
7. The hospital scans the QR code, completes the verification checklist, and confirms the donation.
8. Upon confirmation, points are atomically awarded, badges are evaluated, tier progression is checked, and the donor receives a push notification confirming the completed donation.

**Hospital Journey:**
1. A hospital account is created by an administrator; the hospital logs in via a dedicated endpoint.
2. The hospital creates a blood request specifying type, blood group, urgency, quantity, and location.
3. The matching engine identifies compatible and eligible donors and dispatches notifications.
4. The hospital monitors incoming donor acceptances and their expected arrival status.
5. On donation day, hospital staff scan the donor's QR code using the mobile application.
6. After completing the on-site checklist, the hospital confirms the donation, atomically closing the request if all required units have been fulfilled.
7. If a donor fails to arrive within the urgency-based deadline, the background escalation worker re-opens the request and re-broadcasts to a new batch of compatible donors.

**Donor — Proactive Appointment Booking:**
1. A donor navigates to the Schedule Donation section and selects a hospital from a geo-sorted list.
2. The donor selects a date and available time slot (fetched dynamically from the API).
3. The donor confirms pre-filled personal details and reviews the appointment summary.
4. Upon submission, the appointment is created and the donor receives a QR code for the booked session. Existing appointments may be rescheduled via a PATCH endpoint.

**Sources:** `Backend/README.md`, `Backend/docs/generated/05_User_Flow.md`, `Backend/docs/generated/01_Project_Overview.md`

---

## 1.8 High-Level Architecture

LifeLink follows a three-tier REST API architecture with an additional independent AI service layer:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Flutter Mobile Application                       │
│              (iOS / Android — Donor, Hospital, Admin UI)             │
│              BLoC / Cubit state management  |  Dio HTTP client       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS / REST JSON
          ┌────────────────┴──────────────────┐
          │                                   │
┌─────────▼──────────────────────┐   ┌────────▼──────────────────┐
│     LifeLink REST API           │   │   AI Chatbot Service       │
│   (Express.js 5.x / Node.js 20)│   │   (External Render deploy) │
│                                 │   │   /ask  — single response  │
│  Routes → Middleware →          │   │   /chat — SSE stream       │
│  Controllers → Services →       │   └───────────────────────────┘
│  Repositories → Models          │
│                                 │
│  Background Workers:            │
│  - Escalation Worker (60s)      │
│  - Notification Outbox (5s)     │
└──────────────┬──────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐  ┌──▼────┐  ┌──▼────┐
│MongoDB│  │Firebase│  │Resend │
│Atlas  │  │  FCM   │  │ Email │
└───────┘  └───────┘  └───────┘
```

**Internal backend layer dependency rule (strictly enforced):**
Routes → Middlewares → Controllers → Services → Repositories → Models → MongoDB

No cross-layer imports are permitted in the reverse direction. A service may not import a controller; a model may not import a service.

**Sources:** `Backend/docs/generated/02_System_Architecture.md`, `Backend/AGENTS.md`, `Frontend/lib/core/resources/api_manger/api_constants.dart`

---

## 1.9 Technology Stack

### Frontend
| Concern | Technology |
|---------|-----------|
| Framework | Flutter (Dart SDK ^3.9.0) |
| Target Platforms | iOS, Android (primary); Linux, macOS, Windows, Web (configured) |
| State Management | flutter_bloc 9.x (BLoC / Cubit pattern) |
| HTTP Client | Dio 5.x with custom `AuthInterceptor` (automatic JWT refresh) |
| Local Storage | Hive CE 2.x |
| Maps & Geolocation | Google Maps Flutter 2.x, Geolocator 14.x, Geocoding 4.x |
| Push Notifications | Firebase Messaging 16.x, Flutter Local Notifications 20.x |
| QR Code | qr_flutter 4.x (display), mobile_scanner 7.x (scan) |
| Charts | fl_chart 1.x |
| PDF Viewer | Syncfusion Flutter PDFViewer 33.x |
| Voice Interface | speech_to_text 7.x, flutter_tts 4.x |
| Internationalisation | flutter_localizations, intl 0.20.x |
| Splash / Icons | flutter_native_splash 2.x, flutter_launcher_icons 0.14.x |

### Backend
| Concern | Technology |
|---------|-----------|
| Runtime | Node.js 20+ (ES Modules) |
| Framework | Express.js 5.x |
| Database | MongoDB via Mongoose 9.x ODM |
| Authentication | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| Push Notifications | Firebase Admin SDK 13.x (FCM HTTP v1) |
| Email | Resend API (`resend` 6.x) + Nodemailer 8.x |
| QR Codes | `qrcode` 1.x |
| Security | Helmet 8.x, express-rate-limit 8.x, express-mongo-sanitize 2.x |
| API Documentation | Swagger UI Express 5.x (OpenAPI 3.x), swagger-jsdoc 6.x |
| Testing | Vitest 4.x, SuperTest 7.x, mongodb-memory-server 11.x |
| Logging | Custom structured logger (Morgan 1.x for HTTP logging) |

### AI Chatbot Service
| Concern | Technology |
|---------|-----------|
| Deployment | Render (independent service) |
| Communication Protocol | REST (`/ask` endpoint) and Server-Sent Events streaming (`/chat` endpoint) |

**Sources:** `Frontend/pubspec.yaml`, `Backend/package.json`, `Frontend/lib/core/resources/api_manger/api_constants.dart`

---

## 1.10 External Services

| Service | Provider | Purpose |
|---------|----------|---------|
| **Database** | MongoDB Atlas | Primary data store for all application data (donors, hospitals, requests, donations, appointments, rewards, notifications, audit logs) |
| **Push Notifications** | Firebase Cloud Messaging (FCM) — Google | Real-time mobile push notifications delivered to donor and hospital devices; Firebase Admin SDK used on the server side |
| **Email Delivery** | Resend API | Transactional email delivery for OTP verification codes, password reset codes, and system notifications. Nodemailer is also available as a secondary transport. |
| **AI Chatbot** | Custom service deployed on Render | Conversational AI assistant for donor-facing blood donation guidance, accessible via `/ask` (single response) and `/chat` (SSE streaming) endpoints at `https://donation-chatbot-1fie.onrender.com` |
| **Maps & Geocoding** | Google Maps Platform | Interactive map rendering in the Flutter application (Google Maps Flutter SDK), forward and reverse geocoding (Geocoding package), and geo-distance calculations |
| **Backend Hosting** | Render | Cloud hosting for the LifeLink REST API at `https://graduation-project-cy61.onrender.com` |

**Sources:** `Backend/.env.example`, `Backend/package.json`, `Frontend/pubspec.yaml`, `Frontend/lib/core/resources/api_manger/api_constants.dart`

---

# 2. Backend Knowledge

## 2.1 Backend Overview

The LifeLink backend is a RESTful API service implemented in **Node.js 20** using the **Express.js 5.x** framework. The application is written entirely using the **ES Modules** (ESM) standard (`"type": "module"` in `package.json`), which is enforced project-wide. The backend is hosted on Render at `https://graduation-project-cy61.onrender.com` and communicates with a **MongoDB Atlas** database, a **Firebase Cloud Messaging** (FCM) push notification service, and a **Resend** transactional email service.

The primary responsibilities of the backend are:

- Authenticating and authorising four distinct user roles (donor, hospital, admin, superadmin).
- Orchestrating the end-to-end blood donation lifecycle, from request creation to physical QR code verification and post-donation reward processing.
- Running two in-process background workers that handle time-sensitive automation: arrival deadline enforcement and deferred notification delivery.
- Exposing a machine-readable OpenAPI 3.x specification via Swagger UI at `/api-docs`.

The backend applies a strict unidirectional dependency rule:

> **Routes → Middlewares → Controllers → Services → Repositories → Models → MongoDB**

No layer may import from a layer above it. This rule is documented in `Backend/AGENTS.md` and is the defining constraint governing all engineering decisions in the codebase.

**Sources:** `Backend/src/server.js`, `Backend/src/app.js`, `Backend/package.json`, `Backend/AGENTS.md`

---

## 2.2 Backend Architecture

The backend follows a **layered monolithic architecture** with clearly separated horizontal responsibilities. The architecture can be characterised as follows:

```
┌──────────────────────────────────────────────────────────────────┐
│                   Express Application (app.js)                    │
│  Global Middleware Stack: Helmet, CORS, Logger, i18n, Sanitizer  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │        Route Layer           │
              │  16 route modules mounted    │
              │  on distinct URL prefixes    │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │      Middleware Layer         │
              │ auth, role, rate-limit,       │
              │ maintenance, async wrapper    │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │      Controller Layer         │
              │  14 controllers              │
              │  HTTP request / response     │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │       Service Layer           │
              │  18 service modules          │
              │  Core business logic         │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │      Repository Layer         │
              │  7 repositories + BaseRepo   │
              │  Data access abstraction     │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │       Model Layer             │
              │  25 Mongoose models          │
              │  MongoDB schemas             │
              └──────────────┬──────────────┘
                             │
                        ┌────▼────┐
                        │MongoDB  │
                        │ Atlas   │
                        └─────────┘
```

**Supplementary Architectural Components:**

| Component | Description |
|-----------|-------------|
| **EventBus** (`eventBus.service.js`) | A singleton `EventEmitter`-based pub/sub bus that decouples service-to-service communication. Services emit typed domain events; listeners in `eventListeners.registry.js` handle cross-service side effects asynchronously. |
| **State Machine** (`state-machine.js`) | A centralised transition engine that is the single source of truth for all entity status changes. All controllers and services must call `validateTransition()` before persisting a status mutation. |
| **Background Workers** (`workers/`) | Two `setInterval`-driven workers launched at startup: the notification outbox worker (5-second poll) and the request escalation worker (60-second poll). |
| **Swagger/OpenAPI** | A complete OpenAPI 3.x specification is maintained in `openapi.yaml`. Swagger UI is served at `/api-docs` in all non-test environments. |

**Sources:** `Backend/src/app.js`, `Backend/src/server.js`, `Backend/src/utils/state-machine.js`, `Backend/src/services/eventBus.service.js`, `Backend/AGENTS.md`

---

## 2.3 Folder Structure

The backend source tree resides under `Backend/src/` and is organised strictly by layer:

```
Backend/
├── config/                    # Firebase service account JSON
├── docs/                      # Generated architecture documentation
├── openapi.yaml               # Full OpenAPI 3.x specification
├── package.json               # Node.js project manifest (ESM, scripts)
├── src/
│   ├── app.js                 # Express application factory (middleware + route mounting)
│   ├── server.js              # Entry point: DB connect, seed, HTTP listen, worker start
│   ├── config/
│   │   ├── db.js              # Mongoose connection management + health check
│   │   ├── env.js             # Centralised environment variable loading and validation
│   │   └── swagger.js         # Swagger/OpenAPI spec initialisation
│   ├── constants/
│   │   ├── donation.constants.js
│   │   ├── events.js          # Domain event name registry (frozen object enums)
│   │   ├── request.constants.js
│   │   ├── request-timeout.constants.js
│   │   └── rewards.constants.js
│   ├── controllers/           # 14 controllers — HTTP I/O only, no business logic
│   ├── locales/
│   │   ├── en.json            # English i18n strings
│   │   └── ar.json            # Arabic i18n strings
│   ├── middlewares/
│   │   ├── asyncHandler.js    # Wraps async handlers to forward errors to Express
│   │   ├── auth.middleware.js # JWT validation, user hydration
│   │   ├── error.middleware.js # Centralised error handler
│   │   ├── i18n.middleware.js # Language detection, req.t() injection
│   │   ├── maintenance.middleware.js # 503 gate with 30-second cached check
│   │   ├── rateLimit.middleware.js   # Dynamic rate-limit selector
│   │   └── role.middleware.js  # requireRole(...roles) RBAC guard
│   ├── models/                # 25 Mongoose schemas (discriminators for User/Donor/Hospital)
│   ├── repositories/          # 7 repository classes extending BaseRepository
│   ├── routes/                # 16 Express Router modules
│   ├── services/              # 18 service modules — business logic
│   ├── utils/                 # 28 utility modules (JWT, FCM, mailer, logger, geo, etc.)
│   ├── validation/            # 5 input-validation modules (Joi-style object validators)
│   ├── workers/
│   │   ├── notificationOutbox.worker.js
│   │   └── requestEscalation.worker.js
│   └── data/
│       └── malariaRiskCountries.json  # Malaria-risk country list for travel deferral
└── tests/                     # Vitest + SuperTest test suite
```

**Sources:** `Backend/src/` (directory listing)

---

## 2.4 Application Layers

### Layer 1 — Routes
Sixteen Express `Router` modules are mounted in `app.js` at distinct URL prefixes. Route files contain no business logic; they declare the HTTP method, path, and the ordered middleware chain (auth, role guard, controller handler) for each endpoint. Route files explicitly note that static paths must be declared before parameterised paths to prevent route shadowing.

### Layer 2 — Middlewares
Eight middleware modules form the per-request processing pipeline:

| Middleware | Responsibility |
|------------|---------------|
| `auth.middleware.js` | Extracts and verifies the JWT Bearer token; hydrates `req.user` with the authenticated user's identity and role. Also enforces `passwordChangedAt` credential epoch to invalidate tokens issued before a password change. |
| `role.middleware.js` | `requireRole(...roles)` factory — checks that `req.user.role` is in the permitted set; returns 403 otherwise. |
| `rateLimit.middleware.js` | Dynamic rate-limit selector. Classifies each request by path pattern and applies one of six pre-configured limiters (auth, expensive GET, search/filter, dashboard/list, route-specific, default). |
| `maintenance.middleware.js` | Reads `SystemSettings` from MongoDB and returns 503 when maintenance mode is active. Uses a 30-second in-memory cache to avoid a database round-trip on every request. Admin and superadmin requests always bypass this gate. |
| `error.middleware.js` | Centralised Express error handler. Recognises `HttpError`, `TokenExpiredError`, `JsonWebTokenError`, Mongoose `ValidationError`, `CastError`, and duplicate-key error (code 11000). All errors are normalised through the `response.error()` utility. |
| `i18n.middleware.js` | Detects the request language from (in priority order): authenticated user preference, `?lang=` query parameter, `Accept-Language` header. Exposes `req.t(key)` for key-based translation and `req.lang` for the resolved locale. |
| `asyncHandler.js` | Higher-order function wrapping any async route handler so that thrown exceptions are automatically forwarded to the next error handler without explicit try/catch. |
| `donor-rate-limit.middleware.js` | Dedicated per-donor rate limiter for high-frequency donor-facing endpoints. |

### Layer 3 — Controllers
Fourteen controller files handle HTTP-level concerns only: parsing request parameters, invoking service methods, and formatting responses via the `response.success()` / `response.error()` utilities. Controllers contain no business logic or database queries.

| Controller | Domain |
|------------|--------|
| `auth.controller.js` | Registration, login (donor/hospital/admin), logout, token refresh, OTP flows, FCM token management |
| `donor.controller.js` | Donor profile, health history, dashboard, eligibility status |
| `hospital.controller.js` | Hospital profile, blood request creation and management, appointment verification |
| `request.controller.js` | Request acceptance, QR verification, cancellation, confirmation, rejection |
| `donation.controller.js` | Donation history, status, QR token retrieval, appointment booking |
| `appointment.controller.js` | Appointment creation, reschedule, cancellation |
| `reward.controller.js` | Points balance, tier, badges, leaderboard, reward redemption |
| `notification.controller.js` | Notification listing, mark-as-read, push registration |
| `admin.controller.js` | User management, request oversight, system health, reward configuration, audit logs |
| `analytics.controller.js` | Donor stats, donation distribution, top-donor leaderboard |
| `discovery.controller.js` | Hospital geo-discovery, nearby hospitals listing |
| `activity.controller.js` | Per-user activity timeline |
| `help.controller.js` | Help document retrieval |
| `webhook.controller.js` | Resend email webhook processing |

### Layer 4 — Services
Eighteen service modules contain all business logic. Services call repositories and utility modules; they never access the HTTP layer.

| Service | Responsibility |
|---------|---------------|
| `auth.service.js` | Registration, login credential validation, OTP generation/verification, token lifecycle, FCM token management, password change/reset |
| `eligibility.service.js` | Eight-rule sequential eligibility engine for donor qualification |
| `matching.service.js` | Blood-type compatibility + Haversine geo-distance donor-to-request and request-to-donor matching |
| `donation.service.js` | Donation record creation, QR token generation, status queries |
| `donation-completion.service.js` | Atomic donation confirmation: status transition, quantity decrement, point award trigger |
| `request.service.js` | Request creation and basic CRUD |
| `request-lifecycle.service.js` | State transitions across request lifecycle; coordinates donation and request status updates |
| `appointment.service.js` | Available slot computation, booking, rescheduling, QR confirmation |
| `reward.service.js` | Point award, tier evaluation, badge unlock, leaderboard, reward catalogue management |
| `notification.service.js` | Dual-channel notification dispatch (in-app + FCM) for all system events |
| `admin.service.js` | User lifecycle management, system settings, maintenance mode, reward config, audit log creation |
| `analytics.service.js` | Aggregation pipelines for donation statistics, engagement metrics, and top-donor rankings |
| `activity.service.js` | Append-only donor activity timeline with 365-day TTL |
| `audit.service.js` | Administrative action audit log creation |
| `hospital.service.js` | Hospital profile utilities |
| `rewardsConfig.service.js` | Rewards configuration initialisation and retrieval |
| `eventBus.service.js` | Singleton pub/sub EventEmitter for decoupled inter-service communication |
| `eventListeners.registry.js` | Registers all domain event listeners at startup |

### Layer 5 — Repositories
Seven repository classes extend `BaseRepository`, which provides generic CRUD, `findAndCount`, `aggregate`, `bulkWrite`, and `exists` operations over a Mongoose model. Domain-specific repositories add query methods relevant to their entity.

| Repository | Domain |
|------------|--------|
| `BaseRepository.js` | Abstract base with generic CRUD and aggregation |
| `DonorRepository.js` | Geo-proximity donor queries, eligibility filtering |
| `RequestRepository.js` | Status-filtered request queries, geo-near aggregations |
| `DonationRepository.js` | Donation history, active donation checks |
| `AppointmentRepository.js` | Slot availability, appointment lookup |
| `NotificationRepository.js` | Notification listing, unread count |
| `ActivityRepository.js` | Timeline event insertion and retrieval |

### Layer 6 — Models
Twenty-five Mongoose schema definitions. The `User` model uses **Mongoose discriminators** to implement role-specific schema extension: the `Donor` and `Hospital` sub-models share the `User` base schema and add their own fields, stored in the same `users` MongoDB collection with a `__t` discriminator key.

**Sources:** `Backend/src/controllers/`, `Backend/src/services/`, `Backend/src/repositories/`, `Backend/src/models/`, `Backend/src/middlewares/`

---

## 2.5 API Categories

The API exposes sixteen route groups, each mounted at a distinct base path. All routes except `/auth`, `/health`, `/`, and webhook endpoints require a valid JWT Bearer token.

| Base Path | Route File | Primary Role(s) | Description |
|-----------|-----------|-----------------|-------------|
| `/auth` | `auth.routes.js` | All | Registration, login, logout, OTP, token refresh, FCM token management |
| `/donor` | `donor.routes.js` | donor | Profile, health history, dashboard, eligibility check, notification preferences |
| `/hospital` | `hospital.routes.js` | hospital, admin | Hospital profile, settings, request creation and management |
| `/requests` | `request.routes.js` | All authenticated | Request details, acceptance, QR verification, confirmation, rejection |
| `/donations/book-appointment` | `appointment.routes.js` | donor | Four-step appointment booking and rescheduling |
| `/appointments` | `appointmentVerify.routes.js` | hospital, donor | QR-based appointment verification at the hospital |
| `/donations` | `donation.routes.js` | donor, hospital | Donation history, active donation details, QR code retrieval |
| `/rewards` | `reward.routes.js` | donor, admin | Points, tiers, badges, leaderboard, reward catalogue, redemption |
| `/notifications` | `notification.routes.js` | All authenticated | List, mark-read, and delete notifications |
| `/hospitals` | `discovery.routes.js` | donor, hospital | Geo-sorted hospital discovery and search |
| `/analytics` | `analytics.routes.js` | donor, admin | Personal stats and system-wide donation analytics |
| `/admin` | `admin.routes.js` | admin, superadmin | User management, system health, reward config, audit logs, emergency oversight |
| `/donor` (activity) | `activity.routes.js` | donor | Per-donor activity timeline |
| `/help` | `help.routes.js` | All | Help documents and FAQs |
| `/support` | `support.routes.js` | All authenticated | Donor support message submission |
| `/api/webhooks` | `webhook.routes.js` | — | Resend inbound email webhook (raw body, no auth) |

**Notable endpoint patterns:**

- `GET /requests/nearby?lat=&lng=` — geo-proximity blood request discovery
- `POST /requests/:id/accept` — donor acceptance triggering eligibility check + QR generation
- `POST /requests/verify-qr` — hospital QR scan initiating donation confirmation
- `GET /donations/book-appointment/available-slots` — dynamic slot computation
- `GET /rewards/leaderboard` — system-wide donor ranking
- `POST /admin/system/maintenance` — maintenance mode toggle

**Sources:** `Backend/src/app.js`, `Backend/src/routes/`

---

## 2.6 Authentication

The authentication system is implemented in `auth.service.js`, `auth.middleware.js`, and `auth.routes.js`. It is stateless at the token level and enforces role separation at both registration and login.

### Token Architecture

| Token Type | Secret | TTL | Purpose |
|------------|--------|-----|---------|
| Access Token | `JWT_SECRET` | 7 days (configurable via `JWT_EXPIRES_IN`) | Authorises all protected API calls via the `Authorization: Bearer <token>` header |
| Refresh Token | `JWT_REFRESH_SECRET` (must differ from `JWT_SECRET` in production) | 30 days (configurable via `JWT_REFRESH_EXPIRES_IN`) | Obtains a new access token without re-login |

Refresh token revocation is implemented using a **MongoDB blacklist** (`RefreshTokenBlacklist` collection). The token itself is never stored; only its SHA-256 hash is persisted alongside the expiry date, enabling automatic TTL-based cleanup.

### Credential Epoch Enforcement

Every `User` document carries a `passwordChangedAt` timestamp. Both the `auth.middleware.js` and the `refreshToken` service function compare this timestamp against the token's `iat` (issued-at) claim. A token issued before the most recent password change is rejected, ensuring that all sessions are invalidated on password reset or change.

### Email OTP Verification

Donor registration is a two-step process:
1. A 6-digit OTP is generated (`Math.random()`, 6 digits), hashed with SHA-256 (`crypto.createHash('sha256')`), and stored in the `emailVerificationOtp` field of the `User` document with a 10-minute expiry.
2. The donor submits the OTP to `POST /auth/verify-email-otp`. On match, `isEmailVerified` is set to `true` and the OTP fields are cleared.

The `auth.middleware.js` rejects all requests from accounts where `isEmailVerified` is `false`.

### Password Reset (OTP-Based)

Password reset uses a separate `OneTimeOtp` collection, allowing multiple purposes (`password_reset`, etc.) to coexist. The flow is:
1. `POST /auth/forgot-password` — generates a 6-digit OTP (TTL: 10 minutes), hashed in `OneTimeOtp`.
2. `POST /auth/verify-otp` — verifies the OTP (maximum 5 attempts).
3. `POST /auth/reset-password` — verifies OTP again, updates the password, and shifts `passwordChangedAt` to invalidate all existing tokens.

### Role-Specific Login Endpoints

| Endpoint | Validates |
|----------|-----------|
| `POST /auth/login` | Donor credential + role check |
| `POST /auth/hospital/login` | Hospital credential + `hospitalId` third field |
| `POST /auth/admin/login` | Admin credential + `adminKey` third factor (AES-256-GCM encrypted, per-admin) |

The `adminKey` is encrypted at rest using AES-256-GCM with a per-admin IV, key derived via `scryptSync` from `JWT_SECRET` and the admin's user ID (`admin-key-crypto.js`).

### FCM Token Lifecycle

At login, a device's FCM push token is registered via `POST /auth/fcm-token`. At logout, the token is removed from the user's `fcmTokens` array (fire-and-forget). A maximum of 10 FCM tokens are stored per user; older tokens are evicted when the cap is reached.

**Sources:** `Backend/src/services/auth.service.js`, `Backend/src/middlewares/auth.middleware.js`, `Backend/src/utils/jwt.js`, `Backend/src/utils/admin-key-crypto.js`, `Backend/src/models/RefreshTokenBlacklist.model.js`

---

## 2.7 Authorization

Role-based access control (RBAC) is enforced at the route level through the `requireRole(...allowedRoles)` middleware factory defined in `role.middleware.js`. The middleware reads `req.user.role`, which is injected by `auth.middleware.js` after token verification.

### Role Hierarchy

| Role | Can Access |
|------|-----------|
| `donor` | All donor-facing routes: profile, requests (nearby, accept), donations, rewards, notifications, appointments |
| `hospital` | Hospital profile and settings, request creation and management, QR verification, hospital dashboard |
| `admin` | All admin routes; cannot access exclusive superadmin routes |
| `superadmin` | All admin routes plus admin creation/deletion, admin key rotation, and admin account updates |

Admin routes are mounted **before** the maintenance middleware in `app.js`, guaranteeing that admin users can access the system even when maintenance mode is enabled.

### Permission Enforcement Examples

```
GET  /requests/nearby         → requireRole('donor', 'hospital', 'admin', 'superadmin')
POST /requests/:id/accept     → requireRole('donor')
POST /requests/:id/confirm    → requireRole('hospital', 'admin', 'superadmin')
POST /admin/system/maintenance → requireRole('admin', 'superadmin')  (via admin router)
POST /admin/admins            → requireRole('superadmin')  (additional guard within admin router)
```

Account suspension is also enforced at the `auth.middleware.js` level — suspended accounts receive a 403 response regardless of role, before RBAC is evaluated.

**Sources:** `Backend/src/middlewares/role.middleware.js`, `Backend/src/middlewares/auth.middleware.js`, `Backend/src/routes/admin.routes.js`, `Backend/src/app.js`

---

## 2.8 Business Logic

The following describes the key business logic engines implemented in the service layer.

### Donor Eligibility Engine (`eligibility.service.js`)

The `canDonate(donor, options)` function evaluates eligibility through a sequential rule pipeline. Rules are evaluated in order; the first failure short-circuits and returns a structured result with a machine-readable reason key and, where applicable, a `nextEligibleDate`.

| Rule | Condition for Ineligibility |
|------|-----------------------------|
| Account standing | `isSuspended === true` or `deletedAt` is set |
| Chronic conditions | `healthHistory.chronicConditions` array is non-empty |
| Active donation | An existing donation in `pending` or `scheduled` status exists for this donor |
| Minimum age | Donor age (calculated from `dateOfBirth`) is below 17 years |
| Temporary deferral | `temporaryDeferralUntil` is in the future |
| Travel deferral | Return date from a malaria-risk country is within the last 28 days |
| Donation cooldown | Time since `lastDonationDate` is below the type-specific minimum: blood = 56 days, plasma = 14 days, platelets/double red cells = 7 days |
| Haemoglobin level | `hemoglobinLevel` is set and below 12.5 g/dL |

### Donor Matching Engine (`matching.service.js`)

When a blood request is created, the system locates compatible donors through:
1. **Blood-type compatibility matrix** — a complete ABO/Rh compatibility table defines which donor blood types can satisfy a given request type. The matrix is implemented in `blood-type.js`.
2. **Geo-proximity filter** — MongoDB's `$near` geospatial operator is used on an indexed `location.coordinates` 2dsphere field. The default radius is 30 km; requests of `high` or `critical` urgency use 60 km. Both values are overridable via environment variables. A Haversine fallback is applied if the geo index is unavailable.
3. **Eligibility pre-check** — only donors passing the full `canDonate()` evaluation are included in the match result and receive notifications.

### Blood Request State Machine (`state-machine.js`)

All entity status transitions for `Request`, `Donation`, and `Appointment` are governed by a centralised transition matrix. Any code attempting an invalid transition receives an error before any database write is attempted.

**Request transitions:**

```
pending → accepted | cancelled | expired
accepted → in-progress | pending | cancelled | expired | completed
in-progress → completed | pending | cancelled | expired
completed, cancelled, expired → [] (terminal)
```

**Donation transitions:**

```
pending → scheduled | completed | cancelled | rejected | expired | abandoned
scheduled → completed | cancelled | rejected
completed, cancelled, rejected, expired, abandoned → [] (terminal)
```

### Urgency-Based Arrival Deadlines

When a donor accepts a request, an `arrivalDeadline` timestamp is set on the donation record according to the request's urgency level:

| Urgency | Arrival Deadline |
|---------|-----------------|
| critical | 1 hour |
| high | 4 hours |
| medium | 8 hours |
| low | 24 hours |
| emergency | 1 hour |

### QR Code Verification Flow

Upon accepting a request, a unique QR token is generated (`qrcode` library) and attached to the `Donation` document. On donation day, the hospital scans the QR code via the mobile application, which calls `POST /requests/verify-qr`. The backend looks up the corresponding donation, validates the QR token, enforces the `arrivalDeadline`, and proceeds to the completion checklist. Donation confirmation is atomic: the donation status transitions to `completed`, the request's `unitsAccepted` counter is decremented, and the reward point award is triggered in the same operation.

### Gamification Engine (`reward.service.js`)

On donation completion, the engine atomically awards points, evaluates tier progression, and checks badge unlock conditions:

| Donation Type | Points Awarded |
|---------------|---------------|
| blood | 200 |
| platelets | 175 |
| double red cells | 175 |
| plasma | 150 |

Tier thresholds: bronze (0–999), silver (1,000–2,499), gold (2,500–4,999), platinum (5,000+). Badges are evaluated against configurable milestone conditions; a `UserBadge` document is created on first unlock. All reward operations are dispatched as domain events through the EventBus, with listeners in `eventListeners.registry.js` handling activity logging and notification dispatch.

### EventBus-Driven Cross-Service Decoupling

Services publish typed domain events (defined as frozen object constants in `constants/events.js`) to the singleton `EventBus`. Listener registration occurs once at startup in `eventListeners.registry.js`. This pattern eliminates direct service-to-service imports and enables async side-effect processing without coupling the primary operation path to its downstream consequences.

Domain event categories: `DonationEvents`, `RewardEvents`, `AppointmentEvents`, `RequestEvents`, `NotificationEvents`, `ActivityEvents`, `HospitalEvents`, `UserEvents`, `SystemEvents`.

### Notification System (`notification.service.js`)

Notifications are dispatched through two channels simultaneously:
1. **In-app notifications**: A `Notification` document is persisted in MongoDB and polled by the mobile client.
2. **FCM push notifications**: The Firebase Admin SDK sends push messages to all registered `fcmTokens` for the target user.

Failed FCM deliveries are routed through the `NotificationOutbox` model, which acts as a persistent retry queue processed by the outbox worker.

### Background Workers

**Notification Outbox Worker** (`notificationOutbox.worker.js`): Polls the `NotificationOutbox` collection every 5 seconds. Uses an **atomic findOneAndUpdate** (`$set: { status: 'ready' }`) to claim entries, preventing duplicate processing in multi-instance deployments. Failed entries are retried up to 5 times before being marked `failed`.

**Request Escalation Worker** (`requestEscalation.worker.js`): Polls every 60 seconds to:
1. Identify donations where `arrivalDeadline` has passed without QR scan (`qrUsed === false`).
2. Mark such donations as `expired` using a MongoDB session/transaction.
3. Revert the parent request to `pending` if no other active donations remain.
4. Trigger a re-broadcast to find new compatible donors.

**Sources:** `Backend/src/services/eligibility.service.js`, `Backend/src/services/matching.service.js`, `Backend/src/utils/state-machine.js`, `Backend/src/services/reward.service.js`, `Backend/src/workers/`

---

## 2.9 Error Handling

The backend implements a multi-layered error handling strategy designed to produce predictable, machine-readable responses for all failure modes.

### HttpError Class (`utils/HttpError.js`)

Services and controllers throw `HttpError` instances carrying a `statusCode` and `message`. The central error middleware catches these and calls `response.error()`, producing a standardised JSON body.

### Central Error Middleware (`middlewares/error.middleware.js`)

The middleware recognises and normalises the following error types in priority order:

| Error Type | HTTP Status | Handling |
|------------|------------|---------|
| `HttpError` | As specified | Message preserved; 5xx codes logged at `error` level, 4xx at `warn` |
| `jwt.TokenExpiredError` | 401 | Returns "Token has expired" |
| `jwt.JsonWebTokenError` | 401 | Returns "Invalid token" |
| Mongoose `ValidationError` | 400 | Extracts per-field messages from `err.errors` |
| Mongoose `CastError` | 400 | Reports the invalid field name |
| MongoDB duplicate key (code 11000) | 409 | Reports the duplicate field name |
| All other errors | 500 | Sanitised message ("Internal server error") in production; full message in development |

Stack traces are included in logs only in non-production environments.

### Standardised Response Format

All responses — success and error — are produced through the `utils/response.js` utility, which enforces a consistent JSON envelope:

**Success:**
```json
{ "success": true, "message": "...", "data": { ... } }
```

**Error:**
```json
{ "success": false, "code": "ERROR_CODE", "message": "..." }
```

Error codes are inferred from the HTTP status and message content by `inferErrorCode()` in `response.js`, producing machine-readable constants such as `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, and `EMAIL_ALREADY_EXISTS`. A centralised `ERR` constant object (`utils/errorCodes.js`) defines all error message strings used in services, preventing typo-induced mismatches.

### NoSQL Injection Sanitization

A custom sanitizer applied in `app.js` recursively walks `req.body`, `req.params`, and `req.query` before they reach any route handler. Keys containing `$` or `.` are renamed (replaced with `_`) to prevent MongoDB operator injection. Each sanitization event is logged by `securityLogger.injectionAttempt()`.

**Sources:** `Backend/src/utils/HttpError.js`, `Backend/src/middlewares/error.middleware.js`, `Backend/src/utils/response.js`, `Backend/src/utils/errorCodes.js`, `Backend/src/app.js`

---

## 2.10 Configuration

The backend uses two configuration layers: a centralised environment loader and a Mongoose database configuration module.

### Environment Configuration (`src/config/env.js`)

All environment variables are resolved through the `getEnv()` factory function, which applies defaults for optional variables and normalises types (e.g., `parseInt` for `PORT` and `BCRYPT_SALT_ROUNDS`). The `validateEnv()` function is called at startup before any other initialisation; it throws immediately if required variables are absent.

Required in all environments: `MONGO_URI`, `JWT_SECRET`.  
Additionally required in production: `JWT_REFRESH_SECRET`, `CORS_ORIGIN`.

The environment object is a dynamic getter (not frozen), allowing test environments to override values without restart.

### Database Configuration (`src/config/db.js`)

Mongoose is connected with a configured connection pool (`maxPoolSize: 10`, `minPoolSize: 2`). Automatic index creation is disabled (`autoIndex: false`); indexes are managed explicitly to prevent duplicate-index warnings at startup. Connection lifecycle events (`error`, `disconnected`, `reconnected`, `close`) are all logged. In production, a failed database connection causes `process.exit(1)` to trigger a process manager restart.

### Swagger Configuration (`src/config/swagger.js`)

The OpenAPI specification is served by `swagger-ui-express`. The Swagger UI is conditionally mounted at `/api-docs` in all environments except `test`, and the raw JSON spec is available at `GET /openapi.json`.

### Startup Seeding

Three seed operations are executed at startup (no-op if data already exists):
- `seedDefaultSettings()` — creates default `SystemSettings` documents (e.g., `maintenance_mode = false`).
- `initializeDefaultConfig()` — creates the default `RewardsConfig` document.
- `seedRewardData()` — creates the default reward catalogue entries and badge definitions.

**Sources:** `Backend/src/config/env.js`, `Backend/src/config/db.js`, `Backend/src/config/swagger.js`, `Backend/src/server.js`

---

## 2.11 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Runtime environment. Controls logging format, error detail visibility, and rate limit strictness. |
| `PORT` | No | `5000` | HTTP server port. |
| `MONGO_URI` | **Yes** | `mongodb://localhost:27017/lifelink` | MongoDB Atlas connection string. Also accepts legacy alias `MONGODB_URI`. |
| `JWT_SECRET` | **Yes** | — | HMAC secret for signing access tokens. |
| `JWT_REFRESH_SECRET` | Production: **Yes** | Falls back to `JWT_SECRET` in development | HMAC secret for signing refresh tokens. Must differ from `JWT_SECRET` in production. |
| `JWT_EXPIRES_IN` | No | `7d` | Access token expiry (e.g., `7d`, `1h`). |
| `JWT_REFRESH_EXPIRES_IN` | No | `30d` | Refresh token expiry. |
| `CORS_ORIGIN` | Production: **Yes** | `*` in development | Allowed CORS origin. Wildcard is rejected in production. |
| `FRONTEND_URL` | No | `http://localhost:3000` | Used in email template links. |
| `API_BASE_URL` | No | `http://localhost:<PORT>` | Used in QR code generation URLs. |
| `BCRYPT_SALT_ROUNDS` | No | `12` (prod), `10` (dev) | bcryptjs work factor for password hashing. |
| `RESEND_API_KEY` | No | — | API key for the Resend email service. Emails are silently skipped if absent. |
| `RESEND_WEBHOOK_SECRET` | No | — | Signature validation secret for inbound Resend webhook events. |
| `MAIL_FROM` | No | `LifeLink <onboarding@resend.dev>` | Sender address for all outgoing emails. |
| `DEV_MAIL_TO` | No | — | Redirects all outgoing emails to this address in development. |
| `EMAIL_LOGO_URL` | No | — | Logo image URL embedded in HTML email templates. |
| `FIREBASE_PROJECT_ID` | No | — | Firebase project identifier. Required for FCM push notifications. |
| `FIREBASE_CLIENT_EMAIL` | No | — | Firebase service account email. |
| `FIREBASE_PRIVATE_KEY` | No | — | Firebase service account private key (PEM). Newlines normalised automatically. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | No | — | Relative path to a Firebase service account JSON file (alternative to individual key vars). |
| `MATCHING_DISTANCE_KM` | No | `30` | Default geo-radius for donor-request matching. |
| `EMERGENCY_MATCHING_DISTANCE_KM` | No | `60` | Extended geo-radius for high/critical urgency requests. |
| `OUTBOX_POLL_INTERVAL_MS` | No | `5000` | Notification outbox worker polling interval in milliseconds. |
| `ESCALATION_POLL_INTERVAL_MS` | No | `60000` | Request escalation worker polling interval in milliseconds. |
| `ADMIN_KEY_ENCRYPTION_KEY` | No | Falls back to `JWT_SECRET` | AES-256-GCM encryption key for admin key storage. |

**Sources:** `Backend/src/config/env.js`, `Backend/.env.example`

---

## 2.12 Third-party Services

| Service | Integration Point | Purpose |
|---------|-------------------|---------|
| **MongoDB Atlas** | `src/config/db.js` via Mongoose 9.x ODM | Primary persistent data store. Connection pool managed by Mongoose. Geospatial queries rely on 2dsphere indexes on `User.location.coordinates` and `Request.hospitalLocationGeo`. |
| **Firebase Cloud Messaging (FCM)** | `src/utils/fcm.js` using Firebase Admin SDK 13.x | Real-time push notifications delivered to donor and hospital mobile devices. The Admin SDK is initialised lazily on first notification dispatch. FCM token registration/deregistration is managed through the auth endpoints. Failed deliveries are routed through the `NotificationOutbox` retry queue. |
| **Resend** | `src/utils/mailer.js` using `resend` 6.x | Transactional email delivery for OTP verification, password reset, and account notifications. Nodemailer 8.x is available as a secondary transport. All email sending is fire-and-forget with background error logging to avoid blocking primary operations. |
| **Swagger UI** | `src/config/swagger.js` + `swagger-ui-express` 5.x | Interactive API documentation served at `/api-docs`. The specification is authored in `openapi.yaml` (327 KB). |

**Sources:** `Backend/src/config/db.js`, `Backend/src/utils/fcm.js`, `Backend/src/utils/mailer.js`, `Backend/package.json`

---

## 2.13 Backend Design Decisions

The following documents the significant engineering decisions made in the design and implementation of the LifeLink backend, along with the rationale for each.

### Decision 1: Layered Architecture with a Strict Dependency Rule
The codebase enforces a single, documented dependency direction: Routes → Controllers → Services → Repositories → Models. This prevents circular dependencies, enables isolated unit testing at each layer, and makes the responsibility of each file unambiguous. The rule is documented in `Backend/AGENTS.md` and is enforced through code review rather than automated tooling.

### Decision 2: Mongoose Discriminators for Multi-Role User Model
Rather than maintaining separate `donors`, `hospitals`, and `admins` collections, all user roles share a single `users` collection distinguished by a `__t` discriminator field. This simplifies cross-role queries (e.g., login, admin user listing) and avoids duplicating shared fields (email, password, role, FCM tokens) across multiple schemas. Role-specific fields are isolated within the discriminator sub-schemas.

### Decision 3: Centralised State Machine Engine
All entity status transitions (Request, Donation, Appointment) pass through a single `validateTransition()` function before any database write. This eliminates scattered, ad-hoc status strings throughout the codebase, makes all valid transitions auditable from one file, and ensures that illegal state mutations are caught at the boundary rather than silently persisted.

### Decision 4: EventBus for Cross-Service Decoupling
Direct service-to-service calls for side effects (activity logging, notification dispatch, badge evaluation) were replaced with an EventBus pub/sub pattern. This decouples the primary operation (e.g., completing a donation) from its downstream consequences, allows side effects to fail independently without rolling back the core transaction, and makes the system's event topology visible in a single registry file.

### Decision 5: Notification Outbox Pattern
FCM delivery is not attempted synchronously in the request path. Instead, failed or deferred notifications are written to a `NotificationOutbox` collection and processed by a background worker using atomic document claiming. This prevents FCM latency or failure from degrading API response times and provides automatic retry with configurable attempt limits (default: 5).

### Decision 6: Dynamic Rate Limiting by Request Class
Rather than a single global rate limiter, the backend applies different limits based on request classification. Expensive geo and analytics queries receive a stricter limit (90 req/5 min); search/filter queries receive a relaxed limit (300 req/min); auth endpoints receive the strictest limit (60 req/15 min). The classification is performed by the `limiter()` selector middleware, which inspects `req.method`, `req.path`, and `req.baseUrl`.

### Decision 7: Maintenance Mode with Cached DB Check
Maintenance mode is stored in a `SystemSettings` MongoDB document, not in an environment variable, so it can be toggled at runtime without redeployment. To avoid a database round-trip on every request, the setting is cached in-process with a 30-second TTL. The cache is explicitly invalidated when the admin changes the setting. Admin routes are mounted before the maintenance middleware, guaranteeing administrative access even during system-wide maintenance.

### Decision 8: Internationalisation (i18n) at the Transport Layer
Error messages and system strings support both English and Arabic through a lightweight in-process translation layer (`i18n.middleware.js`). Language selection follows a priority chain: authenticated user preference → `?lang=` query parameter → `Accept-Language` header. Translation is applied to response messages by the `response.error()` utility, keeping it transparent to controllers and services.

### Decision 9: SHA-256 OTP Hashing
OTPs (email verification and password reset) are never stored in plaintext. The raw OTP is hashed with SHA-256 before storage in `User.emailVerificationOtp` or `OneTimeOtp.otpHash`. Verification re-hashes the submitted value and compares against the stored hash. This ensures that a database breach does not expose usable OTP values.

### Decision 10: Admin Key AES-256-GCM Encryption
Each admin account has a unique `adminKey` required as a third authentication factor. The key is encrypted at rest using AES-256-GCM with a per-admin IV and an `scryptSync`-derived key tied to the admin's user ID. This means that even a full database dump does not expose admin keys, as decryption requires knowledge of the application secret and the specific user ID.

**Sources:** `Backend/AGENTS.md`, `Backend/ARCHITECTURE_REFACTORING_GUIDE.md`, `Backend/src/utils/state-machine.js`, `Backend/src/services/eventBus.service.js`, `Backend/src/middlewares/maintenance.middleware.js`, `Backend/src/utils/admin-key-crypto.js`

---

# 3. Database Knowledge

## 3.1 Database Overview

LifeLink uses **MongoDB**, a document-oriented NoSQL database, as its sole primary persistent data store. The database is hosted on **MongoDB Atlas** (a fully managed cloud database service) and is accessed exclusively through the **Mongoose 9.x ODM** (Object–Document Mapper) for Node.js.

### Database Technology Summary

| Property | Value |
|----------|-------|
| Database Engine | MongoDB (NoSQL, document-oriented) |
| Hosting | MongoDB Atlas (cloud-managed) |
| ODM | Mongoose 9.x |
| Connection Strategy | Connection pool (min: 2, max: 10 connections) |
| Index Management | Manual (`autoIndex: false`); indexes defined explicitly in schema files |
| Document Identifiers | MongoDB `ObjectId` (`_id`) — generated automatically by Mongoose |
| Schema Strictness | `strict: 'throw'` enforced on all core models — fields not declared in the schema are rejected outright at the application layer, preventing document pollution |
| Timestamps | Mongoose `{ timestamps: true }` auto-generates `createdAt` and `updatedAt` on all core collections |

### Design Philosophy

MongoDB was selected over a relational database for the following architectural reasons:

1. **Flexible document modelling:** The health and medical profile of a donor (medications, allergies, travel history, chronic conditions) varies in depth and structure between individuals. A document model accommodates this variability without requiring schema migrations.
2. **Discriminator-based polymorphism:** All user roles (donor, hospital, admin, superadmin) share a common identity schema but require role-specific fields. Mongoose discriminators allow all roles to coexist in a single `users` collection while keeping role-specific fields cleanly separated.
3. **Embedded sub-documents for co-located data:** Data that is always read together (e.g., verification checklist items within a donation record, reschedule history within an appointment) is embedded directly in the parent document, eliminating the need for multi-collection joins on read-heavy paths.
4. **TTL indexes for automatic data expiry:** Time-sensitive data (OTPs, refresh token blacklists, notifications, activity timeline events, notification outbox entries) is automatically purged by MongoDB's TTL index mechanism without requiring scheduled cleanup jobs.
5. **Geospatial indexing for proximity queries:** The `2dsphere` index on hospital request coordinates enables efficient geo-radius queries for donor-matching and hospital-discovery use cases.

**Sources:** `Backend/src/config/db.js`, `Backend/src/models/`, `Backend/AGENTS.md`

---

## 3.2 Collections / Tables

The database comprises **25 collections**, each managed by a dedicated Mongoose schema. The table below provides an architectural overview of every collection, its MongoDB collection name (as derived by Mongoose), and its principal responsibility.

| # | Mongoose Model Name | MongoDB Collection | Responsibility |
|---|--------------------|--------------------|---------------|
| 1 | `User` | `users` | Base identity document for all roles (donor, hospital, admin, superadmin). Stores credentials, location, FCM tokens, suspension state, and shared fields. Discriminator key `__t` distinguishes sub-roles. |
| 2 | `Donor` (discriminator of `User`) | `users` (same collection) | Extends `User` with donor-specific medical and demographic fields: blood type, date of birth, health history, deferral state, and notification preferences. |
| 3 | `Hospital` (discriminator of `User`) | `users` (same collection) | Extends `User` with hospital-specific profile fields: hospital ID, license number, capacity, blood bank availability, working hours, and appointment slot configuration. |
| 4 | `Request` | `requests` | Represents a hospital-created blood donation request, including type, urgency, blood type(s), quantity, geolocation, lifecycle status, and QR verification tokens. |
| 5 | `Donation` | `donations` | Tracks the lifecycle of a single donation event initiated by a donor in response to a request or an appointment, including verification checklist, QR token, and arrival deadline. |
| 6 | `Appointment` | `appointments` | Records a proactively booked donation appointment, including scheduled date, donor details snapshot, hospital reference, reschedule history, disease screening, and QR verification state. |
| 7 | `DonorPoints` | `donorpoints` | One document per donor; stores current points balance, lifetime points earned, and derived tier (bronze / silver / gold / platinum). |
| 8 | `PointsTransaction` | `pointstransactions` | Immutable, append-only audit log of every individual points event (earned or spent), including transaction type, amount, reference entity, and running balance snapshot. |
| 9 | `Badge` | `badges` | Static catalogue of all achievable badges, including unlock condition type, threshold value, rarity, category, bonus points, and display metadata. Seeded at startup. |
| 10 | `UserBadge` | `userbadges` | Junction document tracking each donor's progress toward and ownership of each badge (one record per donor–badge pair). |
| 11 | `RewardCatalog` | `rewardcatalogs` | Administrator-managed catalogue of redeemable rewards; includes points cost, category, availability status, and optional daily/monthly redemption limits. |
| 12 | `RewardRedemption` | `rewardredemptions` | Records each reward redemption event, including a unique auto-generated confirmation code (format: `RWD-YYYY-XXXXXX`), expiry date, and delivery method. |
| 13 | `RewardsConfig` | `rewardsconfigs` | Singleton configuration document (key: `"default"`) storing the platform-wide points schedule (per donation type and per action) and tier threshold values. Editable by admins at runtime. |
| 14 | `Notification` | `notifications` | In-app notification documents sent to users; includes type, message, read state, optional reference to a related entity, and an idempotency key for deduplication. TTL: 90 days. |
| 15 | `NotificationOutbox` | `notificationoutboxes` | Outbox buffer for deferred or failed FCM push notification deliveries; processed by the background outbox worker. TTL: 30 days. |
| 16 | `HospitalSettings` | `hospitalsettings` | Per-hospital configuration for appointment scheduling: working days, hourly slot capacity map, cancellation rules, supported donation types, and blood bank threshold notifications. |
| 17 | `AuditLog` | `auditlogs` | Append-only log of administrative actions (who did what, to which entity, and when). Stores a `changes` payload for diff tracking. |
| 18 | `Activity` | `activities` | Append-only per-user event timeline (donor-facing). Stores pre-rendered display strings (title, description, icon) alongside a reference to the originating entity. TTL: 365 days. |
| 19 | `OneTimeOtp` | `onetimeotps` | Stores SHA-256-hashed OTP codes for the password-reset flow, including attempt counter, expiry, and a subsequent reset-token hash. Auto-expires via TTL index. |
| 20 | `RefreshTokenBlacklist` | `refreshtokenblacklists` | Stores the SHA-256 hash of revoked refresh tokens alongside their expiry date. Used to invalidate sessions on logout or password change. Auto-expires via TTL index. |
| 21 | `RolePermission` | `rolepermissions` | Stores fine-grained permission matrices for each admin role (donor management, hospital management, system settings, reporting, etc.). |
| 22 | `SystemSettings` | `systemsettings` | Generic key-value store for platform-level configuration; currently used to persist the maintenance mode flag without requiring a service restart. |
| 23 | `SupportMessage` | `supportmessages` | Donor-submitted support tickets, categorised by type, with status tracking and an admin reply field. |
| 24 | `InboundEmail` | `inboundemails` | Archives raw inbound emails received via the Resend webhook endpoint. Includes full message metadata and a text-search index. |
| 25 | `HelpDocument` | `helpdocuments` | Registry of help and FAQ documents, each identified by a unique `type` key and referencing a hosted document URL. |

**Sources:** `Backend/src/models/` (all 25 model files)

---

## 3.3 Collection / Table Relationships

Because MongoDB is a document-oriented, non-relational database, relationships between collections are represented using **ObjectId references** (analogous to foreign keys) rather than formal joins. Mongoose populates these references at query time using `.populate()`. The following table documents every inter-collection reference in the schema.

### Primary Reference Map

| Source Collection | Field | References Collection | Relationship Type | Notes |
|-------------------|-------|----------------------|-------------------|-------|
| `Request` | `hospitalId` | `users` | Many-to-One | Many requests belong to one hospital |
| `Request` | `acceptedBy` | `users` | Many-to-One (nullable) | Donor who accepted the request |
| `Request` | `acceptedDonationId` | `donations` | One-to-One (nullable) | The active donation record for this request |
| `Donation` | `donorId` | `users` | Many-to-One | Many donations belong to one donor |
| `Donation` | `requestId` | `requests` | Many-to-One (nullable) | Null for proactive (appointment-only) donations |
| `Donation` | `appointmentId` | `appointments` | One-to-One (nullable) | Unique per appointment; enforced via partial unique index |
| `Appointment` | `donorId` | `users` | Many-to-One | Many appointments belong to one donor |
| `Appointment` | `hospitalId` | `users` | Many-to-One | Many appointments belong to one hospital |
| `Appointment` | `requestId` | `requests` | Many-to-One (nullable) | Null for proactive appointments |
| `Appointment` | `rescheduleHistory[].rescheduledBy` | `users` | Many-to-One | Admin or donor who performed the reschedule |
| `DonorPoints` | `donorId` | `users` | One-to-One | Exactly one points record per donor |
| `PointsTransaction` | `donorId` | `users` | Many-to-One | Many transactions per donor |
| `PointsTransaction` | `adminId` | `users` | Many-to-One (nullable) | Only set for `ADMIN_ADJUSTMENT` type |
| `UserBadge` | `donorId` | `users` | Many-to-One | Many badge progress records per donor |
| `UserBadge` | `badgeId` | `badges` | Many-to-One | Each progress record references one badge definition |
| `RewardRedemption` | `donorId` | `users` | Many-to-One | Many redemptions per donor |
| `RewardRedemption` | `rewardId` | `rewardcatalogs` | Many-to-One | Many redemptions may reference the same reward |
| `Notification` | `userId` | `users` | Many-to-One | Many notifications per user |
| `Notification` | `relatedId` | `requests` / `donations` / `users` / `appointments` | Polymorphic reference | `relatedType` field discriminates the target collection |
| `NotificationOutbox` | `requestId` | `requests` | Many-to-One | Outbox entry is always tied to a triggering request |
| `NotificationOutbox` | `donorIds[]` | `users` | Many-to-Many (array) | List of donor recipients for batch FCM delivery |
| `NotificationOutbox` | `userId` | `users` | Many-to-One (nullable) | Single-recipient outbox entries |
| `HospitalSettings` | `hospitalId` | `users` | One-to-One | One settings document per hospital |
| `Activity` | `userId` | `users` | Many-to-One | Many timeline events per user |
| `AuditLog` | `adminId` | `users` | Many-to-One | Many audit records per admin |
| `AuditLog` | `targetId` | `users` / `requests` / `donations` | Polymorphic | `targetType` field discriminates the collection |
| `OneTimeOtp` | `userId` | `users` | Many-to-One (nullable) | May be null when user has not yet registered |
| `RefreshTokenBlacklist` | `userId` | `users` | Many-to-One | Associates the revoked token with its owner |
| `RewardsConfig` | `updatedBy` | `users` | Many-to-One (nullable) | Admin who last modified the configuration |
| `SystemSettings` | `updatedBy` | `users` | Many-to-One | Admin who last changed the setting |
| `RolePermission` | `updatedBy` | `users` | Many-to-One (nullable) | Admin who last updated permissions |
| `SupportMessage` | `userId` | `users` | Many-to-One | Submitting user |
| `SupportMessage` | `adminReplyBy` | `users` | Many-to-One (nullable) | Admin who replied |

### Discriminator Relationship (User Sub-Types)

The `users` collection stores documents for all four roles using Mongoose's **discriminator** pattern. The `__t` field (the discriminator key) holds the role string (`"donor"` or `"hospital"`). When a query targets `Donor` or `Hospital`, Mongoose automatically appends `{ __t: 'donor' }` or `{ __t: 'hospital' }` to the filter, ensuring correct document retrieval from the shared collection.

**Sources:** All 25 model files under `Backend/src/models/`

---

## 3.4 Data Models

This section documents the field-level structure of the most architecturally significant collections.

### 3.4.1 `users` Collection (Base `User` Schema + Discriminators)

All role documents reside in the `users` collection. The base schema holds fields common to all roles. Discriminator sub-schemas (`Donor`, `Hospital`) extend it with role-specific fields.

#### Base `User` Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | MongoDB primary key |
| `__t` | String | Auto | Discriminator key: `"donor"` or `"hospital"` (absent for admin/superadmin) |
| `fullName` | String | Yes | 3–100 characters; Arabic names supported |
| `fullNameNormalized` | String | No | Lowercase, Arabic-normalised version of `fullName`; used for fuzzy search |
| `email` | String | Yes | Unique, lowercase; basic regex validation applied |
| `password` | String | Yes | bcrypt-hashed on save; `select: false` (never returned in queries) |
| `passwordChangedAt` | Date | No | Updated on password change; used to invalidate older JWTs; `select: false` |
| `role` | String | Yes | Enum: `donor`, `hospital`, `admin`, `superadmin`; default: `donor` |
| `isEmailVerified` | Boolean | No | Default: `false`; set to `true` after OTP confirmation |
| `emailVerifiedAt` | Date | No | Timestamp of email verification |
| `emailVerificationOtp` | String | No | SHA-256 hash of the 6-digit OTP; `select: false`; cleared after verification |
| `emailVerificationOtpExpires` | Date | No | OTP expiry (10-minute TTL); `select: false` |
| `resetPasswordToken` | String | No | SHA-256 hash of the password-reset token; `select: false` |
| `resetPasswordExpires` | Date | No | Token expiry; `select: false` |
| `isSuspended` | Boolean | No | Default: `false`; suspended accounts are blocked at auth middleware |
| `suspendedAt` | Date | No | Timestamp of suspension |
| `suspendedReason` | String | No | Admin-provided reason for suspension |
| `deletedAt` | Date | No | Null = active; non-null = soft-deleted; triggers cascade hooks |
| `location.city` | String | No | Human-readable city name |
| `location.governorate` | String | No | Governorate / region |
| `location.coordinates.lat` | Number | No | Latitude |
| `location.coordinates.lng` | Number | No | Longitude |
| `location.lastUpdated` | Date | No | When the location was last updated |
| `fcmTokens` | String[] | No | Firebase Cloud Messaging device tokens; max 10 per user |
| `phone` | String | No | Admin/superadmin contact phone |
| `position` | String | No | Admin's organisational position |
| `department` | String | No | Admin's department |
| `adminKey` | String | No | AES-256-GCM–encrypted third-factor key for admin login; `select: false`; sparse unique index |
| `createdAt` | Date | Auto | Mongoose timestamp |
| `updatedAt` | Date | Auto | Mongoose timestamp |

#### `Donor` Discriminator Additional Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `phoneNumber` | String | Yes | Must be exactly 11 digits |
| `bloodType` | String | Yes | Enum: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| `dateOfBirth` | Date | Yes | Must be in the past; used by eligibility engine for age check |
| `gender` | String | No | Enum: `male`, `female` |
| `lastDonationDate` | Date | No | Updated on donation completion; used for cooldown enforcement |
| `weight` | Number | No | Kilograms; min: 0 |
| `hemoglobinLevel` | Number | No | g/dL; min: 0; threshold checked at 12.5 g/dL for eligibility |
| `travelHistory[]` | Array | No | Each entry: `{ country: String, returnDate: Date }`; used for 28-day malaria deferral check |
| `temporaryDeferralUntil` | Date | No | Donor cannot donate until this date passes |
| `lastDeferralReason` | String | No | Human-readable reason for deferral |
| `healthHistory.chronicConditions` | String[] | No | Non-empty array disqualifies the donor permanently |
| `healthHistory.medications` | String[] | No | Informational; not currently used in eligibility engine |
| `healthHistory.allergies` | String[] | No | Informational |
| `healthHistory.recentIllness` | String | No | Free text |
| `healthHistory.notes` | String | No | Max 1000 characters |
| `healthHistory.lastCheckupDate` | Date | No | Date of last medical checkup |
| `isOptedIn` | Boolean | No | Default: `true`; donor preference to receive donation request notifications |
| `missedDonationCount` | Number | No | Default: 0; auto-suspension triggered at 3 missed donations |
| `missedDonationDates` | Date[] | No | History of no-show dates |
| `settings.pushNotifications` | Boolean | No | Default: `true` |
| `settings.emergencyAlerts` | Boolean | No | Default: `true` |
| `settings.privacyMode` | Boolean | No | Default: `false` |
| `settings.language` | String | No | Enum: `en`, `ar`; default: `en` |

#### `Hospital` Discriminator Additional Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `hospitalId` | String | Yes | Business-assigned identifier; unique index |
| `hospitalType` | String | No | Default: `"General Hospital"` |
| `hospitalName` | String | No | Display name; synced from `fullName` on save |
| `hospitalNameNormalized` | String | No | Lowercase, normalised; used for search |
| `licenseNumber` | String | No | Official license number |
| `workingHours` | String | No | Human-readable string (e.g., `"9AM - 5PM"`) |
| `workingHoursStart` | Number | No | Hour of day (0–23); default: 9 |
| `workingHoursEnd` | Number | No | Hour of day (0–23); default: 17 |
| `slotsPerHour` | Number | No | Default: 5; drives dynamic slot computation |
| `phone` | String | No | Hospital contact phone |
| `address` | Mixed | No | Flexible address object |
| `city` | String | No | Hospital city |
| `state` | String | No | Hospital state / governorate |
| `bloodBanksAvailable` | String[] | No | Subset of blood type enum values |
| `capacity` | Number | No | Max donor capacity |
| `lat` / `long` | Number | No | Geographic coordinates (also stored in `location.coordinates` from base schema) |
| `adminContactName` | String | No | Name of admin contact person |
| `emergencyContact` | String | No | Emergency contact phone |

---

### 3.4.2 `requests` Collection

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | Primary key |
| `hospitalId` | ObjectId (ref: User) | Yes | Creating hospital |
| `type` | String | Yes | Enum: `blood`, `plasma`, `platelets`, `double_red_cells` |
| `bloodType` | String[] | Yes (for blood types) | Array supporting multi-type requests; normalised automatically |
| `urgency` | String | Yes | Enum: `low`, `medium`, `high`, `critical` |
| `status` | String | No | Enum: `pending`, `accepted`, `in-progress`, `completed`, `cancelled`, `expired`; default: `pending` |
| `patientType` | String | No | Enum: `adult`, `child`, `infant`; default: `adult` |
| `patientDetails` | String | No | Clinical context enum (e.g., `surgery`, `accident`, `cancer`, etc.) |
| `unitsNeeded` | Number | No | Minimum 1; default: 1 |
| `unitsAccepted` | Number | No | Counter incremented as donors complete donations |
| `requiredBy` | Date | Yes | Deadline; must be in the future at creation time |
| `notes` | String | No | Max 500 characters |
| `hospitalContact` | String | Yes | 10–11 digit phone number |
| `hospitalLocationGeo` | GeoJSON Point | No | `{ type: "Point", coordinates: [lng, lat] }`; required for geo-radius matching |
| `hospitalName` | String | No | Snapshot of hospital name at request creation |
| `isEmergency` | Boolean | No | Default: `false`; activates extended 60 km matching radius |
| `qrToken` | String | No | Unique QR verification token (sparse unique index) |
| `qrCreatedAt` / `qrExpiresAt` | Date | No | QR token validity window |
| `acceptedBy` | ObjectId (ref: User) | No | Donor who currently holds the accepted slot |
| `acceptedByName` | String | No | Snapshot of donor name at acceptance |
| `acceptedByPhoneNumber` | String | No | Snapshot of donor phone at acceptance |
| `acceptedByBloodType` | String | No | Snapshot of donor blood type at acceptance |
| `acceptedAt` | Date | No | Timestamp of acceptance |
| `acceptedDonationId` | ObjectId (ref: Donation) | No | Reference to the active donation record |
| `arrivalDeadline` | Date | No | Computed from urgency: critical=1h, high=4h, medium=8h, low=24h |
| `acceptanceDeadline` | Date | No | Deadline for a matched donor to accept |
| `escalationLevel` | Number | No | Default: 1; incremented by background escalation worker |
| `lastBroadcastAt` | Date | No | Cooldown tracking for repeated admin broadcasts |
| `cancelledAt` / `completedAt` | Date | No | Status transition timestamps |
| `manualInterventionFlag` | Boolean | No | Marks requests that required admin intervention |

---

### 3.4.3 `donations` Collection

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | Primary key |
| `donorId` | ObjectId (ref: User) | Yes | Donating donor |
| `requestId` | ObjectId (ref: Request) | No | Null for proactive appointment-only donations |
| `appointmentId` | ObjectId (ref: Appointment) | No | Unique per appointment (enforced by partial unique index) |
| `status` | String | No | Enum: `pending`, `scheduled`, `completed`, `cancelled`, `rejected`, `expired`, `abandoned`; default: `pending` |
| `quantity` | Number | Yes | Units to donate; min: 1 |
| `unitsCollected` | Number | No | Actual units collected at confirmation |
| `hemoglobinLevel` | Number | No | Recorded at the time of donation |
| `weight` | Number | No | Recorded at the time of donation |
| `scheduledDate` | Date | No | Must be in the future at creation time |
| `completedDate` | Date | No | Must be in the past |
| `notes` | String | No | Max 1000 characters |
| `qrToken` | String | No | QR token for on-site hospital scan |
| `qrExpiresAt` | Date | No | QR token validity window |
| `qrUsed` / `qrUsedAt` | Boolean / Date | No | Tracks whether the QR was already scanned |
| `arrivalDeadline` | Date | No | Urgency-based deadline; enforced by escalation worker |
| `appointmentScheduleDeadline` | Date | Yes | Default: 14 days from creation; auto-cancels appointment-less pending donations |
| `autoCancelledAt` | Date | No | Set when the system auto-cancels due to missed deadline |
| `verificationStatus` | String | No | Enum: `pending`, `verified`, `rejected`, `completed` |
| `verificationSessionId` | String | No | Session identifier for the on-site verification flow |
| `verificationChecklist.idVerified` | Boolean | No | On-site identity check |
| `verificationChecklist.questionnaireCompleted` | Boolean | No | Health questionnaire completion |
| `verificationChecklist.consentSigned` | Boolean | No | Consent form signed |
| `verificationChecklist.completedAt` | Date | No | When the checklist was finalised |
| `verifiedAt` | Date | No | Timestamp of overall verification completion |

---

### 3.4.4 `appointments` Collection

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | Primary key |
| `donorId` | ObjectId (ref: User) | Yes | Booking donor |
| `hospitalId` | ObjectId (ref: User) | Yes | Target hospital |
| `requestId` | ObjectId (ref: Request) | No | Null for purely proactive bookings |
| `appointmentDate` | Date | Yes | Must be in the future at creation time |
| `status` | String | No | Enum: `pending`, `confirmed`, `completed`, `cancelled`; default: `pending` |
| `donationType` | String | No | Enum: `Whole Blood`, `Plasma`, `Platelets`, `Double Red Cells`; default: `Whole Blood` |
| `donorDetails` | Sub-document | No | Snapshot of donor profile at booking time (name, phone, blood type, DOB, email, gender) — avoids population queries on historical records |
| `qrToken` | String | No | Unique QR token for on-site appointment check-in |
| `qrScannedAt` / `qrExpiresAt` | Date | No | QR usage tracking |
| `verificationStatus` | String | No | Enum: `pending`, `verified`, `rejected`, `completed`; default: `pending` |
| `verificationChecklist` | Sub-document | No | Three boolean flags: `idVerified`, `questionnaireCompleted`, `consentSigned` |
| `diseaseScreening` | Sub-document | No | `screeningCompleted`, `disqualifyingDiseaseFound`, `disqualifyingDiseases[]`, `notes`, `screenedAt` |
| `notes` | String | No | Max 500 characters |
| `cancelledAt` | Date | No | Cancellation timestamp |
| `rescheduleCount` | Number | No | Default: 0; min: 0 |
| `rescheduleHistory[]` | Array | No | Max 10 entries; each entry: `{ previousAppointmentDate, newAppointmentDate, previousDonationType, newDonationType, reason, rescheduledAt, rescheduledBy }` |

---

### 3.4.5 `donorpoints` Collection

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | Primary key |
| `donorId` | ObjectId (ref: User) | Yes | Unique per donor |
| `pointsBalance` | Number | No | Current spendable balance (earned minus redeemed); min: 0 |
| `lifetimePointsEarned` | Number | No | Cumulative total; never decreases; used for tier calculation |
| `tier` | String | No | Enum: `bronze`, `silver`, `gold`, `platinum`; derived from `lifetimePointsEarned` and stored for fast lookups |
| `profileCompletionAwarded` | Boolean | No | Prevents the profile-completion grant from being awarded more than once |
| `firstDonationAwarded` | Boolean | No | Prevents the first-donation grant from being awarded more than once |

**Tier thresholds:** bronze = 0–999 pts; silver = 1,000–2,499 pts; gold = 2,500–4,999 pts; platinum = 5,000+ pts.

---

### 3.4.6 `pointstransactions` Collection

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | Primary key |
| `donorId` | ObjectId (ref: User) | Yes | Owner of the transaction |
| `pointsAmount` | Number | Yes | Positive = earned; negative = spent/deducted |
| `transactionType` | String | Yes | Enum: `BLOOD_DONATION`, `PLASMA_DONATION`, `PLATELETS_DONATION`, `ORGAN_DONATION`, `EMERGENCY_RESPONSE`, `PROFILE_COMPLETION`, `FIRST_DONATION`, `TIER_BONUS`, `BADGE_UNLOCK`, `REWARD_REDEEMED`, `ADMIN_ADJUSTMENT` |
| `description` | String | Yes | Max 200 characters; human-readable description |
| `referenceId` | String | No | ID of the related entity (e.g., donationId, redemptionId); used for deduplication |
| `balanceAfter` | Number | Yes | Snapshot of donor's balance immediately after this transaction; aids audit |
| `adminId` | ObjectId (ref: User) | No | Set only for `ADMIN_ADJUSTMENT` transactions |

---

### 3.4.7 `notifications` Collection

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | Primary key |
| `userId` | ObjectId (ref: User) | Yes | Recipient |
| `type` | String | Yes | Enum: `match`, `request`, `milestone`, `emergency`, `system`, `admin`, `appointment` |
| `title` | String | Yes | Max 200 characters |
| `message` | String | Yes | Max 1000 characters |
| `read` | Boolean | No | Default: `false` |
| `relatedId` | ObjectId | No | Reference to related entity |
| `relatedType` | String | No | Enum: `Request`, `Donation`, `User`, `Achievement`, `Appointment` |
| `data` | Mixed | No | Additional JSON payload for the mobile client |
| `idempotencyKey` | String | No | Composite deduplication key; unique when non-null |
| `createdAt` | Date | Auto | TTL index: auto-deleted after **90 days** |

---

### 3.4.8 `activities` Collection

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | Primary key |
| `userId` | ObjectId (ref: User) | Yes | Owner of the timeline event |
| `type` | String | Yes | Enum: `donation`, `reward`, `emergency_response`, `profile_update`, `appointment`, `badge`, `achievement`, `referral`, `subscription`, `admin_action` |
| `action` | String | Yes | Granular verb string (e.g., `completed_donation`); max 100 characters |
| `title` | String | Yes | Pre-rendered display title for the mobile client; max 200 characters |
| `description` | String | Yes | Pre-rendered summary sentence; max 500 characters |
| `referenceId` | String | No | ID of the originating entity; used for deduplication |
| `referenceType` | String | No | Enum: `Donation`, `PointsTransaction`, `RewardRedemption`, `Request`, `User`, `Badge` |
| `metadata` | Mixed | No | Lightweight event data snapshot to avoid future JOINs |
| `icon` | String | No | Icon identifier for the Flutter UI |
| `createdAt` | Date | Auto | TTL index: auto-deleted after **365 days**; `updatedAt` is disabled (append-only) |

**Sources:** `Backend/src/models/` (all model files)

---

## 3.5 Validation Rules

Schema-level validation is enforced by Mongoose before any document is written to MongoDB. The following table documents the significant validation rules across the most critical collections.

### User (Base Schema)

| Field | Rule |
|-------|------|
| `fullName` | Required; length 3–100 characters; no character restriction (Arabic support required) |
| `email` | Required; unique; lowercase; regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| `password` | Required; minimum 8 characters; stored only as bcrypt hash |
| `role` | Enum: `donor`, `hospital`, `admin`, `superadmin` |

### Donor Discriminator

| Field | Rule |
|-------|------|
| `phoneNumber` | Required; regex: exactly 11 digits (`/^[0-9]{11}$/`) |
| `bloodType` | Required; enum: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| `dateOfBirth` | Required; must be a valid `Date` instance in the past |
| `weight` | Min: 0 (must be positive if provided) |
| `hemoglobinLevel` | Min: 0 (must be positive if provided) |
| `healthHistory.notes` | Max 1000 characters |
| `settings.language` | Enum: `en`, `ar` |
| `missedDonationCount` | Min: 0 |

### Hospital Discriminator

| Field | Rule |
|-------|------|
| `hospitalId` | Required; unique |
| `lat` | Min: −90, Max: 90 |
| `long` | Min: −180, Max: 180 |
| `workingHoursStart` | Min: 0, Max: 23 |
| `workingHoursEnd` | Min: 0, Max: 23 |
| `slotsPerHour` | Min: 1 (at least one slot per hour) |
| `bloodBanksAvailable` | Array constrained to valid blood type enum values |

### Request

| Field | Rule |
|-------|------|
| `type` | Required; enum: `blood`, `plasma`, `platelets`, `double_red_cells` |
| `bloodType` | Required when type is a blood-component type; at least one valid value from blood type enum |
| `urgency` | Required; enum: `low`, `medium`, `high`, `critical` |
| `status` | Enum: `pending`, `accepted`, `in-progress`, `completed`, `cancelled`, `expired` |
| `requiredBy` | Required; must be in the future **at document creation only** (not re-validated on updates) |
| `notes` | Max 500 characters |
| `hospitalContact` | Required; regex: 10–11 digits |
| `contactNumber` | Optional; regex: 10–15 digits with optional leading `+` |

### Donation

| Field | Rule |
|-------|------|
| `quantity` | Required; min: 1 |
| `status` | Enum: `pending`, `scheduled`, `completed`, `cancelled`, `rejected`, `expired`, `abandoned` |
| `scheduledDate` | Must be in the future **at creation only** |
| `completedDate` | Must be in the past |
| `notes` | Max 1000 characters |
| `unitsCollected` | Min: 1 if provided |
| `verificationStatus` | Enum: `pending`, `verified`, `rejected`, `completed` |
| Pre-save hook | Appointment-only (`requestId == null`) donations cannot transition to `scheduled` without an `appointmentId` |
| Pre-save hook | Pending, appointment-only donations are blocked from saving if past their `appointmentScheduleDeadline` and have no `appointmentId` |

### Appointment

| Field | Rule |
|-------|------|
| `appointmentDate` | Required; must be in the future **at creation only** |
| `status` | Enum: `pending`, `confirmed`, `completed`, `cancelled` |
| `donationType` | Enum: `Whole Blood`, `Plasma`, `Platelets`, `Double Red Cells` |
| `notes` | Max 500 characters |
| `rescheduleHistory` | Array max length: **10 entries** |
| `diseaseScreening.disqualifyingDiseases` | Validated against `DISQUALIFYING_DISEASE_CODES` constant |

### Points & Rewards

| Collection | Field | Rule |
|------------|-------|------|
| `DonorPoints` | `pointsBalance` | Min: 0 |
| `DonorPoints` | `lifetimePointsEarned` | Min: 0 |
| `DonorPoints` | `tier` | Enum: `bronze`, `silver`, `gold`, `platinum` |
| `PointsTransaction` | `pointsAmount` | Required (positive or negative) |
| `PointsTransaction` | `transactionType` | Enum of 11 valid transaction types |
| `PointsTransaction` | `description` | Required; max 200 characters |
| `PointsTransaction` | `balanceAfter` | Required |
| `Badge` | `unlockCondition` | Enum: `completedDonations`, `emergencyResponses` |
| `Badge` | `unlockThreshold` | Min: 1 |
| `Badge` | `rarity` | Enum: `COMMON`, `RARE`, `EPIC`, `LEGENDARY` |
| `Badge` | `category` | Enum: `DONATION`, `EMERGENCY`, `ENGAGEMENT`, `SOCIAL` |
| `RewardCatalog` | `pointsCost` | Min: 1 |
| `RewardCatalog` | `category` | Enum: `FOOD`, `ENTERTAINMENT`, `HEALTH`, `STATUS` |
| `RewardCatalog` | `status` | Enum: `ACTIVE`, `INACTIVE`, `LIMITED` |
| `RewardRedemption` | `pointsSpent` | Min: 1 |
| `RewardRedemption` | `status` | Enum: `PENDING`, `CONFIRMED`, `DELIVERED`, `CANCELLED`, `EXPIRED` |
| `RewardRedemption` | `deliveryMethod` | Enum: `IN_APP`, `EMAIL` |

### Authentication & Security

| Collection | Field | Rule |
|------------|-------|------|
| `OneTimeOtp` | `purpose` | Enum: `password_reset` |
| `OneTimeOtp` | `email` | Required; lowercase |
| `OneTimeOtp` | `expiresAt` | Required; used as TTL index key |
| `RefreshTokenBlacklist` | `tokenHash` | Required; unique |
| `RefreshTokenBlacklist` | `expiresAt` | Required; used as TTL index key |

### Notifications & Support

| Collection | Field | Rule |
|------------|-------|------|
| `Notification` | `type` | Enum: `match`, `request`, `milestone`, `emergency`, `system`, `admin`, `appointment` |
| `Notification` | `title` | Required; max 200 characters |
| `Notification` | `message` | Required; max 1000 characters |
| `Notification` | `relatedType` | Enum: `Request`, `Donation`, `User`, `Achievement`, `Appointment` |
| `SupportMessage` | `category` | Enum: `TECHNICAL`, `ACCOUNT`, `DONATION`, `REWARDS`, `OTHER` |
| `SupportMessage` | `status` | Enum: `OPEN`, `REVIEWED` |
| `SupportMessage` | `subject` | Max 200 characters |
| `SupportMessage` | `message` | Max 2000 characters |
| `SupportMessage` | `adminReply` | Max 4000 characters |

### Global Schema Constraint

All production collections use `strict: 'throw'` mode. Any attempt to save a document containing fields not declared in the schema results in a Mongoose validation error at the application layer, before the write reaches MongoDB. This prevents accidental schema pollution during development and ensures schema integrity across the entire system.

**Sources:** All 25 model files under `Backend/src/models/`, `Backend/src/constants/`

---

## 3.6 Indexes

Indexes are declared explicitly in each schema file via `schema.index()`. Automatic index creation (`autoIndex`) is disabled in Mongoose (`mongoose.set('autoIndex', false)` in `db.js`) to prevent duplicate-index warnings in production. The following table catalogues every non-default index in the database.

### `users` Collection

| Index | Type | Notes |
|-------|------|-------|
| `email` | Unique | Enforced by Mongoose schema-level `unique: true` |
| `fullNameNormalized` | Single-field | Supports Arabic-aware name search |
| `role` | Single-field | Filters by user role across all sub-types |
| `deletedAt` | Single-field | Fast soft-delete filtering |
| `location.coordinates` | 2dsphere (conditional) | Enabled when `ENABLE_GEOSPATIAL_INDEX=true`; supports future geo-radius queries on users |
| `location.coordinates.lat` + `.lng` | Compound | Fallback when 2dsphere is not enabled |
| `createdAt` | Single-field | Date-range queries for analytics |
| `adminKey` | Sparse unique | Admin login third-factor lookup |
| `hospitalId` | Single-field (Hospital) | Hospital record lookup by business ID |
| `hospitalNameNormalized` | Single-field (Hospital) | Hospital name search |
| `phoneNumber` | Single-field (Donor) | Donor phone lookup |
| `bloodType` | Single-field (Donor) | Blood-type filtering in matching engine |
| `lastDonationDate` | Single-field (Donor) | Cooldown and analytics queries |

### `requests` Collection

| Index | Type | Notes |
|-------|------|-------|
| `hospitalId + status` | Compound | Hospital dashboard: list requests by status |
| `urgency + status` | Compound | Background escalation worker query |
| `acceptedBy + status` | Compound | Donor's active request lookup |
| `hospitalLocationGeo` | 2dsphere | Geo-radius proximity queries for donor matching and nearby request discovery |
| `arrivalDeadline` | Single-field | Escalation worker: find overdue requests |
| `createdAt` | Single-field | Analytics and time-range filtering |
| `qrToken` | Sparse unique | QR code scan lookup |

### `donations` Collection

| Index | Type | Notes |
|-------|------|-------|
| `donorId + status` | Compound | Donor donation history and active-donation check |
| `requestId + status` | Compound | Request-linked donation lookup |
| `arrivalDeadline` | Single-field | Escalation worker: find donors past deadline |
| `appointmentId` | Unique partial | Prevents duplicate donation per appointment; applied only when `appointmentId` is an ObjectId |
| `donorId + requestId` (status: 'pending') | Unique partial | Prevents duplicate active donations from the same donor for the same request |
| `donorId + status + createdAt` | Compound | Ordered donation history |
| `appointmentScheduleDeadline` | Single-field | Background auto-cancellation of overdue pending donations |
| `verificationSessionId` | Single-field | On-site verification session lookup |
| `qrToken` | Single-field | QR token lookup |

### `appointments` Collection

| Index | Type | Notes |
|-------|------|-------|
| `donorId` | Single-field | Donor's appointment list |
| `hospitalId` | Single-field | Hospital's appointment dashboard |
| `status` | Single-field | Status-based filtering |
| `appointmentDate` | Single-field | Date-range slot queries |
| `donorId + hospitalId + status` | Unique partial (pending/confirmed only) | Prevents a donor from booking more than one active appointment at the same hospital |
| `verificationSessionId` | Single-field | On-site verification session lookup |
| `qrToken` | Sparse unique | QR check-in lookup |

### `donorpoints` Collection

| Index | Type | Notes |
|-------|------|-------|
| `donorId` | Unique | One-to-one relationship enforcement |
| `lifetimePointsEarned` (descending) | Single-field | Leaderboard ranking query |

### `pointstransactions` Collection

| Index | Type | Notes |
|-------|------|-------|
| `donorId + createdAt (desc)` | Compound | Chronological transaction history per donor |
| `transactionType` | Single-field | Aggregate reporting by type |
| `referenceId` | Single-field | Deduplication lookup by reference entity |
| `donorId + transactionType + referenceId` | Unique partial | Prevents double-awarding points for the same event; enforced only when `referenceId` is a non-null string |

### `badges` Collection

| Index | Type | Notes |
|-------|------|-------|
| `category` | Single-field | Category-based badge filtering |
| `unlockCondition + unlockThreshold` | Compound | Badge-check engine: find badges unlockable by a given metric and value |

### `userbadges` Collection

| Index | Type | Notes |
|-------|------|-------|
| `donorId + badgeId` | Unique compound | One progress record per donor–badge pair |
| `unlockStatus` | Single-field | Filter unlocked vs. locked badges |

### `notifications` Collection

| Index | Type | Notes |
|-------|------|-------|
| `read` | Single-field | Unread count queries |
| `userId + read` | Compound | Per-user unread notification list |
| `userId + createdAt (desc)` | Compound | Per-user chronological notification feed |
| `relatedId + relatedType` | Compound | Related-entity notification lookup |
| `idempotencyKey` | Unique sparse | Prevents duplicate notifications for the same event |
| `createdAt` | TTL | Auto-deletes documents after **90 days** |

### `notificationoutboxes` Collection

| Index | Type | Notes |
|-------|------|-------|
| `requestId` | Single-field | Outbox lookup for a specific request |
| `status` | Single-field | Worker query: find pending/failed deliveries |
| `createdAt` | TTL | Auto-deletes documents after **30 days** |

### `activities` Collection

| Index | Type | Notes |
|-------|------|-------|
| `userId + createdAt (desc)` | Compound | Primary timeline feed query |
| `userId + type + createdAt (desc)` | Compound | Category-filtered timeline queries |
| `userId + action + referenceId` | Unique partial | Prevents duplicate timeline events for the same action |
| `createdAt` | TTL | Auto-deletes documents after **365 days** |

### `onetimeotps` Collection

| Index | Type | Notes |
|-------|------|-------|
| `email + purpose + createdAt (desc)` | Compound | OTP lookup by email and purpose |
| `expiresAt` | TTL | MongoDB auto-deletes expired OTP documents immediately |

### `refreshtokenblacklists` Collection

| Index | Type | Notes |
|-------|------|-------|
| `tokenHash` | Unique | Fast hash lookup on token verification |
| `expiresAt` | TTL | MongoDB auto-deletes expired blacklist entries immediately |

### `rewardcatalogs` Collection

| Index | Type | Notes |
|-------|------|-------|
| `status` | Single-field | Active reward catalogue listing |
| `category` | Single-field | Category-filtered catalogue |
| `pointsCost` | Single-field | Cost-sorted browsing |

### `rewardredemptions` Collection

| Index | Type | Notes |
|-------|------|-------|
| `donorId + createdAt (desc)` | Compound | Donor redemption history |
| `rewardId` | Single-field | Per-reward redemption count |
| `status` | Single-field | Status-based filtering |

### `auditlogs` Collection

| Index | Type | Notes |
|-------|------|-------|
| `adminId` | Single-field | Per-admin audit history |
| `createdAt (desc)` | Single-field | Chronological audit feed |
| `targetType` | Single-field | Filter by entity type |
| `targetType + targetId` | Compound | Entity-level audit trail |

### `supportmessages` Collection

| Index | Type | Notes |
|-------|------|-------|
| `userId` | Single-field | Donor's submitted tickets |
| `status` | Single-field | Admin open-ticket queue |
| `category` | Single-field | Category filtering |
| `status + createdAt (desc)` | Compound | Admin inbox sorted by date |
| `createdAt (desc)` | Single-field | Global chronological listing |

### `inboundemails` Collection

| Index | Type | Notes |
|-------|------|-------|
| `providerEventId` | Single-field | Deduplicate incoming webhook events |
| `messageId` | Single-field | Message-level lookup |
| `receivedAt` | Single-field | Chronological email list |
| `isRead` / `isArchived` | Single-field | Inbox state filtering |
| `isArchived + isRead + receivedAt (desc)` | Compound | Combined inbox view query |
| `subject + from + text + to` | Full-text | Text search across email content |

**Sources:** All 25 model files under `Backend/src/models/`, `Backend/src/config/db.js`

---

## 3.7 Data Flow

This section describes how data moves through the database during the two primary system workflows.

### Flow A — Hospital Blood Request → Donor Response → Donation Completion

```
1. Hospital creates a Request document (status: 'pending').
   └─ hospitalLocationGeo (GeoJSON Point) is stored for geo-radius queries.

2. Matching engine queries users collection:
   └─ Filter: role='donor', isOptedIn=true, bloodType compatible, not suspended.
   └─ Geo-radius filter on location.coordinates using 2dsphere index.
   └─ Eligibility pre-check passes (computed dynamically from Donor fields).

3. For each matched donor:
   └─ Notification document created (type: 'match', userId: donorId).
   └─ NotificationOutbox document created (status: 'pending').
   └─ Background outbox worker (5s poll) claims outbox document and dispatches FCM push.

4. Donor accepts the request:
   └─ Eligibility re-checked against Donor document (8 rules).
   └─ Donation document created (status: 'pending', donorId, requestId, qrToken).
   └─ Request document updated: status → 'accepted', acceptedBy, acceptedDonationId, arrivalDeadline.
   └─ Activity document appended (type: 'donation', action: 'donation_created').

5. Background escalation worker (60s poll) monitors arrivalDeadline on Request:
   └─ If deadline passed and donation not completed → Donation status → 'expired'.
   └─ Request status → 'pending' (reopened for new donors).
   └─ missedDonationCount incremented on Donor.

6. Hospital scans donor QR code at on-site visit:
   └─ Donation document queried via qrToken index.
   └─ verificationChecklist updated (idVerified, questionnaireCompleted, consentSigned).
   └─ Donation status → 'completed', verificationStatus → 'completed'.
   └─ Request unitsAccepted incremented; status → 'completed' if fulfilled.
   └─ Donor.lastDonationDate updated.

7. Post-completion reward processing (atomic):
   └─ DonorPoints document updated via $inc (pointsBalance, lifetimePointsEarned).
   └─ PointsTransaction document created (type: BLOOD_DONATION, referenceId: donationId).
   └─ Tier re-evaluated; if promoted → PointsTransaction created (type: TIER_BONUS).
   └─ Badge progress checked; unlocked badges → UserBadge document upserted.
   └─ Activity documents appended for each reward event.
   └─ Notification document created (donation confirmed + points awarded).
```

### Flow B — Proactive Appointment Booking

```
1. Donor queries HospitalSettings for a target hospital:
   └─ appointmentSettings.workingDays, workingHoursStart/End, slotsPerHour read.
   └─ Existing Appointment documents for the date are counted to compute available slots.

2. Donor submits appointment booking:
   └─ Appointment document created (status: 'pending', donorDetails snapshot embedded).
   └─ Donation document created (status: 'pending', appointmentId set, requestId null).
   └─ qrToken generated and stored in Appointment document.

3. Hospital scans appointment QR at donation day:
   └─ Appointment document queried via qrToken sparse unique index.
   └─ diseaseScreening sub-document updated.
   └─ verificationChecklist updated.
   └─ Appointment status → 'completed'.
   └─ Donation status → 'completed'.
   └─ Points and badges awarded (same as Flow A step 7).
```

### Security & Authentication Data Flows

```
Registration:
   └─ User document created (isEmailVerified: false).
   └─ emailVerificationOtp (SHA-256 hash) stored in User document with 10-minute expiry.
   └─ On OTP confirmation → isEmailVerified: true, OTP fields cleared.

Password Reset:
   └─ OneTimeOtp document created (otpHash, expiresAt, attempts counter).
   └─ Auto-deleted by MongoDB TTL index after expiry.

Logout:
   └─ RefreshTokenBlacklist document created (tokenHash, expiresAt).
   └─ Auto-deleted by MongoDB TTL index after token's expiry date.

Admin Action:
   └─ AuditLog document created after every admin-initiated state change.
```

**Sources:** `Backend/src/models/`, `Backend/src/utils/state-machine.js`, `Backend/src/workers/`

---

## 3.8 Database Design Decisions

The following documents the significant architectural decisions made in the design of the LifeLink database layer, along with the rationale for each.

### Decision 1: Mongoose Discriminators for Multi-Role User Model

All user roles — donor, hospital, admin, superadmin — are stored in a **single `users` collection**, differentiated by the `__t` discriminator key. Role-specific fields are isolated in their respective sub-schemas (`Donor`, `Hospital`).

**Why:** This design simplifies cross-role operations (e.g., authentication, admin user listing, FCM token management) because they query a single collection and do not require `$lookup` joins across multiple collections. Shared fields (email, password, location, FCM tokens, suspension state) are defined once in the base schema, eliminating duplication. Role isolation is still achieved — Mongoose automatically appends the discriminator filter to all sub-model queries, preventing cross-role data leakage.

---

### Decision 2: Separate `DonorPoints` Collection (Not Embedded in `Donor`)

Donor points are stored in a **dedicated collection** (`donorpoints`) rather than as embedded fields within the `Donor` document.

**Why:** Separating points allows atomic `$inc` operations on the points balance without loading and re-saving the full donor document (which may be large due to the embedded `healthHistory` and `travelHistory` arrays). It also enables the leaderboard query to be a simple, indexed scan of a small, single-purpose collection rather than a heavier aggregation over the `users` collection.

---

### Decision 3: `strict: 'throw'` Mode on All Core Models

All production-facing Mongoose schemas are configured with `strict: 'throw'`, which causes Mongoose to throw a `ValidationError` — rather than silently ignoring — any attempt to save a field not declared in the schema.

**Why:** In a team development environment with multiple contributors, accidental field additions in model files or service layers can silently pollute documents with undeclared data, making data integrity audits difficult. The `throw` variant surfaces these mistakes immediately during development, before they reach the production database.

---

### Decision 4: Immutable Points Transaction Log

The `pointstransactions` collection is designed as an **append-only, immutable audit log**. Documents in this collection are never updated or deleted. Each transaction stores a `balanceAfter` snapshot.

**Why:** A full transaction history is essential for detecting double-award bugs, resolving donor disputes about their points balance, and passing academic review that requires evidence of system integrity. The `balanceAfter` snapshot means that the balance at any historical point can be read directly without replaying the entire transaction history. The partial unique index on `(donorId, transactionType, referenceId)` prevents a critical failure mode in which a background retry or duplicate event awards points twice for the same donation.

---

### Decision 5: TTL Indexes for Automatic Data Lifecycle Management

Four collections use MongoDB TTL (Time-To-Live) indexes for automatic document expiry without requiring cron jobs or scheduled cleanup services:

| Collection | TTL | Rationale |
|------------|-----|-----------|
| `notifications` | 90 days | Prevent unbounded growth of the notification feed; older notifications have no display value |
| `activities` | 365 days | Provide a 12-month donor activity window without indefinite storage growth |
| `onetimeotps` | Immediate on `expiresAt` | OTPs must become invalid precisely at their stated expiry; TTL removes them automatically |
| `refreshtokenblacklists` | Immediate on `expiresAt` | Blacklisted tokens need only be retained until they would have expired naturally; after that, they are harmless |
| `notificationoutboxes` | 30 days | Outbox entries older than 30 days represent permanently failed deliveries and should not clutter the worker queue |

---

### Decision 6: Embedded Snapshots to Avoid Historical Data Drift

The `Appointment.donorDetails` sub-document and the `Request.acceptedByName` / `acceptedByBloodType` / `acceptedByPhoneNumber` fields store **point-in-time snapshots** of donor information at the moment of the event, rather than relying on a live `$lookup` to the `users` collection.

**Why:** User profile data changes over time (e.g., a donor updates their phone number or blood type). If historical records referenced only the donor's `_id`, a read performed months later would return the donor's current data, not the data that was accurate at the time of the event. Snapshots preserve historical accuracy without the risk of drift, at the cost of minor storage redundancy.

---

### Decision 7: Partial Unique Indexes for Conditional Uniqueness

Several uniqueness constraints apply only to documents in a specific state, implemented via MongoDB's `partialFilterExpression` on unique indexes:

| Collection | Index | Condition | Purpose |
|------------|-------|-----------|---------|
| `donations` | `donorId + requestId` | `status: 'pending'` | Prevent a donor from accepting the same request twice simultaneously |
| `donations` | `appointmentId` | `appointmentId: ObjectId` | Ensure each appointment has at most one linked donation |
| `appointments` | `donorId + hospitalId + status` | `status: { $in: ['pending', 'confirmed'] }` | Prevent a donor from booking multiple concurrent active appointments at the same hospital |
| `pointstransactions` | `donorId + transactionType + referenceId` | `referenceId: String` | Prevent duplicate point awards for the same donation or event |
| `notifications` | `idempotencyKey` | `idempotencyKey: String` | Prevent duplicate notifications for the same event during retry |
| `activities` | `userId + action + referenceId` | `referenceId: String` | Prevent duplicate activity timeline entries for the same event |

This pattern enforces business invariants at the database layer — a stronger guarantee than application-layer checks, which can fail under concurrent requests.

---

### Decision 8: Centralised State Machine for Status Integrity

All status transitions across three collections (`requests`, `donations`, `appointments`) are governed by a single **state machine engine** (`state-machine.js`). Services must call `validateTransition(entityName, fromStatus, toStatus)` before persisting any status change.

**Why:** Without a centralised transition guard, status strings can be mutated ad hoc throughout the service layer, making it easy to create invalid states (e.g., a `completed` request reverting to `pending`, or a `cancelled` donation being marked `completed`). The state machine defines all valid transitions in a single, auditable transition matrix and throws a descriptive error on any illegal transition attempt. Terminal states (e.g., `completed`, `cancelled`) explicitly define an empty allowed-transitions array, making their finality explicit in the code.

**Transition matrices:**

*Request:* `pending → accepted → in-progress → completed` (terminal), with `cancelled` and `expired` reachable from most non-terminal states.

*Donation:* `pending → scheduled → completed` (terminal), with `cancelled`, `rejected`, `expired`, `abandoned` as terminal states reachable from early stages.

*Appointment:* `pending → confirmed → completed` (terminal), with `cancelled` reachable from `pending` or `confirmed`.

---

### Decision 9: GeoJSON Point Format for Hospital Location in `requests`

Hospital geographic coordinates on `Request` documents are stored in **GeoJSON Point format** (`{ type: "Point", coordinates: [longitude, latitude] }`), not as flat `lat`/`lng` fields.

**Why:** MongoDB's `2dsphere` geospatial index, which enables efficient `$near` and `$geoWithin` queries, requires coordinates to be stored in GeoJSON format. Without this index, the donor-matching engine would require a full collection scan and application-layer Haversine distance calculation for every match query — an operation that would not scale as the number of active requests grows. The `2dsphere` index on `hospitalLocationGeo` enables MongoDB to prune the candidate set geographically before blood-type and eligibility filters are applied.

---

### Decision 10: `NotificationOutbox` Pattern for Reliable FCM Delivery

FCM push notifications are not dispatched synchronously in the API request path. Instead, a pending `NotificationOutbox` document is written to MongoDB during the request, and a background worker polls every 5 seconds to claim and dispatch pending entries.

**Why:** FCM is an external service and can experience latency spikes, transient failures, or token invalidation errors. If push delivery were attempted synchronously, any FCM failure would propagate as an API error visible to the calling client, even though the underlying data operation (e.g., creating a donation record) had already succeeded. The outbox pattern decouples delivery reliability from API response time and provides automatic retry with a configurable attempt limit (default: 5), after which the entry is marked `failed` and retained for 30 days before TTL expiry.

**Sources:** `Backend/src/models/`, `Backend/src/utils/state-machine.js`, `Backend/src/config/db.js`, `Backend/src/constants/`

---

# 4. Frontend Knowledge

## 4.1 Frontend Overview

The LifeLink mobile frontend is built using **Flutter** (Dart SDK ≥ 3.9.0), targeting both **iOS** and **Android** from a single shared codebase. The application is structured as a multi-role client that dynamically presents a distinct interface based on the authenticated user's role: donor, hospital, or admin/superadmin.

The application package is named `blood_donation_app` and the root widget is `BloodDonationApp`, which wraps the entire widget tree in a `ScreenUtilInit` context for resolution-independent sizing and a `MaterialApp` configured with Flutter's localisation delegates for bilingual (Arabic/English) support.

All HTTP communication is handled through a single **Dio** instance configured at application startup. A custom `AuthInterceptor` is registered globally, which automatically attaches JWT access tokens to every outgoing request and silently refreshes expired tokens using the stored refresh token, routing the retry through the same Dio instance without user interruption.

Persistent local storage for authentication credentials and UI state is provided by **Hive CE**, a lightweight, NoSQL key-value store. Two separate Hive data sources are initialised at startup: `AuthHiveDataSource` for donor session data and `AdminHiveDataSource` for admin session data. Firebase is initialised for push notifications, and the device FCM token is retrieved before the widget tree renders.

**Sources:** `Frontend/lib/main.dart`, `Frontend/lib/blood_donation_app.dart`, `Frontend/pubspec.yaml`, `Frontend/lib/core/interceptors/auth_interceptor.dart`

---

## 4.2 Application Structure

The frontend codebase is organised following a **feature-first, clean-architecture** layering strategy. Every distinct feature domain (authentication, home, donate, rewards, notifications, profile, chatbot, etc.) maintains its own `data`, `domain`, and `presentation` layers, ensuring separation of concerns and testability.

### Top-Level Directory Layout

```
Frontend/lib/
├── main.dart                       # Application entry point; DI wiring; all BlocProviders
├── blood_donation_app.dart         # Root widget (MaterialApp, ScreenUtil, localisation)
├── firebase_options.dart           # Auto-generated Firebase configuration
├── notifications.dart              # FCM token retrieval helper
├── core/                           # Shared infrastructure
│   ├── cubits/                     # App-level cubits (MapCubit)
│   ├── errors/                     # Custom exception classes
│   ├── extension/                  # Dart extension methods
│   ├── interceptors/               # AuthInterceptor (Dio)
│   ├── resources/
│   │   ├── api_manger/             # ApiManger (all API endpoint constants)
│   │   ├── assets_manger/          # Asset path constants
│   │   ├── colors/                 # ColorManger (design token palette)
│   │   ├── constant/               # App-wide constants
│   │   ├── fonts/                  # FontWeightManager, FontSize
│   │   ├── models/                 # Shared data models
│   │   └── routes/                 # RouteManger (centralised route registry)
│   ├── service/                    # Utility services
│   ├── utils/                      # Error localisation helpers
│   └── widgets/                    # Shared, reusable UI components
├── data/
│   └── locations/                  # Location services
├── l10n/                           # ARB localisation files (en, ar)
└── presentation/
    ├── splash_screen/              # Animated splash + session resolution
    ├── onboarding/                 # First-launch onboarding flow
    ├── choose_role/                # Role selection gateway
    ├── maps/                       # Shared interactive map screen
    ├── authentication/
    │   ├── donor_authentication/   # Donor login, register, OTP, password reset
    │   ├── hospital_authentication/# Hospital login, password reset
    │   └── admin_authentication/   # Admin login, password reset
    └── role/
        ├── donor/tabs/             # Full donor interface (5 tabs + sub-screens)
        ├── hospital/tabs/          # Full hospital interface (5 tabs + sub-screens)
        └── admin/tabs/             # Full admin interface (6 tabs + sub-screens)
```

### Architectural Layers Within Each Feature

Each feature module consistently implements four sub-layers:

| Layer | Responsibility |
|-------|----------------|
| `data/data_source/remote/` | Concrete API calls using the shared Dio instance |
| `data/data_source/local/` | Hive-backed local persistence (session tokens, cached state) |
| `data/repositories/` | Implementation of domain repository interfaces |
| `domain/use_case/` | Business logic orchestration; calls repositories |
| `presentation/view_model/` | Cubit (BLoC) exposing state streams to the UI |
| `presentation/view/` | Flutter Widget trees consuming state |

**Sources:** `Frontend/lib/` (entire directory tree)

---

## 4.3 Screens and User Interface

### Pre-Authentication Screens

| Screen | File | Purpose |
|--------|------|---------|
| Splash Screen | `presentation/splash_screen/splash_screen.dart` | Animated logo entry; validates stored session tokens and routes the user directly to their role layout if a valid session is found, or to `ChooseRole` if not. |
| Onboarding | `presentation/onboarding/onboarding_pages.dart` | Multi-page carousel (PageView) displayed to first-time users, introducing the platform's value proposition. Three slides with role-specific colour themes. |
| Choose Role | `presentation/choose_role/choose_role.dart` | Gateway screen where the user selects whether they are a Donor, Hospital, or Admin. Each card routes to the corresponding authentication flow. Adapts layout responsively for wide-screen devices. |

### Donor Authentication Screens

| Screen | File | Purpose |
|--------|------|---------|
| Donor Login | `donor_authentication/donor_login.dart` | Email and password form; handles loading, success, and error states via `AuthCubit`. |
| Donor Register | `donor_authentication/donor_register.dart` | Multi-field registration form collecting full name, email, password, phone, date of birth, blood type, gender, and geographic location. |
| OTP Verification | `core/widgets/custom_pin_verification_screen.dart` | 6-digit PIN code entry screen (reusable across all roles) for email OTP confirmation post-registration. |
| Donor Forget Password | `donor_authentication/donor_forget_password.dart` | Email-entry step for the password reset flow. |
| Donor Reset Password | `donor_authentication/presentation/view/widgets/donor_reset_password.dart` | New password entry step following OTP verification. |

### Hospital Authentication Screens

| Screen | File | Purpose |
|--------|------|---------|
| Hospital Login | `hospital_authentication/hospital_authentication.dart` | Credential-based login for hospital accounts. |
| Hospital Forget Password | `hospital_authentication/hospital_forget_password.dart` | Password reset initiation for hospital users. |

### Admin Authentication Screens

| Screen | File | Purpose |
|--------|------|---------|
| Admin Login | `admin_authentication/presentation/view/admin_authentication.dart` | Login form with email, password, and the third-factor `adminKey` credential. |
| Admin Forget Password | `admin_authentication/presentation/view/admin_forget_password.dart` | Admin-specific password reset initiation. |

### Donor Interface — Main Tabs

The donor interface is a 5-tab bottom navigation layout (`MainLayout` in `donor_main_layout.dart`). Tabs are rendered inside a `PageView` with spring-animated icon transitions.

| Tab Index | Tab Label | Screen Class | Purpose |
|-----------|-----------|--------------|---------|
| 0 | Home | `Home` | Displays the donor dashboard: eligibility status card, active blood request feed, quick-action widgets, and recent activity timeline. |
| 1 | Find | `FindHospital` | Geo-sorted list of nearby hospitals with search capability; navigates to map view or hospital details. |
| 2 | Donate | `Donate` | Hub for the donation workflow: lists accepted active requests, lists upcoming appointments, and surfaces the Schedule Donation entry point. |
| 3 | Rewards | `RewardsScreen` | Multi-tab rewards centre displaying the donor's points balance, tier badge, reward catalogue, badge gallery, and transaction history. |
| 4 | Profile | `Profile` | Donor profile hub: view/edit personal and medical details, access notifications, settings, help & support, privacy controls, and 2FA. |

### Donor Interface — Sub-Screens and Overlays

| Screen | Route Key | Purpose |
|--------|-----------|---------|
| Request Screen | `/requestScreen` | Detailed view of a specific blood request; allows the donor to accept or view request specifics. |
| Schedule Donation (4-step wizard) | `/scheduleDonation` | Guided appointment booking: Step 1 — Location (hospital selection from geo-sorted list); Step 2 — Date & Time (dynamic slot picker); Step 3 — Review & Confirm; Step 4 — Appointment Confirmed. |
| Accepted Request Details | `/acceptedRequestDetails` | Detail view for an in-progress accepted request, including QR code display. |
| Appointment Details | `/appointmentDetails` | Detail view for a booked appointment, including QR code and status. |
| Donation History | `/donationHistory` | Chronological log of the donor's completed and past donations. |
| Notifications | `/notifications` | Full notification inbox; supports mark-as-read and deletion. |
| Confirm Donation | `/confirmDonation` | On-site confirmation step accessible from the donor side. |
| Chatbot Dialog | `chat_bot/chat_bot_dialog.dart` | Text-based conversational AI interface using SSE streaming; launched from the Home tab. |
| Voice Call Screen | `chat_bot/voice_call_screen.dart` | Voice-mode AI assistant using `speech_to_text` for input and `flutter_tts` for speech output; supports automatic language detection (Arabic/English). |
| Edit Profile | `profile/presentation/view/edit_profile/` | Form for updating donor personal and medical information. |
| Privacy & Security | `/privacyAndSecurity` | Toggle switches for privacy settings. |
| Two-Factor Authentication | `/twoFactorAuthentication` | 2FA configuration and management. |
| Help & Support | `/helpAndSupport` | Donor help centre with document links and support ticket submission. |
| PDF Viewer | `/pdfViewer` | In-app PDF renderer (`syncfusion_flutter_pdfviewer`) for help documents. |
| Map Screen | `/mapScreen` | Interactive Google Maps view for location selection (used during registration and appointment booking). |
| Ban Screen | `/banScreen` | Informational screen displayed to suspended accounts, showing the suspension reason. |

### Hospital Interface — Main Tabs

The hospital interface is a 5-tab bottom navigation layout (`HospitalMainLayout`). The accent colour is Royal Blue (`#2563EB`), distinguishing it visually from the donor (red) and admin (purple) interfaces.

| Tab Index | Tab Label | Screen Class | Purpose |
|-----------|-----------|--------------|---------|
| 0 | Home | `Home` | Hospital dashboard displaying summary statistics and recent activity. |
| 1 | Find | `FindDonor` | Browse and filter registered donors; view donor profiles and contact details. |
| 2 | Request | `Request` | Create and manage blood requests; view the status of active and past requests. |
| 3 | History | `History` | Historical log of completed and cancelled blood requests and donation events. |
| 4 | Profile | `Profile` | Hospital profile management, settings, and help & support. |

### Hospital Interface — Sub-Screens

| Screen | Route Key | Purpose |
|--------|-----------|---------|
| QR Scanner | `/scanQrCode` | Camera-based QR code scanner (`mobile_scanner`) for on-site donor verification; initiates the verification checklist flow. |
| Help & Support (Hospital) | `/helpAndSupportHospital` | Hospital-specific help centre. |

### Admin Interface — Main Tabs

The admin interface is a 6-tab bottom navigation layout (`AdminMainLayout`). The accent colour is Bright Purple (`#9747FF`).

| Tab Index | Tab Label | Screen Class | Purpose |
|-----------|-----------|--------------|---------|
| 0 | Dashboard | `Dashboard` | System analytics overview: key metrics, trends charts, and summary cards. |
| 1 | Users | `Users` | Full user management: list donors and hospitals, create hospital accounts, create admin accounts, suspend/unsuspend, delete, restore users. |
| 2 | Requests | `AdminRequest` | Blood request management: view all requests, manually broadcast, fulfil, or cancel requests. |
| 3 | Analytics | `Analytics` | Detailed analytics: donation distribution by type, top-donor leaderboard, time-series charts. |
| 4 | Rewards | `AdminRewards` | Reward catalogue management: create, edit, activate, and deactivate redeemable rewards. |
| 5 | Settings | `SystemSettings` | System configuration: maintenance mode toggle, admin profile, and inbound email archive. |

### Admin Interface — Sub-Screens

| Screen | Route Key | Purpose |
|--------|-----------|---------|
| Inbound Emails | `/inboundEmailsScreen` | List, read, archive, and delete inbound emails received by the platform. |
| Custom Reset Password | `/customResetPassword` | Shared password reset form parameterised by role. |

**Sources:** `Frontend/lib/presentation/` (all screen files), `Frontend/lib/core/resources/routes/route_manger.dart`

---

## 4.4 Navigation Flow

### Navigation Strategy

The application uses **named-route imperative navigation** via Flutter's `Navigator` API, centralised in `RouteManger` (`core/resources/routes/route_manger.dart`). All routes are defined as static constants (e.g., `RouteManger.splashScreen`, `RouteManger.donorMainLayout`) and resolved by a single `router` function that returns a `MaterialPageRoute` for each registered route name. Route arguments are passed through `RouteSettings.arguments` and cast to strongly-typed argument models (e.g., `PinVerificationArgs`, `ResetPasswordArgs`).

Within the main role layouts (Donor, Hospital, Admin), in-tab navigation is handled by a `PageController`-driven `PageView`, which allows swipe gestures (with `BouncingScrollPhysics`) and tab-bar tap to switch between the primary tabs without rebuilding the widget tree.

### Top-Level Navigation Flow

```
App Launch
    └─ SplashScreen
           ├─ (stored session + valid token) ──► Role-based layout
           │       ├─ Donor  ──► DonorMainLayout  (5-tab PageView)
           │       ├─ Hospital ──► HospitalMainLayout (5-tab PageView)
           │       └─ Admin/Superadmin ──► AdminMainLayout (6-tab PageView)
           └─ (no session / expired)
                   └─ OnboardingPages ──► ChooseRole
                           ├─ Donor  ──► DonorLogin ──► DonorRegister / ForgotPassword
                           ├─ Hospital ──► HospitalAuthentication / ForgotPassword
                           └─ Admin  ──► AdminAuthentication / ForgotPassword
```

### Splash Screen Session Resolution

The `SplashScreen` runs two parallel session checks during its animated display:

1. `AuthCubit.isUserLoggedIn()` — checks the donor Hive store for a stored access token.
2. `AdminAuthCubit.isAdminLoggedIn()` — checks the admin Hive store.

If a session is found, `validateToken()` is called against the backend. If the token is valid, the role field returned drives the navigation decision; if invalid, the user is routed to `ChooseRole`.

### Donor In-App Navigation Flows

| Journey | Navigation Path |
|---------|----------------|
| Accept a blood request | Home tab → Request card → `RequestScreen` (push) → Accept action |
| Schedule an appointment | Donate tab → Schedule Donation button → `ScheduleDonation` (push, 4-step wizard) |
| View accepted request | Donate tab → Active Requests list → `AcceptedRequestDetails` (push) |
| Browse rewards | Rewards tab (in-tab sub-tabs: Rewards, Badges, History, Earning Rules) |
| Edit profile | Profile tab → Edit Profile → `EditProfile` screen (push) |
| Open chatbot | Home tab → Chatbot FAB → `ChatBotDialog` (bottom sheet or full-screen push) |
| Voice AI session | ChatBot screen → Voice button → `VoiceCallScreen` (push) |

### Hospital In-App Navigation Flows

| Journey | Navigation Path |
|---------|----------------|
| Scan donor QR | Any tab → QR icon shortcut → `ScanQr` (push) |
| View request details | Request tab → Request card → Detail view (in-tab push) |

### Token Refresh Flow (Silent)

The `AuthInterceptor` intercepts every `401 Unauthorized` response, silently attempts to refresh the access token via `POST /auth/refresh-token`, updates the Hive store with the new token pair, and transparently retries the original failed request. If the refresh fails, the Hive store is cleared and the user must re-authenticate.

**Sources:** `Frontend/lib/core/resources/routes/route_manger.dart`, `Frontend/lib/presentation/splash_screen/splash_screen.dart`, `Frontend/lib/core/interceptors/auth_interceptor.dart`, all main layout files

---

## 4.5 State Management

### Approach: Flutter BLoC (Cubit Pattern)

The application uses **flutter_bloc** (version 9.1.1) throughout, adopting the **Cubit** variant of the BLoC pattern. Each feature domain exposes one or more `Cubit` subclasses that emit strongly-typed state objects. The UI layer consumes state via `BlocBuilder`, `BlocListener`, and `BlocConsumer` widgets.

### Global BLoC Provisioning

All Cubits are instantiated and provided at the application root in `main.dart` using a single `MultiBlocProvider`. This ensures that state persists across navigation events for features whose state should survive tab switching (e.g., the donor profile, notification badge count, points balance). Each Cubit is constructed with its full dependency chain: `Cubit → UseCase → Repository → Remote/Local DataSource`.

### State Classes

Each Cubit typically emits states from the following pattern:

| State Class | Description |
|-------------|-------------|
| `Initial` | Default state emitted on Cubit construction, before any action is taken. |
| `Loading` | Emitted immediately when an async operation begins; causes the UI to display a skeleton loader or spinner. |
| `Success<T>` | Emitted on successful API response; carries the parsed data model. |
| `Error` | Emitted on failure; carries a localised error key that the UI maps to a human-readable string. |

Shared state widget classes in `core/widgets/states/` provide consistent UI representations for loading (`custom_loading_widget.dart`), success (`custom_success_widget.dart`), error (`custom_error_widget.dart`), and skeleton loading (`custom_skeleton_loading_widget.dart`) states.

### Cubit Catalogue

The following table documents every Cubit provisioned in `main.dart`, the feature it manages, and its role:

| Cubit | Feature Domain | Responsibility |
|-------|---------------|----------------|
| `AuthCubit` | Donor Authentication | Login, signup, OTP verification, token validation, logout, `getMe` |
| `AdminAuthCubit` | Admin Authentication | Admin login, token validation, `getMe` |
| `ProfileCubit` | Donor Profile | Fetch donor profile data |
| `EditProfileCubit` | Edit Profile | Submit profile update requests |
| `ChangePasswordCubit` | Security | Change password flow |
| `SettingCubit` | App Settings | Fetch and update donor notification preferences |
| `SupportContactCubit` | Help & Support | Submit support tickets |
| `DonorStatesCubit` | Home Dashboard | Fetch donor statistics (donation count, points, tier) with Hive caching |
| `DonationEligibilityCubit` | Home Dashboard | Fetch real-time donation eligibility status |
| `RequestsCubit` | Home / Requests | Fetch available blood requests for the donor |
| `AcceptRequestCubit` | Home / Requests | Accept a blood request |
| `CancelRequestCubit` | Home / Requests | Cancel an accepted request |
| `AcceptedRequestsCubit` | Donate Tab | Fetch the donor's currently accepted/active request |
| `AppointmentsCubit` | Donate Tab | Fetch the donor's upcoming appointments |
| `TimeSlotsCubit` | Schedule Donation | Fetch available appointment time slots for a selected hospital and date |
| `DonationScheduleCubit` | Schedule Donation | Local wizard-state management (selected hospital, date, time slot) |
| `DonationHistoryCubit` | Donation History | Fetch chronological donation history |
| `NearbyHospitalsCubit` | Find Hospital | Fetch geo-sorted list of nearby hospitals |
| `NotificationCubit` | Notifications | Fetch notification inbox |
| `NotificationAllReadCubit` | Notifications | Mark all notifications as read |
| `NotificationDeleteCubit` | Notifications | Delete a single notification |
| `FcmCubit` | Notifications | Register / deregister the device FCM token |
| `RewardsCubit` | Rewards | Fetch reward catalogue |
| `UserPointsCubit` | Rewards | Fetch the donor's current points balance and tier |
| `EarningRulesCubit` | Rewards | Fetch the platform's points-earning rules |
| `HistoryCubit` | Rewards | Fetch points transaction history |
| `ActivitiesCubit` | Home | Fetch donor activity timeline |
| `AskCubit` | Chatbot | Send messages to AI chatbot; handle SSE streaming |
| `MapCubit` | Map | Manage map state (selected location, coordinates) |
| `AdminAuthCubit` | Admin Auth | Admin session management |
| `AdminProfileCubit` | Admin Settings | Fetch and update admin profile |
| `AnalyticsCubit` | Admin Dashboard | Fetch dashboard analytics |
| `AnalyticsOverviewCubit` | Admin Analytics | Fetch detailed analytics overview |
| `UsersCubit` | Admin Users | User list, creation, suspension, deletion |
| `AdminRequestsCubit` | Admin Requests | Request list, broadcast, fulfil, cancel |
| `AdminRewardsCubit` | Admin Rewards | Reward catalogue management |
| `SystemHealthCubit` | Admin Settings | Fetch system health status |
| `InboundEmailCubit` | Admin Settings | Fetch and manage inbound emails |

### Local Persistence

Two Hive data sources provide offline-capable storage:

| Data Source | Contents |
|-------------|----------|
| `AuthHiveDataSource` | Donor access token, refresh token, user ID, role |
| `AdminHiveDataSource` | Admin access token, refresh token, admin ID, role |
| `HiveDonorStatesDataSource` | Cached donor statistics (points, donation count, tier) |
| `HiveNotificationDataSource` | Cached notification read-state |

**Sources:** `Frontend/lib/main.dart`, `Frontend/lib/core/widgets/states/`, `Frontend/README_BLOC.md`

---

## 4.6 User Journey

This section documents the primary end-to-end journeys through the application from a user perspective.

### Journey 1 — Donor First-Time Registration

1. User launches the app → Splash Screen displays (animated logo, 3-second minimum).
2. No stored session detected → User is routed to Onboarding (3-slide carousel).
3. User proceeds to Choose Role → selects "Blood Donor".
4. User completes the Donor Login screen → taps "Don't have an account" → Donor Register screen.
5. User fills in the registration form (personal details, blood type, location via Map screen).
6. On submission, `AuthCubit` calls the signup endpoint; OTP verification screen is presented.
7. User enters the 6-digit email OTP → account is verified → routed to Donor Login.
8. User logs in → session stored in Hive → routed to Donor Main Layout.

### Journey 2 — Donor Responds to a Blood Request

1. Donor opens the Home tab; the requests feed displays available blood requests near the donor.
2. Donor taps a request card → `RequestScreen` opens with full request details (blood type, urgency, hospital, deadline).
3. Donor taps "Accept" → `AcceptRequestCubit` submits the acceptance.
4. On success, the Donate tab's active-requests section now shows the accepted request.
5. Donor travels to the hospital and presents the QR code displayed on the `AcceptedRequestDetails` screen.
6. Hospital staff scan the QR code → verification checklist is completed → donation is marked as done.
7. Donor receives a push notification confirming the donation and points awarded.

### Journey 3 — Donor Books a Proactive Appointment

1. Donor navigates to the Donate tab → taps "Schedule Donation".
2. **Step 1 (Location):** Donor selects a hospital from the geo-sorted list.
3. **Step 2 (Date & Time):** Donor selects an available date and time slot (dynamically fetched from the backend).
4. **Step 3 (Review & Confirm):** Donor reviews summary and submits.
5. **Step 4 (Confirmed):** Confirmation screen is shown with a success animation.
6. The appointment appears on the Donate tab with a QR code for on-site check-in.

### Journey 4 — Donor Interacts with the AI Chatbot

1. Donor opens the chatbot via the Chatbot entry point on the Home tab.
2. Text mode: Donor types a question; `AskCubit` sends the query via SSE endpoint; streaming response is displayed token-by-token in the chat bubble UI.
3. Voice mode: Donor taps the voice button → `VoiceCallScreen` opens → presses the microphone button to begin speaking.
4. `speech_to_text` captures the query; `AskCubit` sends it to the chatbot endpoint; the text response is read aloud via `flutter_tts`.
5. The system auto-detects Arabic vs. English text to select the appropriate TTS locale.

### Journey 5 — Hospital Creates a Blood Request

1. Hospital user logs in → routed to Hospital Main Layout.
2. Hospital navigates to the Request tab → taps "Create Request".
3. Hospital fills in the request form (blood type, urgency, units needed, deadline, notes).
4. On submission, the backend matches compatible donors and dispatches push notifications.
5. The hospital can monitor incoming donor acceptances via the Request tab.

### Journey 6 — Hospital Scans Donor QR Code

1. Hospital staff navigate to the QR Scanner (accessible from any tab via a shortcut button).
2. The `ScanQr` screen activates the device camera via `mobile_scanner`.
3. On successful scan, the donor's details and verification checklist are presented.
4. Staff complete the checklist (identity, questionnaire, consent) and confirm the donation.

### Journey 7 — Admin Monitors System

1. Admin/superadmin logs in (with email, password, and `adminKey` third factor).
2. Routed to Admin Main Layout → Dashboard tab displays system health and key donation metrics.
3. Admin can navigate to Users tab to create hospital accounts or manage donor/hospital accounts (suspend, delete, restore).
4. Admin navigates to Analytics tab to review donation type trends and top-donor leaderboard.
5. Admin navigates to Rewards tab to add or modify redeemable rewards in the catalogue.
6. Admin navigates to Settings tab to toggle maintenance mode and review inbound emails.

**Sources:** All screen files under `Frontend/lib/presentation/`

---

## 4.7 Reusable Components

The application defines a shared component library in `Frontend/lib/core/widgets/`. These widgets are consumed across multiple features and roles, providing visual and behavioural consistency.

### Shared Widget Library

| Component | File | Description |
|-----------|------|-------------|
| `CustomText` | `custom_text.dart` | Wrapper around `Text` applying the application's font scale system. |
| `CustomTextField` | `custom_text_field.dart` | Styled input field with consistent border radius, fill colour, and validation integration. |
| `CustomElevatedButton` | `custom_elevated_button.dart` | Primary action button with standardised padding, border radius, and loading state support. |
| `CustomDropdown` | `custom_dropdown.dart` | Simplified dropdown selector wrapper. |
| `CustomDropdownButtonFormField` | `custom_drop_down_button_form_field.dart` | Full-featured form-integrated dropdown with validation support. |
| `CustomLabel` | `custom_label.dart` | Pre-styled text label for form field headings. |
| `CustomAuthBox` | `custom_auth_box.dart` | Styled container used in authentication screen layouts. |
| `CustomNoteCard` | `custom_note_card.dart` | Informational card component for displaying contextual notes and warnings. |
| `CustomPinCode` | `custom_pin_code.dart` | 6-cell PIN entry widget backed by the `pinput` package. |
| `CustomPinVerificationScreen` | `custom_pin_verification_screen.dart` | Full-screen OTP verification flow (reused for donor, hospital, and admin email verification). |
| `CustomResetPassword` | `custom_reset_password.dart` | Reusable new-password entry form (used across all three role password-reset flows). |
| `CustomBanScreen` | `custom_ban_screen.dart` | Suspended-account informational screen; accepts a `BanRole` argument to adapt its messaging. |
| `CustomTrendsChart` | `custom_trends_chart.dart` | Line/bar chart wrapper using `fl_chart`, shared across the admin analytics and dashboard screens. |
| `LocationPickerMap` | `location_picker_map.dart` | Interactive Google Maps widget that allows the user to drop a pin and capture coordinates; used during registration and appointment booking. |
| `SkeletonLoaders` | `skeleton_loaders.dart` | Pre-built skeleton shimmer placeholders (backed by `skeletonizer`) for list items and cards, displayed while data is loading. |
| `LoadingContainer` | `loading_container.dart` | Simple centered `CircularProgressIndicator` container for full-screen loading states. |
| `CustomLoadingWidget` | `states/custom_loading_widget.dart` | BLoC-specific loading state widget. |
| `CustomSuccessWidget` | `states/custom_success_widget.dart` | BLoC-specific success state widget. |
| `CustomErrorWidget` | `states/custom_error_widget.dart` | BLoC-specific error state widget with retry support. |
| `CustomSkeletonLoadingWidget` | `states/custom_skeleton_loading_widget.dart` | BLoC-specific skeleton loading state widget. |

### Role-Specific Shared Components

Beyond the core widget library, each role interface defines its own shared sub-widgets in feature-level `widgets/` subdirectories (e.g., `home/presentation/view/widgets/`, `rewards/widgets/`). These are scoped to their respective feature and not shared globally.

**Sources:** `Frontend/lib/core/widgets/`

---

## 4.8 External Packages and Libraries

The following third-party packages are declared in `Frontend/pubspec.yaml` and constitute the application's external dependency footprint:

| Package | Version | Role |
|---------|---------|------|
| `flutter_bloc` | ^9.1.1 | State management (Cubit/BLoC pattern) |
| `dio` | ^5.9.2 | HTTP client; handles API requests, interceptors, and SSE streaming |
| `hive_ce` | ^2.19.3 | Local key-value storage for session tokens and cached state |
| `path_provider` | ^2.1.5 | Resolves the device's application documents directory for Hive initialisation |
| `firebase_core` | ^4.9.0 | Firebase SDK initialisation |
| `firebase_messaging` | ^16.2.2 | Firebase Cloud Messaging for push notification receipt |
| `flutter_local_notifications` | ^20.1.0 | Display local push notification banners when the app is in the foreground |
| `google_maps_flutter` | ^2.17.0 | Embedded Google Maps for location picking (registration, appointment booking) |
| `geolocator` | ^14.0.2 | Device GPS access for obtaining the user's current latitude and longitude |
| `geocoding` | ^4.0.0 | Reverse geocoding to resolve coordinates to city/governorate strings |
| `mobile_scanner` | ^7.2.0 | Camera-based QR code and barcode scanning (hospital verification flow) |
| `qr_flutter` | ^4.1.0 | QR code image generation from token strings (donor-side QR display) |
| `speech_to_text` | ^7.3.0 | On-device speech recognition for the voice chatbot mode |
| `flutter_tts` | ^4.2.5 | Text-to-speech output for the voice chatbot mode |
| `permission_handler` | ^12.0.1 | Runtime permission requests (microphone, location, camera) |
| `fl_chart` | ^1.2.0 | Chart rendering for admin analytics and dashboard screens |
| `syncfusion_flutter_pdfviewer` | ^33.2.7 | In-app PDF viewer for help documentation |
| `pinput` | ^6.0.2 | Customisable PIN code input field (OTP verification screens) |
| `flutter_screenutil` | ^5.9.3 | Resolution-independent sizing using a 360×690 design reference |
| `skeletonizer` | ^2.1.3 | Skeleton shimmer loading animations for list and card components |
| `font_awesome_flutter` | ^11.0.0 | Extended icon set for UI elements |
| `share_plus` | ^12.0.1 | Native share sheet for sharing content from the application |
| `url_launcher` | ^6.3.2 | Launch external URLs (help links, support contact) |
| `flutter_localizations` | SDK | Flutter's built-in localisation delegates |
| `intl` | ^0.20.2 | Internationalisation utilities (date formatting, number formatting) |
| `flutter_launcher_icons` | ^0.14.4 | App icon generation for both platforms |
| `flutter_native_splash` | ^2.4.7 | Native splash screen configuration (before Flutter engine loads) |
| `cupertino_icons` | ^1.0.8 | iOS-style icon set |

**Sources:** `Frontend/pubspec.yaml`

---

## 4.9 Frontend Design Decisions

### Decision 1: Role-Specific Visual Identity

Each of the three user interfaces is assigned a distinct accent colour, defined in `ColorManger`:

| Role | Accent Colour | Hex Value |
|------|--------------|-----------|
| Donor | Bright Red | `#FF3B3B` |
| Hospital | Royal Blue | `#2563EB` |
| Admin/Superadmin | Bright Purple | `#9747FF` |

This deliberate colour differentiation eliminates visual ambiguity when a user transitions between roles. Navigation bar active states, indicator pills, and primary action buttons all adopt the role-specific colour, giving each interface a cohesive and immediately recognisable identity.

---

### Decision 2: Clean Architecture with Feature-First Directory Structure

Rather than grouping files by type (all controllers together, all views together), the codebase groups them by feature domain. Each feature maintains its own `data`, `domain`, and `presentation` layers as sibling directories.

**Why:** This structure makes each feature independently navigable and testable. Adding, removing, or modifying a feature such as `rewards` requires changes only within the `rewards/` directory tree. It also reflects the clean architecture principle of keeping the domain layer free of framework dependencies — the `use_case` and `repository interface` files in `domain/` have no Flutter imports, only Dart.

---

### Decision 3: Centralised Dependency Injection via MultiBlocProvider in `main.dart`

All Cubits are instantiated manually in `main.dart` using a flat `MultiBlocProvider`, constructing the full dependency chain (Cubit → UseCase → Repository → DataSource) inline.

**Why:** This explicit, compile-time wiring approach avoids the runtime reflection required by service locators such as `get_it`. Every dependency is traceable through the static import graph, making the architecture highly transparent for academic review. Since all Cubits are provided at the root, they maintain state across tab switches without needing re-instantiation, which is critical for features like the notification badge count and the donor's active request state.

---

### Decision 4: PageView-Driven Tab Navigation with Animated Bottom Bar

The bottom navigation bar in all three role layouts uses a `PageView` with a custom animated tab bar rather than Flutter's built-in `BottomNavigationBar` or `NavigationBar`.

**Why:** The `PageView` approach preserves the widget state of all tabs simultaneously (no `IndexedStack` overhead), allows swipe-to-switch gestures with `BouncingScrollPhysics`, and enables smooth spring-animated icon transitions via dedicated `AnimationController` instances (one per tab icon). The animated active indicator — a small pill below the selected icon — provides a refined micro-interaction that is consistent with modern iOS-style navigation patterns.

---

### Decision 5: Bilingual (Arabic/English) Support via Flutter Localisation

The application is fully internationalised using Flutter's official `flutter_localizations` package and ARB-format translation files (`l10n/app_ar.arb`, `l10n/app_en.arb`). All user-visible strings are accessed through the generated `AppLocalizations` class.

The application currently defaults to Arabic locale (`Locale('ar')` in `BloodDonationApp`). The `VoiceCallScreen` implements automatic language detection — it inspects whether the chatbot's response text contains Arabic Unicode code points (U+0600–U+06FF) and switches the TTS voice locale accordingly between `ar_SA` and `en_US`.

**Why:** The target user base of the Egyptian healthcare context requires native Arabic support. Using the official localisation framework ensures that all strings are maintainable in one place and that the application can be extended to additional locales without widget-level changes.

---

### Decision 6: Silent Token Refresh via Dio Interceptor

JWT access token renewal is handled entirely within `AuthInterceptor` without any user-visible prompt or navigation event. On a 401 response, the interceptor acquires a flag to prevent concurrent refresh attempts, silently posts the refresh token, updates the Hive store, and retries the original request.

**Why:** Requiring the user to manually re-authenticate on every token expiry would be disruptive, especially for donors who may be mid-way through accepting a blood request or completing an appointment booking. The silent refresh strategy keeps the session alive transparently while preserving security through short-lived access tokens (7-day TTL as documented by the backend).

---

### Decision 7: Skeleton Loading over Spinners for Data-Driven Screens

List-based screens (requests, hospitals, notifications, donation history, rewards) display skeleton shimmer placeholders (`skeletonizer`) while data is being fetched, rather than a simple `CircularProgressIndicator`.

**Why:** Skeleton screens communicate the expected layout to the user before data arrives, reducing perceived loading time and preventing layout jumps. This is particularly important for the Donor Home screen, which aggregates data from multiple concurrent API calls (donor stats, eligibility, requests, activities).

---

### Decision 8: Shared Screens Across Roles for Common Flows

Several screens are designed to be role-agnostic and are reused across all three authentication flows:

- `CustomPinVerificationScreen` — handles OTP entry for donor, hospital, and admin email verification.
- `CustomResetPassword` — handles new-password entry for all three role-specific password reset flows, parameterised by a `ResetPasswordArgs` object containing the role, email, and OTP.
- `CustomBanScreen` — displays the suspension reason for any banned user, parameterised by a `BanRole` enum.

**Why:** Duplicating these screens across three role namespaces would create maintenance overhead without providing any meaningful differentiation. Parameterisation allows the shared implementation to adapt its copy and navigation targets while keeping a single source of truth for the UI logic.

**Sources:** `Frontend/lib/core/resources/colors/color_manger.dart`, `Frontend/lib/blood_donation_app.dart`, `Frontend/lib/core/interceptors/auth_interceptor.dart`, `Frontend/lib/core/widgets/`, all main layout files, `Frontend/pubspec.yaml`

---

# 5. AI Module

## 5.1 AI Module Overview

The LifeLink AI module comprises two distinct components: (1) a deterministic, rule-based analytics engine running inside the Node.js backend that generates operational insights labelled as AI predictions, and (2) a client-side integration with an externally hosted conversational AI chatbot service. The analytics engine is implemented in `Backend/src/services/analytics.service.js` and is consumed exclusively by the admin dashboard via the `GET /analytics/dashboard` and `GET /analytics/overview` endpoints. The chatbot integration resides in the Flutter frontend (`Frontend/lib/presentation/role/donor/tabs/chat_bot/`) and communicates with an independently deployed service at `https://donation-chatbot-1fie.onrender.com` over HTTPS and SSE streaming. No machine learning models, training pipelines, or Python code exist within this repository.

**Sources:** `Backend/src/services/analytics.service.js`, `Frontend/lib/presentation/role/donor/tabs/chat_bot/`, `Frontend/lib/core/resources/api_manger/api_constants.dart`

---

## 5.2 Problem Being Solved

Two problems are addressed:

1. **Operational Analytics for Administrators:** Hospital and platform administrators need data-driven visibility into blood demand trends, blood-type supply shortages, donor retention patterns, and peak donation activity periods. Without an analytics engine, these insights would require manual querying of MongoDB collections or external business intelligence tools. The AI engine automatically computes these metrics from live operational data and presents them as structured, natural-language insights with heuristic confidence scores.

2. **Donor-Facing Conversational Q&A:** Donors require immediate, on-demand answers to blood-donation-related questions (eligibility, process, preparation, recovery) without contacting support staff or sifting through static help documents. The chatbot integration provides this capability through both text and voice interfaces.

**Sources:** `Backend/src/services/analytics.service.js`, `Frontend/lib/presentation/role/donor/tabs/chat_bot/`

---

## 5.3 Dataset

**Not Applicable (Rule-Based Engine).** The analytics engine does not use a static machine learning dataset. All inputs are derived at runtime from live MongoDB collections (`users`, `requests`, `donations`, `donorpoints`) via aggregation pipelines. No training, validation, or test datasets are curated, stored, or versioned. The external chatbot service maintains its own dataset, the contents of which are outside the scope of this codebase.

**Sources:** `Backend/src/services/analytics.service.js:22-33`, `Backend/src/services/analytics.service.js:167-207`

---

## 5.4 Data Preprocessing

Data preprocessing is performed entirely through MongoDB aggregation pipeline stages. The `precomputeTrendData()` function (`analytics.service.js:167`) applies the following transforms:

| Preprocessing Step | Implementation |
|-------------------|----------------|
| Time-window filtering | `$match` on `createdAt` fields with computed date boundaries (3, 7, 14, 30, 60 days from current time) |
| Temporal aggregation | `$group` by `$dayOfWeek` for donation pattern analysis |
| Donor activity bucketing | Two-period grouping (last 30d vs prior 30d) on completed donation timestamps |
| Demand surge ratio | 3-day actual request count normalised against expected rate from 30-day average |
| Growth calculation | `computeWeekOverWeekGrowth()` — ratio of current 7d to prior 7d counts |

All preprocessing is deterministic, expressed as standard MongoDB pipeline operators, and executed server-side. No feature scaling, normalisation, or encoding is performed.

**Sources:** `Backend/src/services/analytics.service.js:167-207`, `Backend/src/services/analytics.service.js:209-212`

---

## 5.5 Features

The engine computes the following derived metrics from raw MongoDB documents. These metrics serve as the input variables for the insight-generation rules.

| Feature | Source Collection(s) | Computation |
|---------|---------------------|-------------|
| Week-over-week request growth | `requests` | `(requestsLast7d − requestsLast14d) / requestsLast14d` |
| Supply-demand ratio | `requests`, `donors` | `unitsNeeded / availableCompatibleDonors` per blood type |
| Day-of-week donation counts | `donations` | `$group` by `$dayOfWeek` over 30-day window |
| Donor retention rate | `donations` | `returningDonorsLast30d / returningDonorsPrev30d` |
| Demand surge ratio | `requests` | `requestsLast3d / (requestsLast30d / 30 × 3)` |
| Weekday vs weekend success rate | `donations` | Mean daily donations split by weekday/weekend |

**Sources:** `Backend/src/services/analytics.service.js:209-283`

---

## 5.6 Machine Learning / AI Model

**Not a Machine Learning Model.** The AI module is a deterministic, rule-based analytics engine. Each insight generator function applies hardcoded threshold conditions to the computed features:

| Insight Engine | Input Features | Threshold Logic | Output |
|----------------|---------------|-----------------|--------|
| `demandForecastEngine` | Week-over-week growth rate | `> 0.30` → "Predicted High Demand"; `> 0.15` → "Rising Demand Trend"; `< −0.20` → "Declining Demand" | `{ title, description, confidence }` |
| `shortageEngine` | Supply-demand ratio per blood type | `> 2.0` → "Shortage Risk"; `> 1.0` → "Supply Warning" | `{ title, description, confidence }` |
| `weeklyPatternEngine` | Day-of-week donation counts | Peak count `> avg × 1.5` | `{ title, description, confidence: 65 }` |
| `retentionEngine` | Donor retention rate | `< 0.7` → "Retention Alert"; `> 1.2` → "Growth Positive" | `{ title, description, confidence }` |
| `surgeEngine` | Demand surge ratio | `> 2.0` → "Emergency Demand Spike" | `{ title, description, confidence }` |
| `generateDemandPrediction` | Week-over-week growth rate | `> 0.10` / `> 0.05` / `< −0.15` thresholds | Natural language string |
| `generateShortagePredictions` | Supply-demand ratio | Top 2 entries by ratio, thresholds at `> 3.0` and `> 1.5` | Natural language strings |
| `generateRetentionPrediction` | Retention rate | `< 70%` or `> 120%` of previous period | Natural language string |

Confidence scores are computed heuristically from the deviation magnitude (e.g., `Math.round(Math.min(95, 50 + growthRate * 100))`), not from any trained probabilistic model. The external chatbot's AI model is independently deployed and is not part of this repository.

**Sources:** `Backend/src/services/analytics.service.js:214-299`, `Backend/src/services/analytics.service.js:668-750`

---

## 5.7 Training Process

**Not Applicable.** No machine learning training process exists in this codebase. The rule thresholds, confidence formulas, and natural-language templates are hardcoded constants. The system requires no training data, no model fitting, and no hyperparameter optimisation.

---

## 5.8 Prediction / Inference Workflow

The inference workflow is triggered exclusively through two admin-protected API endpoints and follows a fully deterministic pipeline:

```
Admin Dashboard (Flutter)          Backend API                     MongoDB
       │                              │                              │
       │  GET /analytics/dashboard     │                              │
       │─────────────────────────────>│                              │
       │                              │ check cache (TTL 60s)        │
       │                              │ (miss) → generateAIInsights()│
       │                              │   ├── precomputeTrendData()  │
       │                              │   │   ├── 5 parallel aggr. ──│─────> requests, donations
       │                              │   │   └──────────────────────│<───── aggregated counts
       │                              │   ├── computeBloodTypeSupply │
       │                              │   │   └── 2 parallel aggr. ──│─────> requests, donors
       │                              │   ├── demandForecastEngine() │
       │                              │   ├── shortageEngine()       │
       │                              │   ├── weeklyPatternEngine()  │
       │                              │   ├── retentionEngine()      │
       │                              │   └── surgeEngine()          │
       │                              │ filter → sort → cap(5)       │
       │                              │ set cache                    │
       │  { aiInsights: [...] }       │                              │
       │<─────────────────────────────│                              │
```

| Step | Detail |
|------|--------|
| **Endpoint** | `GET /analytics/dashboard` → `getDashboardSummary()` → `generateAIInsights()` |
| **Endpoint** | `GET /analytics/overview` → `getAnalyticsOverview()` → `generateAIPredictions()` |
| **Data acquisition** | Five MongoDB aggregation pipelines executed via `Promise.all()` in `precomputeTrendData()` |
| **Insight generation** | Five `safeEngine()`-wrapped rule functions run in parallel; each returns `{ title, description, confidence }` or `null` |
| **Post-processing** | Non-null results filtered, sorted descending by confidence, capped at 5 entries |
| **Caching** | Dashboard: 60-second TTL in-memory (`DASHBOARD_CACHE_KEY`); Overview: 120-second TTL (`OVERVIEW_CACHE_KEY`) |
| **Client rendering** | Flutter `AiInsightsCard` widget renders each insight via `InsightCard` with a title, description, and a linear confidence bar |

The chatbot workflow follows a separate path: the Flutter app sends text or speech-to-text input to the external service's `/chat` (SSE streaming) or `/ask` (single response) endpoints and renders the returned text or text-to-speech audio.

**Sources:** `Backend/src/services/analytics.service.js:285-329`, `Backend/src/services/analytics.service.js:752-766`, `Frontend/lib/presentation/role/admin/tabs/dashboard/presentation/view/section/ai_insights_card.dart`

---

## 5.9 Evaluation Metrics

**Not Applicable.** No machine learning evaluation metrics (accuracy, precision, recall, F1-score, RMSE, etc.) are used. The system is deterministic — given the same database state, the same insights are always produced. Confidence scores displayed in the admin dashboard are heuristic values derived from threshold deviation magnitude, not from model-based probability estimates.

---

## 5.10 AI Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Rule-based over ML** | Rule-based analytics was chosen over statistical or deep learning approaches for three reasons: (1) predictability — the same input always produces the same output with no training variance; (2) zero training cost — no dataset curation, model fitting, or hyperparameter tuning is required; (3) interpretability — every insight is traceable to a specific threshold condition and input metric, making the system auditable by non-ML engineers. |
| **Separate chatbot deployment** | The chatbot is deployed as an independent Render service to isolate concerns. This avoids introducing Python, ML framework dependencies, or GPU requirements into the Node.js backend, allows the chatbot to scale independently, and permits future replacement of the chatbot model without impacting the core platform. |
| **In-memory caching of insights** | Both `getDashboardSummary()` and `getAnalyticsOverview()` cache their results in-process (60s and 120s TTL respectively). Aggregation pipelines over large collections are computationally expensive; caching prevents repeated pipeline execution on every admin page refresh and reduces MongoDB load. |
| **Configurable toggle via system settings** | AI predictions can be enabled or disabled system-wide via the `ai_predictions_enabled` key in the `SystemSettings` collection, toggled from the admin settings panel. This gives operators control over AI feature visibility without a code deployment. Default is `true`. |
| **Heuristic confidence scores** | Confidence percentages are computed as `Math.min(maxConfidence, base + magnitude * scale)` from threshold deviation. This provides a visual signal strength indicator without the overhead of a calibrated probabilistic model. |

**Sources:** `Backend/src/services/analytics.service.js`, `Backend/src/utils/insight-utils.js`, `Backend/src/services/admin.service.js:257-268`, `Backend/src/services/admin.service.js:306-311`

---

# 6. Testing & Validation

## 6.1 Testing Overview

The LifeLink platform employs a test-driven approach primarily focused on the Node.js backend. Testing is executed using **Vitest** as the test runner and assertion library, with **Supertest** used for HTTP endpoint testing. The frontend (Flutter) currently relies primarily on manual QA and widget-level inspection, with minimal automated test coverage.

The backend test suite is located in the `Backend/tests/` directory and is strictly categorised into distinct testing levels:

| Test Directory | Scope | Purpose |
|----------------|-------|---------|
| `tests/unit/` | Services, Controllers, Utils | Isolated testing of core business logic (e.g., `matching.service.test.js`, `auth.validation.test.js`). Mocks (via `vi.mock`) are heavily used to isolate database or external service calls. |
| `tests/integration/` | Endpoints, DB Interactions | End-to-end API request flows using a real, ephemeral in-memory MongoDB instance (`mongodb-memory-server`). Tests full database transactions, middleware pipelines, and response formatting (e.g., `auth.integration.test.js`, `hospital.routes.integration.test.js`). |
| `tests/e2e/` & `tests/qa/` | Multi-System Flows | Broader functional testing of background workers and cross-module interactions. |

**Sources:** `Backend/package.json`, `Backend/tests/`

---

## 6.2 Validation Mechanisms

The system implements defence-in-depth validation, enforcing rules at both the API boundary and the database layer. 

Rather than relying on generic middleware libraries like `Joi` or `express-validator`, the backend implements a **custom, purpose-built validation layer** (`Backend/src/validation/`). This approach provides strict role-based separation (e.g., `auth.validation.js` maintains separate rule sets for donors, hospitals, and admins) and granular control over error messages.

Database-level validation is enforced via **Mongoose Schemas**. Key mechanisms include:
- `strict: 'throw'` configuration on all core models to prevent schema pollution.
- Pre-save hooks for normalisation (e.g., `normalizeArabic` on names).
- Custom validator functions (e.g., regex checks for email formats).
- Unique and sparse indexes to prevent duplicate records at the database engine level.

**Sources:** `Backend/src/validation/`, `Backend/src/models/User.model.js`

---

## 6.3 Input Validation

Input validation occurs in three stages:

1. **Frontend UI Validation:** Input forms (e.g., `CustomTextField`, `CustomDropdownButtonFormField`) employ Flutter's standard `FormState` validation. This provides immediate, real-time feedback to the user before an HTTP request is dispatched.
2. **Backend API Validation:** The custom validation layer intercepts the request body. `auth.validation.js`, for instance, defines `VALIDATION_RULES` using regular expressions to enforce:
   - Strong passwords (minimum length, special characters).
   - Valid Egyptian phone number formats.
   - Allowed blood types (`A+`, `O-`, etc.).
   - Full name constraints (allowing Arabic characters).
3. **Backend Sanitisation:** `express-mongo-sanitize` is applied globally to strip malicious MongoDB operator injections (e.g., `$gt`, `$set`) from request bodies and queries.

**Sources:** `Backend/src/validation/auth.validation.js`, `Frontend/lib/core/widgets/custom_text_field.dart`, `Backend/package.json`

---

## 6.4 Error Handling

Error handling follows a centralised, predictable pattern to ensure clients always receive structured responses.

### Backend Error Handling
To eliminate repetitive `try/catch` boilerplate in controllers, an `asyncHandler` wrapper (`Backend/src/middlewares/asyncHandler.js`) intercepts all rejected Promises and forwards them to the `next()` middleware. 

The centralised `error.middleware.js` catches these errors and maps them to standard HTTP responses:
- **`HttpError`**: Custom class containing an explicit status code (e.g., 404, 403) and message.
- **Mongoose `ValidationError`**: Mapped to a `400 Bad Request` with an array of specific field errors.
- **Mongoose `CastError`**: Mapped to `400 Bad Request` for invalid ObjectIDs.
- **Duplicate Key (Code 11000)**: Mapped to a `409 Conflict`.
- **JWT Errors**: `TokenExpiredError` and `JsonWebTokenError` map to `401 Unauthorized`.

### Frontend Error Handling
The Flutter frontend intercepts Dio network exceptions using a dedicated error handler. Backend error messages are parsed and mapped via `error_localizer.dart` to translation keys. This ensures that technical server errors (e.g., "invalid email or password") are dynamically translated into user-friendly Arabic or English strings before being rendered in the UI (via `CustomErrorWidget`).

**Sources:** `Backend/src/middlewares/error.middleware.js`, `Backend/src/middlewares/asyncHandler.js`, `Frontend/lib/core/utils/error_localizer.dart`

---

## 6.5 Exception Management

### Custom Backend Exceptions
Business logic violations throw instances of a custom `HttpError` utility (`Backend/src/utils/HttpError.js`). For example, attempting to accept a request while on cooldown throws an `HttpError(403, 'Donor is on cooldown')`.

### Custom Frontend Exceptions
The frontend defines distinct, strongly-typed domain exceptions in `app_exceptions.dart`:
- `NetworkTimeoutException`
- `ServerException` (includes the HTTP status code)
- `UnauthorizedException`
- `NotFoundException`

These exceptions are yielded by the Domain layer and caught by the Presentation layer's Cubits, which transition the UI into specific error states (e.g., displaying a retry button for a timeout vs. redirecting to login for an unauthorised error).

**Sources:** `Frontend/lib/core/errors/app_exceptions.dart`, `Backend/src/utils/HttpError.js`

---

## 6.6 System Reliability

The system guarantees robustness under concurrency and edge cases via the following mechanisms:

| Mechanism | Description |
|-----------|-------------|
| **Database Transactions** | `mongoose.startSession()` is used heavily in multi-document operations (e.g., cascade deletions when an account is banned, or reward point redemptions) to ensure atomic commits and automatic rollbacks on failure. |
| **Idempotency & Partial Indexes** | Critical collections use partial unique indexes (e.g., preventing duplicate points awarded for the same donation reference ID) to guarantee consistency even if a worker retries an event. |
| **Soft Deletion** | The `User` model employs a `deletedAt` flag instead of physical deletion. A post-update hook safely cascades cancellations to related appointments and requests without breaking historical analytics. |
| **Rate Limiting** | Endpoint abuse is mitigated using `express-rate-limit` (configured in `rateLimit.middleware.js` and `donor-rate-limit.middleware.js`), preventing brute-force attacks on authentication endpoints. |
| **Token Refreshing** | The frontend uses an interceptor to seamlessly renew expired access tokens, preventing disruptive session drops. |

**Sources:** `Backend/src/models/User.model.js`, `Backend/src/middlewares/rateLimit.middleware.js`, `Frontend/lib/core/interceptors/auth_interceptor.dart`

---

## 6.7 Known Limitations

1. **Frontend Automated Testing:** The Flutter application lacks an automated UI or integration test suite. Validation currently depends on manual QA testing and backend safety guards.
2. **End-to-End Environment Testing:** There is no cross-system E2E test framework (e.g., Appium or Detox) that drives the Flutter client against a running backend API.

---

## 6.8 Future Testing Improvements

1. **Implement Flutter Widget and Integration Tests:** Introduce automated testing for critical UI flows in the frontend (e.g., ensuring the Schedule Donation wizard progresses correctly and state is maintained).
2. **Performance and Load Testing:** Implement tools like `k6` to stress-test the backend matching engine and websocket/SSE endpoints to verify stability during simulated regional blood shortage emergencies.
3. **CI/CD Pipeline:** Integrate the Vitest suite into a GitHub Actions pipeline to block pull requests that cause regressions in core business logic.

---

# 7. Technical Evaluation
## 7.1 Architecture Assessment

The system employs a strictly layered monolithic architecture for the backend API and a BLoC-driven cross-platform client for the frontend. The backend separation of concerns—Routes, Middlewares, Controllers, Services, Repositories, and Models—is rigorously defined and isolates business logic from HTTP transport and data access. The inclusion of an EventBus (`eventBus.service.js`) and a State Machine (`state-machine.js`) further decouples domain events and centralizes entity lifecycle transitions. The integration of the AI Chatbot as an independent service demonstrates a pragmatic microservice boundary for resource-intensive operations, preventing AI inference overhead from blocking the core Node.js event loop.

## 7.2 Scalability Assessment

The architecture supports horizontal scaling for the core API due to stateless JWT authentication and separated database/storage layers. However, the background workers (`notificationOutbox.worker.js` and `requestEscalation.worker.js`) are currently initiated in-process via `setInterval` upon server startup. If the backend is horizontally scaled across multiple instances, these workers will execute concurrently and potentially duplicate background tasks unless a distributed locking mechanism or a dedicated external worker queue is implemented. Database scalability relies on MongoDB, which handles geospatial indexing for the matching engine, but heavy concurrent geo-queries under emergency loads will require careful index optimization.

## 7.3 Maintainability Assessment

Maintainability is a significant strength of this project. The unidirectional dependency rule enforced across backend layers ensures predictable data flow and prevents circular dependencies. The use of ES Modules and structured Mongoose discriminators (`User`, `Donor`, `Hospital`) provides a clean object-oriented approach to role data. Additionally, centralized error handling (`asyncHandler`, `error.middleware.js`) and localized response definitions reduce boilerplate. The frontend's use of the BLoC/Cubit pattern isolates UI components from business logic, making feature updates manageable.

## 7.4 Security Assessment

The project implements comprehensive, enterprise-grade security mechanisms appropriate for sensitive healthcare data. Authentication uses short-lived JWT access tokens and rotatable refresh tokens backed by a MongoDB blacklist. Session invalidation is strictly enforced via a `passwordChangedAt` credential epoch. High-privilege administrative access is protected by an `adminKey` third factor, encrypted at rest using AES-256-GCM. Input sanitization is handled globally via `express-mongo-sanitize`, and endpoint abuse is mitigated through dynamic, path-based rate limiting (`express-rate-limit` and `donor-rate-limit.middleware.js`). Email OTPs are securely hashed using SHA-256 before storage.

## 7.5 Performance Considerations

The system utilizes asynchronous event processing for non-critical path operations (e.g., notifications are deferred via the outbox worker) to maintain fast HTTP response times. The maintenance mode check utilizes a 30-second in-memory cache to bypass database round-trips on every request. However, the system currently lacks a dedicated caching layer (e.g., Redis) for high-read, low-write endpoints such as leaderboards and hospital discovery. The Server-Sent Events (SSE) implementation for the chatbot requires persistent connections, which could consume server memory under high concurrent load if not properly managed by a load balancer.

## 7.6 Strengths

- **Clear Separation of Concerns:** Strict layer boundaries and adherence to the BLoC pattern.
- **Robust Security Posture:** Multi-factor admin login, epoch-based session invalidation, and rate limiting.
- **Advanced Business Logic:** Comprehensive eligibility and matching engines integrated seamlessly.
- **State Management:** Centralized state machine prevents invalid data transitions.
- **Event-Driven Decoupling:** EventBus implementation isolates side effects from primary workflows.

## 7.7 Current Limitations

- **In-Process Workers:** Background workers run within the Express process, hindering true horizontal scaling without task duplication.
- **Lack of Dedicated Caching:** Frequent queries for aggregate data (leaderboards, hospital lists) query the primary MongoDB database directly.
- **Absence of Automated Testing in Frontend:** The Flutter application lacks an automated UI and integration test suite, relying entirely on manual validation.
- **No End-to-End Environment:** Lack of E2E testing framework spanning both the mobile client and backend API.

## 7.8 Future Improvements

- **Externalize Background Workers:** Migrate the outbox and escalation workers to a dedicated queue system (e.g., Redis and BullMQ) to support horizontal API scaling.
- **Implement Caching Layer:** Introduce Redis to cache leaderboard results, hospital discovery data, and user preferences to reduce database load.
- **Introduce Automated Frontend Tests:** Implement Flutter widget and integration tests for critical workflows such as the donation scheduling wizard.
- **CI/CD Integration:** Integrate the existing backend Vitest suite and future frontend tests into an automated pipeline to block breaking changes.