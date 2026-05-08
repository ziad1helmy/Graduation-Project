# Donor API — Implementation Plan (2-Dev Split)

Complete the missing ~20% of donor-facing endpoints identified in `needs of donor.md`,
following the existing additive architecture (no rewrites, no overkill infra).

> **Skipped by design:** Redis caching · WebSocket · 2dsphere migration · transactional slot locking · 24h reminder cron job

---

## 👤 Developer 1 — Adjustments to Existing Code

> **Theme:** Fix & extend what already exists. No new route files needed.
> **Estimated time: ~1.5 hours**

---

### Task 1 — Dashboard response shape

**File:** `src/controllers/donor.controller.js`

Update `getDashboard` to also fetch the Donor document and compute `donationStatus`:

```
donationStatus = "pending"     → donor has a pending/confirmed appointment
donationStatus = "eligible"    → no pending, lastDonationDate > 56 days ago (or null)
donationStatus = "notEligible" → within cooldown period
```

**Current response:**
```json
{ "donationStats", "pointsSummary", "badges", "latestActivity" }
```

**New response shape:**
```json
{
  "userInfo": {
    "firstName": "Ahmed",
    "bloodType": "O+",
    "donationStatus": "eligible"
  },
  "stats": {
    "totalDonations": 3,
    "points": 600,
    "livesSaved": 9
  },
  "recentActivity": [ "...5 items..." ]
}
```

---

### Task 2 — Nearby hospitals: add `urgentNeedsCount`, `isAvailable`, `bloodTypes`

**File:** `src/controllers/discovery.controller.js`

In `getNearbyHospitals`, after fetching the hospital list:
1. Batch-fetch urgent request counts per hospital using one aggregation on `Request` model
2. Update `mapHospital()` to expose:
   - `isAvailable: true` (always true since filtered already)
   - `urgentNeedsCount: number`
   - `bloodTypes: hospital.bloodBanksAvailable`

---

### Task 3 — GET /appointments/:appointmentId

**Files:** `appointment.service.js` · `appointment.controller.js` · `appointment.routes.js`

**Service** — add:
```js
export const getAppointmentById = async (appointmentId, donorId) => {
  // findOne({ _id, donorId }).populate hospital fields
  // throw 'Appointment not found' if missing
};
```

**Controller** — add `getAppointmentById` handler (~5 lines).

**Route** — add `GET /:appointmentId` **before** the existing `DELETE /:appointmentId`.

---

### Task 4 — PATCH /appointments/:appointmentId (Reschedule)

**Files:** `appointment.service.js` · `appointment.controller.js` · `appointment.routes.js`

**Service** — add:
```js
export const rescheduleAppointment = async (appointmentId, donorId, newDate) => {
  // validate new date is in future
  // validate status is 'pending' or 'confirmed'
  // update appointmentDate, save
};
```

**Controller** — add `rescheduleAppointment` handler. Accepts `{ date }` in body.

**Route** — add `PATCH /:appointmentId`.

---

### Task 5 — GET & PUT /donor/settings

**Files:** `Donor.model.js` · `donor.controller.js` · `donor.routes.js`

**Model** — add embedded `settings` subdocument to `donorSchema`:
```js
settings: {
  pushNotifications: { type: Boolean, default: true  },
  emergencyAlerts:   { type: Boolean, default: true  },
  privacyMode:       { type: Boolean, default: false },
  language:          { type: String,  default: 'en'  },
}
```

**Controller** — add `getSettings` and `updateSettings` functions.

**Routes** — add `GET /settings` and `PUT /settings` in `donor.routes.js`.

---

## 👤 Developer 2 — New Features

> **Theme:** Build genuinely new endpoints from scratch.
> **Estimated time: ~2 hours**

---

### Task 6 — QR Donation Flow (`POST /donations/qr/scan`)

**Files:** `Appointment.model.js` · `appointment.service.js` · `donation.controller.js` · `donation.routes.js`

#### Step A — Update Appointment model
Add fields:
```js
qrToken:      { type: String, unique: true, sparse: true, index: true }
qrScannedAt:  { type: Date, default: null }
donationType: { type: String, default: 'Whole Blood' }
```

#### Step B — Generate QR token on booking
In `appointment.service.js → bookAppointment`, after creating the appointment:
```js
import crypto from 'crypto';
appointment.qrToken = crypto.randomBytes(32).toString('hex');
await appointment.save();
// return qrToken in the booking response
```

#### Step C — Scan endpoint (`POST /donations/qr/scan`, hospital role)
Logic:
1. Find `Appointment` by `qrToken` from request body `{ qrCode }`
2. Validate: `qrScannedAt == null` and status is `pending` or `confirmed`
3. Check donor eligibility via `eligibilityService.canDonate(donor)`
4. Set `appointment.status = 'completed'`, `qrScannedAt = now`
5. Create a `Donation` record with `status: 'completed'`
6. Call `rewardService.onDonationCompleted(donorId, donationId, false)`
7. Return: `{ donationId, pointsEarned, hospitalName, donationType, timestamp }`

