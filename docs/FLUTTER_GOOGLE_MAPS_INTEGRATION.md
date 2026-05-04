# Flutter Google Maps Integration Guide

**Date**: May 4, 2026  
**Status**: ✅ Ready for Flutter Implementation  
**Purpose**: Coordinate integration between LifeLink backend and Flutter Google Maps

---

## 📌 Overview

The LifeLink backend **stores and returns latitude/longitude coordinates** for hospitals. The Flutter team should use **Google Maps SDK** to handle distance calculations and display on the map, rather than relying on backend calculations.

### Key Principle:
```
Backend: Store lat/long only ✅
Flutter: Google Maps handles distance calculation & display ✅
```

---

## 🗺️ API Response Format for Flutter

### Hospital Discovery Endpoint

**Endpoint**: `GET /hospitals`

**Response Format**:
```json
{
  "success": true,
  "message": "Hospitals retrieved successfully",
  "data": {
    "hospitals": [
      {
        "hospitalId": "66f100000000000000000001",
        "hospital_id": "66f100000000000000000001",
        "name": "Cairo General Hospital",
        "fullName": "Cairo General Hospital",
        "contactNumber": "01099998888",
        "email": "info@hospital.com",
        "address": {
          "city": "Cairo",
          "governorate": "Cairo",
          "street": "Corniche Road"
        },
        "location": null,
        "lat": 30.0444,
        "long": 31.2357
      },
      {
        "hospitalId": "66f100000000000000000002",
        "name": "Alexandria Medical Center",
        "lat": 31.1854,
        "long": 29.9163
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150
    }
  }
}
```

### Nearby Hospitals Endpoint

**Endpoint**: `GET /hospitals/nearby?lat={userLat}&long={userLong}`

**Response Format**:
```json
{
  "success": true,
  "message": "Nearby hospitals retrieved successfully",
  "data": {
    "hospitals": [
      {
        "hospitalId": "66f100000000000000000001",
        "name": "Cairo General Hospital",
        "contactNumber": "01099998888",
        "email": "info@hospital.com",
        "address": {
          "city": "Cairo",
          "governorate": "Cairo"
        },
        "lat": 30.0444,
        "long": 31.2357,
        "distanceKm": 2.45
      },
      {
        "hospitalId": "66f100000000000000000003",
        "name": "Helwan Hospital",
        "lat": 29.8625,
        "long": 31.2895,
        "distanceKm": 15.78
      }
    ],
    "total": 42
  }
}
```

---

## 📱 Flutter Implementation

### Option 1: Use Backend Distance (Simplest)

For basic lists, you can use the `distanceKm` returned by the backend:

```dart
import 'package:google_maps_flutter/google_maps_flutter.dart';

class HospitalListScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: fetchNearbyHospitals(
        userLat: 30.0444,
        userLong: 31.2357,
      ),
      builder: (context, snapshot) {
        final hospitals = snapshot.data ?? [];
        
        return ListView.builder(
          itemCount: hospitals.length,
          itemBuilder: (context, index) {
            final hospital = hospitals[index];
            return ListTile(
              title: Text(hospital['name']),
              subtitle: Text(
                '${hospital['distanceKm']} km away\n${hospital['address']['city']}'
              ),
              trailing: Icon(Icons.location_on),
            );
          },
        );
      },
    );
  }
}
```

---

### Option 2: Use Google Maps for Interactive Display (Recommended)

For map views where users interact with locations:

