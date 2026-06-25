# LifeLink — User Flow & System Workflows

> **Document Type:** Software Documentation  
> **Version:** 1.0  
> **Generated From:** Codebase Analysis — June 2026  

---

## 1. User Roles and Entry Points

```mermaid
graph TD
    A[New User] --> B{Who are you?}
    B --> C[Donor]
    B --> D[Hospital]
    B --> E[Admin / Superadmin]

    C --> F[POST /auth/signup]
    F --> G[Email OTP Verification]
    G --> H[POST /auth/login]
    H --> I[Donor Workflows]

    D --> J[Hospital account created by Admin]
    J --> K[POST /auth/hospital/login]
    K --> L[Hospital Workflows]

    E --> M[Admin account created by Superadmin]
    M --> N[POST /auth/admin/login + adminKey]
    N --> O[Admin Workflows]
```

---

## 2. Donor Registration & Verification

```mermaid
flowchart LR
    A[POST /auth/signup\nfullName, email, password\nbloodType, phoneNumber\ndateOfBirth, location] --> B[User created\nisSuspended=false\nisEmailVerified=false]
    B --> C[OTP Email Sent\n6-digit code\n10-min TTL\nSHA-256 hashed in DB]
    C --> D[POST /auth/verify-email-otp\nemail + otp]
    D --> E{OTP Valid?}
    E -- Yes --> F[isEmailVerified=true\naccount active]
    E -- No --> G[400 Invalid OTP]
    F --> H[POST /auth/login\nreturns accessToken + refreshToken]
```

**Key rules:**
- Self-registration is available to donors only. Hospitals and admins are created by higher-authority users.
- Email must be verified before any protected route can be accessed (enforced in `auth.middleware.js`).

**Source:** `src/services/auth.service.js`, `src/middlewares/auth.middleware.js`

---

## 3. Token Lifecycle

```mermaid
flowchart TD
    A[Login] --> B[accessToken\nJWT, 7d TTL]
    A --> C[refreshToken\nJWT, 30d TTL]
    B --> D[Protected API Calls\nAuthorization: Bearer token]
    D --> E{Token Expired?}
    E -- No --> F[Request Processed]
    E -- Yes --> G[POST /auth/refresh-token\nwith refreshToken]
    G --> H{Refresh Valid?\nNot blacklisted?}
    H -- Yes --> I[New accessToken issued]
    H -- No --> J[401 — Re-login required]
    D --> K[POST /auth/logout]
    K --> L[refreshToken added to blacklist\nFCM token removed]
```

**Source:** `src/services/auth.service.js`, `src/models/RefreshTokenBlacklist.model.js`

---

## 4. Blood Request Lifecycle (Hospital Perspective)

```mermaid
stateDiagram-v2
    [*] --> pending : Hospital creates request\nPOST /requests
    pending --> in_progress : First donor accepts\nPOST /requests/:id/accept
    in_progress --> pending : Donation expires\n(no-show, escalation worker)
    in_progress --> completed : All units fulfilled\n+ QR verified + confirmed
    pending --> cancelled : Hospital cancels\nDELETE /requests/:id
    in_progress --> cancelled : Hospital cancels
    completed --> [*]
    cancelled --> [*]
```

**Status definitions:**
- `pending`: Request is open; compatible donors are being notified
- `in-progress`: At least one donor has accepted; waiting for arrival/confirmation
- `completed`: All required units collected and verified
- `cancelled`: Closed by hospital or system

**Source:** `src/models/Request.model.js`, `src/constants/request.constants.js`

---

## 5. Donor Response to a Request

