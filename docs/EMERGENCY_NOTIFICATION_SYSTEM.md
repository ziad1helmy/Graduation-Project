# Emergency Request Notification System

This document summarizes the backend changes made to support interactive emergency request notifications for LifeLink.

## What Changed

The notification flow now sends a rich emergency request payload instead of a simple title/body pair. The payload includes the request snapshot needed by the mobile app to render the notification, open the request details screen, and handle Accept / Decline / View actions.

## Backend Changes

### 1) Emergency payload builder

Added a dedicated helper in `src/utils/emergency-notification.js` that builds:

- `requestId`
- `bloodType`
- `urgency`
- `hospitalName`
- `location`
- `distance`
- `distanceKm`
- `unitsNeeded`
- `requiredBy`
- `requestStatus`
- `createdAt`
- localization keys for title/body
- action metadata for `accept`, `decline`, and `view`
- FSM state markers for the client

### 2) FCM enhancements

Updated `src/utils/fcm.js` so push notifications can carry platform-specific metadata:

- localization keys via `title_loc_key` and `body_loc_key`
- Android notification channel id
- click action metadata
- APNs category for iOS

This keeps the push payload compatible with Flutter local notification handling.

### 3) Emergency request broadcasting

Updated `src/controllers/hospital.controller.js` so emergency requests trigger donor notifications immediately after creation.

Flow:

1. Hospital creates a request.
2. Emergency requests are detected by `isEmergency` or `critical` urgency.
3. Compatible donors are resolved.
4. `notificationService.notifyRequest()` creates in-app notifications and sends FCM pushes.

### 4) Notification service

Updated `src/services/notification.service.js` to:

- store rich emergency payload data in the `Notification` model
- send flattened FCM-safe payloads to devices
- preserve the same notification contract for the app and notification list screen

### 5) Notification detail route

Added `GET /notifications/:id` in `src/routes/notification.routes.js` so the client can fetch a single notification and display request details.

## Payload Contract

Emergency push notifications now follow this shape conceptually:

```json
{
  "notification": {
    "title": "Emergency Blood Request",
    "body": "Critical O+ blood needed near El Salam Hospital"
  },
  "data": {
    "type": "emergency_request",
    "requestId": "67e9321",
    "bloodType": "O+",
    "urgency": "critical",
    "hospitalName": "El Salam Hospital",
    "location": "Shibin El-Kom",
    "distance": "3 km",
    "unitsNeeded": "2",
    "requiredBy": "2026-05-20T15:00:00Z",
    "requestStatus": "pending",
    "createdAt": "2026-05-15T10:00:00Z",
    "title_loc_key": "emergency_request_title",
    "body_loc_key": "emergency_request_body",
    "actionIds": "[\"accept\",\"decline\",\"view\"]"
  }
}
```

## Action Behavior

The client is expected to handle these action ids:

- `accept` → call the accept request API
- `decline` → call the decline request API
- `view` → navigate to the request details screen

The notification body tap should also navigate to the request details screen.

## Notification Screen Impact

The notification list can now render emergency items with:

- blood type
- hospital name
- urgency badge
- distance
- units needed
- timestamp

## Validation

The following tests were run successfully after the change:

- `tests/unit/notification.service.test.js`
- `tests/integration/notifications.integration.test.js`

## Client Integration Note

Flutter code is not present in this workspace, so the mobile UI, Bloc, repository, and local notification action handling were not modified here. The backend payload and routes are now in place for the Flutter app to consume.
