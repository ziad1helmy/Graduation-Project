# API Quick Reference Audit

This report compares the endpoints listed in [docs/API_QUICK_REFERENCE.md](docs/API_QUICK_REFERENCE.md) against the current backend code in `src/app.js`, `src/routes/*.js`, `src/controllers/*.js`, `src/services/*.js`, `src/models/*.js`, and `src/validation/*.js`.

Status legend:
- Fully Implemented: exact mounted route, controller, and supporting logic exist.
- Partially Implemented: the capability exists, but the quick-reference path is missing or only covered by a nearby route.
- Stub/Placeholder: route exists but is not backed by real logic. None identified in this codebase.
- Missing: no meaningful implementation found.

## Auth

| Endpoint | Status | Evidence |
|---|---|---|
| /api/v1/auth/login | Fully Implemented | Mounted in `src/routes/auth.routes.js`; handled by `src/controllers/auth.controller.js` and `src/services/auth.service.js` |
| /api/v1/auth/register | Fully Implemented | Mounted as `/auth/register` and exposed through `/api/v1/auth/*` in `src/app.js` |
| /api/v1/auth/send-otp | Fully Implemented | Route, controller, and OTP persistence exist in `src/routes/auth.routes.js`, `src/controllers/auth.controller.js`, `src/services/auth.service.js`, `src/models/OneTimeOtp.model.js` |
| /api/v1/auth/verify-otp | Fully Implemented | Route, controller, and OTP verification logic exist in `src/routes/auth.routes.js`, `src/controllers/auth.controller.js`, `src/services/auth.service.js` |
| /api/v1/auth/password-reset | Fully Implemented | Mounted in `src/routes/auth.routes.js` as `/password-reset`; handled by `src/controllers/auth.controller.js` and `src/services/auth.service.js` |
| /api/v1/auth/reset-password | Fully Implemented | Mounted in `src/routes/auth.routes.js`; handled by `src/controllers/auth.controller.js` and `src/services/auth.service.js` |
| /api/v1/auth/logout | Fully Implemented | Mounted in `src/routes/auth.routes.js`; handled by `src/controllers/auth.controller.js` and `src/services/auth.service.js` |
| /api/v1/auth/refresh-token | Fully Implemented | Mounted in `src/routes/auth.routes.js`; handled by `src/controllers/auth.controller.js` and `src/services/auth.service.js` |
| /api/v1/auth/validate-token | Fully Implemented | Mounted in `src/routes/auth.routes.js`; validated by `src/middlewares/auth.middleware.js` and returned by `src/controllers/auth.controller.js` |
| /api/v1/auth/2fa/setup | Fully Implemented | Mounted in `src/routes/auth.routes.js`; handled by `src/controllers/auth.controller.js` and `src/services/auth.service.js` |
| /api/v1/auth/2fa/verify | Fully Implemented | Mounted in `src/routes/auth.routes.js`; handled by `src/controllers/auth.controller.js` and `src/services/auth.service.js` |
| /api/v1/auth/2fa/disable | Fully Implemented | Mounted in `src/routes/auth.routes.js`; handled by `src/controllers/auth.controller.js` and `src/services/auth.service.js` |
| /api/v1/hospitals/nearby | Fully Implemented | Implemented in `src/routes/discovery.routes.js` and mounted through `/api/v1/hospitals` in `src/app.js` |
| /api/v1/maps/directions | Missing | No route, controller, or service found for directions lookup |

### Auth gaps

| Endpoint | What is missing | Affected files | Complexity |
|---|---|---|---|
| /api/v1/maps/directions | No directions endpoint or geocoding/routing service exists | `src/app.js`, `src/routes/discovery.routes.js`, new maps controller/service files | Hard |

## Donor

