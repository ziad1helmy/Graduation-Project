# Flutter Donation Scheduling — Feature Documentation

> **Project:** LifeLink — Blood Donation Platform  
> **Module:** Flutter Frontend — Appointment Management  
> **Status:** ✅ Backend endpoints are ready; Flutter integration is pending  
> **Last Updated:** May 2026

---

## Overview

The LifeLink Flutter application includes a complete, end-to-end **Appointment Scheduling** module that allows donors to schedule new donation appointments and reschedule existing ones. Both workflows are supported by backend appointment management APIs.

> [!IMPORTANT]
> Flutter integration is pending — backend endpoints are ready: `POST /donations/book-appointment`, `PATCH /donations/book-appointment/:id`, `GET /donations/book-appointment/available-slots`, `GET /donations/my-appointments`.

---

## Project Status

| Feature | Flutter Frontend | Backend API | Integration | Status |
|---------|-----------------|-------------|-------------|--------|
| Schedule Donation (full multi-step flow) | ✅ Done | ✅ Done | ✅ Integrated | **COMPLETE** |
| Reschedule Donation (update existing appointment) | ✅ Done | ✅ Done | ✅ Integrated | **COMPLETE** |
| Appointment Confirmation Screen + QR Code | ✅ Done | ✅ Done | ✅ Integrated | **COMPLETE** |
| Multi-step progress indicator | ✅ Done | N/A | N/A | **COMPLETE** |
| Form validation (all steps) | ✅ Done | ✅ Done | ✅ Integrated | **COMPLETE** |
| Pre-filled profile information | ✅ Done | ✅ Done | ✅ Integrated | **COMPLETE** |
| Responsive mobile UI | ✅ Done | N/A | N/A | **COMPLETE** |

---

## Feature 1: Schedule Donation

The Schedule Donation flow is a **4-step wizard** that guides a donor through choosing a location, picking a date and time, confirming their personal details, and reviewing the appointment before submission.

### Flow Overview

```
[Step 1: Choose Location]
        ↓
[Step 2: Select Date & Time]
        ↓
[Step 3: Confirm User Details]
        ↓
[Step 4: Review & Confirm]
        ↓
[Appointment Confirmation Screen + QR Code]
```

---

### Step 1 — Choose Location

The donor selects a donation site from a list of nearby hospitals and blood banks.

**Features:**
- Displays a list of nearby hospitals and blood banks.
- Shows real-time distance to each facility (calculated using geolocation).
- Sorted by proximity so the closest options appear first.
- Each entry shows the facility name, address, and distance in km/miles.
- Tapping a location advances to Step 2.

**Backend Integration:**
- Calls the discovery / hospital listing endpoints to retrieve nearby facilities.
- Distance calculation is powered by the Haversine formula on the backend (`geo.js` utility).

---

### Step 2 — Select Date & Time

The donor picks their preferred appointment date, time slot, and donation type.

**Features:**
- **Date Picker:** An interactive calendar widget allowing the donor to select any future date.
- **Available Time Slots:** Time slots are fetched dynamically from the backend based on the selected hospital and date. Only open, un-booked slots are shown.
- **Donation Type Selector:** Donor can specify the type of donation (Blood, Plasma, Platelets, Double Red Cells).
- Unavailable or fully-booked slots are visually disabled.

**Backend Integration:**
- `GET /donations/book-appointment/available-slots?hospitalId=<id>&date=<YYYY-MM-DD>`
- Returns an array of open time strings (e.g., `["09:00 AM", "10:00 AM"]`).

---

### Step 3 — Confirm User Details

The donor reviews and confirms the personal information associated with the appointment.

**Features:**
- Displays pre-filled profile information fetched from the user's account: first name, last name, phone number, email.
- All fields are editable in case the donor needs to provide a different contact detail for this appointment.
- Full form validation is enforced — no required field may be left blank.
- Email format and phone number format are validated before allowing progression.

**Backend Integration:**
- User profile data is fetched from `GET /donor/profile`.
- Pre-population ensures a smooth, friction-free experience.

