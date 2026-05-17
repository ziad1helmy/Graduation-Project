# LifeLink — Location Flow: Complete Implementation Guide

> **Scope:** Backend (Node.js) + Flutter client + GitHub Copilot prompt  
> **Principle:** Additive only — zero breaking changes to existing registration flow  
> **Fallback strategy:** Registration never blocked by GPS failure; governorate-only matching already works

---

## 1. Backend Changes

### 1.1 `src/validation/auth.validation.js`

Add optional `lat`/`lng` to the donor and hospital register schemas.  
Both must be present together or both absent — never one without the other.

```js
// Add inside donorRegisterSchema and hospitalRegisterSchema objects:

lat: Joi.number()
  .min(-90).max(90)
  .optional()
  .when('lng', {
    is: Joi.exist(),
    then: Joi.required().messages({
      'any.required': 'lat is required when lng is provided',
    }),
  }),

lng: Joi.number()
  .min(-180).max(180)
  .optional()
  .when('lat', {
    is: Joi.exist(),
    then: Joi.required().messages({
      'any.required': 'lng is required when lat is provided',
    }),
  }),
```

**Why:** Protects against Flutter sending only one coordinate (e.g. GPS partially failed).  
Both arrive together or neither does. The backend never stores a half-location.

---

### 1.2 `src/services/auth.service.js`

Inside the `register` function, after building `userData`, add location if coordinates were sent:

```js
// After building userData object, before User.create():

if (body.lat != null && body.lng != null) {
  userData.location = {
    coordinates: {
      lat: body.lat,
      lng: body.lng,
    },
  };
}
```

Then add `locationRequired` to the success response:

```js
// In the return object at the end of register():

return {
  user: sanitizedUser,
  tokens,
  locationRequired: !userData.location,  // true = Flutter should prompt user to set location
};
```

**Why `locationRequired`:** Flutter uses this flag immediately after registration to decide whether to show the "Set your location" prompt. No extra API call needed.

---

### 1.3 `src/utils/errorCodes.js`

Add to the `ERR` object:

```js
// ── Location ──────────────────────────────────
LOCATION_INVALID_PAIR:   'Both lat and lng must be provided together',
LOCATION_OUT_OF_RANGE:   'Coordinates are outside valid range',
```

---

### 1.4 No changes needed to

- `User.model.js` — `location.coordinates.{lat,lng}` already exists in schema  
- `matching.service.js` — governorate fallback already handles missing coordinates  
- `app.js`, routes, middleware — registration endpoint is unchanged  

---

## 2. Full Flutter Location Flow

### States the app must handle

```
UNKNOWN       → app just launched, no permission decision yet
GRANTED       → GPS available, coordinates obtained
DENIED        → user declined once (can ask again)
DENIED_FOREVER → user declined permanently (must go to Settings)
GPS_OFF       → device location services disabled
TIMEOUT       → GPS took too long, coordinates not available
```

---

### 2.1 Flow diagram

```
Register screen loads
        │
        ▼
Request GPS permission
        │
   ┌────┴────────────────────────────────────┐
   │ GRANTED                                  │ DENIED / GPS_OFF / TIMEOUT
   ▼                                          ▼
Get coordinates (timeout: 8s)         Show soft explanation dialog
   │                                  "Location helps us find nearby donors"
   │ success                                  │
   ▼                                   ┌──────┴──────┐
Store lat/lng in form state            │ Try Again    │ Skip
   │                                   │              │
   ▼                                   ▼              ▼
Submit registration               Re-request      Submit WITHOUT
with lat + lng                    permission       lat/lng
                                       │
                              ┌────────┴────────┐
                              │ GRANTED          │ DENIED_FOREVER
                              ▼                  ▼
                         Get coordinates    Open device Settings
                         Submit with lat/lng   (openAppSettings)
                                               User returns → retry
```

---

### 2.2 Flutter code — `location_service.dart`

