# LifeLink — Notification Message Audit

> Scope: every `Notification.create` call and `sendToMultiple*` FCM push found inside the notification system, reward service, appointment service, request controller, request-lifecycle service, admin service, and missed-donation utility.
> Excluded: validation messages, API responses, error messages, logs.

---

## 1. Match Notification — Hospital

| Field | Value |
|---|---|
| **Key** | `MATCH_HOSPITAL` |
| **Title** | `New Donor Matched` |
| **Body** | `A donor has matched your {bloodType} blood request` _(blood type is dynamic)_ |
| **Trigger** | A donor matches a hospital's request (`notifyMatch`) |
| **Type** | `match` (in-app) + FCM push (channel: `donation_matches`) |
| **Source** | [`notification.service.js` → `notifyMatch`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/notification.service.js#L27-L93) |
| **FCM Push Title** | `New Donor Matched` |
| **FCM Push Body** | _(same as in-app body)_ |

---

## 2. Emergency / Request Notification — Donors

| Field | Value |
|---|---|
| **Key (EN)** | `EMERGENCY_REQUEST_EN` |
| **Title (EN)** | `🚨 Emergency Blood Request` |
| **Body (EN)** | `Critical {bloodType} blood needed near {hospitalName}` |
| **Key (AR)** | `EMERGENCY_REQUEST_AR` |
| **Title (AR)** | `🚨 طلب دم طارئ` |
| **Body (AR)** | `مطلوب دم {bloodType} بشكل عاجل بالقرب من {hospitalName}` |
| **loc_key (title)** | `emergency_request_title` |
| **loc_key (body)** | `emergency_request_body` |
| **Trigger** | New blood/plasma request broadcast to compatible nearby donors (`notifyRequest`) |
| **Type** | `emergency` or `request` (in-app) + FCM push (channel: `emergency_requests`) |
| **Source** | [`emergency-notification.js` → `buildEmergencyRequestNotificationContent`](file:///Users/mohamedyaser/Documents/LifeLink/src/utils/emergency-notification.js#L120-L138) · [`notification.service.js` → `notifyRequest`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/notification.service.js#L102-L218) |

---

## 3. Milestone / Achievement Notification — Donor

| Field | Value |
|---|---|
| **Key** | `MILESTONE_ACHIEVEMENT` |
| **Title** | `Achievement Unlocked: {achievement.title}` |
| **Body** | `Congratulations! You've unlocked: {achievement.title}` _(falls back to `achievement.message` if provided)_ |
| **Trigger** | Milestone event emitted (e.g., every 5th donation); called via `notifyMilestone` |
| **Type** | `milestone` (in-app only) |
| **Source** | [`notification.service.js` → `notifyMilestone`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/notification.service.js#L226-L249) |

---

## 4. Tier Upgrade Notification — Donor

| Field | Value |
|---|---|
| **Key** | `TIER_UPGRADE` |
| **Title** | `🎉 Tier Upgraded to {newTier}!` |
| **Body** | `Congratulations! You've reached {newTier} tier. Keep donating to unlock more rewards!` |
| **Trigger** | Donor's lifetime points cross a tier threshold (e.g., Bronze → Silver → Gold → Platinum) |
| **Type** | `system` (in-app only, fire-and-forget) |
| **Source** | [`reward.service.js` → `awardPoints`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/reward.service.js#L234-L239) |

---

## 5. Badge Unlocked Notification — Donor

| Field | Value |
|---|---|
| **Key** | `BADGE_UNLOCKED` |
| **Title** | `🏆 Badge Unlocked: {badge.badgeName}` |
| **Body** | `{badge.badgeDescription}` |
| **Trigger** | Donor unlocks a badge (checked after every point award) |
| **Type** | `system` (in-app only, fire-and-forget) |
| **Source** | [`reward.service.js` → `checkAndUnlockBadges`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/reward.service.js#L427-L433) |

---

## 6. Reward Redeemed Notification — Donor

| Field | Value |
|---|---|
| **Key** | `REWARD_REDEEMED` |
| **Title** | _(value of `ACTIVITY_TITLE_MAP.redeemed_reward_notification` constant)_ |
| **Body** | `Your {reward.name} is confirmed. Code: {confirmationCode}` |
| **Trigger** | Donor successfully redeems a reward from the catalog |
| **Type** | `system` (in-app only, fire-and-forget) |
| **Source** | [`reward.service.js` → `redeemReward`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/reward.service.js#L691-L696) |

---

## 7. Appointment Rescheduled — Donor

| Field | Value |
|---|---|
| **Key** | `APPOINTMENT_RESCHEDULED_DONOR` |
| **Title** | `Appointment Rescheduled` |
| **Body** | `Your appointment was moved from {oldDate} to {newDate}.[Reason: {reason}]` |
| **Trigger** | Donor or hospital reschedules an existing appointment |
| **Type** | `appointment` (in-app only) |
| **Source** | [`appointment.service.js` → `notifyAppointmentReschedule`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/appointment.service.js#L394-L438) |

---

## 8. Appointment Rescheduled — Hospital

| Field | Value |
|---|---|
| **Key** | `APPOINTMENT_RESCHEDULED_HOSPITAL` |
| **Title** | `Donor Rescheduled Appointment` |
| **Body** | `A donor moved an appointment from {oldDate} to {newDate}.[Reason: {reason}]` |
| **Trigger** | Same reschedule event as above — sent to the hospital side |
| **Type** | `appointment` (in-app only) |
| **Source** | [`appointment.service.js` → `notifyAppointmentReschedule`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/appointment.service.js#L418-L437) |

---

## 9. New Appointment Booked — Hospital

| Field | Value |
|---|---|
| **Key** | `APPOINTMENT_BOOKED_HOSPITAL` |
| **Title** | `New Appointment Booked` |
| **Body** | `A donor has booked an appointment for {date}` |
| **Trigger** | Donor books a new appointment at a hospital |
| **Type** | `system` (in-app only, fire-and-forget) |
| **Source** | [`appointment.service.js` → `bookAppointment`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/appointment.service.js#L711-L721) |

---

## 10. Appointment Cancelled by Donor — Hospital

| Field | Value |
|---|---|
| **Key** | `APPOINTMENT_CANCELLED_HOSPITAL` |
| **Title** | `Appointment cancelled by donor` |
| **Body** | `{donorName} cancelled their appointment on {date}` |
| **Trigger** | Donor cancels an upcoming appointment |
| **Type** | `appointment` (in-app only, fire-and-forget) |
| **Source** | [`appointment.service.js` → `cancelAppointment`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/appointment.service.js#L791-L807) |

---

## 11. Donor Accepts Request — Hospital (In-app)

| Field | Value |
|---|---|
| **Key (partial)** | `REQUEST_DONOR_RESPONSE_HOSPITAL` |
| **Title (partial)** | `New donor response` |
| **Body (partial)** | `{donorName} pledged {n} unit(s) for {bloodType}. {remaining} more needed.` |
| **Title (fully fulfilled)** | `Request fully accepted` |
| **Body (fully fulfilled)** | `{donorName} accepted the final unit for {bloodType}. Request fully fulfilled.` |
| **Trigger** | A donor accepts a blood/plasma request |
| **Type** | `emergency` or `request` (in-app only) |
| **Source** | [`request.controller.js` → `sendAcceptNotifications`](file:///Users/mohamedyaser/Documents/LifeLink/src/controllers/request.controller.js#L571-L588) |

---

## 12. Donor Accepts Request — Donor (In-app)

| Field | Value |
|---|---|
| **Key** | `DONATION_CONFIRMED_DONOR` |
| **Title** | `Donation Confirmed` |
| **Body** | `You've been assigned to {hospitalName} for {bloodType}. Arrive by {deadline}. Open the request to view your QR code.` |
| **Trigger** | Donor successfully accepts a request |
| **Type** | `request` (in-app only) |
| **Source** | [`request.controller.js` → `sendAcceptNotifications`](file:///Users/mohamedyaser/Documents/LifeLink/src/controllers/request.controller.js#L590-L606) |

---

## 13. Donor Accepts Request — Donor (FCM Push)

| Field | Value |
|---|---|
| **Key** | `DONATION_CONFIRMED_DONOR_PUSH` |
| **FCM Title** | `Proceed to Hospital` |
| **FCM Body** | `{hospitalName} — arrive by {deadline}. Show your QR code on arrival.` |
| **Trigger** | Same accept event — push sent immediately after in-app record |
| **Channel** | `request_updates` |
| **Source** | [`request.controller.js` → `sendAcceptNotifications`](file:///Users/mohamedyaser/Documents/LifeLink/src/controllers/request.controller.js#L613-L628) |

---

## 14. Donor Accepts Request — Hospital (FCM Push)

| Field | Value |
|---|---|
| **Key (partial)** | `REQUEST_DONOR_RESPONSE_HOSPITAL_PUSH` |
| **FCM Title (partial)** | `New Donor Pledged` |
| **FCM Body (partial)** | `{donorName} pledged {n} unit(s) for {bloodType}. {remaining} more needed.` |
| **FCM Title (fulfilled)** | `Request Fully Accepted` |
| **FCM Body (fulfilled)** | `{donorName} accepted the final unit for {bloodType}. All donors — scan their QR codes on arrival.` |
| **Trigger** | Same accept event |
| **Channel** | `request_updates` |
| **Source** | [`request.controller.js` → `sendAcceptNotifications`](file:///Users/mohamedyaser/Documents/LifeLink/src/controllers/request.controller.js#L631-L657) |

---

## 15. Request Reopened (Slot Available) — Donors

| Field | Value |
|---|---|
| **Key** | `REQUEST_REOPENED` |
| **Title** | `Request reopened` |
| **Body** | `A donation slot has opened up for {patientType} at {hospitalName}.` |
| **Trigger** | A donor cancels their accepted donation; request re-broadcasts to compatible donors |
| **Type** | `emergency` or `request` (in-app only, fire-and-forget) |
| **Source** | [`request.controller.js` → `cancelRequest`](file:///Users/mohamedyaser/Documents/LifeLink/src/controllers/request.controller.js#L796-L806) |

---

## 16. Donation Confirmed by Hospital — Donor

| Field | Value |
|---|---|
| **Key** | `DONATION_CONFIRMED_BY_HOSPITAL` |
| **Title** | `Donation confirmed` |
| **Body** | `Your donation for {bloodType / patientType} has been confirmed by the hospital.` |
| **Trigger** | Hospital scans donor's QR code and confirms the donation |
| **Type** | `request` (in-app only) |
| **Source** | [`request.controller.js` → `confirmDonation`](file:///Users/mohamedyaser/Documents/LifeLink/src/controllers/request.controller.js#L1037-L1050) |

---

## 17. Request Cancelled / Rejected — Donor

| Field | Value |
|---|---|
| **Key** | `REQUEST_CANCELLED_REJECTED_DONOR` |
| **Title** | `Request cancelled` or `Request rejected` _(conditional on `donationStatus`)_ |
| **Body** | `Your accepted donation request was cancelled.` / `Your accepted donation request was rejected by the hospital.` _(or custom `reason` string)_ |
| **Trigger** | Hospital rejects or cancels a donation that a donor had already accepted |
| **Type** | `request` (in-app only) |
| **Source** | [`request-lifecycle.service.js` → `rejectDonationLifecycle`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/request-lifecycle.service.js#L237-L254) |

---

## 18. Missed Donation Warning — Donor

| Field | Value |
|---|---|
| **Key** | `MISSED_DONATION_WARNING` |
| **Title** | `Missed Donation Warning` |
| **Body** | `You have {n} missed donation(s). After {remaining} more, your account will be suspended.` |
| **Trigger** | Donor misses a donation (count = 1 or 2 out of 3 threshold) |
| **Type** | `system` (in-app only) |
| **Source** | [`missed-donation.js` → `trackMissedDonation`](file:///Users/mohamedyaser/Documents/LifeLink/src/utils/missed-donation.js#L54-L62) |

---

## 19. Account Suspended — Donor

| Field | Value |
|---|---|
| **Key** | `ACCOUNT_SUSPENDED` |
| **Title** | `Account Suspended` |
| **Body** | `Your account has been suspended due to 3 missed donations. Please contact support to reactivate.` |
| **Trigger** | Donor misses a 3rd donation (`missedDonationCount >= MISSED_DONATION_THRESHOLD`) |
| **Type** | `system` (in-app only) |
| **Source** | [`missed-donation.js` → `trackMissedDonation`](file:///Users/mohamedyaser/Documents/LifeLink/src/utils/missed-donation.js#L44-L52) |

---

## 20. Support Reply Received — User (Push + In-app)

| Field | Value |
|---|---|
| **Key** | `SUPPORT_REPLY` |
| **Title** | `Support Reply Received` |
| **Body** | `Your support request "{ticket.subject}" has been answered.` |
| **Trigger** | Admin replies to a support ticket |
| **Type** | `admin` (in-app) + FCM push (channel: `support_replies`) |
| **Source** | [`admin.service.js` → `replySupportMessage`](file:///Users/mohamedyaser/Documents/LifeLink/src/services/admin.service.js#L1449-L1485) |

---

## Summary Table

| # | Key | Recipient | Channel | Trigger |
|---|---|---|---|---|
| 1 | `MATCH_HOSPITAL` | Hospital | In-app + FCM | Donor matched to request |
| 2 | `EMERGENCY_REQUEST_EN/AR` | Donors (batch) | In-app + FCM | New emergency/blood request broadcast |
| 3 | `MILESTONE_ACHIEVEMENT` | Donor | In-app | Milestone event (e.g., 5th donation) |
| 4 | `TIER_UPGRADE` | Donor | In-app | Tier promotion |
| 5 | `BADGE_UNLOCKED` | Donor | In-app | Badge criteria met |
| 6 | `REWARD_REDEEMED` | Donor | In-app | Reward redeemed successfully |
| 7 | `APPOINTMENT_RESCHEDULED_DONOR` | Donor | In-app | Appointment rescheduled |
| 8 | `APPOINTMENT_RESCHEDULED_HOSPITAL` | Hospital | In-app | Appointment rescheduled |
| 9 | `APPOINTMENT_BOOKED_HOSPITAL` | Hospital | In-app | New appointment booked |
| 10 | `APPOINTMENT_CANCELLED_HOSPITAL` | Hospital | In-app | Donor cancels appointment |
| 11 | `REQUEST_DONOR_RESPONSE_HOSPITAL` | Hospital | In-app | Donor accepts request |
| 12 | `DONATION_CONFIRMED_DONOR` | Donor | In-app | Donor accepts request |
| 13 | `DONATION_CONFIRMED_DONOR_PUSH` | Donor | FCM | Donor accepts request |
| 14 | `REQUEST_DONOR_RESPONSE_HOSPITAL_PUSH` | Hospital | FCM | Donor accepts request |
| 15 | `REQUEST_REOPENED` | Donors (batch) | In-app | Donor cancels → slot reopens |
| 16 | `DONATION_CONFIRMED_BY_HOSPITAL` | Donor | In-app | Hospital scans QR & confirms |
| 17 | `REQUEST_CANCELLED_REJECTED_DONOR` | Donor | In-app | Hospital cancels/rejects donation |
| 18 | `MISSED_DONATION_WARNING` | Donor | In-app | 1st or 2nd missed donation |
| 19 | `ACCOUNT_SUSPENDED` | Donor | In-app | 3rd missed donation |
| 20 | `SUPPORT_REPLY` | User | In-app + FCM | Admin replies to support ticket |
