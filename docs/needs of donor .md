

---

# 🚀 SYSTEM OVERVIEW

Backend must support:

* Dashboard (optimized single response)     >>> this in exist in home tab of donor 
* Urgent Requests (separate service)   >>> this in exist in home tab of donor
* Activity System >>> this in exist in home tab of donor
* Rewards System
* Badges System
* Profile Management
* Settings & Security
* Donation History
* QR Donation Confirmation
* Notifications

Additionally, the backend must handle **user actions from the frontend**, such as:

* Accepting an urgent request (donation intent)
* Declining or marking request as unavailable

All APIs must follow:

* Clean Architecture
* JWT Authentication
* Pagination support
* Optimized payloads
* No UI logic

---

# 🏠 1. DASHBOARD API (LIGHTWEIGHT)

### GET /dashboard   for donor 

Authorization: Bearer Token

### Response:

#### User Info:

* firstName
* bloodType
* donationStatus (eligible | notEligible | pending)

#### Stats:

* totalDonations
* points
* livesSaved

#### Recent Activity (LIMIT 5 ONLY):

* id
* type
* title
* subTitle
* points
* createdAt

---

### ⚠️ IMPORTANT:

* DO NOT include urgent requests here
* Keep response lightweight for performance

---

# 🚨 2. URGENT REQUESTS API (SEPARATE MODULE)

### GET /urgent-requests?limit=5&page=1

### Response:

* id
* title
* bloodType
* unitsNeeded
* hospitalName
* distance (calculated server-side using geo-location)
* isEmergency
* patientType
* contactNumber
* createdAt
* location { lat, lng }

---

### ✅ USER ACTIONS (IMPORTANT)

These endpoints are triggered when the user presses buttons like **Accept** or **Decline** in the frontend:

### POST /urgent-requests//accept

* Marks that the user is willing to donate
* Creates activity record
* May trigger notification to hospital
- Mark that the current user (donor) accepted the request
- Prevent duplicate acceptance
- Create an activity log (type: "ACCEPT_REQUEST")
- Optionally decrease "unitsNeeded"
- If unitsNeeded reaches 0 → mark request as closed
- Send notification to hospital/admin
- Store donor response with timestamp

### POST /urgent-requests//decline

* Marks request as not available for this user
* Prevents showing it again (optional logic)
 Mark that user declined the request
- Prevent showing this request again to the same user
- Store decline in a separate collection or field
- Create activity log (type: "DECLINE_REQUEST")

---

### Rules:

* Sorted by nearest OR latest emergency
* Supports pagination
* Used in multiple screens (home, map, notifications)
* Accept/Decline actions must be handled in backend logic

---

# 📊 3. ACTIVITY SYSTEM

### GET /activity?page=1&limit=10

Return:

* id
* type (donation | reward | profile_update | emergency_response | referral)
* title
* subTitle
* points
* createdAt

Rules:

* Sorted DESC
* Default: last 5 for dashboard
* Accepting urgent request should create activity of type `emergency_response`

---


4 Scheduling Donation  >> this exist in donor role in donate tab



---

# 📊 Core Features

1. Fetch nearby hospitals using user location
2. Retrieve available time slots dynamically
3. Support multiple donation types
4. Validate user eligibility before booking
5. Create appointment
6. Return confirmation + QR code
7. Allow cancel/reschedule

---

# 🧩 API DESIGN

## 1. 📍 Get Nearby Hospitals

### GET /hospitals/nearby?lat={lat}&lng={lng}

### Response:

[
{
"id": "h1",
"name": "City Blood Bank",
"distance": 2.5,
"address": "Nasr City",
"location": { "lat": 30.1, "lng": 31.3 }
}
]

### Notes:

* Distance must be calculated server-side
* Use MongoDB geospatial indexing (2dsphere)
* Sort by nearest

---

## 2. ⏰ Get Available Time Slots

### GET /appointments/available-slots?hospitalId={id}&date=YYYY-MM-DD

### Response:

{
"timeSlots": ["09:00 AM", "10:00 AM", "01:00 PM"]
}

### Logic:

* Exclude already booked slots
* Each hospital has capacity per slot

---

## 3. 🩸 Get Donation Types

### GET /donation/types

### Response:

["Whole Blood", "Platelets", "Plasma"]

---

## 4. ⚠️ Validate Donation Eligibility

### POST /donations/validate

### Body:

{
"userId": "u123",
"hospitalId": "h1",
"date": "2026-05-10"
}

### Response:

{
"canDonate": true,
"reason": null
}

### Validation Rules:

* Minimum gap between donations (e.g. 56 days)
* User health status (if available)
* No duplicate bookings same day

---

## 5. ✅ Create Appointment (CRITICAL)

### POST /appointments

### Body:

{
"hospitalId": "h1",
"date": "2026-05-10",
"time": "10:00 AM",
"donationType": "Whole Blood",
"user": {
"firstName": "Ziyad",
"lastName": "Sobhy",
"phone": "01000000000",
"email": "[ziyada@gmail.com](mailto:ziyada@gmail.com)"
}
}

### Response:

{
"appointmentId": "a123",
"status": "confirmed",
"qrCode": "BASE64_ENCODED",
"message": "Appointment confirmed successfully"
}

### Important:

* Must be transactional (avoid double booking)
* Lock slot before confirm
* Generate QR code for hospital check-in

---

## 6. 📄 Get Appointment Details

### GET /appointments/{id}

### Response:

{
"id": "a123",
"hospitalName": "City Blood Bank",
"date": "2026-05-10",
"time": "10:00 AM",
"status": "confirmed"
}

---

## 7. ❌ Cancel Appointment

### DELETE /appointments/{id}

---

## 8. 🔄 Reschedule Appointment

### PATCH /appointments/{id}

### Body:

{
"date": "2026-05-12",
"time": "12:00 PM"
}

---

# 🧱 DATABASE DESIGN

## Collection: hospitals

{
"_id": "h1",
"name": "City Blood Bank",
"location": {
"type": "Point",
"coordinates": [lng, lat]
}
}

## Collection: appointments

{
"_id": "a123",
"userId": "u123",
"hospitalId": "h1",
"date": "2026-05-10",
"time": "10:00 AM",
"donationType": "Whole Blood",
"status": "confirmed",
"createdAt": "timestamp"
}

---  

* Send notification before appointment (24h)
* Email confirmation
* Admin dashboard for hospital capacity
* QR scan endpoint for check-in



# 🏥 Find Hospital Module — Backend API Design

## 🎯 Objective

Build a **scalable backend API** for the "Find Hospital" screen in a Blood Donation Mobile App.

The module allows users to:

* Search hospitals by name
* Filter by blood type availability
* Sort by distance
* View nearby hospitals on a map
* Retrieve hospital details

The system must be optimized for **geo-based queries and fast filtering**.

---

 4. FIND HOSPITALS        >>> in find hospital tab in donor role

## 📍 1. Get Nearby Hospitals (Main Endpoint)  >> this end point exit see if need any thing to add to details

### GET /hospitals/nearby

### Query Parameters:

* lat (required)
* lng (required)
* search (optional → hospital name search)
* bloodType (optional → filter hospitals that support blood type)
* sort (optional → "distance", default = distance ASC)
* page (optional)
* limit (optional)

---

### Example Request:

GET /hospitals/nearby?lat=30.04&lng=31.23&search=city&bloodType=O+

---

### Response:

[
{
"id": "h1",
"hospitalName": "City General Hospital",
"hospitalType": "Government Hospital",
"phoneNumber": "+201551764651",
"bloodTypes": ["O+", "A+"],
"distanceKm": 1.2,
"isAvailable": true,
"urgentNeedsCount": 2,
"location": {
"lat": 30.04,
"lng": 31.23
}
}
]

---

### Business Logic:

* Filter by:

  * hospital name (case-insensitive search)
  * blood type availability
* Sort by:

  * distance (default ASC)
