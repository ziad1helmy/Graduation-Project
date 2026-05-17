# LifeLink Notification System

---

## Architecture Overview

LifeLink delivers notifications through **two channels simultaneously**:

1. **In-App Notifications** — persisted in MongoDB `notifications` collection, polled by the client
2. **FCM Push Notifications** — delivered via Firebase Cloud Messaging to registered device tokens

Both channels are orchestrated by `src/services/notification.service.js`, which calls `src/utils/fcm.js` for Firebase delivery.

---

## Notification Types

| Type | Description | Trigger |
|------|-------------|---------|
| `match` | Compatible request found for donor | Request broadcast / new request matching donor |
| `emergency` | Critical blood shortage alert | Admin emergency broadcast |
| `appointment` | Appointment status update | Appointment confirmed/cancelled |
| `reward` | Points awarded / badge unlocked | Donation completion |
| `system` | System-level messages | Maintenance, announcements |

---

## Notification Document Schema

```javascript
// Notification model (notifications collection)
{
  userId: ObjectId,         // Reference to User
  type: String,             // enum: match, emergency, appointment, reward, system
  title: String,
  body: String,
  data: Mixed,              // Additional payload (requestId, donationId, etc.)
  isRead: Boolean,          // Default: false
  readAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:
- `userId + isRead` — for unread count and inbox queries
- `createdAt` — for chronological sorting

---

## Key Service Functions

### `broadcastRequest(requestId, adminId?)`

Called automatically when a new request is created, and manually via admin broadcast endpoint.

```
1. Load request + hospital data
2. matchingService.findCompatibleDonors(request)
   → Blood-type compatibility filter
   → Geo-distance scoring
   → Eligibility pre-check per donor
3. For each compatible+eligible donor:
   → Create Notification document (type: 'match')
   → Collect donor's fcmTokens
4. fcm.sendToMultiple(allTokens, {
     title: 'New Blood Request',
     body: '...',
     data: { requestId, type: 'match' }
   })
5. Return { notifiedCount, matchCount }
```

**Current behavior**: This function is `await`ed synchronously in the request creation flow.

### `notifyMatch(hospitalId, donation, request)`

Called when a donor responds to a request.

```
1. Create Notification for hospital (type: 'match')
2. Fetch hospital's fcmTokens
3. fcm.sendToMultiple(hospitalTokens, { ... })
```

### `sendEmergencyBroadcast(bloodType, message, adminId)`

Sends emergency alert to all donors with matching or compatible blood types.

```
1. Find all eligible donors by blood type compatibility
2. Create Notification for each donor (type: 'emergency')
3. fcm.sendToMultiple(allTokens, { priority: 'high', ... })
4. Log audit
```

### `notifyAppointmentStatus(donorId, appointment, status)`

Sends appointment confirmation or cancellation notification.

```
1. Create Notification for donor (type: 'appointment')
2. fcm.sendToOne(donorFcmTokens, { ... })
```

---

## FCM Utility (`src/utils/fcm.js`)

### `sendToMultiple(tokens, payload)`

Handles batch FCM delivery with automatic chunking and token cleanup.

```
Input:
  tokens: string[]  — all FCM tokens to deliver to
  payload: { title, body, data, priority }

Process:
1. Deduplicate and validate tokens
2. Chunk into batches of 500 (Firebase multicast limit)
3. For each batch:
   a. firebase.messaging().sendEachForMulticast({ tokens: batch, ... })
   b. Process responses:
      → success: track count
      → UNREGISTERED / INVALID_ARGUMENT: collect for cleanup
4. cleanupInvalidTokens(invalidTokens)
   → User.updateMany({ $pull: { fcmTokens: { $in: invalidTokens } } })

Output: { successCount, failureCount, invalidTokensRemoved }
```

### `sendToOne(tokens, payload)`

Thin wrapper over `sendToMultiple` for single-target sends.

### Invalid Token Cleanup

When Firebase returns `UNREGISTERED` or `INVALID_ARGUMENT` error codes, the tokens are collected and removed from all user documents in a single `updateMany` operation. This keeps the FCM token store clean automatically.

---

## Donor Notification Preferences

Donors can configure notification settings:

```javascript
donor.settings = {
  pushNotifications: Boolean,  // default: true
  emergencyAlerts: Boolean,    // default: true
  language: 'en' | 'ar',      // default: 'en'
}
```

The `notification.service.js` checks these flags before including a donor in broadcast operations:
- If `pushNotifications = false` → donor receives in-app notification but no FCM push
- If `emergencyAlerts = false` → donor excluded from emergency broadcast

---

## In-App Notification Inbox (REST API)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/notifications` | GET | List notifications (paginated) |
| `/notifications/unread-count` | GET | Count unread notifications |
| `/notifications/:id/read` | PATCH | Mark one as read |
| `/notifications/read-all` | PATCH | Mark all as read |
| `/notifications/:id` | DELETE | Delete one notification |

---

## Known Limitations & Risks

### 1. Synchronous FCM Calls (Critical)

All FCM calls are `await`ed within the HTTP request lifecycle:

```javascript
// notification.service.js — blocks request until FCM responds
await fcm.sendToMultiple(tokens, payload);
```

**Risk**: If Firebase API latency spikes to 3-10 seconds (possible under load or network issues), every API call that triggers notifications is blocked for that duration.

**Recommended fix**: Move FCM delivery to a background job queue:
```javascript
// Immediate response to client
await notificationQueue.add('broadcast', { requestId, donorIds });
// Worker processes asynchronously
```

### 2. No Delivery Confirmation

FCM delivery is fire-and-forget at the platform level. There is no mechanism to:
- Retry failed deliveries
- Track delivery receipts
- Notify admin of failed emergency broadcasts

### 3. Hospital Push Notifications

The FCM system is primarily donor-focused. Hospitals receive push notifications only if they have `fcmTokens` stored. The hospital mobile app (if any) must register FCM tokens the same way donors do.

### 4. No Rate Limiting on Broadcasts

There is no per-donor rate limit on notification delivery. If admin triggers multiple broadcasts rapidly (e.g., duplicate button clicks), donors may receive multiple identical notifications.
