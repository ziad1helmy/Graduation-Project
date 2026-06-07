# Flutter Expected Responses vs Backend Coverage Report

Audit source: `flutter_expected_responses.md` compared against backend routes/controllers/services under `src/`.

## Summary

Flutter lists **41 expected response contracts**.

* **24 endpoints are fully or functionally covered** by the backend.
* **15 endpoints are implemented but need response-shape additions or alias fields** for exact Flutter compatibility.
* **2 endpoints are external chatbot services** and are not owned by this backend.

The backend already uses a consistent envelope from `src/utils/response.js`:

```json
{ "success": true, "message": "...", "data": ... }
```

That helps most contracts. Remaining gaps are mostly field projection/alias problems, not missing business logic.

## Fully Covered

These endpoints exist and their backend response is aligned with the Flutter expected shape or contains the expected fields plus harmless extras.

| Endpoint | Backend evidence | Coverage |
| --- | --- | --- |
| `GET /rewards/badges` | `reward.routes.js`, `reward.controller.getBadges`, `reward.service.getDonorBadges` | Full |
| `POST /rewards/catalog/:rewardId/redeem` | `reward.controller.redeemReward`, `reward.service.redeemReward` | Full |
| `GET /rewards/points` | `reward.controller.getPoints`, `reward.service.getPointsSummary` | Full |
| `GET /rewards/points/history` | `reward.controller.getPointsHistory`, `reward.service.getPointsHistory` | Full |
| `GET /rewards/earning-rules` | `reward.controller.getEarningRules`, `reward.service.getEarningRules` | Full; backend returns extra rule rows/category |
| `GET /donor/settings` | `donor.controller.getSettings` | Full |
| `PUT /donor/settings` | `donor.controller.updateSettings` | Full |
| `POST /auth/fcm-token` | `auth.controller.registerFcmToken`, `auth.service.registerFcmToken` | Full |
| `PATCH /notifications/read-all` | `notification.controller.markAllNotificationsRead` | Full |
| `DELETE /notifications` | `notification.controller.deleteAllNotifications` | Full |
| `POST /donor/respond/:requestId` | `donor.controller.respondToRequest` | Full |
| `GET /donor/stats` | `donor.controller.getDonorStats` | Full |
| `GET /donor/activity` | `activity.controller.getTimeline` | Full |
| `GET /donor/donation-eligibility` | `donor.controller.getDonationEligibility` | Full |
| `POST /auth/change-password` | `auth.controller.changePassword` | Full |
| `GET /donor/history` | `donor.controller.getDonationHistory` | Full |
| `DELETE /donations/book-appointment/:appointmentId` | `appointment.controller.cancelAppointment`, `appointment.service.cancelAppointment` | Full |
| `GET /hospitals/nearby` | `discovery.controller.getNearbyHospitals` | Full |
| `GET /hospitals/search` | `discovery.controller.searchHospitals` | Full |
| `POST /auth/verify-email` | `auth.controller.verifyEmail` | Full |
| `POST /auth/verify-email-otp` | `auth.controller.verifyEmailOtp` | Full |
| `POST /auth/forgot-password` | `auth.controller.forgotPassword` | Full |
| `POST /auth/reset-password` | `auth.controller.resetPassword` | Full |
| `POST /auth/logout` | `auth.controller.logout` | Full, message/data text is `Logged out successfully` rather than Flutter example `Logout successful` |

## Needs Additions

### `GET /rewards/catalog`

Backend covers the endpoint, but `reward.controller.getRewards` applies a donor projection that removes fields Flutter expects in `RewardsModel`:

* removed by backend for donor: `__v`, `createdAt`, `updatedAt`, `status`, `dailyLimit`, `monthlyLimit`, `redemptionCount`
* expected by Flutter example: all of the above

Recommended backend addition: stop excluding these fields for donor catalog responses, or add a Flutter DTO that includes them with safe values.

### `GET /donor/profile`

Backend returns the profile and computed `stats`/`badgeProgress`, but `donor.controller.getProfile` projection removes several Flutter-expected fields:

* `_id` is covered.
* `id` alias is not explicitly added.
* `currentBadge`, `nextBadge`, `progressPercentage` are calculated but only nested inside `badgeProgress`; Flutter also expects them at top level.
* `availableToDonate` is expected by Flutter but backend does not add it.
* projection removes fields shown in Flutter examples such as `__v`, `createdAt`, `updatedAt`, `emailVerifiedAt`, `fcmTokens`, `travelHistory`, `hemoglobinLevel`, `isBanned`, `isVerified`, `isOptedIn`.

Recommended backend addition: build a donor profile DTO that explicitly includes `id`, top-level badge fields, `availableToDonate`, and any fields the Flutter model parses.

### `PUT /donor/profile`

Backend updates and returns the raw donor document minus `password`. It does not add the computed fields Flutter expects from the edit profile model:

* missing computed `age`, `stats`, `badgeProgress`
* missing top-level `currentBadge`, `nextBadge`, `progressPercentage`
* may include raw DB fields, but not the same normalized DTO as `GET /donor/profile`

Recommended backend addition: reuse the same profile DTO from `GET /donor/profile` after saving.

### `GET /notifications`

Backend works, but for donor role `notification.controller.getNotifications` projects out fields Flutter expects:

* backend donor projection removes `relatedId`, `relatedType`, `updatedAt`, `__v`
* Flutter notification model expects `relatedId`, `relatedType`, `updatedAt`

Recommended backend addition: keep `relatedId`, `relatedType`, and `updatedAt` for donor notification responses.

### `GET /requests/nearby`

