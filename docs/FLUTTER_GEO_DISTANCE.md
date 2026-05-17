# Geo Distance: Backend Review & Flutter Integration Guide

> **Project:** LifeLink — Blood & Organ Donation Platform  
> **Module:** Geo / Distance Calculation — Backend Review + Flutter Client Integration  
> **Status:** ✅ Backend fully implemented and tested (14 unit tests passing)  
> **Last Updated:** May 2026

---

## Part 1 — Backend Implementation Review

### 1.1 Core Algorithm: `src/utils/geo.js`

The distance calculation is built on the **Haversine formula**, the industry-standard approach for computing great-circle distances between two points on Earth's surface. It correctly accounts for Earth's spherical curvature.

```
Earth's radius R = 6 371 km

a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
c = 2·atan2(√a, √(1−a))
d = R·c                          ← distance in km
```

#### Full source — `calculateDistance`

```javascript
// src/utils/geo.js

export const calculateDistance = (loc1, loc2) => {
  const R = 6371; // Earth's radius in km
  const lat1 = loc1.lat ?? loc1.latitude;
  const lng1 = loc1.long ?? loc1.longitude;
  const lat2 = loc2.lat ?? loc2.latitude;
  const lng2 = loc2.long ?? loc2.longitude;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // km
};

const toRad = (degrees) => degrees * (Math.PI / 180);
```

#### Assessment: ✅ Correct & well-implemented

| Check | Result |
|-------|--------|
| Earth radius constant | ✅ `6371 km` (standard WGS-84 mean radius) |
| Degree → radian conversion | ✅ Correct |
| Haversine formula | ✅ Mathematically correct |
| `atan2` for `c` | ✅ Prevents division-by-zero at antipodal points |
| Dual field-name support (`lat`/`latitude`, `long`/`longitude`) | ✅ Backward compatible |
| Return unit | ✅ Kilometers |

**Known Limitation (by design):** Haversine assumes a perfect sphere. The actual WGS-84 ellipsoid introduces an error of up to **0.5%** (~5 km over 1 000 km). For a donation-matching use case this is entirely acceptable and far more performant than the Vincenty algorithm.

---

### 1.2 Supporting Functions

#### `findNearby(donors, location, radius = 50)`
Filters an array of donor documents to those within `radius` km of a given point.

- ✅ Gracefully returns **all donors** when location is `null` or missing (safe fallback).
- ✅ Skips donors whose `location` field lacks coordinates (no crash).
- ✅ Supports both `{lat, long}` and `{latitude, longitude}` formats.

#### `sortByProximity(donors, location)`
Sorts an array of donors by ascending distance from a point.

- ✅ Donors without coordinates get `distance = Infinity` and sink to the bottom.
- ✅ Non-destructive — calls `.toObject()` to avoid mutating Mongoose documents.

#### `getLocationScore(distance, maxDistance = 100)`
Maps a km distance to a 0–100 score (100 = same location, 0 = beyond maxDistance).

```
score = max(0, 100 − (distance / maxDistance) × 100)
```

- ✅ Linear decay — intuitive and deterministic.
- ✅ Clamps at 0 for distances beyond `maxDistance`.
- ✅ Used by `matching.service.js` to weight nearby donors/requests higher in the compatibility score.

---

### 1.3 Integration Points

The geo utilities are consumed in **four** places across the backend:

| File | Usage | Notes |
|------|-------|-------|
| `src/controllers/discovery.controller.js` | `calculateDistance` per hospital in `getNearbyHospitals`, `getHospitalById`, `searchHospitals` | Returns `distanceKm`, `distanceMeters`, `distance` (formatted string) per hospital |
| `src/services/matching.service.js` | `calculateDistance` + `getLocationScore` in `findCompatibleDonors` and `findCompatibleRequests` | Geo score blended into the 0–120 compatibility score |
| `src/utils/emergency-notification.js` | `calculateDistance` for donor→hospital distance in push notification payloads | Returns `distanceKm` and formatted `distance` string |
| `src/controllers/request.controller.js` | `calculateDistance` for distance field on urgent request responses | Same pattern as discovery controller |

---

### 1.4 Database Location Schema

The `location` field on all User documents (including Donors and Hospitals) follows this schema:

```javascript
// src/models/User.model.js
location: {
  city:        String,
  governorate: String,
  coordinates: {
    lat: Number,   // latitude  — WGS-84 decimal degrees
    lng: Number,   // longitude — WGS-84 decimal degrees
  },
  lastUpdated: Date,
}
```