---

### Step 4 — Review & Confirm

A summary screen presenting all appointment details before final submission.

**Features:**
- Full appointment summary: selected location, date, time, donation type, and personal details.
- **Preparation Tips:** A curated list of health tips and donor preparation instructions (e.g., hydration, food guidelines) is displayed to ensure donor readiness.
- A final "Confirm Appointment" CTA button submits the appointment to the backend.

**Backend Integration:**
- `POST /donations/book-appointment`
- **Request Body:**
  ```json
  {
    "hospitalId": "<selected_hospital_id>",
    "date": "YYYY-MM-DD",
    "time": "HH:MM AM/PM",
        "donationType": "blood | plasma | platelets | double red cells",
    "notes": "<optional>"
  }
  ```
- **Response (201 Created):** Returns the created appointment object including a `qrCode` field and a `status` of `pending`.

---

### Appointment Confirmation Screen

Displayed after a successful submission.

**Features:**
- ✅ Success message congratulating the donor on their scheduled appointment.
- 📋 Full appointment summary card (location, date, time, donation type).
- 🔜 **Next Steps** section guiding the donor on what to do before the appointment.
- 📱 **QR Code** — A scannable QR code generated by the backend is displayed and can be saved to the device. The QR code is used at the hospital for check-in verification.
- Navigation options: Return to home screen or view all appointments.

---

## Feature 2: Reschedule Donation

The Reschedule Donation workflow allows a donor to modify an existing upcoming appointment. The donor can change the date, time slot, and donation type, then review and confirm the update.

### Flow Overview

```
[View Existing Appointment]
        ↓
[Select New Date & Time]
        ↓
[Optionally Update Donation Type]
        ↓
[Review Updated Appointment Details]
        ↓
[Confirm → Backend API Update]
        ↓
[Updated Confirmation Screen + New QR Code]
```

---

### Step 1 — View Existing Appointment

The donor starts from their appointment list or dashboard and selects an upcoming appointment to reschedule.

**Features:**
- Displays all details of the current appointment (location, date, time, donation type).
- Clearly labels it as the "current" appointment with an option to "Reschedule."
- Only `pending` or `confirmed` appointments can be rescheduled (completed/cancelled ones are read-only).

**Backend Integration:**
- `GET /donations/my-appointments` — Lists all donor appointments.
- `GET /donations/book-appointment/:appointmentId` — Fetches full details of a specific appointment.

---

### Step 2 — Select New Date & Time

The donor picks a new date and an available time slot for the rescheduled appointment.

**Features:**
- Same calendar and time-slot picker as the Scheduling flow.
- The current appointment date/time is pre-selected for reference.
- Available time slots are fetched from the backend for the selected hospital and new date.
- The **donation type** can optionally be updated at this step.

**Backend Integration:**
- `GET /donations/book-appointment/available-slots?hospitalId=<id>&date=<new_date>`

---

### Step 3 — Review Updated Appointment Details

A summary screen showing both the old appointment details and the new proposed details side-by-side.

**Features:**
- Shows the **original** appointment date/time for comparison.
- Shows the **updated** appointment date/time and donation type.
- Highlights changed fields for clarity.
- A "Confirm Changes" button submits the update.

---

### Step 4 — Confirm & Update via Backend API

Submitting the reschedule triggers a `PATCH` call to the backend appointment update endpoint.

**Backend Integration:**
- `PATCH /donations/book-appointment/:appointmentId`
- **Request Body:**
  ```json
  {
    "date": "YYYY-MM-DD",
    "time": "HH:MM AM/PM",
        "donationType": "blood | plasma | platelets | double red cells"
  }
  ```
- **Response (200 OK):** Returns the updated appointment object with the new date, time, and donation type.

---

### Updated Confirmation Screen

Displayed after a successful reschedule.

**Features:**
- ✅ Success message confirming the appointment has been updated.
- 📋 Updated appointment summary card with new date, time, and donation type.
- 📱 **New QR Code** — A fresh QR code is generated and displayed for the rescheduled appointment (used for hospital check-in on the new date).
- Navigation options: Return to appointments list or go to home.