**Route:** Add `POST /qr/scan` in `donation.routes.js` (hospital/admin role).

---

### Task 7 — GET /appointments/available-slots

**Files:** `Hospital.model.js` · `appointment.service.js` · `appointment.controller.js` · `appointment.routes.js`

#### Step A — Update Hospital model
Add:
```js
slotsPerHour:      { type: Number, default: 5  }
workingHoursStart: { type: Number, default: 9  }  // 9 AM
workingHoursEnd:   { type: Number, default: 17 }  // 5 PM
```

#### Step B — Service function
```js
export const getAvailableSlots = async (hospitalId, date) => {
  // 1. Fetch hospital working hours + slotsPerHour
  // 2. Generate slots: ['09:00 AM', '10:00 AM', ..., '04:00 PM']
  // 3. Count booked appointments per hour slot for that date
  // 4. Return slots where bookedCount < slotsPerHour
  // Returns: { timeSlots: ['09:00 AM', '11:00 AM'] }
};
```

#### Step C — Controller + Route
`GET /donations/book-appointment/available-slots?hospitalId=&date=YYYY-MM-DD`

> **Note:** Register this route **before** `GET /my-appointments` to avoid prefix collision.

---

### Task 8 — GET /donation/types (5 min)

**Files:** `donation.controller.js` · `donation.routes.js`

```js
export const getDonationTypes = (req, res) => {
  return response.success(res, 200, 'Donation types', [
    'Whole Blood', 'Platelets', 'Plasma',
  ]);
};
```

Route: `GET /types` — **public**, add **before** the auth middleware in `donation.routes.js`.

---

### Task 9 — GET /hospitals/search and GET /hospitals/map

**Files:** `discovery.controller.js` · `discovery.routes.js`

**`searchHospitals`** — `GET /hospitals/search?q=&bloodType=&availableOnly=`
```js
// regex on hospitalName/fullName using q param
// filter bloodBanksAvailable if bloodType provided
// return: id, name, address, bloodTypes, isAvailable
```

**`getHospitalsForMap`** — `GET /hospitals/map`
```js
// return only: id, name, lat, long — minimal payload for map pins
```

**Routes:** Add `GET /search` and `GET /map` **before** `GET /:id` in `discovery.routes.js`.

---

### Task 10 — POST /donations/validate (Eligibility check)

**Files:** `donation.controller.js` · `donation.routes.js`

```js
export const validateDonationEligibility = async (req, res, next) => {
  // 1. Get donor from req.user
  // 2. Check eligibilityService.canDonate(donor)
  // 3. Check no duplicate booking on req.body.date + hospitalId
  // 4. Return: { canDonate: true/false, reason: null | string }
};
```

Route: `POST /validate` — donor role, in `donation.routes.js`.

---

## Summary Table

| # | Developer | Task | Files Touched | Est. Time |
|---|-----------|------|---------------|-----------|
| 1 | Dev 1 | Dashboard shape | `donor.controller.js` | 15 min |
| 2 | Dev 1 | Nearby hospitals fields | `discovery.controller.js` | 30 min |
| 3 | Dev 1 | GET /appointments/:id | service + controller + route | 10 min |
| 4 | Dev 1 | PATCH /appointments/:id | service + controller + route | 20 min |
| 5 | Dev 1 | Donor settings GET/PUT | model + controller + route | 20 min |
| 6 | Dev 2 | QR donation flow | model + service + controller + route | 45 min |
| 7 | Dev 2 | Available time slots | model + service + controller + route | 30 min |
| 8 | Dev 2 | Donation types | controller + route | 5 min |
| 9 | Dev 2 | Hospital search + map | controller + route | 20 min |
| 10 | Dev 2 | Donation validate | controller + route | 15 min |

---

## File Ownership (No Conflicts)

| File | Owner |
|------|-------|
| `src/models/Donor.model.js` | Dev 1 |
| `src/models/Appointment.model.js` | Dev 2 |
| `src/models/Hospital.model.js` | Dev 2 |
| `src/controllers/donor.controller.js` | Dev 1 |
| `src/controllers/appointment.controller.js` | Dev 1 |
| `src/controllers/discovery.controller.js` | Dev 1 |
| `src/controllers/donation.controller.js` | Dev 2 |
| `src/services/appointment.service.js` | Dev 1 |
| `src/routes/donor.routes.js` | Dev 1 |
| `src/routes/appointment.routes.js` | Dev 1 |
| `src/routes/discovery.routes.js` | Dev 1 |
| `src/routes/donation.routes.js` | **Dev 2** |

---

## Merge Strategy

After both finish:
1. Dev 1 opens PR first → merge to `main`
2. Dev 2 rebases on updated `main` → merge

## Verification
- Run `npx vitest run` after merge — no regressions
- Verify new routes appear in Swagger at `/api-docs`