```dart
import 'package:geolocator/geolocator.dart';

class LocationService {
  /// Returns coordinates or null if unavailable for any reason.
  /// Never throws — all failures return null.
  static Future<({double lat, double lng})?> getCurrentLocation() async {
    try {
      // 1. Check if device location services are enabled
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return null;

      // 2. Check current permission state
      LocationPermission permission = await Geolocator.checkPermission();

      // 3. If not yet asked, request now
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) return null;
      }

      // 4. Permanently denied — caller handles opening settings
      if (permission == LocationPermission.deniedForever) return null;

      // 5. Get position with 8 second timeout
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
      ).timeout(const Duration(seconds: 8));

      return (lat: position.latitude, lng: position.longitude);
    } catch (_) {
      // Timeout, PlatformException, or any unexpected error
      return null;
    }
  }

  /// True if the user has permanently blocked location.
  static Future<bool> isPermanentlyDenied() async {
    final perm = await Geolocator.checkPermission();
    return perm == LocationPermission.deniedForever;
  }

  /// Opens device app settings so user can re-enable permission.
  static Future<void> openSettings() => Geolocator.openAppSettings();
}
```

---

### 2.3 Flutter code — `register_screen.dart` (location section)

```dart
// State variables
double? _lat;
double? _lng;
bool _locationLoading = false;
bool _locationDeniedForever = false;

// Call this on screen init AND on "Try Again" tap
Future<void> _fetchLocation() async {
  setState(() => _locationLoading = true);

  final coords = await LocationService.getCurrentLocation();

  if (coords != null) {
    setState(() {
      _lat = coords.lat;
      _lng = coords.lng;
      _locationLoading = false;
    });
  } else {
    final permanentlyDenied = await LocationService.isPermanentlyDenied();
    setState(() {
      _locationDeniedForever = permanentlyDenied;
      _locationLoading = false;
    });
  }
}

// Location UI widget — place this inside your registration form
Widget _buildLocationTile() {
  if (_locationLoading) {
    return const ListTile(
      leading: SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
      title: Text('Getting your location...'),
    );
  }

  if (_lat != null && _lng != null) {
    // Success state
    return ListTile(
      leading: const Icon(Icons.location_on, color: Colors.green),
      title: const Text('Location detected'),
      subtitle: Text('${_lat!.toStringAsFixed(4)}, ${_lng!.toStringAsFixed(4)}'),
      trailing: TextButton(
        onPressed: _fetchLocation,
        child: const Text('Refresh'),
      ),
    );
  }

  if (_locationDeniedForever) {
    // Permanent denial — must open settings
    return ListTile(
      leading: const Icon(Icons.location_off, color: Colors.red),
      title: const Text('Location permission denied'),
      subtitle: const Text('Please enable location in your device settings'),
      trailing: TextButton(
        onPressed: () async {
          await LocationService.openSettings();
          // When user returns to app, retry
          await Future.delayed(const Duration(seconds: 1));
          _fetchLocation();
        },
        child: const Text('Open Settings'),
      ),
    );
  }

  // Soft denial or GPS off — offer retry and skip
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      ListTile(
        leading: const Icon(Icons.location_off, color: Colors.orange),
        title: const Text('Location not available'),
        subtitle: const Text(
          'Location helps us find nearby donors. You can set it later from your profile.',
        ),
      ),
      Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          TextButton(
            onPressed: () {
              // Skip — proceed without coordinates
              // _lat and _lng remain null, which is fine
            },
            child: const Text('Skip for now'),
          ),
          const SizedBox(width: 8),
          ElevatedButton.icon(
            onPressed: _fetchLocation,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Try Again'),
          ),
        ],
      ),
    ],
  );
}
```

---

### 2.4 Flutter code — sending registration payload

