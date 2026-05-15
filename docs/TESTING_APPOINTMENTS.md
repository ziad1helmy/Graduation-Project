# Testing the Appointments System

This document provides a step-by-step guide to testing all the endpoints in the Appointments system.

> [!IMPORTANT]
> **Authentication Required:** All appointment endpoints are protected. You **MUST** include a valid Donor JWT token in the `Authorization` header as `Bearer <your_token>`.

---

## 1. Get Available Slots

Before booking, a donor usually checks for available slots at a specific hospital on a specific date.

*   **Endpoint:** `GET /api/appointments/available-slots`
*   **Query Parameters:**
    *   `hospitalId` (required): The ID of the hospital you want to visit.
    *   `date` (required): The date you want to check (e.g., `2026-10-15`).
*   **Example Request:**
    ```http
    GET /api/appointments/available-slots?hospitalId=65a123...&date=2026-10-15
    Authorization: Bearer <donor_token>
    ```
*   **Expected Response (200 OK):**
    Returns an array of available time slots (e.g., `["09:00 AM", "10:00 AM"]`).

---

## 2. Book an Appointment

Once the donor selects a slot, they book the appointment.

*   **Endpoint:** `POST /api/appointments`
*   **Body (JSON):**
    *   `hospitalId` (required): The ID of the hospital.
    *   `date` (required): The date of the appointment (e.g., `2026-10-15`).
    *   `time` (required): The time slot chosen (e.g., `10:00 AM`).
    *   `requestId` (optional): If this appointment is linked to a specific blood donation request.
    *   `notes` (optional): Any extra notes from the donor.
    *(Note: You can also just pass `appointmentDate` as a full ISO timestamp instead of `date` + `time`)*
*   **Example Request:**
    ```json
    POST /api/appointments
    Authorization: Bearer <donor_token>
    Content-Type: application/json

    {
      "hospitalId": "65a123...",
      "date": "2026-10-15",
      "time": "10:00 AM",
      "notes": "First time donor"
    }
    ```
*   **Expected Response (201 Created):**
    Returns the created appointment object, including a `qrCode` and a `status` of `pending`.

---

## 3. Get My Appointments (Donor)

Allows a donor to see a list of their past and upcoming appointments.

*   **Endpoint:** `GET /api/appointments/my-appointments`
*   **Query Parameters (Optional):**
    *   `skip`: Number of records to skip (for pagination, default 0).
    *   `limit`: Number of records to return (for pagination, default 10).
*   **Example Request:**
    ```http
    GET /api/appointments/my-appointments?skip=0&limit=10
    Authorization: Bearer <donor_token>
    ```
*   **Expected Response (200 OK):**
    Returns a list of appointments with populated hospital details and pagination metadata.

---

## 4. Get Appointment by ID

Fetch the details of a single, specific appointment.

*   **Endpoint:** `GET /api/appointments/:appointmentId`
*   **Path Parameters:**
    *   `appointmentId`: The ID of the specific appointment.
*   **Example Request:**
    ```http
    GET /api/appointments/66b456...
    Authorization: Bearer <donor_token>
    ```
*   **Expected Response (200 OK):**
    Returns the full appointment object.

---

## 5. Reschedule an Appointment

Allows a donor to change the date and time of a `pending` or `confirmed` appointment.

*   **Endpoint:** `PATCH /api/appointments/:appointmentId`
*   **Path Parameters:**
    *   `appointmentId`: The ID of the specific appointment.
*   **Body (JSON):**
    *   `date` (required): The new date.
    *   `time` (required): The new time.
*   **Example Request:**
    ```json
    PATCH /api/appointments/66b456...
    Authorization: Bearer <donor_token>
    Content-Type: application/json

    {
      "date": "2026-10-20",
      "time": "01:00 PM"
    }
    ```
*   **Expected Response (200 OK):**
    Returns the updated appointment object with the new date.

---

## 6. Cancel an Appointment

Allows a donor to cancel an appointment (must not already be `completed` or `cancelled`).

*   **Endpoint:** `DELETE /api/appointments/:appointmentId`
*   **Path Parameters:**
    *   `appointmentId`: The ID of the specific appointment.
*   **Example Request:**
    ```http
    DELETE /api/appointments/66b456...
    Authorization: Bearer <donor_token>
    ```
*   **Expected Response (200 OK):**
    Returns the updated appointment object with its status set to `cancelled` and a `cancelledAt` timestamp.

---

## Postman Testing Flow

To test the entire flow end-to-end:
1. **Login as Donor**: Get the access token.
2. **Find a Hospital**: Get a valid `hospitalId` from the database.
3. **Get Slots**: Call `GET /api/appointments/available-slots` with the hospital ID and a future date to see which hours are available.
4. **Book**: Call `POST /api/appointments` using the hospital ID and one of the available slots. Save the resulting `_id` of the appointment.
5. **Read**: Call `GET /api/appointments/my-appointments` to see it in your list.
6. **Reschedule**: Call `PATCH /api/appointments/{appointment_id}` to move it to a different day/time.
7. **Cancel**: Call `DELETE /api/appointments/{appointment_id}` to cancel it.
