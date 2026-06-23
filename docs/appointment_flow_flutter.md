# Appointment Flow — Flutter Integration Reference

> **Source of truth**: [`openapi.yaml`](file:///Users/mohamedyaser/Documents/LifeLink/openapi.yaml) + [`backend_future_flutter_expected_responses.md`](file:///Users/mohamedyaser/Documents/LifeLink/backend_future_flutter_expected_responses.md)
>
> Base URL (staging): `https://graduation-project-cy61.onrender.com`

---

## Overview: Two Distinct Appointment Flows

```
FLOW A — Donor books their own appointment
Donor App  ──POST /donations/book-appointment──►  Backend
           ◄── 201 { qrToken, appointmentDate, status: "pending" } ──

FLOW B — Hospital books an appointment for a donor they found
Hospital App  ──POST /hospital/donors/:donorId/appointments──►  Backend
              ◄── 201 { appointmentId, status: "pending" } ──
```

---

## Appointment Status State Machine

```
pending ──► confirmed ──► completed
   │              │
   └──────────────┴──► cancelled  (terminal)
```

| Status | Triggered by |
|--------|-------------|
| `pending` | Appointment created (either flow) |
| `confirmed` | Hospital scans QR code (`POST /appointments/verify-qr`) |
| `completed` | Hospital completes donation (`POST /donations/complete`) |
| `cancelled` | Donor cancels (`DELETE /donations/book-appointment/:id`) |

### Verification Status (sub-state on confirmed appointments)

```
pending ──► verified ──► completed
   └──────────────────► rejected  (hospital can rescan after)
```

---

## Auth Roles Per Endpoint

| Endpoint | Required Role |
|----------|--------------|
| `POST /donations/book-appointment` | `donor` |
| `GET /donations/book-appointment/available-slots` | `donor` |
| `GET /donations/book-appointment/my-appointments` | `donor` |
| `GET /donations/book-appointment/:id` | `donor` |
| `PATCH /donations/book-appointment/:id` | `donor` |
| `DELETE /donations/book-appointment/:id` | `donor` |
| `POST /hospital/donors/:donorId/appointments` | `hospital` |
| `GET /hospital/appointments` | `hospital` |
| `GET /hospital/appointments/:id` | `hospital` |
| `POST /appointments/verify-qr` | `hospital`, `admin`, `superadmin` |
| `POST /appointments/:id/reject` | `hospital`, `admin`, `superadmin` |
| `POST /appointments/:id/rescan` | `hospital`, `admin`, `superadmin` |
| `POST /donations/complete` | `hospital`, `admin`, `superadmin` |

All endpoints require `Authorization: Bearer <accessToken>` header.

---

---

# FLOW A — Donor-Initiated Appointment Booking

## 1. Get Available Slots

**`GET /donations/book-appointment/available-slots`**

Check which time slots are open at a hospital before booking.

### Query Parameters

| Param | Required | Description |
|-------|----------|-------------|
| `hospitalId` | ✅ | Hospital ObjectId |
| `date` | ✅ | Date in `YYYY-MM-DD` format |
| `excludeAppointmentId` | ❌ | Exclude an existing appointment from capacity check (use during reschedule) |

### Response `200`

```json
{
  "success": true,
  "message": "Available slots retrieved successfully",
  "data": {
    "date": "2026-05-12T00:00:00.000Z",
    "hospitalId": "69f3df915f42685cbbbcbb1b",
    "slotsPerHour": 5,
    "remainingCapacity": 8,
    "maxCapacity": 40,
    "timeSlots": [
      {
        "time": "09:00 AM",
        "remainingCapacity": 5,
        "maxCapacity": 5,
        "available": true
      },
      {
        "time": "10:00 AM",
        "remainingCapacity": 3,
        "maxCapacity": 5,
        "available": true
      },
      {
        "time": "02:00 PM",
        "remainingCapacity": 0,
        "maxCapacity": 5,
        "available": false
      }
    ]
  }
}
```

> **Note:** `available: false` means the slot is full — do not allow the donor to pick it.

---

## 2. Book an Appointment

**`POST /donations/book-appointment`**

### Request Body

```json
{
  "hospitalId": "69f3df915f42685cbbbcbb1b",
  "appointmentDate": "2026-05-12T10:00:00.000Z",
  "donationType": "Whole Blood",
  "notes": "Available in the morning.",
  "requestId": null
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `hospitalId` | ✅ | ObjectId of the target hospital |
| `appointmentDate` | ✅ | Full ISO datetime **with time component** (`T10:00` required). Alternatively send `date` + `time` as separate fields |
| `date` | ❌ | Alternative: `YYYY-MM-DD` |
| `time` | ❌ | Alternative: `HH:MM` or `HH:MM AM/PM` |
| `donationType` | ❌ | `"Whole Blood"` (default), `"Plasma"`, `"Platelets"`, `"Double Red Cells"` |
| `notes` | ❌ | Max 500 chars |
| `requestId` | ❌ | Link to a specific hospital request; omit for walk-in appointment |

### Response `201`

```json
{
  "success": true,
  "message": "Appointment booked",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "appointmentDate": "2026-05-12T10:00:00.000Z",
    "status": "pending",
    "qrToken": "8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d",
    "qrExpiresAt": "2026-05-13T10:00:00.000Z",
    "notes": "Available in the morning.",
    "donationType": "Whole Blood",
    "requestId": null,
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
    }
  }
}
```

> **Important:** The donor should store the `qrToken` — they will show this QR code to the hospital on arrival. The `qrExpiresAt` is 24 hours after `appointmentDate`.

### Error Responses

| Status | Meaning |
|--------|---------|
| `400` | Missing `hospitalId`/`appointmentDate`, invalid date, slot outside hours, slot full, daily capacity hit |
| `401` | Missing/invalid JWT |
| `403` | Donor has an active donation in-progress |
| `404` | Hospital / donor / request not found |
| `409` | Donor already has an active appointment at this hospital |

---

## 3. Get My Appointments

**`GET /donations/book-appointment/my-appointments`**

### Query Parameters

| Param | Default |
|-------|---------|
| `page` | `1` |
| `limit` | `10` |

### Response `200`

```json
{
  "success": true,
  "message": "Appointments fetched",
  "data": {
    "appointments": [
      {
        "_id": "69fe540565ff7785a031315c",
        "appointmentId": "69fe540565ff7785a031315c",
        "appointmentDate": "2026-05-12T10:00:00.000Z",
        "appointmentTime": "10:00 AM",
        "status": "pending",
        "donationType": "Whole Blood",
        "hospitalId": {
          "_id": "69f3df915f42685cbbbcbb1b",
          "hospitalName": "Cairo Care Hospital",
          "address": {
            "city": "Cairo",
            "governorate": "Cairo",
            "district": "Garden City"
          },
          "location": {
            "city": "Cairo",
            "governorate": "Cairo",
            "coordinates": { "lat": 30.0511, "lng": 31.2435 }
          },
          "contactNumber": "1044444444"
        },
        "hospital": {
          "hospitalId": "69f3df915f42685cbbbcbb1b",
          "id": "69f3df915f42685cbbbcbb1b",
          "name": "Cairo Care Hospital",
          "hospitalName": "Cairo Care Hospital"
        },
        "requestId": "69fe540565ff7785a031314f",
        "notes": "Donation follow-up appointment",
        "qrToken": "8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d",
        "qrExpiresAt": "2026-05-13T10:00:00.000Z",
        "qrScannedAt": null,
        "cancelledAt": null,
        "donorId": "69f3df915f42685cbbbcbb18",
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
          "donationType": "Whole Blood",
          "appointmentDate": "2026-05-12T10:00:00.000Z",
          "appointmentTime": "10:00 AM",
          "status": "pending",
          "hospitalId": "69f3df915f42685cbbbcbb1b",
          "hospitalName": "Cairo Care Hospital"
        },
        "verificationChecklist": {
          "idVerified": false,
          "questionnaireCompleted": false,
          "consentSigned": false,
          "completedAt": null
        },
        "rescheduleHistory": [],
        "createdAt": "2026-05-08T09:00:00.000Z",
        "updatedAt": "2026-05-08T09:00:00.000Z"
      }
    ],
    "total": 1,
    "meta": {
      "total": 1,
      "page": 1,
      "currentPage": 1,
      "limit": 10,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

---

## 4. Get Appointment Details

**`GET /donations/book-appointment/:appointmentId`**

Same shape as a single item from `my-appointments`, plus full donor and hospital details.

### Response `200`

```json
{
  "success": true,
  "message": "Appointment retrieved",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "appointmentId": "69fe540565ff7785a031315c",
    "appointmentDate": "2026-05-12T10:00:00.000Z",
    "appointmentTime": "10:00 AM",
    "status": "pending",
    "donationType": "Whole Blood",
    "hospitalId": {
      "_id": "69f3df915f42685cbbbcbb1b",
      "hospitalName": "Cairo Care Hospital",
      "address": { "city": "Cairo", "governorate": "Cairo" }
    },
    "hospital": {
      "hospitalId": "69f3df915f42685cbbbcbb1b",
      "id": "69f3df915f42685cbbbcbb1b",
      "name": "Cairo Care Hospital",
      "hospitalName": "Cairo Care Hospital"
    },
    "appointment": {
      "appointmentId": "69fe540565ff7785a031315c",
      "donationType": "Whole Blood",
      "appointmentDate": "2026-05-12T10:00:00.000Z",
      "appointmentTime": "10:00 AM",
      "status": "pending",
      "hospitalId": "69f3df915f42685cbbbcbb1b",
      "hospitalName": "Cairo Care Hospital"
    },
    "requestId": "69fe540565ff7785a031314f",
    "notes": "Donation follow-up appointment",
    "qrToken": "8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d",
    "qrExpiresAt": "2026-05-13T10:00:00.000Z",
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
    "verificationChecklist": {
      "idVerified": false,
      "questionnaireCompleted": false,
      "consentSigned": false,
      "completedAt": null
    },
    "rescheduleHistory": [],
    "createdAt": "2026-05-08T09:00:00.000Z",
    "updatedAt": "2026-05-08T09:00:00.000Z"
  }
}
```

---

## 5. Reschedule an Appointment

**`PATCH /donations/book-appointment/:appointmentId`**

> Also accessible at `PATCH /appointments/:appointmentId` (same handler).

### Request Body

```json
{
  "appointmentDate": "2026-05-15",
  "appointmentTime": "02:00 PM",
  "donationType": "Plasma",
  "notes": "Travel conflict"
}
```

**Alternative field names (all equivalent):**

| Preferred | Legacy Alias | Notes |
|-----------|-------------|-------|
| `appointmentDate` | `date` | Date portion |
| `appointmentTime` / `time` | — | Time portion when date is date-only |
| `notes` | `reason` | Reschedule reason |

### Response `200`

```json
{
  "success": true,
  "message": "Appointment rescheduled",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "appointmentId": "69fe540565ff7785a031315c",
    "appointmentDate": "2026-05-15",
    "appointmentTime": "02:00 PM",
    "status": "pending",
    "donationType": "Plasma",
    "rescheduleHistory": [
      {
        "previousAppointmentDate": "2026-05-12T10:00:00.000Z",
        "newAppointmentDate": "2026-05-15T14:00:00.000Z",
        "previousDonationType": "Whole Blood",
        "newDonationType": "Plasma",
        "reason": "Travel conflict",
        "rescheduledAt": "2026-05-09T08:00:00.000Z"
      }
    ],
    "hospital": {
      "hospitalId": "69f3df915f42685cbbbcbb1b",
      "id": "69f3df915f42685cbbbcbb1b",
      "name": "Cairo Care Hospital",
      "hospitalName": "Cairo Care Hospital"
    },
    "hospitalId": { "_id": "69f3df915f42685cbbbcbb1b" }
  }
}
```

### Business Rules

- Max **3 reschedules** per appointment (configurable by hospital)
- New date must be **≥ minAdvanceHours** (default 24h) in the future
- New date must be **≤ 30 days** in the future
- Selected slot must be available and within hospital's operating hours
- Appointment must be in `pending` or `confirmed` status

---

## 6. Cancel an Appointment

**`DELETE /donations/book-appointment/:appointmentId`**

### Response `200`

```json
{
  "success": true,
  "message": "Appointment cancelled",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "donorId": "69f3df915f42685cbbbcbb18",
    "hospitalId": "69f3df915f42685cbbbcbb1b",
    "requestId": null,
    "appointmentDate": "2026-05-12T10:00:00.000Z",
    "status": "cancelled",
    "cancelledAt": "2026-05-09T10:30:00.000Z",
    "notes": "Test appointment",
    "qrToken": "8f3a4f2f6a6d4f3a...",
    "donationType": "Whole Blood"
  }
}
```

### Business Rules

- Cancellation must be made **at least 12 hours before** the appointment time (configurable by hospital)
- Only `pending` or `confirmed` appointments can be cancelled
- Cancelling also cancels the linked donation and reverts the linked request to `pending`

---

---

# FLOW B — Hospital-Initiated Booking

## 7. Book Appointment for a Donor (Hospital Flow)

**`POST /hospital/donors/:donorId/appointments`**

Used after the hospital contacts a donor from the "Find Donors" search screen and agrees on a time.

### Path Parameter

| Param | Description |
|-------|-------------|
| `donorId` | ObjectId from the `GET /hospital/find-donors` response |

### Request Body

```json
{
  "appointmentDate": "2026-05-30T10:00:00.000Z",
  "notes": "Confirmed after phone call",
  "donationType": "Whole Blood",
  "requestId": "69fe540565ff7785a031314f"
}
```

### Response `201`

```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f50",
    "appointmentId": "60d5ec49f0322c2c20e28f50",
    "appointmentDate": "2026-06-15T10:00:00.000Z",
    "appointmentTime": "10:00 AM",
    "status": "pending",
    "notes": "Fast for 4 hours before the appointment.",
    "donorDetails": {
      "donorId": "60d5ec49f0322c2c20e28f36",
      "id": "60d5ec49f0322c2c20e28f36",
      "_id": "60d5ec49f0322c2c20e28f36",
      "firstName": "Ziad",
      "lastName": "Abdelghany",
      "fullName": "Ziad Abdelghany",
      "phoneNumber": "01234567890",
      "bloodType": "A+",
      "email": "ziad@example.com",
      "gender": "male",
      "dateOfBirth": "1995-04-15T00:00:00.000Z"
    },
    "donorId": { "_id": "60d5ec49f0322c2c20e28f36" },
    "donationType": "Whole Blood",
    "hospitalId": { "_id": "60d5ec49f0322c2c20e28f3a" },
    "donor": {
      "donorId": "60d5ec49f0322c2c20e28f36",
      "firstName": "Ziad",
      "lastName": "Abdelghany",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "phoneNumber": "01234567890",
      "bloodType": "A+",
      "gender": "male",
      "dateOfBirth": "1995-04-15T00:00:00.000Z"
    },
    "appointment": {
      "appointmentId": "60d5ec49f0322c2c20e28f50",
      "donationType": "Whole Blood",
      "appointmentDate": "2026-06-15T10:00:00.000Z",
      "appointmentTime": "10:00 AM",
      "status": "pending",
      "hospitalId": "HOSP123",
      "hospitalName": "Al-Amal Hospital"
    },
    "hospital": {
      "hospitalId": "HOSP123",
      "id": "60d5ec49f0322c2c20e28f3a",
      "name": "Al-Amal Hospital",
      "hospitalName": "Al-Amal Hospital"
    },
    "hospitalDetails": {
      "hospitalId": "60d5ec49f0322c2c20e28f3a",
      "id": "60d5ec49f0322c2c20e28f3a",
      "name": "Al-Amal Hospital",
      "hospitalName": "Al-Amal Hospital",
      "fullName": "Al-Amal Hospital",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo",
        "street": "123 Nile Street"
      },
      "contactNumber": "+20123456789"
    },
    "requestDetails": {
      "requestId": "60d5ec49f0322c2c20e28f39",
      "id": "60d5ec49f0322c2c20e28f39",
      "urgencyLevel": "critical",
      "urgency": "critical",
      "unitsNeeded": 3,
      "notes": "Accident patient emergency.",
      "type": "blood",
      "bloodType": ["A+"],
      "organType": null
    },
    "qrToken": "qr_token_string",
    "qrExpiresAt": "2026-06-15T11:00:00.000Z",
    "verificationStatus": "pending",
    "verificationChecklist": {
      "idVerified": false,
      "questionnaireCompleted": false,
      "consentSigned": false,
      "completedAt": null
    },
    "rescheduleCount": 0,
    "rescheduleHistory": [],
    "createdAt": "2026-06-07T00:56:18.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

## 8. List Hospital's Appointments

**`GET /hospital/appointments`**

### Query Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `page` | `1` | |
| `limit` | `20` | |
| `status` | — | Filter: `pending`, `confirmed`, `completed`, `cancelled` |

### Response `200`

```json
{
  "success": true,
  "message": "Appointments retrieved successfully",
  "data": {
    "appointments": [
      {
        "_id": "60d5ec49f0322c2c20e28f50",
        "appointmentId": "60d5ec49f0322c2c20e28f50",
        "appointmentDate": "2026-06-15T10:00:00.000Z",
        "appointmentTime": "10:00 AM",
        "status": "pending",
        "notes": "Fast for 4 hours before the appointment.",
        "donorDetails": {
          "donorId": "60d5ec49f0322c2c20e28f36",
          "firstName": "Ziad",
          "lastName": "Abdelghany",
          "fullName": "Ziad Abdelghany",
          "phoneNumber": "01234567890",
          "bloodType": "A+",
          "email": "ziad@example.com",
          "gender": "male",
          "dateOfBirth": "1995-04-15T00:00:00.000Z"
        },
        "donationType": "Whole Blood",
        "donor": {
          "donorId": "60d5ec49f0322c2c20e28f36",
          "firstName": "Ziad",
          "lastName": "Abdelghany",
          "fullName": "Ziad Abdelghany",
          "bloodType": "A+"
        },
        "qrToken": "qr_token_string",
        "qrExpiresAt": "2026-06-15T11:00:00.000Z",
        "verificationStatus": "pending",
        "verificationChecklist": {
          "idVerified": false,
          "questionnaireCompleted": false,
          "consentSigned": false,
          "completedAt": null
        },
        "rescheduleCount": 0,
        "createdAt": "2026-06-07T00:56:18.000Z",
        "updatedAt": "2026-06-07T00:56:18.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

---

## 9. Get Appointment Details (Hospital)

**`GET /hospital/appointments/:appointmentId`**

```json
{
  "success": true,
  "message": "Appointment retrieved successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f50",
    "appointmentId": "60d5ec49f0322c2c20e28f50",
    "appointmentDate": "2026-06-15T10:00:00.000Z",
    "appointmentTime": "10:00 AM",
    "status": "pending",
    "notes": "Fast for 4 hours before the appointment.",
    "donorDetails": {
      "donorId": "60d5ec49f0322c2c20e28f36",
      "id": "60d5ec49f0322c2c20e28f36",
      "_id": "60d5ec49f0322c2c20e28f36",
      "firstName": "Ziad",
      "lastName": "Abdelghany",
      "fullName": "Ziad Abdelghany",
      "phoneNumber": "01234567890",
      "bloodType": "A+",
      "email": "ziad@example.com",
      "gender": "male",
      "dateOfBirth": "1995-04-15T00:00:00.000Z"
    },
    "donor": {
      "donorId": "60d5ec49f0322c2c20e28f36",
      "firstName": "Ziad",
      "lastName": "Abdelghany",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "phoneNumber": "01234567890",
      "bloodType": "A+",
      "gender": "male",
      "dateOfBirth": "1995-04-15T00:00:00.000Z"
    },
    "donationType": "Whole Blood",
    "requestDetails": {
      "requestId": "60d5ec49f0322c2c20e28f39",
      "urgencyLevel": "critical",
      "urgency": "critical",
      "unitsNeeded": 3,
      "type": "blood",
      "bloodType": ["A+"],
      "organType": null
    },
    "qrToken": "qr_token_string",
    "qrExpiresAt": "2026-06-15T11:00:00.000Z",
    "verificationStatus": "pending",
    "verificationChecklist": {
      "idVerified": false,
      "questionnaireCompleted": false,
      "consentSigned": false,
      "completedAt": null
    },
    "rescheduleCount": 0,
    "rescheduleHistory": [],
    "createdAt": "2026-06-07T00:56:18.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

---

# FLOW C — Hospital Check-in & Verification (On Donor Arrival)

## 10. Scan Donor QR Code

**`POST /appointments/verify-qr`**

Hospital scans the donor's QR code. Two modes:
- **Scan only** — starts verification, hospital sees donor info
- **Scan + arrive** — confirms arrival immediately with checklist

### Request Body (scan only)

```json
{
  "qrToken": "8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d"
}
```

### Request Body (scan + confirm arrival in one step)

```json
{
  "qrToken": "8f3a4f2f6a6d4f3a...",
  "checklist": {
    "idVerified": true,
    "questionnaireCompleted": true,
    "consentSigned": true
  }
}
```

### Response `200` — Scan only (awaiting checklist)

```json
{
  "success": true,
  "message": "Donation verification started successfully",
  "data": {
    "readyForDonation": false,
    "verificationStatus": "pending",
    "verificationSessionId": "2a9d4f6f5f4e4f2e8e2f5a2d1e0c9b8a",
    "appointment": {
      "id": "69fe540565ff7785a031315c",
      "appointmentDate": "2026-05-07T12:00:00.000Z",
      "status": "confirmed",
      "donationType": "Whole Blood",
      "qrToken": "8f3a4f2f6a6d4f3a...",
      "qrScannedAt": "2026-05-07T09:00:00.000Z",
      "qrExpiresAt": "2026-05-08T09:00:00.000Z",
      "requestId": "60d5ec49f0322c2c20e28f39",
      "hospital": {
        "id": "60d5ec49f0322c2c20e28f3a",
        "fullName": "Al-Amal Hospital",
        "hospitalName": "Al-Amal Hospital",
        "contactNumber": "+20123456789",
        "location": {
          "city": "Cairo",
          "governorate": "Cairo",
          "coordinates": { "lat": 30.0444, "lng": 31.2357 }
        }
      }
    },
    "donor": {
      "id": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "initials": "ZA",
      "bloodType": "A+",
      "phoneNumber": "01234567890",
      "email": "ziad@example.com",
      "location": { "lat": 30.0444, "lng": 31.2357 },
      "lastDonationDate": "2026-04-10T12:00:00.000Z",
      "hemoglobinLevel": 14.5,
      "weight": 75,
      "participation": true
    },
    "eligibility": {
      "eligible": true,
      "reason": "Donor is eligible",
      "nextEligibleDate": null
    },
    "checklistRequirements": {
      "idVerified": false,
      "questionnaireCompleted": false,
      "consentSigned": false
    }
  }
}
```

### Response `200` — Arrival confirmed in one step

```json
{
  "success": true,
  "message": "Arrival confirmed successfully",
  "data": {
    "readyForDonation": true,
    "verificationStatus": "verified",
    "verificationSessionId": "ae892dfd6a89c2f6d89e",
    "appointment": { "...same shape as above, status: confirmed..." },
    "donor": { "...same shape as above..." },
    "eligibility": {
      "eligible": true,
      "reason": "Checklist completed",
      "nextEligibleDate": null
    },
    "checklistRequirements": {
      "idVerified": true,
      "questionnaireCompleted": true,
      "consentSigned": true
    },
    "checklist": {
      "idVerified": true,
      "questionnaireCompleted": true,
      "consentSigned": true,
      "completedAt": "2026-06-07T00:56:18.000Z"
    },
    "donationDetails": {
      "appointmentId": "60d5ec49f0322c2c20e28f50",
      "donationType": "Whole Blood",
      "scheduledDate": "2026-06-15T10:00:00.000Z",
      "lastDonationDate": "2026-04-10T12:00:00.000Z",
      "bloodType": "A+"
    }
  }
}
```

### Error Responses

| Status | Meaning |
|--------|---------|
| `400` | `qrToken` required / QR expired / Appointment not active |
| `401` | Missing/invalid JWT |
| `403` | Donor not eligible to donate |
| `404` | QR token not found |
| `409` | QR already used |

---

## 11. Reject Verification

**`POST /appointments/:appointmentId/reject`**

Hospital stops the verification flow (e.g. donor failed health check).

### Request Body

```json
{
  "reason": "Donor has low hemoglobin level."
}
```

### Response `200`

```json
{
  "success": true,
  "message": "Verification rejected successfully",
  "data": {
    "appointmentId": "60d5ec49f0322c2c20e28f50",
    "verificationStatus": "rejected",
    "rejectedAt": "2026-06-07T00:56:18.000Z",
    "reason": "Donor has low hemoglobin level.",
    "requestStatus": "pending",
    "donationStatus": "rejected"
  }
}
```

---

## 12. Reset / Rescan

**`POST /appointments/:appointmentId/rescan`**

Clears the verification session so the hospital can scan again (e.g. wrong donor).

### Response `200`

```json
{
  "success": true,
  "message": "Verification reset successfully",
  "data": {
    "appointmentId": "60d5ec49f0322c2c20e28f50",
    "verificationStatus": "pending"
  }
}
```

---

## 13. Complete the Donation

**`POST /donations/complete`**

Called after successful QR verification and checklist. Awards points to the donor.

### Request Body

```json
{
  "appointmentId": "69fe540565ff7785a031315c",
  "hemoglobinLevel": 14.8,
  "weight": 72,
  "unitsCollected": 1,
  "notes": "Donation completed successfully."
}
```

### Response `200`

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
      "status": "completed",
      "completedDate": "2026-05-11T10:00:00.000Z"
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

### Error Responses

| Status | Meaning |
|--------|---------|
| `400` | Invalid payload or validation failure |
| `404` | Appointment / donation / donor not found |
| `409` | Donation already confirmed for this appointment |

---

---

# Hospital Appointment Settings

Hospitals can configure their scheduling rules. Flutter uses these to build the booking UI.

## Get Settings

**`GET /hospital/appointment-settings`**

```json
{
  "success": true,
  "message": "Appointment settings retrieved successfully",
  "data": {
    "openingTime": "09:00",
    "closingTime": "19:00",
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "defaultSlotsPerHour": 4,
    "hourlySlots": {
      "09:00": 4, "10:00": 4, "11:00": 4, "12:00": 4,
      "13:00": 4, "14:00": 4, "15:00": 4, "16:00": 4,
      "17:00": 4, "18:00": 4
    },
    "totalDailyCapacity": 40,
    "isActive": true,
    "supportedDonationTypes": ["Whole Blood", "Plasma", "Platelets", "Double Red Cells"],
    "minAdvanceHours": 24,
    "maxAdvanceDays": 30,
    "preparationTips": [
      "Eat a healthy meal before donation",
      "Drink plenty of water",
      "Bring a valid ID",
      "Get a good night's sleep"
    ],
    "rescheduleAllowed": true,
    "maxReschedules": 3,
    "cancellationAllowedHours": 12
  }
}
```

## Update Settings

**`PUT /hospital/appointment-settings`** — same shape as GET response.

---

---

# Key Field Reference

## Appointment Object — All Fields

| Field | Type | Notes |
|-------|------|-------|
| `_id` / `appointmentId` | `string` | Same value, both always present |
| `appointmentDate` | `ISO string` | Full datetime of appointment |
| `appointmentTime` | `string` | Human-readable, e.g. `"10:00 AM"` |
| `status` | `string` | `pending` \| `confirmed` \| `completed` \| `cancelled` |
| `donationType` | `string` | `"Whole Blood"` \| `"Plasma"` \| `"Platelets"` \| `"Double Red Cells"` |
| `qrToken` | `string` | Donor shows this as QR code to hospital |
| `qrExpiresAt` | `ISO string` | 24h after `appointmentDate` |
| `qrScannedAt` | `ISO string \| null` | Set when hospital scans |
| `verificationStatus` | `string` | `pending` \| `verified` \| `rejected` \| `completed` |
| `verificationChecklist` | `object` | `idVerified`, `questionnaireCompleted`, `consentSigned`, `completedAt` |
| `rescheduleCount` | `number` | Number of reschedules performed |
| `rescheduleHistory` | `array` | History of reschedule events |
| `cancelledAt` | `ISO string \| null` | Set on cancellation |
| `notes` | `string \| null` | Donor notes |
| `donorId` | `object \| string` | Populated donor object (or raw ID in some contexts) |
| `hospitalId` | `object \| string` | Populated hospital object (or raw ID) |
| `requestId` | `object \| string \| null` | Linked request (if any) |

## Donation Types

| Label (sent to API) | Type Key | Cooldown | Points |
|--------------------|----------|---------|--------|
| `"Whole Blood"` | `blood` | 56 days | 200 |
| `"Plasma"` | `plasma` | 14 days | 150 |
| `"Platelets"` | `platelets` | 7 days | 175 |
| `"Double Red Cells"` | `double_red_cells` | 112 days | 250 |

---

---

# Complete End-to-End Flow (Donor Booking)

```
1. Donor picks hospital  →  GET /donations/book-appointment/available-slots
2. Donor picks slot      →  POST /donations/book-appointment  →  gets qrToken
3. Donor arrives at hospital  →  shows QR code on phone
4. Hospital scans        →  POST /appointments/verify-qr  →  checklist shown
5a. Checklist complete   →  POST /appointments/verify-qr (with checklist)
5b. Or hospital marks:   →  same endpoint sets verificationStatus: "verified"
6. Hospital completes    →  POST /donations/complete  →  points awarded
```

# Complete End-to-End Flow (Hospital-Initiated)

```
1. Hospital finds donor  →  GET /hospital/find-donors
2. Hospital calls donor, agrees on time
3. Hospital books        →  POST /hospital/donors/:donorId/appointments
4. Donor arrives         →  (same steps 3-6 above)
```