* Use MongoDB geospatial index (2dsphere)
* Calculate distance server-side only
* Return only nearby hospitals within radius (default 10km)

---

# 🧠 2. SEARCH HOSPITALS (Optional Optimized Endpoint)

### GET /hospitals/search

### Query:

* q (hospital name)
* bloodType
* availableOnly=true/false

### Purpose:

Fast search for autocomplete / search bar

---

# 🩸 3. FILTER BY BLOOD TYPE (Core Logic Inside Nearby API)

### Logic:

Hospital must contain:

```json
bloodTypes: ["O+", "A-"]
```

Filter condition:

* return hospital only if bloodTypes includes requested type

---

# 🗺️ 4. MAP DATA (Map Screen Support)

### GET /hospitals/map

### Response:

[
{
"id": "h1",
"lat": 30.04,
"lng": 31.23,
"name": "City General Hospital"
}
]

---

# 📄 5. GET HOSPITAL DETAILS

### GET /hospitals/{id}

### Response:

{
"id": "h1",
"hospitalName": "City General Hospital",
"hospitalType": "Government Hospital",
"phoneNumber": "+201551764651",
"workingHours": "9AM - 5PM",
"isAvailable": true,
"supportedBloodTypes": ["O+", "A+"],
"location": {
"lat": 30.04,
"lng": 31.23
}
}

---

# ⚡ PERFORMANCE REQUIREMENTS

* Use MongoDB 2dsphere index for location queries
* Cache nearby hospitals results (Redis recommended)
* Pagination required (limit + page)
* Use projection (return only needed fields)
* Optimize search using text index on hospitalName

---

# 🔐 SECURITY

* All endpoints require JWT authentication
* Validate all query parameters
* Prevent injection in search fields
* Rate limit search endpoint

---

# 📊 DATABASE STRUCTURE

## hospitals collection:

{
"_id": "h1",
"hospitalName": "City General Hospital",
"hospitalType": "Government Hospital",
"phoneNumber": "+201551764651",
"bloodTypes": ["O+", "A+", "AB-"],
"isAvailable": true,
"urgentNeedsCount": 2,
"location": {
"type": "Point",
"coordinates": [lng, lat]
}
}

---

We are building the Rewards & Achievements module for a Blood Donation Mobile Application.

We need a clean, scalable API design that supports:

* Rewards listing
* Redeeming rewards
* User points tracking
* Points history
* Badges system

---

# 🔴 BASE

Authorization: Bearer Token

---

# 1️⃣ GET /rewards/dashboard

### Purpose:

Return everything needed for Rewards Screen in ONE request

### Response:

{
"points": 2340,
"nextRewardPoints": 500,
"pointsToNextReward": 160,

"rewards": [
{
"id": "reward_1",
"title": "Coffee Voucher",
"pointsRequired": 500,
"isAvailable": true
},
{
"id": "reward_2",
"title": "Movie Tickets",
"pointsRequired": 1000,
"isAvailable": true
},
{
"id": "reward_3",
"title": "Restaurant Gift Card",
"pointsRequired": 1500,
"isAvailable": false
}
],

"history": [
{
"id": "h1",
"type": "donation",
"title": "Blood Donation",
"points": 200,
"createdAt": "2026-05-01T10:00:00Z"
},
{
"id": "h2",
"type": "emergency",
"title": "Emergency Response",
"points": 100,
"createdAt": "2026-04-28T12:00:00Z"
}
],

"badges": {
"unlocked": 3,
"total": 6,
"completion": 50,

```
"list": [
  {
    "id": "b1",
    "title": "First Donation",
    "description": "Completed first donation",
    "isUnlocked": true
  },
  {
    "id": "b2",
    "title": "Regular Donor",
    "description": "Donated 5 times",
    "isUnlocked": true
  },
  {
    "id": "b3",
    "title": "Hero",
    "description": "Donate 20 times",
    "isUnlocked": false,
    "progress": 12,
    "target": 20
  }
]
```

}
}

---

# 2️⃣ POST /rewards/redeem

