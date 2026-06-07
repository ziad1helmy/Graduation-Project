# Response Payload Optimization Audit
> **Scope**: All endpoints actively used by the Flutter app.  
> **Method**: Cross-referenced `verified_integration_report.md` ("Fields Actually Used In UI" + "Fields Ignored By UI") against live backend controllers, models, and utility functions.  
> **No code was modified.** This is a read-only analysis.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ Required | Parsed AND displayed in UI |
| ⚠️ Parsed, not displayed | Read into model/state but never rendered |
| ❌ Completely unused | Not parsed, not displayed, not used in any Cubit/Repository |

---

## Per-Endpoint Field Tables

---

### 1. `POST /auth/signup`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (gate) | DO NOT REMOVE |
| `data.user._id` | ✅ Required | Yes | Stored | DO NOT REMOVE |
| `data.user.fullName` | ✅ Required | Yes | Stored | DO NOT REMOVE |
| `data.user.email` | ✅ Required | Yes | Stored | DO NOT REMOVE |
| `data.user.role` | ✅ Required | Yes | Stored | DO NOT REMOVE |
| `data.user.isEmailVerified` | ✅ Required | Yes | Controls email-verify flow | DO NOT REMOVE |
| `data.tokens.accessToken` | ✅ Required | Yes | Saved to Hive | DO NOT REMOVE |
| `data.tokens.refreshToken` | ✅ Required | Yes | Saved to Hive | DO NOT REMOVE |
| `data.locationRequired` | ⚠️ Parsed, not displayed | Yes | No | LOW RISK |
| `data.verificationEmail.sent` | ❌ Completely unused | No | No | SAFE |
| `data.verificationEmail.id` | ❌ Completely unused | No | No | SAFE |
| `data.user.createdAt` | ❌ Completely unused | No | No | SAFE |
| `data.user.updatedAt` | ❌ Completely unused | No | No | SAFE |
| `data.user.__v` | ❌ Completely unused | No | No | SAFE |
| `data.user.fcmTokens` | ❌ Completely unused | No | No | SAFE |
| `data.user.fullNameNormalized` | ❌ Completely unused | No | No | SAFE |
| `data.user.emailVerifiedAt` | ❌ Completely unused | No | No | SAFE |
| `data.user.isSuspended` | ❌ Completely unused | No | No | SAFE |

---

### 2. `POST /auth/login`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (gate) | DO NOT REMOVE |
| `data.accessToken` | ✅ Required | Yes | Saved to Hive | DO NOT REMOVE |
| `data.refreshToken` | ✅ Required | Yes | Saved to Hive | DO NOT REMOVE |
| `data.user._id` | ✅ Required | Yes | Stored | DO NOT REMOVE |
| `data.user.fullName` | ✅ Required | Yes | Stored | DO NOT REMOVE |
| `data.user.email` | ✅ Required | Yes | Stored | DO NOT REMOVE |
| `data.user.role` | ✅ Required | Yes | Stored/routing | DO NOT REMOVE |
| `data.user.isEmailVerified` | ✅ Required | Yes | Stored | DO NOT REMOVE |
| `message` | ❌ Completely unused | No | No | SAFE |
| `data.verified` | ❌ Completely unused | No | No | SAFE |
| `data.access_token` | ❌ Completely unused* | Overwrites camelCase | No | LOW RISK ⚠️ |
| `data.refresh_token` | ❌ Completely unused* | Overwrites camelCase | No | LOW RISK ⚠️ |
| `data.user_id` | ❌ Completely unused | No | No | SAFE |
| `data.user_role` | ❌ Completely unused | No | No | SAFE |
| `data.user_name` | ❌ Completely unused | No | No | SAFE |

> ⚠️ `access_token` / `refresh_token`: Flutter reads both and the snake_case version *overwrites* the camelCase value. Removing them is LOW RISK because Flutter already reads camelCase first and both should be identical. However, removing them eliminates the dual-parse confusion.

---

### 3. `POST /auth/logout`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ⚠️ Parsed, not displayed | Yes | No (Hive cleared regardless) | LOW RISK |
| `message` (in `data`) | ❌ Completely unused | No | No | SAFE |

---

### 4. `POST /auth/forgot-password`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (navigation gate) | DO NOT REMOVE |
| `message` | ❌ Completely unused | No | No | SAFE |

---

### 5. `POST /auth/verify-otp`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (gate) | DO NOT REMOVE |
| `data.verified` | ✅ Required | Yes | Passed to state | DO NOT REMOVE |
| `data.email` | ✅ Required | Yes | Forwarded to reset screen | DO NOT REMOVE |
| `message` | ❌ Completely unused | No | No | SAFE |
| `data.otp` | ❌ Completely unused | No | No (UI uses local OTP) | SAFE |

---

### 6. `POST /auth/reset-password`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (gate) | DO NOT REMOVE |
| `message` | ❌ Completely unused | No | No | SAFE |

---

### 7. `POST /auth/verify-email`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (gate) | DO NOT REMOVE |
| `message` / `data` string | ❌ Completely unused | No | No | SAFE |

---

### 8. `POST /auth/verify-email-otp`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (navigation gate) | DO NOT REMOVE |
| `message` | ❌ Completely unused | No | No | SAFE |

---

### 9. `GET /auth/me`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (gate) | DO NOT REMOVE |
| `data._id` | ✅ Required | Yes | Stored | DO NOT REMOVE |
| `data.fullName` | ✅ Required | Yes | Displayed | DO NOT REMOVE |
| `data.email` | ✅ Required | Yes | Displayed | DO NOT REMOVE |
| `data.role` | ✅ Required | Yes | Routing | DO NOT REMOVE |
| `data.isEmailVerified` | ✅ Required | Yes | Displayed | DO NOT REMOVE |
| `data.phoneNumber` | ✅ Required | Yes | Displayed | DO NOT REMOVE |
| `data.bloodType` | ✅ Required | Yes | Displayed | DO NOT REMOVE |
| `data.dateOfBirth` | ✅ Required | Yes | Displayed | DO NOT REMOVE |
| `data.gender` | ✅ Required | Yes | Displayed | DO NOT REMOVE |
| `data.weight` | ✅ Required | Yes | Displayed | DO NOT REMOVE |
| `data.isAvailable` | ✅ Required | Yes | Displayed | DO NOT REMOVE |
| `data.location` | ✅ Required | Yes | Displayed | DO NOT REMOVE |
| `data.healthHistory` | ⚠️ Parsed, not displayed | Yes | Stored in state only | LOW RISK |
| `data.settings` | ✅ Required | Yes | Settings toggles | DO NOT REMOVE |
| `data.emailVerifiedAt` | ❌ Completely unused | No | No | SAFE |
| `data.isSuspended` | ❌ Completely unused | No | No | SAFE |
| `data.suspendedAt` | ❌ Completely unused | No | No | SAFE |
| `data.suspendedReason` | ❌ Completely unused | No | No | SAFE |
| `data.deletedAt` | ❌ Completely unused | No | No | SAFE |
| `data.fcmTokens` | ❌ Completely unused | No | No | SAFE |
| `data.phone` | ❌ Completely unused | No | No | SAFE |
| `data.address` | ❌ Completely unused | No | No | SAFE |
| `data.__t` | ❌ Completely unused | No | No | SAFE |
| `data.hemoglobinLevel` | ❌ Completely unused | No | No | SAFE |
| `data.temporaryDeferralUntil` | ❌ Completely unused | No | No | SAFE |
| `data.lastDeferralReason` | ❌ Completely unused | No | No | SAFE |
| `data.travelHistory` | ❌ Completely unused | No | No | SAFE |
| `data.createdAt` | ❌ Completely unused | No | No | SAFE |
| `data.updatedAt` | ❌ Completely unused | No | No | SAFE |
| `data.fullNameNormalized` | ❌ Completely unused | No | No | SAFE |
| `data.__v` | ❌ Completely unused | No | No | SAFE |
| `data.isOptedIn` | ❌ Completely unused | No | No | SAFE |
| `data.isBanned` | ❌ Completely unused | No | No | SAFE |
| `data.isVerified` | ❌ Completely unused | No | No (alias of isEmailVerified) | SAFE |
| `data.location.lastUpdated` | ❌ Completely unused | No | No | SAFE |