```mermaid
flowchart TD
    A[Donor opens app] --> B[GET /donor/matches\nor GET /requests/nearby]
    B --> C[Matching engine returns\ncompatible + nearby requests]
    C --> D[Donor views request details]
    D --> E{Decision}
    E -- Accept --> F[POST /requests/:id/accept]
    F --> G{Eligibility Check\neligibility.service.js}
    G -- Eligible --> H[Donation created\nstatus=pending\nQR token generated]
    H --> I[Hospital notified\nin-app + FCM push]
    H --> J[Arrival deadline set\nbased on urgency]
    G -- Not Eligible --> K[400 + reason + nextEligibleDate]
    E -- Decline --> L[POST /requests/:id/decline\nDonation created\nstatus=cancelled]
```

**Eligibility rules checked:**
1. Account not suspended or deleted
2. No chronic conditions (from `healthHistory`)
3. No active donation already in progress
4. Age ≥ 17 years
5. Not in temporary deferral window
6. Not deferred due to travel to malaria-risk country (within 28 days)
7. Donation cooldown satisfied (type-specific)
8. Hemoglobin ≥ 12.5 g/dL (if recorded)

**Source:** `src/services/eligibility.service.js`

---

## 6. Donation Verification Flow (QR Handoff)

This is the on-site hospital verification flow after a donor arrives:

```mermaid
sequenceDiagram
    participant D as Donor (with QR)
    participant H as Hospital Staff (App)
    participant API as LifeLink API
    participant DB as MongoDB

    D->>H: Shows QR code on screen
    H->>API: POST /appointments/verify-qr\n{ qrToken }
    API->>DB: Find Donation/Appointment by qrToken
    API-->>H: Donor details + verification checklist

    H->>API: POST /appointments/:id/verify\n{ idVerified, questionnaireCompleted, consentSigned }
    API->>DB: Mark verification status = verified

    H->>API: POST /requests/:id/confirm
    API->>DB: BEGIN TRANSACTION
    API->>DB: Donation.status = completed
    API->>DB: Request.unitsAccepted decrement
    API->>DB: DonorPoints += points by type
    API->>DB: PointsTransaction created
    API->>DB: Activity logged
    API->>DB: COMMIT
    API-->>H: 200 Confirmation
    API->>D: Push notification: "Donation confirmed!"
```

**Source:** `src/services/donation-completion.service.js`, `src/controllers/request.controller.js`, `src/controllers/appointment.controller.js`

---

## 7. Appointment Booking Flow (4-Step Wizard)

```mermaid
flowchart LR
    S1[Step 1\nChoose Hospital\nGET /hospitals\nGeo-sorted list] --> S2[Step 2\nSelect Date & Time\nGET /donations/book-appointment/available-slots\n?hospitalId=&date=]
    S2 --> S3[Step 3\nConfirm User Details\nGET /donor/profile\nPre-fill form]
    S3 --> S4[Step 4\nReview & Confirm\nPOST /donations/book-appointment]
    S4 --> R[Confirmation Screen\nAppointment + QR Code displayed]
```

**Slot availability logic:**
- Hospital's `workingHoursStart` and `workingHoursEnd` define the day's range
- `slotsPerHour` determines the number of slots per hour
- Existing appointments on that date reduce available slots

**Source:** `src/services/appointment.service.js`, `src/models/Hospital.model.js`, `README.md`

---

## 8. Request Escalation — Background Workflow

This workflow runs without user interaction, driven by `requestEscalation.worker.js`:

```mermaid
flowchart TD
    W[Worker runs every 60s] --> A[Find Donations:\nstatus=pending\narrivalDeadline < now\nqrUsed=false]
    A --> B{Any expired?}
    B -- Yes --> C[BEGIN TRANSACTION\nDonation.status = expired\nqrUsed = true]
    C --> D[Decrement Request.unitsAccepted]
    D --> E{Other active\ndonations?}
    E -- No --> F[Request.status = pending\nRe-open request]
    E -- Yes --> G[Keep Request.in-progress]
    F --> H[Re-broadcast to\nnearby compatible donors]
    B -- No --> I[Find Requests:\npending + urgency-based\nrebroadcast interval elapsed]
    I --> J[Notify new\nbatch of donors]
```