### Body:

{
"rewardId": "reward_1"
}

### Response:

{
"success": true,
"remainingPoints": 1840,
"message": "Reward redeemed successfully"
}

---

# 3️⃣ GET /rewards/history

### Query:

?page=1&limit=10

### Response:

[
{
"id": "h1",
"type": "donation",
"title": "Blood Donation",
"points": 200,
"createdAt": "2026-05-01T10:00:00Z"
}
]

---

# 4️⃣ GET /badges

### Response:

[
{
"id": "b1",
"title": "First Donation",
"description": "Completed first donation",
"isUnlocked": true
},
{
"id": "b2",
"title": "Hero",
"description": "Donate 20 times",
"isUnlocked": false,
"progress": 10,
"target": 20
}
]

---

# ⚙️ RULES

* Points must be calculated from backend (NOT frontend)
* Redeem must validate points before success
* All lists sorted by latest first
* Keep response optimized for mobile (small payload)
* Do NOT include UI fields (colors/icons handled by Flutter)

---

#  (Important)

* When redeem happens:
  → Deduct points
  → Add history record
  → Return updated points

* Badge unlocking should be automatic based on:
  → total donations
  → emergency responses
  → user actions

---

5-🏆 Rewards >>>>>>>>>>>>> in donor role

## 🎯 Objective

Build a **scalable gamification backend system** for a Blood Donation App.

The system manages:

* User points system
* Rewards redemption (gift cards, services, etc.)
* Donation history points
* Badges/achievements system
* Points history tracking


---


# 🧩 1. USER POINTS SYSTEM

## 📊 Get User Points

### GET /rewards/points

### Response:

{
"userId": "u1",
"points": 2340
}

---

## ➕ Add Points (Internal System Only)

### POST /rewards/points/add

### Body:

{
"userId": "u1",
"points": 200,
"reason": "blood_donation"
}

### Rules:

* Triggered after successful donation
* Must log transaction

---

## ➖ Deduct Points (Redeem)

### POST /rewards/points/redeem

### Body:

{
"userId": "u1",
"rewardId": "r1"
}

### Logic:

* Check if user has enough points
* Deduct points atomically
* Create redemption record
* Return success confirmation

---

# 🎁 2. REWARDS SYSTEM

## 📦 Get Available Rewards

### GET /rewards

### Response:

[
{
"id": "r1",
"title": "Coffee Voucher",
"icon": "coffee",
"cost": 500,
"category": "food",
"isAvailable": true
},
{
"id": "r2",
"title": "Movie Tickets",
"cost": 1000,
"isAvailable": true
}
]

---

## 🎯 Reward Rules:

* Rewards have fixed point cost
* Some rewards may be "coming soon"
* Some rewards may be locked by level

---

## ✅ Redeem Reward

### POST /rewards/redeem

### Body:

{
"rewardId": "r1"
}

### Response:

{
"success": true,
"remainingPoints": 1840,
"message": "Redeemed successfully"
}

---

# 📜 3. POINTS HISTORY

## GET /rewards/history

### Response:

[
{
"title": "Blood Donation",
"points": +200,
"date": "2026-05-01"
},
{
"title": "Emergency Response",
"points": +100,
"date": "2026-04-20"
}
]

---

# 🏅 4. BADGES SYSTEM

## GET /badges

### Response:

[
{
"id": "b1",
"title": "First Timer",
"requiredDonations": 1,
"isUnlocked": true
},
{
"id": "b2",
"title": "Hero",
"requiredDonations": 20,
"isUnlocked": false
}
]

---

## 🧠 Badge Logic:

* Based on number of donations
* Or emergency responses
* Auto-unlocked via event triggers

---

# 📊 5. USER STATS (Rewards Screen Header)

### GET /rewards/stats

### Response:

{
"points": 2340,
"nextReward": {
"pointsToGo": 160
},
"badgesUnlocked": 3,
"totalBadges": 6,
"completionPercent": 50
}

---

# 🧱 DATABASE DESIGN

## users