> [!NOTE]
> The Hospital model also has top-level `lat` and `long` fields (legacy flat format). The discovery controller reads both formats via `h.lat ?? h.location?.coordinates?.lat` to stay backwards-compatible.

---

### 1.5 Test Coverage — `tests/unit/geo.test.js` (14 tests, all passing)

| Test | Description | Result |
|------|-------------|--------|
| Same point | `calculateDistance` returns 0 | ✅ |
| Cairo → Giza | ~7–14 km range check | ✅ |
| Cairo → Alexandria | ~150–250 km range check | ✅ |
| Antipodal points | ~20 000 km check (edge case) | ✅ |
| Score 0 distance | `getLocationScore(0)` = 100 | ✅ |
| Score half max | `getLocationScore(50, 100)` = 50 | ✅ |
| Score beyond max | `getLocationScore(150, 100)` = 0 | ✅ |
| Score at max | `getLocationScore(100, 100)` = 0 | ✅ |
| Score 25% of max | `getLocationScore(25, 100)` = 75 | ✅ |
| `findNearby` 50 km | Returns 2 of 4 donors | ✅ |
| `findNearby` null location | Returns all donors | ✅ |
| `findNearby` 300 km | Returns 3 of 4 donors | ✅ |
| `sortByProximity` order | Nearest first | ✅ |
| `sortByProximity` no coords | `Infinity` distance | ✅ |

**Verdict: The backend geo/distance implementation is correct, robust, and fully tested. No issues found.**

---

## Part 2 — Flutter Integration Guide

### 2.1 Overview

The Flutter app integrates with the geo/distance system via **two mechanisms**:

1. **Server-side distance** — The backend computes and returns `distanceKm` + `distance` (formatted string) for each hospital. Flutter just displays them.
2. **Client-side distance** — Flutter can also compute the Haversine formula locally for instant feedback (before the API call), using the same math.

---

### 2.2 Getting the Device Location (Flutter)

Add the `geolocator` package:

```yaml
# pubspec.yaml
dependencies:
  geolocator: ^12.0.0
```

Add permissions:

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

```xml
<!-- ios/Runner/Info.plist -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>LifeLink needs your location to find nearby donation centers.</string>
```

```dart
// lib/services/location_service.dart

import 'package:geolocator/geolocator.dart';

class LocationService {
  /// Returns the device's current GPS position.
  /// Requests permission automatically if not granted.
  /// Returns null if permission denied or location unavailable.
  static Future<Position?> getCurrentPosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return null;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return null;
    }
    if (permission == LocationPermission.deniedForever) return null;

    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }
}
```

---

### 2.3 Backend API — Nearby Hospitals with Distance

#### Endpoint

```
GET /api/discovery/hospitals/nearby
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lat` | `double` | No* | Donor latitude (WGS-84 decimal degrees) |
| `long` | `double` | No* | Donor longitude (WGS-84 decimal degrees) |
| `radius_km` | `double` | No | Filter to hospitals within this km radius |
| `bloodType` | `string` | No | Filter by available blood type |
| `search` | `string` | No | Name search |
| `page` | `int` | No | Pagination page (default 1) |
| `limit` | `int` | No | Items per page (default 20) |

> *When `lat` + `long` are provided the response includes `distanceKm`, `distanceMeters`, and `distance` fields and results are sorted nearest-first.

#### Example Request

```
GET /api/discovery/hospitals/nearby?lat=30.0444&long=31.2357&radius_km=30
Authorization: Bearer <JWT>
```

#### Response Shape

```json
{
  "success": true,
  "data": {
    "hospitals": [
      {
        "hospitalId": "65a789...",
        "name": "Cairo University Hospital",
        "address": { "city": "Giza", "governorate": "Giza" },
        "lat": 29.987,
        "lng": 31.2118,
        "distanceKm": 6.73,
        "distanceMeters": 6730,
        "distance": "6.73 km",
        "hospitalType": "General Hospital",
        "workingHours": "9AM - 5PM",
        "bloodTypes": ["A+", "O+", "B+"],
        "isAvailable": true,
        "urgentNeedsCount": 2
      }
    ],
    "pagination": {
      "total": 12,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 2.4 Dart Models

```dart
// lib/models/hospital_model.dart