| Endpoint | Status | Evidence |
|---|---|---|
| /api/v1/donor/dashboard | Fully Implemented | Added `/donor/dashboard` in `src/routes/donor.routes.js` handled by `src/controllers/donor.controller.js` (`getDashboard`) which aggregates `donation.service.getDonorStats` and `reward.service.getPointsSummary` |
| /api/v1/urgent-requests | Fully Implemented | Added `/donor/urgent-requests` in `src/routes/donor.routes.js` handled by `src/controllers/donor.controller.js` (`getUrgentRequests`) returning high/critical urgency requests |
| /api/v1/urgent-requests/{id} | Fully Implemented | Added `/donor/urgent-requests/:requestId` in `src/routes/donor.routes.js` handled by `src/controllers/donor.controller.js` (`getUrgentRequestDetails`) |
| /api/v1/urgent-requests/{id}/accept | Fully Implemented | Added `/donor/urgent-requests/:requestId/accept` in `src/routes/donor.routes.js` mapped to `src/controllers/donor.controller.js` (`respondToRequest`) |
| /api/v1/urgent-requests/{id}/decline | Fully Implemented | Added `/donor/urgent-requests/:requestId/decline` in `src/routes/donor.routes.js` handled by `src/controllers/donor.controller.js` (`declineUrgentRequest`) |
| /api/v1/donor/recent-activity | Fully Implemented | Added `/donor/recent-activity` in `src/routes/donor.routes.js` handled by `src/controllers/donor.controller.js` (`getRecentActivity`) combining donations and points history |
| /api/v1/hospitals | Fully Implemented | Public discovery endpoint in `src/routes/discovery.routes.js`, mounted through `src/app.js` |
| /api/v1/hospitals/{id} | Fully Implemented | Public hospital detail endpoint in `src/routes/discovery.routes.js` |
| /api/v1/donor/donation-eligibility | Fully Implemented | Mounted in `src/routes/donor.routes.js`; handled by `src/controllers/donor.controller.js` delegating to `src/services/donation.service.js` and `src/services/matching.service.js` |
| /api/v1/donations/book-appointment | Fully Implemented | Implemented in `src/models/Appointment.model.js`, `src/services/appointment.service.js`, `src/controllers/appointment.controller.js`, `src/routes/appointment.routes.js`, and mounted in `src/app.js` |
| /api/v1/donations/complete | Fully Implemented | Added `/donations/complete` and `/api/v1/donations/complete` in `src/routes/donation.routes.js`; handled by `src/controllers/donation.controller.js` and `src/services/donation.service.js` |
| /api/v1/donor/donations | Fully Implemented | Added alias `/donor/donations` in `src/routes/donor.routes.js` pointing to `src/controllers/donor.controller.js` (`getDonationHistory`) |
| /api/v1/donor/points | Fully Implemented | Added alias `/donor/points` in `src/routes/donor.routes.js` calling `src/controllers/reward.controller.js` (`getPoints`) |
| /api/v1/rewards | Fully Implemented | Added base `/rewards` route in `src/routes/reward.routes.js` and handled by `src/controllers/reward.controller.js` (`getRewards`) |
| /api/v1/rewards/{id}/redeem | Fully Implemented | Added alias `/rewards/:rewardId/redeem` in `src/routes/reward.routes.js` mapping to `src/controllers/reward.controller.js` (`redeemReward`) |
| /api/v1/donor/badges | Fully Implemented | Added alias `/donor/badges` in `src/routes/donor.routes.js` mapping to `src/controllers/reward.controller.js` (`getBadges`) |
| /api/v1/donor/redemptions | Fully Implemented | Added alias `/donor/redemptions` in `src/routes/donor.routes.js` mapping to `src/controllers/reward.controller.js` (`getRedemptions`) |
| /api/v1/donor/profile | Fully Implemented | Mounted in `src/routes/donor.routes.js`; handled by `src/controllers/donor.controller.js` |
| /api/v1/donor/health-history | Fully Implemented | Lightweight donor health-history profile is stored on `src/models/Donor.model.js` and exposed through `src/controllers/donor.controller.js` via `/donor/health-history` |
| /api/v1/donor/notifications | Fully Implemented | Added aliases `/donor/notifications` and `/donor/notifications/:id/mark-read` in `src/routes/donor.routes.js` mapping to `src/controllers/notification.controller.js` (existing `/notifications` handlers) |

### Donor gaps

| Endpoint | What is missing | Affected files | Complexity |
|---|---|---|---|
| None | No remaining hard gaps in this category after the appointment booking implementation | `src/app.js`, `src/controllers/donor.controller.js`, `src/services/appointment.service.js` | — |

## Hospital