```dart
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:location/location.dart';
import 'dart:math' as math;

class HospitalMapScreen extends StatefulWidget {
  @override
  State<HospitalMapScreen> createState() => _HospitalMapScreenState();
}

class _HospitalMapScreenState extends State<HospitalMapScreen> {
  late GoogleMapController mapController;
  Set<Marker> markers = {};
  Set<Circle> circles = {};
  LocationData? userLocation;

  @override
  void initState() {
    super.initState();
    _initializeMap();
  }

  Future<void> _initializeMap() async {
    // Get user location
    Location location = Location();
    userLocation = await location.getLocation();

    // Fetch hospitals from backend
    final hospitals = await fetchNearbyHospitals(
      userLat: userLocation!.latitude!,
      userLong: userLocation!.longitude!,
    );

    // Add user marker
    markers.add(
      Marker(
        markerId: MarkerId('user_location'),
        position: LatLng(
          userLocation!.latitude!,
          userLocation!.longitude!,
        ),
        infoWindow: InfoWindow(title: 'Your Location'),
        icon: BitmapDescriptor.defaultMarkerWithHue(
          BitmapDescriptor.hueBlue,
        ),
      ),
    );

    // Add hospital markers
    for (var hospital in hospitals) {
      final hospitalLat = hospital['lat'];
      final hospitalLong = hospital['long'];

      markers.add(
        Marker(
          markerId: MarkerId(hospital['hospitalId']),
          position: LatLng(hospitalLat, hospitalLong),
          infoWindow: InfoWindow(
            title: hospital['name'],
            snippet: '${hospital['distanceKm']} km away',
          ),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueRed,
          ),
          onTap: () {
            _showHospitalDetails(hospital);
          },
        ),
      );
    }

    setState(() {});
  }

  double _calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const R = 6371; // Earth radius in km
    final dLat = _toRad(lat2 - lat1);
    final dLon = _toRad(lon2 - lon1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_toRad(lat1)) *
            math.cos(_toRad(lat2)) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return R * c;
  }

  double _toRad(double degrees) => degrees * (math.pi / 180);

  void _showHospitalDetails(Map hospital) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              hospital['name'],
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            SizedBox(height: 8),
            Text('📍 ${hospital['address']['city']}'),
            Text('📞 ${hospital['contactNumber']}'),
            Text(
              '🗺️ Distance: ${hospital['distanceKm']} km',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),
            ElevatedButton.icon(
              icon: Icon(Icons.directions),
              label: Text('Get Directions'),
              onPressed: () {
                _openGoogleMaps(
                  hospital['lat'],
                  hospital['long'],
                  hospital['name'],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openGoogleMaps(
    double lat,
    double long,
    String hospitalName,
  ) async {
    final String googleMapsUrl =
        'https://www.google.com/maps/search/?api=1&query=$lat,$long';
    
    if (await canLaunch(googleMapsUrl)) {
      await launch(googleMapsUrl);
    } else {
      // Fallback: open in app
      mapController.animateCamera(
        CameraUpdate.newLatLng(LatLng(lat, long)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (userLocation == null) {
      return Scaffold(
        appBar: AppBar(title: Text('Hospital Map')),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Nearby Hospitals'),
        elevation: 0,
      ),
      body: GoogleMap(
        onMapCreated: (controller) {
          mapController = controller;
        },
        initialCameraPosition: CameraPosition(
          target: LatLng(
            userLocation!.latitude!,
            userLocation!.longitude!,
          ),
          zoom: 14,
        ),
        markers: markers,
        circles: circles,
        myLocationEnabled: true,
        myLocationButtonEnabled: true,
        compassEnabled: true,
        trafficEnabled: false,
      ),
    );
  }

  @override
  void dispose() {
    mapController.dispose();
    super.dispose();
  }
}
```

---

### Option 3: Calculate Distance Dynamically in Flutter

If you prefer calculating distance on the client side:

```dart
// Helper extension
extension DistanceCalculation on LatLng {
  double distanceTo(LatLng other) {
    const R = 6371; // Earth's radius in km
    final lat1 = latitude * (math.pi / 180);
    final lat2 = other.latitude * (math.pi / 180);
    final dLat = (other.latitude - latitude) * (math.pi / 180);
    final dLon = (other.longitude - longitude) * (math.pi / 180);

    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1) *
            math.cos(lat2) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));

    return R * c;
  }
}

// Usage
final userLocation = LatLng(30.0444, 31.2357);
final hospitalLocation = LatLng(hospital['lat'], hospital['long']);
final distance = userLocation.distanceTo(hospitalLocation);
print('Distance: ${distance.toStringAsFixed(2)} km');
```

---

## 🔗 API Query Parameters for Flutter

### Hospital List Endpoint

```
GET /hospitals?city=Cairo&page=1&limit=50
```

### Nearby Hospitals Endpoint

```
GET /hospitals/nearby?lat=30.0444&long=31.2357&radius_km=50
```

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lat` | number | No | User latitude (for distance calculation) |
| `long` | number | No | User longitude (for distance calculation) |
| `radius_km` | number | No | Filter results within radius (km) |
| `city` | string | No | Filter by city name |
| `search` | string | No | Search by hospital name |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20) |

---

## 📊 Backend Coordinate Storage

### Current Schema

Hospitals store coordinates as:

```javascript
{
  lat: Number,      // -90 to 90 (latitude)
  long: Number,     // -180 to 180 (longitude)
  location: {       // Legacy support
    coordinates: {
      lat: Number,
      lng: Number
    }
  }
}
```

### Creating Hospital (Flutter)

When creating a hospital, send:

```dart
final hospitalData = {
  'fullName': 'Cairo General Hospital',
  'email': 'info@hospital.com',
  'password': 'SecurePassword123!',
  'hospitalName': 'Cairo General Hospital',
  'licenseNumber': 'LIC-2026-001',
  'contactNumber': '01099998888',
  'lat': 30.0444,           // ✅ Use lat
  'long': 31.2357,          // ✅ Use long
};