---

### 10. `POST /auth/validate-token`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (gate) | DO NOT REMOVE |
| `data.is_valid` | ✅ Required | Yes | Auth gate | DO NOT REMOVE |
| `data.role` | ✅ Required | Yes | Route selection | DO NOT REMOVE |
| `data.user_role` | ⚠️ Parsed, not displayed | Yes | Fallback only | LOW RISK |
| `data.userId` | ⚠️ Parsed, not displayed | Yes | Stored | LOW RISK |
| `message` | ❌ Completely unused | No | No | SAFE |
| `data.user_id` | ❌ Completely unused | No | No (overwritten by userId) | SAFE |

---

### 11. `POST /auth/refresh-token`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.accessToken` | ✅ Required | Yes | Saved, injected into headers | DO NOT REMOVE |
| `data.refreshToken` | ✅ Required | Yes | Saved to Hive | DO NOT REMOVE |
| `success` | ❌ Completely unused | No | No (interceptor only reads tokens) | SAFE |
| `message` | ❌ Completely unused | No | No | SAFE |
| `data.access_token` | ❌ Completely unused | No | No | SAFE |

---

### 12. `POST /auth/admin/login`

Same classification as `POST /auth/login` — apply identical removals.

---

### 13. `POST /auth/change-password`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (snackbar gate) | DO NOT REMOVE |
| `message` | ❌ Completely unused | No | No | SAFE |

---

### 14. `POST /auth/fcm-token`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ⚠️ Parsed, not displayed | Yes | Logging only | LOW RISK |
| `data` (any) | ❌ Completely unused | No | No | SAFE |

---

### 15. `GET /donor/profile`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.fullName` | ✅ Required | Yes | Yes | DO NOT REMOVE |
| `data.email` | ✅ Required | Yes | Yes | DO NOT REMOVE |
| `data.phoneNumber` | ✅ Required | Yes | Yes | DO NOT REMOVE |
| `data.bloodType` | ✅ Required | Yes | Yes | DO NOT REMOVE |
| `data.dateOfBirth` | ✅ Required | Yes | Yes | DO NOT REMOVE |
| `data.gender` | ✅ Required | Yes | Yes | DO NOT REMOVE |
| `data.weight` | ✅ Required | Yes | Yes | DO NOT REMOVE |
| `data.isAvailable` | ✅ Required | Yes | Toggle | DO NOT REMOVE |
| `data.age` | ✅ Required | Yes | Yes | DO NOT REMOVE |
| `data.location.city` | ✅ Required | Yes | Yes | DO NOT REMOVE |
| `data.location.governorate` | ✅ Required | Yes | Yes | DO NOT REMOVE |
| `data.location.coordinates` | ✅ Required | Yes | Yes | DO NOT REMOVE |
| `data.stats.totalDonations` | ✅ Required | Yes | Counter widget | DO NOT REMOVE |
| `data.stats.points` | ✅ Required | Yes | Counter widget | DO NOT REMOVE |
| `data.stats.livesSaved` | ✅ Required | Yes | Counter widget | DO NOT REMOVE |
| `data.currentBadge` | ✅ Required | Yes | Badge display | DO NOT REMOVE |
| `data.nextBadge` | ✅ Required | Yes | Badge display | DO NOT REMOVE |
| `data.progressPercentage` | ✅ Required | Yes | Progress bar | DO NOT REMOVE |
| `data.badgeProgress` | ✅ Required | Yes | Badge section | DO NOT REMOVE |
| `data.settings` | ✅ Required | Yes | Settings toggles | DO NOT REMOVE |
| `data.healthHistory` | ⚠️ Parsed, not displayed | Yes | Stored, not rendered on profile | LOW RISK |
| `data.isEmailVerified` | ❌ Completely unused | No | No (not rendered on profile) | SAFE |
| `data.emailVerifiedAt` | ❌ Completely unused | No | No | SAFE |
| `data.isSuspended` | ❌ Completely unused | No | No | SAFE |
| `data.fcmTokens` | ❌ Completely unused | No | No | SAFE |
| `data.travelHistory` | ❌ Completely unused | No | No | SAFE |
| `data.hemoglobinLevel` | ❌ Completely unused | No | No | SAFE |
| `data.createdAt` | ❌ Completely unused | No | No | SAFE |
| `data.updatedAt` | ❌ Completely unused | No | No | SAFE |
| `data.fullNameNormalized` | ❌ Completely unused | No | No | SAFE |
| `data.__v` | ❌ Completely unused | No | No | SAFE |
| `data.isBanned` | ❌ Completely unused | No | No | SAFE |
| `data.verificationStatus` | ❌ Completely unused | No | No | SAFE |
| `data.isVerified` | ❌ Completely unused | No | No | SAFE |
| `data.isOptedIn` | ❌ Completely unused | No | No | SAFE |
| `data.lastDonationDate` | ❌ Completely unused | No | No | SAFE |
| `data.location.lastUpdated` | ❌ Completely unused | No | No | SAFE |
| `data.__t` | ❌ Completely unused | No | No | SAFE |

---

### 16. `PUT /donor/profile`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (snackbar + refresh) | DO NOT REMOVE |
| Everything else in `data` | ❌ Completely unused | No | No | SAFE |

> Backend returns the full donor object. Flutter only checks `success`. The entire `data` object is dead weight.

---

### 17. `GET /donor/stats`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.totalDonations` | ✅ Required | Yes | Counter | DO NOT REMOVE |
| `data.points` | ✅ Required | Yes | Counter | DO NOT REMOVE |
| `data.livesSaved` | ✅ Required | Yes | Counter | DO NOT REMOVE |
| `success` | ⚠️ Parsed, not displayed | Yes | Gate only | LOW RISK |
| `message` | ❌ Completely unused | No | No | SAFE |

---

### 18. `GET /donor/donation-eligibility`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.isEligible` | ✅ Required | Yes | Button enabled/disabled | DO NOT REMOVE |
| `data.reason` | ✅ Required | Yes | Shown when not eligible | DO NOT REMOVE |
| `data.nextEligibleDate` | ✅ Required | Yes | Countdown shown | DO NOT REMOVE |
| `data.participationEnabled` | ✅ Required | Yes | Hides feature if false | DO NOT REMOVE |
| `data.daysRemaining` | ✅ Required | Yes | Days counter | DO NOT REMOVE |
| `data.lastDonationDate` | ❌ Completely unused | No | No | SAFE |
| `data.cooldownDays` | ❌ Completely unused | No | No | SAFE |
| `message` | ❌ Completely unused | No | No | SAFE |

