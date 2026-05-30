# Book Appointment API - Testing Guide for Flutter

## Overview
The appointment booking system has been completely audited and fixed. This guide documents the corrected behavior for Flutter client testing.

## Base URL
- **Local**: `http://localhost:5000`
- **Production**: `https://graduation-project-cy61.onrender.com`

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <your-jwt-token>
```

---

## 🔧 Fixed Issues

### 1. **Cancellation Logic (CRITICAL FIX)**
**Before**: Users couldn't cancel appointments more than 12 hours away  
**After**: Users can cancel anytime, but must do so **at least 12 hours BEFORE the appointment**

**Example**:
- Appointment: Monday May 12, 10:00 AM
- Last cancellation allowed: Sunday May 11, 10:00 AM
- After Sunday 10:00 AM → cancellation rejected

### 2. **Duplicate Prevention (CRITICAL FIX)**
**Before**: Two concurrent requests could create duplicate appointments  
**After**: Atomic duplicate prevention with unique compound index

**Behavior**: Donor can only have ONE active appointment per hospital at a time

### 3. **Race Condition Handling**
- Concurrent booking attempts are now handled safely
- The first request succeeds, subsequent requests get: `"You already have an active appointment at this hospital"`

---

## 📚 API Endpoints

### 1. Book Appointment
**POST** `/donations/book-appointment`

**Request**:
```json
{
  "hospitalId": "69f3df915f42685cbbbcbb1b",
  "appointmentDate": "2026-06-05T10:00:00Z",
  "donationType": "Whole Blood",
  "notes": "Morning preference",
  "requestId": null
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "Appointment booked",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "donorId": {...},
    "donorDetails": {...},
    "hospitalId": {...},
    "appointmentDate": "2026-06-05T10:00:00Z",
    "status": "pending",
    "qrToken": "8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f...",
    "donationType": "Whole Blood"
  }
}
```

**Error Responses**:
- `400` - Invalid data or validation failed
- `401` - Missing/invalid JWT
- `403` - Not a donor role
- `404` - Hospital/donor/request not found
- `409` - Active appointment already exists (DUPLICATE PREVENTION)

**Important Notes**:
- Appointment date must be in the future
- Only one active appointment per hospital per donor
- Hospital must be verified and active
- Donation type validation includes donor eligibility check

---

### 2. Get Available Slots
**GET** `/donations/book-appointment/available-slots?hospitalId=XXX&date=2026-06-05`

**Response (200)**:
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
      }
    ],
    "hospitalId": "69f3df915f42685cbbbcbb1b",
    "date": "2026-06-05T00:00:00Z",
    "openingTime": "08:00",
    "closingTime": "19:00"
  }
}
```

---

### 3. Get My Appointments
**GET** `/donations/book-appointment/my-appointments?page=1&limit=10`

**Response (200)**:
```json
{
  "success": true,
  "message": "Appointments fetched",
  "data": {
    "appointments": [...],
    "total": 5,
    "meta": {
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

### 4. Get Appointment Details
**GET** `/donations/book-appointment/{appointmentId}`

**Response (200)**:
```json
{
  "success": true,
  "message": "Appointment retrieved",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "donorId": {...},
    "hospitalId": {...},
    "appointmentDate": "2026-06-05T10:00:00Z",
    "status": "pending",
    "donationType": "Whole Blood",
    "qrToken": "...",
    "qrExpiresAt": "2026-06-06T10:00:00Z"
  }
}
```

---

### 5. Reschedule Appointment
**PATCH** `/donations/book-appointment/{appointmentId}`

**Request**:
```json
{
  "appointmentDate": "2026-06-10T14:00:00Z",
  "donationType": "Plasma",
  "notes": "Need different time due to work schedule"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Appointment rescheduled",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "appointmentDate": "2026-06-10T14:00:00Z",
    "donationType": "Plasma",
    "status": "pending",
    "rescheduleCount": 1,
    "rescheduleHistory": [
      {
        "previousAppointmentDate": "2026-06-05T10:00:00Z",
        "newAppointmentDate": "2026-06-10T14:00:00Z",
        "previousDonationType": "Whole Blood",
        "newDonationType": "Plasma",
        "reason": "Need different time due to work schedule",
        "rescheduledAt": "2026-05-30T11:16:08Z"
      }
    ]
  }
}
```

**Limits**:
- Max 3 reschedules per appointment
- Reschedule must be at least 24 hours in advance
- Cannot reschedule completed/cancelled appointments

---

### 6. Cancel Appointment ⚠️ **FIXED**
**DELETE** `/donations/book-appointment/{appointmentId}`

**Requirements**:
- ✅ Appointment must be "pending" or "confirmed"
- ✅ **Must cancel at least 12 hours BEFORE the appointment**
- ❌ Cannot cancel if within 12 hours
- ❌ Cannot cancel if already completed/cancelled

**Response (200)**:
```json
{
  "success": true,
  "message": "Appointment cancelled",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "status": "cancelled",
    "cancelledAt": "2026-05-30T11:16:08Z"
  }
}
```

**Error Example (400)**:
```json
{
  "success": false,
  "message": "Cancellation must be at least 12 hours in advance"
}
```

---

## 🧪 Testing Scenarios

### Scenario 1: Book and Cancel Successfully
```
1. Book appointment for 2026-06-15 10:00 AM
2. Cancel the same day (more than 12h before) ✅ SUCCESS