await api.post('/auth/signup', hospitalData);
```

---

## ✨ Best Practices for Flutter

### 1. **Distance Display**
```dart
// Format distance nicely
String formatDistance(double km) {
  if (km < 1) {
    return '${(km * 1000).toStringAsFixed(0)} m';
  }
  return '${km.toStringAsFixed(1)} km';
}
```

### 2. **Nearby Search**
```dart
// Always include user coordinates for better results
Future<List<Map>> getNearbyHospitals() async {
  final location = await _getUserLocation();
  return api.get('/hospitals/nearby', queryParameters: {
    'lat': location.latitude,
    'long': location.longitude,
    'radius_km': 50,
  });
}
```

### 3. **Map Bounds**
```dart
// Fit all hospitals in map view
void _fitBoundsForHospitals(List<Map> hospitals) {
  if (hospitals.isEmpty) return;

  double minLat = hospitals[0]['lat'];
  double maxLat = hospitals[0]['lat'];
  double minLng = hospitals[0]['long'];
  double maxLng = hospitals[0]['long'];

  for (var hospital in hospitals) {
    minLat = math.min(minLat, hospital['lat']);
    maxLat = math.max(maxLat, hospital['lat']);
    minLng = math.min(minLng, hospital['long']);
    maxLng = math.max(maxLng, hospital['long']);
  }

  mapController.animateCamera(
    CameraUpdate.newLatLngBounds(
      LatLngBounds(
        southwest: LatLng(minLat, minLng),
        northeast: LatLng(maxLat, maxLng),
      ),
      100,
    ),
  );
}
```

### 4. **Real-time Distance Updates**
```dart
// Update distances as user moves
LocationData? lastLocation;

location.onLocationChanged.listen((LocationData location) {
  if (_shouldUpdateDistance(lastLocation, location)) {
    setState(() {
      // Recalculate distances or fetch nearby again
      _refreshHospitals();
    });
    lastLocation = location;
  }
});

bool _shouldUpdateDistance(LocationData? old, LocationData new_) {
  if (old == null) return true;
  
  final distance = LatLng(old.latitude!, old.longitude!)
      .distanceTo(LatLng(new_.latitude!, new_.longitude!));
  
  return distance > 0.5; // Only update if user moved > 500m
}
```

---

## 🎯 Benefits of This Approach

| Aspect | Backend Calculation | Google Maps (Client-side) |
|--------|-------------------|--------------------------|
| **Accuracy** | ✅ Consistent | ✅ Real-time |
| **Load** | ✅ Server handles | ✅ Device handles |
| **User Experience** | ⚠️ Wait for API | ✅ Instant feedback |
| **Battery** | ✅ Less app load | ⚠️ More calculation |
| **Visual Display** | ⚠️ Just number | ✅ Map with routes |
| **Real-time Updates** | ⚠️ Need re-request | ✅ Automatic |

**Recommendation**: Use both:
- **Backend distance** for list sorting
- **Google Maps** for visual display and directions

---

## 📦 Flutter Dependencies Required

```yaml
dependencies:
  flutter:
    sdk: flutter
  google_maps_flutter: ^2.2.0
  location: ^4.4.0
  http: ^0.13.0
  url_launcher: ^6.1.0
```

---

## 🔐 Permissions (Android)

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

---

## 🍎 Permissions (iOS)

Add to `Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs access to your location to show nearby hospitals</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs access to your location to show nearby hospitals</string>
```

---

## 📝 API Data Model

### Hospital Object (From API)

```typescript
interface Hospital {
  hospitalId: string;           // UUID
  hospital_id: string;          // Duplicate for compatibility
  name: string;                 // Display name
  fullName: string;             // Full name
  contactNumber: string;        // Phone
  email: string;               // Email address
  address: {
    city: string;              // City name
    governorate: string;       // Region/State
    street?: string;           // Street address
  };
  location: any;               // Legacy field
  lat: number;                 // Latitude -90 to 90
  long: number;                // Longitude -180 to 180
  distanceKm?: number;         // Optional distance in km
}
```

---

## 🚀 Quick Start for Flutter Team

```dart
// 1. Fetch hospitals
final response = await http.get(
  Uri.parse('http://localhost:5000/hospitals/nearby?lat=30.0444&long=31.2357'),
);

final data = jsonDecode(response.body);
final hospitals = data['data']['hospitals'] as List;

// 2. Create markers
final markers = hospitals.map((h) => Marker(
  markerId: MarkerId(h['hospitalId']),
  position: LatLng(h['lat'], h['long']),
  infoWindow: InfoWindow(
    title: h['name'],
    snippet: '${h['distanceKm']} km away',
  ),
)).toSet();

// 3. Show on map
GoogleMap(
  initialCameraPosition: CameraPosition(
    target: LatLng(30.0444, 31.2357),
    zoom: 14,
  ),
  markers: markers,
);
```

---

## ✅ Summary

- ✅ Backend stores **lat/long coordinates only**
- ✅ Backend optionally returns **distanceKm** for sorting
- ✅ Flutter uses **Google Maps** for:
  - Distance calculation
  - Route display
  - Interactive map experience
- ✅ Use API parameter `lat`, `long`, `radius_km`
- ✅ Both coordinates formats supported for backwards compatibility

**For Questions**: Contact backend team or refer to `/admin/hospitals` endpoint documentation.