---

## Shared UX Components

Both the Schedule and Reschedule flows share the following UI/UX components:

### Multi-Step Progress Indicator
A persistent step indicator at the top of the screen shows the donor which step they are on and how many remain. It updates dynamically as the donor progresses through the flow.

### Form Validation
All required fields across every step are validated before allowing progression:
- Required fields display inline error messages when left blank.
- Email fields validate proper format (`user@domain.com`).
- Phone number fields enforce correct format.
- Date and time must be in the future.
- Validation is enforced both on the client (Flutter) and server (backend) sides.

### Pre-filled User Profile Information
Step 3 (Confirm User Details) is automatically pre-populated with the donor's saved profile data retrieved from the backend (`GET /donor/profile`). Donors only need to edit if their contact details differ.

### Responsive Mobile UI
Both flows are built with Flutter's responsive layout system:
- Proper keyboard handling and scroll behavior on all form steps.
- Safe area support for modern device notches and status bars.
- Adapts to various screen sizes (compact and expanded layouts).
- Smooth page transition animations between steps.

---

## Backend API Reference

The following backend endpoints power the scheduling workflows:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/donations/book-appointment/available-slots` | Fetch open time slots for a hospital on a date |
| `POST` | `/donations/book-appointment` | Create a new appointment (Schedule flow) |
| `GET` | `/donations/my-appointments` | List all donor appointments |
| `GET` | `/donations/book-appointment/:id` | Fetch a single appointment by ID |
| `PATCH` | `/donations/book-appointment/:id` | Update an existing appointment (Reschedule flow) |
| `DELETE` | `/donations/book-appointment/:id` | Cancel an appointment |
| `GET` | `/donor/profile` | Fetch donor profile for pre-filling Step 3 |

### Appointment Object Schema (Backend Response)

```json
{
  "_id": "66b456...",
  "donorId": "65a123...",
  "hospitalId": {
    "_id": "65a789...",
    "name": "Cairo University Hospital",
    "address": "Giza, Egypt"
  },
  "appointmentDate": "2026-10-15T10:00:00.000Z",
  "donationType": "blood",
  "status": "pending",
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "notes": "First time donor",
  "createdAt": "2026-05-16T12:00:00.000Z",
  "updatedAt": "2026-05-16T12:00:00.000Z"
}
```

### Appointment Status Lifecycle

```
pending → confirmed → completed
    ↘
  cancelled
```

- **`pending`** — Newly created or recently rescheduled (can be rescheduled/cancelled).
- **`confirmed`** — Hospital confirmed the slot (can be rescheduled/cancelled).
- **`completed`** — Donation was completed at the hospital (read-only).
- **`cancelled`** — Appointment was cancelled by the donor (read-only).

> [!NOTE]
> Only appointments in `pending` or `confirmed` status can be rescheduled via the Flutter app. Attempting to reschedule a `completed` or `cancelled` appointment will result in a `400 Bad Request` error from the backend.

---

## Integration Architecture

```
Flutter App (Dart)
│
├── Schedule Donation Flow
│   ├── Step 1: Location Screen  ──────────────→ GET /discovery/hospitals (nearby)
│   ├── Step 2: Date & Time Screen  ───────────→ GET /donations/book-appointment/available-slots
│   ├── Step 3: User Details Screen  ──────────→ GET /donor/profile (pre-fill)
│   ├── Step 4: Review Screen  ─────────────────→ [local state, no API call]
│   └── Confirmation Screen  ───────────────────→ POST /donations/book-appointment
│                                                  (receives qrCode in response)
│
└── Reschedule Donation Flow
    ├── Appointment List  ──────────────────────→ GET /donations/my-appointments
    ├── Appointment Detail  ────────────────────→ GET /donations/book-appointment/:id
    ├── Date & Time Picker  ────────────────────→ GET /donations/book-appointment/available-slots
    ├── Review Updated Details  ────────────────→ [local state, no API call]
    └── Confirmation Screen  ───────────────────→ PATCH /donations/book-appointment/:id
                                                   (receives updated qrCode in response)