---

### 19. `GET /donor/activity`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.activities[].id` | ✅ Required | Yes | Key | DO NOT REMOVE |
| `data.activities[].title` | ✅ Required | Yes | Card title | DO NOT REMOVE |
| `data.activities[].hospital` | ✅ Required | Yes | Subtitle | DO NOT REMOVE |
| `data.activities[].points` | ✅ Required | Yes | Points badge | DO NOT REMOVE |
| `data.activities[].relativeTime` | ✅ Required | Yes | Timestamp label | DO NOT REMOVE |
| `data.activities[].type` | ✅ Required | Yes | Icon selection | DO NOT REMOVE |
| `data.activities[].status` | ✅ Required | Yes | Color coding | DO NOT REMOVE |
| `data.pagination.hasNextPage` | ✅ Required | Yes | Load-more trigger | DO NOT REMOVE |
| `data.activities[].createdAt` | ❌ Completely unused | No | No (uses relativeTime) | SAFE |
| `data.activities[].icon` | ❌ Completely unused | No | No (Flutter maps from `type`) | SAFE |
| `data.pagination.total` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.totalPages` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.hasPrevPage` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.limit` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.currentPage` | ❌ Completely unused | No | No | SAFE |

---

### 20. `GET /donor/history` *(currently broken — key is `donations` not `history`)*

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.history[]` (when fixed) | ✅ Required | Yes | History list | DO NOT REMOVE |
| `data.pagination.hasNextPage` | ✅ Required | Yes | Load-more | DO NOT REMOVE |
| `data.pagination.total` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.totalPages` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.hasPrevPage` | ❌ Completely unused | No | No | SAFE |

---

### 21. `GET /donor/settings` *(currently broken — nested under `settings`)*

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.pushNotifications` | ✅ Required | Yes | Toggle | DO NOT REMOVE |
| `data.emergencyAlerts` | ✅ Required | Yes | Toggle | DO NOT REMOVE |
| `data.privacyMode` | ✅ Required | Yes | Toggle | DO NOT REMOVE |
| `data.language` | ✅ Required | Yes | Language selector | DO NOT REMOVE |

---

### 22. `PUT /donor/settings`

Same as GET — all four settings fields required; no dead weight beyond the nesting fix.

---

### 23. `GET /requests/nearby`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.requests[].id` | ✅ Required | Yes | Navigation/actions | DO NOT REMOVE |
| `data.requests[].requestId` | ✅ Required | Yes | Alias fallback | DO NOT REMOVE |
| `data.requests[].bloodTypeLabel` | ✅ Required | Yes | Card display | DO NOT REMOVE |
| `data.requests[].hospitalName` | ✅ Required | Yes | Card display | DO NOT REMOVE |
| `data.requests[].unitsNeeded` | ✅ Required | Yes | Card display | DO NOT REMOVE |
| `data.requests[].isEmergency` | ✅ Required | Yes | Emergency badge | DO NOT REMOVE |
| `data.requests[].urgency` | ✅ Required | Yes | Color coding | DO NOT REMOVE |
| `data.requests[].type` | ✅ Required | Yes | Icon type | DO NOT REMOVE |
| `data.requests[].distance` | ✅ Required | Yes | Distance string | DO NOT REMOVE |
| `data.requests[].requiredBy` | ✅ Required | Yes | Deadline display | DO NOT REMOVE |
| `data.requests[].status` | ✅ Required | Yes | Button visibility | DO NOT REMOVE |
| `data.requests[].hospital.name` | ✅ Required | Yes | Fallback hospital name | DO NOT REMOVE |
| `data.requests[].hospital.address` | ✅ Required | Yes | City/governorate | DO NOT REMOVE |
| `data.pagination.hasNextPage` | ✅ Required | Yes | Load-more | DO NOT REMOVE |
| `data.requests[].bloodType` | ⚠️ Parsed, not displayed | Yes | Stored in model | LOW RISK |
| `data.requests[].location` | ⚠️ Parsed, not displayed | Yes | May be used for map | LOW RISK |
| `data.requests[].locationHospital` | ❌ Completely unused | No | No (uses `location.lat/lng`) | SAFE |
| `data.requests[].qrToken` | ❌ Completely unused | No | No | SAFE |
| `data.requests[].qrCreatedAt` | ❌ Completely unused | No | No | SAFE |
| `data.requests[].qrExpiresAt` | ❌ Completely unused | No | No | SAFE |
| `data.requests[].requestStatus` | ❌ Completely unused | No | No (alias of `status`) | SAFE |
| `data.requests[].contactNumber` | ❌ Completely unused | No | No | SAFE |
| `data.requests[].patientType` | ❌ Completely unused | No | No | SAFE |
| `data.requests[].distanceKm` | ❌ Completely unused | No | No (uses `distance` string) | SAFE |
| `data.requests[].distanceMeters` | ❌ Completely unused | No | No | SAFE |
| `data.requests[].hospital.contactNumber` | ❌ Completely unused | No | No | SAFE |
| `data.requests[].hospital.latitude` | ❌ Completely unused | No | No | SAFE |
| `data.requests[].hospital.longitude` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.total` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.currentPage` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.totalPages` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.hasPrevPage` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.limit` | ❌ Completely unused | No | No | SAFE |
| `data.viewerLocation` | ❌ Completely unused | No | No | SAFE |
| `data.radiusKm` | ❌ Completely unused | No | No | SAFE |
| `data.requests[].createdAt` | ❌ Completely unused | No | No | SAFE |

---

### 24. `GET /requests/:id`

Same classification as nearby requests — identical `buildRequestPayload()` output.

---

### 25. `POST /donor/respond/:requestId`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (gate) | DO NOT REMOVE |
| `data.donorId` | ❌ Completely unused | No | No | SAFE |
| `data.requestId` | ❌ Completely unused | No | No | SAFE |
| `data.status` | ❌ Completely unused | No | No | SAFE |
| `data._id` | ❌ Completely unused | No | No | SAFE |
| `data.quantity` | ❌ Completely unused | No | No | SAFE |
| `message` | ❌ Completely unused | No | No | SAFE |

---

### 26. `POST /requests/:requestId/cancel`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (gate) | DO NOT REMOVE |
| `message` | ❌ Completely unused | No | No | SAFE |
| `data.request` | ❌ Completely unused | No | No | SAFE |
| `data.donor` | ❌ Completely unused | No | No | SAFE |

---

### 27. `GET /notifications`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.notifications[]._id` | ✅ Required | Yes | Delete/mark-read actions | DO NOT REMOVE |
| `data.notifications[].type` | ✅ Required | Yes | Icon + color | DO NOT REMOVE |
| `data.notifications[].title` | ✅ Required | Yes | Title | DO NOT REMOVE |
| `data.notifications[].message` | ✅ Required | Yes | Body | DO NOT REMOVE |
| `data.notifications[].read` | ✅ Required | Yes | Read indicator | DO NOT REMOVE |
| `data.notifications[].createdAt` | ✅ Required | Yes | Timestamp | DO NOT REMOVE |
| `data.notifications[].data.requestId` | ✅ Required | Yes | Deep link | DO NOT REMOVE |
| `data.notifications[].data.hospitalName` | ✅ Required | Yes | Subtitle | DO NOT REMOVE |
| `data.unreadCount` | ✅ Required | Yes | Badge counter | DO NOT REMOVE |
| `data.pagination.pages` | ✅ Required | Yes | Total pages *(currently broken — key is `totalPages`)* | DO NOT REMOVE |
| `data.notifications[].userId` | ❌ Completely unused | No | No | SAFE |
| `data.notifications[].relatedId` | ❌ Completely unused | No | No | SAFE |
| `data.notifications[].relatedType` | ❌ Completely unused | No | No | SAFE |
| `data.notifications[].updatedAt` | ❌ Completely unused | No | No | SAFE |
| `data.notifications[].data.requestType` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.total` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.page` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.limit` | ❌ Completely unused | No | No | SAFE |

---

### 28. `PATCH /notifications/read-all`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ⚠️ Parsed, not displayed | Yes | Gate only | LOW RISK |
| `data.modifiedCount` | ❌ Completely unused | No | No | SAFE |

---

### 29. `DELETE /notifications/`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| *(entire body)* | ❌ Completely unused | No | No | SAFE |

> Flutter ignores the entire response body. Only the HTTP 2xx status code matters.

---

### 30. `GET /rewards/points`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.pointsBalance` | ✅ Required | Yes | Large display number | DO NOT REMOVE |
| `data.lifetimePointsEarned` | ✅ Required | Yes | Secondary stat | DO NOT REMOVE |
| `data.currentTier` | ✅ Required | Yes | Tier badge | DO NOT REMOVE |
| `data.nextTier` | ✅ Required | Yes | Label | DO NOT REMOVE |
| `data.pointsToNextTier` | ✅ Required | Yes | Progress bar | DO NOT REMOVE |
| `data.tierBenefits` | ⚠️ Parsed, not displayed | Yes | Parsed but report says not rendered in main UI | LOW RISK |
| `data.progressPercentage` | ⚠️ Parsed, not displayed | Yes | May be used for tier progress | LOW RISK |