```dart
Future<void> _submitRegistration() async {
  final payload = {
    'fullName': _nameController.text.trim(),
    'email': _emailController.text.trim(),
    'password': _passwordController.text,
    'bloodType': _selectedBloodType,
    'governorate': _selectedGovernorate,
    // Only include coordinates if both are available
    if (_lat != null && _lng != null) 'lat': _lat,
    if (_lat != null && _lng != null) 'lng': _lng,
  };

  final response = await AuthService.register(payload);

  // Backend returns locationRequired: true when no coordinates were stored
  if (response.locationRequired) {
    _showLocationReminderBanner();
  }
}

void _showLocationReminderBanner() {
  ScaffoldMessenger.of(context).showMaterialBanner(
    MaterialBanner(
      content: const Text('Set your location to get better donor matches nearby.'),
      leading: const Icon(Icons.location_on_outlined),
      actions: [
        TextButton(
          onPressed: () {
            ScaffoldMessenger.of(context).hideCurrentMaterialBanner();
            // Navigate to profile → location update
            Navigator.pushNamed(context, '/profile/location');
          },
          child: const Text('Set Now'),
        ),
        TextButton(
          onPressed: () =>
              ScaffoldMessenger.of(context).hideCurrentMaterialBanner(),
          child: const Text('Later'),
        ),
      ],
    ),
  );
}
```

---

### 2.5 "Set location later" — Profile update

The backend already exposes `PUT /api/v1/donor/profile` which accepts `lat` and `lng`.  
Flutter just calls that endpoint from the profile screen:

```dart
// PUT /api/v1/donor/profile
final payload = {
  'lat': currentPosition.latitude,
  'lng': currentPosition.longitude,
};
await DonorService.updateProfile(payload);
```

No new backend endpoint needed.

---

## 3. Re-ask Logic — When and How Often

| Situation | What Flutter does |
|-----------|-------------------|
| First open of register screen | Auto-request permission silently |
| User taps "Try Again" | Re-request (works if `denied` but not `deniedForever`) |
| `deniedForever` | Show "Open Settings" button — never auto-open |
| User returns from Settings | Auto-retry after 1s delay |
| GPS timeout (>8s) | Treat same as denied — show retry option |
| User skips | Register without coordinates, show banner after login |
| User taps banner "Set Now" | Navigate to profile location screen |
| Profile screen loads | Auto-request permission again (same flow) |

**Never ask more than once per session without user action.**  
The retry is always user-initiated (tap "Try Again") except for the one silent initial request.

---

## 4. Backend Response Contract

### Registration success — with location
```json
{
  "success": true,
  "data": {
    "user": { "...": "..." },
    "tokens": { "accessToken": "...", "refreshToken": "..." },
    "locationRequired": false
  }
}
```

### Registration success — without location
```json
{
  "success": true,
  "data": {
    "user": { "...": "..." },
    "tokens": { "accessToken": "...", "refreshToken": "..." },
    "locationRequired": true
  }
}
```

### Validation error — only one coordinate sent
```json
{
  "success": false,
  "message": "lat is required when lng is provided",
  "statusCode": 422
}
```

---

## 5. GitHub Copilot Prompt

Copy and paste this entire prompt into Copilot Chat (or your Copilot-powered IDE) to implement the full location flow in one shot.

---

