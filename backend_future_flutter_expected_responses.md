# Backend Future Flutter Expected Responses

This document outlines the exact runtime response JSON structures for all backend endpoints currently implemented in the Express backend that are **not** present in `flutter_expected_responses.md`.

These structures are derived strictly from the backend controllers, services, database models (projections, selections, populate options, virtuals), and response helpers.

---

# 1. Hospital Management API (`/hospital`)

### Endpoint
`GET /hospital/find-donors`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Nearby donors retrieved successfully",
  "data": {
    "donors": [
      {
        "donorId": "60d5ec49f0322c2c20e28f36",
        "fullName": "Ziad Abdelghany",
        "bloodType": "A+",
        "email": "ziad@example.com",
        "distance": "2.45 km",
        "distanceKm": 2.45,
        "distanceMeters": 2450,
        "isOptedIn": true,
        "phoneNumber": "01234567890",
        "location": {
          "lat": 30.0444,
          "lng": 31.2357
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### Endpoint
`POST /hospital/donors/:donorId/appointments`

#### Current Backend Runtime Response
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
    "donorId": {
      "_id": "60d5ec49f0322c2c20e28f36"
    },
    "requestId": {
      "_id": "60d5ec49f0322c2c20e28f39",
      "type": "blood",
      "bloodType": ["A+"],
      "organType": null,
      "urgency": "critical",
      "urgencyLevel": "critical",
      "unitsNeeded": 3,
      "notes": "Accident patient emergency.",
      "hospitalId": "60d5ec49f0322c2c20e28f3a",
      "hospitalName": "Al-Amal Hospital"
    },
    "donationType": "Whole Blood",
    "hospitalId": {
      "_id": "60d5ec49f0322c2c20e28f3a"
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
    "request": {
      "requestId": "60d5ec49f0322c2c20e28f39",
      "id": "60d5ec49f0322c2c20e28f39",
      "urgencyLevel": "critical",
      "unitsNeeded": 3,
      "notes": "Accident patient emergency."
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
      "contactNumber": "+20123456789",
      "location": {
        "city": "Cairo",
        "governorate": "Cairo",
        "coordinates": {
          "lat": 30.0444,
          "lng": 31.2357
        }
      }
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

### Endpoint
`GET /hospital/appointments`

#### Current Backend Runtime Response
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
        "donorId": {
          "_id": "60d5ec49f0322c2c20e28f36"
        },
        "requestId": {
          "_id": "60d5ec49f0322c2c20e28f39",
          "type": "blood",
          "bloodType": ["A+"],
          "organType": null,
          "urgency": "critical",
          "urgencyLevel": "critical",
          "unitsNeeded": 3,
          "notes": "Accident patient emergency.",
          "hospitalId": "60d5ec49f0322c2c20e28f3a",
          "hospitalName": "Al-Amal Hospital"
        },
        "donationType": "Whole Blood",
        "hospitalId": {
          "_id": "60d5ec49f0322c2c20e28f3a"
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
        "request": {
          "requestId": "60d5ec49f0322c2c20e28f39",
          "id": "60d5ec49f0322c2c20e28f39",
          "urgencyLevel": "critical",
          "unitsNeeded": 3,
          "notes": "Accident patient emergency."
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
          "contactNumber": "+20123456789",
          "location": {
            "city": "Cairo",
            "governorate": "Cairo",
            "coordinates": {
              "lat": 30.0444,
              "lng": 31.2357
            }
          }
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

### Endpoint
`GET /hospital/appointments/:appointmentId`

#### Current Backend Runtime Response
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
    "donorId": {
      "_id": "60d5ec49f0322c2c20e28f36"
    },
    "requestId": {
      "_id": "60d5ec49f0322c2c20e28f39",
      "type": "blood",
      "bloodType": ["A+"],
      "organType": null,
      "urgency": "critical",
      "urgencyLevel": "critical",
      "unitsNeeded": 3,
      "notes": "Accident patient emergency.",
      "hospitalId": "60d5ec49f0322c2c20e28f3a",
      "hospitalName": "Al-Amal Hospital"
    },
    "donationType": "Whole Blood",
    "hospitalId": {
      "_id": "60d5ec49f0322c2c20e28f3a"
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
    "request": {
      "requestId": "60d5ec49f0322c2c20e28f39",
      "id": "60d5ec49f0322c2c20e28f39",
      "urgencyLevel": "critical",
      "unitsNeeded": 3,
      "notes": "Accident patient emergency."
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
      "contactNumber": "+20123456789",
      "location": {
        "city": "Cairo",
        "governorate": "Cairo",
        "coordinates": {
          "lat": 30.0444,
          "lng": 31.2357
        }
      }
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

### Endpoint
`GET /hospital/profile`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Hospital profile retrieved successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f3a",
    "fullName": "Al-Amal Hospital",
    "email": "hospital@lifelink.com",
    "role": "hospital",
    "isEmailVerified": true,
    "isSuspended": false,
    "location": {
      "city": "Cairo",
      "governorate": "Cairo",
      "coordinates": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "lastUpdated": "2026-06-05T12:00:00.000Z"
    },
    "fcmTokens": [],
    "name": "Al-Amal Hospital",
    "type": "hospital",
    "hospitalType": "General Hospital",
    "workingHours": "9AM - 5PM",
    "phone": "+20123456789",
    "address": {
      "city": "Cairo",
      "governorate": "Cairo",
      "street": "123 Nile Street"
    },
    "city": "Cairo",
    "state": "Cairo",
    "zipCode": "11511",
    "hospitalId": "HOSP123",
    "adminContactName": "Dr. Ahmed",
    "adminContactPhone": "+20123456789",
    "emergencyContact": "+20123456780",
    "bloodBanksAvailable": ["O+", "O-", "A+", "A-"],
    "capacity": 50,
    "lat": 30.0444,
    "long": 31.2357,
    "hospitalName": "Al-Amal Hospital",
    "hospitalNameNormalized": "الامل",
    "contactNumber": "+20123456789",
    "slotsPerHour": 5,
    "workingHoursStart": 9,
    "workingHoursEnd": 17,
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-05T12:00:00.000Z"
  }
}
```

---

### Endpoint
`PUT /hospital/profile`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Hospital profile updated successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f3a",
    "fullName": "Al-Amal Hospital Updated",
    "email": "hospital@lifelink.com",
    "role": "hospital",
    "isEmailVerified": true,
    "isSuspended": false,
    "location": {
      "city": "Cairo",
      "governorate": "Cairo",
      "coordinates": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "lastUpdated": "2026-06-07T00:56:18.000Z"
    },
    "fcmTokens": [],
    "name": "Al-Amal Hospital Updated",
    "type": "hospital",
    "hospitalType": "General Hospital",
    "workingHours": "9AM - 5PM",
    "phone": "+20123456789",
    "address": {
      "city": "Cairo",
      "governorate": "Cairo",
      "street": "123 Nile Street"
    },
    "city": "Cairo",
    "state": "Cairo",
    "zipCode": "11511",
    "hospitalId": "HOSP123",
    "adminContactName": "Dr. Ahmed",
    "adminContactPhone": "+20123456789",
    "emergencyContact": "+20123456780",
    "bloodBanksAvailable": ["O+", "O-", "A+", "A-"],
    "capacity": 50,
    "lat": 30.0444,
    "long": 31.2357,
    "hospitalName": "Al-Amal Hospital Updated",
    "hospitalNameNormalized": "الامل",
    "contactNumber": "+20123456789",
    "slotsPerHour": 5,
    "workingHoursStart": 9,
    "workingHoursEnd": 17,
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`GET /hospital/appointment-settings`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Appointment settings retrieved successfully",
  "data": {
    "openingTime": "09:00",
    "closingTime": "19:00",
    "workingDays": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ],
    "defaultSlotsPerHour": 4,
    "hourlySlots": {
      "09:00": 4,
      "10:00": 4,
      "11:00": 4,
      "12:00": 4,
      "13:00": 4,
      "14:00": 4,
      "15:00": 4,
      "16:00": 4,
      "17:00": 4,
      "18:00": 4
    },
    "totalDailyCapacity": 40,
    "isActive": true,
    "supportedDonationTypes": [
      "Whole Blood",
      "Plasma",
      "Platelets",
      "Double Red Cells"
    ],
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

---

### Endpoint
`PUT /hospital/appointment-settings`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Appointment settings updated successfully",
  "data": {
    "openingTime": "09:00",
    "closingTime": "19:00",
    "workingDays": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ],
    "defaultSlotsPerHour": 5,
    "hourlySlots": {
      "09:00": 5,
      "10:00": 5,
      "11:00": 5,
      "12:00": 5,
      "13:00": 5,
      "14:00": 5,
      "15:00": 5,
      "16:00": 5,
      "17:00": 5,
      "18:00": 5
    },
    "totalDailyCapacity": 50,
    "isActive": true,
    "supportedDonationTypes": [
      "Whole Blood",
      "Plasma",
      "Platelets",
      "Double Red Cells"
    ],
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

---

### Endpoint
`POST /hospital/request`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donation request created successfully",
  "data": {
    "hospitalId": {
      "_id": "60d5ec49f0322c2c20e28f3a",
      "fullName": "Al-Amal Hospital",
      "hospitalName": "Al-Amal Hospital",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo",
        "street": "123 Nile Street"
      },
      "contactNumber": "+20123456789"
    },
    "hospitalContact": "+20123456789",
    "contactNumber": "+20123456789",
    "type": "blood",
    "urgency": "normal",
    "requiredBy": "2026-06-10T12:00:00.000Z",
    "quantity": 2,
    "unitsNeeded": 2,
    "patientType": "Cancer Patient",
    "isEmergency": false,
    "notes": "Chemotherapy support",
    "bloodType": ["O+"],
    "locationHospital": {
      "latitude": 30.0444,
      "longitude": 31.2357
    },
    "hospitalLocation": {
      "lat": 30.0444,
      "lng": 31.2357
    },
    "hospitalLocationGeo": {
      "type": "Point",
      "coordinates": [31.2357, 30.0444]
    },
    "hospitalName": "Al-Amal Hospital",
    "status": "pending",
    "qrToken": null,
    "qrCreatedAt": null,
    "qrExpiresAt": null,
    "_id": "60d5ec49f0322c2c20e28f60",
    "createdAt": "2026-06-07T00:56:18.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`POST /hospital/requests/create-emergency`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donation request created successfully",
  "data": {
    "hospitalId": {
      "_id": "60d5ec49f0322c2c20e28f3a",
      "fullName": "Al-Amal Hospital",
      "hospitalName": "Al-Amal Hospital",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo",
        "street": "123 Nile Street"
      },
      "contactNumber": "+20123456789"
    },
    "hospitalContact": "+20123456789",
    "contactNumber": "+20123456789",
    "type": "blood",
    "urgency": "critical",
    "requiredBy": "2026-06-08T00:56:18.000Z",
    "quantity": 5,
    "unitsNeeded": 5,
    "patientType": "Major Accident ICU",
    "isEmergency": true,
    "notes": "Major Accident ICU",
    "bloodType": ["O-", "O+"],
    "locationHospital": {
      "latitude": 30.0444,
      "longitude": 31.2357
    },
    "hospitalLocation": {
      "lat": 30.0444,
      "lng": 31.2357
    },
    "hospitalLocationGeo": {
      "type": "Point",
      "coordinates": [31.2357, 30.0444]
    },
    "hospitalName": "Al-Amal Hospital",
    "status": "pending",
    "qrToken": null,
    "qrCreatedAt": null,
    "qrExpiresAt": null,
    "_id": "60d5ec49f0322c2c20e28f65",
    "createdAt": "2026-06-07T00:56:18.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`GET /hospital/dashboard`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Monthly report retrieved successfully",
  "data": {
    "month": "2026-06",
    "totalRequests": 10,
    "openRequests": 3,
    "activeRequests": 4,
    "totalCompleted": 5,
    "totalCancelled": 1,
    "emergencyRequests": 4,
    "responseCount": 15,
    "totalResponses": 15,
    "totalDonations": 15,
    "completedDonations": 12,
    "uniqueDonorsResponded": 8,
    "confirmedDonorCount": 6,
    "overdueCount": 0,
    "dueSoonCount": 2,
    "avgDaysToRequiredBy": 3,
    "recentActivityCount": 4,
    "recentCompletedDonationCount": 3
  }
}
```

---

### Endpoint
`GET /hospital/history`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request history retrieved successfully",
  "data": {
    "statistics": {
      "activeRequests": 4,
      "completedRequests": 8,
      "cancelledRequests": 2
    },
    "requests": [
      {
        "_id": "60d5ec49f0322c2c20e28f60",
        "bloodType": ["O+"],
        "unitsRequested": 2,
        "urgencyLevel": "normal",
        "donorsContacted": 5,
        "donorsConfirmed": 2,
        "isFulfilled": true,
        "requestDate": "2026-06-05T12:00:00.000Z",
        "completionTimeInHours": 14.5,
        "priority": "normal",
        "location": "30.0444, 31.2357",
        "hospitalContact": "+20123456789",
        "hospitalName": "Al-Amal Hospital",
        "status": "completed"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### Endpoint
`POST /hospital/requests/:requestId/close`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request closed successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f60",
    "hospitalId": "60d5ec49f0322c2c20e28f3a",
    "type": "blood",
    "status": "completed",
    "urgency": "normal",
    "requiredBy": "2026-06-10T12:00:00.000Z",
    "quantity": 2,
    "unitsNeeded": 2,
    "patientType": "Cancer Patient",
    "isEmergency": false,
    "notes": "Chemotherapy support",
    "bloodType": ["O+"],
    "locationHospital": {
      "latitude": 30.0444,
      "longitude": 31.2357
    },
    "hospitalLocation": {
      "lat": 30.0444,
      "lng": 31.2357
    },
    "hospitalLocationGeo": {
      "type": "Point",
      "coordinates": [31.2357, 30.0444]
    },
    "hospitalName": "Al-Amal Hospital",
    "completedAt": "2026-06-07T00:56:18.000Z",
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`GET /hospital/requests`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Requests retrieved successfully",
  "data": {
    "requests": [
      {
        "_id": "60d5ec49f0322c2c20e28f60",
        "hospitalId": "60d5ec49f0322c2c20e28f3a",
        "type": "blood",
        "status": "pending",
        "urgency": "normal",
        "requiredBy": "2026-06-10T12:00:00.000Z",
        "quantity": 2,
        "unitsNeeded": 2,
        "patientType": "Cancer Patient",
        "isEmergency": false,
        "notes": "Chemotherapy support",
        "bloodType": ["O+"],
        "locationHospital": {
          "latitude": 30.0444,
          "longitude": 31.2357
        },
        "hospitalLocation": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "hospitalLocationGeo": {
          "type": "Point",
          "coordinates": [31.2357, 30.0444]
        },
        "hospitalName": "Al-Amal Hospital",
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### Endpoint
`GET /hospital/requests/:requestId`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request details retrieved successfully",
  "data": {
    "request": {
      "_id": "60d5ec49f0322c2c20e28f60",
      "hospitalId": {
        "_id": "60d5ec49f0322c2c20e28f3a",
        "fullName": "Al-Amal Hospital",
        "hospitalName": "Al-Amal Hospital",
        "address": {
          "city": "Cairo",
          "governorate": "Cairo",
          "street": "123 Nile Street"
        },
        "contactNumber": "+20123456789"
      },
      "type": "blood",
      "status": "pending",
      "urgency": "normal",
      "requiredBy": "2026-06-10T12:00:00.000Z",
      "quantity": 2,
      "unitsNeeded": 2,
      "patientType": "Cancer Patient",
      "isEmergency": false,
      "notes": "Chemotherapy support",
      "bloodType": ["O+"],
      "locationHospital": {
        "latitude": 30.0444,
        "longitude": 31.2357
      },
      "hospitalLocation": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "hospitalLocationGeo": {
        "type": "Point",
        "coordinates": [31.2357, 30.0444]
      },
      "hospitalName": "Al-Amal Hospital",
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-05T12:00:00.000Z"
    },
    "donations": [
      {
        "_id": "60d5ec49f0322c2c20e28f70",
        "donorId": {
          "_id": "60d5ec49f0322c2c20e28f36",
          "fullName": "Ziad Abdelghany",
          "email": "ziad@example.com",
          "phoneNumber": "01234567890",
          "location": {
            "city": "Cairo",
            "governorate": "Cairo",
            "coordinates": {
              "lat": 30.0444,
              "lng": 31.2357
            }
          },
          "bloodType": "A+"
        },
        "requestId": "60d5ec49f0322c2c20e28f60",
        "status": "pending",
        "quantity": 1,
        "createdAt": "2026-06-06T10:00:00.000Z",
        "updatedAt": "2026-06-06T10:00:00.000Z"
      }
    ],
    "responseCount": 1,
    "donationCount": 1
  }
}
```

---

### Endpoint
`PUT /hospital/requests/:requestId`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request status updated successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f60",
    "hospitalId": "60d5ec49f0322c2c20e28f3a",
    "type": "blood",
    "status": "in-progress",
    "urgency": "normal",
    "requiredBy": "2026-06-10T12:00:00.000Z",
    "quantity": 2,
    "unitsNeeded": 2,
    "patientType": "Cancer Patient",
    "isEmergency": false,
    "notes": "Chemotherapy support",
    "bloodType": ["O+"],
    "locationHospital": {
      "latitude": 30.0444,
      "longitude": 31.2357
    },
    "hospitalLocation": {
      "lat": 30.0444,
      "lng": 31.2357
    },
    "hospitalLocationGeo": {
      "type": "Point",
      "coordinates": [31.2357, 30.0444]
    },
    "hospitalName": "Al-Amal Hospital",
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`DELETE /hospital/requests/:requestId`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request cancelled successfully",
  "data": {
    "request": {
      "_id": "60d5ec49f0322c2c20e28f60",
      "hospitalId": "60d5ec49f0322c2c20e28f3a",
      "type": "blood",
      "status": "cancelled",
      "urgency": "normal",
      "requiredBy": "2026-06-10T12:00:00.000Z",
      "quantity": 2,
      "unitsNeeded": 2,
      "patientType": "Cancer Patient",
      "isEmergency": false,
      "notes": "Chemotherapy support",
      "bloodType": ["O+"],
      "locationHospital": {
        "latitude": 30.0444,
        "longitude": 31.2357
      },
      "hospitalLocation": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "hospitalLocationGeo": {
        "type": "Point",
        "coordinates": [31.2357, 30.0444]
      },
      "hospitalName": "Al-Amal Hospital",
      "cancelledAt": "2026-06-07T00:56:18.000Z",
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`GET /hospital/donations`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donations retrieved successfully",
  "data": {
    "donations": [
      {
        "_id": "60d5ec49f0322c2c20e28f70",
        "donorId": {
          "_id": "60d5ec49f0322c2c20e28f36",
          "fullName": "Ziad Abdelghany",
          "email": "ziad@example.com",
          "phoneNumber": "01234567890",
          "location": {
            "city": "Cairo",
            "governorate": "Cairo",
            "coordinates": {
              "lat": 30.0444,
              "lng": 31.2357
            }
          },
          "bloodType": "A+"
        },
        "requestId": {
          "_id": "60d5ec49f0322c2c20e28f60",
          "type": "blood",
          "bloodType": ["O+"],
          "organType": null,
          "urgency": "normal"
        },
        "status": "pending",
        "quantity": 1,
        "createdAt": "2026-06-06T10:00:00.000Z",
        "updatedAt": "2026-06-06T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### Endpoint
`GET /hospital/blood-bank-settings`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Blood bank settings retrieved successfully",
  "data": {
    "bloodBankSettings": {
      "criticalThreshold": {
        "O+": 2,
        "O-": 1
      },
      "lowThreshold": {
        "O+": 4,
        "O-": 2
      },
      "automaticNotifications": true,
      "notificationEmail": "bloodbank@lifelink.com"
    }
  }
}
```

---

### Endpoint
`PUT /hospital/blood-bank-settings`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Blood bank settings updated successfully",
  "data": {
    "bloodBankSettings": {
      "criticalThreshold": {
        "O+": 2,
        "O-": 1
      },
      "lowThreshold": {
        "O+": 4,
        "O-": 2
      },
      "automaticNotifications": true,
      "notificationEmail": "bloodbank@lifelink.com"
    }
  }
}
```

---

### Endpoint
`GET /hospital/notification-preferences`

#### Current Backend Runtime Response
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

---

### Endpoint
`PUT /hospital/notification-preferences`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Notification preferences updated successfully",
  "data": {
    "notificationPreferences": {
      "email": true,
      "push": true,
      "sms": false
    }
  }
}
```

---

### Endpoint
`GET /hospital/reports/monthly`

#### Current Backend Runtime Response
*(Same structure as `GET /hospital/dashboard`)*
```json
{
  "success": true,
  "message": "Monthly report retrieved successfully",
  "data": {
    "month": "2026-06",
    "totalRequests": 10,
    "openRequests": 3,
    "activeRequests": 4,
    "totalCompleted": 5,
    "totalCancelled": 1,
    "emergencyRequests": 4,
    "responseCount": 15,
    "totalResponses": 15,
    "totalDonations": 15,
    "completedDonations": 12,
    "uniqueDonorsResponded": 8,
    "confirmedDonorCount": 6,
    "overdueCount": 0,
    "dueSoonCount": 2,
    "avgDaysToRequiredBy": 3,
    "recentActivityCount": 4,
    "recentCompletedDonationCount": 3
  }
}
```

---

# 2. System Analytics API (`/analytics`)

### Endpoint
`GET /analytics/my-stats`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "data": {
    "donorId": "60d5ec49f0322c2c20e28f36",
    "fullName": "Ziad Abdelghany",
    "email": "ziad@example.com",
    "bloodType": "A+",
    "pointsBalance": 1200,
    "totalDonations": 5,
    "donationsByType": {
      "blood": 4,
      "plasma": 1,
      "platelets": 0
    },
    "lastDonationDate": "2026-04-10T12:00:00.000Z",
    "isSuspended": false,
    "joinDate": "2026-01-15T12:00:00.000Z"
  }
}
```

---

### Endpoint
`GET /analytics/leaderboard`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "data": {
    "period": "Last 30 days",
    "count": 1,
    "leaderboard": [
      {
        "rank": 1,
        "_id": "60d5ec49f0322c2c20e28f36",
        "fullName": "Ziad Abdelghany",
        "email": "ziad@example.com",
        "bloodType": "A+",
        "lastDonationDate": "2026-04-10T12:00:00.000Z",
        "pointsBalance": 1200,
        "lifetimePointsEarned": 1500,
        "tier": "gold"
      }
    ]
  }
}
```

---

### Endpoint
`GET /analytics/donation-types`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "data": {
    "totalDonations": 25,
    "byType": {
      "blood": {
        "count": 18,
        "avgPoints": 200
      },
      "plasma": {
        "count": 5,
        "avgPoints": 150
      },
      "platelets": {
        "count": 2,
        "avgPoints": 175
      }
    }
  }
}
```

---

### Endpoint
`GET /analytics/dashboard`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 150,
      "donors": 120,
      "hospitals": 30
    },
    "requests": {
      "active": 8,
      "critical": 2
    },
    "donations": {
      "pending": 5,
      "completed": 200
    },
    "alerts": {
      "unverifiedUsers": 15,
      "suspendedUsers": 2,
      "criticalRequests": 2
    }
  }
}
```

---

# 3. Appointment Verification API (`/appointments` prefix)

### Endpoint
`POST /appointments/verify-qr`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donation verification started successfully",
  "data": {
    "verificationStatus": "pending",
    "verificationSessionId": "ae892dfd6a89c2f6d89e",
    "appointment": {
      "id": "60d5ec49f0322c2c20e28f50",
      "appointmentDate": "2026-06-15T10:00:00.000Z",
      "status": "pending",
      "donationType": "Whole Blood",
      "qrToken": "qr_token_string",
      "qrScannedAt": "2026-06-07T00:56:18.000Z",
      "qrExpiresAt": "2026-06-15T11:00:00.000Z",
      "requestId": "60d5ec49f0322c2c20e28f39",
      "hospital": {
        "id": "60d5ec49f0322c2c20e28f3a",
        "fullName": "Al-Amal Hospital",
        "hospitalName": "Al-Amal Hospital",
        "contactNumber": "+20123456789",
        "location": {
          "city": "Cairo",
          "governorate": "Cairo",
          "coordinates": {
            "lat": 30.0444,
            "lng": 31.2357
          }
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
      "location": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "lastDonationDate": "2026-04-10T12:00:00.000Z",
      "hemoglobinLevel": 14.5,
      "weight": 75,
      "participation": true
    },
    "eligibility": {
      "eligible": true,
      "reason": null,
      "nextEligibleDate": null
    },
    "checklistRequirements": {
      "idVerified": true,
      "questionnaireCompleted": true,
      "consentSigned": true
    }
  }
}
```

---

### Endpoint
`GET /appointments/:appointmentId`

#### Current Backend Runtime Response
*(Returns the same format as booking responses for hospital/admin, populated with full structures)*
```json
{
  "success": true,
  "message": "Appointment retrieved",
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
    "donorId": {
      "_id": "60d5ec49f0322c2c20e28f36"
    },
    "requestId": {
      "_id": "60d5ec49f0322c2c20e28f39",
      "type": "blood",
      "bloodType": ["A+"],
      "organType": null,
      "urgency": "critical",
      "urgencyLevel": "critical",
      "unitsNeeded": 3,
      "notes": "Accident patient emergency.",
      "hospitalId": "60d5ec49f0322c2c20e28f3a",
      "hospitalName": "Al-Amal Hospital"
    },
    "donationType": "Whole Blood",
    "hospitalId": {
      "_id": "60d5ec49f0322c2c20e28f3a"
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
    "request": {
      "requestId": "60d5ec49f0322c2c20e28f39",
      "id": "60d5ec49f0322c2c20e28f39",
      "urgencyLevel": "critical",
      "unitsNeeded": 3,
      "notes": "Accident patient emergency."
    },
    "hospitalDetails": null,
    "requestDetails": null,
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
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-05T12:00:00.000Z"
  }
}
```

---

### Endpoint
`PATCH /appointments/:appointmentId`

#### Current Backend Runtime Response
*(Returns rescheduled appointment details, matching single details)*
```json
{
  "success": true,
  "message": "Appointment rescheduled",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f50",
    "appointmentId": "60d5ec49f0322c2c20e28f50",
    "appointmentDate": "2026-06-18T14:00:00.000Z",
    "appointmentTime": "02:00 PM",
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
    "donorId": {
      "_id": "60d5ec49f0322c2c20e28f36"
    },
    "requestId": {
      "_id": "60d5ec49f0322c2c20e28f39",
      "type": "blood",
      "bloodType": ["A+"],
      "organType": null,
      "urgency": "critical",
      "urgencyLevel": "critical",
      "unitsNeeded": 3,
      "notes": "Accident patient emergency.",
      "hospitalId": "60d5ec49f0322c2c20e28f3a",
      "hospitalName": "Al-Amal Hospital"
    },
    "donationType": "Whole Blood",
    "hospitalId": {
      "_id": "60d5ec49f0322c2c20e28f3a"
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
    "appointment": {
      "appointmentId": "60d5ec49f0322c2c20e28f50",
      "donationType": "Whole Blood",
      "appointmentDate": "2026-06-18T14:00:00.000Z",
      "appointmentTime": "02:00 PM",
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
    "request": {
      "requestId": "60d5ec49f0322c2c20e28f39",
      "id": "60d5ec49f0322c2c20e28f39",
      "urgencyLevel": "critical",
      "unitsNeeded": 3,
      "notes": "Accident patient emergency."
    },
    "hospitalDetails": null,
    "requestDetails": null,
    "qrToken": "qr_token_string",
    "qrExpiresAt": "2026-06-18T15:00:00.000Z",
    "verificationStatus": "pending",
    "verificationChecklist": {
      "idVerified": false,
      "questionnaireCompleted": false,
      "consentSigned": false,
      "completedAt": null
    },
    "rescheduleCount": 1,
    "rescheduleHistory": [
      {
        "previousDate": "2026-06-15T10:00:00.000Z",
        "rescheduledAt": "2026-06-07T00:56:18.000Z"
      }
    ],
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`POST /appointments/:appointmentId/arrival`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Arrival confirmed successfully",
  "data": {
    "readyForDonation": true,
    "appointment": {
      "verificationStatus": "verified",
      "verificationSessionId": "ae892dfd6a89c2f6d89e",
      "appointment": {
        "id": "60d5ec49f0322c2c20e28f50",
        "appointmentDate": "2026-06-15T10:00:00.000Z",
        "status": "confirmed",
        "donationType": "Whole Blood",
        "qrToken": "qr_token_string",
        "qrScannedAt": "2026-06-07T00:56:18.000Z",
        "qrExpiresAt": "2026-06-15T11:00:00.000Z",
        "requestId": "60d5ec49f0322c2c20e28f39",
        "hospital": {
          "id": "60d5ec49f0322c2c20e28f3a",
          "fullName": "Al-Amal Hospital",
          "hospitalName": "Al-Amal Hospital",
          "contactNumber": "+20123456789",
          "location": {
            "city": "Cairo",
            "governorate": "Cairo",
            "coordinates": {
              "lat": 30.0444,
              "lng": 31.2357
            }
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
        "location": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "lastDonationDate": "2026-04-10T12:00:00.000Z",
        "hemoglobinLevel": 14.5,
        "weight": 75,
        "participation": true
      },
      "eligibility": {
        "eligible": true,
        "reason": "Checklist completed",
        "nextEligibleDate": null
      },
      "checklistRequirements": {
        "idVerified": true,
        "questionnaireCompleted": true,
        "consentSigned": true
      }
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

---

### Endpoint
`POST /appointments/:appointmentId/reject`

#### Current Backend Runtime Response
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

### Endpoint
`POST /appointments/:appointmentId/rescan`

#### Current Backend Runtime Response
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

# 4. Help & Support API (`/help` & `/support`)

### Endpoint
`GET /help/faq`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "FAQ retrieved successfully",
  "data": {
    "faqs": [
      {
        "category": "DONATION",
        "question": "How often can I donate blood?",
        "answer": "Donation intervals depend on type: whole blood every 56 days, plasma every 14 days, and platelets every 7 days."
      },
      {
        "category": "HEALTH",
        "question": "Can I donate if I am feeling unwell?",
        "answer": "No. Please wait until you are fully recovered and meet eligibility requirements."
      },
      {
        "category": "REWARDS",
        "question": "How do points work?",
        "answer": "You earn points from successful donations, emergency responses, profile completion, and badges."
      },
      {
        "category": "TECHNICAL",
        "question": "How do I reset my password?",
        "answer": "Use the password reset option from the login screen."
      }
    ]
  }
}
```

---

### Endpoint
`GET /help/documents/:type`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Document retrieved successfully",
  "data": {
    "document_url": "https://lifelink-assets.s3.amazonaws.com/docs/privacy-policy.pdf",
    "title": "Privacy Policy",
    "version": "1.2.0",
    "updated_at": "2026-05-10T12:00:00.000Z"
  }
}
```

---

### Endpoint
`POST /support/contact`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Support request submitted successfully",
  "data": {
    "ticket": {
      "id": "60d5ec49f0322c2c20e28f95",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "subject": "Missing points for my last donation",
      "category": "REWARDS",
      "message": "I completed my blood donation yesterday but didn't receive any points.",
      "createdAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

# 5. Rewards Management API (`/rewards`)

### Endpoint
`GET /rewards/dashboard`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Rewards dashboard retrieved",
  "data": {
    "points": 1200,
    "nextRewardPoints": 1500,
    "pointsToNextReward": 300,
    "rewards": [
      {
        "id": "60d5ec49f0322c2c20e28f37",
        "title": "Coffee Voucher",
        "pointsRequired": 500,
        "isAvailable": true
      }
    ],
    "history": [
      {
        "id": "60d5ec49f0322c2c20e28f33",
        "type": "BLOOD_DONATION",
        "title": "Blood Donation - Successful",
        "points": 200,
        "createdAt": "2026-06-05T12:00:00.000Z"
      }
    ],
    "badges": {
      "unlocked": 2,
      "total": 7,
      "completion": 28,
      "list": [
        {
          "id": "60d5ec49f0322c2c20e28f34",
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

---

### Endpoint
`GET /rewards/stats`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Rewards stats retrieved",
  "data": {
    "points": 1200,
    "nextReward": {
      "pointsToGo": 300
    },
    "badgesUnlocked": 2,
    "totalBadges": 7,
    "completionPercent": 28
  }
}
```

---

### Endpoint
`GET /rewards/history`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Reward history retrieved successfully",
  "data": {
    "redemptions": [
      {
        "_id": "60d5ec49f0322c2c20e28f35",
        "donorId": "60d5ec49f0322c2c20e28f36",
        "rewardId": {
          "_id": "60d5ec49f0322c2c20e28f37",
          "name": "Coffee Voucher",
          "category": "FOOD",
          "iconType": "coffee"
        },
        "pointsSpent": 500,
        "deliveryMethod": "IN_APP",
        "deliveryContact": null,
        "status": "CONFIRMED",
        "confirmationCode": "ABC123XYZ",
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
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

---

### Endpoint
`GET /rewards/redemptions`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Redemptions retrieved successfully",
  "data": {
    "redemptions": [
      {
        "_id": "60d5ec49f0322c2c20e28f35",
        "donorId": "60d5ec49f0322c2c20e28f36",
        "rewardId": {
          "_id": "60d5ec49f0322c2c20e28f37",
          "name": "Coffee Voucher",
          "category": "FOOD",
          "iconType": "coffee"
        },
        "pointsSpent": 500,
        "deliveryMethod": "IN_APP",
        "deliveryContact": null,
        "status": "CONFIRMED",
        "confirmationCode": "ABC123XYZ",
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
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

---

### Endpoint
`GET /rewards/leaderboard`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Leaderboard retrieved successfully",
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "donorId": "60d5ec49f0322c2c20e28f36",
        "fullName": "Ziad Abdelghany",
        "tier": "gold",
        "lifetimePointsEarned": 1500,
        "pointsBalance": 1000
      }
    ]
  }
}
```

---

### Endpoint
`POST /rewards/admin/users/:userId/points/adjust`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Points adjusted successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f90",
    "donorId": "60d5ec49f0322c2c20e28f36",
    "pointsBalance": 1400,
    "lifetimePointsEarned": 1700,
    "tier": "gold",
    "firstDonationAwarded": true,
    "profileCompletionAwarded": true,
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`PATCH /rewards/admin/catalog/:rewardId/status`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Reward status updated",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f37",
    "name": "Coffee Voucher",
    "description": "Free coffee at partner cafes",
    "pointsCost": 500,
    "category": "FOOD",
    "iconType": "coffee",
    "colorCode": "#8B4513",
    "status": "INACTIVE",
    "redemptionCount": 10,
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`GET /rewards/admin/analytics`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Rewards analytics retrieved",
  "data": {
    "topRewards": [
      {
        "_id": "60d5ec49f0322c2c20e28f37",
        "rewardName": "Coffee Voucher",
        "count": 25,
        "totalPointsSpent": 12500
      }
    ],
    "tierDistribution": [
      {
        "_id": "bronze",
        "count": 120
      },
      {
        "_id": "gold",
        "count": 5
      }
    ],
    "totalPointsIssued": 45000
  }
}
```

---

# 6. Request Actions API (`/requests` prefix)

### Endpoint
`GET /requests/:id/google-maps`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request Google Maps details",
  "data": {
    "requestId": "60d5ec49f0322c2c20e28f60",
    "location": {
      "lat": 30.0444,
      "lng": 31.2357
    }
  }
}
```

---

### Endpoint
`POST /requests/:id/generate-qr`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "QR token generated successfully",
  "data": {
    "qrToken": "qr_token_string",
    "qrImage": "data:image/png;base64,iVBORw0KGgo...",
    "qrCreatedAt": "2026-06-07T00:56:18.000Z",
    "qrExpiresAt": "2026-06-08T00:56:18.000Z",
    "requestId": "60d5ec49f0322c2c20e28f60"
  }
}
```

---

### Endpoint
`POST /requests/verify-qr`

#### Current Backend Runtime Response
*(Same structure as `/appointments/verify-qr`)*
```json
{
  "success": true,
  "message": "Donation verification started successfully",
  "data": {
    "verificationStatus": "pending",
    "verificationSessionId": "ae892dfd6a89c2f6d89e",
    "appointment": {
      "id": "60d5ec49f0322c2c20e28f50",
      "appointmentDate": "2026-06-15T10:00:00.000Z",
      "status": "pending",
      "donationType": "Whole Blood",
      "qrToken": "qr_token_string",
      "qrScannedAt": "2026-06-07T00:56:18.000Z",
      "qrExpiresAt": "2026-06-15T11:00:00.000Z",
      "requestId": "60d5ec49f0322c2c20e28f60",
      "hospital": {
        "id": "60d5ec49f0322c2c20e28f3a",
        "fullName": "Al-Amal Hospital",
        "hospitalName": "Al-Amal Hospital",
        "contactNumber": "+20123456789",
        "location": {
          "city": "Cairo",
          "governorate": "Cairo",
          "coordinates": {
            "lat": 30.0444,
            "lng": 31.2357
          }
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
      "location": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "lastDonationDate": "2026-04-10T12:00:00.000Z",
      "hemoglobinLevel": 14.5,
      "weight": 75,
      "participation": true
    },
    "eligibility": {
      "eligible": true,
      "reason": null,
      "nextEligibleDate": null
    },
    "checklistRequirements": {
      "idVerified": true,
      "questionnaireCompleted": true,
      "consentSigned": true
    }
  }
}
```

---

### Endpoint
`POST /requests/:id/accept`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request accepted successfully",
  "data": {
    "request": {
      "_id": "60d5ec49f0322c2c20e28f60",
      "hospitalId": "60d5ec49f0322c2c20e28f3a",
      "type": "blood",
      "status": "accepted",
      "urgency": "normal",
      "requiredBy": "2026-06-10T12:00:00.000Z",
      "quantity": 2,
      "unitsNeeded": 2,
      "patientType": "Cancer Patient",
      "isEmergency": false,
      "notes": "Chemotherapy support",
      "bloodType": ["O+"],
      "locationHospital": {
        "latitude": 30.0444,
        "longitude": 31.2357
      },
      "hospitalLocation": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "hospitalLocationGeo": {
        "type": "Point",
        "coordinates": [31.2357, 30.0444]
      },
      "hospitalName": "Al-Amal Hospital",
      "acceptedBy": "60d5ec49f0322c2c20e28f36",
      "acceptedByName": "Ziad Abdelghany",
      "acceptedByPhoneNumber": "01234567890",
      "acceptedByBloodType": "A+",
      "acceptedAt": "2026-06-07T00:56:18.000Z",
      "acceptedDonationId": "60d5ec49f0322c2c20e28fb0",
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    },
    "donor": {
      "_id": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "phoneNumber": "01234567890",
      "bloodType": "A+"
    },
    "donation": {
      "_id": "60d5ec49f0322c2c20e28fb0",
      "donorId": "60d5ec49f0322c2c20e28f36",
      "requestId": "60d5ec49f0322c2c20e28f60",
      "status": "scheduled",
      "quantity": 1,
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`POST /requests/:id/reject`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request rejected successfully",
  "data": {
    "request": {
      "_id": "60d5ec49f0322c2c20e28f60",
      "hospitalId": "60d5ec49f0322c2c20e28f3a",
      "type": "blood",
      "status": "pending",
      "urgency": "normal",
      "requiredBy": "2026-06-10T12:00:00.000Z",
      "quantity": 2,
      "unitsNeeded": 2,
      "patientType": "Cancer Patient",
      "isEmergency": false,
      "notes": "Chemotherapy support",
      "bloodType": ["O+"],
      "locationHospital": {
        "latitude": 30.0444,
        "longitude": 31.2357
      },
      "hospitalLocation": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "hospitalLocationGeo": {
        "type": "Point",
        "coordinates": [31.2357, 30.0444]
      },
      "hospitalName": "Al-Amal Hospital",
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    },
    "donation": {
      "_id": "60d5ec49f0322c2c20e28fb0",
      "donorId": "60d5ec49f0322c2c20e28f36",
      "requestId": "60d5ec49f0322c2c20e28f60",
      "status": "rejected",
      "quantity": 1,
      "notes": "Rejected by hospital",
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

# 7. Appointment Booking API (`/donations/book-appointment/:id` prefix)

### Endpoint
`GET /donations/book-appointment/:appointmentId`

#### Current Backend Runtime Response
*(Same structure as `/appointments/:appointmentId` for donors, maps to getAppointmentById)*
```json
{
  "success": true,
  "message": "Appointment retrieved",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f50",
    "appointmentId": "60d5ec49f0322c2c20e28f50",
    "appointmentDate": "2026-06-15T10:00:00.000Z",
    "appointmentTime": "10:00 AM",
    "status": "pending",
    "donationType": "Whole Blood",
    "hospitalId": {
      "_id": "60d5ec49f0322c2c20e28f3a",
      "hospitalName": "Al-Amal Hospital",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo",
        "street": "123 Nile Street"
      }
    },
    "hospital": {
      "hospitalId": "HOSP123",
      "id": "60d5ec49f0322c2c20e28f3a",
      "name": "Al-Amal Hospital",
      "hospitalName": "Al-Amal Hospital"
    },
    "appointment": {
      "appointmentId": "60d5ec49f0322c2c20e28f50",
      "donationType": "Whole Blood",
      "appointmentDate": "2026-06-15T10:00:00.000Z",
      "appointmentTime": "10:00 AM",
      "status": "pending",
      "hospitalId": "HOSP123",
      "hospitalName": "Al-Amal Hospital"
    }
  }
}
```

---

### Endpoint
`PATCH /donations/book-appointment/:appointmentId`

#### Current Backend Runtime Response
*(Same structure as `/appointments/:appointmentId` for donors, maps to rescheduleAppointment)*
```json
{
  "success": true,
  "message": "Appointment rescheduled",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f50",
    "appointmentId": "60d5ec49f0322c2c20e28f50",
    "appointmentDate": "2026-06-18T14:00:00.000Z",
    "appointmentTime": "02:00 PM",
    "status": "pending",
    "donationType": "Whole Blood",
    "hospitalId": {
      "_id": "60d5ec49f0322c2c20e28f3a",
      "hospitalName": "Al-Amal Hospital",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo",
        "street": "123 Nile Street"
      }
    },
    "hospital": {
      "hospitalId": "HOSP123",
      "id": "60d5ec49f0322c2c20e28f3a",
      "name": "Al-Amal Hospital",
      "hospitalName": "Al-Amal Hospital"
    },
    "appointment": {
      "appointmentId": "60d5ec49f0322c2c20e28f50",
      "donationType": "Whole Blood",
      "appointmentDate": "2026-06-18T14:00:00.000Z",
      "appointmentTime": "02:00 PM",
      "status": "pending",
      "hospitalId": "HOSP123",
      "hospitalName": "Al-Amal Hospital"
    }
  }
}
```

---

# 8. User Auth API (`/auth`)

### Endpoint
`POST /auth/hospital/login`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "60d5ec49f0322c2c20e28f3a",
      "fullName": "Al-Amal Hospital",
      "email": "hospital@lifelink.com",
      "role": "hospital",
      "isEmailVerified": true
    },
    "hospitalId": "HOSP123",
    "verified": true,
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_id": "60d5ec49f0322c2c20e28f3a",
    "user_role": "hospital",
    "user_name": "Al-Amal Hospital"
  }
}
```

---

### Endpoint
`PUT /auth/fcm-token`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "FCM token updated successfully",
  "data": {
    "fcmToken": "fcm_token_device_string_123",
    "tokenCount": 1
  }
}
```

---

### Endpoint
`DELETE /auth/fcm-token`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "FCM token removed successfully",
  "data": {
    "fcmToken": "fcm_token_device_string_123"
  }
}
```

---

# 9. Donation Validation API (`/donations`)

### Endpoint
`GET /donations/types`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donation types retrieved successfully",
  "data": [
    "Whole Blood",
    "Plasma",
    "Platelets",
    "Double Red Cells"
  ]
}
```

---

### Endpoint
`POST /donations/validate`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donation eligibility checked",
  "data": {
    "canDonate": true,
    "reason": null
  }
}
```

---

### Endpoint
`POST /donations/complete`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donation completed successfully",
  "data": {
    "donation": {
      "_id": "60d5ec49f0322c2c20e28fb0",
      "donorId": "60d5ec49f0322c2c20e28f36",
      "appointmentId": "60d5ec49f0322c2c20e28f50",
      "requestId": "60d5ec49f0322c2c20e28f60",
      "status": "completed",
      "quantity": 1,
      "unitsCollected": 1,
      "hemoglobinLevel": 14.5,
      "weight": 75,
      "completedDate": "2026-06-07T00:56:18.000Z",
      "notes": "Successful donation, no complications.",
      "verifiedAt": null,
      "qrToken": "qr_token_string",
      "qrExpires": "2026-06-08T00:56:18.000Z",
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    },
    "appointment": {
      "id": "60d5ec49f0322c2c20e28f50",
      "status": "completed",
      "verificationStatus": "verified",
      "donationType": "Whole Blood"
    },
    "pointsEarned": 200
  }
}
```

---

# 10. Donor Actions API (`/donor` prefix)

### Endpoint
`GET /donor/rewards`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donor rewards retrieved",
  "data": {
    "currentPoints": 1200,
    "earnedBadges": [
      {
        "id": "60d5ec49f0322c2c20e28f34",
        "title": "First Timer",
        "description": "Completed your first blood donation"
      }
    ],
    "lockedBadges": [
      {
        "id": "60d5ec49f0322c2c20e28f38",
        "title": "Regular Donor",
        "progress": 1,
        "target": 5
      }
    ],
    "nextMilestone": 300
  }
}
```

---

### Endpoint
`GET /donor/requests`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Requests retrieved successfully",
  "data": {
    "requests": [
      {
        "id": "60d5ec49f0322c2c20e28f60",
        "requestId": "60d5ec49f0322c2c20e28f60",
        "bloodType": ["O+"],
        "bloodTypeLabel": "O+",
        "hospitalName": "Al-Amal Hospital",
        "patientType": "Cancer Patient",
        "contactNumber": "+20123456789",
        "unitsNeeded": 2,
        "isEmergency": false,
        "createdAt": "2026-06-05T12:00:00.000Z",
        "status": "pending",
        "urgency": "normal",
        "type": "blood",
        "requiredBy": "2026-06-10T12:00:00.000Z",
        "location": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "qrToken": null,
        "qrCreatedAt": null,
        "qrExpiresAt": null,
        "hospital": {
          "id": "60d5ec49f0322c2c20e28f3a",
          "name": "Al-Amal Hospital",
          "contactNumber": "+20123456789",
          "address": {
            "city": "Cairo",
            "governorate": "Cairo",
            "street": "123 Nile Street"
          }
        },
        "score": 90,
        "locationScore": 95,
        "compatibility": {
          "bloodTypeCompatible": true,
          "distanceEligible": true,
          "cooldownEligible": true
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### Endpoint
`GET /donor/matches`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Matching requests retrieved successfully",
  "data": {
    "matches": [
      {
        "request": {
          "_id": "60d5ec49f0322c2c20e28f60",
          "hospitalId": "60d5ec49f0322c2c20e28f3a",
          "hospitalContact": "+20123456789",
          "contactNumber": "+20123456789",
          "type": "blood",
          "urgency": "normal",
          "requiredBy": "2026-06-10T12:00:00.000Z",
          "quantity": 2,
          "unitsNeeded": 2,
          "patientType": "Cancer Patient",
          "isEmergency": false,
          "notes": "Chemotherapy support",
          "bloodType": ["O+"],
          "locationHospital": {
            "latitude": 30.0444,
            "longitude": 31.2357
          },
          "hospitalLocation": {
            "lat": 30.0444,
            "lng": 31.2357
          },
          "hospitalLocationGeo": {
            "type": "Point",
            "coordinates": [31.2357, 30.0444]
          },
          "hospitalName": "Al-Amal Hospital",
          "status": "pending",
          "createdAt": "2026-06-05T12:00:00.000Z",
          "updatedAt": "2026-06-05T12:00:00.000Z"
        },
        "score": 90,
        "locationScore": 95,
        "compatibility": {
          "bloodTypeCompatible": true,
          "distanceEligible": true,
          "cooldownEligible": true
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### Endpoint
`GET /donor/dashboard`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donor dashboard retrieved successfully",
  "data": {
    "userInfo": {
      "firstName": "Ziad",
      "fullName": "Ziad Abdelghany",
      "bloodType": "A+",
      "donationStatus": "eligible"
    },
    "stats": {
      "totalDonations": 5,
      "points": 1200,
      "livesSaved": 15
    },
    "recentActivity": [
      {
        "id": "60d5ec49f0322c2c20e28fb0",
        "title": "Donation Completed",
        "hospital": "Al-Amal Hospital",
        "points": 200,
        "createdAt": "2026-06-07T00:56:18.000Z",
        "relativeTime": "just now",
        "type": "donation",
        "status": "success",
        "icon": null
      }
    ],
    "badges": {
      "unlockedCount": 2,
      "totalCount": 7,
      "completionPercentage": 28,
      "badges": [
        {
          "badgeId": "60d5ec49f0322c2c20e28f34",
          "badgeName": "First Timer",
          "badgeDescription": "Completed your first blood donation",
          "badgeIcon": "heart",
          "category": "DONATION",
          "rarity": "COMMON",
          "unlockStatus": "UNLOCKED",
          "unlockedAt": "2026-01-20T12:00:00.000Z",
          "progressCurrent": 1,
          "progressTarget": 1,
          "progressPercentage": 100
        }
      ],
      "stats": {
        "totalDonations": 5,
        "totalEmergencyResponses": 0,
        "daysAsDonor": 138
      }
    }
  }
}
```

---

### Endpoint
`GET /donor/recent-activity`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Recent activity retrieved successfully",
  "data": {
    "donations": {
      "donations": [
        {
          "_id": "60d5ec49f0322c2c20e28fb0",
          "donorId": "60d5ec49f0322c2c20e28f36",
          "requestId": {
            "_id": "60d5ec49f0322c2c20e28f60",
            "type": "blood",
            "bloodType": ["O+"],
            "organType": null,
            "urgency": "normal",
            "hospitalId": {
              "_id": "60d5ec49f0322c2c20e28f3a",
              "fullName": "Al-Amal Hospital",
              "hospitalName": "Al-Amal Hospital",
              "address": {
                "city": "Cairo",
                "governorate": "Cairo",
                "street": "123 Nile Street"
              }
            }
          },
          "status": "completed",
          "quantity": 1,
          "createdAt": "2026-06-07T00:56:18.000Z",
          "updatedAt": "2026-06-07T00:56:18.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
      }
    },
    "points": {
      "transactions": [
        {
          "_id": "60d5ec49f0322c2c20e28f92",
          "donorId": "60d5ec49f0322c2c20e28f36",
          "pointsAmount": 200,
          "transactionType": "BLOOD_DONATION",
          "description": "Blood Donation - Successful",
          "referenceId": "donation_60d5ec49f0322c2c20e28fb0",
          "balanceAfter": 1200,
          "createdAt": "2026-06-07T00:56:18.000Z",
          "updatedAt": "2026-06-07T00:56:18.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
      }
    }
  }
}
```

---

### Endpoint
`GET /donor/donations`

#### Current Backend Runtime Response
*(Same structure as the nested `donations` in `/donor/recent-activity`)*
```json
{
  "success": true,
  "message": "Donation history retrieved successfully",
  "data": {
    "donations": [
      {
        "_id": "60d5ec49f0322c2c20e28fb0",
        "donorId": "60d5ec49f0322c2c20e28f36",
        "requestId": {
          "_id": "60d5ec49f0322c2c20e28f60",
          "type": "blood",
          "bloodType": ["O+"],
          "organType": null,
          "urgency": "normal",
          "hospitalId": {
            "_id": "60d5ec49f0322c2c20e28f3a",
            "fullName": "Al-Amal Hospital",
            "hospitalName": "Al-Amal Hospital",
            "address": {
              "city": "Cairo",
              "governorate": "Cairo",
              "street": "123 Nile Street"
            }
          }
        },
        "status": "completed",
        "quantity": 1,
        "createdAt": "2026-06-07T00:56:18.000Z",
        "updatedAt": "2026-06-07T00:56:18.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### Endpoint
`GET /donor/points`

#### Current Backend Runtime Response
*(Same structure as `/rewards/points`)*
```json
{
  "success": true,
  "message": "Points retrieved successfully",
  "data": {
    "pointsBalance": 1200,
    "lifetimePointsEarned": 1500,
    "currentTier": "gold",
    "nextTier": "platinum",
    "pointsToNextTier": 500,
    "progressPercentage": 60,
    "tierBenefits": {
      "bronze": ["Access to basic rewards"],
      "silver": ["10% more points per donation", "Early access to limited rewards"],
      "gold": ["15% more points per donation", "Exclusive gold rewards"],
      "platinum": ["20% more points per donation", "VIP support", "All exclusive rewards"]
    }
  }
}
```

---

### Endpoint
`GET /donor/badges`

#### Current Backend Runtime Response
*(Same structure as `/rewards/badges`)*
```json
{
  "success": true,
  "message": "Badges retrieved successfully",
  "data": {
    "unlockedCount": 2,
    "totalCount": 7,
    "completionPercentage": 28,
    "badges": [
      {
        "badgeId": "60d5ec49f0322c2c20e28f34",
        "badgeName": "First Timer",
        "badgeDescription": "Completed your first blood donation",
        "badgeIcon": "heart",
        "category": "DONATION",
        "rarity": "COMMON",
        "unlockStatus": "UNLOCKED",
        "unlockedAt": "2026-01-20T12:00:00.000Z",
        "progressCurrent": 1,
        "progressTarget": 1,
        "progressPercentage": 100
      }
    ],
    "stats": {
      "totalDonations": 5,
      "totalEmergencyResponses": 0,
      "daysAsDonor": 138
    }
  }
}
```

---

### Endpoint
`GET /donor/redemptions`

#### Current Backend Runtime Response
*(Same structure as `/rewards/redemptions`)*
```json
{
  "success": true,
  "message": "Redemptions retrieved successfully",
  "data": {
    "redemptions": [
      {
        "_id": "60d5ec49f0322c2c20e28f35",
        "donorId": "60d5ec49f0322c2c20e28f36",
        "rewardId": {
          "_id": "60d5ec49f0322c2c20e28f37",
          "name": "Coffee Voucher",
          "category": "FOOD",
          "iconType": "coffee"
        },
        "pointsSpent": 500,
        "deliveryMethod": "IN_APP",
        "deliveryContact": null,
        "status": "CONFIRMED",
        "confirmationCode": "ABC123XYZ",
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
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

---

### Endpoint
`GET /donor/notifications`

#### Current Backend Runtime Response
*(Same structure as `/notifications` for standard donor)*
```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "_id": "60d5ec49f0322c2c20e28fb5",
        "userId": "60d5ec49f0322c2c20e28f36",
        "type": "system",
        "title": "🎉 Tier Upgraded to Gold!",
        "message": "Congratulations! You've reached gold tier.",
        "read": false,
        "data": null,
        "createdAt": "2026-06-07T00:56:18.000Z"
      }
    ],
    "unreadCount": 1,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### Endpoint
`PUT /donor/participation`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Participation preference updated successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f36",
    "fullName": "Ziad Abdelghany",
    "email": "ziad@example.com",
    "role": "donor",
    "isEmailVerified": true,
    "emailVerifiedAt": "2026-06-05T12:00:00.000Z",
    "isSuspended": false,
    "suspendedAt": null,
    "suspendedReason": null,
    "deletedAt": null,
    "location": {
      "city": "Cairo",
      "governorate": "Cairo",
      "coordinates": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "lastUpdated": "2026-06-05T12:00:00.000Z"
    },
    "fcmTokens": ["fcm_token_2"],
    "phoneNumber": "01234567890",
    "bloodType": "A+",
    "dateOfBirth": "1995-04-15T00:00:00.000Z",
    "gender": "male",
    "lastDonationDate": "2026-04-10T12:00:00.000Z",
    "weight": 75,
    "hemoglobinLevel": 14.5,
    "travelHistory": [],
    "temporaryDeferralUntil": null,
    "lastDeferralReason": null,
    "healthHistory": {
      "chronicConditions": [],
      "medications": [],
      "allergies": [],
      "recentIllness": "",
      "notes": "",
      "lastCheckupDate": null,
      "updatedAt": null
    },
    "isOptedIn": false,
    "settings": {
      "pushNotifications": true,
      "emergencyAlerts": true,
      "privacyMode": false,
      "language": "en"
    },
    "isBanned": false,
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`PUT /donor/availability`

#### Current Backend Runtime Response
*(Deprecated alias of `PUT /donor/participation`. Triggers Warning header on response)*
```json
{
  "success": true,
  "message": "Participation preference updated successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f36",
    "fullName": "Ziad Abdelghany",
    "email": "ziad@example.com",
    "role": "donor",
    "isEmailVerified": true,
    "emailVerifiedAt": "2026-06-05T12:00:00.000Z",
    "isSuspended": false,
    "suspendedAt": null,
    "suspendedReason": null,
    "deletedAt": null,
    "location": {
      "city": "Cairo",
      "governorate": "Cairo",
      "coordinates": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "lastUpdated": "2026-06-05T12:00:00.000Z"
    },
    "fcmTokens": ["fcm_token_2"],
    "phoneNumber": "01234567890",
    "bloodType": "A+",
    "dateOfBirth": "1995-04-15T00:00:00.000Z",
    "gender": "male",
    "lastDonationDate": "2026-04-10T12:00:00.000Z",
    "weight": 75,
    "hemoglobinLevel": 14.5,
    "travelHistory": [],
    "temporaryDeferralUntil": null,
    "lastDeferralReason": null,
    "healthHistory": {
      "chronicConditions": [],
      "medications": [],
      "allergies": [],
      "recentIllness": "",
      "notes": "",
      "lastCheckupDate": null,
      "updatedAt": null
    },
    "isOptedIn": false,
    "settings": {
      "pushNotifications": true,
      "emergencyAlerts": true,
      "privacyMode": false,
      "language": "en"
    },
    "isBanned": false,
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

# 11. Notification Management API (`/notifications`)

### Endpoint
`GET /notifications/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Notification retrieved successfully",
  "data": {
    "notification": {
      "_id": "60d5ec49f0322c2c20e28fb5",
      "userId": "60d5ec49f0322c2c20e28f36",
      "type": "system",
      "title": "🎉 Tier Upgraded to Gold!",
      "message": "Congratulations! You've reached gold tier.",
      "read": false,
      "relatedId": null,
      "relatedType": null,
      "data": null,
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`PATCH /notifications/:id/read`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "notification": {
      "_id": "60d5ec49f0322c2c20e28fb5",
      "userId": "60d5ec49f0322c2c20e28f36",
      "type": "system",
      "title": "🎉 Tier Upgraded to Gold!",
      "message": "Congratulations! You've reached gold tier.",
      "read": true,
      "relatedId": null,
      "relatedType": null,
      "data": null,
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`DELETE /notifications/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

---

# 12. Discovery API (`/hospitals` prefix)

### Endpoint
`GET /hospitals`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Hospitals retrieved successfully",
  "data": {
    "hospitals": [
      {
        "hospitalId": "60d5ec49f0322c2c20e28f3a",
        "hospital_id": "60d5ec49f0322c2c20e28f3a",
        "name": "Al-Amal Hospital",
        "fullName": "Al-Amal Hospital",
        "phoneNumber": "+20123456789",
        "contactNumber": "+20123456789",
        "email": "hospital@lifelink.com",
        "address": {
          "city": "Cairo",
          "governorate": "Cairo",
          "street": "123 Nile Street"
        },
        "location": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "lat": 30.0444,
        "lng": 31.2357,
        "long": 31.2357,
        "hospitalType": "General Hospital",
        "workingHours": "9AM - 5PM",
        "bloodTypes": ["O+", "O-", "A+", "A-"],
        "isAvailable": true,
        "urgentNeedsCount": 0,
        "appointmentSchedulingEnabled": true,
        "hospitalActive": true,
        "hospitalVerified": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### Endpoint
`GET /hospitals/map`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Hospitals retrieved successfully for map",
  "data": {
    "hospitals": [
      {
        "id": "60d5ec49f0322c2c20e28f3a",
        "name": "Al-Amal Hospital",
        "lat": 30.0444,
        "long": 31.2357
      }
    ]
  }
}
```

---

### Endpoint
`GET /hospitals/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Hospital retrieved successfully",
  "data": {
    "hospital": {
      "hospitalId": "60d5ec49f0322c2c20e28f3a",
      "hospital_id": "60d5ec49f0322c2c20e28f3a",
      "name": "Al-Amal Hospital",
      "fullName": "Al-Amal Hospital",
      "phoneNumber": "+20123456789",
      "contactNumber": "+20123456789",
      "email": "hospital@lifelink.com",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo",
        "street": "123 Nile Street"
      },
      "location": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "lat": 30.0444,
      "lng": 31.2357,
      "long": 31.2357,
      "hospitalType": "General Hospital",
      "workingHours": "9AM - 5PM",
      "bloodTypes": ["O+", "O-", "A+", "A-"],
      "isAvailable": true,
      "urgentNeedsCount": 0,
      "appointmentSchedulingEnabled": true,
      "hospitalActive": true,
      "hospitalVerified": true,
      "distanceKm": 5.2,
      "distanceMeters": 5200,
      "distance": "5.20 km"
    }
  }
}
```

---

# 13. Root Status & Aliases API (Root route)

### Endpoint
`GET /`

#### Current Backend Runtime Response
```json
{
  "app": "LifeLink",
  "status": "ok"
}
```

---

### Endpoint
`GET /health`

#### Current Backend Runtime Response
```json
{
  "app": "LifeLink",
  "status": "ok",
  "pid": 5892,
  "startedAt": "2026-06-07T00:00:00.000Z",
  "port": 5000,
  "env": "development",
  "db": {
    "ok": true,
    "state": "connected"
  }
}
```

---

### Endpoint
`GET /dashboard`

#### Current Backend Runtime Response
*(Donor dashboard alias. Same format as `/donor/dashboard`)*
```json
{
  "success": true,
  "message": "Donor dashboard retrieved successfully",
  "data": {
    "userInfo": {
      "firstName": "Ziad",
      "fullName": "Ziad Abdelghany",
      "bloodType": "A+",
      "donationStatus": "eligible"
    },
    "stats": {
      "totalDonations": 5,
      "points": 1200,
      "livesSaved": 15
    },
    "recentActivity": [
      {
        "id": "60d5ec49f0322c2c20e28fb0",
        "title": "Donation Completed",
        "hospital": "Al-Amal Hospital",
        "points": 200,
        "createdAt": "2026-06-07T00:56:18.000Z",
        "relativeTime": "just now",
        "type": "donation",
        "status": "success",
        "icon": null
      }
    ],
    "badges": {
      "unlockedCount": 2,
      "totalCount": 7,
      "completionPercentage": 28,
      "badges": [
        {
          "badgeId": "60d5ec49f0322c2c20e28f34",
          "badgeName": "First Timer",
          "badgeDescription": "Completed your first blood donation",
          "badgeIcon": "heart",
          "category": "DONATION",
          "rarity": "COMMON",
          "unlockStatus": "UNLOCKED",
          "unlockedAt": "2026-01-20T12:00:00.000Z",
          "progressCurrent": 1,
          "progressTarget": 1,
          "progressPercentage": 100
        }
      ],
      "stats": {
        "totalDonations": 5,
        "totalEmergencyResponses": 0,
        "daysAsDonor": 138
      }
    }
  }
}
```

---

### Endpoint
`GET /activity`

#### Current Backend Runtime Response
*(Donor activity timeline alias. Same format as `/donor/activity`)*
```json
{
  "success": true,
  "message": "Activity timeline retrieved successfully",
  "data": {
    "activities": [
      {
        "id": "60d5ec49f0322c2c20e28fb0",
        "title": "Donation Completed",
        "hospital": "Al-Amal Hospital",
        "points": 200,
        "createdAt": "2026-06-07T00:56:18.000Z",
        "relativeTime": "just now",
        "type": "donation",
        "status": "success",
        "icon": null
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

---

### Endpoint
`GET /badges`

#### Current Backend Runtime Response
*(Donor badges list alias. Same format as `/rewards/badges`)*
```json
{
  "success": true,
  "message": "Badges retrieved successfully",
  "data": {
    "unlockedCount": 2,
    "totalCount": 7,
    "completionPercentage": 28,
    "badges": [
      {
        "badgeId": "60d5ec49f0322c2c20e28f34",
        "badgeName": "First Timer",
        "badgeDescription": "Completed your first blood donation",
        "badgeIcon": "heart",
        "category": "DONATION",
        "rarity": "COMMON",
        "unlockStatus": "UNLOCKED",
        "unlockedAt": "2026-01-20T12:00:00.000Z",
        "progressCurrent": 1,
        "progressTarget": 1,
        "progressPercentage": 100
      }
    ],
    "stats": {
      "totalDonations": 5,
      "totalEmergencyResponses": 0,
      "daysAsDonor": 138
    }
  }
}
```

---

# 14. Webhooks API (`/api/webhooks`)

### Endpoint
`POST /api/webhooks/resend`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Webhook received",
  "data": {
    "received": true
  }
}
```

---

# 15. Admin Management API (`/admin`)

### Endpoint
`GET /admin/profile`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Admin profile",
  "data": {
    "admin": {
      "_id": "60d5ec49f0322c2c20e28f32",
      "fullName": "System Admin",
      "email": "admin@lifelink.com",
      "role": "admin",
      "phone": "+201234567890",
      "address": "123 Main St, Cairo",
      "isEmailVerified": true,
      "isSuspended": false,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-05T12:00:00.000Z"
    }
  }
}
```

---

### Endpoint
`GET /admin/system/health`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "System health",
  "data": {
    "status": "healthy",
    "uptime": 1234.56,
    "database": "connected",
    "memory": {
      "used": "56 MB",
      "total": "92 MB"
    },
    "timestamp": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`POST /admin/system/maintenance`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Maintenance mode updated",
  "data": {
    "maintenanceMode": true,
    "message": "System is undergoing scheduled maintenance."
  }
}
```

---

### Endpoint
`GET /admin/system/maintenance`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Maintenance status",
  "data": {
    "enabled": false,
    "message": ""
  }
}
```

---

### Endpoint
`GET /admin/statistics`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Statistics summary",
  "data": {
    "users": {
      "total": 150,
      "donors": 120,
      "hospitals": 30
    },
    "requests": {
      "active": 8,
      "critical": 2
    },
    "donations": {
      "pending": 5,
      "completed": 200
    },
    "alerts": {
      "unverifiedUsers": 15,
      "suspendedUsers": 2,
      "criticalRequests": 2
    }
  }
}
```

---

### Endpoint
`GET /admin/dashboard`

#### Current Backend Runtime Response
*(Same structure as statistics)*
```json
{
  "success": true,
  "message": "Dashboard summary",
  "data": {
    "users": {
      "total": 150,
      "donors": 120,
      "hospitals": 30
    },
    "requests": {
      "active": 8,
      "critical": 2
    },
    "donations": {
      "pending": 5,
      "completed": 200
    },
    "alerts": {
      "unverifiedUsers": 15,
      "suspendedUsers": 2,
      "criticalRequests": 2
    }
  }
}
```

---

### Endpoint
`GET /admin/alerts`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Alerts retrieved successfully",
  "data": {
    "alerts": {
      "unverifiedUsers": 15,
      "suspendedUsers": 2,
      "criticalRequests": [
        {
          "_id": "60d5ec49f0322c2c20e28f65",
          "hospitalId": {
            "_id": "60d5ec49f0322c2c20e28f3a",
            "fullName": "Al-Amal Hospital",
            "hospitalName": "Al-Amal Hospital",
            "location": {
              "city": "Cairo",
              "governorate": "Cairo",
              "coordinates": {
                "lat": 30.0444,
                "lng": 31.2357
              }
            },
            "contactNumber": "+20123456789"
          },
          "hospitalContact": "+20123456789",
          "contactNumber": "+20123456789",
          "type": "blood",
          "urgency": "critical",
          "requiredBy": "2026-06-08T00:56:18.000Z",
          "quantity": 5,
          "unitsNeeded": 5,
          "patientType": "Major Accident ICU",
          "isEmergency": true,
          "notes": "Major Accident ICU",
          "bloodType": ["O-", "O+"],
          "locationHospital": {
            "latitude": 30.0444,
            "longitude": 31.2357
          },
          "hospitalLocation": {
            "lat": 30.0444,
            "lng": 31.2357
          },
          "hospitalLocationGeo": {
            "type": "Point",
            "coordinates": [31.2357, 30.0444]
          },
          "hospitalName": "Al-Amal Hospital",
          "status": "pending",
          "createdAt": "2026-06-05T12:00:00.000Z",
          "updatedAt": "2026-06-05T12:00:00.000Z"
        }
      ],
      "shortageAlerts": [
        {
          "bloodType": "O-",
          "activeRequests": 2,
          "availableDonors": 0,
          "ratio": "critical",
          "status": "critical"
        }
      ]
    }
  }
}
```

---

### Endpoint
`GET /admin/blood-inventory-summary`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Blood inventory summary",
  "data": {
    "scope": "system",
    "hospitalId": null,
    "bloodTypeTotals": {
      "A+": {
        "bloodType": "A+",
        "donatedUnits": 12,
        "requestedUnits": 4,
        "netUnits": 8,
        "shortageUnits": 0,
        "shortage": false,
        "lowStock": false
      }
    },
    "lowStockAlerts": [
      {
        "bloodType": "O-",
        "message": "Shortage detected for O-: 2 unit(s) needed",
        "severity": "high"
      }
    ],
    "shortageAlerts": [
      {
        "bloodType": "O-",
        "activeRequests": 2,
        "availableDonors": 0,
        "ratio": "critical",
        "status": "critical"
      }
    ],
    "requestStats": {
      "total": 10,
      "byStatus": {
        "pending": 3,
        "in-progress": 1,
        "completed": 5,
        "cancelled": 1
      },
      "byUrgency": {
        "critical": 2,
        "normal": 2
      },
      "byBloodType": {
        "A+": 1,
        "O-": 2
      }
    }
  }
}
```

---

### Endpoint
`GET /admin/rewards/config`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Rewards config retrieved successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f10",
    "points": {
      "bloodDonation": 200,
      "plasmaDonation": 150,
      "plateletsDonation": 175,
      "doubleRedCellsDonation": 175,
      "firstDonation": 100,
      "emergencyResponse": 50,
      "profileCompletion": 50,
      "referral": 100
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
    },
    "updatedBy": "60d5ec49f0322c2c20e28f32",
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-05T12:00:00.000Z"
  }
}
```

---

### Endpoint
`PUT /admin/rewards/config`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Rewards config updated successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28f10",
    "points": {
      "bloodDonation": 250,
      "plasmaDonation": 150,
      "plateletsDonation": 175,
      "doubleRedCellsDonation": 175,
      "firstDonation": 100,
      "emergencyResponse": 50,
      "profileCompletion": 50,
      "referral": 100
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
    },
    "updatedBy": "60d5ec49f0322c2c20e28f32",
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`GET /admin/badges`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Badges retrieved successfully",
  "data": {
    "badges": [
      {
        "_id": "60d5ec49f0322c2c20e28f34",
        "badgeName": "First Timer",
        "badgeDescription": "Completed your first blood donation",
        "badgeIcon": "heart",
        "category": "DONATION",
        "rarity": "COMMON",
        "unlockCondition": "completedDonations",
        "unlockThreshold": 1,
        "pointsReward": 0,
        "sortOrder": 1,
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
      }
    ]
  }
}
```

---

### Endpoint
`PATCH /admin/badges/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Badge updated successfully",
  "data": {
    "badge": {
      "_id": "60d5ec49f0322c2c20e28f34",
      "badgeName": "First Timer",
      "badgeDescription": "Completed your first blood donation",
      "badgeIcon": "heart",
      "category": "DONATION",
      "rarity": "COMMON",
      "unlockCondition": "completedDonations",
      "unlockThreshold": 1,
      "pointsReward": 50,
      "sortOrder": 1,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`GET /admin/audit-logs`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Audit logs",
  "data": {
    "logs": [
      {
        "_id": "60d5ec49f0322c2c20e28fa1",
        "adminId": {
          "_id": "60d5ec49f0322c2c20e28f32",
          "fullName": "System Admin",
          "email": "admin@lifelink.com",
          "role": "admin"
        },
        "action": "user.verify",
        "targetType": "User",
        "targetId": "60d5ec49f0322c2c20e28f36",
        "createdAt": "2026-06-07T00:56:18.000Z",
        "updatedAt": "2026-06-07T00:56:18.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

### Endpoint
`GET /admin/inbound-emails`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Inbound emails retrieved successfully",
  "data": {
    "inboundEmails": [
      {
        "_id": "60d5ec49f0322c2c20e28fb1",
        "provider": "resend",
        "providerEventId": "evt_123",
        "messageId": "msg_456",
        "from": "sender@gmail.com",
        "to": ["inbound@lifelink.com"],
        "cc": [],
        "bcc": [],
        "subject": "Inquiry about donation settings",
        "text": "Hello, I wanted to ask...",
        "html": "<p>Hello, I wanted to ask...</p>",
        "headers": {},
        "attachments": [],
        "receivedAt": "2026-06-07T00:56:18.000Z",
        "read": false,
        "readAt": null,
        "archived": false,
        "archivedAt": null,
        "isRead": false,
        "isArchived": false,
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

### Endpoint
`GET /admin/inbound-emails/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Inbound email retrieved successfully",
  "data": {
    "inboundEmail": {
      "_id": "60d5ec49f0322c2c20e28fb1",
      "provider": "resend",
      "providerEventId": "evt_123",
      "messageId": "msg_456",
      "from": "sender@gmail.com",
      "to": ["inbound@lifelink.com"],
      "cc": [],
      "bcc": [],
      "subject": "Inquiry about donation settings",
      "text": "Hello, I wanted to ask...",
      "html": "<p>Hello, I wanted to ask...</p>",
      "headers": {},
      "attachments": [],
      "receivedAt": "2026-06-07T00:56:18.000Z",
      "read": false,
      "readAt": null,
      "archived": false,
      "archivedAt": null,
      "isRead": false,
      "isArchived": false,
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`PATCH /admin/inbound-emails/:id/read`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Inbound email marked as read",
  "data": {
    "inboundEmail": {
      "_id": "60d5ec49f0322c2c20e28fb1",
      "provider": "resend",
      "providerEventId": "evt_123",
      "messageId": "msg_456",
      "from": "sender@gmail.com",
      "to": ["inbound@lifelink.com"],
      "cc": [],
      "bcc": [],
      "subject": "Inquiry about donation settings",
      "text": "Hello, I wanted to ask...",
      "html": "<p>Hello, I wanted to ask...</p>",
      "headers": {},
      "attachments": [],
      "receivedAt": "2026-06-07T00:56:18.000Z",
      "read": true,
      "readAt": "2026-06-07T00:56:18.000Z",
      "archived": false,
      "archivedAt": null,
      "isRead": true,
      "isArchived": false,
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`PATCH /admin/inbound-emails/:id/archive`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Inbound email archived",
  "data": {
    "inboundEmail": {
      "_id": "60d5ec49f0322c2c20e28fb1",
      "provider": "resend",
      "providerEventId": "evt_123",
      "messageId": "msg_456",
      "from": "sender@gmail.com",
      "to": ["inbound@lifelink.com"],
      "cc": [],
      "bcc": [],
      "subject": "Inquiry about donation settings",
      "text": "Hello, I wanted to ask...",
      "html": "<p>Hello, I wanted to ask...</p>",
      "headers": {},
      "attachments": [],
      "receivedAt": "2026-06-07T00:56:18.000Z",
      "read": false,
      "readAt": null,
      "archived": true,
      "archivedAt": "2026-06-07T00:56:18.000Z",
      "isRead": false,
      "isArchived": true,
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`DELETE /admin/inbound-emails/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Inbound email deleted successfully",
  "data": {
    "inboundEmail": {
      "_id": "60d5ec49f0322c2c20e28fb1",
      "provider": "resend",
      "providerEventId": "evt_123",
      "messageId": "msg_456",
      "from": "sender@gmail.com",
      "to": ["inbound@lifelink.com"],
      "cc": [],
      "bcc": [],
      "subject": "Inquiry about donation settings",
      "text": "Hello, I wanted to ask...",
      "html": "<p>Hello, I wanted to ask...</p>",
      "headers": {},
      "attachments": [],
      "receivedAt": "2026-06-07T00:56:18.000Z",
      "read": false,
      "readAt": null,
      "archived": false,
      "archivedAt": null,
      "isRead": false,
      "isArchived": false,
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`GET /admin/support`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Support messages retrieved successfully",
  "data": {
    "tickets": [
      {
        "_id": "60d5ec49f0322c2c20e28f95",
        "userId": "60d5ec49f0322c2c20e28f36",
        "fullName": "Ziad Abdelghany",
        "email": "ziad@example.com",
        "role": "donor",
        "subject": "Missing points for my last donation",
        "category": "REWARDS",
        "message": "I completed my blood donation yesterday but didn't receive any points.",
        "status": "PENDING",
        "createdAt": "2026-06-07T00:56:18.000Z",
        "updatedAt": "2026-06-07T00:56:18.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

### Endpoint
`GET /admin/support/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Support message retrieved successfully",
  "data": {
    "ticket": {
      "_id": "60d5ec49f0322c2c20e28f95",
      "userId": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "subject": "Missing points for my last donation",
      "category": "REWARDS",
      "message": "I completed my blood donation yesterday but didn't receive any points.",
      "status": "PENDING",
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`PATCH /admin/support/:id/review`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Support message marked as reviewed",
  "data": {
    "ticket": {
      "_id": "60d5ec49f0322c2c20e28f95",
      "userId": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "subject": "Missing points for my last donation",
      "category": "REWARDS",
      "message": "I completed my blood donation yesterday but didn't receive any points.",
      "status": "REVIEWED",
      "adminReplyBy": "60d5ec49f0322c2c20e28f32",
      "adminReplyAt": "2026-06-07T00:56:18.000Z",
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`POST /admin/support/:id/reply`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Support reply saved successfully",
  "data": {
    "ticket": {
      "_id": "60d5ec49f0322c2c20e28f95",
      "userId": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "subject": "Missing points for my last donation",
      "category": "REWARDS",
      "message": "I completed my blood donation yesterday but didn't receive any points.",
      "status": "REVIEWED",
      "adminReply": "Points are updated.",
      "adminReplyBy": "60d5ec49f0322c2c20e28f32",
      "adminReplyAt": "2026-06-07T00:56:18.000Z",
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`GET /admin/donors`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Users list",
  "data": {
    "users": [
      {
        "_id": "60d5ec49f0322c2c20e28f36",
        "fullName": "Ziad Abdelghany",
        "email": "ziad@example.com",
        "role": "donor",
        "isEmailVerified": true,
        "emailVerifiedAt": "2026-06-05T12:00:00.000Z",
        "isSuspended": false,
        "suspendedAt": null,
        "suspendedReason": null,
        "location": {
          "city": "Cairo",
          "governorate": "Cairo",
          "coordinates": {
            "lat": 30.0444,
            "lng": 31.2357
          },
          "lastUpdated": "2026-06-05T12:00:00.000Z"
        },
        "phoneNumber": "01234567890",
        "bloodType": "A+",
        "dateOfBirth": "1995-04-15T00:00:00.000Z",
        "gender": "male",
        "lastDonationDate": "2026-04-10T12:00:00.000Z",
        "weight": 75,
        "hemoglobinLevel": 14.5,
        "travelHistory": [],
        "temporaryDeferralUntil": null,
        "lastDeferralReason": null,
        "isOptedIn": true,
        "settings": {
          "pushNotifications": true,
          "emergencyAlerts": true,
          "privacyMode": false,
          "language": "en"
        },
        "pointsBalance": 1200,
        "lifetimePointsEarned": 1500,
        "tier": "gold",
        "eligibilitySummary": {
          "eligible": true,
          "reason": null,
          "nextEligibleDate": null
        },
        "isBanned": false,
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

### Endpoint
`GET /admin/hospitals`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Users list",
  "data": {
    "users": [
      {
        "_id": "60d5ec49f0322c2c20e28f3a",
        "fullName": "Al-Amal Hospital",
        "email": "hospital@lifelink.com",
        "role": "hospital",
        "isEmailVerified": true,
        "emailVerifiedAt": "2026-06-05T12:00:00.000Z",
        "isSuspended": false,
        "suspendedAt": null,
        "suspendedReason": null,
        "location": {
          "city": "Cairo",
          "governorate": "Cairo",
          "coordinates": {
            "lat": 30.0444,
            "lng": 31.2357
          },
          "lastUpdated": "2026-06-05T12:00:00.000Z"
        },
        "name": "Al-Amal Hospital",
        "type": "hospital",
        "hospitalType": "General Hospital",
        "workingHours": "9AM - 5PM",
        "phone": "+20123456789",
        "address": {
          "city": "Cairo",
          "governorate": "Cairo",
          "street": "123 Nile Street"
        },
        "city": "Cairo",
        "state": "Cairo",
        "zipCode": "11511",
        "hospitalId": "HOSP123",
        "adminContactName": "Dr. Ahmed",
        "adminContactPhone": "+20123456789",
        "emergencyContact": "+20123456780",
        "bloodBanksAvailable": ["O+", "O-", "A+", "A-"],
        "capacity": 50,
        "lat": 30.0444,
        "long": 31.2357,
        "hospitalName": "Al-Amal Hospital",
        "hospitalNameNormalized": "الامل",
        "contactNumber": "+20123456789",
        "slotsPerHour": 5,
        "workingHoursStart": 9,
        "workingHoursEnd": 17,
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

### Endpoint
`GET /admin/donors/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "User details",
  "data": {
    "user": {
      "_id": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-06-05T12:00:00.000Z",
      "isSuspended": false,
      "suspendedAt": null,
      "suspendedReason": null,
      "location": {
        "city": "Cairo",
        "governorate": "Cairo",
        "coordinates": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "lastUpdated": "2026-06-05T12:00:00.000Z"
      },
      "phoneNumber": "01234567890",
      "bloodType": "A+",
      "dateOfBirth": "1995-04-15T00:00:00.000Z",
      "gender": "male",
      "lastDonationDate": "2026-04-10T12:00:00.000Z",
      "weight": 75,
      "hemoglobinLevel": 14.5,
      "travelHistory": [],
      "temporaryDeferralUntil": null,
      "lastDeferralReason": null,
      "isOptedIn": true,
      "settings": {
        "pushNotifications": true,
        "emergencyAlerts": true,
        "privacyMode": false,
        "language": "en"
      },
      "completedDonations": 5,
      "pointsBalance": 1200,
      "lifetimePointsEarned": 1500,
      "tier": "gold",
      "eligibilitySummary": {
        "eligible": true,
        "reason": null,
        "nextEligibleDate": null
      },
      "isBanned": false,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-05T12:00:00.000Z"
    }
  }
}
```

---

### Endpoint
`GET /admin/hospitals/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "User details",
  "data": {
    "user": {
      "_id": "60d5ec49f0322c2c20e28f3a",
      "fullName": "Al-Amal Hospital",
      "email": "hospital@lifelink.com",
      "role": "hospital",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-06-05T12:00:00.000Z",
      "isSuspended": false,
      "suspendedAt": null,
      "suspendedReason": null,
      "location": {
        "city": "Cairo",
        "governorate": "Cairo",
        "coordinates": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "lastUpdated": "2026-06-05T12:00:00.000Z"
      },
      "name": "Al-Amal Hospital",
      "type": "hospital",
      "hospitalType": "General Hospital",
      "workingHours": "9AM - 5PM",
      "phone": "+20123456789",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo",
        "street": "123 Nile Street"
      },
      "city": "Cairo",
      "state": "Cairo",
      "zipCode": "11511",
      "hospitalId": "HOSP123",
      "adminContactName": "Dr. Ahmed",
      "adminContactPhone": "+20123456789",
      "emergencyContact": "+20123456780",
      "bloodBanksAvailable": ["O+", "O-", "A+", "A-"],
      "capacity": 50,
      "lat": 30.0444,
      "long": 31.2357,
      "hospitalName": "Al-Amal Hospital",
      "hospitalNameNormalized": "الامل",
      "contactNumber": "+20123456789",
      "slotsPerHour": 5,
      "workingHoursStart": 9,
      "workingHoursEnd": 17,
      "totalRequests": 1,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-05T12:00:00.000Z"
    }
  }
}
```

---

### Endpoint
`GET /admin/admins`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Admins list",
  "data": {
    "admins": [
      {
        "_id": "60d5ec49f0322c2c20e28f32",
        "fullName": "System Admin",
        "email": "admin@lifelink.com",
        "role": "admin",
        "phone": "+201234567890",
        "address": "123 Main St, Cairo",
        "isEmailVerified": true,
        "isSuspended": false,
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

### Endpoint
`GET /admin/admins/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Admin details",
  "data": {
    "user": {
      "_id": "60d5ec49f0322c2c20e28f32",
      "fullName": "System Admin",
      "email": "admin@lifelink.com",
      "role": "admin",
      "phone": "+201234567890",
      "address": "123 Main St, Cairo",
      "isEmailVerified": true,
      "isSuspended": false,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-05T12:00:00.000Z"
    }
  }
}
```

---

### Endpoint
`PUT /admin/donors/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donor updated successfully",
  "data": {
    "donor": {
      "_id": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany Edited",
      "email": "ziad@example.com",
      "role": "donor",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-06-05T12:00:00.000Z",
      "isSuspended": false,
      "suspendedAt": null,
      "suspendedReason": null,
      "location": {
        "city": "Cairo",
        "governorate": "Cairo",
        "coordinates": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "lastUpdated": "2026-06-05T12:00:00.000Z"
      },
      "phoneNumber": "01234567890",
      "bloodType": "A+",
      "dateOfBirth": "1995-04-15T00:00:00.000Z",
      "gender": "male",
      "lastDonationDate": "2026-04-10T12:00:00.000Z",
      "weight": 75,
      "hemoglobinLevel": 14.5,
      "travelHistory": [],
      "temporaryDeferralUntil": null,
      "lastDeferralReason": null,
      "isOptedIn": true,
      "settings": {
        "pushNotifications": true,
        "emergencyAlerts": true,
        "privacyMode": false,
        "language": "en"
      },
      "isBanned": false,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`POST /admin/donors/:id/ban`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donor banned successfully",
  "data": {
    "donor": {
      "_id": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "isEmailVerified": true,
      "isSuspended": true,
      "suspendedAt": "2026-06-07T00:56:18.000Z",
      "suspendedReason": "Violation of user agreement",
      "location": {
        "city": "Cairo",
        "governorate": "Cairo",
        "coordinates": {
          "lat": 30.0444,
          "lng": 31.2357
        }
      },
      "isOptedIn": true,
      "isBanned": true,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`POST /admin/donors/:id/unban`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donor unbanned successfully",
  "data": {
    "donor": {
      "_id": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "isEmailVerified": true,
      "isSuspended": false,
      "suspendedAt": null,
      "suspendedReason": null,
      "location": {
        "city": "Cairo",
        "governorate": "Cairo",
        "coordinates": {
          "lat": 30.0444,
          "lng": 31.2357
        }
      },
      "isOptedIn": true,
      "isBanned": false,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`PUT /admin/hospitals/:id/status`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Hospital suspended successfully",
  "data": {
    "hospital": {
      "_id": "60d5ec49f0322c2c20e28f3a",
      "fullName": "Al-Amal Hospital",
      "email": "hospital@lifelink.com",
      "role": "hospital",
      "isEmailVerified": true,
      "isSuspended": true,
      "suspendedAt": "2026-06-07T00:56:18.000Z",
      "suspendedReason": "Suspended by admin",
      "location": {
        "city": "Cairo",
        "governorate": "Cairo"
      },
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`POST /admin/admins`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Admin created successfully",
  "data": {
    "_id": "60d5ec49f0322c2c20e28fa8",
    "fullName": "New Admin Assistant",
    "email": "assistant@lifelink.com",
    "role": "admin",
    "isEmailVerified": true,
    "emailVerifiedAt": "2026-06-07T00:56:18.000Z",
    "phone": "+20111222333",
    "address": "Admin Office 3",
    "location": {},
    "adminKey": "8df82fd9c89e102fd89e023",
    "createdAt": "2026-06-07T00:56:18.000Z",
    "updatedAt": "2026-06-07T00:56:18.000Z"
  }
}
```

---

### Endpoint
`PUT /admin/admins/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Admin updated successfully",
  "data": {
    "admin": {
      "_id": "60d5ec49f0322c2c20e28fa8",
      "fullName": "New Admin Assistant Updated",
      "email": "assistant@lifelink.com",
      "role": "admin",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-06-07T00:56:18.000Z",
      "phone": "+20111222333",
      "address": "Admin Office 3",
      "location": {},
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:57:00.000Z"
    }
  }
}
```

---

### Endpoint
`DELETE /admin/admins/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Admin deleted successfully"
}
```

---

### Endpoint
`GET /admin/permissions/roles`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Roles retrieved successfully",
  "data": {
    "roles": [
      {
        "_id": "60d5ec49f0322c2c20e28fb7",
        "role": "admin",
        "displayName": "Administrator",
        "description": "Standard administrative access for operations.",
        "isSystemRole": true,
        "permissions": {
          "donor_management": { "view": true, "manage": true, "ban": true },
          "hospital_management": { "view": true, "manage": true, "suspend": true },
          "admin_management": { "view": true, "create": false, "delete": false },
          "system_settings": { "view": true, "manage": true },
          "audit_logging": { "view": true, "export": false },
          "reporting": { "view": true, "export": true }
        },
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
      }
    ]
  }
}
```

---

### Endpoint
`GET /admin/permissions/roles/:role`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Role retrieved successfully",
  "data": {
    "role": {
      "_id": "60d5ec49f0322c2c20e28fb7",
      "role": "admin",
      "displayName": "Administrator",
      "description": "Standard administrative access for operations.",
      "isSystemRole": true,
      "permissions": {
        "donor_management": { "view": true, "manage": true, "ban": true },
        "hospital_management": { "view": true, "manage": true, "suspend": true },
        "admin_management": { "view": true, "create": false, "delete": false },
        "system_settings": { "view": true, "manage": true },
        "audit_logging": { "view": true, "export": false },
        "reporting": { "view": true, "export": true }
      },
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-05T12:00:00.000Z"
    }
  }
}
```

---

### Endpoint
`POST /admin/permissions/roles`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Role created successfully",
  "data": {
    "role": {
      "_id": "60d5ec49f0322c2c20e28fc1",
      "role": "moderator",
      "displayName": "Moderator Only",
      "description": "Support staff role.",
      "isSystemRole": false,
      "permissions": {
        "donor_management": { "view": true, "manage": false, "ban": false }
      },
      "updatedBy": "60d5ec49f0322c2c20e28f32",
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`PUT /admin/permissions/roles/:role`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Role permissions updated successfully",
  "data": {
    "role": {
      "_id": "60d5ec49f0322c2c20e28fc1",
      "role": "moderator",
      "displayName": "Moderator Level 1",
      "description": "Support staff role tier 1.",
      "isSystemRole": false,
      "permissions": {
        "donor_management": { "view": true, "manage": true, "ban": false }
      },
      "updatedBy": "60d5ec49f0322c2c20e28f32",
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:57:00.000Z"
    }
  }
}
```

---

### Endpoint
`DELETE /admin/permissions/roles/:role`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Role deleted successfully",
  "data": {
    "role": {
      "_id": "60d5ec49f0322c2c20e28fc1",
      "role": "moderator",
      "displayName": "Moderator Level 1",
      "description": "Support staff role tier 1.",
      "isSystemRole": false,
      "permissions": {
        "donor_management": { "view": true, "manage": true, "ban": false }
      },
      "updatedBy": "60d5ec49f0322c2c20e28f32",
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:57:00.000Z"
    }
  }
}
```

---

### Endpoint
`GET /admin/users`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Users list",
  "data": {
    "users": [
      {
        "_id": "60d5ec49f0322c2c20e28f36",
        "fullName": "Ziad Abdelghany",
        "email": "ziad@example.com",
        "role": "donor",
        "isEmailVerified": true,
        "emailVerifiedAt": "2026-06-05T12:00:00.000Z",
        "isSuspended": false,
        "suspendedAt": null,
        "suspendedReason": null,
        "location": {
          "city": "Cairo",
          "governorate": "Cairo",
          "coordinates": {
            "lat": 30.0444,
            "lng": 31.2357
          },
          "lastUpdated": "2026-06-05T12:00:00.000Z"
        },
        "phoneNumber": "01234567890",
        "bloodType": "A+",
        "dateOfBirth": "1995-04-15T00:00:00.000Z",
        "gender": "male",
        "lastDonationDate": "2026-04-10T12:00:00.000Z",
        "weight": 75,
        "hemoglobinLevel": 14.5,
        "travelHistory": [],
        "temporaryDeferralUntil": null,
        "lastDeferralReason": null,
        "isOptedIn": true,
        "settings": {
          "pushNotifications": true,
          "emergencyAlerts": true,
          "privacyMode": false,
          "language": "en"
        },
        "pointsBalance": 1200,
        "lifetimePointsEarned": 1500,
        "tier": "gold",
        "eligibilitySummary": {
          "eligible": true,
          "reason": null,
          "nextEligibleDate": null
        },
        "isBanned": false,
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

### Endpoint
`GET /admin/users/stats`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "User statistics",
  "data": {
    "totalUsers": 150,
    "totalDonors": 120,
    "totalHospitals": 28,
    "totalAdmins": 2,
    "verifiedUsers": 135,
    "unverifiedUsers": 15,
    "suspendedUsers": 2
  }
}
```

---

### Endpoint
`POST /admin/users/hospital`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Hospital created successfully",
  "data": {
    "hospital": {
      "_id": "60d5ec49f0322c2c20e28f3a",
      "fullName": "Al-Amal Hospital",
      "email": "hospital@lifelink.com",
      "role": "hospital",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-06-07T00:56:18.000Z",
      "isSuspended": false,
      "location": {
        "city": "Cairo",
        "governorate": "Cairo",
        "coordinates": {
          "lat": 30.0444,
          "lng": 31.2357
        }
      },
      "name": "Al-Amal Hospital",
      "type": "hospital",
      "hospitalType": "General Hospital",
      "workingHours": "9AM - 5PM",
      "phone": "+20123456789",
      "address": {
        "city": "Cairo",
        "governorate": "Cairo",
        "street": "123 Nile Street"
      },
      "city": "Cairo",
      "state": "Cairo",
      "zipCode": "11511",
      "hospitalId": "HOSP123",
      "adminContactName": "Dr. Ahmed",
      "adminContactPhone": "+20123456789",
      "emergencyContact": "+20123456780",
      "bloodBanksAvailable": [],
      "capacity": 50,
      "lat": 30.0444,
      "long": 31.2357,
      "hospitalName": "Al-Amal Hospital",
      "hospitalNameNormalized": "الامل",
      "contactNumber": "+20123456789",
      "slotsPerHour": 5,
      "workingHoursStart": 9,
      "workingHoursEnd": 17,
      "createdAt": "2026-06-07T00:56:18.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`GET /admin/users/:id`

#### Current Backend Runtime Response
*(Same structure as single donor/hospital details depending on user role)*
```json
{
  "success": true,
  "message": "User details",
  "data": {
    "user": {
      "_id": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-06-05T12:00:00.000Z",
      "isSuspended": false,
      "suspendedAt": null,
      "suspendedReason": null,
      "location": {
        "city": "Cairo",
        "governorate": "Cairo",
        "coordinates": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "lastUpdated": "2026-06-05T12:00:00.000Z"
      },
      "phoneNumber": "01234567890",
      "bloodType": "A+",
      "dateOfBirth": "1995-04-15T00:00:00.000Z",
      "gender": "male",
      "lastDonationDate": "2026-04-10T12:00:00.000Z",
      "weight": 75,
      "hemoglobinLevel": 14.5,
      "travelHistory": [],
      "temporaryDeferralUntil": null,
      "lastDeferralReason": null,
      "isOptedIn": true,
      "settings": {
        "pushNotifications": true,
        "emergencyAlerts": true,
        "privacyMode": false,
        "language": "en"
      },
      "completedDonations": 5,
      "pointsBalance": 1200,
      "lifetimePointsEarned": 1500,
      "tier": "gold",
      "eligibilitySummary": {
        "eligible": true,
        "reason": null,
        "nextEligibleDate": null
      },
      "isBanned": false,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-05T12:00:00.000Z"
    }
  }
}
```

---

### Endpoint
`PATCH /admin/users/:id/verify`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "User verified successfully",
  "data": {
    "user": {
      "_id": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-06-07T00:56:18.000Z",
      "isSuspended": false,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`PATCH /admin/users/:id/unverify`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "User unverified successfully",
  "data": {
    "user": {
      "_id": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "isEmailVerified": false,
      "emailVerifiedAt": null,
      "isSuspended": false,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`PATCH /admin/users/:id/suspend`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "User suspended successfully",
  "data": {
    "user": {
      "_id": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "isEmailVerified": true,
      "isSuspended": true,
      "suspendedAt": "2026-06-07T00:56:18.000Z",
      "suspendedReason": "Suspicious activity reported.",
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`PATCH /admin/users/:id/unsuspend`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "User unsuspended successfully",
  "data": {
    "user": {
      "_id": "60d5ec49f0322c2c20e28f36",
      "fullName": "Ziad Abdelghany",
      "email": "ziad@example.com",
      "role": "donor",
      "isEmailVerified": true,
      "isSuspended": false,
      "suspendedAt": null,
      "suspendedReason": null,
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`DELETE /admin/users/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### Endpoint
`GET /admin/requests`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Requests list",
  "data": {
    "requests": [
      {
        "_id": "60d5ec49f0322c2c20e28f60",
        "hospitalId": {
          "_id": "60d5ec49f0322c2c20e28f3a",
          "fullName": "Al-Amal Hospital",
          "hospitalName": "Al-Amal Hospital",
          "address": {
            "city": "Cairo",
            "governorate": "Cairo",
            "street": "123 Nile Street"
          },
          "contactNumber": "+20123456789"
        },
        "hospitalContact": "+20123456789",
        "contactNumber": "+20123456789",
        "type": "blood",
        "urgency": "normal",
        "requiredBy": "2026-06-10T12:00:00.000Z",
        "quantity": 2,
        "unitsNeeded": 2,
        "patientType": "Cancer Patient",
        "isEmergency": false,
        "notes": "Chemotherapy support",
        "bloodType": ["O+"],
        "locationHospital": {
          "latitude": 30.0444,
          "longitude": 31.2357
        },
        "hospitalLocation": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "hospitalLocationGeo": {
          "type": "Point",
          "coordinates": [31.2357, 30.0444]
        },
        "hospitalName": "Al-Amal Hospital",
        "status": "pending",
        "qrToken": null,
        "qrCreatedAt": null,
        "qrExpiresAt": null,
        "id": "60d5ec49f0322c2c20e28f60",
        "requestId": "60d5ec49f0322c2c20e28f60",
        "bloodTypeLabel": "O+",
        "donationCount": 1,
        "timeline": [
          {
            "event": "REQUEST_CREATED",
            "timestamp": "2026-06-05T12:00:00.000Z",
            "actorType": "system",
            "actorId": null,
            "metadata": {
              "status": "pending",
              "urgency": "normal"
            }
          }
        ],
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

### Endpoint
`GET /admin/requests/stats`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request statistics",
  "data": {
    "total": 10,
    "byStatus": {
      "pending": 3,
      "in-progress": 1,
      "completed": 5,
      "cancelled": 1
    },
    "byUrgency": {
      "critical": 2,
      "normal": 2
    },
    "byBloodType": {
      "A+": 1,
      "O-": 2
    }
  }
}
```

---

### Endpoint
`GET /admin/requests/:id`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request details",
  "data": {
    "request": {
      "_id": "60d5ec49f0322c2c20e28f60",
      "hospitalId": {
        "_id": "60d5ec49f0322c2c20e28f3a",
        "fullName": "Al-Amal Hospital",
        "hospitalName": "Al-Amal Hospital",
        "address": {
          "city": "Cairo",
          "governorate": "Cairo",
          "street": "123 Nile Street"
        },
        "contactNumber": "+20123456789"
      },
      "hospitalContact": "+20123456789",
      "contactNumber": "+20123456789",
      "type": "blood",
      "urgency": "normal",
      "requiredBy": "2026-06-10T12:00:00.000Z",
      "quantity": 2,
      "unitsNeeded": 2,
      "patientType": "Cancer Patient",
      "isEmergency": false,
      "notes": "Chemotherapy support",
      "bloodType": ["O+"],
      "locationHospital": {
        "latitude": 30.0444,
        "longitude": 31.2357
      },
      "hospitalLocation": {
        "lat": 30.0444,
        "lng": 31.2357
      },
      "hospitalLocationGeo": {
        "type": "Point",
        "coordinates": [31.2357, 30.0444]
      },
      "hospitalName": "Al-Amal Hospital",
      "status": "pending",
      "qrToken": null,
      "qrCreatedAt": null,
      "qrExpiresAt": null,
      "id": "60d5ec49f0322c2c20e28f60",
      "requestId": "60d5ec49f0322c2c20e28f60",
      "bloodTypeLabel": "O+",
      "donations": [
        {
          "_id": "60d5ec49f0322c2c20e28f70",
          "donorId": {
            "_id": "60d5ec49f0322c2c20e28f36",
            "fullName": "Ziad Abdelghany",
            "email": "ziad@example.com",
            "phoneNumber": "01234567890",
            "location": {
              "city": "Cairo",
              "governorate": "Cairo",
              "coordinates": {
                "lat": 30.0444,
                "lng": 31.2357
              }
            },
            "bloodType": "A+"
          },
          "requestId": "60d5ec49f0322c2c20e28f60",
          "status": "pending",
          "quantity": 1,
          "createdAt": "2026-06-06T10:00:00.000Z",
          "updatedAt": "2026-06-06T10:00:00.000Z"
        }
      ],
      "responseCount": 1,
      "donationCount": 1,
      "timeline": [
        {
          "event": "REQUEST_CREATED",
          "timestamp": "2026-06-05T12:00:00.000Z",
          "actorType": "system",
          "actorId": null,
          "metadata": {
            "status": "pending",
            "urgency": "normal"
          }
        }
      ],
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-05T12:00:00.000Z"
    },
    "donations": [
      {
        "_id": "60d5ec49f0322c2c20e28f70",
        "donorId": {
          "_id": "60d5ec49f0322c2c20e28f36",
          "fullName": "Ziad Abdelghany",
          "email": "ziad@example.com",
          "phoneNumber": "01234567890",
          "location": {
            "city": "Cairo",
            "governorate": "Cairo",
            "coordinates": {
              "lat": 30.0444,
              "lng": 31.2357
            }
          },
          "bloodType": "A+"
        },
        "requestId": "60d5ec49f0322c2c20e28f60",
        "status": "pending",
        "quantity": 1,
        "createdAt": "2026-06-06T10:00:00.000Z",
        "updatedAt": "2026-06-06T10:00:00.000Z"
      }
    ]
  }
}
```

---

### Endpoint
`GET /admin/requests/:id/donations`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request donations",
  "data": {
    "donations": [
      {
        "_id": "60d5ec49f0322c2c20e28f70",
        "donorId": {
          "_id": "60d5ec49f0322c2c20e28f36",
          "fullName": "Ziad Abdelghany",
          "email": "ziad@example.com",
          "phoneNumber": "01234567890",
          "location": {
            "city": "Cairo",
            "governorate": "Cairo",
            "coordinates": {
              "lat": 30.0444,
              "lng": 31.2357
            }
          },
          "bloodType": "A+"
        },
        "requestId": "60d5ec49f0322c2c20e28f60",
        "status": "pending",
        "quantity": 1,
        "createdAt": "2026-06-06T10:00:00.000Z",
        "updatedAt": "2026-06-06T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

### Endpoint
`PATCH /admin/requests/:id/fulfill`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request marked as fulfilled",
  "data": {
    "request": {
      "_id": "60d5ec49f0322c2c20e28f60",
      "hospitalId": "60d5ec49f0322c2c20e28f3a",
      "type": "blood",
      "status": "completed",
      "urgency": "normal",
      "requiredBy": "2026-06-10T12:00:00.000Z",
      "quantity": 2,
      "unitsNeeded": 2,
      "patientType": "Cancer Patient",
      "isEmergency": false,
      "notes": "Chemotherapy support",
      "bloodType": ["O+"],
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`PATCH /admin/requests/:id/cancel`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Request cancelled",
  "data": {
    "request": {
      "_id": "60d5ec49f0322c2c20e28f60",
      "hospitalId": "60d5ec49f0322c2c20e28f3a",
      "type": "blood",
      "status": "cancelled",
      "urgency": "normal",
      "requiredBy": "2026-06-10T12:00:00.000Z",
      "quantity": 2,
      "unitsNeeded": 2,
      "patientType": "Cancer Patient",
      "isEmergency": false,
      "notes": "Chemotherapy support\n[Admin cancelled]: Request closed by patient family.",
      "bloodType": ["O+"],
      "cancelledAt": "2026-06-07T00:56:18.000Z",
      "createdAt": "2026-06-05T12:00:00.000Z",
      "updatedAt": "2026-06-07T00:56:18.000Z"
    }
  }
}
```

---

### Endpoint
`POST /admin/requests/:id/broadcast`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Broadcast sent",
  "data": {
    "donorsNotified": 15,
    "pushTokenCount": 22,
    "governorate": "Cairo",
    "bloodType": ["O+"],
    "bloodTypeLabel": "O+"
  }
}
```

---

### Endpoint
`GET /admin/analytics/donations`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Donation trends",
  "data": {
    "trends": [
      {
        "year": 2026,
        "month": 6,
        "total": 15,
        "totalAttempts": 15,
        "totalResponses": 15,
        "completed": 12,
        "cancelled": 2,
        "totalUnits": 12,
        "successRate": "80.0%"
      }
    ],
    "dailyTrends": [
      {
        "year": 2026,
        "month": 6,
        "day": 7,
        "total": 1,
        "totalAttempts": 1,
        "totalResponses": 1,
        "completed": 1,
        "cancelled": 0,
        "totalUnits": 1,
        "successRate": "100%"
      }
    ],
    "regionalBreakdown": [
      {
        "region": "Cairo",
        "requests": 10,
        "activeRequests": 4,
        "completedDonations": 8,
        "donatedUnits": 8
      }
    ]
  }
}
```

---

### Endpoint
`GET /admin/analytics/blood-types`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Blood type distribution",
  "data": {
    "distribution": [
      {
        "bloodType": "A+",
        "donors": 45,
        "activeRequests": 1
      },
      {
        "bloodType": "O-",
        "donors": 12,
        "activeRequests": 2
      }
    ]
  }
}
```

---

### Endpoint
`GET /admin/analytics/top-donors`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Top donors",
  "data": {
    "topDonors": [
      {
        "_id": "60d5ec49f0322c2c20e28f36",
        "completedDonations": 12,
        "totalUnits": 12,
        "lastDonation": "2026-06-07T00:56:18.000Z",
        "donor": {
          "fullName": "Ziad Abdelghany",
          "email": "ziad@example.com",
          "bloodType": "A+",
          "location": {
            "city": "Cairo",
            "governorate": "Cairo",
            "coordinates": {
              "lat": 30.0444,
              "lng": 31.2357
            }
          }
        }
      }
    ]
  }
}
```

---

### Endpoint
`GET /admin/analytics/growth`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Growth metrics",
  "data": {
    "userGrowth": [
      {
        "_id": {
          "year": 2026,
          "month": 6
        },
        "count": 10,
        "donors": 8,
        "hospitals": 2
      }
    ],
    "requestGrowth": [
      {
        "_id": {
          "year": 2026,
          "month": 6
        },
        "count": 5
      }
    ],
    "donationGrowth": [
      {
        "_id": {
          "year": 2026,
          "month": 6
        },
        "count": 12
      }
    ]
  }
}
```

---

### Endpoint
`POST /admin/emergency/broadcast`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Emergency broadcast sent",
  "data": {
    "donorsNotified": 25,
    "pushTokenCount": 35,
    "governorate": "Cairo",
    "city": "Nasr City"
  }
}
```

---

### Endpoint
`GET /admin/emergency/critical`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Critical requests",
  "data": {
    "requests": [
      {
        "_id": "60d5ec49f0322c2c20e28f65",
        "hospitalId": {
          "_id": "60d5ec49f0322c2c20e28f3a",
          "fullName": "Al-Amal Hospital",
          "hospitalName": "Al-Amal Hospital",
          "location": {
            "city": "Cairo",
            "governorate": "Cairo",
            "coordinates": {
              "lat": 30.0444,
              "lng": 31.2357
            }
          },
          "contactNumber": "+20123456789"
        },
        "hospitalContact": "+20123456789",
        "contactNumber": "+20123456789",
        "type": "blood",
        "urgency": "critical",
        "requiredBy": "2026-06-08T00:56:18.000Z",
        "quantity": 5,
        "unitsNeeded": 5,
        "patientType": "Major Accident ICU",
        "isEmergency": true,
        "notes": "Major Accident ICU",
        "bloodType": ["O-", "O+"],
        "locationHospital": {
          "latitude": 30.0444,
          "longitude": 31.2357
        },
        "hospitalLocation": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "hospitalLocationGeo": {
          "type": "Point",
          "coordinates": [31.2357, 30.0444]
        },
        "hospitalName": "Al-Amal Hospital",
        "status": "pending",
        "createdAt": "2026-06-05T12:00:00.000Z",
        "updatedAt": "2026-06-05T12:00:00.000Z"
      }
    ]
  }
}
```

---

### Endpoint
`GET /admin/emergency/shortage-alerts`

#### Current Backend Runtime Response
```json
{
  "success": true,
  "message": "Shortage alerts",
  "data": {
    "alerts": [
      {
        "bloodType": "O-",
        "activeRequests": 2,
        "availableDonors": 0,
        "ratio": "critical",
        "status": "critical"
      },
      {
        "bloodType": "A+",
        "activeRequests": 1,
        "availableDonors": 45,
        "ratio": "0.02",
        "status": "ok"
      }
    ]
  }
}
```