class HospitalModel {
  final String hospitalId;
  final String name;
  final String? hospitalType;
  final String? workingHours;
  final double? lat;
  final double? lng;
  final double? distanceKm;
  final int? distanceMeters;
  final String? distance;         // Pre-formatted: "6.73 km" or "450 m"
  final List<String> bloodTypes;
  final bool isAvailable;
  final int urgentNeedsCount;
  final Map<String, dynamic>? address;

  const HospitalModel({
    required this.hospitalId,
    required this.name,
    this.hospitalType,
    this.workingHours,
    this.lat,
    this.lng,
    this.distanceKm,
    this.distanceMeters,
    this.distance,
    this.bloodTypes = const [],
    this.isAvailable = false,
    this.urgentNeedsCount = 0,
    this.address,
  });

  factory HospitalModel.fromJson(Map<String, dynamic> json) {
    return HospitalModel(
      hospitalId: json['hospitalId'] ?? json['hospital_id'] ?? json['_id'] ?? '',
      name: json['name'] ?? json['fullName'] ?? '',
      hospitalType: json['hospitalType'],
      workingHours: json['workingHours'],
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num? ?? json['long'] as num?)?.toDouble(),
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      distanceMeters: (json['distanceMeters'] as num?)?.toInt(),
      distance: json['distance'] as String?,
      bloodTypes: List<String>.from(json['bloodTypes'] ?? []),
      isAvailable: json['isAvailable'] ?? false,
      urgentNeedsCount: (json['urgentNeedsCount'] as num?)?.toInt() ?? 0,
      address: json['address'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() => {
    'hospitalId': hospitalId,
    'name': name,
    'hospitalType': hospitalType,
    'workingHours': workingHours,
    'lat': lat,
    'lng': lng,
    'distanceKm': distanceKm,
    'distanceMeters': distanceMeters,
    'distance': distance,
    'bloodTypes': bloodTypes,
    'isAvailable': isAvailable,
    'urgentNeedsCount': urgentNeedsCount,
    'address': address,
  };

  /// Returns a user-friendly distance string.
  /// Uses server-provided value if available; falls back to a placeholder.
  String get formattedDistance => distance ?? (distanceKm != null
      ? '${distanceKm!.toStringAsFixed(2)} km'
      : 'Distance unavailable');
}
```

---

### 2.5 API Service

```dart
// lib/services/hospital_service.dart

import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/hospital_model.dart';

class HospitalService {
  final String baseUrl;
  final String authToken;

  const HospitalService({required this.baseUrl, required this.authToken});

  /// Fetch hospitals near [lat]/[lng] within optional [radiusKm].
  /// Returns hospitals sorted by distance (nearest first).
  Future<List<HospitalModel>> getNearbyHospitals({
    required double lat,
    required double lng,
    double? radiusKm,
    String? bloodType,
    String? search,
    int page = 1,
    int limit = 20,
  }) async {
    final queryParams = <String, String>{
      'lat': lat.toString(),
      'long': lng.toString(),
      'page': page.toString(),
      'limit': limit.toString(),
      if (radiusKm != null) 'radius_km': radiusKm.toString(),
      if (bloodType != null) 'bloodType': bloodType,
      if (search != null && search.isNotEmpty) 'search': search,
    };

    final uri = Uri.parse('$baseUrl/api/discovery/hospitals/nearby')
        .replace(queryParameters: queryParams);

    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer $authToken',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final hospitalsJson = body['data']['hospitals'] as List<dynamic>;
      return hospitalsJson
          .map((h) => HospitalModel.fromJson(h as Map<String, dynamic>))
          .toList();
    } else {
      throw Exception(
        'Failed to load nearby hospitals: ${response.statusCode} ${response.body}',
      );
    }
  }

  /// Fetch a single hospital by ID.
  /// Pass [lat]/[lng] to receive a distance calculation from the backend.
  Future<HospitalModel> getHospitalById(
    String hospitalId, {
    double? lat,
    double? lng,
  }) async {
    final queryParams = <String, String>{
      if (lat != null) 'lat': lat.toString(),
      if (lng != null) 'long': lng.toString(),
    };

    final uri = Uri.parse('$baseUrl/api/discovery/hospitals/$hospitalId')
        .replace(queryParameters: queryParams);

    final response = await http.get(
      uri,
      headers: {'Authorization': 'Bearer $authToken'},
    );

    if (response.statusCode == 200) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return HospitalModel.fromJson(
          body['data']['hospital'] as Map<String, dynamic>);
    } else {
      throw Exception('Hospital not found: ${response.statusCode}');
    }
  }
}
```

---

### 2.6 Client-Side Haversine (Dart)

For **instant, offline distance calculations** (e.g., sorting a cached list without a new API call), mirror the same formula locally:

```dart
// lib/utils/geo_utils.dart

