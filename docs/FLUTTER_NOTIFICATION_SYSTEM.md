# Flutter Notification System Integration

This guide explains how Flutter should connect to the backend notification system using our REST endpoints.

## Overview

The server exposes notification inbox endpoints under `/notifications`. The mobile client should use these endpoints to:

- fetch the notification inbox
- read a notification
- mark all notifications as read
- delete a notification
- delete all notifications

Notifications are stored in-app and also delivered as FCM push notifications. This document covers only the REST API integration.

## Authentication

All notification endpoints require a valid bearer JWT token in the `Authorization` header.

Header example:

```http
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

## Base URL

Use the configured backend base URL for your environment.

Example:

```dart
const baseUrl = 'https://graduation-project-cy61.onrender.com';
```

## Endpoints

### 1. Get notification inbox

- Method: `GET`
- Path: `/notifications`
- Description: Fetches the current user's notifications with pagination.

Query parameters:

- `page`: integer, default `1`
- `limit`: integer, default `20`
- `read`: boolean, optional
- `type`: string, optional

Example request:

```http
GET /notifications?page=1&limit=20&read=false HTTP/1.1
Authorization: Bearer <ACCESS_TOKEN>
```

Example response:

```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "_id": "69fe540565ff7785a0313170",
        "userId": "69f3df915f42685cbbbcbb18",
        "type": "emergency",
        "title": "Emergency blood request near you",
        "message": "A hospital near you needs O+ blood for an urgent request. Tap to view details.",
        "read": false,
        "relatedId": "69fe540565ff7785a031314f",
        "relatedType": "Request",
        "data": {
          "requestId": "69fe540565ff7785a031314f",
          "hospitalName": "Cairo Care Hospital",
          "requestType": "blood"
        },
        "createdAt": "2026-05-16T13:24:00.000Z",
        "updatedAt": "2026-05-16T13:24:00.000Z"
      }
    ],
    "unreadCount": 3,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "pages": 3
    }
  }
}
```

Notes:

- `unreadCount` is returned inside the `/notifications` response.
- Use `read` query parameter to filter by read/unread state.
- `type` can be used if you want to request specific notification categories.

### 2. Mark a notification as read

- Method: `PATCH`
- Path: `/notifications/{id}/read`

Example request:

```http
PATCH /notifications/69fe540565ff7785a0313170/read HTTP/1.1
Authorization: Bearer <ACCESS_TOKEN>
```

Example response:

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "notification": {
      "_id": "69fe540565ff7785a0313170",
      "userId": "69f3df915f42685cbbbcbb18",
      "type": "emergency",
      "title": "Emergency blood request near you",
      "message": "A hospital near you needs O+ blood for an urgent request. Tap to view details.",
      "read": true,
      "relatedId": "69fe540565ff7785a031314f",
      "relatedType": "Request",
      "data": {
        "requestId": "69fe540565ff7785a031314f",
        "hospitalName": "Cairo Care Hospital",
        "requestType": "blood"
      },
      "createdAt": "2026-05-16T13:24:00.000Z",
      "updatedAt": "2026-05-16T13:24:00.000Z"
    }
  }
}
```

### 3. Mark all notifications as read

- Method: `PATCH`
- Path: `/notifications/read-all`

Example response:

```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "modifiedCount": 12
  }
}
```

### 4. Delete one notification

- Method: `DELETE`
- Path: `/notifications/{id}`

Example response:

```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

### 5. Delete all notifications

- Method: `DELETE`
- Path: `/notifications`

Example response:

```json
{
  "success": true,
  "message": "All notifications deleted successfully",
  "data": {
    "deletedCount": 5
  }
}
```

## Notification object fields

Use these fields to render the inbox and handle deep links:

- `_id`: notification ID
- `userId`: owner user ID
- `type`: notification category (`emergency`, `request`, `match`, `milestone`, etc.)
- `title`: notification title
- `message`: notification body text
- `read`: boolean read state
- `relatedId`: ID of the related resource
- `relatedType`: resource type, e.g. `Request` or `Donation`
- `data`: additional payload for the client
  - `requestId`: request ID when notification is tied to a request
  - `hospitalName`: hospital name
  - `requestType`: request type such as `blood`
- `createdAt` / `updatedAt`: timestamps

## Flutter client example

Use the Flutter `http` package or your preferred HTTP client.

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class NotificationApi {
  final String baseUrl;
  final String token;

  NotificationApi({required this.baseUrl, required this.token});

  Map<String, String> get _headers => {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };

  Future<Map<String, dynamic>> fetchNotifications({
    int page = 1,
    int limit = 20,
    bool? read,
    String? type,
  }) async {
    final queryParameters = {
      'page': page.toString(),
      'limit': limit.toString(),
      if (read != null) 'read': read.toString(),
      if (type != null) 'type': type,
    };

    final uri = Uri.parse('$baseUrl/notifications').replace(queryParameters: queryParameters);
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode != 200) {
      throw Exception('Failed to load notifications: ${response.body}');
    }

    return json.decode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> markRead(String notificationId) async {
    final uri = Uri.parse('$baseUrl/notifications/$notificationId/read');
    final response = await http.patch(uri, headers: _headers);

    if (response.statusCode != 200) {
      throw Exception('Failed to mark notification read: ${response.body}');
    }

    return json.decode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> markAllRead() async {
    final uri = Uri.parse('$baseUrl/notifications/read-all');
    final response = await http.patch(uri, headers: _headers);

    if (response.statusCode != 200) {
      throw Exception('Failed to mark all notifications read: ${response.body}');
    }

    return json.decode(response.body) as Map<String, dynamic>;
  }

  Future<void> deleteNotification(String notificationId) async {
    final uri = Uri.parse('$baseUrl/notifications/$notificationId');
    final response = await http.delete(uri, headers: _headers);

    if (response.statusCode != 200) {
      throw Exception('Failed to delete notification: ${response.body}');
    }
  }

  Future<void> deleteAllNotifications() async {
    final uri = Uri.parse('$baseUrl/notifications');
    final response = await http.delete(uri, headers: _headers);

    if (response.statusCode != 200) {
      throw Exception('Failed to delete all notifications: ${response.body}');
    }
  }
}
```

## Deep link / navigation guidance

If `notification.data.requestId` exists, the app can navigate to the request detail screen for that request.

Example:

- Notification `type` = `emergency` or `request`
- Use `notification.data.requestId` to open the urgent request details

## Notes

- The backend returns `unreadCount` inside the `/notifications` response, so Flutter does not need a separate `unread-count` endpoint.
- The notifications API currently does not accept a request body for these endpoints.
- FCM push delivery is handled server-side; the Flutter app only needs to register FCM tokens separately and consume the notification inbox endpoints.