**Urgency-based timeouts** (from `src/constants/request-timeout.constants.js`):
- `critical`: acceptance deadline = 30 min, arrival deadline = 1 hr
- `high`: acceptance deadline = 2 hr, arrival deadline = 4 hr
- `medium`: acceptance deadline = 4 hr, arrival deadline = 8 hr
- `low`: acceptance deadline = 8 hr, arrival deadline = 24 hr

**Source:** `src/workers/requestEscalation.worker.js`, `src/constants/request-timeout.constants.js`

---

## 9. Rewards & Gamification Flow

```mermaid
flowchart TD
    A[Donation Completed] --> B[donation-completion.service.js\nawards points atomically]
    B --> C[DonorPoints.pointsBalance += X\nDonorPoints.lifetimePointsEarned += X]
    C --> D[PointsTransaction created\nfor ledger]
    C --> E{Tier threshold\ncrossed?}
    E -- Yes --> F[DonorPoints.tier updated\ne.g. bronze → silver]
    F --> G[Notification: Tier up!]
    C --> H[Badge checker runs]
    H --> I{Unlock condition\nmet?}
    I -- Yes --> J[UserBadge.unlocked = true\nBadge bonus points awarded\nNotification sent]
```

**Point values by donation type:**
- Blood: 200 pts
- Platelets: 175 pts
- Double red cells: 175 pts
- Plasma: 150 pts

**Source:** `src/services/reward.service.js` `POINTS_BY_TYPE` constant, `src/models/DonorPoints.model.js`

---

## 10. Password Reset Flow

```mermaid
flowchart LR
    A[POST /auth/forgot-password\nemail] --> B[6-digit OTP generated\nSHA-256 hashed in DB\n10-min TTL]
    B --> C[OTP email sent\nvia Resend]
    C --> D[POST /auth/reset-password\nemail + otp + newPassword]
    D --> E{OTP valid\nnot expired?}
    E -- Yes --> F[Password updated\nbcrypt-hashed\nOTP cleared\nRefresh tokens invalidated]
    E -- No --> G[400 Invalid or expired OTP]
```

**Source:** `src/services/auth.service.js`

---

## 11. Maintenance Mode

```mermaid
flowchart TD
    A[Admin: POST /admin/maintenance/enable] --> B[SystemSettings.maintenanceMode = true]
    B --> C[All non-admin requests blocked\n503 Maintenance response]
    D[Admin routes remain accessible\nadmin.routes.js mounted before\nmaintenance middleware]
    E[Admin: POST /admin/maintenance/disable] --> F[SystemSettings.maintenanceMode = false]
    F --> G[All routes resume normal operation]
```

**Source:** `src/middlewares/maintenance.middleware.js`, `src/app.js` lines 134–138

---

## Confidence Report

**Verified Facts:**
- All state transitions come from enum definitions in `Request.model.js` and `Donation.model.js`.
- Eligibility rule sequence comes directly from `eligibility.service.js` `canDonate()` function.
- QR verification checklist fields (`idVerified`, `questionnaireCompleted`, `consentSigned`) come from `Appointment.model.js` and `Donation.model.js`.
- 4-step appointment flow is described in `README.md` and confirmed by `appointment.service.js`.
- Worker interval (60s) comes from `server.js` `startEscalationWorker` default.
- Point values come from `reward.service.js` `POINTS_BY_TYPE` object.
- Maintenance middleware order (admin before maintenance) comes from `app.js` lines 134–138.

**Assumptions:** None.

**Missing Information:**
- Flutter app screen implementations are not in this repository; UI flow descriptions come from `README.md`.
- Exact urgency timeout values require reading `src/constants/request-timeout.constants.js` which was listed but not read; the values cited in Section 8 come from `docs/PROJECT_STATUS.md`.

**Potential Uncertainty:**
- The exact notification content (message text) for each event type was not traced; it is generated in `notification.service.js`.