{
"_id": "u1",
"points": 2340
}

---

## rewards

{
"_id": "r1",
"title": "Coffee Voucher",
"cost": 500,
"icon": "coffee",
"isActive": true
}

---

## transactions (points history)

{
"_id": "t1",
"userId": "u1",
"title": "Blood Donation",
"points": 200,
"type": "earn",
"createdAt": "timestamp"
}

---

## badges

{
"_id": "b1",
"title": "First Timer",
"requiredDonations": 1
}

---

## user_badges

{
"userId": "u1",
"badgeId": "b1",
"unlockedAt": "timestamp"
}

---

# ⚡ BUSINESS LOGIC

## 🔥 Points Rules:

* Blood donation → +200 points
* Emergency response → +100 points
* Profile completion → +50 points
* Referral → +150 points

---

## 🔐 Safety Rules:

* Prevent double redemption
* Atomic point updates
* Transaction logging required

---

# 📡 REAL-TIME SUPPORT (IMPORTANT)

Backend should support:

* Instant points update after donation
* WebSocket or Firebase optional
* Push notification after redemption

---


---

# 🔥  FEATURES

* Level system (Bronze / Silver / Gold)
* Streak system (donate every X months)
* Leaderboard (top donors)
* Seasonal rewards

---

# ✅ EXPECTED OUTPUT

Backend must be:

* Transaction-safe
* Scalable gamification system
* Real-time ready
* Clean architecture
* Fully compatible with Flutter ValueNotifier + Bloc

---

# profile >>> donor tab 

We are building a **production-ready backend system** for a **Blood Donation Mobile App (Flutter + Bloc + Clean Architecture)**.

This request is focused on the **Donor Experience Module**, which powers the full profile screen, rewards system, QR donation flow, settings, and donation history.

The backend must be **scalable, modular, secure, and optimized for mobile usage**.

---

* JWT Authentication (Bearer Token)
* Role-Based Access Control (Donor / Admin)
* Clean modular structure:

```
/auth
/donor
/donations
/rewards
/settings
/notifications
```

* Use Redis caching for profile + stats
* Pagination for all list endpoints
* All sensitive actions must be validated server-side

---

# 👤 1. DONOR PROFILE MODULE

## GET /donor/profile

Return full donor profile:

* name
* email
* phone
* bloodType
* location
* gender
* age
* weight
* verification status

### Stats:

* totalDonations
* points
* livesSaved

### Badge Progress:

* currentBadge
* nextBadge
* progressPercentage

---

## PUT /donor/profile

Allow updating only:

* name
* phone
* location
* age
* weight
* gender

❗ Email & bloodType are read-only

---

# 📊 2. DONOR DASHBOARD STATS

## GET /donor/stats

### Response:

* totalDonations
* points
* livesSaved
* rank (optional global ranking)

👉 Used in Home header + Profile stats row

---

# 🏆 3. REWARDS & BADGES SYSTEM

## GET /donor/rewards

### Response:

* currentPoints
* earnedBadges list
* lockedBadges list
* nextMilestone

### Business Logic:

* Points are earned per donation
* Badges unlock automatically
* Badge tiers:

  * Bronze (1200)
  * Silver (3000)
  * Gold (5000)
  * Diamond (8000+)

---

# 📜 4. DONATION HISTORY

## GET /donor/donations

Query params:

* page
* limit

### Response:

Each record:

* donationType (Blood / Plasma / etc)
* hospitalName
* date
* status (completed / pending / rejected)
* pointsEarned

---

We already implemented the Hospital QR Scanner screen in Flutter using:

* mobile_scanner
* Clean Architecture
* Bloc

Frontend flow is completed.

We now need backend support for the **Hospital Donation QR Verification System**.

---

# 🏥 Hospital QR Scanner Flow

Hospital staff opens scanner screen.

The scanner reads donor QR code and sends token to backend for verification.

Frontend currently sends:

```json id="6q1bjp"
{
  "qrToken": "SECURE_QR_TOKEN"
}
```

using:

## POST /appointments/verify-qr

---

# ✅ Backend Verification Responsibilities

Backend must:

* Validate JWT token
* Ensure authenticated user is a hospital/admin
* Validate QR token existence
* Check QR expiration
* Ensure appointment exists
* Ensure appointment status is:

  * upcoming
  * confirmed
* Prevent reused QR tokens
* Ensure donor has not already donated
* Validate appointment date/time
* Mark appointment as completed
* Mark QR token as consumed
* Create donation history record
* Update donor statistics
* Trigger rewards/badges
* Send notifications

---

# 📦 Expected Success Response

```json id="q8dx6t"
{
  "success": true,
  "message": "Donation verified successfully",

  "donation": {
    "donationId": "DON_123",
    "type": "Whole Blood",
    "date": "2026-05-07T12:00:00Z",
    "location": "City Hospital",
    "status": "confirmed"
  },

  "pointsEarned": 50
}
```

---

# ❌ Error Handling

Backend must return proper errors for:

## Expired QR

```json id="g4wdv8"
{
  "success": false,
  "message": "QR code expired"
}
```

---

## Invalid QR

```json id="icvjj0"
{
  "success": false,
  "message": "Invalid QR code"
}
```

---

## Already Used QR

```json id="fy8mbh"
{
  "success": false,
  "message": "QR code already used"
}
```

---

## Appointment Cancelled

```json id="c4m7b5"
{
  "success": false,
  "message": "Appointment is cancelled"
}
```

---

# 🩸 Donation History Record

After successful verification create donation record:

```json id="k3om4u"
{
  "donationId": "DON_123",
  "donorId": "DONOR_ID",
  "hospitalId": "HOSPITAL_ID",
  "appointmentId": "APT_123",
  "donationType": "Whole Blood",
  "pointsEarned": 50,
  "verifiedAt": "2026-05-07T12:00:00Z"
}
```

---

# 🎖 Rewards & Gamification

After successful donation:

* Increase donor points
* Update badges
* Update streaks
* Update total donations
* Trigger achievements

---

# 🔔 Notifications

Use Firebase Cloud Messaging (FCM).

Send notifications when:

* Donation verified successfully
* Reward earned
* Badge unlocked
* Donation added to history

---

# 🛡 Security Requirements

QR system must support:

* One-time QR usage
* QR expiration
* Secure token generation
* Anti-replay protection
* Rate limiting
* Hospital-only verification access

---

# ⚡ Frontend Already Implemented

Frontend already supports:

* QR Scanner
* Flash toggle
* Scan animation
* Success dialog
* Donation confirmation dialog
* Donation details display

Backend now only needs to implement APIs and business logic.

# ⚙️ 6. SETTINGS MODULE

## GET /donor/settings

## PUT /donor/settings

Fields:

* pushNotifications (boolean)
* emergencyAlerts (boolean)
* privacyMode (boolean)
* language

---

# 🔔 7. NOTIFICATIONS SYSTEM

## GET /notifications

Include:

* donation confirmations
* urgent requests
* reward achievements

---

# 📦 8. OPTIMIZED ENDPOINT (IMPORTANT)

## GET /donor/dashboard

Return everything in ONE request:

* profile
* stats
* rewards summary
* recent donations (latest 5)

👉 This is for mobile performance optimization

---

# 🔐 SECURITY REQUIREMENTS

* JWT required on all endpoints
* Rate limit QR scan endpoint
* Prevent double donation logging
* Validate donor identity before reward assignment
* Log all donation events (audit trail)

---

# ⚡ PERFORMANCE REQUIREMENTS

* Use Mongo aggregation for stats & badges
* Cache profile + dashboard response (Redis)
* Index:

  * donorId
  * donationDate
  * points

---

# 🎯 FINAL GOAL

Backend must fully support the Flutter UI:

* Profile screen
* Points card & progress bar
* Achievement badges carousel
* Donation history list
* Settings toggles
* QR scanner flow
* Edit profile dialog
* Donation confirmation popup

---