Timeline:
- Book: 2026-06-05
- Cancel: 2026-06-14 (24h before appointment) ✅
- Cancel: 2026-06-15 09:30 AM (30min before) ❌ FAILS
```

### Scenario 2: Duplicate Prevention
```
1. Request A: Book appointment for 2026-06-10 10:00 AM ✅ CREATED
2. Request B: Book appointment for 2026-06-12 14:00 AM ❌ FAILS
   Error: "You already have an active appointment at this hospital"
3. Request C: Cancel Request A ✅ CANCELLED
4. Request D: Book appointment for 2026-06-12 14:00 AM ✅ CREATED
```

### Scenario 3: Different Hospitals
```
1. Book at Hospital A for 2026-06-10 ✅ CREATED
2. Book at Hospital B for 2026-06-10 ✅ CREATED (different hospital)
3. Try book at Hospital A again ❌ FAILS (duplicate at same hospital)
```

### Scenario 4: Donation Type Validation
```
Valid types:
- "Whole Blood"
- "Plasma"
- "Platelets"
- "Double Red Cells"

Invalid type "Triple Red" → 400 error
```

---

## 🐛 Common Issues & Solutions

### Issue: "Cancellation must be at least 12 hours in advance"
**Solution**: Check appointment date. You can only cancel if current time + 12 hours < appointment time

### Issue: "You already have an active appointment at this hospital"
**Solution**: 
- Cancel the existing appointment first, OR
- Book at a different hospital, OR
- Wait for the appointment to be completed/cancelled

### Issue: "Hospital is not verified"
**Solution**: Only verified hospitals can accept appointments. Contact hospital admin.

### Issue: Concurrent Duplicate Booking
**Solution**: The system now prevents this automatically. One request succeeds, others get 409 Conflict.

---

## 📋 Hospital Settings
Each hospital can configure:
- **Operating hours**: Opening/closing times
- **Working days**: Which days accept appointments
- **Slots per hour**: How many appointments per hour
- **Advance booking**: Min/max days in advance
- **Cancellation window**: Hours required before cancellation deadline
- **Supported donation types**: Which types they accept

---

## 🔗 OpenAPI/Swagger Documentation
Access interactive documentation at:
- Local: `http://localhost:5000/api-docs`
- Production: `https://graduation-project-cy61.onrender.com/api-docs`

---

## ✅ What's Fixed

| Issue | Status | Details |
|-------|--------|---------|
| Cancellation logic | ✅ FIXED | 12-hour advance notice now works correctly |
| Duplicate bookings | ✅ FIXED | Unique compound index prevents concurrent duplicates |
| Race conditions | ✅ FIXED | E11000 error handling for atomicity |
| Validation order | ✅ FIXED | Duplicate check moved before expensive operations |
| Error messages | ✅ IMPROVED | Clearer feedback on what went wrong |
| Test coverage | ✅ ENHANCED | 6 new tests for edge cases (58 total tests passing) |

---

## 📞 Support

If you encounter issues:
1. Check this guide first
2. Verify JWT token is valid
3. Ensure donor role in JWT
4. Check hospital is verified
5. Review error message details
6. Contact backend team with error trace

---

**Generated**: May 30, 2026  
**API Version**: 1.0  
**Last Updated**: Appointment System Audit & Fix