---

### 31. `GET /rewards/points/history` *(currently broken — key mismatch)*

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.history[].type` | ✅ Required | Yes | List item type | DO NOT REMOVE |
| `data.history[].points` | ✅ Required | Yes | Points number | DO NOT REMOVE |
| `data.history[].description` | ✅ Required | Yes | Description | DO NOT REMOVE |
| `data.history[].date` | ✅ Required | Yes | Date display | DO NOT REMOVE |

---

### 32. `GET /rewards/badges` *(currently broken — field name mismatch)*

| Field (after fix) | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `badges[].name` | ✅ Required | Yes | Badge name | DO NOT REMOVE |
| `badges[].icon` | ✅ Required | Yes | Badge icon | DO NOT REMOVE |
| `badges[].earned` | ✅ Required | Yes | Lock state | DO NOT REMOVE |
| `badges[].earnedAt` | ✅ Required | Yes | Date earned | DO NOT REMOVE |
| `unlockedCount` | ⚠️ Parsed, not displayed | Yes | May be used in stats | LOW RISK |
| `totalCount` | ⚠️ Parsed, not displayed | Yes | May be used in stats | LOW RISK |
| `badges[].progressCurrent` | ❌ Completely unused | No | No | SAFE |
| `badges[].progressTarget` | ❌ Completely unused | No | No | SAFE |
| `badges[].progressPercentage` | ❌ Completely unused | No | No | SAFE |
| `badges[].category` | ❌ Completely unused | No | No | SAFE |
| `badges[].rarity` | ❌ Completely unused | No | No | SAFE |
| `stats.totalDonations` | ❌ Completely unused | No | No | SAFE |
| `stats.totalEmergencyResponses` | ❌ Completely unused | No | No | SAFE |
| `stats.daysAsDonor` | ❌ Completely unused | No | No | SAFE |
| `completionPercentage` | ❌ Completely unused | No | No | SAFE |

---

### 33. `GET /rewards/catalog`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.rewards[]._id` | ✅ Required | Yes | Redeem call | DO NOT REMOVE |
| `data.rewards[].name` | ✅ Required | Yes | Card title | DO NOT REMOVE |
| `data.rewards[].description` | ✅ Required | Yes | Card subtitle | DO NOT REMOVE |
| `data.rewards[].pointsCost` | ✅ Required | Yes | Cost badge | DO NOT REMOVE |
| `data.rewards[].category` | ✅ Required | Yes | Filter chip | DO NOT REMOVE |
| `data.rewards[].colorCode` | ✅ Required | Yes | Card accent | DO NOT REMOVE |
| `data.rewards[].iconType` | ✅ Required | Yes | Icon | DO NOT REMOVE |
| `data.rewards[].available` | ✅ Required | Yes | Redeem button gate | DO NOT REMOVE |
| `data.filterOptions.categories` | ✅ Required | Yes | Filter chips | DO NOT REMOVE |
| `data.rewards[].status` | ❌ Completely unused | No | No (only `available` used) | SAFE |
| `data.rewards[].dailyLimit` | ❌ Completely unused | No | No | SAFE |
| `data.rewards[].monthlyLimit` | ❌ Completely unused | No | No | SAFE |
| `data.rewards[].redemptionCount` | ❌ Completely unused | No | No | SAFE |
| `data.rewards[].createdAt` | ❌ Completely unused | No | No | SAFE |
| `data.rewards[].updatedAt` | ❌ Completely unused | No | No | SAFE |
| `data.rewards[].__v` | ❌ Completely unused | No | No | SAFE |

---

### 34. `POST /rewards/catalog/:rewardId/redeem`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (dialog + refresh) | DO NOT REMOVE |
| `data.redemptionId` | ❌ Completely unused | No | No | SAFE |
| `data.confirmationCode` | ❌ Completely unused | No | No | SAFE |
| `data.rewardName` | ❌ Completely unused | No | No | SAFE |
| `data.pointsSpent` | ❌ Completely unused | No | No | SAFE |
| `data.remainingPoints` | ❌ Completely unused | No | No | SAFE |
| `data.redemptionStatus` | ❌ Completely unused | No | No | SAFE |
| `data.expiresAt` | ❌ Completely unused | No | No | SAFE |

---

### 35. `GET /rewards/earning-rules` *(partially compatible — field names differ)*

| Field (backend actual) | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `type` / `action` | ✅ Required | Yes | List item | DO NOT REMOVE |
| `points` | ✅ Required | Yes | Points number | DO NOT REMOVE |
| `title` / `description` | ✅ Required | Yes | Description | DO NOT REMOVE |
| `category` | ❌ Completely unused | No | No | SAFE |

---