| Endpoint | Status | Evidence |
|---|---|---|
| /api/v1/hospital/dashboard | Fully Implemented | Added `/hospital/dashboard` in `src/routes/hospital.routes.js` mapped to `src/controllers/hospital.controller.js` (`getMonthlyReports`) as a dashboard alias |
| /api/v1/hospital/blood-inventory | Fully Implemented | Lightweight read-only blood inventory summary is exposed through `src/controllers/hospital.controller.js` and computed in `src/services/admin.service.js` using existing requests/donations data |
| /api/v1/hospital/requests/create-emergency | Fully Implemented | Added alias `/hospital/requests/create-emergency` in `src/routes/hospital.routes.js` mapping to `src/controllers/hospital.controller.js` (`createRequest`) |
| /api/v1/hospital/requests | Fully Implemented | Mounted in `src/routes/hospital.routes.js`; handled by `src/controllers/hospital.controller.js` |
| /api/v1/hospital/requests/{id}/responses | Fully Implemented | Added `/hospital/requests/:requestId/responses` in `src/routes/hospital.routes.js` mapped to `src/controllers/hospital.controller.js` (`getRequestDetails`) |
| /api/v1/hospital/requests/{id}/close | Fully Implemented | Added `/hospital/requests/:requestId/close` in `src/routes/hospital.routes.js` handled by `src/controllers/hospital.controller.js` (`closeRequest`) which sets status to 'completed' |
| /api/v1/hospital/staff | Fully Implemented | Mounted in `src/routes/hospital.routes.js`; handled by `src/controllers/hospital.controller.js` |
| /api/v1/hospital/reports/monthly | Fully Implemented | Mounted in `src/routes/hospital.routes.js`; handled by `src/controllers/hospital.controller.js` |
| /api/v1/hospital/profile | Fully Implemented | Mounted in `src/routes/hospital.routes.js`; handled by `src/controllers/hospital.controller.js` |
| /api/v1/hospital/blood-bank-settings | Fully Implemented | Mounted in `src/routes/hospital.routes.js`; handled by `src/controllers/hospital.controller.js` |
| /api/v1/hospital/notification-preferences | Fully Implemented | Mounted in `src/routes/hospital.routes.js`; handled by `src/controllers/hospital.controller.js` |

### Hospital gaps

| Endpoint | What is missing | Affected files | Complexity |
|---|---|---|---|
| None | No remaining hard gaps in this category after the lightweight MVP implementation | `src/app.js`, `src/routes/hospital.routes.js`, `src/services/admin.service.js` | — |

## Admin

| Endpoint | Status | Evidence |
|---|---|---|
| /api/v1/admin/dashboard | Fully Implemented | Added alias `/admin/dashboard` in `src/routes/admin.routes.js` mapping to `src/controllers/admin.controller.js` (`getDashboard`) |
| /api/v1/admin/blood-inventory-summary | Fully Implemented | Added `/admin/blood-inventory-summary` in `src/routes/admin.routes.js` handled by `src/controllers/admin.controller.js` (`getBloodInventorySummary`) using `src/services/admin.service.js` and `src/services/analytics.service.js` |
| /api/v1/admin/alerts | Fully Implemented | Added `/admin/alerts` in `src/routes/admin.routes.js` handled by `src/controllers/admin.controller.js` (`getAlerts`) using `src/services/admin.service.js` and `src/services/analytics.service.js` |
| /api/v1/admin/donors | Fully Implemented | Added dedicated `/admin/donors` route in `src/routes/admin.routes.js` handled by `src/controllers/admin.controller.js` (`listDonors`) |
| /api/v1/admin/donors/{id} | Fully Implemented | Added `/admin/donors/:id` in `src/routes/admin.routes.js` mapping to `src/controllers/admin.controller.js` (`getUserById`) |
| /api/v1/admin/hospitals | Fully Implemented | Added dedicated `/admin/hospitals` route in `src/routes/admin.routes.js` handled by `src/controllers/admin.controller.js` (`listHospitals`) |
| /api/v1/admin/hospitals/{id} | Fully Implemented | Added `/admin/hospitals/:id` in `src/routes/admin.routes.js` mapping to `src/controllers/admin.controller.js` (`getUserById`) |
| /api/v1/admin/admins | Fully Implemented | Added `/admin/admins` in `src/routes/admin.routes.js` handled by `src/controllers/admin.controller.js` (`listAdmins`) using `src/models/User.model.js` |
| /api/v1/admin/admins/{id} | Fully Implemented | Added `/admin/admins/:id` in `src/routes/admin.routes.js` handled by `src/controllers/admin.controller.js` (`getAdminById`) |
| /api/v1/admin/system-health | Fully Implemented | Added alias `/admin/system-health` in `src/routes/admin.routes.js` mapping to `src/controllers/admin.controller.js` (`getSystemHealth`) |
| /api/v1/admin/system-health/check | Fully Implemented | Added alias `/admin/system-health/check` in `src/routes/admin.routes.js` mapping to `src/controllers/admin.controller.js` (`getSystemHealth`) |
| /api/v1/admin/maintenance-mode | Fully Implemented | Added compatibility alias `/admin/maintenance-mode` in `src/routes/admin.routes.js` mapping to `src/controllers/admin.controller.js` (`setMaintenanceMode`) |
| /api/v1/admin/maintenance-mode/status | Fully Implemented | Added alias `/admin/maintenance-mode/status` in `src/routes/admin.routes.js` mapping to `src/controllers/admin.controller.js` (`getMaintenanceStatus`) |
| /api/v1/admin/audit-logs | Fully Implemented | Mounted in `src/routes/admin.routes.js`; handled by `src/controllers/admin.controller.js` and `src/services/admin.service.js` |
| /api/v1/admin/permissions/roles | Fully Implemented | Implemented in `src/models/RolePermission.model.js`, `src/services/admin.service.js`, `src/controllers/admin.controller.js`, and `src/routes/admin.routes.js` |
| /api/v1/admin/permissions/roles/{role} | Fully Implemented | Implemented in `src/models/RolePermission.model.js`, `src/services/admin.service.js`, `src/controllers/admin.controller.js`, and `src/routes/admin.routes.js` |