Backend covers the endpoint, but donor responses intentionally remove some fields that the Flutter example includes:

* removed for donor by `buildRequestPayload`: `locationHospital`, `requestStatus`, `distanceKm`, `distanceMeters`
* backend donor pagination is reduced to `{ page, hasNextPage }`; Flutter expects `total`, `page/currentPage`, `limit`, `totalPages`, `hasNextPage`, `hasPrevPage`
* backend does not include `viewerLocation`/`radiusKm` for donor responses

Recommended backend addition: for the Flutter donor home API, return the full request DTO and full pagination object.

### `POST /requests/:requestId/cancel` and `GET /requests/:requestId`

The backend route is implemented as `:id`, not `:requestId`:

```js
router.get('/:id', requestController.getRequestDetails);
router.post('/:id/cancel', requestController.cancelRequest);
```

That is route-compatible if Flutter sends `/requests/<actual-id>`, but the controller only reads `req.params.id`.

Additional response mismatch:

* Flutter says `GET /requests/:requestId` is parsed as a root entity without envelope.
* Backend returns the standard envelope `{ success, message, data }`.

Recommended action: either update Flutter to read `response.data.data`, or add a compatibility endpoint/flag only if Flutter cannot be changed.

### Appointment Endpoints

`GET /donations/book-appointment/available-slots` is implemented, but donor DTO trimming removes capacity metadata:

* backend service produces `remainingCapacity`, `maxCapacity`, `hospitalId`, `date`, `slotsPerHour`
* `toAvailableSlotsResponse(..., { role: 'donor' })` returns only `time` and `available`
* Flutter expects the richer capacity payload

`GET /donations/book-appointment/my-appointments` is implemented, but donor projection removes fields Flutter expects:

* backend projection removes `donorId`, `createdAt`, `updatedAt`, `notes`, `requestId`, `qrExpiresAt`, `verificationStatus`, `verificationChecklist`, `rescheduleCount`, `donorDetails`, `rescheduleHistory`
* Flutter expects many raw appointment fields and a populated `hospitalId`

`POST /donations/book-appointment` is mostly covered because the create path returns the full appointment DTO. Keep it as-is unless Flutter needs the exact raw model names only.

Recommended backend addition: remove donor trimming for appointment responses used by Flutter, or create a Flutter-specific appointment DTO preserving the expected fields.

### Auth Endpoints

`POST /auth/signup` is implemented, but backend sanitizes the user object. Flutter’s generated model expects many raw user fields:

* backend deliberately strips sensitive/internal fields such as `password`, OTP hashes, and some metadata
* this is good security behavior, but the Flutter model should not require those sensitive fields

Recommended action: prefer updating Flutter model expectations to not require password/OTP/internal fields. Do not add password or OTP hashes back to API responses.

`POST /auth/login` is implemented, but backend omits some Flutter alias fields:

* backend includes `accessToken`, `refreshToken`, `access_token`, `refresh_token`, `verified`, `user`
* missing aliases: `userId`, `user_id`, `userRole`, `user_role`, `userName`, `user_name`

Recommended backend addition: add these aliases in `auth.controller.loginUser`.

`POST /auth/admin/login` is implemented, but backend returns `admin`, not Flutter’s expected `user`:

* backend data shape: `{ accessToken, refreshToken, admin, access_token, refresh_token }`
* Flutter expected shape: `{ accessToken, refreshToken, user }`

Recommended backend addition: add `user: result.admin` while keeping `admin` for backward compatibility.

`GET /auth/me` is implemented, but the donor projection removes several Flutter-expected fields and the message differs:

* backend message: `User retrieved`
* Flutter example message: `Current user fetched successfully`
* projection removes fields such as `createdAt`, `updatedAt`, `emailVerifiedAt`, `fcmTokens`, `hemoglobinLevel`, `travelHistory`, `isOptedIn`, `isBanned`, `isVerified`

Recommended backend addition: use the same safe donor profile DTO as `GET /donor/profile`, or adjust Flutter model to accept the safe minimal auth user object.

`POST /auth/validate-token` is implemented, but `src/utils/auth.dto.js` omits `user_id`:

* covered: `is_valid`, `user_role`, `role`, `userId`
* missing: `user_id`

Recommended backend addition: add `user_id: reqUser.userId`.

`POST /auth/refresh-token` is implemented, but backend returns only nested `data.accessToken`:

* Flutter interceptor expects top-level `accessToken`, top-level `refreshToken`, and nested `data.accessToken`/`data.refreshToken`
* backend service only issues a new access token and controller wraps it under `data`

Recommended backend addition: include top-level token aliases in the controller response, and either return/rotate `refreshToken` or make the Flutter interceptor tolerant of access-token-only refresh responses.

## External / Not Backend-Owned

These are not implemented in this repository and are expected to be served by the external chatbot service:

| Endpoint | Status |
| --- | --- |
| `POST https://donation-chatbot-1fie.onrender.com/ask` | External |
| `POST https://donation-chatbot-1fie.onrender.com/chat` | External SSE stream |

## Highest Priority Fixes

1. Add auth alias fields: login `userId/user_id/userRole/user_role/userName/user_name`, validate-token `user_id`, admin-login `user`.
2. Fix refresh-token shape for the Flutter interceptor.
3. Stop trimming donor appointment fields that Flutter models expect.
4. Stop trimming donor notification/request fields that Flutter screens expect.
5. Reuse one donor profile DTO for `GET /donor/profile`, `PUT /donor/profile`, and possibly `GET /auth/me`.
6. Do not expose sensitive signup fields; update Flutter model expectations instead.