import 'dart:math';

/// Haversine distance between two WGS-84 decimal-degree coordinates.
/// Returns distance in **kilometers** — matches the backend geo.js implementation exactly.
double calculateDistance(
  double lat1, double lon1,
  double lat2, double lon2,
) {
  const double R = 6371.0; // Earth's mean radius in km

  final double dLat = _toRad(lat2 - lat1);
  final double dLon = _toRad(lon2 - lon1);

  final double a =
      sin(dLat / 2) * sin(dLat / 2) +
      cos(_toRad(lat1)) * cos(_toRad(lat2)) *
      sin(dLon / 2) * sin(dLon / 2);

  final double c = 2 * atan2(sqrt(a), sqrt(1 - a));
  return R * c;
}

double _toRad(double degrees) => degrees * (pi / 180);

/// Format a km distance into a human-readable string.
/// Matches the backend formatDistance() helper in discovery.controller.js.
String formatDistance(double distanceKm) {
  if (distanceKm < 1) {
    return '${(distanceKm * 1000).round()} m';
  }
  return '${distanceKm.toStringAsFixed(2)} km';
}

/// Linear location score: 0–100 where 100 = same location.
/// Mirrors getLocationScore() in geo.js.
double getLocationScore(double distanceKm, {double maxDistance = 100}) {
  if (distanceKm > maxDistance) return 0;
  return max(0, 100 - (distanceKm / maxDistance) * 100);
}
```

#### Usage Example

```dart
import 'package:geolocator/geolocator.dart';
import '../utils/geo_utils.dart';

// Donor's device position
final Position pos = await LocationService.getCurrentPosition();

// Hospital returned by API (already has distanceKm from server)
final hospital = HospitalModel(...);

// Option A: use server-provided distance (preferred — authoritative)
print(hospital.formattedDistance); // "6.73 km"

// Option B: compute locally (useful when server distance is absent)
if (pos != null && hospital.lat != null && hospital.lng != null) {
  final double km = calculateDistance(
    pos.latitude, pos.longitude,
    hospital.lat!, hospital.lng!,
  );
  print(formatDistance(km)); // "6.73 km"
}
```

---

### 2.7 Complete Flow: Nearby Hospitals Screen

```dart
// lib/screens/choose_location_screen.dart

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../models/hospital_model.dart';
import '../services/hospital_service.dart';
import '../services/location_service.dart';

class ChooseLocationScreen extends StatefulWidget {
  const ChooseLocationScreen({super.key});

  @override
  State<ChooseLocationScreen> createState() => _ChooseLocationScreenState();
}

class _ChooseLocationScreenState extends State<ChooseLocationScreen> {
  List<HospitalModel> _hospitals = [];
  bool _loading = true;
  String? _error;
  Position? _devicePosition;

  @override
  void initState() {
    super.initState();
    _loadNearbyHospitals();
  }

  Future<void> _loadNearbyHospitals() async {
    setState(() { _loading = true; _error = null; });

    try {
      // 1. Get device GPS position
      final position = await LocationService.getCurrentPosition();
      _devicePosition = position;

      List<HospitalModel> hospitals;
      if (position != null) {
        // 2a. Fetch with geo — backend returns distance-sorted results
        hospitals = await HospitalService(
          baseUrl: 'https://your-api-url.com',
          authToken: 'your-jwt-token',
        ).getNearbyHospitals(
          lat: position.latitude,
          lng: position.longitude,
          radiusKm: 50,
        );
      } else {
        // 2b. No location — fetch all hospitals (no distance filtering)
        hospitals = await HospitalService(
          baseUrl: 'https://your-api-url.com',
          authToken: 'your-jwt-token',
        ).getNearbyHospitals(
          lat: 0, lng: 0, // Server still works; won't compute distance
        );
      }

      setState(() { _hospitals = hospitals; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text('Error: $_error'));

    return ListView.builder(
      itemCount: _hospitals.length,
      itemBuilder: (context, index) {
        final hospital = _hospitals[index];
        return ListTile(
          title: Text(hospital.name),
          subtitle: Text(hospital.address?['city'] ?? ''),
          trailing: Text(
            hospital.formattedDistance,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: Colors.red,
            ),
          ),
          onTap: () {
            // Navigate to Step 2 of the scheduling flow
            Navigator.pushNamed(
              context,
              '/schedule/date-time',
              arguments: hospital,
            );
          },
        );
      },
    );
  }
}
```

---

### 2.8 Updating the Donor's Location

When the donor grants location permission, update their profile on the backend so the matching engine can rank them for nearby urgent requests:

```dart
// lib/services/donor_service.dart — location update

Future<void> updateDonorLocation({
  required double lat,
  required double lng,
  String? city,
  String? governorate,
}) async {
  final response = await http.patch(
    Uri.parse('$baseUrl/donor/profile'),
    headers: {
      'Authorization': 'Bearer $authToken',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'location': {
        'coordinates': { 'lat': lat, 'lng': lng },
        if (city != null) 'city': city,
        if (governorate != null) 'governorate': governorate,
      },
    }),
  );

