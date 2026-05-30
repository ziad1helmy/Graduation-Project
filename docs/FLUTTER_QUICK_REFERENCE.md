# Appointment API - Quick Reference for Flutter

## Base URLs
- **Local Dev**: `http://localhost:5000`
- **Production**: `https://graduation-project-cy61.onrender.com`

## Quick Test Flow

### 1. Get Hospital ID
```
GET /hospitals  (list hospitals)
Response: Pick a verified hospital ID
```

### 2. Book Appointment
```
POST /donations/book-appointment
{
  "hospitalId": "<hospital-id>",
  "appointmentDate": "2026-06-10T10:00:00Z",
  "donationType": "Whole Blood"
}
```
Expected: `201` with appointment data

### 3. Check Available Slots
```
GET /donations/book-appointment/available-slots?hospitalId=<id>&date=2026-06-10
```
Shows available times with remaining capacity

### 4. Reschedule (Optional)
```
PATCH /donations/book-appointment/<appointmentId>
{
  "appointmentDate": "2026-06-15T14:00:00Z",
  "notes": "Schedule change"
}
```

### 5. Cancel (after 12h window)
```
DELETE /donations/book-appointment/<appointmentId>
```
Must be 12+ hours before appointment

---

## Error Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| `201` | Appointment created | Booking succeeded |
| `400` | Validation error | Invalid date, bad data |
| `401` | Unauthorized | Missing/invalid JWT |
| `403` | Forbidden | Not a donor role |
| `404` | Not found | Hospital/appointment doesn't exist |
| `409` | Conflict | Duplicate active appointment |

---

## Common Error Messages

```
"Appointment date must be in the future"
→ Book for a future date

"Invalid donor or hospital id"
→ ObjectId format error (24 hex chars)

"You already have an active appointment at this hospital"
→ Only one active appointment per hospital

"Cancellation must be at least 12 hours in advance"
→ Too close to appointment time

"Hospital is not verified"
→ Hospital admin must verify first

"Invalid donation type"
→ Use: "Whole Blood", "Plasma", "Platelets", "Double Red Cells"

"Selected time slot is outside operating hours"
→ Hospital closed at this time

"Daily appointment capacity has been reached"
→ Hospital fully booked that day
```

---

## Request/Response Examples

### Successful Booking
```json
POST /donations/book-appointment
Authorization: Bearer eyJhbGc...

Request:
{
  "hospitalId": "65f3df915f42685cbbbcbb1b",
  "appointmentDate": "2026-06-15T10:00:00Z",
  "donationType": "Whole Blood"
}

Response (201):
{
  "success": true,
  "message": "Appointment booked",
  "data": {
    "_id": "65fe540565ff7785a031315c",
    "appointmentDate": "2026-06-15T10:00:00Z",
    "status": "pending",
    "qrToken": "abc123...",
    "donationType": "Whole Blood"
  }
}
```

### Duplicate Booking Error
```json
POST /donations/book-appointment
Authorization: Bearer eyJhbGc...

Request:
{
  "hospitalId": "65f3df915f42685cbbbcbb1b",
  "appointmentDate": "2026-06-20T14:00:00Z"
}

Response (409):
{
  "success": false,
  "message": "You already have an active appointment at this hospital"
}
```

### Cancellation Too Late
```json
DELETE /donations/book-appointment/65fe540565ff7785a031315c
Authorization: Bearer eyJhbGc...

Response (400):
{
  "success": false,
  "message": "Cancellation must be at least 12 hours in advance"
}
```

---

## Donation Types (Case-Sensitive)
- ✅ `"Whole Blood"`
- ✅ `"Plasma"`
- ✅ `"Platelets"`
- ✅ `"Double Red Cells"`

---

## Testing Checklist

- [ ] Can book appointment successfully
- [ ] Cannot book duplicate at same hospital (409)
- [ ] Can book at different hospitals
- [ ] Can view appointment details
- [ ] Can reschedule appointment
- [ ] Can cancel 12+ hours before
- [ ] Cannot cancel within 12 hours
- [ ] Available slots show correctly
- [ ] All error messages appear correctly

---

## Postman Collection Template

```json
{
  "info": {
    "name": "Appointment API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Book Appointment",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/donations/book-appointment",
        "header": ["Authorization: Bearer {{token}}"],
        "body": {
          "mode": "raw",
          "raw": "{\"hospitalId\": \"{{hospital_id}}\", \"appointmentDate\": \"2026-06-10T10:00:00Z\"}"
        }
      }
    }
  ]
}
```

---

## Key Fixes Applied

✅ **Cancellation Logic** - Now correctly allows cancellation until 12 hours before appointment  
✅ **Duplicate Prevention** - Concurrent requests can't create duplicate bookings  
✅ **Race Condition** - Atomic duplicate check with unique index  
✅ **Better Error Messages** - Clear feedback on what went wrong

---

## Support

**Swagger Docs**: `/api-docs` endpoint  
**All Tests Passing**: 58/58 ✅  
**Last Updated**: May 30, 2026
