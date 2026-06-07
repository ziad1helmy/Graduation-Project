# Response Coverage Audit: Verified Client Needs

This document lists **only** the response contracts and fields that are actively needed and consumed by the Flutter application, verified from the codebase.

For each active endpoint, we provide the concrete Flutter code evidence, the list of consumed fields, and the minimum required JSON response payload containing only those consumed fields.

## Donor Module

### Endpoint

```http
GET /donor/activity
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Activity timeline retrieved successfully",
  "data": {
    "activities": [
      {
        "id": "69f3df915f42685cbbbcbb18",
        "title": "Profile Completed",
        "description": "Aya Hassan completed her donor profile and enabled donation alerts.",
        "type": "profile_update",
        "action": "profile_completed",
        "referenceId": "activity_profile_aya_hassan",
        "icon": "user-check",
        "metadata": {},
        "createdAt": "2026-05-10T09:00:00.000Z"
      },
      {
        "id": "69fe540565ff7785a031314f",
        "title": "Urgent Request Nearby",
        "description": "Cairo Care Hospital needs O+ blood donors for an urgent case.",
        "type": "emergency_response",
        "action": "notification_received",
        "referenceId": "69fe540565ff7785a031314f",
        "icon": "bell",
        "metadata": {},
        "createdAt": "2026-05-11T08:00:00.000Z"
      },
      {
        "id": "69fe540565ff7785a031315b",
        "title": "Appointment Requested",
        "description": "Aya requested an urgent appointment for an O+ donation.",
        "type": "appointment",
        "action": "appointment_created",
        "referenceId": "69fe540565ff7785a031315b",
        "icon": "calendar-plus",
        "metadata": {},
        "createdAt": "2026-05-11T09:00:00.000Z"
      },
      {
        "id": "69fe540565ff7785a0313157",
        "title": "200 Points Earned â€” Blood Donation",
        "description": "Points awarded for completed blood donation.",
        "type": "reward",
        "action": "earned_points",
        "referenceId": "points_donation_69fe540565ff7785a0313157",
        "icon": "gift",
        "createdAt": "2026-05-12T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Verified Required Fields

* `data.activities` : Screens/Widgets: `activities_api_data_source.dart`, `activities_remote_data_source.dart`
* `data.activities[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.activities[].title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.activities[].description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`
* `data.activities[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.activities[].action` : Screens/Widgets: `donor_register_form.dart`, `log_item.dart`
* `data.activities[].referenceId` : Screens/Widgets: `points_history.dart`
* `data.activities[].icon` : Screens/Widgets: `custom_dropdown.dart`, `custom_drop_down_button_form_field.dart` \| Models: `state_model.dart`, `onboarding_model.dart`
* `data.activities[].metadata` : Context: `app_localizations.dart`
* `data.activities[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`
* `data.pagination.hasNextPage` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`
* `data.pagination.hasPrevPage` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`

---

### Endpoint

```http
GET /donor/profile
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donor profile retrieved successfully",
  "data": {
    "_id": "66f100000000000000000002",
    "fullName": "Aya Hassan",
    "email": "aya.hassan@example.com",
    "role": "donor",
    "phoneNumber": "01011111111",
    "bloodType": "O+",
    "gender": "female",
    "weight": 60,
    "location": {
      "city": "Cairo",
      "governorate": "Cairo",
      "coordinates": {
        "lat": 30.0444,
        "lng": 31.2357
      }
    },
    "dateOfBirth": "1995-05-15",
    "isOptedIn": true,
    "verificationStatus": "verified",
    "age": 31,
    "stats": {
      "totalDonations": 8,
      "points": 2340,
      "livesSaved": 24
    },
    "currentBadge": "First Timer",
    "nextBadge": "Regular Donor",
    "progressPercentage": 40,
    "badgeProgress": {
      "currentBadge": "First Timer",
      "nextBadge": "Regular Donor",
      "progressPercentage": 40
    }
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.gender` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.weight` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `me_model.dart`
* `data.location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location.coordinates` : Screens/Widgets: `build_location_card.dart`, `map_view.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart`
* `data.location.coordinates.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.location.coordinates.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.dateOfBirth` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.isOptedIn` : Models: `me_model.dart`, `sign_up_model.dart`
* `data.verificationStatus` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.age` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`
* `data.stats` : Screens/Widgets: `skeleton_loaders.dart`, `donation_stats_card.dart`
* `data.stats.totalDonations` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.stats.points` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `badge_data.dart`, `confirmation_data.dart`
* `data.stats.livesSaved` : Screens/Widgets: `donation_stats_card.dart`, `donor_state_model.dart`
* `data.currentBadge` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.nextBadge` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.progressPercentage` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.badgeProgress` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.badgeProgress.currentBadge` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.badgeProgress.nextBadge` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.badgeProgress.progressPercentage` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`

---

### Endpoint

```http
PUT /donor/profile
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donor profile updated successfully",
  "data": {
    "_id": "66f100000000000000000002",
    "fullName": "Aya Hassan",
    "email": "aya.hassan@example.com",
    "role": "donor",
    "phoneNumber": "01011111111",
    "bloodType": "O+",
    "gender": "female",
    "weight": 60,
    "location": {
      "city": "Cairo",
      "governorate": "Cairo",
      "coordinates": {
        "lat": 30.0444,
        "lng": 31.2357
      }
    },
    "dateOfBirth": "1995-05-15",
    "isOptedIn": true
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.gender` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.weight` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `me_model.dart`
* `data.location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location.coordinates` : Screens/Widgets: `build_location_card.dart`, `map_view.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart`
* `data.location.coordinates.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.location.coordinates.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.dateOfBirth` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.isOptedIn` : Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
GET /donor/stats
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donor stats retrieved",
  "data": {
    "totalDonations": 8,
    "points": 2340,
    "livesSaved": 24
  }
}
```

### Verified Required Fields

* `data.totalDonations` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.points` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `badge_data.dart`, `confirmation_data.dart`
* `data.livesSaved` : Screens/Widgets: `donation_stats_card.dart`, `donor_state_model.dart`

---

### Endpoint

```http
GET /donor/rewards
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donor rewards retrieved",
  "data": {
    "currentPoints": 2340,
    "earnedBadges": [
      {
        "id": "664a0f1a2b3c4d5e6f7a8b9c",
        "title": "First Timer",
        "description": "Completed your first blood donation"
      }
    ],
    "lockedBadges": [
      {
        "id": "664a0f1a2b3c4d5e6f7a8b9d",
        "title": "Regular Donor",
        "progress": 2,
        "target": 5
      }
    ]
  }
}
```

### Verified Required Fields

* `data.currentPoints` : Screens/Widgets: `rewards_screen.dart`, `custom_redeem_card.dart`
* `data.earnedBadges[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.earnedBadges[].title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.earnedBadges[].description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`
* `data.lockedBadges[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.lockedBadges[].title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.lockedBadges[].progress` : Screens/Widgets: `points_card.dart`, `rewards_screen.dart`
* `data.lockedBadges[].target` : Context: `maps.dart`

---

### Endpoint

```http
GET /donor/settings
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donor settings retrieved successfully",
  "data": {
    "settings": {
      "pushNotifications": true,
      "emergencyAlerts": true,
      "privacyMode": false,
      "language": "en"
    }
  }
}
```

### Verified Required Fields

* `data.settings` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.settings.pushNotifications` : Screens/Widgets: `setting_api_data_source.dart`, `setting_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.settings.emergencyAlerts` : Screens/Widgets: `setting_api_data_source.dart`, `setting_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.settings.privacyMode` : Screens/Widgets: `setting_api_data_source.dart`, `setting_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.settings.language` : Screens/Widgets: `setting_api_data_source.dart`, `setting_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
PUT /donor/settings
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donor settings updated successfully",
  "data": {
    "settings": {
      "pushNotifications": false,
      "emergencyAlerts": true,
      "privacyMode": true,
      "language": "ar"
    }
  }
}
```

### Verified Required Fields

* `data.settings` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.settings.pushNotifications` : Screens/Widgets: `setting_api_data_source.dart`, `setting_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.settings.emergencyAlerts` : Screens/Widgets: `setting_api_data_source.dart`, `setting_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.settings.privacyMode` : Screens/Widgets: `setting_api_data_source.dart`, `setting_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.settings.language` : Screens/Widgets: `setting_api_data_source.dart`, `setting_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
GET /donor/requests
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Requests retrieved successfully",
  "data": {
    "requests": [
      {
        "id": "69fe540565ff7785a031314f",
        "requestId": "69fe540565ff7785a031314f",
        "bloodType": "O+",
        "hospitalName": "Cairo Care Hospital",
        "patientType": "Emergency surgery support",
        "contactNumber": "1044444444",
        "unitsNeeded": 3,
        "isEmergency": true,
        "createdAt": "2026-05-07T09:00:00.000Z",
        "status": "pending",
        "requestStatus": "pending",
        "urgency": "critical",
        "type": "blood",
        "requiredBy": "2026-05-11T10:00:00.000Z",
        "locationHospital": {
          "latitude": 30.0511,
          "longitude": 31.2435
        },
        "location": {
          "lat": 30.0511,
          "lng": 31.2435
        },
        "qrToken": "demo-request-qr-token",
        "qrCreatedAt": "2026-05-07T10:00:00.000Z",
        "qrExpiresAt": "2026-05-07T12:00:00.000Z",
        "hospital": {
          "id": "69f3df915f42685cbbbcbb1b",
          "name": "Cairo Care Hospital",
          "contactNumber": "1044444444"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0
    }
  }
}
```

### Verified Required Fields

* `data.requests` : Screens/Widgets: `admin_main_layout.dart`, `admin_request.dart`
* `data.requests[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.requests[].requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.requests[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.requests[].hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.requests[].patientType` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.requests[].contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.requests[].unitsNeeded` : Screens/Widgets: `alerts_dialog.dart`, `critical_alerts_card.dart` \| Models: `alert.dart`
* `data.requests[].isEmergency` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.requests[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.requests[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.requests[].requestStatus` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.requests[].urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.requests[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.requests[].requiredBy` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.requests[].locationHospital` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.requests[].locationHospital.latitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.requests[].locationHospital.longitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.requests[].location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.requests[].location.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.requests[].location.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.requests[].qrToken` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.requests[].qrCreatedAt` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.requests[].qrExpiresAt` : Screens/Widgets: `appointment_model.dart`, `book_appointment_model.dart`
* `data.requests[].hospital` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `user_role.dart`
* `data.requests[].hospital.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.requests[].hospital.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.requests[].hospital.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`

---

### Endpoint

```http
GET /donor/matches
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Matching requests retrieved successfully",
  "data": {
    "matches": [
      {
        "compatibility": {
          "eligible": true,
          "distanceKm": 2.4
        },
        "request": {
          "_id": "69fe540565ff7785a031314f",
          "type": "blood",
          "bloodType": [
            "O+"
          ],
          "urgency": "critical",
          "status": "pending",
          "isEmergency": true,
          "quantity": 3,
          "unitsNeeded": 3,
          "requiredBy": "2026-05-20T00:00:00.000Z",
          "hospitalName": "Cairo Care Hospital",
          "hospitalContact": "1044444444",
          "createdAt": "2026-05-16T08:15:00.000Z",
          "locationHospital": {
            "latitude": 30.0511,
            "longitude": 31.2435
          },
          "hospital": {
            "id": "69f3df915f42685cbbbcbb1b",
            "name": "Cairo Care Hospital",
            "contactNumber": "1044444444",
            "address": "Cairo, Egypt",
            "latitude": 30.0511,
            "longitude": 31.2435
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1
    }
  }
}
```

### Verified Required Fields

* `data.matches` : Context: `app_localizations.dart`, `app_localizations_en.dart`
* `data.matches[].compatibility.eligible` : Context: `app_localizations.dart`, `app_localizations_en.dart`
* `data.matches[].compatibility.distanceKm` : Screens/Widgets: `location_step.dart`, `nearby_hospitals.dart`
* `data.matches[].request` : Screens/Widgets: `admin_auth_view_model.dart`, `admin_request.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.matches[].request._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.matches[].request.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.matches[].request.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.matches[].request.urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.matches[].request.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.matches[].request.isEmergency` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.matches[].request.quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.matches[].request.unitsNeeded` : Screens/Widgets: `alerts_dialog.dart`, `critical_alerts_card.dart` \| Models: `alert.dart`
* `data.matches[].request.requiredBy` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.matches[].request.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.matches[].request.hospitalContact` : Screens/Widgets: `admin_request.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.matches[].request.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.matches[].request.locationHospital` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.matches[].request.locationHospital.latitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.matches[].request.locationHospital.longitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.matches[].request.hospital` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `user_role.dart`
* `data.matches[].request.hospital.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.matches[].request.hospital.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.matches[].request.hospital.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.matches[].request.hospital.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.matches[].request.hospital.latitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.matches[].request.hospital.longitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`

---

### Endpoint

```http
POST /donor/respond/:requestId
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Response submitted successfully",
  "data": {
    "_id": "66f100000000000000000010",
    "donorId": "66f100000000000000000002",
    "requestId": "66f100000000000000000020",
    "quantity": 1,
    "status": "pending"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`

---

### Endpoint

```http
GET /donor/donation-eligibility
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Eligibility result",
  "data": {
    "isEligible": true,
    "reason": null,
    "nextEligibleDate": null,
    "participationEnabled": true,
    "lastDonationDate": "2026-05-10T00:00:00.000Z",
    "cooldownDays": 56,
    "daysRemaining": 0
  }
}
```

### Verified Required Fields

* `data.isEligible` : Screens/Widgets: `donation_eligibility_model.dart`, `donation_status_section.dart`
* `data.reason` : Screens/Widgets: `donation_eligibility_model.dart`, `donation_status_section.dart`
* `data.nextEligibleDate` : Screens/Widgets: `donation_eligibility_model.dart`, `donation_status_section.dart`
* `data.participationEnabled` : Screens/Widgets: `donation_eligibility_model.dart`
* `data.lastDonationDate` : Screens/Widgets: `donor_tile.dart`, `donation_eligibility_model.dart` \| Models: `donor.dart`
* `data.cooldownDays` : Screens/Widgets: `donation_eligibility_model.dart`
* `data.daysRemaining` : Screens/Widgets: `donation_eligibility_model.dart`, `donation_status_section.dart`

---

### Endpoint

```http
GET /donor/dashboard
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donor dashboard retrieved successfully",
  "data": {
    "userInfo": {
      "firstName": "Aya",
      "fullName": "Aya Hassan",
      "bloodType": "O+",
      "donationStatus": "eligible"
    },
    "stats": {
      "totalDonations": 8,
      "points": 2340,
      "livesSaved": 24
    },
    "recentActivity": [
      {
        "id": "66fe00000000000000000001",
        "title": "Donation Confirmed",
        "description": "Completed a blood donation at Cairo Care Hospital",
        "type": "donation",
        "createdAt": "2026-05-10T12:35:00.000Z"
      }
    ],
    "badges": {
      "unlockedCount": 2,
      "totalCount": 7,
      "completionPercentage": 29
    }
  }
}
```

### Verified Required Fields

* `data.userInfo.firstName` : Screens/Widgets: `donation_schedule.dart`, `donation_booking_card.dart`
* `data.userInfo.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.userInfo.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.userInfo.donationStatus` : Screens/Widgets: `home.dart`, `donation_status_section.dart`
* `data.stats` : Screens/Widgets: `skeleton_loaders.dart`, `donation_stats_card.dart`
* `data.stats.totalDonations` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.stats.points` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `badge_data.dart`, `confirmation_data.dart`
* `data.stats.livesSaved` : Screens/Widgets: `donation_stats_card.dart`, `donor_state_model.dart`
* `data.recentActivity[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.recentActivity[].title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.recentActivity[].description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`
* `data.recentActivity[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.recentActivity[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.badges` : Screens/Widgets: `profile.dart`, `achievement_badges_card.dart`
* `data.badges.unlockedCount` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges.totalCount` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges.completionPercentage` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`

---

### Endpoint

```http
GET /donor/recent-activity
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Recent activity retrieved successfully",
  "data": {
    "donations": {
      "donations": [
        {
          "_id": "69fe540565ff7785a0313157",
          "status": "completed",
          "quantity": 1,
          "pointsEarned": 200,
          "createdAt": "2026-05-10T12:35:00.000Z"
        }
      ],
      "pagination": {
        "total": 1,
        "page": 1,
        "limit": 20,
        "totalPages": 1
      }
    },
    "points": {
      "transactions": [
        {
          "_id": "66fc00000000000000000001",
          "pointsAmount": 200,
          "transactionType": "BLOOD_DONATION",
          "description": "Blood Donation - Successful",
          "balanceAfter": 2340,
          "createdAt": "2026-05-10T12:35:00.000Z"
        }
      ],
      "pagination": {
        "total": 1,
        "page": 1,
        "limit": 20,
        "totalPages": 1
      }
    }
  }
}
```

### Verified Required Fields

* `data.donations` : Screens/Widgets: `donor_tile.dart`, `user_detail_dialog.dart`
* `data.donations.donations` : Screens/Widgets: `donor_tile.dart`, `user_detail_dialog.dart`
* `data.donations.donations[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donations.donations[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.donations.donations[].quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.donations.donations[].pointsEarned` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.donations.donations[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.donations.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.donations.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.donations.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.donations.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.donations.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`
* `data.points` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `badge_data.dart`, `confirmation_data.dart`
* `data.points.transactions` : Screens/Widgets: `points_history.dart`, `rewards_tab.dart`
* `data.points.transactions[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.points.transactions[].pointsAmount` : Screens/Widgets: `points_history.dart`, `rewards_tab.dart`
* `data.points.transactions[].transactionType` : Screens/Widgets: `points_history.dart`, `rewards_tab.dart`
* `data.points.transactions[].description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`
* `data.points.transactions[].balanceAfter` : Screens/Widgets: `points_history.dart`
* `data.points.transactions[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.points.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.points.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.points.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.points.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.points.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`

---

### Endpoint

```http
GET /donor/history
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donation history retrieved successfully",
  "data": {
    "donations": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0
    }
  }
}
```

### Verified Required Fields

* `data.donations` : Screens/Widgets: `donor_tile.dart`, `user_detail_dialog.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`

---

### Endpoint

```http
GET /donor/donations
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donation history retrieved successfully",
  "data": {
    "donations": [
      {
        "_id": "664a0f1a2b3c4d5e6f7a8b9c",
        "status": "completed",
        "quantity": 1,
        "pointsEarned": 100,
        "createdAt": "2026-05-01T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "pages": 1
    }
  }
}
```

### Verified Required Fields

* `data.donations` : Screens/Widgets: `donor_tile.dart`, `user_detail_dialog.dart`
* `data.donations[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donations[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.donations[].quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.donations[].pointsEarned` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.donations[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.pages` : Screens/Widgets: `notifications_model.dart`, `pdf_viewer_screen.dart`

---

### Endpoint

```http
GET /donor/points
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Points retrieved successfully",
  "data": {
    "points": 2340,
    "tier": "SILVER",
    "nextTier": "GOLD",
    "pointsToNextTier": 660
  }
}
```

### Verified Required Fields

* `data.points` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `badge_data.dart`, `confirmation_data.dart`
* `data.tier` : Screens/Widgets: `profile.dart`, `badges_tab.dart`
* `data.nextTier` : Screens/Widgets: `profile.dart`, `points_model.dart`
* `data.pointsToNextTier` : Screens/Widgets: `profile.dart`, `points_model.dart`

---

### Endpoint

```http
GET /donor/badges
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Badges retrieved successfully",
  "data": {
    "unlockedCount": 3,
    "totalCount": 7,
    "completionPercentage": 43,
    "badges": [
      {
        "badgeId": "66fd00000000000000000003",
        "badgeName": "Life Saver",
        "badgeDescription": "Completed 10 blood donations",
        "badgeIcon": "star",
        "category": "DONATION",
        "rarity": "RARE",
        "unlockStatus": "LOCKED",
        "unlockedAt": null,
        "progressCurrent": 8,
        "progressTarget": 10,
        "progressPercentage": 80
      }
    ],
    "stats": {
      "totalDonations": 8,
      "totalEmergencyResponses": 2,
      "daysAsDonor": 123
    }
  }
}
```

### Verified Required Fields

* `data.unlockedCount` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.totalCount` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.completionPercentage` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges` : Screens/Widgets: `profile.dart`, `achievement_badges_card.dart`
* `data.badges[].badgeId` : Screens/Widgets: `badges_model.dart`
* `data.badges[].badgeName` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].badgeDescription` : Screens/Widgets: `badges_model.dart`
* `data.badges[].badgeIcon` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.badges[].rarity` : Screens/Widgets: `badges_model.dart`
* `data.badges[].unlockStatus` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].unlockedAt` : Screens/Widgets: `badges_model.dart`
* `data.badges[].progressCurrent` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].progressTarget` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].progressPercentage` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.stats` : Screens/Widgets: `skeleton_loaders.dart`, `donation_stats_card.dart`
* `data.stats.totalDonations` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.stats.totalEmergencyResponses` : Screens/Widgets: `badges_model.dart`
* `data.stats.daysAsDonor` : Screens/Widgets: `badges_model.dart`

---

### Endpoint

```http
GET /donor/redemptions
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Redemptions retrieved successfully",
  "data": {
    "redemptions": [
      {
        "_id": "66f400000000000000000001",
        "donorId": "66f100000000000000000002",
        "rewardId": {
          "_id": "66f400000000000000000101",
          "name": "Gift Card",
          "category": "voucher",
          "iconType": "gift"
        },
        "pointsSpent": 500,
        "confirmationCode": "RWD-2026-ABC123",
        "status": "CONFIRMED",
        "expiresAt": "2026-06-17T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

### Verified Required Fields

* `data.redemptions[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.redemptions[].donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.redemptions[].rewardId` : Screens/Widgets: `rewards_api_data_source.dart`, `rewards_remote_data_source.dart`
* `data.redemptions[].rewardId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.redemptions[].rewardId.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.redemptions[].rewardId.category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.redemptions[].rewardId.iconType` : Screens/Widgets: `rewards_model.dart`, `rewards_tab.dart`
* `data.redemptions[].pointsSpent` : Screens/Widgets: `redeem_reward.dart`
* `data.redemptions[].confirmationCode` : Screens/Widgets: `redeem_reward.dart`
* `data.redemptions[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.redemptions[].expiresAt` : Screens/Widgets: `redeem_reward.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.pages` : Screens/Widgets: `notifications_model.dart`, `pdf_viewer_screen.dart`

---

### Endpoint

```http
GET /donor/notifications
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Notifications retrieved",
  "data": {
    "notifications": [
      {
        "_id": "6663df915f42685cbbbcbb23",
        "title": "New Blood Request",
        "message": "LifeLink General Hospital needs O- blood urgently.",
        "type": "URGENT_REQUEST",
        "isRead": false,
        "createdAt": "2026-06-01T12:00:00.000Z",
        "updatedAt": "2026-06-01T12:00:00.000Z"
      }
    ]
  }
}
```

### Verified Required Fields

* `data.notifications` : Screens/Widgets: `home.dart`, `fcm_api_data_source.dart`
* `data.notifications[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.notifications[].title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.notifications[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.notifications[].isRead` : Screens/Widgets: `notification_request.dart`
* `data.notifications[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.notifications[].updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
PUT /donor/participation
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Participation preference updated successfully",
  "data": {
    "_id": "66f100000000000000000002",
    "fullName": "Aya Hassan",
    "isOptedIn": false
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.isOptedIn` : Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
PUT /donor/availability
```

### Flutter Screens / Files Using It

* **Called From:** Donor Profile, Dashboard, Donation History

### Minimum Required Response

```json
{
  "success": true,
  "message": "Participation settings updated successfully",
  "data": {
    "participation": {
      "isAvailable": true
    }
  }
}
```

### Verified Required Fields

* `data.participation.isAvailable` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `me_model.dart`

---

## Admin Module

### Endpoint

```http
GET /admin/profile
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Admin profile",
  "data": {
    "admin": {
      "_id": "66f200000000000000000001",
      "fullName": "Noura Hassan",
      "email": "admin@lifelink.demo",
      "role": "admin",
      "phone": "01122223333",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo"
      },
      "isVerified": true,
      "isSuspended": false,
      "createdAt": "2026-01-10T08:30:00.000Z",
      "updatedAt": "2026-05-18T08:30:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.admin` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `admin_login_model.dart` \| DataSources: `admin_hive_data_source.dart`
* `data.admin._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.admin.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.admin.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.admin.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.admin.phone` : Screens/Widgets: `donor_register_form.dart`, `admin_detail_card.dart` \| Models: `user_model.dart`, `admin_login_model.dart`
* `data.admin.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.admin.address.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.admin.address.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.admin.isVerified` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.admin.isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.admin.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.admin.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
GET /admin/system/health
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "System health",
  "data": {
    "status": "healthy",
    "database": "connected",
    "memory": {
      "used": "96 MB",
      "total": "128 MB"
    }
  }
}
```

### Verified Required Fields

* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.database` : Context: `app_localizations.dart`, `app_localizations_en.dart`
* `data.memory.used` : Repositories: `location_repository.dart`
* `data.memory.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`

---

### Endpoint

```http
GET /admin/system/maintenance
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Maintenance status",
  "data": {
    "enabled": false,
    "message": "Demo mode active"
  }
}
```

### Verified Required Fields

* `data.enabled` : Screens/Widgets: `custom_pin_code.dart`, `custom_trends_chart.dart` \| Cubits/Blocs: `map_cubit.dart`

---

### Endpoint

```http
GET /admin/statistics
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Statistics summary",
  "data": {
    "users": {
      "total": 284,
      "donors": 231,
      "hospitals": 41
    },
    "requests": {
      "active": 19,
      "critical": 4
    },
    "donations": {
      "pending": 13,
      "completed": 428
    },
    "alerts": {}
  }
}
```

### Verified Required Fields

* `data.users` : Screens/Widgets: `admin_main_layout.dart`, `users.dart`
* `data.users.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.users.donors` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart`
* `data.users.hospitals` : Screens/Widgets: `critical_alerts_card.dart`, `users.dart`
* `data.requests` : Screens/Widgets: `admin_main_layout.dart`, `admin_request.dart`
* `data.requests.active` : Screens/Widgets: `donor_tile.dart`, `user_card.dart` \| Models: `summary_model.dart`
* `data.requests.critical` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart`
* `data.donations` : Screens/Widgets: `donor_tile.dart`, `user_detail_dialog.dart`
* `data.donations.pending` : Screens/Widgets: `users.dart`, `appointment_model.dart` \| Models: `donation_details.dart`
* `data.donations.completed` : Screens/Widgets: `donation_booking_card.dart`, `donation_stats_card.dart` \| Models: `summary_model.dart`
* `data.alerts` : Screens/Widgets: `critical_alerts_card.dart`

---

### Endpoint

```http
GET /admin/dashboard
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Dashboard summary",
  "data": {
    "users": {
      "total": 284,
      "donors": 231,
      "hospitals": 41
    },
    "requests": {
      "active": 19,
      "critical": 4
    },
    "donations": {
      "pending": 13,
      "completed": 428
    },
    "alerts": {}
  }
}
```

### Verified Required Fields

* `data.users` : Screens/Widgets: `admin_main_layout.dart`, `users.dart`
* `data.users.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.users.donors` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart`
* `data.users.hospitals` : Screens/Widgets: `critical_alerts_card.dart`, `users.dart`
* `data.requests` : Screens/Widgets: `admin_main_layout.dart`, `admin_request.dart`
* `data.requests.active` : Screens/Widgets: `donor_tile.dart`, `user_card.dart` \| Models: `summary_model.dart`
* `data.requests.critical` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart`
* `data.donations` : Screens/Widgets: `donor_tile.dart`, `user_detail_dialog.dart`
* `data.donations.pending` : Screens/Widgets: `users.dart`, `appointment_model.dart` \| Models: `donation_details.dart`
* `data.donations.completed` : Screens/Widgets: `donation_booking_card.dart`, `donation_stats_card.dart` \| Models: `summary_model.dart`
* `data.alerts` : Screens/Widgets: `critical_alerts_card.dart`

---

### Endpoint

```http
GET /admin/alerts
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Alerts retrieved successfully",
  "data": {
    "alerts": {
      "criticalRequests": [
        {
          "_id": "69fe540565ff7785a031314f",
          "bloodType": "O-",
          "urgency": "critical",
          "status": "pending",
          "hospitalId": {
            "_id": "69f3df915f42685cbbbcbb1b",
            "hospitalName": "Cairo Care Hospital",
            "contactNumber": "0223456789"
          }
        }
      ],
      "shortageAlerts": [
        {
          "bloodType": "O-",
          "activeRequests": 6,
          "status": "shortage"
        }
      ]
    }
  }
}
```

### Verified Required Fields

* `data.alerts` : Screens/Widgets: `critical_alerts_card.dart`
* `data.alerts.criticalRequests[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.alerts.criticalRequests[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.alerts.criticalRequests[].urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.alerts.criticalRequests[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.alerts.criticalRequests[].hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.alerts.criticalRequests[].hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.alerts.criticalRequests[].hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.alerts.criticalRequests[].hospitalId.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.alerts.shortageAlerts[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.alerts.shortageAlerts[].activeRequests` : Screens/Widgets: `admin_request.dart`, `dashboard.dart`
* `data.alerts.shortageAlerts[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`

---

### Endpoint

```http
GET /admin/blood-inventory-summary
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Blood inventory summary",
  "data": {
    "hospitalId": null,
    "bloodTypeTotals": {
      "A+": {
        "bloodType": "A+",
        "shortage": false
      },
      "O-": {
        "bloodType": "O-",
        "shortage": true
      }
    },
    "lowStockAlerts": [
      {
        "bloodType": "O-",
        "message": "Shortage detected for O-: 5 unit(s) needed"
      }
    ],
    "shortageAlerts": [
      {
        "bloodType": "O-",
        "activeRequests": 6,
        "status": "shortage"
      }
    ],
    "requestStats": {
      "total": 68,
      "byStatus": {
        "pending": 14,
        "completed": 41,
        "cancelled": 8
      },
      "byUrgency": {
        "low": 2,
        "medium": 6,
        "high": 7,
        "critical": 4
      },
      "byBloodType": {
        "A+": 4,
        "B+": 3,
        "O-": 6
      }
    }
  }
}
```

### Verified Required Fields

* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.bloodTypeTotals.A+` : Screens/Widgets: `donor_register_form.dart`, `admin_request.dart`
* `data.bloodTypeTotals.A+.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.bloodTypeTotals.A+.shortage` : Screens/Widgets: `critical_alerts_card.dart`
* `data.bloodTypeTotals.O-` : Screens/Widgets: `donor_register_form.dart`, `blood_type_chart.dart`
* `data.bloodTypeTotals.O-.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.bloodTypeTotals.O-.shortage` : Screens/Widgets: `critical_alerts_card.dart`
* `data.lowStockAlerts[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.shortageAlerts[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.shortageAlerts[].activeRequests` : Screens/Widgets: `admin_request.dart`, `dashboard.dart`
* `data.shortageAlerts[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.requestStats.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.requestStats.byStatus.pending` : Screens/Widgets: `users.dart`, `appointment_model.dart` \| Models: `donation_details.dart`
* `data.requestStats.byStatus.completed` : Screens/Widgets: `donation_booking_card.dart`, `donation_stats_card.dart` \| Models: `summary_model.dart`
* `data.requestStats.byStatus.cancelled` : Screens/Widgets: `admin_auth_view_model.dart`, `appointment_cancelled_model.dart` \| Models: `donation_details.dart`, `summary_model.dart`
* `data.requestStats.byUrgency.low` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `blood_request.dart`, `urgency_level.dart`
* `data.requestStats.byUrgency.medium` : Screens/Widgets: `loading_state.dart`, `admin_action_card.dart` \| Models: `blood_request.dart`, `urgency_level.dart`
* `data.requestStats.byUrgency.high` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `blood_request.dart`, `urgency_level.dart`
* `data.requestStats.byUrgency.critical` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart`
* `data.requestStats.byBloodType.A+` : Screens/Widgets: `donor_register_form.dart`, `admin_request.dart`
* `data.requestStats.byBloodType.B+` : Screens/Widgets: `donor_register_form.dart`, `admin_request.dart`
* `data.requestStats.byBloodType.O-` : Screens/Widgets: `donor_register_form.dart`, `blood_type_chart.dart`

---

### Endpoint

```http
GET /admin/rewards/config
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Rewards config retrieved successfully",
  "data": {
    "points": {
      "referral": 50
    },
    "tiers": {
      "bronze": 0,
      "silver": 500,
      "gold": 1500,
      "platinum": 3000
    },
    "tierBonuses": {
      "silver": 50,
      "gold": 100,
      "platinum": 200
    }
  }
}
```

### Verified Required Fields

* `data.points` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `badge_data.dart`, `confirmation_data.dart`
* `data.points.referral` : Screens/Widgets: `earning_rules_models.dart`, `rewards_tab.dart`
* `data.tiers` : Screens/Widgets: `profile.dart`
* `data.tiers.bronze` : Screens/Widgets: `donor_tile.dart`, `profile.dart`
* `data.tiers.silver` : Screens/Widgets: `donor_tile.dart`, `profile.dart`
* `data.tiers.gold` : Screens/Widgets: `home.dart`, `notifications.dart`
* `data.tiers.platinum` : Screens/Widgets: `profile.dart`, `points_model.dart`
* `data.tierBonuses.silver` : Screens/Widgets: `donor_tile.dart`, `profile.dart`
* `data.tierBonuses.gold` : Screens/Widgets: `home.dart`, `notifications.dart`
* `data.tierBonuses.platinum` : Screens/Widgets: `profile.dart`, `points_model.dart`

---

### Endpoint

```http
PUT /admin/rewards/config
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Rewards config updated successfully",
  "data": {
    "points": {
      "referral": 60
    },
    "tiers": {
      "bronze": 0,
      "silver": 600,
      "gold": 1700,
      "platinum": 3200
    },
    "tierBonuses": {
      "silver": 60,
      "gold": 120,
      "platinum": 240
    }
  }
}
```

### Verified Required Fields

* `data.points` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `badge_data.dart`, `confirmation_data.dart`
* `data.points.referral` : Screens/Widgets: `earning_rules_models.dart`, `rewards_tab.dart`
* `data.tiers` : Screens/Widgets: `profile.dart`
* `data.tiers.bronze` : Screens/Widgets: `donor_tile.dart`, `profile.dart`
* `data.tiers.silver` : Screens/Widgets: `donor_tile.dart`, `profile.dart`
* `data.tiers.gold` : Screens/Widgets: `home.dart`, `notifications.dart`
* `data.tiers.platinum` : Screens/Widgets: `profile.dart`, `points_model.dart`
* `data.tierBonuses.silver` : Screens/Widgets: `donor_tile.dart`, `profile.dart`
* `data.tierBonuses.gold` : Screens/Widgets: `home.dart`, `notifications.dart`
* `data.tierBonuses.platinum` : Screens/Widgets: `profile.dart`, `points_model.dart`

---

### Endpoint

```http
GET /admin/badges
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Badges retrieved successfully",
  "data": {
    "badges": [
      {
        "_id": "6663df915f42685cbbbcbb20",
        "badgeName": "First Blood",
        "badgeDescription": "Successfully complete your first donation",
        "badgeIcon": "blood-drop",
        "category": "DONATION",
        "rarity": "COMMON",
        "createdAt": "2026-06-01T12:00:00.000Z",
        "updatedAt": "2026-06-01T12:00:00.000Z"
      }
    ]
  }
}
```

### Verified Required Fields

* `data.badges` : Screens/Widgets: `profile.dart`, `achievement_badges_card.dart`
* `data.badges[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.badges[].badgeName` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].badgeDescription` : Screens/Widgets: `badges_model.dart`
* `data.badges[].badgeIcon` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.badges[].rarity` : Screens/Widgets: `badges_model.dart`
* `data.badges[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.badges[].updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
PATCH /admin/badges/:id
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Badge updated successfully",
  "data": {
    "badge": {
      "_id": "6663df915f42685cbbbcbb20",
      "badgeName": "First Blood",
      "badgeDescription": "Successfully complete your first donation",
      "badgeIcon": "blood-drop",
      "category": "DONATION",
      "rarity": "COMMON",
      "createdAt": "2026-06-01T12:00:00.000Z",
      "updatedAt": "2026-06-01T12:00:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.badge` : Screens/Widgets: `achievement_badges_card.dart`, `badge_tile.dart`
* `data.badge._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.badge.badgeName` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badge.badgeDescription` : Screens/Widgets: `badges_model.dart`
* `data.badge.badgeIcon` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badge.category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.badge.rarity` : Screens/Widgets: `badges_model.dart`
* `data.badge.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.badge.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
GET /admin/audit-logs
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Audit logs",
  "data": {
    "logs": [
      {
        "_id": "66f800000000000000000001",
        "adminId": {
          "_id": "66f200000000000000000001",
          "fullName": "Noura Hassan",
          "email": "admin@lifelink.demo",
          "role": "admin"
        },
        "action": "user.suspend",
        "createdAt": "2026-05-18T08:50:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

### Verified Required Fields

* `data.logs[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.logs[].adminId` : Screens/Widgets: `points_history.dart`
* `data.logs[].adminId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.logs[].adminId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.logs[].adminId.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.logs[].adminId.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.logs[].action` : Screens/Widgets: `donor_register_form.dart`, `log_item.dart`
* `data.logs[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`

---

### Endpoint

```http
GET /admin/inbound-emails
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Inbound emails retrieved successfully",
  "data": {
    "inboundEmails": [
      {
        "_id": "66f700000000000000000001",
        "from": "donor.followup@lifelink.demo",
        "to": [
          "support@lifelink.demo"
        ],
        "subject": "Donation follow-up",
        "isRead": false
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Verified Required Fields

* `data.inboundEmails[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.inboundEmails[].from` : Screens/Widgets: `admin_auth_view_model.dart`, `users.dart` \| Models: `me_model.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.inboundEmails[].to` : Screens/Widgets: `admin_authentication.dart`, `admin_main_layout.dart` \| Repositories: `location_repository.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.inboundEmails[].subject` : Screens/Widgets: `user_detail_dialog.dart`, `get_help_section.dart`
* `data.inboundEmails[].isRead` : Screens/Widgets: `notification_request.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`
* `data.pagination.hasNextPage` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`
* `data.pagination.hasPrevPage` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`

---

### Endpoint

```http
GET /admin/inbound-emails/:id
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Inbound email retrieved successfully",
  "data": {
    "inboundEmail": {
      "_id": "66f700000000000000000001",
      "from": "donor.followup@lifelink.demo",
      "to": [
        "support@lifelink.demo"
      ],
      "subject": "Donation follow-up",
      "text": "Please contact me about the donation process.",
      "isRead": false
    }
  }
}
```

### Verified Required Fields

* `data.inboundEmail._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.inboundEmail.from` : Screens/Widgets: `admin_auth_view_model.dart`, `users.dart` \| Models: `me_model.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.inboundEmail.to` : Screens/Widgets: `admin_authentication.dart`, `admin_main_layout.dart` \| Repositories: `location_repository.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.inboundEmail.subject` : Screens/Widgets: `user_detail_dialog.dart`, `get_help_section.dart`
* `data.inboundEmail.text` : Screens/Widgets: `custom_dropdown.dart`, `custom_drop_down_button_form_field.dart` \| Models: `state_model.dart`, `onboarding_model.dart`
* `data.inboundEmail.isRead` : Screens/Widgets: `notification_request.dart`

---

### Endpoint

```http
PATCH /admin/inbound-emails/:id/read
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Inbound email marked as read",
  "data": {
    "inboundEmail": {
      "_id": "66f700000000000000000001",
      "isRead": true
    }
  }
}
```

### Verified Required Fields

* `data.inboundEmail._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.inboundEmail.isRead` : Screens/Widgets: `notification_request.dart`

---

### Endpoint

```http
PATCH /admin/inbound-emails/:id/archive
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Inbound email archived",
  "data": {
    "inboundEmail": {
      "_id": "66f700000000000000000001"
    }
  }
}
```

### Verified Required Fields

* `data.inboundEmail._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`

---

### Endpoint

```http
DELETE /admin/inbound-emails/:id
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Inbound email deleted successfully",
  "data": {
    "inboundEmail": {
      "_id": "66f700000000000000000001"
    }
  }
}
```

### Verified Required Fields

* `data.inboundEmail._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`

---

### Endpoint

```http
GET /admin/support
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Support messages retrieved successfully",
  "data": {
    "docs": [
      {
        "_id": "6663df915f42685cbbbcbb21",
        "userId": "6663df915f42685cbbbcbb18",
        "fullName": "Ziad Sobhy",
        "email": "ziad@lifelink.demo",
        "role": "donor",
        "category": "TECHNICAL",
        "subject": "App crash on startup",
        "message": "The application crashes immediately after login on iOS.",
        "status": "OPEN",
        "createdAt": "2026-06-01T12:00:00.000Z",
        "updatedAt": "2026-06-01T12:00:00.000Z"
      }
    ],
    "limit": 10,
    "page": 1,
    "totalPages": 1,
    "hasPrevPage": false,
    "hasNextPage": false,
    "nextPage": null
  }
}
```

### Verified Required Fields

* `data.docs` : Screens/Widgets: `pdf_viewer_screen.dart`
* `data.docs[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.docs[].userId` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `validate_token_model.dart`
* `data.docs[].fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.docs[].email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.docs[].role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.docs[].category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.docs[].subject` : Screens/Widgets: `user_detail_dialog.dart`, `get_help_section.dart`
* `data.docs[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.docs[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.docs[].updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`
* `data.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`
* `data.hasPrevPage` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`
* `data.hasNextPage` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`
* `data.nextPage` : Screens/Widgets: `schedule_donation.dart`

---

### Endpoint

```http
GET /admin/support/:id
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Support message retrieved successfully",
  "data": {
    "ticket": {
      "_id": "6663df915f42685cbbbcbb21",
      "userId": "6663df915f42685cbbbcbb18",
      "fullName": "Ziad Sobhy",
      "email": "ziad@lifelink.demo",
      "role": "donor",
      "category": "TECHNICAL",
      "subject": "App crash on startup",
      "message": "The application crashes immediately after login on iOS.",
      "status": "OPEN",
      "createdAt": "2026-06-01T12:00:00.000Z",
      "updatedAt": "2026-06-01T12:00:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.ticket` : Screens/Widgets: `contact_support_dialog.dart`
* `data.ticket._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.ticket.userId` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `validate_token_model.dart`
* `data.ticket.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.ticket.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.ticket.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.ticket.category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.ticket.subject` : Screens/Widgets: `user_detail_dialog.dart`, `get_help_section.dart`
* `data.ticket.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.ticket.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.ticket.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
PATCH /admin/support/:id/review
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Support message marked as reviewed",
  "data": {
    "ticket": {
      "_id": "6663df915f42685cbbbcbb21",
      "userId": "6663df915f42685cbbbcbb18",
      "fullName": "Ziad Sobhy",
      "email": "ziad@lifelink.demo",
      "role": "donor",
      "category": "TECHNICAL",
      "subject": "App crash on startup",
      "message": "The application crashes immediately after login on iOS.",
      "status": "OPEN",
      "createdAt": "2026-06-01T12:00:00.000Z",
      "updatedAt": "2026-06-01T12:00:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.ticket` : Screens/Widgets: `contact_support_dialog.dart`
* `data.ticket._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.ticket.userId` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `validate_token_model.dart`
* `data.ticket.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.ticket.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.ticket.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.ticket.category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.ticket.subject` : Screens/Widgets: `user_detail_dialog.dart`, `get_help_section.dart`
* `data.ticket.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.ticket.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.ticket.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
POST /admin/support/:id/reply
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Support reply saved successfully",
  "data": {
    "ticket": {
      "_id": "6663df915f42685cbbbcbb21",
      "userId": "6663df915f42685cbbbcbb18",
      "fullName": "Ziad Sobhy",
      "email": "ziad@lifelink.demo",
      "role": "donor",
      "category": "TECHNICAL",
      "subject": "App crash on startup",
      "message": "The application crashes immediately after login on iOS.",
      "status": "OPEN",
      "createdAt": "2026-06-01T12:00:00.000Z",
      "updatedAt": "2026-06-01T12:00:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.ticket` : Screens/Widgets: `contact_support_dialog.dart`
* `data.ticket._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.ticket.userId` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `validate_token_model.dart`
* `data.ticket.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.ticket.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.ticket.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.ticket.category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.ticket.subject` : Screens/Widgets: `user_detail_dialog.dart`, `get_help_section.dart`
* `data.ticket.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.ticket.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.ticket.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
GET /admin/donors
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Users list",
  "data": {
    "users": [
      {
        "_id": "69f3df915f42685cbbbcbb18",
        "fullName": "Aya Hassan",
        "email": "aya.hassan@lifelink.demo",
        "role": "donor",
        "bloodType": "O+",
        "isEmailVerified": true,
        "isSuspended": false
      },
      {
        "_id": "69f3df915f42685cbbbcbb19",
        "fullName": "Mina Adel",
        "email": "mina.adel@lifelink.demo",
        "role": "donor",
        "bloodType": "A-",
        "isEmailVerified": true,
        "isSuspended": false
      }
    ],
    "total": 2,
    "page": 1,
    "limit": 10
  }
}
```

### Verified Required Fields

* `data.users` : Screens/Widgets: `admin_main_layout.dart`, `users.dart`
* `data.users[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.users[].fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.users[].email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.users[].role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.users[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.users[].isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.users[].isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`

---

### Endpoint

```http
GET /admin/hospitals
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Users list",
  "data": {
    "users": [
      {
        "_id": "69f3df915f42685cbbbcbb1b",
        "fullName": "Cairo Care Operations",
        "hospitalName": "Cairo Care Hospital",
        "email": "ops@cairocare.demo",
        "role": "hospital",
        "isEmailVerified": true,
        "isSuspended": false
      },
      {
        "_id": "69f3df925f42685cbbbcbb1c",
        "fullName": "Alexandria Health Desk",
        "hospitalName": "Alexandria Central Hospital",
        "email": "ops@alexcentral.demo",
        "role": "hospital",
        "isEmailVerified": true,
        "isSuspended": false
      }
    ],
    "total": 2,
    "page": 1,
    "limit": 10
  }
}
```

### Verified Required Fields

* `data.users` : Screens/Widgets: `admin_main_layout.dart`, `users.dart`
* `data.users[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.users[].fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.users[].hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.users[].email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.users[].role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.users[].isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.users[].isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`

---

### Endpoint

```http
GET /admin/donors/:id
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "User details",
  "data": {
    "user": {
      "_id": "69f3df915f42685cbbbcbb18",
      "fullName": "Aya Hassan",
      "email": "aya.hassan@lifelink.demo",
      "role": "donor",
      "bloodType": "O+",
      "phoneNumber": "01011111111",
      "isEmailVerified": true,
      "isSuspended": false,
      "createdAt": "2026-01-15T09:00:00.000Z",
      "pointsBalance": 850,
      "lifetimePointsEarned": 950,
      "tier": "silver",
      "eligibilitySummary": {
        "canDonate": true
      },
      "profile": {
        "age": 30,
        "weight": 60,
        "hemoglobinLevel": 13.5
      }
    }
  }
}
```

### Verified Required Fields

* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.user.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.user.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.user.isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.user.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.user.pointsBalance` : Screens/Widgets: `profile.dart`, `points_model.dart`
* `data.user.lifetimePointsEarned` : Screens/Widgets: `points_model.dart`
* `data.user.tier` : Screens/Widgets: `profile.dart`, `badges_tab.dart`
* `data.user.eligibilitySummary.canDonate` : Screens/Widgets: `donation_status_section.dart`
* `data.user.profile` : Screens/Widgets: `system_settings.dart`, `review_card.dart`
* `data.user.profile.age` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`
* `data.user.profile.weight` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `me_model.dart`
* `data.user.profile.hemoglobinLevel` : Screens/Widgets: `request_accept_model.dart`, `profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
GET /admin/hospitals/:id
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "User details",
  "data": {
    "user": {
      "_id": "69f3df915f42685cbbbcbb1b",
      "fullName": "Cairo Care Operations",
      "hospitalName": "Cairo Care Hospital",
      "email": "ops@cairocare.demo",
      "role": "hospital",
      "contactNumber": "1044444444",
      "isEmailVerified": true,
      "isSuspended": false,
      "totalRequests": 24,
      "createdAt": "2026-01-05T07:30:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.user.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.user.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.user.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.user.isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.user.isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.user.totalRequests` : Screens/Widgets: `user_detail_dialog.dart`, `profile.dart`
* `data.user.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`

---

### Endpoint

```http
GET /admin/admins
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Admins list",
  "data": {
    "users": [
      {
        "_id": "66f200000000000000000001",
        "fullName": "Noura Hassan",
        "email": "admin@lifelink.demo",
        "role": "admin",
        "isEmailVerified": true
      },
      {
        "_id": "66f200000000000000000002",
        "fullName": "Youssef Fathy",
        "email": "superadmin@lifelink.demo",
        "role": "superadmin",
        "isEmailVerified": true
      }
    ],
    "total": 2,
    "page": 1,
    "limit": 20
  }
}
```

### Verified Required Fields

* `data.users` : Screens/Widgets: `admin_main_layout.dart`, `users.dart`
* `data.users[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.users[].fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.users[].email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.users[].role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.users[].isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`

---

### Endpoint

```http
GET /admin/admins/:id
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Admin details",
  "data": {
    "user": {
      "_id": "66f200000000000000000003",
      "fullName": "Salma Mostafa",
      "email": "salma.mostafa@lifelink.demo",
      "role": "admin",
      "phone": "01022223333",
      "isEmailVerified": true,
      "createdAt": "2026-05-01T10:00:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.user.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.user.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.phone` : Screens/Widgets: `donor_register_form.dart`, `admin_detail_card.dart` \| Models: `user_model.dart`, `admin_login_model.dart`
* `data.user.isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.user.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`

---

### Endpoint

```http
PUT /admin/donors/:id
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donor updated successfully",
  "data": {
    "donor": {
      "_id": "69f3df915f42685cbbbcbb18",
      "fullName": "Aya Hassan",
      "email": "aya.hassan@lifelink.demo",
      "bloodType": "O+",
      "phoneNumber": "01011111111",
      "gender": "female",
      "isOptedIn": true,
      "updatedAt": "2026-05-18T09:05:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.donor` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_role.dart`
* `data.donor._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donor.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.donor.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.gender` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.isOptedIn` : Models: `me_model.dart`, `sign_up_model.dart`
* `data.donor.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
POST /admin/donors/:id/ban
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donor banned successfully",
  "data": {
    "donor": {
      "_id": "69f3df915f42685cbbbcbb18",
      "fullName": "Aya Hassan",
      "isSuspended": true,
      "suspendedReason": "Temporary compliance review",
      "suspendedAt": "2026-05-18T09:12:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.donor` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_role.dart`
* `data.donor._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donor.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.donor.suspendedReason` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.donor.suspendedAt` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
POST /admin/donors/:id/unban
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donor unbanned successfully",
  "data": {
    "donor": {
      "_id": "69f3df915f42685cbbbcbb18",
      "fullName": "Aya Hassan",
      "isSuspended": false,
      "suspendedReason": null,
      "suspendedAt": null
    }
  }
}
```

### Verified Required Fields

* `data.donor` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_role.dart`
* `data.donor._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donor.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.donor.suspendedReason` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.donor.suspendedAt` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
PUT /admin/hospitals/:id/status
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Hospital suspended successfully",
  "data": {
    "hospital": {
      "_id": "69f3df915f42685cbbbcbb1b",
      "hospitalName": "Cairo Care Hospital",
      "isSuspended": true,
      "suspendedReason": "Compliance audit",
      "suspendedAt": "2026-05-18T09:18:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.hospital` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `user_role.dart`
* `data.hospital._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.hospital.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospital.isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.hospital.suspendedReason` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.hospital.suspendedAt` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
POST /admin/admins
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Admin created successfully",
  "data": {
    "admin": {
      "_id": "66f200000000000000000003",
      "fullName": "Salma Mostafa",
      "email": "salma.mostafa@lifelink.demo",
      "role": "admin",
      "isEmailVerified": true,
      "adminKey": "a1b2c3d4e5f67890123456789abcdef0"
    }
  }
}
```

### Verified Required Fields

* `data.admin` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `admin_login_model.dart` \| DataSources: `admin_hive_data_source.dart`
* `data.admin._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.admin.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.admin.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.admin.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.admin.isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.admin.adminKey` : DataSources: `admin_auth_api_data_source.dart`

---

### Endpoint

```http
PUT /admin/admins/:id
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Admin updated successfully",
  "data": {
    "admin": {
      "_id": "66f200000000000000000003",
      "fullName": "Salma Mostafa",
      "email": "salma.mostafa@lifelink.demo",
      "role": "admin",
      "phone": "01022223333",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo"
      },
      "updatedAt": "2026-05-18T09:08:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.admin` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `admin_login_model.dart` \| DataSources: `admin_hive_data_source.dart`
* `data.admin._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.admin.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.admin.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.admin.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.admin.phone` : Screens/Widgets: `donor_register_form.dart`, `admin_detail_card.dart` \| Models: `user_model.dart`, `admin_login_model.dart`
* `data.admin.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.admin.address.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.admin.address.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.admin.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
GET /admin/permissions/roles
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Roles retrieved successfully",
  "data": {
    "roles": [
      {
        "role": "admin",
        "description": "Standard administrative access for operations and moderation.",
        "permissions": {
          "donor_management": {
            "view": true,
            "manage": true
          },
          "hospital_management": {
            "view": true,
            "manage": true
          }
        }
      },
      {
        "role": "custom-ops",
        "description": "Can review requests and hospital operations.",
        "permissions": {}
      }
    ]
  }
}
```

### Verified Required Fields

* `data.roles` : Screens/Widgets: `users.dart`, `user_filter_chips.dart`
* `data.roles[].role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.roles[].description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`
* `data.roles[].permissions` : Context: `app_localizations.dart`, `app_localizations_en.dart`
* `data.roles[].permissions.donor_management.view` : Screens/Widgets: `system_settings.dart`, `user_detail_dialog.dart`
* `data.roles[].permissions.donor_management.manage` : Context: `app_localizations.dart`, `app_localizations_en.dart`
* `data.roles[].permissions.hospital_management.view` : Screens/Widgets: `system_settings.dart`, `user_detail_dialog.dart`
* `data.roles[].permissions.hospital_management.manage` : Context: `app_localizations.dart`, `app_localizations_en.dart`

---

### Endpoint

```http
GET /admin/permissions/roles/:role
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Role retrieved successfully",
  "data": {
    "role": {
      "_id": "66fa00000000000000000001",
      "role": "custom-ops",
      "description": "Can review requests and hospital operations.",
      "permissions": {
        "reporting": {
          "view": true
        }
      }
    }
  }
}
```

### Verified Required Fields

* `data.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.role._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.role.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.role.description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`
* `data.role.permissions` : Context: `app_localizations.dart`, `app_localizations_en.dart`
* `data.role.permissions.reporting.view` : Screens/Widgets: `system_settings.dart`, `user_detail_dialog.dart`

---

### Endpoint

```http
POST /admin/permissions/roles
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Role created successfully",
  "data": {
    "role": {
      "_id": "66fa00000000000000000001",
      "role": "custom-ops",
      "description": "Can review requests and hospital operations.",
      "permissions": {
        "reporting": {
          "view": true
        }
      }
    }
  }
}
```

### Verified Required Fields

* `data.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.role._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.role.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.role.description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`
* `data.role.permissions` : Context: `app_localizations.dart`, `app_localizations_en.dart`
* `data.role.permissions.reporting.view` : Screens/Widgets: `system_settings.dart`, `user_detail_dialog.dart`

---

### Endpoint

```http
PUT /admin/permissions/roles/:role
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Role permissions updated successfully",
  "data": {
    "role": {
      "_id": "66fa00000000000000000001",
      "role": "custom-ops",
      "description": "Updated reporting access for the operations desk.",
      "permissions": {
        "reporting": {
          "view": true
        }
      }
    }
  }
}
```

### Verified Required Fields

* `data.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.role._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.role.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.role.description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`
* `data.role.permissions` : Context: `app_localizations.dart`, `app_localizations_en.dart`
* `data.role.permissions.reporting.view` : Screens/Widgets: `system_settings.dart`, `user_detail_dialog.dart`

---

### Endpoint

```http
DELETE /admin/permissions/roles/:role
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Role deleted successfully",
  "data": {
    "role": {
      "_id": "66fa00000000000000000001",
      "role": "custom-ops"
    }
  }
}
```

### Verified Required Fields

* `data.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.role._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.role.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`

---

### Endpoint

```http
GET /admin/users
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Users list",
  "data": {
    "users": [
      {
        "_id": "69f3df915f42685cbbbcbb18",
        "fullName": "Aya Hassan",
        "email": "aya.hassan@lifelink.demo",
        "role": "donor",
        "isEmailVerified": true,
        "isSuspended": false
      },
      {
        "_id": "69f3df915f42685cbbbcbb1b",
        "fullName": "Cairo Care Operations",
        "email": "ops@cairocare.demo",
        "role": "hospital",
        "isEmailVerified": true,
        "isSuspended": false
      }
    ],
    "total": 2,
    "page": 1,
    "limit": 20
  }
}
```

### Verified Required Fields

* `data.users` : Screens/Widgets: `admin_main_layout.dart`, `users.dart`
* `data.users[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.users[].fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.users[].email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.users[].role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.users[].isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.users[].isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`

---

### Endpoint

```http
GET /admin/users/stats
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "User statistics",
  "data": {
    "totalUsers": 284,
    "totalDonors": 231
  }
}
```

### Verified Required Fields

* `data.totalUsers` : Screens/Widgets: `users.dart`
* `data.totalDonors` : Screens/Widgets: `dashboard.dart`

---

### Endpoint

```http
POST /admin/users/hospital
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Hospital created successfully",
  "data": {
    "hospital": {
      "_id": "69f3df925f42685cbbbcbb1d",
      "fullName": "Alexandria Demo Hospital",
      "hospitalName": "Alexandria Demo Hospital",
      "email": "alex.demo@lifelink.demo",
      "role": "hospital",
      "hospitalId": "HOSP-ALEX-001",
      "contactNumber": "1066666666",
      "isEmailVerified": true
    }
  }
}
```

### Verified Required Fields

* `data.hospital` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `user_role.dart`
* `data.hospital._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.hospital.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospital.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospital.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.hospital.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospital.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospital.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.hospital.isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`

---

### Endpoint

```http
GET /admin/users/:id
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "User details",
  "data": {
    "user": {
      "_id": "69f3df915f42685cbbbcbb19",
      "fullName": "Mina Adel",
      "email": "mina.adel@lifelink.demo",
      "role": "donor",
      "bloodType": "A-",
      "isEmailVerified": true,
      "isSuspended": false,
      "createdAt": "2026-02-02T11:45:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.user.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.user.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.user.isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.user.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`

---

### Endpoint

```http
PATCH /admin/users/:id/verify
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "User verified successfully",
  "data": {
    "user": {
      "_id": "69f3df915f42685cbbbcbb19",
      "email": "mina.adel@lifelink.demo",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-05-18T09:22:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.user.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.user.isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.user.emailVerifiedAt` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
PATCH /admin/users/:id/unverify
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "User unverified successfully",
  "data": {
    "user": {
      "_id": "69f3df915f42685cbbbcbb19",
      "email": "mina.adel@lifelink.demo",
      "isEmailVerified": false,
      "emailVerifiedAt": null
    }
  }
}
```

### Verified Required Fields

* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.user.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.user.isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.user.emailVerifiedAt` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
PATCH /admin/users/:id/suspend
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "User suspended successfully",
  "data": {
    "user": {
      "_id": "69f3df915f42685cbbbcbb19",
      "fullName": "Mina Adel",
      "isSuspended": true,
      "suspendedReason": "Repeated policy violation",
      "suspendedAt": "2026-05-18T09:24:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.user.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.user.suspendedReason` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.user.suspendedAt` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
PATCH /admin/users/:id/unsuspend
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "User unsuspended successfully",
  "data": {
    "user": {
      "_id": "69f3df915f42685cbbbcbb19",
      "fullName": "Mina Adel",
      "isSuspended": false,
      "suspendedReason": null,
      "suspendedAt": null
    }
  }
}
```

### Verified Required Fields

* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.user.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.isSuspended` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.user.suspendedReason` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.user.suspendedAt` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
GET /admin/requests
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Requests list",
  "data": {
    "requests": [
      {
        "_id": "69fe540565ff7785a031314f",
        "type": "blood",
        "bloodType": "O-",
        "urgency": "critical",
        "status": "pending",
        "quantity": 3,
        "distanceKm": 4.2,
        "hospitalId": {
          "_id": "69f3df915f42685cbbbcbb1b",
          "hospitalName": "Cairo Care Hospital",
          "contactNumber": "0223456789"
        },
        "requiredBy": "2026-05-18T16:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

### Verified Required Fields

* `data.requests` : Screens/Widgets: `admin_main_layout.dart`, `admin_request.dart`
* `data.requests[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.requests[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.requests[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.requests[].urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.requests[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.requests[].quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.requests[].distanceKm` : Screens/Widgets: `location_step.dart`, `nearby_hospitals.dart`
* `data.requests[].hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.requests[].hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.requests[].hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.requests[].hospitalId.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.requests[].requiredBy` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`

---

### Endpoint

```http
GET /admin/requests/stats
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request statistics",
  "data": {
    "total": 68,
    "byStatus": {
      "pending": 14,
      "completed": 41,
      "cancelled": 8
    },
    "byUrgency": {
      "low": 2,
      "medium": 6,
      "high": 7,
      "critical": 4
    },
    "byBloodType": {
      "A+": 4,
      "B+": 3,
      "O-": 6
    }
  }
}
```

### Verified Required Fields

* `data.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.byStatus.pending` : Screens/Widgets: `users.dart`, `appointment_model.dart` \| Models: `donation_details.dart`
* `data.byStatus.completed` : Screens/Widgets: `donation_booking_card.dart`, `donation_stats_card.dart` \| Models: `summary_model.dart`
* `data.byStatus.cancelled` : Screens/Widgets: `admin_auth_view_model.dart`, `appointment_cancelled_model.dart` \| Models: `donation_details.dart`, `summary_model.dart`
* `data.byUrgency.low` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `blood_request.dart`, `urgency_level.dart`
* `data.byUrgency.medium` : Screens/Widgets: `loading_state.dart`, `admin_action_card.dart` \| Models: `blood_request.dart`, `urgency_level.dart`
* `data.byUrgency.high` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `blood_request.dart`, `urgency_level.dart`
* `data.byUrgency.critical` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart`
* `data.byBloodType.A+` : Screens/Widgets: `donor_register_form.dart`, `admin_request.dart`
* `data.byBloodType.B+` : Screens/Widgets: `donor_register_form.dart`, `admin_request.dart`
* `data.byBloodType.O-` : Screens/Widgets: `donor_register_form.dart`, `blood_type_chart.dart`

---

### Endpoint

```http
GET /admin/requests/:id
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request details",
  "data": {
    "request": {
      "_id": "69fe540565ff7785a031314f",
      "type": "blood",
      "bloodType": "O-",
      "urgency": "critical",
      "status": "pending",
      "quantity": 3,
      "distanceKm": 4.2,
      "notes": "Emergency surgery support",
      "hospitalId": {
        "_id": "69f3df915f42685cbbbcbb1b",
        "hospitalName": "Cairo Care Hospital",
        "contactNumber": "0223456789"
      },
      "timeline": [
        {
          "at": "2026-05-18T08:00:00.000Z",
          "event": "created",
          "by": "hospital",
          "note": "Request created by hospital staff"
        },
        {
          "at": "2026-05-18T09:12:00.000Z",
          "event": "broadcasted",
          "by": "admin",
          "note": "Broadcast sent to nearby donors"
        }
      ]
    },
    "donations": [
      {
        "_id": "69fe540565ff7785a0313157",
        "donorId": {
          "_id": "69f3df915f42685cbbbcbb18",
          "fullName": "Aya Hassan",
          "bloodType": "O+",
          "phoneNumber": "01011111111"
        },
        "quantity": 1,
        "status": "pending"
      }
    ]
  }
}
```

### Verified Required Fields

* `data.request` : Screens/Widgets: `admin_auth_view_model.dart`, `admin_request.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.request.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.request.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.request.urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.request.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.request.quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.request.distanceKm` : Screens/Widgets: `location_step.dart`, `nearby_hospitals.dart`
* `data.request.notes` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.request.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.request.hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.request.hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.request.hospitalId.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.request.timeline[].at` : Screens/Widgets: `date_and_time_card.dart`, `review_card.dart`
* `data.request.timeline[].event` : Screens/Widgets: `ask_api_data_source.dart`
* `data.request.timeline[].by` : Screens/Widgets: `ask_view_model.dart`, `splash_screen.dart` \| Repositories: `location_repository.dart`
* `data.request.timeline[].note` : Screens/Widgets: `note_card.dart`, `request_detail_note.dart`
* `data.donations` : Screens/Widgets: `donor_tile.dart`, `user_detail_dialog.dart`
* `data.donations[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donations[].donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donations[].donorId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donations[].donorId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donations[].donorId.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donations[].donorId.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donations[].quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.donations[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`

---

### Endpoint

```http
GET /admin/requests/:id/donations
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request donations",
  "data": {
    "donations": [
      {
        "_id": "69fe540565ff7785a0313157",
        "donorId": {
          "_id": "69f3df915f42685cbbbcbb18",
          "fullName": "Aya Hassan",
          "email": "aya.hassan@lifelink.demo",
          "bloodType": "O+"
        },
        "quantity": 1,
        "status": "pending"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

### Verified Required Fields

* `data.donations` : Screens/Widgets: `donor_tile.dart`, `user_detail_dialog.dart`
* `data.donations[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donations[].donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donations[].donorId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donations[].donorId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donations[].donorId.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.donations[].donorId.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donations[].quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.donations[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`

---

### Endpoint

```http
PATCH /admin/requests/:id/fulfill
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request marked as fulfilled",
  "data": {
    "request": {
      "_id": "69fe540565ff7785a031314f",
      "status": "completed",
      "bloodType": [
        "O-",
        "A+"
      ],
      "urgency": "critical",
      "updatedAt": "2026-05-18T09:28:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.request` : Screens/Widgets: `admin_auth_view_model.dart`, `admin_request.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.request.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.request.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.request.urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.request.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
PATCH /admin/requests/:id/cancel
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request cancelled",
  "data": {
    "request": {
      "_id": "69fe540565ff7785a0313150",
      "status": "cancelled",
      "notes": "Transferred to another hospital\n[Admin cancelled]: Transferred to another hospital"
    }
  }
}
```

### Verified Required Fields

* `data.request` : Screens/Widgets: `admin_auth_view_model.dart`, `admin_request.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.request.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.request.notes` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
POST /admin/requests/:id/broadcast
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Broadcast sent",
  "data": {
    "governorate": "Cairo",
    "bloodType": "O-"
  }
}
```

### Verified Required Fields

* `data.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`

---

### Endpoint

```http
GET /admin/analytics/donations
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donation trends",
  "data": {
    "trends": [
      {
        "year": 2026,
        "month": 3,
        "total": 41,
        "completed": 35,
        "cancelled": 6,
        "successRate": "85.4%"
      },
      {
        "year": 2026,
        "month": 4,
        "total": 52,
        "completed": 46,
        "cancelled": 6,
        "successRate": "88.5%"
      },
      {
        "year": 2026,
        "month": 5,
        "total": 38,
        "completed": 32,
        "cancelled": 6,
        "successRate": "84.2%"
      }
    ],
    "dailyTrends": [
      {
        "date": "2026-05-16",
        "completed": 3,
        "pending": 2,
        "cancelled": 0
      },
      {
        "date": "2026-05-17",
        "completed": 5,
        "pending": 1,
        "cancelled": 1
      }
    ],
    "regionalBreakdown": [
      {
        "governorate": "Cairo",
        "completed": 28,
        "activeRequests": 6
      },
      {
        "governorate": "Giza",
        "completed": 9,
        "activeRequests": 3
      }
    ]
  }
}
```

### Verified Required Fields

* `data.trends` : Context: `app_localizations.dart`, `app_localizations_en.dart`
* `data.trends[].year` : Screens/Widgets: `donor_register_form.dart`, `review_and_confirm.dart`
* `data.trends[].month` : Screens/Widgets: `donor_register_form.dart`, `review_and_confirm.dart`
* `data.trends[].total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.trends[].completed` : Screens/Widgets: `donation_booking_card.dart`, `donation_stats_card.dart` \| Models: `summary_model.dart`
* `data.trends[].cancelled` : Screens/Widgets: `admin_auth_view_model.dart`, `appointment_cancelled_model.dart` \| Models: `donation_details.dart`, `summary_model.dart`
* `data.trends[].successRate` : Screens/Widgets: `analytics.dart`, `profile.dart`
* `data.dailyTrends[].date` : Screens/Widgets: `custom_trends_chart.dart`, `donor_register_form.dart` \| Models: `alert.dart`, `blood_request_history.dart`
* `data.dailyTrends[].completed` : Screens/Widgets: `donation_booking_card.dart`, `donation_stats_card.dart` \| Models: `summary_model.dart`
* `data.dailyTrends[].pending` : Screens/Widgets: `users.dart`, `appointment_model.dart` \| Models: `donation_details.dart`
* `data.dailyTrends[].cancelled` : Screens/Widgets: `admin_auth_view_model.dart`, `appointment_cancelled_model.dart` \| Models: `donation_details.dart`, `summary_model.dart`
* `data.regionalBreakdown[].governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.regionalBreakdown[].completed` : Screens/Widgets: `donation_booking_card.dart`, `donation_stats_card.dart` \| Models: `summary_model.dart`
* `data.regionalBreakdown[].activeRequests` : Screens/Widgets: `admin_request.dart`, `dashboard.dart`

---

### Endpoint

```http
GET /admin/analytics/blood-types
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Blood type distribution",
  "data": {
    "distribution": [
      {
        "bloodType": "A+",
        "donors": 54,
        "activeRequests": 4
      },
      {
        "bloodType": "O-",
        "donors": 12,
        "activeRequests": 6
      }
    ]
  }
}
```

### Verified Required Fields

* `data.distribution[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.distribution[].donors` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart`
* `data.distribution[].activeRequests` : Screens/Widgets: `admin_request.dart`, `dashboard.dart`

---

### Endpoint

```http
GET /admin/analytics/top-donors
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Top donors",
  "data": {
    "topDonors": [
      {
        "_id": "69f3df915f42685cbbbcbb18",
        "lastDonation": "2026-05-10T12:30:00.000Z",
        "donor": {
          "fullName": "Aya Hassan",
          "email": "aya.hassan@lifelink.demo",
          "bloodType": "O+"
        }
      }
    ]
  }
}
```

### Verified Required Fields

* `data.topDonors[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.topDonors[].lastDonation` : Screens/Widgets: `donor_tile.dart`, `donation_status_section.dart`
* `data.topDonors[].donor` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_role.dart`
* `data.topDonors[].donor.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.topDonors[].donor.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.topDonors[].donor.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`

---

### Endpoint

```http
GET /admin/analytics/growth
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Growth metrics",
  "data": {
    "userGrowth": [
      {
        "_id": {
          "year": 2026,
          "month": 3
        },
        "count": 18,
        "donors": 14,
        "hospitals": 3
      }
    ],
    "requestGrowth": [
      {
        "_id": {
          "year": 2026,
          "month": 3
        },
        "count": 11
      }
    ],
    "donationGrowth": [
      {
        "_id": {
          "year": 2026,
          "month": 3
        },
        "count": 35
      }
    ]
  }
}
```

### Verified Required Fields

* `data.userGrowth[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.userGrowth[]._id.year` : Screens/Widgets: `donor_register_form.dart`, `review_and_confirm.dart`
* `data.userGrowth[]._id.month` : Screens/Widgets: `donor_register_form.dart`, `review_and_confirm.dart`
* `data.userGrowth[].count` : Screens/Widgets: `admin_request.dart`, `custom_stat_card.dart`
* `data.userGrowth[].donors` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart`
* `data.userGrowth[].hospitals` : Screens/Widgets: `critical_alerts_card.dart`, `users.dart`
* `data.requestGrowth[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.requestGrowth[]._id.year` : Screens/Widgets: `donor_register_form.dart`, `review_and_confirm.dart`
* `data.requestGrowth[]._id.month` : Screens/Widgets: `donor_register_form.dart`, `review_and_confirm.dart`
* `data.requestGrowth[].count` : Screens/Widgets: `admin_request.dart`, `custom_stat_card.dart`
* `data.donationGrowth[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donationGrowth[]._id.year` : Screens/Widgets: `donor_register_form.dart`, `review_and_confirm.dart`
* `data.donationGrowth[]._id.month` : Screens/Widgets: `donor_register_form.dart`, `review_and_confirm.dart`
* `data.donationGrowth[].count` : Screens/Widgets: `admin_request.dart`, `custom_stat_card.dart`

---

### Endpoint

```http
POST /admin/emergency/broadcast
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Emergency broadcast sent",
  "data": {
    "governorate": "Cairo",
    "city": "Cairo"
  }
}
```

### Verified Required Fields

* `data.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`

---

### Endpoint

```http
GET /admin/emergency/critical
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Critical requests",
  "data": {
    "requests": [
      {
        "_id": "69fe540565ff7785a031314f",
        "type": "blood",
        "bloodType": "O-",
        "urgency": "critical",
        "status": "pending",
        "hospitalId": {
          "_id": "69f3df915f42685cbbbcbb1b",
          "hospitalName": "Cairo Care Hospital",
          "contactNumber": "0223456789"
        }
      },
      {
        "_id": "69fe540565ff7785a0313150",
        "type": "blood",
        "bloodType": "A-",
        "urgency": "high",
        "status": "in-progress",
        "hospitalId": {
          "_id": "69f3df925f42685cbbbcbb1c",
          "hospitalName": "Alexandria Central Hospital",
          "contactNumber": "0334567890"
        }
      }
    ]
  }
}
```

### Verified Required Fields

* `data.requests` : Screens/Widgets: `admin_main_layout.dart`, `admin_request.dart`
* `data.requests[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.requests[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.requests[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.requests[].urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.requests[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.requests[].hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.requests[].hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.requests[].hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.requests[].hospitalId.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`

---

### Endpoint

```http
GET /admin/emergency/shortage-alerts
```

### Flutter Screens / Files Using It

* **Called From:** Admin Dashboard, User Management

### Minimum Required Response

```json
{
  "success": true,
  "message": "Shortage alerts",
  "data": {
    "alerts": [
      {
        "bloodType": "O-",
        "activeRequests": 6,
        "status": "shortage"
      },
      {
        "bloodType": "AB-",
        "activeRequests": 2,
        "status": "critical"
      }
    ]
  }
}
```

### Verified Required Fields

* `data.alerts` : Screens/Widgets: `critical_alerts_card.dart`
* `data.alerts[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.alerts[].activeRequests` : Screens/Widgets: `admin_request.dart`, `dashboard.dart`
* `data.alerts[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`

---

## Analytics Module

### Endpoint

```http
GET /analytics/my-stats
```

### Flutter Screens / Files Using It

* **Called From:** Donation analytics / Leaderboard

### Minimum Required Response

```json
{
  "success": true,
  "message": "Retrieved",
  "data": {
    "responseCount": 11,
    "totalDonations": 8
  }
}
```

### Verified Required Fields

* `data.responseCount` : Screens/Widgets: `request_detail_body.dart`, `view_detail_dialog.dart`
* `data.totalDonations` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`

---

### Endpoint

```http
GET /analytics/leaderboard
```

### Flutter Screens / Files Using It

* **Called From:** Donation analytics / Leaderboard

### Minimum Required Response

```json
{
  "success": true,
  "data": {
    "period": "Last 30 days",
    "count": 2,
    "leaderboard": [
      {
        "rank": 1,
        "_id": "69f3df915f42685cbbbcbb18",
        "fullName": "Aya Hassan",
        "email": "aya.hassan@lifelink.demo",
        "bloodType": "O+",
        "pointsBalance": 2340,
        "lifetimePointsEarned": 2840,
        "tier": "gold",
        "lastDonationDate": "2026-05-10T12:30:00.000Z"
      },
      {
        "rank": 2,
        "_id": "69f3df915f42685cbbbcbb19",
        "fullName": "Mina Adel",
        "email": "mina.adel@lifelink.demo",
        "bloodType": "A-",
        "pointsBalance": 1880,
        "lifetimePointsEarned": 1880,
        "tier": "silver",
        "lastDonationDate": "2026-05-08T09:00:00.000Z"
      }
    ]
  }
}
```

### Verified Required Fields

* `data.period` : Screens/Widgets: `chat_bot_dialog.dart`
* `data.count` : Screens/Widgets: `admin_request.dart`, `custom_stat_card.dart`
* `data.leaderboard[].rank` : Screens/Widgets: `donor_tile.dart`
* `data.leaderboard[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.leaderboard[].fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.leaderboard[].email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.leaderboard[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.leaderboard[].pointsBalance` : Screens/Widgets: `profile.dart`, `points_model.dart`
* `data.leaderboard[].lifetimePointsEarned` : Screens/Widgets: `points_model.dart`
* `data.leaderboard[].tier` : Screens/Widgets: `profile.dart`, `badges_tab.dart`
* `data.leaderboard[].lastDonationDate` : Screens/Widgets: `donor_tile.dart`, `donation_eligibility_model.dart` \| Models: `donor.dart`

---

### Endpoint

```http
GET /analytics/donation-types
```

### Flutter Screens / Files Using It

* **Called From:** Donation analytics / Leaderboard

### Minimum Required Response

```json
{
  "success": true,
  "data": {
    "totalDonations": 428,
    "byType": {
      "blood": {
        "count": 361
      },
      "plasma": {
        "count": 32
      },
      "platelets": {
        "count": 27
      }
    }
  }
}
```

### Verified Required Fields

* `data.totalDonations` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.byType.blood` : Screens/Widgets: `critical_alerts_card.dart`, `donation_history_model.dart`
* `data.byType.blood.count` : Screens/Widgets: `admin_request.dart`, `custom_stat_card.dart`
* `data.byType.plasma` : Screens/Widgets: `donation_type_picker.dart`, `requests_model.dart`
* `data.byType.plasma.count` : Screens/Widgets: `admin_request.dart`, `custom_stat_card.dart`
* `data.byType.platelets` : Screens/Widgets: `donation_type_picker.dart`
* `data.byType.platelets.count` : Screens/Widgets: `admin_request.dart`, `custom_stat_card.dart`

---

### Endpoint

```http
GET /analytics/dashboard
```

### Flutter Screens / Files Using It

* **Called From:** Donation analytics / Leaderboard

### Minimum Required Response

```json
{
  "success": true,
  "data": {
    "users": {
      "total": 284,
      "donors": 231,
      "hospitals": 41
    },
    "requests": {
      "active": 19,
      "critical": 4
    },
    "donations": {
      "pending": 13,
      "completed": 428
    },
    "alerts": {}
  }
}
```

### Verified Required Fields

* `data.users` : Screens/Widgets: `admin_main_layout.dart`, `users.dart`
* `data.users.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.users.donors` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart`
* `data.users.hospitals` : Screens/Widgets: `critical_alerts_card.dart`, `users.dart`
* `data.requests` : Screens/Widgets: `admin_main_layout.dart`, `admin_request.dart`
* `data.requests.active` : Screens/Widgets: `donor_tile.dart`, `user_card.dart` \| Models: `summary_model.dart`
* `data.requests.critical` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart`
* `data.donations` : Screens/Widgets: `donor_tile.dart`, `user_detail_dialog.dart`
* `data.donations.pending` : Screens/Widgets: `users.dart`, `appointment_model.dart` \| Models: `donation_details.dart`
* `data.donations.completed` : Screens/Widgets: `donation_booking_card.dart`, `donation_stats_card.dart` \| Models: `summary_model.dart`
* `data.alerts` : Screens/Widgets: `critical_alerts_card.dart`

---

## Donation Module

### Endpoint

```http
POST /donations/book-appointment
```

### Flutter Screens / Files Using It

* **Called From:** Book Appointment tab

### Minimum Required Response

```json
{
  "success": true,
  "message": "Appointment booked",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "donorId": {
      "_id": "69f3df915f42685cbbbcbb18",
      "fullName": "Noor Ahmed",
      "phoneNumber": "01123456789",
      "bloodType": "O+",
      "email": "noor.ahmed@example.com"
    },
    "donorDetails": {
      "fullName": "Noor Ahmed",
      "phoneNumber": "01123456789",
      "bloodType": "O+",
      "email": "noor.ahmed@example.com"
    },
    "hospitalId": {
      "_id": "69f3df915f42685cbbbcbb1b",
      "hospitalName": "Cairo Care Hospital",
      "fullName": "Cairo Care Operations"
    },
    "requestId": null,
    "appointmentDate": "2026-05-12T10:00:00.000Z",
    "status": "pending",
    "qrToken": "8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d",
    "qrExpiresAt": "2026-05-13T10:00:00.000Z",
    "notes": "First-time donor, available in the morning.",
    "donationType": "Whole Blood"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donorId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donorId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorId.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorId.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorId.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.donorDetails` : Screens/Widgets: `book_appointment_model.dart`
* `data.donorDetails.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospitalId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.qrToken` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.qrExpiresAt` : Screens/Widgets: `appointment_model.dart`, `book_appointment_model.dart`
* `data.notes` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`

---

### Endpoint

```http
GET /donations/book-appointment/available-slots
```

### Flutter Screens / Files Using It

* **Called From:** Book Appointment tab

### Minimum Required Response

```json
{
  "success": true,
  "message": "Available slots retrieved successfully",
  "data": {
    "timeSlots": [
      {
        "time": "08:00",
        "remainingCapacity": 2,
        "maxCapacity": 4,
        "available": true
      },
      {
        "time": "09:00",
        "remainingCapacity": 0,
        "maxCapacity": 4,
        "available": false
      },
      {
        "time": "10:00",
        "remainingCapacity": 3,
        "maxCapacity": 4,
        "available": true
      }
    ],
    "hospitalId": "69f3df915f42685cbbbcbb1b",
    "date": "2026-05-12T00:00:00.000Z",
    "slotsPerHour": 4
  }
}
```

### Verified Required Fields

* `data.timeSlots` : Screens/Widgets: `time_slots_model.dart`, `time_slots_view_model.dart`
* `data.timeSlots[].time` : Screens/Widgets: `log_item.dart`, `chat_bot_dialog.dart`
* `data.timeSlots[].remainingCapacity` : Screens/Widgets: `time_slots_model.dart`, `time_slot_picker.dart`
* `data.timeSlots[].maxCapacity` : Screens/Widgets: `time_slots_model.dart`, `time_slot_picker.dart`
* `data.timeSlots[].available` : Screens/Widgets: `book_appointment_model.dart`, `hospital_actions.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.date` : Screens/Widgets: `custom_trends_chart.dart`, `donor_register_form.dart` \| Models: `alert.dart`, `blood_request_history.dart`
* `data.slotsPerHour` : Screens/Widgets: `time_slots_model.dart`

---

### Endpoint

```http
GET /donations/book-appointment/my-appointments
```

### Flutter Screens / Files Using It

* **Called From:** Book Appointment tab

### Minimum Required Response

```json
{
  "success": true,
  "message": "Appointments fetched",
  "data": {
    "appointments": [
      {
        "_id": "69fe540565ff7785a031315c",
        "donorId": {
          "_id": "69f3df915f42685cbbbcbb18",
          "fullName": "Aya Hassan",
          "phoneNumber": "01011111111",
          "bloodType": "O+",
          "email": "aya.hassan@lifelink.demo"
        },
        "hospitalId": {
          "_id": "69f3df915f42685cbbbcbb1b",
          "hospitalName": "Cairo Care Hospital",
          "address": {
            "city": "Cairo",
            "governorate": "Cairo"
          }
        },
        "requestId": "69fe540565ff7785a031314f",
        "appointmentDate": "2026-05-12T10:00:00.000Z",
        "status": "pending",
        "notes": "Donation follow-up appointment",
        "qrToken": "8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d",
        "qrExpiresAt": "2026-05-13T10:00:00.000Z",
        "donationType": "Whole Blood"
      }
    ],
    "total": 1,
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1
    }
  }
}
```

### Verified Required Fields

* `data.appointments` : Screens/Widgets: `appointment_model.dart`, `appointments_view_model.dart`
* `data.appointments[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.appointments[].donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.appointments[].donorId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.appointments[].donorId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.appointments[].donorId.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.appointments[].donorId.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.appointments[].donorId.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.appointments[].hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.appointments[].hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.appointments[].hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.appointments[].hospitalId.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.appointments[].hospitalId.address.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.appointments[].hospitalId.address.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.appointments[].requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.appointments[].appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.appointments[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.appointments[].notes` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.appointments[].qrToken` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.appointments[].qrExpiresAt` : Screens/Widgets: `appointment_model.dart`, `book_appointment_model.dart`
* `data.appointments[].donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`
* `data.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.meta` : Screens/Widgets: `custom_trends_chart.dart`, `blood_type_chart.dart`
* `data.meta.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.meta.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.meta.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`

---

### Endpoint

```http
GET /donations/book-appointment/:appointmentId
```

### Flutter Screens / Files Using It

* **Called From:** Book Appointment tab

### Minimum Required Response

```json
{
  "success": true,
  "message": "Appointment retrieved",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "donorId": {
      "_id": "69f3df915f42685cbbbcbb18",
      "fullName": "Aya Hassan",
      "phoneNumber": "01011111111",
      "bloodType": "O+",
      "email": "aya.hassan@lifelink.demo"
    },
    "donorDetails": {
      "fullName": "Aya Hassan",
      "phoneNumber": "01011111111",
      "bloodType": "O+",
      "email": "aya.hassan@lifelink.demo"
    },
    "hospitalId": {
      "_id": "69f3df915f42685cbbbcbb1b",
      "hospitalName": "Cairo Care Hospital",
      "fullName": "Cairo Care Operations",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo"
      }
    },
    "requestId": "69fe540565ff7785a031314f",
    "appointmentDate": "2026-05-12T10:00:00.000Z",
    "status": "pending",
    "notes": "Donation follow-up appointment",
    "qrToken": "8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d",
    "qrExpiresAt": "2026-05-13T10:00:00.000Z",
    "donationType": "Whole Blood"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donorId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donorId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorId.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorId.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorId.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.donorDetails` : Screens/Widgets: `book_appointment_model.dart`
* `data.donorDetails.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospitalId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitalId.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.hospitalId.address.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospitalId.address.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.notes` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.qrToken` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.qrExpiresAt` : Screens/Widgets: `appointment_model.dart`, `book_appointment_model.dart`
* `data.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`

---

### Endpoint

```http
PATCH /donations/book-appointment/:appointmentId
```

### Flutter Screens / Files Using It

* **Called From:** Book Appointment tab

### Minimum Required Response

```json
{
  "success": true,
  "message": "Appointment rescheduled",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "appointmentId": "69fe540565ff7785a031315c",
    "donorId": "69f3df915f42685cbbbcbb18",
    "hospitalId": "69f3df915f42685cbbbcbb1b",
    "requestId": "69fe540565ff7785a031314f",
    "appointmentDate": "2026-05-15T14:00:00.000Z",
    "status": "pending",
    "notes": "Donation follow-up appointment",
    "qrToken": "8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d",
    "donationType": "Plasma",
    "donor": {
      "donorId": "69f3df915f42685cbbbcbb18",
      "firstName": "Aya",
      "lastName": "Hassan",
      "fullName": "Aya Hassan",
      "email": "aya.hassan@lifelink.demo",
      "phoneNumber": "01011111111",
      "bloodType": "O+",
      "gender": "female",
      "dateOfBirth": "1995-01-15T00:00:00.000Z"
    },
    "appointment": {
      "appointmentId": "69fe540565ff7785a031315c",
      "donationType": "Plasma",
      "appointmentDate": "2026-05-15T14:00:00.000Z",
      "status": "pending",
      "hospitalId": "69f3df915f42685cbbbcbb1b",
      "hospitalName": "Cairo Care Hospital"
    },
    "hospital": {
      "hospitalId": "69f3df915f42685cbbbcbb1b",
      "id": "69f3df915f42685cbbbcbb1b",
      "name": "Cairo Care Hospital",
      "hospitalName": "Cairo Care Hospital"
    },
    "request": {
      "requestId": "69fe540565ff7785a031314f",
      "id": "69fe540565ff7785a031314f",
      "urgencyLevel": "high",
      "unitsNeeded": 2,
      "notes": "Donation follow-up appointment"
    },
    "rescheduleHistory": [
      {
        "reason": "Travel conflict"
      }
    ]
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.appointmentId` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.notes` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.qrToken` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`
* `data.donor` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_role.dart`
* `data.donor.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donor.firstName` : Screens/Widgets: `donation_schedule.dart`, `donation_booking_card.dart`
* `data.donor.lastName` : Screens/Widgets: `donation_schedule.dart`, `donation_booking_card.dart`
* `data.donor.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.donor.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.gender` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.dateOfBirth` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.appointment` : Screens/Widgets: `appointments_api_data_source.dart`, `appointment_cancelled_model.dart`
* `data.appointment.appointmentId` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.appointment.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`
* `data.appointment.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.appointment.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.appointment.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.appointment.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospital` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `user_role.dart`
* `data.hospital.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospital.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospital.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.hospital.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.request` : Screens/Widgets: `admin_auth_view_model.dart`, `admin_request.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.request.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.request.urgencyLevel` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `blood_request.dart`
* `data.request.unitsNeeded` : Screens/Widgets: `alerts_dialog.dart`, `critical_alerts_card.dart` \| Models: `alert.dart`
* `data.request.notes` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.rescheduleHistory[].reason` : Screens/Widgets: `donation_eligibility_model.dart`, `donation_status_section.dart`

---

### Endpoint

```http
DELETE /donations/book-appointment/:appointmentId
```

### Flutter Screens / Files Using It

* **Called From:** Book Appointment tab

### Minimum Required Response

```json
{
  "success": true,
  "message": "Appointment cancelled",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "donorId": {
      "_id": "69f3df915f42685cbbbcbb18",
      "fullName": "Noor Ahmed",
      "phoneNumber": "01123456789",
      "bloodType": "O+",
      "email": "noor.ahmed@example.com"
    },
    "donorDetails": {
      "fullName": "Noor Ahmed",
      "phoneNumber": "01123456789",
      "bloodType": "O+",
      "email": "noor.ahmed@example.com"
    },
    "hospitalId": {
      "_id": "69f3df915f42685cbbbcbb1b",
      "hospitalName": "Cairo Care Hospital",
      "fullName": "Cairo Care Operations"
    },
    "appointmentDate": "2026-05-12T10:00:00.000Z",
    "status": "cancelled",
    "cancelledAt": "2026-05-09T10:30:00.000Z",
    "donationType": "Whole Blood"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donorId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donorId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorId.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorId.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorId.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.donorDetails` : Screens/Widgets: `book_appointment_model.dart`
* `data.donorDetails.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospitalId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.cancelledAt` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`

---

### Endpoint

```http
GET /donations/types
```

### Flutter Screens / Files Using It

* **Called From:** General flow

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donation types retrieved",
  "data": {
    "types": [
      {
        "type": "blood",
        "name": "Whole Blood",
        "cooldownDays": 56,
        "description": "Standard blood donation - most common type"
      },
      {
        "type": "plasma",
        "name": "Plasma",
        "cooldownDays": 14,
        "description": "Plasma donation - more frequent possible donations"
      },
      {
        "type": "platelets",
        "name": "Platelets",
        "cooldownDays": 7,
        "description": "Platelet donation - shortest cooldown period"
      }
    ]
  }
}
```

### Verified Required Fields

* `data.types` : Repositories: `location_repository.dart`
* `data.types[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.types[].name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.types[].cooldownDays` : Screens/Widgets: `donation_eligibility_model.dart`
* `data.types[].description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`

---

### Endpoint

```http
POST /donations/validate
```

### Flutter Screens / Files Using It

* **Called From:** General flow

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donation eligibility checked",
  "data": {
    "canDonate": true,
    "reason": null,
    "nextEligibleDate": null
  }
}
```

### Verified Required Fields

* `data.canDonate` : Screens/Widgets: `donation_status_section.dart`
* `data.reason` : Screens/Widgets: `donation_eligibility_model.dart`, `donation_status_section.dart`
* `data.nextEligibleDate` : Screens/Widgets: `donation_eligibility_model.dart`, `donation_status_section.dart`

---

### Endpoint

```http
POST /donations/complete
```

### Flutter Screens / Files Using It

* **Called From:** General flow

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donation completed successfully",
  "data": {
    "donation": {
      "_id": "69fe540565ff7785a0313157",
      "donorId": "69f3df915f42685cbbbcbb18",
      "appointmentId": "69fe540565ff7785a031315c",
      "requestId": "69fe540565ff7785a0313151",
      "quantity": 1,
      "unitsCollected": 1,
      "hemoglobinLevel": 14.8,
      "weight": 72,
      "status": "completed"
    },
    "appointment": {
      "id": "69fe540565ff7785a031315c",
      "status": "completed",
      "verificationStatus": "completed",
      "donationType": "Whole Blood"
    },
    "pointsEarned": 100
  }
}
```

### Verified Required Fields

* `data.donation` : Screens/Widgets: `donation_history.dart`, `activities_model.dart`
* `data.donation._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donation.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donation.appointmentId` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.donation.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donation.quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.donation.unitsCollected` : Screens/Widgets: `request_accept_model.dart`
* `data.donation.hemoglobinLevel` : Screens/Widgets: `request_accept_model.dart`, `profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.donation.weight` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `me_model.dart`
* `data.donation.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.appointment` : Screens/Widgets: `appointments_api_data_source.dart`, `appointment_cancelled_model.dart`
* `data.appointment.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.appointment.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.appointment.verificationStatus` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.appointment.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`
* `data.pointsEarned` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`

---

## AppointmentVerify Module

### Endpoint

```http
POST /appointments/verify-qr
```

### Flutter Screens / Files Using It

* **Called From:** Appointment Details & Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donation verification started successfully",
  "data": {
    "verificationStatus": "pending",
    "appointment": {
      "id": "69fe540565ff7785a031315c",
      "appointmentDate": "2026-05-07T12:00:00.000Z",
      "status": "confirmed",
      "donationType": "Whole Blood",
      "qrToken": "demo-qr-noor-verify",
      "qrScannedAt": "2026-05-07T09:00:00.000Z",
      "qrExpiresAt": "2026-05-08T09:00:00.000Z"
    },
    "donor": {
      "id": "69f3df915f42685cbbbcbb18",
      "fullName": "Aya Hassan",
      "bloodType": "O+",
      "phoneNumber": "01011111111",
      "email": "aya.hassan@lifelink.demo"
    },
    "eligibility": {
      "eligible": true,
      "reason": "Donor is eligible"
    }
  }
}
```

### Verified Required Fields

* `data.verificationStatus` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.appointment` : Screens/Widgets: `appointments_api_data_source.dart`, `appointment_cancelled_model.dart`
* `data.appointment.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.appointment.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.appointment.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.appointment.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`
* `data.appointment.qrToken` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.appointment.qrScannedAt` : Screens/Widgets: `appointment_model.dart`
* `data.appointment.qrExpiresAt` : Screens/Widgets: `appointment_model.dart`, `book_appointment_model.dart`
* `data.donor` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_role.dart`
* `data.donor.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.donor.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.eligibility` : Context: `api_constants.dart`, `app_localizations.dart`
* `data.eligibility.eligible` : Context: `app_localizations.dart`, `app_localizations_en.dart`
* `data.eligibility.reason` : Screens/Widgets: `donation_eligibility_model.dart`, `donation_status_section.dart`

---

### Endpoint

```http
GET /appointments/:appointmentId
```

### Flutter Screens / Files Using It

* **Called From:** Appointment Details & Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "Appointment retrieved",
  "data": {
    "_id": "6663df915f42685cbbbcbb22",
    "appointmentId": "6663df915f42685cbbbcbb22",
    "appointmentDate": "2026-06-10T10:00:00.000Z",
    "status": "PENDING",
    "donationType": "Whole Blood",
    "hospitalId": {
      "_id": "6663df915f42685cbbbcbb19",
      "hospitalName": "LifeLink General Hospital",
      "address": "123 Health Ave, Cairo"
    },
    "hospital": {
      "hospitalId": "6663df915f42685cbbbcbb19",
      "id": "6663df915f42685cbbbcbb19",
      "name": "LifeLink General Hospital",
      "hospitalName": "LifeLink General Hospital"
    },
    "appointment": {
      "appointmentId": "6663df915f42685cbbbcbb22",
      "donationType": "Whole Blood",
      "appointmentDate": "2026-06-10T10:00:00.000Z",
      "status": "PENDING",
      "hospitalId": "6663df915f42685cbbbcbb19",
      "hospitalName": "LifeLink General Hospital"
    }
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.appointmentId` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospitalId.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.hospital` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `user_role.dart`
* `data.hospital.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospital.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospital.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.hospital.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.appointment` : Screens/Widgets: `appointments_api_data_source.dart`, `appointment_cancelled_model.dart`
* `data.appointment.appointmentId` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.appointment.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`
* `data.appointment.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.appointment.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.appointment.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.appointment.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`

---

### Endpoint

```http
PATCH /appointments/:appointmentId
```

### Flutter Screens / Files Using It

* **Called From:** Appointment Details & Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "Appointment rescheduled",
  "data": {
    "_id": "6663df915f42685cbbbcbb22",
    "appointmentId": "6663df915f42685cbbbcbb22",
    "appointmentDate": "2026-06-10T10:00:00.000Z",
    "status": "PENDING",
    "donationType": "Whole Blood",
    "hospitalId": {
      "_id": "6663df915f42685cbbbcbb19",
      "hospitalName": "LifeLink General Hospital",
      "address": "123 Health Ave, Cairo"
    },
    "hospital": {
      "hospitalId": "6663df915f42685cbbbcbb19",
      "id": "6663df915f42685cbbbcbb19",
      "name": "LifeLink General Hospital",
      "hospitalName": "LifeLink General Hospital"
    },
    "appointment": {
      "appointmentId": "6663df915f42685cbbbcbb22",
      "donationType": "Whole Blood",
      "appointmentDate": "2026-06-10T10:00:00.000Z",
      "status": "PENDING",
      "hospitalId": "6663df915f42685cbbbcbb19",
      "hospitalName": "LifeLink General Hospital"
    }
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.appointmentId` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospitalId.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.hospital` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `user_role.dart`
* `data.hospital.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospital.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospital.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.hospital.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.appointment` : Screens/Widgets: `appointments_api_data_source.dart`, `appointment_cancelled_model.dart`
* `data.appointment.appointmentId` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.appointment.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`
* `data.appointment.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.appointment.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.appointment.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.appointment.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`

---

## Auth Module

### Endpoint

```http
POST /auth/signup
```

### Flutter Screens / Files Using It

* **Called From:** Login, Signup, OTP Verification

### Minimum Required Response

```json
{
  "success": true,
  "data": {
    "user": {
      "fullName": "Aya Hassan",
      "email": "aya.hassan@lifelink.demo",
      "role": "donor"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    },
    "verificationEmail": {
      "sent": true
    }
  }
}
```

### Verified Required Fields

* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.user.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.tokens` : Screens/Widgets: `auth_view_model.dart` \| Models: `sign_up_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart`
* `data.tokens.accessToken` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_auth_local_data_source.dart`, `admin_hive_data_source.dart`
* `data.tokens.refreshToken` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `admin_auth_local_data_source.dart`, `admin_hive_data_source.dart`
* `data.verificationEmail` : Models: `sign_up_model.dart`
* `data.verificationEmail.sent` : Models: `forget_password_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
POST /auth/login
```

### Flutter Screens / Files Using It

* **Called From:** Login, Signup, OTP Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJ...access",
    "refreshToken": "eyJ...refresh",
    "verified": true,
    "user": {
      "_id": "69f3df915f42685cbbbcbb18",
      "fullName": "Aya Hassan",
      "email": "aya.hassan@lifelink.demo",
      "role": "donor",
      "isEmailVerified": true
    }
  }
}
```

### Verified Required Fields

* `data.accessToken` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_auth_local_data_source.dart`, `admin_hive_data_source.dart`
* `data.refreshToken` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `admin_auth_local_data_source.dart`, `admin_hive_data_source.dart`
* `data.verified` : Screens/Widgets: `auth_view_model.dart`, `users.dart` \| Models: `login_model.dart`, `verify_otp_model.dart`
* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.user.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.user.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`

---

### Endpoint

```http
POST /auth/hospital/login
```

### Flutter Screens / Files Using It

* **Called From:** Login, Signup, OTP Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "verified": true,
    "user": {
      "_id": "69f3df915f42685cbbbcbb1b",
      "fullName": "Cairo Care Operations",
      "email": "ops@cairocare.demo",
      "role": "hospital",
      "isEmailVerified": true
    },
    "hospitalId": "HOSP-CAIRO-001"
  }
}
```

### Verified Required Fields

* `data.accessToken` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_auth_local_data_source.dart`, `admin_hive_data_source.dart`
* `data.refreshToken` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `admin_auth_local_data_source.dart`, `admin_hive_data_source.dart`
* `data.verified` : Screens/Widgets: `auth_view_model.dart`, `users.dart` \| Models: `login_model.dart`, `verify_otp_model.dart`
* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.user.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.user.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`

---

### Endpoint

```http
POST /auth/admin/login
```

### Flutter Screens / Files Using It

* **Called From:** Login, Signup, OTP Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "accessToken": "eyJ...admin-access",
    "refreshToken": "eyJ...admin-refresh",
    "user": {
      "_id": "66f200000000000000000001",
      "fullName": "Noura Hassan",
      "email": "admin@lifelink.demo",
      "role": "admin",
      "phone": "01099998888"
    }
  }
}
```

### Verified Required Fields

* `data.accessToken` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_auth_local_data_source.dart`, `admin_hive_data_source.dart`
* `data.refreshToken` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `admin_auth_local_data_source.dart`, `admin_hive_data_source.dart`
* `data.user` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_hive_data_source.dart`, `auth_hive_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.user._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.user.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.user.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.user.phone` : Screens/Widgets: `donor_register_form.dart`, `admin_detail_card.dart` \| Models: `user_model.dart`, `admin_login_model.dart`

---

### Endpoint

```http
POST /auth/refresh-token
```

### Flutter Screens / Files Using It

* **Called From:** Login, Signup, OTP Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Verified Required Fields

* `data.accessToken` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| DataSources: `admin_auth_local_data_source.dart`, `admin_hive_data_source.dart`
* `data.access_token` : Models: `login_model.dart` \| DataSources: `auth_hive_data_source.dart`

---

### Endpoint

```http
POST /auth/verify-otp
```

### Flutter Screens / Files Using It

* **Called From:** Login, Signup, OTP Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "Password reset OTP verified successfully",
  "data": {
    "verified": true,
    "email": "aya.hassan@lifelink.demo",
    "otp": "123456"
  }
}
```

### Verified Required Fields

* `data.verified` : Screens/Widgets: `auth_view_model.dart`, `users.dart` \| Models: `login_model.dart`, `verify_otp_model.dart`
* `data.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.otp` : Screens/Widgets: `donor_reset_password.dart`, `auth_view_model.dart` \| Models: `verify_otp_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`

---

### Endpoint

```http
GET /auth/me
```

### Flutter Screens / Files Using It

* **Called From:** Login, Signup, OTP Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "User retrieved",
  "data": {
    "_id": "69f3df915f42685cbbbcbb18",
    "fullName": "Aya Hassan",
    "email": "aya.hassan@lifelink.demo",
    "role": "donor",
    "isEmailVerified": true
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.isEmailVerified` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `me_model.dart`

---

### Endpoint

```http
POST /auth/validate-token
```

### Flutter Screens / Files Using It

* **Called From:** Login, Signup, OTP Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "is_valid": true,
    "user_role": "donor",
    "user_id": "69f3df915f42685cbbbcbb18",
    "role": "donor",
    "userId": "69f3df915f42685cbbbcbb18"
  }
}
```

### Verified Required Fields

* `data.is_valid` : Models: `validate_token_model.dart`
* `data.user_role` : Screens/Widgets: `help_and_support_screen.dart`, `pdf_viewer_screen.dart` \| Models: `login_model.dart`, `validate_token_model.dart`
* `data.user_id` : Screens/Widgets: `ask_api_data_source.dart` \| Models: `login_model.dart`, `validate_token_model.dart`
* `data.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.userId` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `validate_token_model.dart`

---

### Endpoint

```http
POST /auth/fcm-token
```

### Flutter Screens / Files Using It

* **Called From:** Login, Signup, OTP Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "FCM token registered successfully",
  "data": {
    "fcmTokens": [
      "fcm-test-token-1"
    ]
  }
}
```

### Verified Required Fields

* `data.fcmTokens` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
PUT /auth/fcm-token
```

### Flutter Screens / Files Using It

* **Called From:** Login, Signup, OTP Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "FCM token updated successfully",
  "data": {
    "fcmTokens": [
      "fcm-test-token-2"
    ]
  }
}
```

### Verified Required Fields

* `data.fcmTokens` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
DELETE /auth/fcm-token
```

### Flutter Screens / Files Using It

* **Called From:** Login, Signup, OTP Verification

### Minimum Required Response

```json
{
  "success": true,
  "message": "FCM token removed successfully",
  "data": {
    "fcmTokens": []
  }
}
```

### Verified Required Fields

* `data.fcmTokens` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

## Hospital Module

### Endpoint

```http
GET /hospitals
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "data": {
    "hospitals": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0
    }
  }
}
```

### Verified Required Fields

* `data.hospitals` : Screens/Widgets: `critical_alerts_card.dart`, `users.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`

---

### Endpoint

```http
GET /hospitals/nearby
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Nearby hospitals retrieved successfully",
  "data": {
    "hospitals": [
      {
        "id": "69f3df915f42685cbbbcbb1b",
        "hospitalId": "69f3df915f42685cbbbcbb1b",
        "hospital_id": "69f3df915f42685cbbbcbb1b",
        "name": "Cairo Care Hospital",
        "fullName": "Cairo Care Operations",
        "phoneNumber": "1044444444",
        "contactNumber": "1044444444",
        "email": "ops@cairocare.demo",
        "address": {
          "city": "Cairo",
          "governorate": "Cairo"
        },
        "location": {
          "lat": 30.0511,
          "lng": 31.2435
        },
        "lat": 30.0511,
        "lng": 31.2435,
        "hospitalType": "General Hospital",
        "workingHours": "9AM - 5PM",
        "bloodTypes": [
          "O+",
          "A-"
        ],
        "isAvailable": true,
        "urgentNeedsCount": 2,
        "distanceKm": 2.35,
        "distanceMeters": 2350,
        "distance": "2.35 km"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1
    }
  }
}
```

### Verified Required Fields

* `data.hospitals` : Screens/Widgets: `critical_alerts_card.dart`, `users.dart`
* `data.hospitals[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospitals[].hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospitals[].hospital_id` : Screens/Widgets: `add_hospital_dialog.dart`, `nearby_hospitals.dart`
* `data.hospitals[].name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.hospitals[].fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.hospitals[].email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.hospitals[].address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.hospitals[].address.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospitals[].address.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospitals[].location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospitals[].location.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].location.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].hospitalType` : Screens/Widgets: `nearby_hospitals.dart`, `hospital_request_model.dart`
* `data.hospitals[].workingHours` : Screens/Widgets: `nearby_hospitals.dart`
* `data.hospitals[].bloodTypes` : Screens/Widgets: `nearby_hospitals.dart`, `hospital_request_model.dart`
* `data.hospitals[].isAvailable` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `me_model.dart`
* `data.hospitals[].urgentNeedsCount` : Screens/Widgets: `nearby_hospitals.dart`, `hospital_request_model.dart`
* `data.hospitals[].distanceKm` : Screens/Widgets: `location_step.dart`, `nearby_hospitals.dart`
* `data.hospitals[].distanceMeters` : Screens/Widgets: `nearby_hospitals.dart`, `requests_model.dart`
* `data.hospitals[].distance` : Screens/Widgets: `location_step.dart`, `hospital_card.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`

---

### Endpoint

```http
GET /hospitals/search
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Hospitals searched successfully",
  "data": {
    "hospitals": [
      {
        "id": "69f3df915f42685cbbbcbb1b",
        "hospitalId": "69f3df915f42685cbbbcbb1b",
        "hospital_id": "69f3df915f42685cbbbcbb1b",
        "name": "Cairo Care Hospital",
        "fullName": "Cairo Care Operations",
        "address": {
          "city": "Cairo",
          "governorate": "Cairo"
        },
        "bloodTypes": [
          "A+",
          "O+",
          "O-"
        ],
        "isAvailable": true,
        "lat": 30.0444,
        "lng": 31.2357,
        "location": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "hospitalType": "General Hospital",
        "workingHours": "9AM - 5PM",
        "distanceKm": 2.4,
        "distanceMeters": 2400,
        "distance": "2.40 km"
      }
    ]
  }
}
```

### Verified Required Fields

* `data.hospitals` : Screens/Widgets: `critical_alerts_card.dart`, `users.dart`
* `data.hospitals[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospitals[].hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospitals[].hospital_id` : Screens/Widgets: `add_hospital_dialog.dart`, `nearby_hospitals.dart`
* `data.hospitals[].name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.hospitals[].fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.hospitals[].address.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospitals[].address.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospitals[].bloodTypes` : Screens/Widgets: `nearby_hospitals.dart`, `hospital_request_model.dart`
* `data.hospitals[].isAvailable` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `me_model.dart`
* `data.hospitals[].lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospitals[].location.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].location.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].hospitalType` : Screens/Widgets: `nearby_hospitals.dart`, `hospital_request_model.dart`
* `data.hospitals[].workingHours` : Screens/Widgets: `nearby_hospitals.dart`
* `data.hospitals[].distanceKm` : Screens/Widgets: `location_step.dart`, `nearby_hospitals.dart`
* `data.hospitals[].distanceMeters` : Screens/Widgets: `nearby_hospitals.dart`, `requests_model.dart`
* `data.hospitals[].distance` : Screens/Widgets: `location_step.dart`, `hospital_card.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`

---

### Endpoint

```http
GET /hospitals/map
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Hospitals retrieved successfully for map",
  "data": {
    "hospitals": [
      {
        "id": "69f3df915f42685cbbbcbb1b",
        "name": "Cairo Care Hospital",
        "lat": 30.0444,
        "long": 31.2357
      },
      {
        "id": "69f3df925f42685cbbbcbb1c",
        "name": "Alexandria Central Hospital",
        "lat": 31.2001,
        "long": 29.9187
      }
    ]
  }
}
```

### Verified Required Fields

* `data.hospitals` : Screens/Widgets: `critical_alerts_card.dart`, `users.dart`
* `data.hospitals[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospitals[].name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.hospitals[].lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitals[].long` : Context: `app_localizations.dart`, `app_localizations_en.dart`

---

### Endpoint

```http
GET /hospitals/:id
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Hospital retrieved successfully",
  "data": {
    "hospital": {
      "hospitalId": "69f3df915f42685cbbbcbb1b",
      "hospital_id": "69f3df915f42685cbbbcbb1b",
      "name": "Cairo Care Hospital",
      "fullName": "Cairo Care Operations",
      "phoneNumber": "0223456789",
      "contactNumber": "0223456789",
      "email": "ops@cairocare.demo",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo"
      },
      "location": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "lat": 30.0444,
      "lng": 31.2357,
      "hospitalType": "General Hospital",
      "workingHours": "9AM - 5PM",
      "bloodTypes": [
        "A+",
        "O+",
        "O-"
      ],
      "isAvailable": true,
      "urgentNeedsCount": 3,
      "distanceKm": 2.4,
      "distanceMeters": 2400,
      "distance": "2.40 km"
    }
  }
}
```

### Verified Required Fields

* `data.hospital` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `user_role.dart`
* `data.hospital.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospital.hospital_id` : Screens/Widgets: `add_hospital_dialog.dart`, `nearby_hospitals.dart`
* `data.hospital.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.hospital.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospital.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospital.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.hospital.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.hospital.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.hospital.address.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospital.address.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospital.location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospital.location.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospital.location.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospital.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospital.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospital.hospitalType` : Screens/Widgets: `nearby_hospitals.dart`, `hospital_request_model.dart`
* `data.hospital.workingHours` : Screens/Widgets: `nearby_hospitals.dart`
* `data.hospital.bloodTypes` : Screens/Widgets: `nearby_hospitals.dart`, `hospital_request_model.dart`
* `data.hospital.isAvailable` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `me_model.dart`
* `data.hospital.urgentNeedsCount` : Screens/Widgets: `nearby_hospitals.dart`, `hospital_request_model.dart`
* `data.hospital.distanceKm` : Screens/Widgets: `location_step.dart`, `nearby_hospitals.dart`
* `data.hospital.distanceMeters` : Screens/Widgets: `nearby_hospitals.dart`, `requests_model.dart`
* `data.hospital.distance` : Screens/Widgets: `location_step.dart`, `hospital_card.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`

---

### Endpoint

```http
GET /hospital/find-donors
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Nearby donors retrieved successfully",
  "data": {
    "donors": [
      {
        "donorId": "69f3df915f42685cbbbcbb18",
        "fullName": "Sarah J.",
        "bloodType": "O+",
        "email": "sarah.j@example.com",
        "distance": "2.30 km",
        "distanceKm": 2.3,
        "distanceMeters": 2300,
        "isOptedIn": true,
        "phoneNumber": "01012345678",
        "location": {
          "lat": 30.0444,
          "lng": 31.2357
        }
      },
      {
        "donorId": "69f3df915f42685cbbbcbb19",
        "fullName": "Omar F.",
        "bloodType": "O-",
        "email": "omar.f@example.com",
        "distance": "4.10 km",
        "distanceKm": 4.1,
        "distanceMeters": 4100,
        "isOptedIn": true,
        "phoneNumber": "01098765432",
        "location": {
          "lat": 30.061,
          "lng": 31.229
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "totalPages": 1
    }
  }
}
```

### Verified Required Fields

* `data.donors` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart`
* `data.donors[].donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donors[].fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donors[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donors[].email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.donors[].distance` : Screens/Widgets: `location_step.dart`, `hospital_card.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.donors[].distanceKm` : Screens/Widgets: `location_step.dart`, `nearby_hospitals.dart`
* `data.donors[].distanceMeters` : Screens/Widgets: `nearby_hospitals.dart`, `requests_model.dart`
* `data.donors[].isOptedIn` : Models: `me_model.dart`, `sign_up_model.dart`
* `data.donors[].phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donors[].location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.donors[].location.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donors[].location.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`

---

### Endpoint

```http
POST /hospital/donors/:donorId/appointments
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "data": {
    "donorId": "69f3df915f42685cbbbcbb18",
    "donorDetails": {
      "fullName": "Sarah J.",
      "phoneNumber": "01012345678",
      "bloodType": "O+",
      "email": "sarah.j@example.com"
    },
    "hospitalId": "69f3df915f42685cbbbcbb20",
    "appointmentDate": "2026-05-30T10:00:00.000Z",
    "status": "pending",
    "donationType": "Whole Blood"
  }
}
```

### Verified Required Fields

* `data.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donorDetails` : Screens/Widgets: `book_appointment_model.dart`
* `data.donorDetails.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.donationType` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `donation_history.dart`

---

### Endpoint

```http
GET /hospital/appointments
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "_id": "69fe540565ff7785a031315c",
        "donorDetails": {
          "fullName": "Jane Doe",
          "phoneNumber": 201234567890,
          "bloodType": "O+"
        }
      }
    ]
  }
}
```

### Verified Required Fields

* `data.appointments` : Screens/Widgets: `appointment_model.dart`, `appointments_view_model.dart`
* `data.appointments[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.appointments[].donorDetails` : Screens/Widgets: `book_appointment_model.dart`
* `data.appointments[].donorDetails.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.appointments[].donorDetails.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.appointments[].donorDetails.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`

---

### Endpoint

```http
GET /hospital/appointments/:appointmentId
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Appointment retrieved successfully",
  "data": {
    "appointmentId": "69fe540565ff7785a031315c",
    "appointmentDate": "2026-06-01T09:00:00.000Z",
    "status": "confirmed",
    "donorId": "66f100000000000000000002",
    "hospitalId": "69f3df915f42685cbbbcbb10",
    "requestId": "69fe540565ff7785a0313151",
    "donorDetails": {
      "fullName": "Jane Doe",
      "phoneNumber": 201234567890,
      "bloodType": "O+",
      "email": "jane@example.com"
    },
    "donor": {
      "donorId": "66f100000000000000000002",
      "fullName": "Jane Doe",
      "email": "jane.doe@example.com",
      "phoneNumber": 201234567890,
      "bloodType": "O+"
    }
  }
}
```

### Verified Required Fields

* `data.appointmentId` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.appointmentDate` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donorDetails` : Screens/Widgets: `book_appointment_model.dart`
* `data.donorDetails.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donorDetails.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.donor` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_role.dart`
* `data.donor.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donor.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.donor.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`

---

### Endpoint

```http
GET /hospital/profile
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Hospital profile retrieved successfully",
  "data": {
    "_id": "66f100000000000000000001",
    "fullName": "Cairo Care Operations",
    "hospitalName": "Cairo Care Hospital",
    "type": "hospital",
    "hospitalType": "General Hospital",
    "email": "info@cairocare.demo",
    "role": "hospital",
    "contactNumber": "1044444444",
    "phone": "1044444444",
    "address": {
      "city": "Cairo",
      "governorate": "Cairo"
    },
    "city": "Cairo",
    "state": "Cairo",
    "hospitalId": "cairo-care-hospital",
    "adminContactName": "Dr. Sara Mahmoud",
    "adminContactPhone": "01123456789",
    "capacity": 120,
    "lat": 30.0444,
    "long": 31.2357,
    "workingHours": "9AM - 5PM"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.hospitalType` : Screens/Widgets: `nearby_hospitals.dart`, `hospital_request_model.dart`
* `data.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.phone` : Screens/Widgets: `donor_register_form.dart`, `admin_detail_card.dart` \| Models: `user_model.dart`, `admin_login_model.dart`
* `data.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.address.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.address.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.state` : Screens/Widgets: `admin_authentication.dart`, `donor_register_form.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.adminContactName` : Screens/Widgets: `add_hospital_dialog.dart`
* `data.adminContactPhone` : Screens/Widgets: `add_hospital_dialog.dart`
* `data.capacity` : Screens/Widgets: `time_slots_model.dart`, `date_time_step.dart`
* `data.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.long` : Context: `app_localizations.dart`, `app_localizations_en.dart`
* `data.workingHours` : Screens/Widgets: `nearby_hospitals.dart`

---

### Endpoint

```http
PUT /hospital/profile
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Hospital profile updated successfully",
  "data": {
    "_id": "66f100000000000000000001",
    "fullName": "Cairo Care Operations",
    "hospitalName": "Cairo Care Hospital",
    "type": "hospital",
    "hospitalType": "General Hospital",
    "contactNumber": "1044444444",
    "hospitalId": "cairo-care-hospital",
    "location": {
      "city": "Cairo",
      "governorate": "Cairo",
      "coordinates": {
        "lat": 30.0511,
        "lng": 31.2435
      }
    }
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.hospitalType` : Screens/Widgets: `nearby_hospitals.dart`, `hospital_request_model.dart`
* `data.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location.coordinates` : Screens/Widgets: `build_location_card.dart`, `map_view.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart`
* `data.location.coordinates.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.location.coordinates.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`

---

### Endpoint

```http
GET /hospital/appointment-settings
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Appointment settings retrieved successfully",
  "data": {
    "hourlySlots": {
      "09:00": 4,
      "10:00": 4,
      "11:00": 4,
      "12:00": 4
    },
    "isActive": true
  }
}
```

### Verified Required Fields

* `data.hourlySlots.09:00` : Screens/Widgets: `audit_logs_dialog.dart`, `time_slots_model.dart`
* `data.hourlySlots.10:00` : Screens/Widgets: `time_slots_model.dart`
* `data.hourlySlots.11:00` : Screens/Widgets: `time_slots_model.dart`
* `data.hourlySlots.12:00` : Screens/Widgets: `time_slots_model.dart`
* `data.isActive` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`

---

### Endpoint

```http
PUT /hospital/appointment-settings
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Appointment settings updated successfully",
  "data": {
    "hourlySlots": {
      "09:00": 4,
      "10:00": 4,
      "11:00": 4,
      "12:00": 4
    },
    "isActive": true
  }
}
```

### Verified Required Fields

* `data.hourlySlots.09:00` : Screens/Widgets: `audit_logs_dialog.dart`, `time_slots_model.dart`
* `data.hourlySlots.10:00` : Screens/Widgets: `time_slots_model.dart`
* `data.hourlySlots.11:00` : Screens/Widgets: `time_slots_model.dart`
* `data.hourlySlots.12:00` : Screens/Widgets: `time_slots_model.dart`
* `data.isActive` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`

---

### Endpoint

```http
POST /hospital/request
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donation request created successfully",
  "data": {
    "_id": "66f300000000000000000001",
    "hospitalId": {
      "_id": "66f100000000000000000001",
      "fullName": "Cairo Care Operations",
      "hospitalName": "Cairo Care Hospital"
    },
    "type": "blood",
    "bloodType": [
      "O+",
      "B-"
    ],
    "urgency": "critical",
    "requiredBy": "2026-05-12T10:00:00.000Z",
    "quantity": 3,
    "unitsNeeded": 3,
    "patientType": "adult",
    "isEmergency": true,
    "notes": "Emergency surgery support"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.hospitalId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.requiredBy` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.unitsNeeded` : Screens/Widgets: `alerts_dialog.dart`, `critical_alerts_card.dart` \| Models: `alert.dart`
* `data.patientType` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.isEmergency` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.notes` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
POST /hospital/requests/create-emergency
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donation request created successfully",
  "data": {
    "_id": "66f300000000000000000001",
    "hospitalId": {
      "_id": "66f100000000000000000001",
      "fullName": "Cairo Care Operations",
      "hospitalName": "Cairo Care Hospital"
    },
    "hospitalContact": "1044444444",
    "contactNumber": "1044444444",
    "type": "blood",
    "bloodType": [
      "O+"
    ],
    "urgency": "critical",
    "requiredBy": "2026-05-12T10:00:00.000Z",
    "quantity": 2,
    "unitsNeeded": 2,
    "patientType": "Patient requires urgent blood transfusion",
    "isEmergency": true,
    "notes": "Patient requires urgent blood transfusion"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.hospitalId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospitalContact` : Screens/Widgets: `admin_request.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.requiredBy` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.unitsNeeded` : Screens/Widgets: `alerts_dialog.dart`, `critical_alerts_card.dart` \| Models: `alert.dart`
* `data.patientType` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.isEmergency` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.notes` : Screens/Widgets: `appointments_api_data_source.dart`, `appointments_remote_data_source.dart` \| Models: `me_model.dart`, `sign_up_model.dart`

---

### Endpoint

```http
GET /hospital/dashboard
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Monthly report retrieved successfully",
  "data": {
    "month": "2026-05",
    "totalRequests": 9,
    "activeRequests": 3,
    "totalDonations": 7
  }
}
```

### Verified Required Fields

* `data.month` : Screens/Widgets: `donor_register_form.dart`, `review_and_confirm.dart`
* `data.totalRequests` : Screens/Widgets: `user_detail_dialog.dart`, `profile.dart`
* `data.activeRequests` : Screens/Widgets: `admin_request.dart`, `dashboard.dart`
* `data.totalDonations` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`

---

### Endpoint

```http
GET /hospital/history
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request history retrieved successfully",
  "data": {
    "statistics": {
      "activeRequests": 3
    },
    "requests": [
      {
        "_id": "69fe540565ff7785a0313150",
        "bloodType": "O+",
        "unitsRequested": 3,
        "urgencyLevel": "critical",
        "donorsContacted": 20,
        "donorsConfirmed": 12,
        "isFulfilled": true,
        "requestDate": "2024-09-28T00:00:00.000Z",
        "completionTimeInHours": 3,
        "priority": "critical",
        "location": "30.0444, 31.2357",
        "hospitalContact": "01099998888",
        "hospitalName": "Al Noor Hospital",
        "status": "completed"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "currentPage": 1,
      "limit": 10,
      "totalPages": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### Verified Required Fields

* `data.statistics.activeRequests` : Screens/Widgets: `admin_request.dart`, `dashboard.dart`
* `data.requests` : Screens/Widgets: `admin_main_layout.dart`, `admin_request.dart`
* `data.requests[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.requests[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.requests[].unitsRequested` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `blood_request.dart`
* `data.requests[].urgencyLevel` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `blood_request.dart`
* `data.requests[].donorsContacted` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `blood_request.dart`
* `data.requests[].donorsConfirmed` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `blood_request.dart`
* `data.requests[].isFulfilled` : Screens/Widgets: `admin_request.dart`, `history.dart` \| Models: `blood_request.dart`, `blood_request_history.dart`
* `data.requests[].requestDate` : Screens/Widgets: `admin_request.dart`, `history.dart` \| Models: `blood_request.dart`
* `data.requests[].completionTimeInHours` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `blood_request.dart`
* `data.requests[].priority` : Screens/Widgets: `admin_request.dart`, `history.dart` \| Models: `blood_request.dart`, `blood_request_history.dart`
* `data.requests[].location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.requests[].hospitalContact` : Screens/Widgets: `admin_request.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.requests[].hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.requests[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.currentPage` : Screens/Widgets: `requests_model.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`
* `data.pagination.hasNextPage` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`
* `data.pagination.hasPrevPage` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`

---

### Endpoint

```http
POST /hospital/requests/:requestId/close
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request closed successfully",
  "data": {
    "_id": "69fe540565ff7785a0313150",
    "status": "completed"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`

---

### Endpoint

```http
GET /hospital/requests
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Requests retrieved successfully",
  "data": {
    "requests": [
      {
        "_id": "69fe540565ff7785a0313150",
        "type": "blood",
        "bloodType": "A-",
        "urgency": "high",
        "status": "in-progress",
        "quantity": 2,
        "requiredBy": "2026-05-18T18:00:00.000Z"
      },
      {
        "_id": "69fe540565ff7785a0313153",
        "type": "platelets",
        "urgency": "pending",
        "status": "pending",
        "quantity": 1,
        "requiredBy": "2026-05-19T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

### Verified Required Fields

* `data.requests` : Screens/Widgets: `admin_main_layout.dart`, `admin_request.dart`
* `data.requests[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.requests[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.requests[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.requests[].urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.requests[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.requests[].quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.requests[].requiredBy` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`

---

### Endpoint

```http
GET /hospital/requests/:requestId
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request details retrieved successfully",
  "data": {
    "request": {
      "_id": "69fe540565ff7785a0313150",
      "type": "blood",
      "bloodType": [
        "A-",
        "O-"
      ],
      "urgency": "high",
      "status": "in-progress",
      "quantity": 2,
      "hospitalId": {
        "_id": "69f3df915f42685cbbbcbb1b",
        "hospitalName": "Cairo Care Hospital",
        "contactNumber": "0223456789"
      }
    },
    "donations": [
      {
        "_id": "69fe540565ff7785a0313157",
        "donorId": {
          "_id": "69f3df915f42685cbbbcbb18",
          "fullName": "Aya Hassan",
          "email": "aya.hassan@lifelink.demo",
          "bloodType": "O+"
        },
        "quantity": 1,
        "status": "pending"
      }
    ]
  }
}
```

### Verified Required Fields

* `data.request` : Screens/Widgets: `admin_auth_view_model.dart`, `admin_request.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.request.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.request.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.request.urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.request.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.request.quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.request.hospitalId` : Screens/Widgets: `critical_alerts_card.dart`, `appointments_api_data_source.dart` \| Models: `alert.dart`
* `data.request.hospitalId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.request.hospitalId.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.request.hospitalId.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.donations` : Screens/Widgets: `donor_tile.dart`, `user_detail_dialog.dart`
* `data.donations[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donations[].donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donations[].donorId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donations[].donorId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donations[].donorId.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.donations[].donorId.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donations[].quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.donations[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`

---

### Endpoint

```http
PUT /hospital/requests/:requestId
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request status updated successfully",
  "data": {
    "_id": "69fe540565ff7785a0313150",
    "status": "completed",
    "bloodType": "A-",
    "urgency": "high",
    "updatedAt": "2026-05-18T09:40:00.000Z"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
GET /hospital/donations
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Donations retrieved successfully",
  "data": {
    "donations": [
      {
        "_id": "69fe540565ff7785a0313157",
        "donorId": {
          "_id": "69f3df915f42685cbbbcbb18",
          "fullName": "Aya Hassan",
          "email": "aya.hassan@lifelink.demo",
          "bloodType": "O+"
        },
        "requestId": {
          "_id": "69fe540565ff7785a0313150",
          "type": "blood",
          "bloodType": "A-",
          "urgency": "high"
        },
        "quantity": 1,
        "status": "completed"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

### Verified Required Fields

* `data.donations` : Screens/Widgets: `donor_tile.dart`, `user_detail_dialog.dart`
* `data.donations[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donations[].donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donations[].donorId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donations[].donorId.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donations[].donorId.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.donations[].donorId.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donations[].requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donations[].requestId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donations[].requestId.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.donations[].requestId.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donations[].requestId.urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.donations[].quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.donations[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`

---

### Endpoint

```http
GET /hospital/notifications
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Notifications retrieved",
  "data": {
    "notifications": [
      {
        "_id": "6663df915f42685cbbbcbb23",
        "title": "New Blood Request",
        "message": "LifeLink General Hospital needs O- blood urgently.",
        "type": "URGENT_REQUEST",
        "isRead": false,
        "createdAt": "2026-06-01T12:00:00.000Z",
        "updatedAt": "2026-06-01T12:00:00.000Z"
      }
    ]
  }
}
```

### Verified Required Fields

* `data.notifications` : Screens/Widgets: `home.dart`, `fcm_api_data_source.dart`
* `data.notifications[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.notifications[].title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.notifications[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.notifications[].isRead` : Screens/Widgets: `notification_request.dart`
* `data.notifications[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.notifications[].updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
PATCH /hospital/notifications/:id/read
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "_id": "6663df915f42685cbbbcbb23",
    "title": "New Blood Request",
    "message": "LifeLink General Hospital needs O- blood urgently.",
    "type": "URGENT_REQUEST",
    "isRead": false,
    "createdAt": "2026-06-01T12:00:00.000Z",
    "updatedAt": "2026-06-01T12:00:00.000Z"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.isRead` : Screens/Widgets: `notification_request.dart`
* `data.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
PUT /hospital/notifications/:id/read
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "_id": "6663df915f42685cbbbcbb23",
    "title": "New Blood Request",
    "message": "LifeLink General Hospital needs O- blood urgently.",
    "type": "URGENT_REQUEST",
    "isRead": false,
    "createdAt": "2026-06-01T12:00:00.000Z",
    "updatedAt": "2026-06-01T12:00:00.000Z"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.isRead` : Screens/Widgets: `notification_request.dart`
* `data.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
GET /hospital/notifications/:id
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Notification retrieved",
  "data": {
    "_id": "6663df915f42685cbbbcbb23",
    "title": "New Blood Request",
    "message": "LifeLink General Hospital needs O- blood urgently.",
    "type": "URGENT_REQUEST",
    "isRead": false,
    "createdAt": "2026-06-01T12:00:00.000Z",
    "updatedAt": "2026-06-01T12:00:00.000Z"
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.isRead` : Screens/Widgets: `notification_request.dart`
* `data.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
GET /hospital/blood-bank-settings
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Blood bank settings retrieved successfully",
  "data": {
    "bloodBankSettings": {
      "criticalThreshold": {
        "O-": 2,
        "A-": 3
      },
      "lowThreshold": {
        "O-": 6,
        "A-": 8
      }
    }
  }
}
```

### Verified Required Fields

* `data.bloodBankSettings.criticalThreshold.O-` : Screens/Widgets: `donor_register_form.dart`, `blood_type_chart.dart`
* `data.bloodBankSettings.criticalThreshold.A-` : Screens/Widgets: `donor_register_form.dart`, `admin_request.dart`
* `data.bloodBankSettings.lowThreshold.O-` : Screens/Widgets: `donor_register_form.dart`, `blood_type_chart.dart`
* `data.bloodBankSettings.lowThreshold.A-` : Screens/Widgets: `donor_register_form.dart`, `admin_request.dart`

---

### Endpoint

```http
PUT /hospital/blood-bank-settings
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Blood bank settings updated successfully",
  "data": {
    "bloodBankSettings": {
      "criticalThreshold": {
        "O-": 3,
        "A-": 4
      },
      "lowThreshold": {
        "O-": 7,
        "A-": 9
      }
    }
  }
}
```

### Verified Required Fields

* `data.bloodBankSettings.criticalThreshold.O-` : Screens/Widgets: `donor_register_form.dart`, `blood_type_chart.dart`
* `data.bloodBankSettings.criticalThreshold.A-` : Screens/Widgets: `donor_register_form.dart`, `admin_request.dart`
* `data.bloodBankSettings.lowThreshold.O-` : Screens/Widgets: `donor_register_form.dart`, `blood_type_chart.dart`
* `data.bloodBankSettings.lowThreshold.A-` : Screens/Widgets: `donor_register_form.dart`, `admin_request.dart`

---

### Endpoint

```http
GET /hospital/notification-preferences
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Notification preferences retrieved successfully",
  "data": {
    "notificationPreferences": {
      "email": true,
      "push": true,
      "sms": false
    }
  }
}
```

### Verified Required Fields

* `data.notificationPreferences` : Screens/Widgets: `profile.dart`, `notification_preferences_dialog.dart`
* `data.notificationPreferences.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.notificationPreferences.push` : Screens/Widgets: `chat_bot_dialog.dart`, `setting.dart`
* `data.notificationPreferences.sms` : Screens/Widgets: `two_factor_authentication_screen.dart`, `options_card.dart`

---

### Endpoint

```http
PUT /hospital/notification-preferences
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Notification preferences updated successfully",
  "data": {
    "notificationPreferences": {
      "email": true,
      "push": false,
      "sms": true
    }
  }
}
```

### Verified Required Fields

* `data.notificationPreferences` : Screens/Widgets: `profile.dart`, `notification_preferences_dialog.dart`
* `data.notificationPreferences.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.notificationPreferences.push` : Screens/Widgets: `chat_bot_dialog.dart`, `setting.dart`
* `data.notificationPreferences.sms` : Screens/Widgets: `two_factor_authentication_screen.dart`, `options_card.dart`

---

### Endpoint

```http
GET /hospital/reports/monthly
```

### Flutter Screens / Files Using It

* **Called From:** Hospital Dashboard, Find Donors

### Minimum Required Response

```json
{
  "success": true,
  "message": "Monthly report retrieved successfully",
  "data": {
    "month": "2026-05",
    "totalRequests": 11,
    "activeRequests": 4,
    "totalDonations": 9
  }
}
```

### Verified Required Fields

* `data.month` : Screens/Widgets: `donor_register_form.dart`, `review_and_confirm.dart`
* `data.totalRequests` : Screens/Widgets: `user_detail_dialog.dart`, `profile.dart`
* `data.activeRequests` : Screens/Widgets: `admin_request.dart`, `dashboard.dart`
* `data.totalDonations` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`

---

## Help Module

### Endpoint

```http
GET /help/faq
```

### Flutter Screens / Files Using It

* **Called From:** General flow

### Minimum Required Response

```json
{
  "success": true,
  "message": "FAQ retrieved successfully",
  "data": {
    "faqs": [
      {
        "category": "DONATION",
        "question": "How often can I donate blood?",
        "answer": "Whole blood donation is generally allowed every 56 days."
      },
      {
        "category": "REWARDS",
        "question": "How do points work?",
        "answer": "You earn points from successful donations, emergency responses, profile completion, and badges."
      }
    ]
  }
}
```

### Verified Required Fields

* `data.faqs` : Screens/Widgets: `help_and_support_screen.dart`, `faq_section.dart`
* `data.faqs[].category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.faqs[].question` : Screens/Widgets: `ask_api_data_source.dart`, `ask_remote_data_source.dart`
* `data.faqs[].answer` : Screens/Widgets: `chat_bot_dialog.dart`, `ask_api_data_source.dart`

---

### Endpoint

```http
GET /help/documents/:type
```

### Flutter Screens / Files Using It

* **Called From:** General flow

### Minimum Required Response

```json
{
  "success": true,
  "message": "Document retrieved successfully",
  "data": {
    "title": "Donation Guidelines",
    "version": "1.0"
  }
}
```

### Verified Required Fields

* `data.title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.version` : Screens/Widgets: `qr_card.dart`

---

## Notifications Module

### Endpoint

```http
GET /notifications
```

### Flutter Screens / Files Using It

* **Called From:** Notification Settings & Inbox

### Minimum Required Response

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

### Verified Required Fields

* `data.notifications` : Screens/Widgets: `home.dart`, `fcm_api_data_source.dart`
* `data.notifications[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.notifications[].userId` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `validate_token_model.dart`
* `data.notifications[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.notifications[].title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.notifications[].message` : Context: Implicit network parser / api_client.dart
* `data.notifications[].read` : Screens/Widgets: `admin_authentication.dart`, `donor_register_form.dart`
* `data.notifications[].relatedId` : Screens/Widgets: `notifications_model.dart`
* `data.notifications[].relatedType` : Screens/Widgets: `notifications_model.dart`
* `data.notifications[].data` : Context: Implicit network parser / api_client.dart
* `data.notifications[].data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.notifications[].data.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.notifications[].data.requestType` : Screens/Widgets: `notifications_model.dart`, `notifications.dart`
* `data.notifications[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.notifications[].updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`
* `data.unreadCount` : Screens/Widgets: `notifications_model.dart`, `notifications.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.pages` : Screens/Widgets: `notifications_model.dart`, `pdf_viewer_screen.dart`

---

### Endpoint

```http
PATCH /notifications/:id/read
```

### Flutter Screens / Files Using It

* **Called From:** Notification Settings & Inbox

### Minimum Required Response

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

### Verified Required Fields

* `data.notification` : Screens/Widgets: `notification_hive_data_source.dart`, `notification_local_data_source.dart`
* `data.notification._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.notification.userId` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `validate_token_model.dart`
* `data.notification.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.notification.title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.notification.read` : Screens/Widgets: `admin_authentication.dart`, `donor_register_form.dart`
* `data.notification.relatedId` : Screens/Widgets: `notifications_model.dart`
* `data.notification.relatedType` : Screens/Widgets: `notifications_model.dart`
* `data.notification.data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.notification.data.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.notification.data.requestType` : Screens/Widgets: `notifications_model.dart`, `notifications.dart`
* `data.notification.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.notification.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

### Endpoint

```http
PATCH /notifications/read-all
```

### Flutter Screens / Files Using It

* **Called From:** Notification Settings & Inbox

### Minimum Required Response

```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "modifiedCount": 12
  }
}
```

### Verified Required Fields

* `data.modifiedCount` : Screens/Widgets: `notification_all_read_model.dart`

---

### Endpoint

```http
GET /notifications/:id
```

### Flutter Screens / Files Using It

* **Called From:** Notification Settings & Inbox

### Minimum Required Response

```json
{
  "success": true,
  "message": "Notification retrieved successfully",
  "data": {
    "notification": {
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
  }
}
```

### Verified Required Fields

* `data.notification` : Screens/Widgets: `notification_hive_data_source.dart`, `notification_local_data_source.dart`
* `data.notification._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.notification.userId` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `login_model.dart`, `validate_token_model.dart`
* `data.notification.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.notification.title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.notification.read` : Screens/Widgets: `admin_authentication.dart`, `donor_register_form.dart`
* `data.notification.relatedId` : Screens/Widgets: `notifications_model.dart`
* `data.notification.relatedType` : Screens/Widgets: `notifications_model.dart`
* `data.notification.data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.notification.data.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.notification.data.requestType` : Screens/Widgets: `notifications_model.dart`, `notifications.dart`
* `data.notification.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.notification.updatedAt` : Screens/Widgets: `appointment_model.dart`, `donation_booking_card.dart` \| Models: `donor.dart`, `me_model.dart`

---

## Requests Module

### Endpoint

```http
GET /requests/nearby
```

### Flutter Screens / Files Using It

* **Called From:** Explore Requests

### Minimum Required Response

```json
{
  "success": true,
  "message": "Nearby requests retrieved successfully",
  "data": {
    "requests": [
      {
        "id": "69fe540565ff7785a031314f",
        "requestId": "69fe540565ff7785a031314f",
        "type": "blood",
        "bloodType": "O+",
        "hospitalName": "Cairo Care Hospital",
        "patientType": "Emergency surgery support",
        "contactNumber": "1044444444",
        "unitsNeeded": 3,
        "isEmergency": true,
        "createdAt": "2026-05-16T08:15:00.000Z",
        "status": "pending",
        "requestStatus": "pending",
        "urgency": "critical",
        "requiredBy": "2026-05-20T00:00:00.000Z",
        "locationHospital": {
          "latitude": 30.0511,
          "longitude": 31.2435
        },
        "location": {
          "lat": 30.0511,
          "lng": 31.2435
        },
        "hospital": {
          "id": "69f3df915f42685cbbbcbb1b",
          "name": "Cairo Care Hospital",
          "contactNumber": "1044444444",
          "address": "Cairo, Egypt",
          "latitude": 30.0511,
          "longitude": 31.2435
        },
        "distanceKm": 2.35,
        "distanceMeters": 2350,
        "distance": "2.35 km"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    },
    "viewerLocation": {
      "latitude": 30.0333,
      "longitude": 31.2333
    },
    "radiusKm": 25
  }
}
```

### Verified Required Fields

* `data.requests` : Screens/Widgets: `admin_main_layout.dart`, `admin_request.dart`
* `data.requests[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.requests[].requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.requests[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.requests[].bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.requests[].hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.requests[].patientType` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.requests[].contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.requests[].unitsNeeded` : Screens/Widgets: `alerts_dialog.dart`, `critical_alerts_card.dart` \| Models: `alert.dart`
* `data.requests[].isEmergency` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.requests[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.requests[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.requests[].requestStatus` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.requests[].urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.requests[].requiredBy` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.requests[].locationHospital` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.requests[].locationHospital.latitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.requests[].locationHospital.longitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.requests[].location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.requests[].location.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.requests[].location.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.requests[].hospital` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `user_role.dart`
* `data.requests[].hospital.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.requests[].hospital.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.requests[].hospital.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.requests[].hospital.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.requests[].hospital.latitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.requests[].hospital.longitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.requests[].distanceKm` : Screens/Widgets: `location_step.dart`, `nearby_hospitals.dart`
* `data.requests[].distanceMeters` : Screens/Widgets: `nearby_hospitals.dart`, `requests_model.dart`
* `data.requests[].distance` : Screens/Widgets: `location_step.dart`, `hospital_card.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`
* `data.viewerLocation` : Screens/Widgets: `requests_model.dart`
* `data.viewerLocation.latitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.viewerLocation.longitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.radiusKm` : Screens/Widgets: `requests_model.dart`

---

### Endpoint

```http
GET /requests/:id/google-maps
```

### Flutter Screens / Files Using It

* **Called From:** Explore Requests

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request location retrieved successfully",
  "data": {
    "requestId": "69fe540565ff7785a031314f",
    "location": {
      "lat": 30.0511,
      "lng": 31.2435
    }
  }
}
```

### Verified Required Fields

* `data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.location.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`

---

### Endpoint

```http
GET /requests/:id
```

### Flutter Screens / Files Using It

* **Called From:** Explore Requests

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request details retrieved successfully",
  "data": {
    "id": "69fe540565ff7785a031314f",
    "requestId": "69fe540565ff7785a031314f",
    "bloodType": "O-",
    "hospitalName": "Cairo Care Hospital",
    "patientType": "blood",
    "contactNumber": "0223456789",
    "unitsNeeded": 3,
    "isEmergency": true,
    "createdAt": "2026-05-18T08:20:00.000Z",
    "status": "pending",
    "requestStatus": "pending",
    "urgency": "critical",
    "type": "blood",
    "requiredBy": "2026-05-18T16:00:00.000Z",
    "locationHospital": {
      "latitude": 30.0444,
      "longitude": 31.2357
    },
    "location": {
      "lat": 30.0444,
      "lng": 31.2357
    },
    "qrToken": null,
    "qrCreatedAt": null,
    "qrExpiresAt": null,
    "hospital": {
      "id": "69f3df915f42685cbbbcbb1b",
      "name": "Cairo Care Hospital",
      "contactNumber": "0223456789",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo"
      },
      "latitude": 30.0444,
      "longitude": 31.2357
    },
    "distanceKm": 2.4,
    "distanceMeters": 2400,
    "distance": "2.40 km"
  }
}
```

### Verified Required Fields

* `data.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.patientType` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.unitsNeeded` : Screens/Widgets: `alerts_dialog.dart`, `critical_alerts_card.dart` \| Models: `alert.dart`
* `data.isEmergency` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.requestStatus` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.requiredBy` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.locationHospital` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.locationHospital.latitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.locationHospital.longitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.location.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.location.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.qrToken` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.qrCreatedAt` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.qrExpiresAt` : Screens/Widgets: `appointment_model.dart`, `book_appointment_model.dart`
* `data.hospital` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `user_role.dart`
* `data.hospital.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.hospital.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.hospital.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.hospital.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.hospital.address.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospital.address.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospital.latitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.hospital.longitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.distanceKm` : Screens/Widgets: `location_step.dart`, `nearby_hospitals.dart`
* `data.distanceMeters` : Screens/Widgets: `nearby_hospitals.dart`, `requests_model.dart`
* `data.distance` : Screens/Widgets: `location_step.dart`, `hospital_card.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`

---

### Endpoint

```http
POST /requests/:id/generate-qr
```

### Flutter Screens / Files Using It

* **Called From:** Explore Requests

### Minimum Required Response

```json
{
  "success": true,
  "message": "QR generated successfully",
  "data": {
    "qrToken": "a18df3083c83f3a8c1d90a61d6c70a0f5316897f4feefdc9611b32ad7dd114e2",
    "qrCreatedAt": "2026-05-18T09:45:00.000Z",
    "qrExpiresAt": "2026-05-18T11:45:00.000Z",
    "requestId": "69fe540565ff7785a031314f"
  }
}
```

### Verified Required Fields

* `data.qrToken` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.qrCreatedAt` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.qrExpiresAt` : Screens/Widgets: `appointment_model.dart`, `book_appointment_model.dart`
* `data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`

---

### Endpoint

```http
POST /requests/verify-qr
```

### Flutter Screens / Files Using It

* **Called From:** Explore Requests

### Minimum Required Response

```json
{
  "success": true,
  "message": "QR verified successfully",
  "data": {
    "valid": true,
    "requestId": "69fe540565ff7785a031314f",
    "hospitalName": "Cairo Care Hospital",
    "bloodType": "O-",
    "patientType": "blood",
    "contactNumber": "0223456789",
    "unitsNeeded": 3,
    "isEmergency": true,
    "createdAt": "2026-05-18T08:20:00.000Z",
    "status": "pending",
    "locationHospital": {
      "latitude": 30.0444,
      "longitude": 31.2357
    },
    "qrToken": "a18df3083c83f3a8c1d90a61d6c70a0f5316897f4feefdc9611b32ad7dd114e2",
    "qrCreatedAt": "2026-05-18T09:45:00.000Z",
    "qrExpiresAt": "2026-05-18T11:45:00.000Z"
  }
}
```

### Verified Required Fields

* `data.valid` : Models: `validate_token_model.dart`
* `data.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.patientType` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.unitsNeeded` : Screens/Widgets: `alerts_dialog.dart`, `critical_alerts_card.dart` \| Models: `alert.dart`
* `data.isEmergency` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.locationHospital` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.locationHospital.latitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.locationHospital.longitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.qrToken` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.qrCreatedAt` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.qrExpiresAt` : Screens/Widgets: `appointment_model.dart`, `book_appointment_model.dart`

---

### Endpoint

```http
POST /requests/:id/accept
```

### Flutter Screens / Files Using It

* **Called From:** Explore Requests

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request accepted successfully",
  "data": {
    "request": {
      "id": "69fe540565ff7785a031314f",
      "requestId": "69fe540565ff7785a031314f",
      "bloodType": "O-",
      "hospitalName": "Cairo Care Hospital",
      "patientType": "blood",
      "contactNumber": "0223456789",
      "unitsNeeded": 3,
      "isEmergency": true,
      "createdAt": "2026-05-18T08:20:00.000Z",
      "status": "accepted",
      "requestStatus": "accepted",
      "urgency": "critical",
      "type": "blood",
      "requiredBy": "2026-05-18T16:00:00.000Z",
      "locationHospital": {
        "latitude": 30.0444,
        "longitude": 31.2357,
        "location": {
          "lat": 30.0444,
          "lng": 31.2357
        }
      },
      "qrToken": null,
      "qrCreatedAt": null,
      "qrExpiresAt": null,
      "hospital": {
        "id": "69f3df915f42685cbbbcbb1b",
        "name": "Cairo Care Hospital",
        "contactNumber": "0223456789",
        "address": {
          "city": "Cairo",
          "governorate": "Cairo"
        },
        "latitude": 30.0444,
        "longitude": 31.2357
      },
      "distanceKm": null,
      "distanceMeters": null,
      "distance": null
    },
    "donor": {
      "id": "69f3df915f42685cbbbcbb18",
      "name": "Aya Hassan",
      "phoneNumber": "01011111111",
      "bloodType": "O+"
    },
    "donation": {
      "_id": "69fe540565ff7785a0313157",
      "donorId": "69f3df915f42685cbbbcbb18",
      "requestId": "69fe540565ff7785a031314f",
      "quantity": 3,
      "status": "pending"
    }
  }
}
```

### Verified Required Fields

* `data.request` : Screens/Widgets: `admin_auth_view_model.dart`, `admin_request.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.request.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.request.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.request.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.request.patientType` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.request.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.request.unitsNeeded` : Screens/Widgets: `alerts_dialog.dart`, `critical_alerts_card.dart` \| Models: `alert.dart`
* `data.request.isEmergency` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.request.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.request.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.request.requestStatus` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.request.urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.request.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.request.requiredBy` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.request.locationHospital` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.request.locationHospital.latitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request.locationHospital.longitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request.locationHospital.location` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `alert.dart`, `blood_request.dart` \| Repositories: `location_repository.dart` \| DataSources: `auth_api_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request.locationHospital.location.lat` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.request.locationHospital.location.lng` : Screens/Widgets: `donor_register_form.dart`, `auth_view_model.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.request.qrToken` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.request.qrCreatedAt` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.request.qrExpiresAt` : Screens/Widgets: `appointment_model.dart`, `book_appointment_model.dart`
* `data.request.hospital` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `user_role.dart`
* `data.request.hospital.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.request.hospital.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.request.hospital.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.request.hospital.address` : Screens/Widgets: `add_admin_dialog.dart`, `add_hospital_dialog.dart` \| Models: `me_model.dart`, `sign_up_model.dart`
* `data.request.hospital.address.city` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request.hospital.address.governorate` : Screens/Widgets: `donor_register_form.dart`, `location_status_chip.dart` \| Models: `me_model.dart`, `sign_up_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request.hospital.latitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request.hospital.longitude` : Screens/Widgets: `donor_register_form.dart`, `build_location_card.dart` \| Models: `alert.dart`, `coordinates.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request.distanceKm` : Screens/Widgets: `location_step.dart`, `nearby_hospitals.dart`
* `data.request.distanceMeters` : Screens/Widgets: `nearby_hospitals.dart`, `requests_model.dart`
* `data.request.distance` : Screens/Widgets: `location_step.dart`, `hospital_card.dart` \| Repositories: `location_repository.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.donor` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_role.dart`
* `data.donor.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.donor.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.donor.phoneNumber` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `donor.dart`, `me_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donor.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.donation` : Screens/Widgets: `donation_history.dart`, `activities_model.dart`
* `data.donation._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donation.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donation.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.donation.quantity` : Screens/Widgets: `donation_history_model.dart`, `request_accept_model.dart`
* `data.donation.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`

---

### Endpoint

```http
POST /requests/:id/reject
```

### Flutter Screens / Files Using It

* **Called From:** Explore Requests

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request rejected successfully",
  "data": {
    "request": {
      "_id": "69fe540565ff7785a031314f",
      "status": "pending"
    },
    "donation": {
      "_id": "69fe540565ff7785a0313157",
      "status": "rejected"
    }
  }
}
```

### Verified Required Fields

* `data.request` : Screens/Widgets: `admin_auth_view_model.dart`, `admin_request.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.request.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.donation` : Screens/Widgets: `donation_history.dart`, `activities_model.dart`
* `data.donation._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.donation.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`

---

### Endpoint

```http
POST /requests/:id/cancel
```

### Flutter Screens / Files Using It

* **Called From:** Explore Requests

### Minimum Required Response

```json
{
  "success": true,
  "message": "Request cancelled successfully",
  "data": {
    "request": {
      "id": "69fe540565ff7785a031314f",
      "requestId": "69fe540565ff7785a031314f",
      "bloodType": "O+",
      "hospitalName": "Cairo Care Hospital",
      "contactNumber": "1044444444",
      "unitsNeeded": 3,
      "isEmergency": true,
      "createdAt": "2026-05-16T08:15:00.000Z",
      "status": "cancelled",
      "requestStatus": "cancelled",
      "urgency": "critical",
      "type": "blood",
      "requiredBy": "2026-05-20T00:00:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.request` : Screens/Widgets: `admin_auth_view_model.dart`, `admin_request.dart` \| Cubits/Blocs: `map_cubit.dart`
* `data.request.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.request.requestId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.request.bloodType` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `blood_request.dart`, `blood_request_history.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.request.hospitalName` : Screens/Widgets: `admin_request.dart`, `custom_request_card.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.request.contactNumber` : Screens/Widgets: `appointment_model.dart`, `nearby_hospitals.dart`
* `data.request.unitsNeeded` : Screens/Widgets: `alerts_dialog.dart`, `critical_alerts_card.dart` \| Models: `alert.dart`
* `data.request.isEmergency` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.request.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.request.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.request.requestStatus` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`
* `data.request.urgency` : Screens/Widgets: `donation_history_model.dart`, `requests_model.dart`
* `data.request.type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.request.requiredBy` : Screens/Widgets: `requests_model.dart`, `request_cancel_model.dart`

---

## Rewards Module

### Endpoint

```http
GET /rewards/points
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Points retrieved successfully",
  "data": {
    "pointsBalance": 2340,
    "lifetimePointsEarned": 3340,
    "currentTier": "silver",
    "nextTier": "gold",
    "pointsToNextTier": 160,
    "progressPercentage": 56,
    "tierBenefits": {
      "bronze": [
        "Access to basic rewards"
      ],
      "silver": [
        "10% more points per donation",
        "Early access to limited rewards"
      ],
      "gold": [
        "15% more points per donation",
        "Exclusive gold rewards"
      ],
      "platinum": [
        "20% more points per donation",
        "VIP support",
        "All exclusive rewards"
      ]
    }
  }
}
```

### Verified Required Fields

* `data.pointsBalance` : Screens/Widgets: `profile.dart`, `points_model.dart`
* `data.lifetimePointsEarned` : Screens/Widgets: `points_model.dart`
* `data.currentTier` : Screens/Widgets: `points_model.dart`, `rewards_screen.dart`
* `data.nextTier` : Screens/Widgets: `profile.dart`, `points_model.dart`
* `data.pointsToNextTier` : Screens/Widgets: `profile.dart`, `points_model.dart`
* `data.progressPercentage` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.tierBenefits` : Screens/Widgets: `points_model.dart`
* `data.tierBenefits.bronze` : Screens/Widgets: `donor_tile.dart`, `profile.dart`
* `data.tierBenefits.silver` : Screens/Widgets: `donor_tile.dart`, `profile.dart`
* `data.tierBenefits.gold` : Screens/Widgets: `home.dart`, `notifications.dart`
* `data.tierBenefits.platinum` : Screens/Widgets: `profile.dart`, `points_model.dart`

---

### Endpoint

```http
GET /rewards/earning-rules
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Reward earning rules retrieved successfully",
  "data": [
    {
      "type": "blood_donation",
      "title": "Blood Donation",
      "points": 200,
      "category": "donation"
    },
    {
      "type": "plasma_donation",
      "title": "Plasma Donation",
      "points": 150,
      "category": "donation"
    },
    {
      "type": "platelets_donation",
      "title": "Platelet Donation",
      "points": 175,
      "category": "donation"
    },
    {
      "type": "first_donation",
      "title": "First Donation Bonus",
      "points": 100,
      "category": "bonus"
    },
    {
      "type": "emergency_response",
      "title": "Emergency Response",
      "points": 100,
      "category": "bonus"
    },
    {
      "type": "profile_completion",
      "title": "Profile Completion",
      "points": 50,
      "category": "bonus"
    },
    {
      "type": "referral",
      "title": "Referral",
      "points": 150,
      "category": "bonus"
    }
  ]
}
```

### Verified Required Fields

* `data[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data[].title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data[].points` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `badge_data.dart`, `confirmation_data.dart`
* `data[].category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`

---

### Endpoint

```http
GET /rewards/dashboard
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Rewards dashboard retrieved",
  "data": {
    "points": 2340,
    "progressPercentage": 46,
    "rewards": [
      {
        "id": "664a...",
        "title": "Coffee Voucher",
        "isAvailable": true
      }
    ],
    "history": [
      {
        "id": "664b...",
        "type": "BLOOD_DONATION",
        "title": "Blood Donation - Successful",
        "points": 100,
        "createdAt": "2026-05-01T10:00:00Z"
      }
    ],
    "badges": {
      "total": 7,
      "completion": 28,
      "list": [
        {
          "id": "664c...",
          "title": "First Timer",
          "description": "Completed your first blood donation",
          "isUnlocked": true,
          "progress": 1,
          "target": 1
        }
      ]
    }
  }
}
```

### Verified Required Fields

* `data.points` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `badge_data.dart`, `confirmation_data.dart`
* `data.progressPercentage` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.rewards` : Screens/Widgets: `donor_main_layout.dart`, `profile.dart`
* `data.rewards[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.rewards[].title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.rewards[].isAvailable` : Screens/Widgets: `admin_auth_view_model.dart`, `auth_view_model.dart` \| Models: `me_model.dart`
* `data.history` : Screens/Widgets: `rewards_api_data_source.dart`, `rewards_tab.dart`
* `data.history[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.history[].type` : Screens/Widgets: `custom_drop_down_button_form_field.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `donation_details.dart`
* `data.history[].title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.history[].points` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `badge_data.dart`, `confirmation_data.dart`
* `data.history[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.badges` : Screens/Widgets: `profile.dart`, `achievement_badges_card.dart`
* `data.badges.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.badges.completion` : Screens/Widgets: `rewards_tab.dart`
* `data.badges.list` : Screens/Widgets: `skeleton_loaders.dart`, `date_time_step.dart`
* `data.badges.list[].id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.badges.list[].title` : Screens/Widgets: `custom_note_card.dart`, `custom_pin_verification_screen.dart` \| Models: `alert.dart`, `pin_verification_args.dart`
* `data.badges.list[].description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`
* `data.badges.list[].isUnlocked` : Screens/Widgets: `badges_tab.dart`, `custom_badge_card.dart`
* `data.badges.list[].progress` : Screens/Widgets: `points_card.dart`, `rewards_screen.dart`
* `data.badges.list[].target` : Context: `maps.dart`

---

### Endpoint

```http
GET /rewards/stats
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Rewards stats retrieved",
  "data": {
    "points": 2340
  }
}
```

### Verified Required Fields

* `data.points` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `badge_data.dart`, `confirmation_data.dart`

---

### Endpoint

```http
GET /rewards/points/history
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Points history retrieved successfully",
  "data": {
    "transactions": [
      {
        "_id": "66fc00000000000000000001",
        "pointsAmount": 200,
        "transactionType": "BLOOD_DONATION",
        "description": "Blood Donation - Successful",
        "balanceAfter": 2340,
        "createdAt": "2026-05-10T12:35:00.000Z"
      },
      {
        "_id": "66fc00000000000000000002",
        "pointsAmount": -500,
        "transactionType": "REWARD_REDEEMED",
        "description": "Reward Redeemed: Coffee Voucher",
        "balanceAfter": 1840,
        "createdAt": "2026-05-11T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

### Verified Required Fields

* `data.transactions` : Screens/Widgets: `points_history.dart`, `rewards_tab.dart`
* `data.transactions[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.transactions[].pointsAmount` : Screens/Widgets: `points_history.dart`, `rewards_tab.dart`
* `data.transactions[].transactionType` : Screens/Widgets: `points_history.dart`, `rewards_tab.dart`
* `data.transactions[].description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`
* `data.transactions[].balanceAfter` : Screens/Widgets: `points_history.dart`
* `data.transactions[].createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`

---

### Endpoint

```http
GET /rewards/badges
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Badges retrieved successfully",
  "data": {
    "unlockedCount": 2,
    "totalCount": 7,
    "completionPercentage": 29,
    "badges": [
      {
        "badgeId": "66fd00000000000000000001",
        "badgeName": "First Timer",
        "badgeDescription": "Completed your first blood donation",
        "badgeIcon": "heart",
        "category": "DONATION",
        "rarity": "COMMON",
        "unlockStatus": "UNLOCKED",
        "unlockedAt": "2026-03-05T10:00:00.000Z",
        "progressCurrent": 1,
        "progressTarget": 1,
        "progressPercentage": 100
      },
      {
        "badgeId": "66fd00000000000000000002",
        "badgeName": "Regular Donor",
        "badgeDescription": "Completed 5 blood donations",
        "badgeIcon": "trophy",
        "category": "DONATION",
        "rarity": "COMMON",
        "unlockStatus": "LOCKED",
        "unlockedAt": null,
        "progressCurrent": 3,
        "progressTarget": 5,
        "progressPercentage": 60
      }
    ],
    "stats": {
      "totalDonations": 3,
      "totalEmergencyResponses": 1,
      "daysAsDonor": 104
    }
  }
}
```

### Verified Required Fields

* `data.unlockedCount` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.totalCount` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.completionPercentage` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges` : Screens/Widgets: `profile.dart`, `achievement_badges_card.dart`
* `data.badges[].badgeId` : Screens/Widgets: `badges_model.dart`
* `data.badges[].badgeName` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].badgeDescription` : Screens/Widgets: `badges_model.dart`
* `data.badges[].badgeIcon` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.badges[].rarity` : Screens/Widgets: `badges_model.dart`
* `data.badges[].unlockStatus` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].unlockedAt` : Screens/Widgets: `badges_model.dart`
* `data.badges[].progressCurrent` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].progressTarget` : Screens/Widgets: `badges_tab.dart`, `badges_model.dart`
* `data.badges[].progressPercentage` : Screens/Widgets: `profile_model.dart`, `edit_profile_model.dart`
* `data.stats` : Screens/Widgets: `skeleton_loaders.dart`, `donation_stats_card.dart`
* `data.stats.totalDonations` : Screens/Widgets: `show_all_donors_dialog.dart`, `top_donors_card.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.stats.totalEmergencyResponses` : Screens/Widgets: `badges_model.dart`
* `data.stats.daysAsDonor` : Screens/Widgets: `badges_model.dart`

---

### Endpoint

```http
GET /rewards/catalog
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Rewards retrieved successfully",
  "data": {
    "rewards": [
      {
        "_id": "664a123456789abcdef12345",
        "name": "Coffee Voucher",
        "description": "Free coffee at partner cafes",
        "category": "FOOD",
        "pointsCost": 500,
        "iconType": "coffee",
        "colorCode": "#8B4513",
        "status": "ACTIVE",
        "dailyLimit": null,
        "monthlyLimit": null,
        "redemptionCount": 12,
        "available": true
      },
      {
        "_id": "664a123456789abcdef12346",
        "name": "Movie Tickets",
        "description": "2 movie tickets at major cinemas",
        "category": "ENTERTAINMENT",
        "pointsCost": 1000,
        "iconType": "movie",
        "colorCode": "#6A0DAD",
        "status": "ACTIVE",
        "dailyLimit": 5,
        "monthlyLimit": 50,
        "redemptionCount": 5,
        "available": true
      }
    ],
    "filterOptions": {
      "categories": [
        "FOOD",
        "ENTERTAINMENT",
        "HEALTH",
        "STATUS"
      ]
    }
  }
}
```

### Verified Required Fields

* `data.rewards` : Screens/Widgets: `donor_main_layout.dart`, `profile.dart`
* `data.rewards[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.rewards[].name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.rewards[].description` : Screens/Widgets: `ai_insights_card.dart`, `alerts_dialog.dart` \| Models: `alert.dart`, `onboarding_model.dart`
* `data.rewards[].category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.rewards[].pointsCost` : Screens/Widgets: `rewards_model.dart`, `rewards_view_model.dart`
* `data.rewards[].iconType` : Screens/Widgets: `rewards_model.dart`, `rewards_tab.dart`
* `data.rewards[].colorCode` : Screens/Widgets: `rewards_model.dart`, `rewards_tab.dart`
* `data.rewards[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.rewards[].dailyLimit` : Screens/Widgets: `rewards_model.dart`
* `data.rewards[].monthlyLimit` : Screens/Widgets: `rewards_model.dart`
* `data.rewards[].redemptionCount` : Screens/Widgets: `rewards_model.dart`
* `data.rewards[].available` : Screens/Widgets: `book_appointment_model.dart`, `hospital_actions.dart`
* `data.filterOptions` : Screens/Widgets: `rewards_model.dart`
* `data.filterOptions.categories` : Screens/Widgets: `rewards_model.dart`

---

### Endpoint

```http
GET /rewards/history
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Reward history retrieved successfully",
  "data": {
    "redemptions": [
      {
        "_id": "66f400000000000000000010",
        "donorId": "69f3df915f42685cbbbcbb18",
        "rewardId": {
          "_id": "66f400000000000000000101",
          "name": "Movie Tickets",
          "category": "ENTERTAINMENT",
          "iconType": "movie"
        },
        "pointsSpent": 1000,
        "confirmationCode": "RWD-2026-MOV123",
        "status": "DELIVERED",
        "expiresAt": "2026-06-20T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

### Verified Required Fields

* `data.redemptions[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.redemptions[].donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.redemptions[].rewardId` : Screens/Widgets: `rewards_api_data_source.dart`, `rewards_remote_data_source.dart`
* `data.redemptions[].rewardId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.redemptions[].rewardId.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.redemptions[].rewardId.category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.redemptions[].rewardId.iconType` : Screens/Widgets: `rewards_model.dart`, `rewards_tab.dart`
* `data.redemptions[].pointsSpent` : Screens/Widgets: `redeem_reward.dart`
* `data.redemptions[].confirmationCode` : Screens/Widgets: `redeem_reward.dart`
* `data.redemptions[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.redemptions[].expiresAt` : Screens/Widgets: `redeem_reward.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`

---

### Endpoint

```http
POST /rewards/catalog/:rewardId/redeem
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Reward redeemed successfully",
  "data": {
    "redemption": {
      "_id": "664b123456789abcdef12347",
      "rewardId": "664a123456789abcdef12345",
      "donorId": "69f3df915f42685cbbbcbb18",
      "pointsSpent": 300,
      "status": "confirmed",
      "confirmationCode": "CAFE-2026-051-12345",
      "createdAt": "2026-05-11T10:00:00Z",
      "expiresAt": "2026-05-18T10:00:00Z"
    }
  }
}
```

### Verified Required Fields

* `data.redemption._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.redemption.rewardId` : Screens/Widgets: `rewards_api_data_source.dart`, `rewards_remote_data_source.dart`
* `data.redemption.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.redemption.pointsSpent` : Screens/Widgets: `redeem_reward.dart`
* `data.redemption.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.redemption.confirmationCode` : Screens/Widgets: `redeem_reward.dart`
* `data.redemption.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`
* `data.redemption.expiresAt` : Screens/Widgets: `redeem_reward.dart`

---

### Endpoint

```http
GET /rewards/redemptions
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Redemptions retrieved successfully",
  "data": {
    "redemptions": [
      {
        "_id": "66f400000000000000000001",
        "donorId": "69f3df915f42685cbbbcbb18",
        "rewardId": {
          "_id": "66f400000000000000000101",
          "name": "Gift Card",
          "category": "voucher",
          "iconType": "gift"
        },
        "pointsSpent": 500,
        "confirmationCode": "RWD-2026-ABC123",
        "status": "CONFIRMED",
        "expiresAt": "2026-06-17T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

### Verified Required Fields

* `data.redemptions[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.redemptions[].donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.redemptions[].rewardId` : Screens/Widgets: `rewards_api_data_source.dart`, `rewards_remote_data_source.dart`
* `data.redemptions[].rewardId._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.redemptions[].rewardId.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.redemptions[].rewardId.category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.redemptions[].rewardId.iconType` : Screens/Widgets: `rewards_model.dart`, `rewards_tab.dart`
* `data.redemptions[].pointsSpent` : Screens/Widgets: `redeem_reward.dart`
* `data.redemptions[].confirmationCode` : Screens/Widgets: `redeem_reward.dart`
* `data.redemptions[].status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.redemptions[].expiresAt` : Screens/Widgets: `redeem_reward.dart`
* `data.pagination` : Screens/Widgets: `donation_history_model.dart`, `donation_history.dart`
* `data.pagination.total` : Screens/Widgets: `users.dart`, `appointment_model.dart`
* `data.pagination.page` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.limit` : Screens/Widgets: `appointment_model.dart`, `donation_history_api_data_source.dart`
* `data.pagination.totalPages` : Screens/Widgets: `appointment_model.dart`, `donation_history_model.dart`

---

### Endpoint

```http
GET /rewards/leaderboard
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Leaderboard retrieved successfully",
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "donorId": "69f3df915f42685cbbbcbb18",
        "fullName": "Aya Hassan",
        "tier": "gold",
        "lifetimePointsEarned": 2840,
        "pointsBalance": 2340
      },
      {
        "rank": 2,
        "donorId": "69f3df915f42685cbbbcbb19",
        "fullName": "Mina Adel",
        "tier": "silver",
        "lifetimePointsEarned": 1880,
        "pointsBalance": 1580
      }
    ]
  }
}
```

### Verified Required Fields

* `data.leaderboard[].rank` : Screens/Widgets: `donor_tile.dart`
* `data.leaderboard[].donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.leaderboard[].fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.leaderboard[].tier` : Screens/Widgets: `profile.dart`, `badges_tab.dart`
* `data.leaderboard[].lifetimePointsEarned` : Screens/Widgets: `points_model.dart`
* `data.leaderboard[].pointsBalance` : Screens/Widgets: `profile.dart`, `points_model.dart`

---

### Endpoint

```http
POST /rewards/admin/users/:userId/points/adjust
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Points adjusted successfully",
  "data": {
    "donorId": "69f3df915f42685cbbbcbb18",
    "pointsBalance": 2440,
    "lifetimePointsEarned": 2940,
    "tier": "gold"
  }
}
```

### Verified Required Fields

* `data.donorId` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart`
* `data.pointsBalance` : Screens/Widgets: `profile.dart`, `points_model.dart`
* `data.lifetimePointsEarned` : Screens/Widgets: `points_model.dart`
* `data.tier` : Screens/Widgets: `profile.dart`, `badges_tab.dart`

---

### Endpoint

```http
PATCH /rewards/admin/catalog/:rewardId/status
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Reward status updated",
  "data": {
    "_id": "69fe540565ff7785a0313165",
    "name": "Coffee Voucher",
    "category": "FOOD",
    "status": "ACTIVE",
    "pointsCost": 500,
    "redemptionCount": 34
  }
}
```

### Verified Required Fields

* `data._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.name` : Screens/Widgets: `donor_register_form.dart`, `show_all_donors_dialog.dart` \| Models: `donor.dart`, `user_model.dart`
* `data.category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.status` : Screens/Widgets: `system_health_check_dialog.dart`, `system_status_card.dart` \| Models: `badge_data.dart`, `blood_request_history.dart`
* `data.pointsCost` : Screens/Widgets: `rewards_model.dart`, `rewards_view_model.dart`
* `data.redemptionCount` : Screens/Widgets: `rewards_model.dart`

---

### Endpoint

```http
GET /rewards/admin/analytics
```

### Flutter Screens / Files Using It

* **Called From:** Rewards Catalog, Badges Screen

### Minimum Required Response

```json
{
  "success": true,
  "message": "Rewards analytics retrieved",
  "data": {
    "topRewards": [
      {
        "rewardName": "Coffee Voucher",
        "count": 34
      },
      {
        "rewardName": "Movie Tickets",
        "count": 18
      }
    ],
    "tierDistribution": [
      {
        "_id": "bronze",
        "count": 96
      },
      {
        "_id": "silver",
        "count": 74
      },
      {
        "_id": "gold",
        "count": 28
      }
    ]
  }
}
```

### Verified Required Fields

* `data.topRewards[].rewardName` : Screens/Widgets: `redeem_reward.dart`
* `data.topRewards[].count` : Screens/Widgets: `admin_request.dart`, `custom_stat_card.dart`
* `data.tierDistribution[]._id` : Screens/Widgets: `appointment_cancelled_model.dart`, `appointment_model.dart` \| Models: `admin_login_model.dart`, `login_model.dart`
* `data.tierDistribution[].count` : Screens/Widgets: `admin_request.dart`, `custom_stat_card.dart`

---

## Support Module

### Endpoint

```http
POST /support/contact
```

### Flutter Screens / Files Using It

* **Called From:** General flow

### Minimum Required Response

```json
{
  "success": true,
  "message": "Support request submitted successfully",
  "data": {
    "ticket": {
      "id": "670000000000000000000001",
      "fullName": "Aya Hassan",
      "email": "aya.hassan@lifelink.demo",
      "role": "donor",
      "subject": "Need help with reward redemption",
      "category": "REWARDS",
      "message": "I can see my points balance but I want to confirm when the Coffee Voucher becomes available.",
      "createdAt": "2026-05-24T16:24:00.000Z"
    }
  }
}
```

### Verified Required Fields

* `data.ticket` : Screens/Widgets: `contact_support_dialog.dart`
* `data.ticket.id` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `blood_request.dart`
* `data.ticket.fullName` : Screens/Widgets: `admin_auth_view_model.dart`, `donor_register_form.dart` \| Models: `admin_login_model.dart`, `login_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.ticket.email` : Screens/Widgets: `admin_authentication.dart`, `admin_auth_view_model.dart` \| Models: `donor.dart`, `user_model.dart` \| Repositories: `admin_auth_repositories.dart`, `admin_auth_repositories_imp.dart` \| DataSources: `admin_auth_api_data_source.dart`, `admin_auth_remote_data_source.dart`
* `data.ticket.role` : Screens/Widgets: `custom_pin_code.dart`, `custom_pin_verification_screen.dart` \| Models: `pin_verification_args.dart`, `user_model.dart` \| Repositories: `auth_repositories.dart`, `auth_repositories_imp.dart` \| DataSources: `auth_api_data_source.dart`, `auth_remote_data_source.dart`
* `data.ticket.subject` : Screens/Widgets: `user_detail_dialog.dart`, `get_help_section.dart`
* `data.ticket.category` : Screens/Widgets: `contact_support_dialog.dart`, `badges_model.dart`
* `data.ticket.createdAt` : Screens/Widgets: `critical_alerts_card.dart`, `show_all_donors_dialog.dart` \| Models: `alert.dart`, `donor.dart`

---

## Webhook Module

### Endpoint

```http
POST /api/webhooks/resend
```

### Flutter Screens / Files Using It

* **Called From:** General flow

### Minimum Required Response

```json
{
  "success": true,
  "data": {
    "received": true
  }
}
```

### Verified Required Fields

* `data.received` : Screens/Widgets: `recent_activity_card.dart`

---

## Minimum Contracts Summary

| Endpoint | Minimum Response Shape |
| -------- | ---------------------- |
| `GET /donor/activity` | `{ success, message, data: { ... } }` |
| `GET /donor/profile` | `{ success, message, data: { ... } }` |
| `PUT /donor/profile` | `{ success, message, data: { ... } }` |
| `GET /donor/stats` | `{ success, message, data: { ... } }` |
| `GET /donor/rewards` | `{ success, message, data: { ... } }` |
| `GET /donor/settings` | `{ success, message, data: { ... } }` |
| `PUT /donor/settings` | `{ success, message, data: { ... } }` |
| `GET /donor/requests` | `{ success, message, data: { ... } }` |
| `GET /donor/matches` | `{ success, message, data: { ... } }` |
| `POST /donor/respond/:requestId` | `{ success, message, data: { ... } }` |
| `GET /donor/donation-eligibility` | `{ success, message, data: { ... } }` |
| `GET /donor/dashboard` | `{ success, message, data: { ... } }` |
| `GET /donor/recent-activity` | `{ success, message, data: { ... } }` |
| `GET /donor/history` | `{ success, message, data: { ... } }` |
| `GET /donor/donations` | `{ success, message, data: { ... } }` |
| `GET /donor/points` | `{ success, message, data: { ... } }` |
| `GET /donor/badges` | `{ success, message, data: { ... } }` |
| `GET /donor/redemptions` | `{ success, message, data: { ... } }` |
| `GET /donor/notifications` | `{ success, message, data: { ... } }` |
| `PUT /donor/participation` | `{ success, message, data: { ... } }` |
| `PUT /donor/availability` | `{ success, message, data: { ... } }` |
| `GET /admin/profile` | `{ success, message, data: { ... } }` |
| `GET /admin/system/health` | `{ success, message, data: { ... } }` |
| `GET /admin/system/maintenance` | `{ success, message, data: { ... } }` |
| `GET /admin/statistics` | `{ success, message, data: { ... } }` |
| `GET /admin/dashboard` | `{ success, message, data: { ... } }` |
| `GET /admin/alerts` | `{ success, message, data: { ... } }` |
| `GET /admin/blood-inventory-summary` | `{ success, message, data: { ... } }` |
| `GET /admin/rewards/config` | `{ success, message, data: { ... } }` |
| `PUT /admin/rewards/config` | `{ success, message, data: { ... } }` |
| `GET /admin/badges` | `{ success, message, data: { ... } }` |
| `PATCH /admin/badges/:id` | `{ success, message, data: { ... } }` |
| `GET /admin/audit-logs` | `{ success, message, data: { ... } }` |
| `GET /admin/inbound-emails` | `{ success, message, data: { ... } }` |
| `GET /admin/inbound-emails/:id` | `{ success, message, data: { ... } }` |
| `PATCH /admin/inbound-emails/:id/read` | `{ success, message, data: { ... } }` |
| `PATCH /admin/inbound-emails/:id/archive` | `{ success, message, data: { ... } }` |
| `DELETE /admin/inbound-emails/:id` | `{ success, message, data: { ... } }` |
| `GET /admin/support` | `{ success, message, data: { ... } }` |
| `GET /admin/support/:id` | `{ success, message, data: { ... } }` |
| `PATCH /admin/support/:id/review` | `{ success, message, data: { ... } }` |
| `POST /admin/support/:id/reply` | `{ success, message, data: { ... } }` |
| `GET /admin/donors` | `{ success, message, data: { ... } }` |
| `GET /admin/hospitals` | `{ success, message, data: { ... } }` |
| `GET /admin/donors/:id` | `{ success, message, data: { ... } }` |
| `GET /admin/hospitals/:id` | `{ success, message, data: { ... } }` |
| `GET /admin/admins` | `{ success, message, data: { ... } }` |
| `GET /admin/admins/:id` | `{ success, message, data: { ... } }` |
| `PUT /admin/donors/:id` | `{ success, message, data: { ... } }` |
| `POST /admin/donors/:id/ban` | `{ success, message, data: { ... } }` |
| `POST /admin/donors/:id/unban` | `{ success, message, data: { ... } }` |
| `PUT /admin/hospitals/:id/status` | `{ success, message, data: { ... } }` |
| `POST /admin/admins` | `{ success, message, data: { ... } }` |
| `PUT /admin/admins/:id` | `{ success, message, data: { ... } }` |
| `GET /admin/permissions/roles` | `{ success, message, data: { ... } }` |
| `GET /admin/permissions/roles/:role` | `{ success, message, data: { ... } }` |
| `POST /admin/permissions/roles` | `{ success, message, data: { ... } }` |
| `PUT /admin/permissions/roles/:role` | `{ success, message, data: { ... } }` |
| `DELETE /admin/permissions/roles/:role` | `{ success, message, data: { ... } }` |
| `GET /admin/users` | `{ success, message, data: { ... } }` |
| `GET /admin/users/stats` | `{ success, message, data: { ... } }` |
| `POST /admin/users/hospital` | `{ success, message, data: { ... } }` |
| `GET /admin/users/:id` | `{ success, message, data: { ... } }` |
| `PATCH /admin/users/:id/verify` | `{ success, message, data: { ... } }` |
| `PATCH /admin/users/:id/unverify` | `{ success, message, data: { ... } }` |
| `PATCH /admin/users/:id/suspend` | `{ success, message, data: { ... } }` |
| `PATCH /admin/users/:id/unsuspend` | `{ success, message, data: { ... } }` |
| `GET /admin/requests` | `{ success, message, data: { ... } }` |
| `GET /admin/requests/stats` | `{ success, message, data: { ... } }` |
| `GET /admin/requests/:id` | `{ success, message, data: { ... } }` |
| `GET /admin/requests/:id/donations` | `{ success, message, data: { ... } }` |
| `PATCH /admin/requests/:id/fulfill` | `{ success, message, data: { ... } }` |
| `PATCH /admin/requests/:id/cancel` | `{ success, message, data: { ... } }` |
| `POST /admin/requests/:id/broadcast` | `{ success, message, data: { ... } }` |
| `GET /admin/analytics/donations` | `{ success, message, data: { ... } }` |
| `GET /admin/analytics/blood-types` | `{ success, message, data: { ... } }` |
| `GET /admin/analytics/top-donors` | `{ success, message, data: { ... } }` |
| `GET /admin/analytics/growth` | `{ success, message, data: { ... } }` |
| `POST /admin/emergency/broadcast` | `{ success, message, data: { ... } }` |
| `GET /admin/emergency/critical` | `{ success, message, data: { ... } }` |
| `GET /admin/emergency/shortage-alerts` | `{ success, message, data: { ... } }` |
| `GET /analytics/my-stats` | `{ success, message, data: { ... } }` |
| `GET /analytics/leaderboard` | `{ success, message, data: { ... } }` |
| `GET /analytics/donation-types` | `{ success, message, data: { ... } }` |
| `GET /analytics/dashboard` | `{ success, message, data: { ... } }` |
| `POST /donations/book-appointment` | `{ success, message, data: { ... } }` |
| `GET /donations/book-appointment/available-slots` | `{ success, message, data: { ... } }` |
| `GET /donations/book-appointment/my-appointments` | `{ success, message, data: { ... } }` |
| `GET /donations/book-appointment/:appointmentId` | `{ success, message, data: { ... } }` |
| `PATCH /donations/book-appointment/:appointmentId` | `{ success, message, data: { ... } }` |
| `DELETE /donations/book-appointment/:appointmentId` | `{ success, message, data: { ... } }` |
| `GET /donations/types` | `{ success, message, data: { ... } }` |
| `POST /donations/validate` | `{ success, message, data: { ... } }` |
| `POST /donations/complete` | `{ success, message, data: { ... } }` |
| `POST /appointments/verify-qr` | `{ success, message, data: { ... } }` |
| `GET /appointments/:appointmentId` | `{ success, message, data: { ... } }` |
| `PATCH /appointments/:appointmentId` | `{ success, message, data: { ... } }` |
| `POST /auth/signup` | `{ success, message, data: { ... } }` |
| `POST /auth/login` | `{ success, message, data: { ... } }` |
| `POST /auth/hospital/login` | `{ success, message, data: { ... } }` |
| `POST /auth/admin/login` | `{ success, message, data: { ... } }` |
| `POST /auth/refresh-token` | `{ success, message, data: { ... } }` |
| `POST /auth/verify-otp` | `{ success, message, data: { ... } }` |
| `GET /auth/me` | `{ success, message, data: { ... } }` |
| `POST /auth/validate-token` | `{ success, message, data: { ... } }` |
| `POST /auth/fcm-token` | `{ success, message, data: { ... } }` |
| `PUT /auth/fcm-token` | `{ success, message, data: { ... } }` |
| `DELETE /auth/fcm-token` | `{ success, message, data: { ... } }` |
| `GET /hospitals` | `{ success, message, data: { ... } }` |
| `GET /hospitals/nearby` | `{ success, message, data: { ... } }` |
| `GET /hospitals/search` | `{ success, message, data: { ... } }` |
| `GET /hospitals/map` | `{ success, message, data: { ... } }` |
| `GET /hospitals/:id` | `{ success, message, data: { ... } }` |
| `GET /hospital/find-donors` | `{ success, message, data: { ... } }` |
| `POST /hospital/donors/:donorId/appointments` | `{ success, message, data: { ... } }` |
| `GET /hospital/appointments` | `{ success, message, data: { ... } }` |
| `GET /hospital/appointments/:appointmentId` | `{ success, message, data: { ... } }` |
| `GET /hospital/profile` | `{ success, message, data: { ... } }` |
| `PUT /hospital/profile` | `{ success, message, data: { ... } }` |
| `GET /hospital/appointment-settings` | `{ success, message, data: { ... } }` |
| `PUT /hospital/appointment-settings` | `{ success, message, data: { ... } }` |
| `POST /hospital/request` | `{ success, message, data: { ... } }` |
| `POST /hospital/requests/create-emergency` | `{ success, message, data: { ... } }` |
| `GET /hospital/dashboard` | `{ success, message, data: { ... } }` |
| `GET /hospital/history` | `{ success, message, data: { ... } }` |
| `POST /hospital/requests/:requestId/close` | `{ success, message, data: { ... } }` |
| `GET /hospital/requests` | `{ success, message, data: { ... } }` |
| `GET /hospital/requests/:requestId` | `{ success, message, data: { ... } }` |
| `PUT /hospital/requests/:requestId` | `{ success, message, data: { ... } }` |
| `GET /hospital/donations` | `{ success, message, data: { ... } }` |
| `GET /hospital/notifications` | `{ success, message, data: { ... } }` |
| `PATCH /hospital/notifications/:id/read` | `{ success, message, data: { ... } }` |
| `PUT /hospital/notifications/:id/read` | `{ success, message, data: { ... } }` |
| `GET /hospital/notifications/:id` | `{ success, message, data: { ... } }` |
| `GET /hospital/blood-bank-settings` | `{ success, message, data: { ... } }` |
| `PUT /hospital/blood-bank-settings` | `{ success, message, data: { ... } }` |
| `GET /hospital/notification-preferences` | `{ success, message, data: { ... } }` |
| `PUT /hospital/notification-preferences` | `{ success, message, data: { ... } }` |
| `GET /hospital/reports/monthly` | `{ success, message, data: { ... } }` |
| `GET /help/faq` | `{ success, message, data: { ... } }` |
| `GET /help/documents/:type` | `{ success, message, data: { ... } }` |
| `GET /notifications` | `{ success, message, data: { ... } }` |
| `PATCH /notifications/:id/read` | `{ success, message, data: { ... } }` |
| `PATCH /notifications/read-all` | `{ success, message, data: { ... } }` |
| `GET /notifications/:id` | `{ success, message, data: { ... } }` |
| `GET /requests/nearby` | `{ success, message, data: { ... } }` |
| `GET /requests/:id/google-maps` | `{ success, message, data: { ... } }` |
| `GET /requests/:id` | `{ success, message, data: { ... } }` |
| `POST /requests/:id/generate-qr` | `{ success, message, data: { ... } }` |
| `POST /requests/verify-qr` | `{ success, message, data: { ... } }` |
| `POST /requests/:id/accept` | `{ success, message, data: { ... } }` |
| `POST /requests/:id/reject` | `{ success, message, data: { ... } }` |
| `POST /requests/:id/cancel` | `{ success, message, data: { ... } }` |
| `GET /rewards/points` | `{ success, message, data: { ... } }` |
| `GET /rewards/earning-rules` | `{ success, message, data: { ... } }` |
| `GET /rewards/dashboard` | `{ success, message, data: { ... } }` |
| `GET /rewards/stats` | `{ success, message, data: { ... } }` |
| `GET /rewards/points/history` | `{ success, message, data: { ... } }` |
| `GET /rewards/badges` | `{ success, message, data: { ... } }` |
| `GET /rewards/catalog` | `{ success, message, data: { ... } }` |
| `GET /rewards/history` | `{ success, message, data: { ... } }` |
| `POST /rewards/catalog/:rewardId/redeem` | `{ success, message, data: { ... } }` |
| `GET /rewards/redemptions` | `{ success, message, data: { ... } }` |
| `GET /rewards/leaderboard` | `{ success, message, data: { ... } }` |
| `POST /rewards/admin/users/:userId/points/adjust` | `{ success, message, data: { ... } }` |
| `PATCH /rewards/admin/catalog/:rewardId/status` | `{ success, message, data: { ... } }` |
| `GET /rewards/admin/analytics` | `{ success, message, data: { ... } }` |
| `POST /support/contact` | `{ success, message, data: { ... } }` |
| `POST /api/webhooks/resend` | `{ success, message, data: { ... } }` |