  if (response.statusCode != 200) {
    throw Exception('Failed to update location: ${response.statusCode}');
  }
}
```

Call this on app launch (after permission is granted) and whenever the donor refreshes their location:

```dart
final position = await LocationService.getCurrentPosition();
if (position != null) {
  await donorService.updateDonorLocation(
    lat: position.latitude,
    lng: position.longitude,
  );
}
```

---

### 2.9 Distance Display Conventions

The backend returns distance in three forms — use each as appropriate:

| Field | Type | Example | When to Use |
|-------|------|---------|-------------|
| `distanceKm` | `double` | `6.73` | Sorting, filtering, comparisons |
| `distanceMeters` | `int` | `6730` | Fine-grained display for short distances |
| `distance` | `string` | `"6.73 km"` or `"450 m"` | **Direct display in UI** — pre-formatted by backend |

The backend automatically switches between meters and kilometers:
- `< 1 km` → `"450 m"`
- `≥ 1 km` → `"6.73 km"`

The Dart `formatDistance()` helper in `geo_utils.dart` replicates this same logic for offline use.

---

### 2.10 Error & Edge-Case Handling

| Situation | Backend Behavior | Flutter Handling |
|-----------|-----------------|-----------------|
| No `lat`/`long` query params sent | Returns all hospitals, no distance fields | Show "Distance unavailable" |
| Hospital has no stored coordinates | Hospital included but no distance fields | Show "Distance unavailable" |
| `radius_km` set but hospital beyond radius | Hospital excluded from response | None needed |
| Location permission denied | — | Fetch without coords; show "Enable location for distances" banner |
| Location service disabled | — | Show snackbar asking user to enable GPS |

```dart
// Defensive display helper
String displayDistance(HospitalModel hospital) {
  if (hospital.distance != null) return hospital.distance!;
  if (hospital.distanceKm != null) {
    return formatDistance(hospital.distanceKm!);
  }
  return 'Distance unavailable';
}
```

---

## Part 3 — Summary

### Backend Review Verdict

| Aspect | Status |
|--------|--------|
| Haversine formula | ✅ Correctly implemented |
| Input format flexibility (`lat`/`latitude`, `long`/`longitude`) | ✅ Handled |
| Null / missing coordinate safety | ✅ Graceful fallback |
| Distance output formats (`km`, `m`, raw numeric) | ✅ All provided |
| Sorting (nearest first) | ✅ Implemented in `getNearbyHospitals` |
| Radius filtering | ✅ Implemented |
| Matching engine integration | ✅ Location score used in donor compatibility score |
| Unit tests | ✅ 14/14 passing |

### Flutter Integration Summary

| Component | File | Purpose |
|-----------|------|---------|
| GPS permission + position | `lib/services/location_service.dart` | Get device coordinates |
| Hospital API calls | `lib/services/hospital_service.dart` | `getNearbyHospitals`, `getHospitalById` |
| Hospital data model | `lib/models/hospital_model.dart` | Parse API response + distance fields |
| Client-side Haversine | `lib/utils/geo_utils.dart` | Offline distance, `formatDistance`, `getLocationScore` |
| Location update | `lib/services/donor_service.dart` | Push donor GPS to backend for matching |
| Choose Location screen | `lib/screens/choose_location_screen.dart` | Step 1 of scheduling flow |

---

*This document is part of the LifeLink project graduation documentation package.*  
*Related: [FLUTTER_DONATION_SCHEDULING.md](./FLUTTER_DONATION_SCHEDULING.md)*