### 36. `GET /donations/book-appointment/my-appointments`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.appointments[]._id` | ✅ Required | Yes | Cancel action | DO NOT REMOVE |
| `data.appointments[].appointmentDate` | ✅ Required | Yes | Date display | DO NOT REMOVE |
| `data.appointments[].donationType` | ✅ Required | Yes | Type display | DO NOT REMOVE |
| `data.appointments[].status` | ✅ Required | Yes | Status badge | DO NOT REMOVE |
| `data.appointments[].hospitalId.hospitalName` | ✅ Required | Yes | Hospital name | DO NOT REMOVE |
| `data.appointments[].hospitalId.address` | ✅ Required | Yes | Location | DO NOT REMOVE |
| `data.appointments[].qrToken` | ✅ Required | Yes | QR code button trigger | DO NOT REMOVE |
| `data.meta.hasNextPage` | ✅ Required | Yes | Load-more | DO NOT REMOVE |
| `data.appointments[].notes` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].donorId` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].createdAt` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].updatedAt` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].qrScannedAt` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].qrExpiresAt` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].requestId` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].__v` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].hospitalId.fullName` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].hospitalId.location.coordinates` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].rescheduleCount` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].rescheduleHistory` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].verificationStatus` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].verificationChecklist` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].donorDetails` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].donor` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].request` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].appointment` (nested) | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].hospitalDetails` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].requestDetails` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].appointmentTime` | ❌ Completely unused | No | No | SAFE |
| `data.appointments[].appointmentId` | ❌ Completely unused | No | No (duplicate of `_id`) | SAFE |
| `data.total` | ❌ Completely unused | No | No | SAFE |
| `data.meta.total` | ❌ Completely unused | No | No | SAFE |
| `data.meta.page` | ❌ Completely unused | No | No | SAFE |
| `data.meta.limit` | ❌ Completely unused | No | No | SAFE |
| `data.meta.totalPages` | ❌ Completely unused | No | No | SAFE |
| `data.meta.hasPrevPage` | ❌ Completely unused | No | No | SAFE |
| `data.meta.currentPage` | ❌ Completely unused | No | No | SAFE |

---

### 37. `POST /donations/book-appointment`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (navigation gate) | DO NOT REMOVE |
| `data` (entire DTO) | ❌ Completely unused | No | No | SAFE |

---

### 38. `DELETE /donations/book-appointment/:appointmentId`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `success` | ✅ Required | Yes | Yes (removes from list) | DO NOT REMOVE |
| `data` (appointment object) | ❌ Completely unused | No | No | SAFE |

---

### 39. `GET /donations/book-appointment/available-slots` *(currently broken — key mismatch)*

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `slots[].time` *(after fix: `timeSlots`)* | ✅ Required | Yes | Slot picker | DO NOT REMOVE |
| `slots[].available` | ✅ Required | Yes | Enable/disable slot | DO NOT REMOVE |
| `slots[].remainingCapacity` | ❌ Completely unused | No | No | SAFE |
| `slots[].maxCapacity` | ❌ Completely unused | No | No | SAFE |
| `hospitalId` | ❌ Completely unused | No | No | SAFE |
| `date` | ❌ Completely unused | No | No | SAFE |
| `slotsPerHour` | ❌ Completely unused | No | No | SAFE |
| `openingTime` | ❌ Completely unused | No | No | SAFE |
| `closingTime` | ❌ Completely unused | No | No | SAFE |

---

### 40. `GET /hospitals/nearby`