```
You are implementing a location collection flow for a Flutter app called LifeLink
(a blood donation matching platform). Follow every instruction exactly.

==================================================
CONTEXT
==================================================

Backend: Node.js + Express + MongoDB
Flutter uses: geolocator package (already in pubspec.yaml)
Backend base URL: stored in ApiConstants.baseUrl
Auth endpoints follow the pattern: POST /api/v1/auth/register

The backend registration endpoint accepts an optional lat and lng in the request body.
If both are provided, it stores the donor/hospital location for geo-matching.
If neither is provided, registration still succeeds and returns locationRequired: true.

==================================================
FILES TO CREATE
==================================================

1. lib/services/location_service.dart
2. lib/screens/auth/widgets/location_tile_widget.dart

==================================================
FILES TO MODIFY
==================================================

3. lib/screens/auth/register_screen.dart
4. lib/services/auth_service.dart (add locationRequired to RegisterResponse)

==================================================
EXACT REQUIREMENTS
==================================================

location_service.dart:
- Static class, no constructor
- Method: Future<({double lat, double lng})?> getCurrentLocation()
  - Check if location services are enabled — return null if not
  - Check permission: if denied, request once
  - If deniedForever, return null
  - Get position with LocationAccuracy.medium and 8 second timeout
  - Catch ALL exceptions and return null
- Method: Future<bool> isPermanentlyDenied()
  - Returns true if permission is LocationPermission.deniedForever
- Method: Future<void> openSettings()
  - Calls Geolocator.openAppSettings()

location_tile_widget.dart:
- StatefulWidget
- Constructor params:
    final double? lat
    final double? lng
    final VoidCallback onRetry
    final VoidCallback onSkip
    final bool isLoading
    final bool isPermanentlyDenied
- Loading state: show CircularProgressIndicator with "Getting your location..."
- Success state (lat and lng not null): green icon, show 4 decimal places, show Refresh button that calls onRetry
- PermanentlyDenied state: red icon, "Open Settings" button that calls openSettings then onRetry after 1 second delay
- Soft-denied / GPS off state: orange icon, explanation text, "Skip for now" button calling onSkip, "Try Again" button calling onRetry

register_screen.dart modifications:
- Add state variables: double? _lat, double? _lng, bool _locationLoading = false, bool _locationDeniedForever = false
- Add method _fetchLocation() that:
    - Sets _locationLoading = true
    - Calls LocationService.getCurrentLocation()
    - On success: sets _lat and _lng
    - On null: calls LocationService.isPermanentlyDenied() and sets _locationDeniedForever
    - Always sets _locationLoading = false in finally
- Call _fetchLocation() in initState()
- Add LocationTileWidget to the form, passing current state values
- In the submit method, include lat and lng in the payload ONLY if both are non-null
- After successful registration, if response.locationRequired == true, show a MaterialBanner
  with message "Set your location to get better donor matches nearby" and two actions:
  "Set Now" (navigate to /profile/location) and "Later" (dismiss)

auth_service.dart modifications:
- Add locationRequired field to the RegisterResponse model/class
- Parse it from the response JSON: response['data']['locationRequired'] ?? false

==================================================
STYLE RULES
==================================================

- Use const constructors wherever possible
- No print() statements — use debugPrint() if logging is needed
- Handle all async errors with try/catch, never let exceptions bubble to UI
- Follow the existing code style in the file you are modifying
- Do not add any packages — only use geolocator which is already installed

==================================================
DO NOT
==================================================

- Do not use Google Maps SDK
- Do not hardcode any coordinates
- Do not add any new dependencies to pubspec.yaml
- Do not create any backend files — backend is already done
- Do not show the raw coordinates to the user in any prominent way (4 decimal display only in the success tile subtitle)

==================================================
DELIVER
==================================================

Create all files and modifications described above.
After each file, explain in one sentence what it does.
```

---

## 6. Summary of All Changes

| Layer | File | Change | Risk |
|-------|------|--------|------|
| Backend | `auth.validation.js` | Add optional `lat`/`lng` with paired validation | Zero — additive |
| Backend | `auth.service.js` | Store coordinates if present, return `locationRequired` flag | Zero — additive |
| Backend | `errorCodes.js` | Two new error constants | Zero |
| Flutter | `location_service.dart` | New file — GPS wrapper | Zero |
| Flutter | `location_tile_widget.dart` | New widget — all location states | Zero |
| Flutter | `register_screen.dart` | Add location tile + payload + banner | Low |
| Flutter | `auth_service.dart` | Parse `locationRequired` from response | Low |

**No existing endpoints change. No existing Flutter screens break. Governorate-only matching continues to work for users who skip GPS.**