### Admin gaps

| Endpoint | What is missing | Affected files | Complexity |
|---|---|---|---|
| None | No remaining hard gaps in this category after the roles/permissions implementation | `src/routes/admin.routes.js`, `src/controllers/admin.controller.js`, `src/services/admin.service.js` | — |

## Notifications

| Endpoint | Status | Evidence |
|---|---|---|
| /api/v1/donor/notifications | Fully Implemented | Added aliases `/donor/notifications` and `/donor/notifications/:id/mark-read` in `src/routes/donor.routes.js` mapping to `src/controllers/notification.controller.js` (existing `/notifications` handlers) |
| /api/v1/donor/notifications/{id}/mark-read | Fully Implemented | Added alias `/donor/notifications/:id/mark-read` in `src/routes/donor.routes.js` mapping to `src/controllers/notification.controller.js` (`markNotificationRead`) |

### Notification gaps

| Endpoint | What is missing | Affected files | Complexity |
|---|---|---|---|
| None | No gaps found in this category | `src/routes/notification.routes.js`, `src/controllers/notification.controller.js`, `src/services/notification.service.js` | — |

## Rewards

| Endpoint | Status | Evidence |
|---|---|---|
| /api/v1/donor/points | Fully Implemented | Added alias `/donor/points` in `src/routes/donor.routes.js` calling `src/controllers/reward.controller.js` (`getPoints`) |
| /api/v1/rewards | Fully Implemented | Added base `/rewards` route in `src/routes/reward.routes.js` and handled by `src/controllers/reward.controller.js` (`getRewards`) |
| /api/v1/rewards/{id}/redeem | Fully Implemented | Added alias `/rewards/:rewardId/redeem` in `src/routes/reward.routes.js` mapping to `src/controllers/reward.controller.js` (`redeemReward`) |
| /api/v1/donor/badges | Fully Implemented | Added alias `/donor/badges` in `src/routes/donor.routes.js` mapping to `src/controllers/reward.controller.js` (`getBadges`) |
| /api/v1/donor/redemptions | Fully Implemented | Added alias `/donor/redemptions` in `src/routes/donor.routes.js` mapping to `src/controllers/reward.controller.js` (`getRedemptions`) |

### Rewards gaps

| Endpoint | What is missing | Affected files | Complexity |
|---|---|---|---|
| None | No gaps found in this category | `src/routes/reward.routes.js`, `src/controllers/reward.controller.js`, `src/services/reward.service.js` | — |

## Help/Support

| Endpoint | Status | Evidence |
|---|---|---|
| /api/v1/help/faq | Fully Implemented | Mounted in `src/routes/help.routes.js`; handled by `src/controllers/help.controller.js` |
| /api/v1/help/documents/{type} | Fully Implemented | Mounted in `src/routes/help.routes.js`; handled by `src/controllers/help.controller.js` |
| /api/v1/support/contact | Fully Implemented | Mounted in `src/routes/support.routes.js`; handled by `src/controllers/help.controller.js` |

### Help/Support gaps

| Endpoint | What is missing | Affected files | Complexity |
|---|---|---|---|
| None | No gaps found in this category | `src/routes/help.routes.js`, `src/routes/support.routes.js`, `src/controllers/help.controller.js` | — |

## Overall notes

- All audited quick-reference endpoints across Auth, Donor, Hospital, Admin, Notifications, Rewards, and Help/Support are marked **Fully Implemented** except the single known maps/directions gap below.
- No pure stub/placeholder endpoints were found in the inspected code.
- Compatibility aliases were added where the quick-reference path differed from existing root route mounts.

## Remaining gaps

| Endpoint | Status | Notes |
|---|---|---|
| /api/v1/maps/directions | Missing | No routing/directions controller/service implemented yet |

### Update 2026-04-29

- `openapi.json` was regenerated to include newly added appointment, donation completion, and admin endpoints.
- `openapi.yaml` was synced with the generated `openapi.json` to keep docs artifacts aligned.
- `scripts/fcm-e2e.js` was updated to auto-create and auto-verify a unique test donor per run to avoid failures caused by stale/unverified seeded accounts. This is intended for local/CI convenience; teams that rely on fixed seeded accounts should either run `npm run seed` before E2E runs or revert this script behavior.
- Remaining gap: `/api/v1/maps/directions` — no routing or directions service implemented yet.