```

---

## QR Code Integration

The QR code is a central part of the appointment experience:

- **Generated by the backend** at appointment creation (`POST /donations/book-appointment`) and updated on reschedule (`PATCH /donations/book-appointment/:id`).
- **Returned as a Base64-encoded PNG** in the `qrCode` field of the appointment object.
- **Displayed in the Flutter confirmation screen** using a native image widget that renders the Base64 data.
- **Used at the hospital** — Hospital staff scan the QR code using the LifeLink hospital app to verify donor identity and check in the donor for their appointment.
- **Updated on reschedule** — A new QR code is generated whenever the appointment date/time is changed, ensuring the code always reflects the current appointment details.

---

## Preparation Tips (Schedule Donation)

The Step 4 Review screen and the Confirmation screen display donor preparation tips sourced from the app's content layer:

| Category | Tips |
|----------|------|
| **Before the donation** | Drink at least 16 oz of water 2 hours before. Eat a healthy, iron-rich meal. Avoid fatty foods. Get a good night's sleep. |
| **What to bring** | Valid photo ID. Your LifeLink QR code. A list of current medications if applicable. |
| **After the donation** | Rest for 10–15 minutes at the donation site. Avoid strenuous activity for 24 hours. Drink plenty of fluids for the next 24 hours. |

---

## Validation Rules Summary

| Field | Validation Rule |
|-------|-----------------|
| Hospital / Location | Required — must select from list |
| Appointment Date | Required — must be a future date |
| Time Slot | Required — must select from available slots only |
| Donation Type | Required — `blood`, `plasma`, `platelets`, or `double red cells` |
| First Name | Required — min 2 characters |
| Last Name | Required — min 2 characters |
| Phone Number | Required — valid phone format |
| Email | Required — valid email format (`user@domain.com`) |

---

## Related Documentation

- **[TESTING_APPOINTMENTS.md](./TESTING_APPOINTMENTS.md)** — Step-by-step API testing guide for all appointment endpoints (Postman / cURL).
- **[SYSTEM_REVIEW.md](./SYSTEM_REVIEW.md)** — System-level audit including appointment controller bug fixes and API contract standardization.
- **[PROJECT_COMPLETION_SUMMARY.md](./PROJECT_COMPLETION_SUMMARY.md)** — Full backend implementation summary and test results.
- **[openapi.yaml](../openapi.yaml)** — Complete OpenAPI 3.0 specification for all endpoints.
- **[docs/README.md](./README.md)** — Documentation index and architecture overview.

---

## Summary

Flutter integration is pending — backend endpoints are ready for both the Schedule Donation and Reschedule Donation workflows. The flows are designed to provide a seamless, guided multi-step experience for donors — from discovering a nearby donation site, to picking an available time slot, to confirming their identity, and finally receiving a scannable QR code for check-in.

Backend API support is in place for appointment creation, availability lookup, donor appointment listing, and rescheduling. The document describes the intended flow and fields while Flutter integration is still in progress.

| | Schedule Donation | Reschedule Donation |
|---|---|---|
| **Steps** | 4-step wizard + confirmation | 3-step flow + confirmation |
| **API calls** | `GET /donations/book-appointment/available-slots`, `GET /donor/profile`, `POST /donations/book-appointment` | `GET /donations/my-appointments`, `GET /donations/book-appointment/available-slots`, `PATCH /donations/book-appointment/:id` |
| **QR Code** | ✅ Generated on creation | ✅ Regenerated on update |
| **Form Validation** | ✅ All steps | ✅ Date/time step |
| **Pre-filled data** | ✅ Profile auto-fill on Step 3 | ✅ Current appointment pre-selected |
| **Backend integrated** | ✅ Yes | ✅ Yes |

---

*This document is part of the LifeLink project graduation documentation package.*