| Field | Used By Flutter? | Parsed? | Displayed? | Safe To Remove? |
|-------|-----------------|---------|-----------|----------------|
| `data.hospitals[].id` *(missing — see audit #40)* | ✅ Required | Yes | Booking | DO NOT REMOVE |
| `data.hospitals[].name` | ✅ Required | Yes | Card title | DO NOT REMOVE |
| `data.hospitals[].address.city` | ✅ Required | Yes | Location | DO NOT REMOVE |
| `data.hospitals[].address.governorate` | ✅ Required | Yes | Location | DO NOT REMOVE |
| `data.hospitals[].distance` | ✅ Required | Yes | Distance string | DO NOT REMOVE |
| `data.hospitals[].bloodTypes` | ✅ Required | Yes | Blood type chips | DO NOT REMOVE |
| `data.hospitals[].isAvailable` | ✅ Required | Yes | Open/closed badge | DO NOT REMOVE |
| `data.hospitals[].urgentNeedsCount` | ✅ Required | Yes | Urgent badge | DO NOT REMOVE |
| `data.hospitals[].workingHours` | ✅ Required | Yes | Hours display | DO NOT REMOVE |
| `data.pagination.total` | ✅ Required | Yes | Page count | DO NOT REMOVE |
| `data.hospitals[].fullName` | ❌ Completely unused | No | No (uses `name`) | SAFE |
| `data.hospitals[].phoneNumber` | ❌ Completely unused | No | No | SAFE |
| `data.hospitals[].contactNumber` | ❌ Completely unused | No | No | SAFE |
| `data.hospitals[].email` | ❌ Completely unused | No | No | SAFE |
| `data.hospitals[].hospitalType` | ❌ Completely unused | No | No | SAFE |
| `data.hospitals[].distanceKm` | ❌ Completely unused | No | No (uses `distance` string) | SAFE |
| `data.hospitals[].distanceMeters` | ❌ Completely unused | No | No | SAFE |
| `data.hospitals[].lat` | ❌ Completely unused | No | No (uses `location.lat/lng`) | SAFE |
| `data.hospitals[].lng` | ❌ Completely unused | No | No | SAFE |
| `data.hospitals[].long` | ❌ Completely unused | No | No | SAFE |
| `data.hospitals[].appointmentSchedulingEnabled` | ❌ Completely unused | No | No | SAFE |
| `data.hospitals[].hospitalActive` | ❌ Completely unused | No | No | SAFE |
| `data.hospitals[].hospitalVerified` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.page` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.limit` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.totalPages` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.hasNextPage` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.hasPrevPage` | ❌ Completely unused | No | No | SAFE |
| `data.pagination.currentPage` | ❌ Completely unused | No | No | SAFE |

---

### 41. `GET /hospitals/search`

Same field classification as `/hospitals/nearby`. All dead fields identical.

---

---

# Safe Response Cleanup

Fields that are **not parsed, not displayed, not used anywhere in Flutter** — confirmed dead weight.

---

## SAFE to Remove

*These can be removed immediately with zero Flutter impact.*

| # | Endpoint | Field | Estimated Payload Reduction | Risk |
|---|----------|-------|-----------------------------|------|
| 1 | `POST /auth/signup` | `data.verificationEmail.sent` | ~30 bytes | SAFE |
| 2 | `POST /auth/signup` | `data.verificationEmail.id` | ~50 bytes | SAFE |
| 3 | `POST /auth/signup` | `data.user.createdAt` | ~30 bytes | SAFE |
| 4 | `POST /auth/signup` | `data.user.updatedAt` | ~30 bytes | SAFE |
| 5 | `POST /auth/signup` | `data.user.__v` | ~10 bytes | SAFE |
| 6 | `POST /auth/signup` | `data.user.fcmTokens` | ~15 bytes | SAFE |
| 7 | `POST /auth/signup` | `data.user.fullNameNormalized` | ~40 bytes | SAFE |
| 8 | `POST /auth/signup` | `data.user.emailVerifiedAt` | ~30 bytes | SAFE |
| 9 | `POST /auth/signup` | `data.user.isSuspended` | ~20 bytes | SAFE |
| 10 | `POST /auth/login` | `message` | ~30 bytes | SAFE |
| 11 | `POST /auth/login` | `data.verified` | ~20 bytes | SAFE |
| 12 | `POST /auth/login` | `data.user_id` | ~30 bytes | SAFE |
| 13 | `POST /auth/login` | `data.user_role` | ~20 bytes | SAFE |
| 14 | `POST /auth/login` | `data.user_name` | ~30 bytes | SAFE |
| 15 | `POST /auth/logout` | `data` (message string) | ~30 bytes | SAFE |
| 16 | `POST /auth/forgot-password` | `message` | ~40 bytes | SAFE |
| 17 | `POST /auth/verify-otp` | `message` | ~50 bytes | SAFE |
| 18 | `POST /auth/verify-otp` | `data.otp` | ~10 bytes | SAFE |
| 19 | `POST /auth/reset-password` | `message` | ~40 bytes | SAFE |
| 20 | `POST /auth/verify-email` | `message` / data string | ~35 bytes | SAFE |
| 21 | `POST /auth/verify-email-otp` | `message` | ~40 bytes | SAFE |
| 22 | `GET /auth/me` | `data.emailVerifiedAt` | ~30 bytes | SAFE |
| 23 | `GET /auth/me` | `data.isSuspended` | ~20 bytes | SAFE |
| 24 | `GET /auth/me` | `data.suspendedAt` | ~25 bytes | SAFE |
| 25 | `GET /auth/me` | `data.suspendedReason` | ~25 bytes | SAFE |
| 26 | `GET /auth/me` | `data.deletedAt` | ~20 bytes | SAFE |
| 27 | `GET /auth/me` | `data.fcmTokens` | ~20 bytes | SAFE |
| 28 | `GET /auth/me` | `data.phone` | ~15 bytes | SAFE |
| 29 | `GET /auth/me` | `data.address` | ~20 bytes | SAFE |
| 30 | `GET /auth/me` | `data.__t` | ~12 bytes | SAFE |
| 31 | `GET /auth/me` | `data.hemoglobinLevel` | ~30 bytes | SAFE |
| 32 | `GET /auth/me` | `data.temporaryDeferralUntil` | ~35 bytes | SAFE |
| 33 | `GET /auth/me` | `data.lastDeferralReason` | ~30 bytes | SAFE |
| 34 | `GET /auth/me` | `data.travelHistory` | ~20 bytes | SAFE |
| 35 | `GET /auth/me` | `data.createdAt` | ~30 bytes | SAFE |
| 36 | `GET /auth/me` | `data.updatedAt` | ~30 bytes | SAFE |
| 37 | `GET /auth/me` | `data.fullNameNormalized` | ~50 bytes | SAFE |
| 38 | `GET /auth/me` | `data.__v` | ~10 bytes | SAFE |
| 39 | `GET /auth/me` | `data.isOptedIn` | ~20 bytes | SAFE |
| 40 | `GET /auth/me` | `data.isBanned` | ~18 bytes | SAFE |
| 41 | `GET /auth/me` | `data.isVerified` | ~20 bytes | SAFE |
| 42 | `GET /auth/me` | `data.location.lastUpdated` | ~35 bytes | SAFE |
| 43 | `POST /auth/validate-token` | `message` | ~25 bytes | SAFE |
| 44 | `POST /auth/validate-token` | `data.user_id` | ~30 bytes | SAFE |
| 45 | `POST /auth/refresh-token` | `success` | ~15 bytes | SAFE |
| 46 | `POST /auth/refresh-token` | `message` | ~30 bytes | SAFE |
| 47 | `POST /auth/refresh-token` | `data.access_token` | ~200 bytes | SAFE |
| 48 | `POST /auth/change-password` | `message` | ~40 bytes | SAFE |
| 49 | `GET /donor/profile` | `data.isEmailVerified` | ~25 bytes | SAFE |
| 50 | `GET /donor/profile` | `data.emailVerifiedAt` | ~30 bytes | SAFE |
| 51 | `GET /donor/profile` | `data.isSuspended` | ~20 bytes | SAFE |
| 52 | `GET /donor/profile` | `data.fcmTokens` | ~20 bytes | SAFE |
| 53 | `GET /donor/profile` | `data.travelHistory` | ~20 bytes | SAFE |
| 54 | `GET /donor/profile` | `data.hemoglobinLevel` | ~30 bytes | SAFE |
| 55 | `GET /donor/profile` | `data.createdAt` | ~30 bytes | SAFE |
| 56 | `GET /donor/profile` | `data.updatedAt` | ~30 bytes | SAFE |
| 57 | `GET /donor/profile` | `data.fullNameNormalized` | ~50 bytes | SAFE |
| 58 | `GET /donor/profile` | `data.__v` | ~10 bytes | SAFE |
| 59 | `GET /donor/profile` | `data.isBanned` | ~18 bytes | SAFE |
| 60 | `GET /donor/profile` | `data.verificationStatus` | ~30 bytes | SAFE |
| 61 | `GET /donor/profile` | `data.isVerified` | ~20 bytes | SAFE |
| 62 | `GET /donor/profile` | `data.isOptedIn` | ~20 bytes | SAFE |
| 63 | `GET /donor/profile` | `data.lastDonationDate` | ~35 bytes | SAFE |
| 64 | `GET /donor/profile` | `data.location.lastUpdated` | ~35 bytes | SAFE |
| 65 | `GET /donor/profile` | `data.__t` | ~12 bytes | SAFE |
| 66 | `PUT /donor/profile` | Entire `data` body | ~800-1500 bytes | SAFE |
| 67 | `GET /donor/donation-eligibility` | `data.lastDonationDate` | ~35 bytes | SAFE |
| 68 | `GET /donor/donation-eligibility` | `data.cooldownDays` | ~20 bytes | SAFE |
| 69 | `GET /donor/activity` | `data.activities[].createdAt` | ~35 bytes/item | SAFE |
| 70 | `GET /donor/activity` | `data.activities[].icon` | ~20 bytes/item | SAFE |
| 71 | `GET /donor/activity` | `data.pagination.total` | ~15 bytes | SAFE |
| 72 | `GET /donor/activity` | `data.pagination.totalPages` | ~20 bytes | SAFE |
| 73 | `GET /donor/activity` | `data.pagination.hasPrevPage` | ~22 bytes | SAFE |
| 74 | `GET /donor/activity` | `data.pagination.limit` | ~15 bytes | SAFE |
| 75 | `GET /donor/activity` | `data.pagination.currentPage` | ~20 bytes | SAFE |
| 76 | `GET /requests/nearby` | `data.requests[].locationHospital` | ~40 bytes/item | SAFE |
| 77 | `GET /requests/nearby` | `data.requests[].qrToken` | ~70 bytes/item | SAFE |
| 78 | `GET /requests/nearby` | `data.requests[].qrCreatedAt` | ~35 bytes/item | SAFE |
| 79 | `GET /requests/nearby` | `data.requests[].qrExpiresAt` | ~35 bytes/item | SAFE |
| 80 | `GET /requests/nearby` | `data.requests[].requestStatus` | ~30 bytes/item | SAFE |
| 81 | `GET /requests/nearby` | `data.requests[].contactNumber` | ~30 bytes/item | SAFE |
| 82 | `GET /requests/nearby` | `data.requests[].patientType` | ~25 bytes/item | SAFE |
| 83 | `GET /requests/nearby` | `data.requests[].distanceKm` | ~20 bytes/item | SAFE |
| 84 | `GET /requests/nearby` | `data.requests[].distanceMeters` | ~25 bytes/item | SAFE |
| 85 | `GET /requests/nearby` | `data.requests[].hospital.contactNumber` | ~35 bytes/item | SAFE |
| 86 | `GET /requests/nearby` | `data.requests[].hospital.latitude` | ~25 bytes/item | SAFE |
| 87 | `GET /requests/nearby` | `data.requests[].hospital.longitude` | ~25 bytes/item | SAFE |
| 88 | `GET /requests/nearby` | `data.pagination.total` | ~15 bytes | SAFE |
| 89 | `GET /requests/nearby` | `data.pagination.currentPage` | ~20 bytes | SAFE |
| 90 | `GET /requests/nearby` | `data.pagination.totalPages` | ~22 bytes | SAFE |
| 91 | `GET /requests/nearby` | `data.pagination.hasPrevPage` | ~22 bytes | SAFE |
| 92 | `GET /requests/nearby` | `data.pagination.limit` | ~15 bytes | SAFE |
| 93 | `GET /requests/nearby` | `data.viewerLocation` | ~40 bytes | SAFE |
| 94 | `GET /requests/nearby` | `data.radiusKm` | ~15 bytes | SAFE |
| 95 | `GET /requests/nearby` | `data.requests[].createdAt` | ~35 bytes/item | SAFE |
| 96 | `POST /donor/respond/:requestId` | `data.donorId` | ~30 bytes | SAFE |
| 97 | `POST /donor/respond/:requestId` | `data.requestId` | ~30 bytes | SAFE |
| 98 | `POST /donor/respond/:requestId` | `data.status` | ~20 bytes | SAFE |
| 99 | `POST /donor/respond/:requestId` | `data._id` | ~30 bytes | SAFE |
| 100 | `POST /donor/respond/:requestId` | `data.quantity` | ~15 bytes | SAFE |
| 101 | `POST /requests/:requestId/cancel` | `data.request` | ~300-600 bytes | SAFE |
| 102 | `POST /requests/:requestId/cancel` | `data.donor` | ~100-200 bytes | SAFE |
| 103 | `GET /notifications` | `data.notifications[].userId` | ~35 bytes/item | SAFE |
| 104 | `GET /notifications` | `data.notifications[].relatedId` | ~35 bytes/item | SAFE |
| 105 | `GET /notifications` | `data.notifications[].relatedType` | ~25 bytes/item | SAFE |
| 106 | `GET /notifications` | `data.notifications[].updatedAt` | ~35 bytes/item | SAFE |
| 107 | `GET /notifications` | `data.notifications[].data.requestType` | ~25 bytes/item | SAFE |
| 108 | `GET /notifications` | `data.pagination.total` | ~15 bytes | SAFE |
| 109 | `GET /notifications` | `data.pagination.page` | ~12 bytes | SAFE |
| 110 | `GET /notifications` | `data.pagination.limit` | ~15 bytes | SAFE |
| 111 | `PATCH /notifications/read-all` | `data.modifiedCount` | ~20 bytes | SAFE |
| 112 | `DELETE /notifications/` | Entire response body | ~30 bytes | SAFE |
| 113 | `GET /rewards/catalog` | `data.rewards[].status` | ~20 bytes/item | SAFE |
| 114 | `GET /rewards/catalog` | `data.rewards[].dailyLimit` | ~20 bytes/item | SAFE |
| 115 | `GET /rewards/catalog` | `data.rewards[].monthlyLimit` | ~22 bytes/item | SAFE |
| 116 | `GET /rewards/catalog` | `data.rewards[].redemptionCount` | ~25 bytes/item | SAFE |
| 117 | `GET /rewards/catalog` | `data.rewards[].createdAt` | ~35 bytes/item | SAFE |
| 118 | `GET /rewards/catalog` | `data.rewards[].updatedAt` | ~35 bytes/item | SAFE |
| 119 | `GET /rewards/catalog` | `data.rewards[].__v` | ~10 bytes/item | SAFE |
| 120 | `POST /rewards/catalog/:rewardId/redeem` | `data.redemptionId` | ~35 bytes | SAFE |
| 121 | `POST /rewards/catalog/:rewardId/redeem` | `data.confirmationCode` | ~30 bytes | SAFE |
| 122 | `POST /rewards/catalog/:rewardId/redeem` | `data.rewardName` | ~30 bytes | SAFE |
| 123 | `POST /rewards/catalog/:rewardId/redeem` | `data.pointsSpent` | ~20 bytes | SAFE |
| 124 | `POST /rewards/catalog/:rewardId/redeem` | `data.remainingPoints` | ~22 bytes | SAFE |
| 125 | `POST /rewards/catalog/:rewardId/redeem` | `data.redemptionStatus` | ~25 bytes | SAFE |
| 126 | `POST /rewards/catalog/:rewardId/redeem` | `data.expiresAt` | ~30 bytes | SAFE |
| 127 | `GET /rewards/earning-rules` | `category` per rule | ~20 bytes/item | SAFE |
| 128 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].notes` | ~20 bytes/item | SAFE |
| 129 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].donorId` | ~35 bytes/item | SAFE |
| 130 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].createdAt` | ~35 bytes/item | SAFE |
| 131 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].updatedAt` | ~35 bytes/item | SAFE |
| 132 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].qrScannedAt` | ~30 bytes/item | SAFE |
| 133 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].qrExpiresAt` | ~35 bytes/item | SAFE |
| 134 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].requestId` | ~35 bytes/item | SAFE |
| 135 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].__v` | ~10 bytes/item | SAFE |
| 136 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].hospitalId.fullName` | ~40 bytes/item | SAFE |
| 137 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].hospitalId.location.coordinates` | ~50 bytes/item | SAFE |
| 138 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].rescheduleCount` | ~22 bytes/item | SAFE |
| 139 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].rescheduleHistory` | ~20 bytes/item (or much more) | SAFE |
| 140 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].verificationStatus` | ~30 bytes/item | SAFE |
| 141 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].verificationChecklist` | ~80 bytes/item | SAFE |
| 142 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].donorDetails` | ~200 bytes/item | SAFE |
| 143 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].donor` | ~200 bytes/item | SAFE |
| 144 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].request` | ~100 bytes/item | SAFE |
| 145 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].appointment` (nested) | ~150 bytes/item | SAFE |
| 146 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].hospitalDetails` | ~200 bytes/item | SAFE |
| 147 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].requestDetails` | ~100 bytes/item | SAFE |
| 148 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].appointmentTime` | ~20 bytes/item | SAFE |
| 149 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].appointmentId` | ~35 bytes/item | SAFE |
| 150 | `GET /donations/book-appointment/my-appointments` | `data.total` | ~12 bytes | SAFE |
| 151 | `GET /donations/book-appointment/my-appointments` | `data.meta.total` | ~15 bytes | SAFE |
| 152 | `GET /donations/book-appointment/my-appointments` | `data.meta.page` | ~12 bytes | SAFE |
| 153 | `GET /donations/book-appointment/my-appointments` | `data.meta.limit` | ~15 bytes | SAFE |
| 154 | `GET /donations/book-appointment/my-appointments` | `data.meta.totalPages` | ~20 bytes | SAFE |
| 155 | `GET /donations/book-appointment/my-appointments` | `data.meta.hasPrevPage` | ~22 bytes | SAFE |
| 156 | `GET /donations/book-appointment/my-appointments` | `data.meta.currentPage` | ~20 bytes | SAFE |
| 157 | `POST /donations/book-appointment` | Entire `data` body (appointment DTO) | ~800-1500 bytes | SAFE |
| 158 | `DELETE /donations/book-appointment/:id` | Entire `data` body | ~800-1500 bytes | SAFE |
| 159 | `GET /donations/book-appointment/available-slots` | `slots[].remainingCapacity` | ~28 bytes/slot | SAFE |
| 160 | `GET /donations/book-appointment/available-slots` | `slots[].maxCapacity` | ~22 bytes/slot | SAFE |
| 161 | `GET /donations/book-appointment/available-slots` | `hospitalId` | ~35 bytes | SAFE |
| 162 | `GET /donations/book-appointment/available-slots` | `date` | ~30 bytes | SAFE |
| 163 | `GET /donations/book-appointment/available-slots` | `slotsPerHour` | ~20 bytes | SAFE |
| 164 | `GET /donations/book-appointment/available-slots` | `openingTime` | ~22 bytes | SAFE |
| 165 | `GET /donations/book-appointment/available-slots` | `closingTime` | ~20 bytes | SAFE |
| 166 | `GET /hospitals/nearby` | `data.hospitals[].fullName` | ~40 bytes/item | SAFE |
| 167 | `GET /hospitals/nearby` | `data.hospitals[].phoneNumber` | ~30 bytes/item | SAFE |
| 168 | `GET /hospitals/nearby` | `data.hospitals[].contactNumber` | ~30 bytes/item | SAFE |
| 169 | `GET /hospitals/nearby` | `data.hospitals[].email` | ~35 bytes/item | SAFE |
| 170 | `GET /hospitals/nearby` | `data.hospitals[].hospitalType` | ~30 bytes/item | SAFE |
| 171 | `GET /hospitals/nearby` | `data.hospitals[].distanceKm` | ~20 bytes/item | SAFE |
| 172 | `GET /hospitals/nearby` | `data.hospitals[].distanceMeters` | ~25 bytes/item | SAFE |
| 173 | `GET /hospitals/nearby` | `data.hospitals[].lat` | ~15 bytes/item | SAFE |
| 174 | `GET /hospitals/nearby` | `data.hospitals[].lng` | ~15 bytes/item | SAFE |
| 175 | `GET /hospitals/nearby` | `data.hospitals[].long` | ~15 bytes/item | SAFE |
| 176 | `GET /hospitals/nearby` | `data.hospitals[].appointmentSchedulingEnabled` | ~40 bytes/item | SAFE |
| 177 | `GET /hospitals/nearby` | `data.hospitals[].hospitalActive` | ~25 bytes/item | SAFE |
| 178 | `GET /hospitals/nearby` | `data.hospitals[].hospitalVerified` | ~28 bytes/item | SAFE |
| 179 | `GET /hospitals/nearby` | `data.pagination.page` | ~12 bytes | SAFE |
| 180 | `GET /hospitals/nearby` | `data.pagination.limit` | ~15 bytes | SAFE |
| 181 | `GET /hospitals/nearby` | `data.pagination.totalPages` | ~22 bytes | SAFE |
| 182 | `GET /hospitals/nearby` | `data.pagination.hasNextPage` | ~24 bytes | SAFE |
| 183 | `GET /hospitals/nearby` | `data.pagination.hasPrevPage` | ~24 bytes | SAFE |
| 184 | `GET /hospitals/nearby` | `data.pagination.currentPage` | ~22 bytes | SAFE |
| 185 | `GET /hospitals/search` | Same as nearby (all dead hospital fields) | Same as above | SAFE |
| 186 | `GET /rewards/badges` | `badges[].progressCurrent` | ~25 bytes/item | SAFE |
| 187 | `GET /rewards/badges` | `badges[].progressTarget` | ~22 bytes/item | SAFE |
| 188 | `GET /rewards/badges` | `badges[].progressPercentage` | ~25 bytes/item | SAFE |
| 189 | `GET /rewards/badges` | `badges[].category` | ~20 bytes/item | SAFE |
| 190 | `GET /rewards/badges` | `badges[].rarity` | ~18 bytes/item | SAFE |
| 191 | `GET /rewards/badges` | `stats.totalDonations` | ~25 bytes | SAFE |
| 192 | `GET /rewards/badges` | `stats.totalEmergencyResponses` | ~35 bytes | SAFE |
| 193 | `GET /rewards/badges` | `stats.daysAsDonor` | ~22 bytes | SAFE |
| 194 | `GET /rewards/badges` | `completionPercentage` | ~25 bytes | SAFE |

---

## LOW RISK — Likely Removable

*These fields are parsed by Flutter but never rendered in the UI. They may be used in state objects for future features or logging.*

| # | Endpoint | Field | Notes | Risk |
|---|----------|-------|-------|------|
| 1 | `POST /auth/signup` | `data.locationRequired` | Stored in state but no UI action | LOW RISK |
| 2 | `POST /auth/login` | `data.access_token` | Overwrites camelCase — create confusion but both values equal | LOW RISK |
| 3 | `POST /auth/login` | `data.refresh_token` | Same as above | LOW RISK |
| 4 | `GET /auth/me` | `data.healthHistory` | In state object but not rendered in profile UI | LOW RISK |
| 5 | `POST /auth/validate-token` | `data.user_role` | Fallback for `data.role` — safe if `role` is always present | LOW RISK |
| 6 | `POST /auth/validate-token` | `data.userId` | Parsed into state, not displayed | LOW RISK |
| 7 | `GET /donor/profile` | `data.healthHistory` | Stored in state but not rendered on profile screen | LOW RISK |
| 8 | `GET /requests/nearby` | `data.requests[].bloodType` (array) | Parsed into model — `bloodTypeLabel` (string) is used for display | LOW RISK |
| 9 | `GET /requests/nearby` | `data.requests[].location` | May be used for map pin in future | LOW RISK |
| 10 | `GET /rewards/points` | `data.tierBenefits` | Parsed but report says not rendered in main UI | LOW RISK |
| 11 | `GET /rewards/points` | `data.progressPercentage` | Parsed but tier progress bar uses `pointsToNextTier` | LOW RISK |
| 12 | `GET /rewards/badges` | `unlockedCount` | In state but not directly displayed | LOW RISK |
| 13 | `GET /rewards/badges` | `totalCount` | In state but not directly displayed | LOW RISK |
| 14 | `GET /donations/book-appointment/my-appointments` | `data.appointments[].cancelledAt` | Status covers the same info | LOW RISK |

---

## Estimated Total Savings

| Endpoint | Approx. Bytes Saved per Request |
|----------|-------------------------------|
| `GET /donor/profile` | **~800–1,200 bytes** (Mongoose doc overhead + internal fields) |
| `GET /auth/me` | **~600–900 bytes** |
| `GET /requests/nearby` (20 items) | **~8,000–15,000 bytes** (dead per-item fields × 20 items) |
| `GET /hospitals/nearby` (20 items) | **~5,000–8,000 bytes** |
| `GET /donations/book-appointment/my-appointments` (10 items) | **~10,000–15,000 bytes** |
| `GET /notifications` (20 items) | **~2,000–3,500 bytes** |
| `GET /rewards/catalog` (6 items) | **~600–900 bytes** |
| `POST /donations/book-appointment` | **~800–1,500 bytes** |
| **Combined per typical session** | **~25–50 KB reduction** |

---

*Audit completed June 2026. Based on `verified_integration_report.md`, live controller analysis, `activity.formatter.js`, `appointment.dto.js`, and `pagination.js`. No code was modified.*
