# LifeLink Localization Audit — Complete Message Inventory

> All user-facing messages extracted from the codebase, deduplicated, categorized, and mapped to suggested i18n keys.
> Generated: 2026-06-25

---

## Legend

- **Key**: Suggested i18n key path (dot-notation, e.g. `auth.email_required`)
- **Status**: `✅` = already in `en.json`, `❌` = missing from locale files
- **Category**: Validation | Authentication | Error | Success | Notification | UI | Email | System

---

## 1. AUTHENTICATION MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `auth.email_required` | Email is required | auth.service.js:99, auth.service.js:168, auth.service.js:230, auth.service.js:477, auth.service.js:646, auth.service.js:662, auth.service.js:772, auth.controller.js, admin.service.js:860, validation/auth.validation.js | Auth | ✅ |
| `auth.password_required` | Password is required | auth.service.js:100, auth.service.js:478, auth.service.js:664, auth.controller.js, admin.service.js:861 | Auth | ✅ |
| `auth.role_required` | Role is required | auth.service.js:101 | Auth | ❌ |
| `auth.invalid_credentials` | Invalid credentials | auth.service.js:109/113/128, admin.service.js:869/870/875 | Auth | ❌ |
| `auth.account_suspended` | Account is suspended. Contact support. | auth.service.js:120, admin.service.js:871, auth.middleware.js:34 | Auth | ❌ |
| `auth.email_not_verified` | Email address is not verified | auth.service.js:124, admin.service.js:872, auth.middleware.js:45 | Auth | ❌ |
| `auth.invalid_role_for_account` | Invalid role for this account | auth.service.js:131 | Auth | ❌ |
| `auth.invalid_role` | Invalid role | auth.controller.js loginUser | Auth | ✅ |
| `auth.invalid_hospital_id` | Invalid hospital ID | auth.service.js:136 | Auth | ❌ |
| `auth.public_signup_donors_only` | Public signup is available for donors only | auth.service.js:272, auth.controller.js | Auth | ✅ |
| `auth.use_admin_login` | Use /auth/admin/login for admin accounts | auth.controller.js loginUser | Auth | ✅ |
| `auth.account_not_found` | Account not found | auth.service.js:173, auth.middleware.js:29 | Auth | ❌ |
| `auth.otp_required` | OTP is required | auth.service.js:231, auth.service.js:663 | Auth | ❌ |
| `auth.otp_invalid_or_expired` | Invalid or expired OTP | auth.service.js:241, auth.service.js:673/682/687 | Auth | ❌ |
| `auth.otp_attempts_exceeded` | OTP attempts exceeded | auth.service.js:242 | Auth | ❌ |
| `auth.otp_invalid` | Invalid OTP | auth.service.js:247, auth.service.js:678 | Auth | ❌ |
| `auth.register_success` | User registered successfully | auth.controller.js register | Success | ✅ |
| `auth.login_success` | Login successful | auth.controller.js loginUser, loginHospital | Success | ✅ |
| `auth.admin_login_success` | Admin login successful | auth.controller.js loginAdmin | Success | ✅ |
| `auth.logout_success` | Logged out successfully | auth.controller.js logout | Success | ✅ |
| `auth.token_refreshed` | Token refreshed | auth.controller.js refreshToken | Success | ✅ |
| `auth.token_valid` | Token is valid | auth.controller.js validateToken | Success | ✅ |
| `auth.user_retrieved` | User retrieved | auth.controller.js getMe | Success | ✅ |
| `auth.email_verified` | Email verified successfully | auth.controller.js verifyEmailOtp | Success | ✅ |
| `auth.verification_code_sent` | Verification code sent | auth.controller.js verifyEmail | Success | ✅ |
| `auth.password_reset_email_sent` | Password reset email sent | auth.controller.js forgotPassword | Success | ✅ |
| `auth.password_reset_otp_verified` | Password reset OTP verified successfully | auth.controller.js verifyOtp | Success | ✅ |
| `auth.password_reset_success` | Password reset successful | auth.controller.js resetPassword | Success | ✅ |
| `auth.password_changed` | Password changed successfully | auth.controller.js changePassword | Success | ✅ |
| `auth.fcm_token_registered` | FCM token registered successfully | auth.controller.js registerFcmToken | Success | ✅ |
| `auth.fcm_token_updated` | FCM token updated successfully | auth.controller.js replaceFcmToken | Success | ✅ |
| `auth.fcm_token_removed` | FCM token removed successfully | auth.controller.js removeFcmToken | Success | ✅ |
| `auth.validation_failed` | Validation failed | auth.controller.js loginUser, changePassword; error.middleware.js | Error | ✅ |
| `auth.error_invalid_token` | Invalid or expired token | auth.service.js:77 | Error | ✅ |
| `auth.email_already_registered` | Email is already registered | auth.service.js:319 | Error | ❌ |
| `auth.admin_key_required` | adminKey is required | admin.service.js:862, auth.controller.js loginAdmin | Auth | ✅ |
| `auth.authorization_header_required` | Authorization header is required | auth.middleware.js:9 | Auth | ❌ |
| `auth.authorization_header_format` | Authorization header must be: Bearer <token> | auth.middleware.js:14 | Auth | ❌ |
| `auth.token_expired` | Token has expired | auth.middleware.js:50/59, error.middleware.js:50 | Auth | ❌ |
| `auth.invalid_token` | Invalid token | auth.middleware.js:58/62 | Auth | ❌ |
| `auth.token_no_longer_valid` | Token is no longer valid. Please log in again | auth.middleware.js:40 | Auth | ❌ |
| `auth.account_suspended_short` | Account is suspended | auth.middleware.js:34 | Auth | ❌ |
| `auth.refresh_token_required` | Refresh token is required | auth.service.js:583/620 | Auth | ❌ |
| `auth.refresh_token_invalid` | Invalid refresh token | auth.service.js:587/625/635 | Auth | ❌ |
| `auth.current_password_required` | Current password is required | auth.service.js:720 | Auth | ❌ |
| `auth.new_password_required` | New password is required | auth.service.js:721 | Auth | ❌ |
| `auth.new_password_must_differ` | New password must be different from current password | auth.service.js:723, validation/auth.validation.js:274 | Validation | ❌ |
| `auth.current_password_incorrect` | Current password is incorrect | auth.service.js:730 | Auth | ❌ |
| `auth.verification_code_required` | Verification code is required | auth.service.js:773, auth.controller.js verifyEmailOtp | Auth | ✅ |
| `auth.verification_code_invalid` | Invalid or expired verification code | auth.service.js:784 | Auth | ❌ |
| `auth.reset_token_invalid` | Invalid or expired reset token | errorCodes.js | Auth | ❌ |
| `auth.invalid_password` | Invalid password | errorCodes.js | Auth | ❌ |
| `auth.invalid_admin_key` | Invalid admin key | admin.service.js:889, errorCodes.js | Auth | ❌ |
| `auth.verification_token_invalid` | Invalid or expired verification token | errorCodes.js | Auth | ❌ |
| `auth.fcm_token_required` | fcmToken is required | auth.service.js:507/536/560, errorCodes.js | Auth | ❌ |
| `auth.user_not_found` | User not found | auth.service.js:494/512/547/573/630/755, errorCodes.js | Auth | ❌ |
| `auth.hospital_id_required_for_login` | hospitalId is required for hospital login | validation/auth.validation.js:217 | Validation | ❌ |
| `auth.admin_code_required` | adminCode is required for admin login | validation/auth.validation.js:227 | Validation | ❌ |
| `auth.confirm_password_required` | confirmPassword is required | validation/auth.validation.js:263/304 | Validation | ❌ |
| `auth.confirm_password_mismatch` | confirmPassword must match newPassword | validation/auth.validation.js:265 | Validation | ❌ |
| `auth.confirm_password_mismatch_register` | confirmPassword must match password | validation/auth.validation.js:306 | Validation | ❌ |
| `auth.account_banned` | Account banned | errorCodes.js, auth.service.js | Auth | ❌ |
| `auth.account_banned_with_reason` | Account banned. Reason: {reason} | auth.service.js:51 | Auth | ❌ |
| `auth.email_already_exists` | Email is already registered | errorCodes.js, auth.service.js | Auth | ❌ |
| `auth.location_invalid_pair` | Both lat and lng must be provided together | errorCodes.js | Validation | ❌ |
| `auth.location_out_of_range` | Coordinates are outside valid range | errorCodes.js | Validation | ❌ |

---

## 2. DONOR MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `donor.profile_retrieved` | Donor profile retrieved successfully | donor.controller.js getProfile | Success | ✅ |
| `donor.profile_updated` | Donor profile updated successfully | donor.controller.js updateProfile | Success | ✅ |
| `donor.profile_not_found` | Donor profile not found | donor.controller.js, donor.locale | Error | ✅ |
| `donor.not_found` | Donor not found | donor.controller.js, donor.locale | Error | ✅ |
| `donor.phone_invalid` | Phone number must be 11 digits long | donor.controller.js updateProfile, Donor.model.js | Validation | ✅ |
| `donor.email_in_use` | Email is already in use by another account | donor.controller.js updateProfile | Error | ✅ |
| `donor.requests_retrieved` | Matching requests retrieved successfully | donor.controller.js getRequests | Success | ✅ |
| `donor.response_submitted` | Response submitted successfully | donor.controller.js respondToRequest | Success | ✅ |
| `donor.eligibility_result` | Eligibility result | donor.controller.js getDonationEligibility | Success | ✅ |
| `donor.donation_history_retrieved` | Donation history retrieved successfully | donor.controller.js getDonationHistory | Success | ✅ |
| `donor.dashboard_retrieved` | Donor dashboard retrieved successfully | donor.controller.js getDashboard | Success | ✅ |
| `donor.settings_retrieved` | Donor settings retrieved successfully | donor.controller.js getSettings | Success | ✅ |
| `donor.settings_updated` | Donor settings updated successfully | donor.controller.js updateSettings | Success | ✅ |
| `donor.participation_updated` | Participation preference updated successfully | donor.controller.js updateParticipation | Success | ✅ |
| `donor.stats_retrieved` | Donor stats retrieved | donor.controller.js getDonorStats | Success | ✅ |
| `donor.rewards_retrieved` | Donor rewards retrieved | donor.controller.js getDonorRewards | Success | ✅ |
| `donor.recent_activity_retrieved` | Recent activity retrieved successfully | donor.controller.js getRecentActivity | Success | ✅ |
| `donor.urgent_requests_retrieved` | Urgent requests retrieved | donor.locale | Success | ✅ |
| `donor.urgent_request_retrieved` | Urgent request retrieved successfully | donor.locale | Success | ✅ |
| `donor.urgent_request_already_declined` | Urgent request already declined | donor.locale | Info | ✅ |
| `donor.urgent_request_declined` | Urgent request declined successfully | donor.locale | Success | ✅ |
| `donor.location_required` | Please set your location to see blood requests. | donor.controller.js getRequests | Info | ❌ |
| `donor.active_appointment_notice` | You have an active appointment. Complete or cancel it to see new requests. | donor.controller.js getActiveAppointmentNotice | Info | ❌ |
| `donor.request_not_found` | Request not found | donor.locale | Error | ✅ |
| `donor.urgent_request_not_found` | Urgent request not found | donor.locale | Error | ✅ |
| `donor.already_responded` | You have already responded to this request | donor.locale | Error | ✅ |
| `donor.not_eligible` | Donor is not eligible | donor.locale | Error | ✅ |
| `donor.invalid_participation` | isOptedIn must be a boolean value | donor.locale | Validation | ✅ |
| `donor.request_id_required` | requestId is required | donor.locale | Validation | ✅ |
| `donor.invalid_language` | Language must be "en" or "ar" | donor.controller.js updateSettings, donor.locale | Validation | ✅ |
| `donor.profile_completed` | Profile Completed | donor.locale | Success | ✅ |

---

## 3. APPOINTMENT MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `appointment.booked` | Appointment booked | appointment.controller.js bookAppointment | Success | ✅ |
| `appointment.retrieved` | Appointment retrieved | appointment.controller.js getAppointmentById | Success | ✅ |
| `appointment.list_fetched` | Appointments fetched | appointment.controller.js getMyAppointments | Success | ✅ |
| `appointment.slots_retrieved` | Available slots retrieved successfully | appointment.controller.js getAvailableSlots | Success | ✅ |
| `appointment.rescheduled` | Appointment rescheduled | appointment.controller.js rescheduleAppointment | Success | ✅ |
| `appointment.cancelled` | Appointment cancelled | appointment.controller.js cancelAppointment | Success | ✅ |
| `appointment.hospital_date_required` | hospitalId and date are required | appointment.controller.js getAvailableSlots | Validation | ✅ |
| `appointment.appointment_id_required` | Appointment ID is required | appointment.controller.js cancelAppointment/getAppointmentById/rescheduleAppointment | Validation | ❌ |
| `appointment.date_required` | New date is required | appointment.controller.js rescheduleAppointment | Validation | ❌ |
| `appointment.hospital_date_required_book` | hospitalId and appointmentDate are required | appointment.controller.js bookAppointment | Validation | ❌ |
| `appointment.invalid_appointment_id` | Invalid appointment ID | appointment.controller.js, appointment.service.js | Error | ✅ |
| `appointment.invalid_date` | Invalid date | appointment.controller.js getAvailableSlots | Validation | ✅ |
| `appointment.invalid_donation_type` | Invalid donation type | appointment.controller.js, appointment.service.js | Validation | ✅ |
| `appointment.not_found` | Appointment not found | appointment.controller.js, appointment.service.js | Error | ✅ |
| `appointment.cannot_cancel` | This appointment cannot be cancelled | appointment.controller.js cancelAppointment | Error | ✅ |
| `appointment.already_exists` | You already have an active appointment at this hospital | appointment.service.js:625/726, appointment.controller.js | Error | ❌ |
| `appointment.already_completed` | Appointment has already been completed | donation.controller.js | Error | ✅ |
| `appointment.hospital_not_found` | Hospital not found | appointment.controller.js bookAppointment/getAvailableSlots | Error | ❌ |
| `appointment.date_must_be_future` | Appointment date must be in the future | appointment.controller.js bookAppointment | Validation | ❌ |
| `appointment.date_invalid` | Appointment date is invalid | appointment.controller.js bookAppointment | Validation | ❌ |
| `appointment.min_advance_hours` | Appointment must be at least 24 hours in advance | appointment.controller.js bookAppointment | Validation | ❌ |
| `appointment.max_advance_days` | Appointment cannot be more than 30 days in advance | appointment.controller.js bookAppointment | Validation | ❌ |
| `appointment.day_not_available` | Selected day is not available for appointments | appointment.controller.js bookAppointment | Validation | ❌ |
| `appointment.scheduling_disabled` | Hospital appointment scheduling is currently disabled | appointment.controller.js bookAppointment | Error | ❌ |
| `appointment.donation_type_not_supported` | Hospital does not support this donation type | appointment.controller.js bookAppointment | Error | ❌ |
| `appointment.invalid_donor_hospital_id` | Invalid donor or hospital ID | appointment.controller.js bookAppointment | Error | ❌ |
| `appointment.invalid_request_id` | Invalid request ID | appointment.controller.js bookAppointment | Error | ❌ |
| `appointment.request_not_belong` | Request does not belong to this hospital | appointment.controller.js bookAppointment | Error | ❌ |
| `appointment.request_no_longer_active` | The linked request is no longer active | appointment.controller.js bookAppointment, appointment.service.js:612/885 | Error | ❌ |
| `appointment.slot_outside_hours` | Selected time slot is outside operating hours | appointment.controller.js bookAppointment | Validation | ❌ |
| `appointment.slot_not_available` | Selected time slot is no longer available | appointment.controller.js bookAppointment | Validation | ❌ |
| `appointment.daily_capacity_reached` | Daily appointment capacity has been reached | appointment.controller.js bookAppointment | Error | ❌ |
| `appointment.hospital_suspended` | Hospital is suspended | appointment.service.js:216 | Error | ❌ |
| `appointment.hospital_not_verified` | Hospital is not verified | appointment.service.js:220 | Error | ❌ |
| `appointment.max_reschedules_reached` | This appointment has reached the maximum number of reschedules | appointment.service.js:532/903 | Error | ❌ |
| `appointment.hospital_no_reschedule` | Hospital does not allow rescheduling | appointment.service.js:520 | Error | ❌ |
| `appointment.only_pending_confirmed_reschedule` | Only pending or confirmed appointments can be rescheduled | appointment.service.js:844 | Error | ❌ |
| `appointment.same_details` | New appointment details must be different from the current appointment | appointment.service.js:881 | Validation | ❌ |
| `appointment.cancelled` | Appointment cancelled | locale | Success | ✅ |
| `appointment.error_hospital_date_required` | hospitalId and date are required | locale | Validation | ✅ |
| `appointment.error_date_required` | date is required | locale | Validation | ✅ |
| `appointment.error_already_confirmed` | Donation has already been confirmed for this appointment | locale | Error | ✅ |
| `appointment.error_completed_cannot_reset` | Completed appointments cannot be reset | locale | Error | ✅ |
| `appointment.error_rejected_cannot_continue` | Rejected appointments cannot continue | locale | Error | ✅ |
| `appointment.error_verification_already_updated` | Verification has already been updated | locale | Error | ✅ |
| `appointment.error_checklist_required` | Pre-donation checklist must be completed | locale | Validation | ✅ |
| `appointment.error_all_checklist_required` | All checklist items must be completed | locale | Validation | ✅ |
| `appointment.error_must_verify_before_arrival` | Appointment must be verified before confirming arrival | locale | Validation | ✅ |
| `appointment.error_must_verify_before_donation` | Appointment must be verified before confirming donation | locale | Validation | ✅ |

---

## 4. DONATION MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `donation.completed` | Donation completed successfully | donation.controller.js completeDonation | Success | ✅ |
| `donation.verified` | Donation verification started successfully | donation.controller.js verifyQr | Success | ✅ |
| `donation.arrival_confirmed` | Arrival confirmed successfully | donation.controller.js confirmVerification | Success | ✅ |
| `donation.verification_rejected` | Verification rejected successfully | donation.controller.js rejectVerification | Success | ✅ |
| `donation.verification_reset` | Verification reset successfully | donation.controller.js resetVerification | Success | ✅ |
| `donation.eligibility_checked` | Donation eligibility checked | donation.controller.js validateDonationEligibility | Success | ✅ |
| `donation.types_retrieved` | Donation types retrieved successfully | donation.controller.js getDonationTypes | Success | ✅ |
| `donation.qr_invalid` | Invalid QR code | locale | Error | ✅ |
| `donation.qr_already_used` | QR code already used | donation.controller.js | Error | ✅ |
| `donation.error_qr_token_required` | qrToken is required | locale | Validation | ✅ |
| `donation.qr_token_required` | QR token is required | donation.controller.js verifyQr | Validation | ❌ |
| `donation.appointment_or_donation_required` | Appointment ID or donation ID is required | donation.controller.js completeDonation, rejectVerification, resetVerification | Validation | ❌ |
| `donation.donor_not_eligible` | Donor not eligible | locale | Error | ✅ |
| `donation.donor_not_found` | Donor not found | donation.controller.js | Error | ✅ |
| `donation.appointment_not_found` | Appointment not found | donation.controller.js | Error | ✅ |
| `donation.invalid_appointment_id` | Invalid appointment ID | donation.controller.js completeDonation, confirmVerification | Validation | ❌ |
| `donation.appointment_cancelled` | Appointment has been cancelled | donation.controller.js ensureAppointmentIsActive | Error | ❌ |
| `donation.appointment_already_completed` | Appointment has already been completed | donation.controller.js ensureAppointmentIsActive | Error | ❌ |
| `donation.appointment_not_active` | Appointment status is not active. Only pending or confirmed appointments can proceed | donation.controller.js ensureAppointmentIsActive | Error | ❌ |
| `donation.appointment_rejected` | Appointment verification was rejected | donation.controller.js ensureAppointmentIsActive | Error | ❌ |
| `donation.qr_expired` | QR code expired | donation.controller.js ensureAppointmentIsActive, validateDonationStatus | Error | ❌ |
| `donation.must_verify_before_donation` | Appointment must be verified before confirming donation | donation.controller.js completeDonation | Error | ❌ |
| `donation.checklist_required` | Pre-donation checklist must be completed | donation.controller.js completeDonation | Error | ❌ |
| `donation.already_confirmed` | Donation has already been confirmed for this appointment | donation.controller.js completeDonation | Error | ❌ |
| `donation.already_completed` | Donation has already been completed | donation.controller.js completeDonation | Error | ❌ |
| `donation.invalid_donation_id` | Invalid donation ID | donation.controller.js completeDonation | Validation | ❌ |
| `donation.donation_not_found` | Donation not found | donation.controller.js completeDonation | Error | ❌ |
| `donation.invalid_status` | Invalid donation status | donation.service.js:121, donation.controller.js completeDonation | Error | ❌ |
| `donation.completed_requires_completed_appointment` | Completed donation requires a completed appointment | donation.controller.js completeDonation | Error | ❌ |
| `donation.hospital_date_required_eligibility` | hospitalId and date are required | donation.controller.js validateDonationEligibility | Validation | ❌ |
| `donation.invalid_date` | Invalid date | donation.controller.js validateDonationEligibility | Validation | ❌ |
| `donation.already_booked` | You already have a booking for this hospital and date | donation.controller.js validateDonationEligibility | Error | ❌ |
| `donation.request_cancelled` | Donation request is cancelled | donation.controller.js validateDonationStatus | Error | ❌ |
| `donation.request_expired` | Donation request has expired | donation.controller.js validateDonationStatus | Error | ❌ |
| `donation.request_abandoned` | Donation request was abandoned | donation.controller.js validateDonationStatus | Error | ❌ |
| `donation.verification_rejected_status` | Donation verification was rejected | donation.controller.js validateDonationStatus | Error | ❌ |
| `donation.qr_already_used_status` | QR code already used | donation.controller.js validateDonationStatus/validateAppointmentStatus | Error | ❌ |
| `donation.no_appointment_found_qr` | No appointment or donation found with the provided QR code | donation.controller.js verifyQr | Error | ❌ |
| `donation.valid_appointment_id_required` | Valid appointment ID is required | donation.controller.js confirmVerification | Validation | ❌ |
| `donation.verification_session_required` | verificationSessionId is required | donation.controller.js confirmVerification | Validation | ❌ |
| `donation.disease_screening_required` | Disease screening must be completed | donation.controller.js confirmVerification | Validation | ❌ |
| `donation.invalid_verification_session` | Invalid verification session | donation.controller.js confirmVerification | Error | ❌ |
| `donation.donor_deferred_disease` | Donor deferred due to disqualifying disease | donation.controller.js confirmVerification | Error | ❌ |
| `donation.invalid_id` | Invalid ID | donation.controller.js rejectVerification/resetVerification | Validation | ❌ |
| `donation.appointment_or_donation_not_found` | Appointment or Donation not found | donation.controller.js rejectVerification/resetVerification | Error | ❌ |
| `donation.already_rejected` | Donation has already been rejected | donation.controller.js rejectVerification | Error | ❌ |
| `donation.already_cancelled_donation` | Donation is already cancelled | donation.controller.js rejectVerification | Error | ❌ |
| `donation.donation_expired` | Donation has expired | donation.controller.js rejectVerification | Error | ❌ |
| `donation.appointment_cancelled_status` | Appointment is already cancelled | donation.controller.js rejectVerification | Error | ❌ |
| `donation.completed_cannot_reset` | Completed donations cannot be reset | donation.controller.js resetVerification | Error | ❌ |
| `donation.expired_cannot_reset` | Expired donations cannot be reset | donation.controller.js resetVerification | Error | ❌ |
| `donation.cancelled_cannot_reset` | Cancelled donations cannot be reset | donation.controller.js resetVerification | Error | ❌ |
| `donation.completed_appointment_cannot_reset` | Completed appointments cannot be reset | donation.controller.js resetVerification | Error | ❌ |
| `donation.donor_already_responded` | Donor has already responded to this request | donation.service.js:101 | Error | ❌ |
| `donation.scheduled_requires_appointment` | Scheduled donation requires an appointment | donation.service.js:139 | Error | ❌ |
| `donation.scheduled_date_future` | Scheduled date must be in the future | donation.service.js:179 | Error | ❌ |
| `donation.hemoglobin_required` | hemoglobinLevel is required | donation-completion.service.js:42 | Validation | ❌ |
| `donation.hemoglobin_range` | hemoglobinLevel must be between 12.5 and 20 | donation-completion.service.js:44 | Validation | ❌ |
| `donation.weight_required` | weight is required | donation-completion.service.js:51 | Validation | ❌ |
| `donation.weight_minimum` | weight must be at least 50 kg | donation-completion.service.js:53 | Validation | ❌ |
| `donation.units_collected_invalid` | unitsCollected must be either 1 or 2 | donation-completion.service.js:58 | Validation | ❌ |
| `donation.safety_validation_failed` | Safety validation failed: {reason} | donation-completion.service.js:145/306 | Error | ❌ |

---

## 5. HOSPITAL MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `hospital.profile_retrieved` | Hospital profile retrieved successfully | hospital.controller.js getProfile | Success | ✅ |
| `hospital.profile_updated` | Hospital profile updated successfully | hospital.controller.js updateProfile | Success | ✅ |
| `hospital.profile_not_found` | Hospital profile not found | hospital.controller.js | Error | ✅ |
| `hospital.created` | Hospital created successfully | hospital.controller.js createHospital | Success | ✅ |
| `hospital.request_created` | Donation request created successfully | hospital.controller.js createRequestFromHospital | Success | ✅ |
| `hospital.requests_retrieved` | Requests retrieved successfully | hospital.controller.js getRequests | Success | ✅ |
| `hospital.request_details_retrieved` | Request details retrieved successfully | hospital.controller.js getRequestDetails | Success | ✅ |
| `hospital.request_status_updated` | Request status updated successfully | locale | Success | ✅ |
| `hospital.request_closed` | Request closed successfully | locale | Success | ✅ |
| `hospital.request_cancelled` | Request cancelled successfully | hospital.controller.js deleteRequest | Success | ❌ |
| `hospital.donations_retrieved` | Donations retrieved successfully | hospital.controller.js getDonations | Success | ✅ |
| `hospital.nearby_donors_retrieved` | Nearby donors retrieved successfully | hospital.controller.js findDonors | Success | ✅ |
| `hospital.request_not_found` | Request not found | hospital.controller.js | Error | ❌ |
| `hospital.unauthorized_access` | Unauthorized access to this request | hospital.controller.js | Error | ❌ |
| `hospital.donor_id_request_id_required` | donorId and requestId must be valid ids | hospital.controller.js confirmDonation | Validation | ❌ |
| `hospital.active_response_not_found` | Active donor response not found | hospital.controller.js confirmDonation | Error | ❌ |
| `hospital.request_not_accepted` | Request must be accepted or in-progress before confirming donation | hospital.controller.js confirmDonation | Error | ❌ |
| `hospital.donor_not_found_confirm` | Donor not found | hospital.controller.js confirmDonation | Error | ❌ |
| `hospital.donation_confirmed` | Donation confirmed | hospital.controller.js confirmDonation | Success | ❌ |
| `hospital.invalid_status_update` | Valid status is required. Allowed values: pending, accepted, in-progress, completed, cancelled, expired | hospital.controller.js updateRequest | Validation | ❌ |
| `hospital.cannot_complete_no_donation` | Cannot complete request: no completed donation found for this request. Use cancel instead. | hospital.controller.js updateRequest | Error | ❌ |
| `hospital.cannot_accept_without_donation` | Cannot mark request accepted without an accepted donation | hospital.controller.js updateRequest | Error | ❌ |
| `hospital.blood_type_required_request` | Blood type is required for blood or double red cells requests | hospital.controller.js updateRequest | Validation | ❌ |
| `hospital.urgency_invalid` | Urgency must be low, medium, high, or critical | hospital.controller.js updateRequest | Validation | ❌ |
| `hospital.required_date_invalid` | Required date must be a valid date | hospital.controller.js updateRequest | Validation | ❌ |
| `hospital.required_date_future` | Required date must be in the future | hospital.controller.js updateRequest | Validation | ❌ |
| `hospital.units_minimum` | Units needed must be at least 1 | hospital.controller.js updateRequest | Validation | ❌ |
| `hospital.contact_number_invalid` | Contact number must be a valid phone number | hospital.controller.js updateRequest | Validation | ❌ |
| `hospital.password_change_fields_required` | currentPassword, newPassword, and confirmPassword are required | hospital.controller.js changePassword | Validation | ❌ |
| `hospital.password_mismatch` | newPassword and confirmPassword must match | hospital.controller.js changePassword | Validation | ❌ |
| `hospital.password_updated` | Password updated successfully | hospital.controller.js changePassword | Success | ❌ |
| `hospital.appointments_retrieved` | Appointments retrieved successfully | hospital.controller.js getAppointments | Success | ❌ |
| `hospital.appointment_id_required` | Appointment ID is required | hospital.controller.js getAppointmentDetails | Validation | ❌ |
| `hospital.appointment_retrieved` | Appointment retrieved successfully | hospital.controller.js getAppointmentDetails | Success | ❌ |
| `hospital.monthly_report_retrieved` | Monthly report retrieved successfully | hospital.controller.js getMonthlyReports | Success | ✅ |
| `hospital.activity_retrieved` | Hospital activity retrieved successfully | hospital.controller.js getActivity | Success | ❌ |
| `hospital.request_history_retrieved` | Request history retrieved successfully | hospital.controller.js getRequestHistory | Success | ❌ |
| `hospital.invalid_status_filter` | Invalid status filter. Allowed values: pending, accepted, in-progress, completed, cancelled, expired | hospital.controller.js getRequestHistory | Validation | ❌ |
| `hospital.email_already_registered` | Email already registered | hospital.controller.js createHospital, hospital.service.js:30 | Error | ❌ |
| `hospital.contact_required_before_request` | Hospital contact number is required before creating a request | hospital.controller.js createRequestFromHospital | Error | ❌ |
| `hospital.appointment_booked` | Appointment booked successfully | hospital.controller.js bookDonorAppointment | Success | ❌ |
| `hospital.donor_id_required` | Donor ID is required | hospital.controller.js bookDonorAppointment | Validation | ❌ |
| `hospital.lat_lng_required_admin` | lat and lng are required for admin and superadmin users | hospital.controller.js findDonors | Validation | ❌ |
| `hospital.coordinates_required` | Hospital coordinates are required to search for donors | hospital.controller.js findDonors | Validation | ❌ |
| `hospital.lat_invalid` | lat must be a valid number between -90 and 90 | hospital.controller.js applyLocationFields | Validation | ❌ |
| `hospital.lng_invalid` | lng must be a valid number between -180 and 180 | hospital.controller.js applyLocationFields | Validation | ❌ |
| `hospital.working_hours_start_invalid` | workingHoursStart must be an integer between 0 and 23 | hospital.controller.js applyWorkingHoursFields | Validation | ❌ |
| `hospital.working_hours_end_invalid` | workingHoursEnd must be an integer between 0 and 23 | hospital.controller.js applyWorkingHoursFields | Validation | ❌ |
| `hospital.slots_per_hour_invalid` | slotsPerHour must be a positive integer | hospital.controller.js applyWorkingHoursFields | Validation | ❌ |

---

## 6. REQUEST MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `request.details_retrieved` | Request details retrieved successfully | request.controller.js getRequestDetails | Success | ✅ |
| `request.nearby_retrieved` | Nearby requests retrieved successfully | request.controller.js getNearbyRequests | Success | ✅ |
| `request.location_retrieved` | Request location retrieved successfully | request.controller.js getRequestGoogleMaps | Success | ✅ |
| `request.accepted` | Request accepted successfully | locale | Success | ✅ |
| `request.cancelled` | Request cancelled successfully | request.controller.js cancelRequest | Success | ✅ |
| `request.qr_generated` | QR generated successfully | locale | Success | ✅ |
| `request.qr_verified` | QR verified successfully | request.controller.js verifyQr | Success | ✅ |
| `request.qr_verification_completed` | QR verification completed | request.controller.js verifyQr | Success | ✅ |
| `request.not_found` | Request not found | request.controller.js | Error | ✅ |
| `request.invalid_id` | Invalid request id | locale | Error | ✅ |
| `request.unauthorized` | Unauthorized | request.controller.js verifyQr/cancelRequest/confirmRequest/rejectRequest | Error | ✅ |
| `request.unauthorized_access` | Unauthorized access to this request | request.controller.js getRequestDetails/rejectRequest | Error | ✅ |
| `request.qr_expired` | QR code has expired | request.controller.js verifyQr | Error | ❌ |
| `request.qr_already_used` | QR code has already been used | request.controller.js verifyQr | Error | ❌ |
| `request.qr_token_invalid` | Invalid or expired QR token | request.controller.js verifyQr | Error | ❌ |
| `request.qr_no_associated_request` | Invalid QR token - no associated request | request.controller.js verifyQr | Error | ❌ |
| `request.donor_not_found_qr` | Donor no longer exists | request.controller.js verifyQr | Error | ❌ |
| `request.request_no_longer_active` | Request is no longer active | request.controller.js verifyQr | Error | ❌ |
| `request.donation_not_valid` | Donation is no longer valid for verification | request.controller.js verifyQr | Error | ❌ |
| `request.invalid_id_format` | Invalid request ID format | request.controller.js | Validation | ❌ |
| `request.location_unavailable` | Request location is not available | request.controller.js getRequestGoogleMaps | Error | ✅ |
| `request.expired` | Request has expired | locale | Error | ✅ |
| `request.no_longer_available` | Request is no longer available | locale | Error | ✅ |
| `request.already_accepted` | Request has already been accepted | locale | Error | ✅ |
| `request.already_responded` | You have already responded to this request | request.controller.js acceptRequest | Error | ✅ |
| `request.donor_role_required` | Access denied - donor role required | request.controller.js acceptRequest/getAcceptedRequests/getAcceptedRequestDetails | Error | ✅ |
| `request.response_submitted` | Response submitted | request.controller.js acceptRequest | Success | ❌ |
| `request.fully_accepted` | Request fully accepted | request.controller.js acceptRequest | Success | ❌ |
| `request.cannot_cancel_stage` | Request cannot be cancelled at this stage | request.controller.js cancelRequest | Error | ❌ |
| `request.cancel_own_only` | You can only cancel your own accepted request | request.controller.js cancelRequest | Error | ✅ |
| `request.no_active_donation` | No active donation found for this request | request.controller.js cancelRequest/getAcceptedRequestDetails | Error | ❌ |
| `request.cannot_cancel_after_qr` | Cannot cancel after the hospital has scanned your QR code | request.controller.js cancelRequest | Error | ❌ |
| `request.donation_cancelled_reopened` | Donation cancelled — request reopened for other donors | request.controller.js cancelRequest | Info | ❌ |
| `request.cannot_cancel_completed` | Cannot cancel a request that is already completed, cancelled, or expired | request.controller.js cancelRequest | Error | ❌ |
| `request.must_be_accepted_to_confirm` | Request must be in accepted or in-progress status to confirm | request.controller.js confirmRequest | Error | ❌ |
| `request.no_donor_accepted` | No donor has accepted this request | request.controller.js confirmRequest | Error | ❌ |
| `request.donation_not_found` | Associated donation not found | request.controller.js confirmRequest | Error | ❌ |
| `request.donor_not_found_confirm` | Associated donor not found | request.controller.js confirmRequest | Error | ❌ |
| `request.arrival_deadline_passed` | Arrival deadline has passed — confirmation no longer accepted | request.controller.js confirmRequest | Error | ❌ |
| `request.qr_expired_confirm` | QR code has expired — confirmation no longer accepted | request.controller.js confirmRequest | Error | ❌ |
| `request.donor_no_longer_eligible` | Donor is no longer eligible. Request has been reopened for other donors. | request.controller.js confirmRequest | Info | ❌ |
| `request.confirmed_and_completed` | Donation confirmed and completed successfully | request.controller.js confirmRequest | Success | ❌ |
| `request.accepted_list_retrieved` | Accepted requests retrieved successfully | request.controller.js getAcceptedRequests | Success | ❌ |
| `request.accepted_details_retrieved` | Accepted request details retrieved successfully | request.controller.js getAcceptedRequestDetails | Success | ❌ |
| `request.no_accepted_donation` | Request has no accepted donation to reject | request.controller.js rejectRequest | Error | ❌ |
| `request.rejected_success` | Request rejected successfully | request.controller.js rejectRequest | Success | ❌ |
| `request.donor_id_required` | Donor ID is required | request.service.js:91 | Validation | ❌ |
| `request.request_id_required` | Request ID is required | request.service.js:92 | Validation | ❌ |
| `request.donor_not_found_service` | Donor not found | request.service.js:95 | Error | ❌ |
| `request.request_not_found_service` | Request not found | request.service.js:105 | Error | ❌ |
| `request.expired_deadline` | Request has expired — the deadline has passed | request.service.js:112 | Error | ❌ |
| `request.no_longer_accepting` | Request is no longer accepting responses | request.service.js:117/148 | Error | ❌ |
| `request.units_exceed_needed` | Request only needs {units} units — cannot accept {donationQuantity} more | request.service.js:160 | Error | ❌ |
| `request.you_already_responded` | You have already responded to this request | request.service.js:128/208 | Error | ❌ |
| `request.fulfilled` | Request is already fulfilled | admin.service.js:1549 | Error | ❌ |
| `request.already_cancelled_admin` | Request is already cancelled | admin.service.js:1574 | Error | ❌ |

---

## 7. VALIDATION MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `validation.field_required` | {fieldName} is required | validation/auth.validation.js:142 | Validation | ❌ |
| `validation.field_invalid_date` | {fieldName} must be a valid date | validation/auth.validation.js:155 | Validation | ❌ |
| `validation.field_must_be_number` | {fieldName} must be a number | validation/auth.validation.js:164 | Validation | ❌ |
| `validation.field_min_length` | {fieldName} must be at least {n} characters long | validation/auth.validation.js:170 | Validation | ❌ |
| `validation.field_max_length` | {fieldName} must be at most {n} characters long | validation/auth.validation.js:175 | Validation | ❌ |
| `validation.field_format_invalid` | {fieldName} format is invalid | validation/auth.validation.js:180 | Validation | ❌ |
| `validation.field_must_be_one_of` | {fieldName} must be one of: {list} | validation/auth.validation.js:185 | Validation | ❌ |
| `validation.field_validation_failed` | {fieldName} validation failed | validation/auth.validation.js:190 | Validation | ❌ |
| `validation.full_name_invalid` | fullName can contain Arabic and English letters, spaces, dots, and dashes only | validation/auth.validation.js:42 | Validation | ❌ |
| `validation.phone_11_digits` | Phone number must be 11 digits | validation/auth.validation.js:65 | Validation | ❌ |
| `validation.blood_type_invalid` | bloodType must be one of A+, A-, B+, B-, AB+, AB-, O+, O- | validation/auth.validation.js:81 | Validation | ❌ |
| `validation.hospital_name_invalid` | hospitalName can contain Arabic and English letters, spaces, dots, and dashes only | validation/auth.validation.js:96 | Validation | ❌ |
| `validation.address_invalid` | address can contain Arabic and English letters, spaces, dots, and dashes only | validation/auth.validation.js:108 | Validation | ❌ |
| `validation.current_password_required` | currentPassword is required | validation/auth.validation.js:251 | Validation | ❌ |
| `validation.confirm_password_required` | confirmPassword is required | validation/auth.validation.js:263/304 | Validation | ❌ |
| `validation.confirm_password_must_match` | confirmPassword must match newPassword | validation/auth.validation.js:265 | Validation | ❌ |
| `validation.new_password_must_differ` | newPassword must be different from currentPassword | validation/auth.validation.js:274 | Validation | ❌ |
| `validation.confirm_password_must_match_register` | confirmPassword must match password | validation/auth.validation.js:306 | Validation | ❌ |
| `validation.lat_required` | lat must be a valid number | validation/request.validation.js:16 | Validation | ❌ |
| `validation.lat_range` | lat must be between -90 and 90 | validation/request.validation.js:18 | Validation | ❌ |
| `validation.lng_required` | lng must be a valid number | validation/request.validation.js:24 | Validation | ❌ |
| `validation.lng_range` | lng must be between -180 and 180 | validation/request.validation.js:26 | Validation | ❌ |
| `validation.lat_lng_together` | lat and lng must be provided together | validation/request.validation.js:33 | Validation | ❌ |
| `validation.radius_positive` | radius must be a positive number | validation/request.validation.js:37 | Validation | ❌ |
| `validation.limit_range` | limit must be an integer between 1 and 100 | validation/request.validation.js:40 | Validation | ❌ |
| `validation.page_positive` | page must be a positive integer | validation/request.validation.js:43 | Validation | ❌ |
| `validation.request_id_required` | Request ID is required | validation/request.validation.js:52 | Validation | ❌ |
| `validation.qr_token_required` | qrToken is required | validation/request.validation.js:60 | Validation | ❌ |
| `validation.enabled_boolean_required` | enabled (boolean) is required | validation/admin.validation.js:14 | Validation | ❌ |
| `validation.message_must_be_string` | message must be a string | validation/admin.validation.js:18 | Validation | ❌ |
| `validation.role_enum` | role must be one of: {roles} | validation/admin.validation.js:32 | Validation | ❌ |
| `validation.page_positive_int` | page must be a positive integer | validation/admin.validation.js:36 | Validation | ❌ |
| `validation.limit_between` | limit must be between 1 and 100 | validation/admin.validation.js:40 | Validation | ❌ |
| `validation.ban_reason_required` | reason (string) is required | validation/admin.validation.js:53 | Validation | ❌ |
| `validation.ban_reason_length` | reason must be less than 500 characters | validation/admin.validation.js:57 | Validation | ❌ |
| `validation.hospital_name_required` | name (or fullName/hospitalName) is required | validation/admin.validation.js:72 | Validation | ❌ |
| `validation.valid_email_required` | Valid email is required | validation/admin.validation.js:76 | Validation | ❌ |
| `validation.password_min_length` | Password must be at least 8 characters | validation/admin.validation.js:80 | Validation | ❌ |
| `validation.phone_required` | phone (or adminContactPhone/emergencyContactNumber) is required | validation/admin.validation.js:85 | Validation | ❌ |
| `validation.hospital_id_string` | hospitalId (or hospitalCode) must be a string | validation/admin.validation.js:90 | Validation | ❌ |
| `validation.lat_range_admin` | Valid latitude (or lat) must be between -90 and 90 | validation/admin.validation.js:96 | Validation | ❌ |
| `validation.lng_range_admin` | Valid longitude (or long/lng) must be between -180 and 180 | validation/admin.validation.js:99 | Validation | ❌ |
| `validation.type_string` | type must be a string | validation/admin.validation.js:103 | Validation | ❌ |
| `validation.full_name_required` | fullName is required | validation/admin.validation.js:119 | Validation | ❌ |
| `validation.phone_string` | phone must be a string | validation/admin.validation.js:135 | Validation | ❌ |
| `validation.name_required` | name is required | validation/admin.validation.js:149 | Validation | ❌ |
| `validation.type_required` | type is required | validation/admin.validation.js:153 | Validation | ❌ |
| `validation.phone_required_create` | phone is required | validation/admin.validation.js:161 | Validation | ❌ |
| `validation.blood_banks_array` | bloodBanksAvailable must be an array | validation/admin.validation.js:171 | Validation | ❌ |
| `validation.invalid_blood_type_val` | Invalid blood type: {bloodType} | validation/admin.validation.js:175 | Validation | ❌ |
| `validation.capacity_number` | capacity must be a number | validation/admin.validation.js:182 | Validation | ❌ |
| `validation.status_enum` | status must be one of: {statuses} | validation/admin.validation.js:198 | Validation | ❌ |
| `validation.urgency_enum` | urgency must be one of: {urgencies} | validation/admin.validation.js:202 | Validation | ❌ |
| `validation.blood_type_enum` | bloodType must be one of: {types} | validation/admin.validation.js:206 | Validation | ❌ |
| `validation.full_name_string` | fullName must be a string | validation/admin.validation.js:224 | Validation | ❌ |
| `validation.valid_email` | Valid email is required | validation/admin.validation.js:228 | Validation | ❌ |
| `validation.key_required` | {key} is required | validation/reward.validation.js:10 | Validation | ❌ |
| `validation.nested_key_required` | {label}.{key} is required | validation/reward.validation.js:19 | Validation | ❌ |
| `validation.nested_key_number` | {label}.{key} must be a number | validation/reward.validation.js:25 | Validation | ❌ |
| `validation.bronze_non_negative` | tiers.bronze must be greater than or equal to 0 | validation/reward.validation.js:31 | Validation | ❌ |
| `validation.nested_key_positive` | {label}.{key} must be a positive number | validation/reward.validation.js:37 | Validation | ❌ |
| `validation.ascending_order` | {label}.{key2} must be greater than {label}.{key1} | validation/reward.validation.js:46 | Validation | ❌ |
| `validation.invalid_blood_type_hospital` | Invalid blood type. Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O- | validation/hospital.validation.js:64 | Validation | ❌ |
| `validation.radius_positive_km` | radiusKm must be a positive number | validation/hospital.validation.js:68 | Validation | ❌ |
| `validation.lat_range_hospital` | lat must be between -90 and 90 | validation/hospital.validation.js:72 | Validation | ❌ |
| `validation.lng_range_hospital` | lng must be between -180 and 180 | validation/hospital.validation.js:76 | Validation | ❌ |
| `validation.lat_lng_together_hospital` | lat and lng must be provided together | validation/hospital.validation.js:80 | Validation | ❌ |
| `validation.participation_boolean` | participation filter must be a boolean value (true or false) | validation/hospital.validation.js:84 | Validation | ❌ |
| `validation.appointment_date_required` | appointmentDate is required | validation/hospital.validation.js:97 | Validation | ❌ |
| `validation.invalid_donation_type_hospital` | Invalid donation type | validation/hospital.validation.js:102 | Validation | ❌ |
| `validation.request_type_urgency_required` | Type, urgency or emergency flag, and requiredBy/date are required | validation/hospital.validation.js:117 | Validation | ❌ |
| `validation.request_type_enum` | Type must be blood, plasma, platelets, or double_red_cells | validation/hospital.validation.js:122 | Validation | ❌ |
| `validation.urgency_enum_hospital` | Urgency must be low, medium, high, or critical | validation/hospital.validation.js:126 | Validation | ❌ |
| `validation.patient_type_enum` | patientType must be one of: {types} | validation/hospital.validation.js:130 | Validation | ❌ |
| `validation.patient_details_enum` | patientDetails must be one of: {details} | validation/hospital.validation.js:134 | Validation | ❌ |
| `validation.blood_type_required_request` | Blood type is required for blood or double red cells donation requests | validation/hospital.validation.js:138 | Validation | ❌ |
| `validation.blood_type_at_least_one` | Blood type must include at least one valid blood type | validation/hospital.validation.js:143 | Validation | ❌ |
| `validation.required_date_valid` | Required date must be a valid date | validation/hospital.validation.js:159 | Validation | ❌ |
| `validation.required_date_future` | Required date must be in the future | validation/hospital.validation.js:161 | Validation | ❌ |
| `validation.unexpected_fields` | Unexpected field(s): {fields} | validation/hospital.validation.js:177 | Validation | ❌ |
| `validation.blood_type_required_emergency` | bloodType is required | validation/hospital.validation.js:181 | Validation | ❌ |
| `validation.units_needed_required` | unitsNeeded is required and must be a positive integer | validation/hospital.validation.js:186 | Validation | ❌ |
| `validation.is_emergency_true` | isEmergency must be true | validation/hospital.validation.js:194 | Validation | ❌ |
| `validation.blood_type_valid` | bloodType must be a valid blood type | validation/hospital.validation.js:199 | Validation | ❌ |

---

## 8. ELIGIBILITY MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `eligibility.date_of_birth_required` | Date of birth is required | eligibility.service.js, Donor.model.js | Validation | ✅ |
| `eligibility.minimum_age` | You must be at least 17 years old to donate | eligibility.service.js | Validation | ✅ |
| `eligibility.invalid_date_of_birth` | Date of birth must be a valid past date | eligibility.service.js | Validation | ✅ |
| `eligibility.age_verification_failed` | Unable to verify age from date of birth | eligibility.service.js | Error | ✅ |
| `eligibility.donor_not_found` | Donor not found | matching.service.js | Error | ✅ |
| `eligibility.donor_or_request_not_found` | Donor or request not found | matching.service.js | Error | ✅ |
| `eligibility.donor_opted_out` | Donor opted out of matching | eligibility.service.js | Info | ✅ |
| `eligibility.donor_no_blood_type` | Donor has not provided blood type information | eligibility.service.js | Info | ✅ |
| `eligibility.blood_type_incompatible` | Donor blood type is not compatible with the request | eligibility.service.js | Info | ✅ |
| `eligibility.matching_location_unavailable` | Matching location is not available | eligibility.service.js | Info | ✅ |
| `eligibility.outside_matching_radius` | Donor is outside the matching radius | eligibility.service.js | Info | ✅ |
| `eligibility.request_not_found` | Request not found | eligibility.service.js | Error | ✅ |
| `eligibility.donor_eligible` | Donor is eligible | eligibility.service.js | Success | ✅ |
| `eligibility.donor_not_eligible` | Donor is not eligible | eligibility.service.js | Info | ✅ |
| `eligibility.no_deferral` | No temporary deferral | eligibility.service.js | Info | ✅ |
| `eligibility.deferral_expired` | Temporary deferral expired | eligibility.service.js | Info | ✅ |
| `eligibility.temporarily_deferred` | Temporarily deferred | eligibility.service.js | Info | ✅ |
| `eligibility.travel_deferral` | Travel to high-risk country | eligibility.service.js | Info | ✅ |
| `eligibility.no_interval_restriction` | No donation interval restriction | eligibility.service.js | Info | ✅ |
| `eligibility.invalid_last_donation_ignored` | Invalid last donation date ignored | eligibility.service.js | Info | ✅ |
| `eligibility.donation_cooldown` | You need to wait before donating again | eligibility.service.js | Info | ✅ |
| `eligibility.interval_satisfied` | Donation interval satisfied | eligibility.service.js | Info | ✅ |
| `eligibility.no_hemoglobin_restriction` | No hemoglobin restriction | eligibility.service.js | Info | ✅ |
| `eligibility.hemoglobin_below_minimum` | Low hemoglobin level | eligibility.service.js | Info | ✅ |
| `eligibility.hemoglobin_acceptable` | Hemoglobin level acceptable | eligibility.service.js | Info | ✅ |
| `eligibility.donor_suspended` | Donor is suspended | eligibility.service.js | Info | ✅ |
| `eligibility.donor_unavailable` | Donor is currently unavailable | eligibility.service.js | Info | ✅ |
| `eligibility.request_no_longer_active` | The linked request is no longer active | eligibility.service.js | Info | ✅ |
| `eligibility.donor_deleted` | Donor account is deleted or inactive | eligibility.service.js:208 | Error | ❌ |
| `eligibility.donor_suspended_account` | Donor account is suspended | eligibility.service.js:215 | Error | ❌ |
| `eligibility.donor_chronic_conditions` | Donor has chronic medical conditions | eligibility.service.js:222 | Error | ❌ |
| `eligibility.active_donation_in_progress` | Donor already has an active donation in progress | eligibility.service.js:229 | Error | ❌ |
| `eligibility.invalid_donor_role` | Invalid donor role | matching.service.js:211 | Error | ❌ |
| `eligibility.already_completed_or_rejected` | Donor has already completed or rejected this request | matching.service.js:273 | Info | ❌ |

---

## 9. ADMIN MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `admin.dashboard_retrieved` | Dashboard summary | admin.controller.js getDashboard | Success | ✅ |
| `admin.users_list` | Users list | admin.controller.js listUsers | Success | ✅ |
| `admin.user_details` | User details | admin.controller.js getUserById | Success | ✅ |
| `admin.user_verified` | User verified successfully | locale | Success | ✅ |
| `admin.user_unverified` | User unverified successfully | locale | Success | ✅ |
| `admin.user_suspended` | User suspended successfully | locale | Success | ✅ |
| `admin.user_unsuspended` | User unsuspended successfully | locale | Success | ✅ |
| `admin.user_deleted` | User deleted successfully | admin.controller.js deleteUser | Success | ✅ |
| `admin.donor_banned` | Donor banned successfully | locale | Success | ✅ |
| `admin.donor_unbanned` | Donor unbanned successfully | locale | Success | ✅ |
| `admin.donor_updated` | Donor updated successfully | admin.controller.js updateDonor | Success | ✅ |
| `admin.hospital_created` | Hospital created successfully | admin.controller.js createHospital | Success | ✅ |
| `admin.admin_list` | Admins list | admin.controller.js listAdmins | Success | ✅ |
| `admin.admin_details` | Admin details | admin.controller.js getAdminById | Success | ✅ |
| `admin.admin_profile` | Admin profile | admin.controller.js getAdminProfile | Success | ✅ |
| `admin.admin_created` | Admin created successfully | admin.controller.js createAdmin | Success | ✅ |
| `admin.admin_updated` | Admin updated successfully | admin.controller.js updateAdmin | Success | ✅ |
| `admin.admin_deleted` | Admin deleted successfully | admin.controller.js deleteAdmin | Success | ✅ |
| `admin.requests_list` | Requests list | admin.controller.js listRequests | Success | ✅ |
| `admin.request_details` | Request details | admin.controller.js getRequestDetails | Success | ✅ |
| `admin.request_donations` | Request donations | admin.controller.js getRequestDonations | Success | ✅ |
| `admin.request_cancelled` | Request cancelled | admin.controller.js cancelRequest | Success | ✅ |
| `admin.request_fulfilled` | Request marked as fulfilled | admin.controller.js fulfillRequest | Success | ✅ |
| `admin.blood_inventory` | Blood inventory summary | locale | Success | ✅ |
| `admin.shortage_alerts` | Shortage alerts | admin.controller.js getShortageAlerts | Success | ✅ |
| `admin.alerts_retrieved` | Alerts retrieved successfully | admin.controller.js getAlerts | Success | ✅ |
| `admin.donation_trends` | Donation trends | locale | Success | ✅ |
| `admin.growth_metrics` | Growth metrics | locale | Success | ✅ |
| `admin.statistics_summary` | Statistics summary | locale | Success | ✅ |
| `admin.top_donors` | Top donors | admin.controller.js getTopDonors | Success | ✅ |
| `admin.critical_requests` | Critical requests | admin.controller.js getCriticalRequests | Success | ✅ |
| `admin.system_health` | System health | admin.controller.js getSystemHealth | Success | ✅ |
| `admin.maintenance_status` | Maintenance status | admin.controller.js getMaintenanceStatus | Success | ✅ |
| `admin.maintenance_updated` | Maintenance mode updated | admin.controller.js setMaintenanceMode | Success | ✅ |
| `admin.broadcast_sent` | Broadcast sent | admin.controller.js broadcastRequest | Success | ✅ |
| `admin.emergency_broadcast_sent` | Emergency broadcast sent | locale | Success | ✅ |
| `admin.audit_logs` | Audit logs | admin.controller.js getAuditLogs | Success | ✅ |
| `admin.roles_retrieved` | Roles retrieved successfully | admin.controller.js listRolePermissions | Success | ✅ |
| `admin.role_retrieved` | Role retrieved successfully | admin.controller.js getRolePermissionDetails | Success | ✅ |
| `admin.role_created` | Role created successfully | admin.controller.js createRolePermission | Success | ✅ |
| `admin.role_updated` | Role permissions updated successfully | admin.controller.js updateRolePermissions | Success | ✅ |
| `admin.role_deleted` | Role deleted successfully | admin.controller.js deleteRolePermission | Success | ✅ |
| `admin.inbound_emails_retrieved` | Inbound emails retrieved successfully | admin.controller.js listInboundEmails | Success | ✅ |
| `admin.inbound_email_retrieved` | Inbound email retrieved successfully | admin.controller.js getInboundEmailById | Success | ✅ |
| `admin.inbound_email_read` | Inbound email marked as read | admin.controller.js markInboundEmailRead | Success | ✅ |
| `admin.inbound_email_archived` | Inbound email archived | admin.controller.js archiveInboundEmail | Success | ✅ |
| `admin.inbound_email_deleted` | Inbound email deleted successfully | admin.controller.js deleteInboundEmail | Success | ✅ |
| `admin.not_found` | Admin not found | admin.controller.js getAdminById/updateAdmin/deleteAdmin/rotateAdminKey | Error | ✅ |
| `admin.profile_not_found` | Admin profile not found | admin.controller.js getAdminProfile/updateAdminProfile | Error | ✅ |
| `admin.user_not_found` | User not found | admin.controller.js getUserById/deleteUser/banUser/unbanUser | Error | ✅ |
| `admin.donor_not_found` | Donor not found | admin.controller.js getDonorById/updateDonor | Error | ✅ |
| `admin.hospital_not_found` | Hospital not found | admin.controller.js getHospitalById/updateHospital | Error | ✅ |
| `admin.request_not_found` | Request not found | admin.controller.js getRequestDetails/broadcastRequest/fulfillRequest/cancelRequest | Error | ✅ |
| `admin.role_not_found` | Role not found | admin.controller.js | Error | ✅ |
| `admin.role_already_exists` | Role already exists | admin.controller.js createRolePermission | Error | ✅ |
| `admin.role_is_system` | System roles cannot be modified | admin.controller.js createRolePermission/updateRolePermissions | Error | ✅ |
| `admin.cannot_delete_self` | Admins cannot delete their own account | admin.controller.js deleteAdmin | Error | ✅ |
| `admin.donor_already_banned` | Donor is already banned | admin.controller.js banUser | Error | ✅ |
| `admin.donor_not_banned` | Donor is not currently banned | admin.controller.js unbanUser | Error | ✅ |
| `admin.invalid_action` | action must be suspend or unsuspend | locale | Validation | ✅ |
| `admin.error_role_display_required` | role and displayName are required | admin.controller.js createRolePermission | Validation | ✅ |
| `admin.invalid_inbound_id` | Invalid inbound email id | admin.controller.js | Validation | ✅ |
| `admin.inbound_not_found` | Inbound email not found | admin.controller.js | Error | ✅ |
| `admin.email_change_verify` | Email changed — check your inbox to re-verify your address | admin.controller.js updateAdminProfile | Info | ❌ |
| `admin.email_in_use` | Email is already in use by another account | admin.service.js:974 | Error | ❌ |
| `admin.email_cannot_change` | Email cannot be changed via the admin endpoint. Users must use the self-service profile flow. | admin.controller.js/updateDonor/updateHospital/updateAdmin | Error | ❌ |
| `admin.role_cannot_change` | Role changes are not supported. The role field cannot be updated. | admin.controller.js updateAdmin | Error | ❌ |
| `admin.only_superadmin_ban` | Only superadmin can ban admin accounts | admin.controller.js banUser | Error | ❌ |
| `admin.only_superadmin_unban` | Only superadmin can unban admin accounts | admin.controller.js unbanUser | Error | ❌ |
| `admin.only_superadmin_create` | Only superadmin can create admin accounts | admin.controller.js createAdmin | Error | ❌ |
| `admin.cannot_suspend_admin` | Cannot suspend admin accounts | errorCodes.js | Error | ❌ |
| `admin.cannot_delete_admin` | Cannot delete admin accounts | errorCodes.js, admin.service.js:656 | Error | ❌ |
| `admin.cannot_delete_self_account` | Cannot delete your own account | admin.service.js:1009 | Error | ❌ |
| `admin.cannot_delete_admin_endpoint` | Admin/Superadmin accounts cannot be deleted through this endpoint | admin.controller.js deleteUser | Error | ❌ |
| `admin.invalid_admin_role` | Invalid admin role | admin.service.js:826 | Error | ❌ |
| `admin.superadmin_limit_reached` | Superadmin limit reached (max {max}). Demote an existing superadmin before creating a new one. | admin.service.js:835 | Error | ❌ |
| `admin.key_rotated` | Admin key rotated successfully. The new key is shown only once — store it securely. | admin.controller.js rotateAdminKey | Success | ❌ |
| `admin.permissions_object_required` | permissions must be an object | admin.service.js:1110 | Validation | ❌ |
| `admin.unknown_permission_keys` | Unknown permission keys: {keys}. Allowed: {allowed} | admin.service.js:1116 | Validation | ❌ |
| `admin.role_required` | role is required | admin.service.js:1127 | Validation | ❌ |
| `admin.cannot_delete_system_role` | Cannot delete a system role | admin.controller.js deleteRolePermission | Error | ❌ |
| `admin.system_settings_retrieved` | System settings retrieved | admin.controller.js getSystemSettings | Success | ❌ |
| `admin.system_settings_updated` | System settings updated successfully | admin.controller.js updateSystemSettings | Success | ❌ |
| `admin.admin_user_not_found` | Admin user not found | admin.controller.js getSystemSettings | Error | ❌ |
| `admin.rewards_retrieved` | Rewards data retrieved successfully | admin.controller.js getAdminRewards | Success | ❌ |
| `admin.reward_fields_required` | rewardName, category, and pointsRequired are required | admin.controller.js createReward | Validation | ❌ |
| `admin.reward_created` | Reward created successfully | admin.controller.js createReward | Success | ❌ |
| `admin.status_required` | status is required | admin.controller.js updateRewardStatus | Validation | ❌ |
| `admin.status_invalid` | Status must be ACTIVE, INACTIVE, or LIMITED | admin.controller.js updateRewardStatus | Validation | ❌ |
| `admin.reward_not_found` | Reward not found | admin.controller.js updateRewardStatus | Error | ❌ |
| `admin.reward_status_updated` | Reward status updated successfully | admin.controller.js updateRewardStatus | Success | ❌ |
| `admin.updates_array_required` | updates array must have at least one entry | admin.controller.js bulkUpdateRewardPoints | Validation | ❌ |
| `admin.each_update_required` | Each update must have an id and pointsRequired number | admin.controller.js bulkUpdateRewardPoints | Validation | ❌ |
| `admin.reward_points_updated` | Reward points updated successfully | admin.controller.js bulkUpdateRewardPoints | Success | ❌ |
| `admin.amount_reason_required` | amount and reason are required | admin.controller.js adjustUserPoints | Validation | ❌ |
| `admin.amount_non_zero` | amount must be a non-zero number | admin.controller.js adjustUserPoints | Validation | ❌ |
| `admin.points_adjusted` | Points adjusted successfully | admin.controller.js adjustUserPoints | Success | ❌ |
| `admin.support_messages_retrieved` | Support messages retrieved successfully | admin.controller.js listSupportMessages | Success | ❌ |
| `admin.support_message_not_found` | Support message not found | admin.controller.js | Error | ❌ |
| `admin.support_message_retrieved` | Support message retrieved successfully | admin.controller.js getSupportMessageById | Success | ❌ |
| `admin.support_message_reviewed` | Support message marked as reviewed | admin.controller.js reviewSupportMessage | Success | ❌ |
| `admin.reply_required` | reply is required | admin.controller.js replySupportMessage | Validation | ❌ |
| `admin.support_reply_saved` | Support reply saved successfully | admin.controller.js replySupportMessage | Success | ❌ |
| `admin.badges_retrieved` | Badges retrieved successfully | admin.controller.js getBadges | Success | ❌ |
| `admin.badge_id_invalid` | Invalid badge ID | admin.controller.js updateBadge | Validation | ❌ |
| `admin.badge_threshold_invalid` | unlockThreshold must be a number greater than or equal to 1 | admin.controller.js updateBadge | Validation | ❌ |
| `admin.badge_points_invalid` | pointsReward/bonusPoints must be a non-negative number | admin.controller.js updateBadge | Validation | ❌ |
| `admin.badge_field_required` | At least one field to update is required | admin.controller.js updateBadge | Validation | ❌ |
| `admin.badge_not_found` | Badge not found | admin.controller.js updateBadge | Error | ❌ |
| `admin.badge_updated` | Badge updated successfully | admin.controller.js updateBadge | Success | ❌ |
| `admin.user_already_banned` | User is already banned | admin.controller.js banUser, errorCodes.js | Error | ❌ |
| `admin.user_not_banned` | User is not banned | admin.controller.js unbanUser, errorCodes.js | Error | ❌ |

---

## 10. NOTIFICATION MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `notification.retrieved` | Notifications retrieved successfully | notification.controller.js getNotifications | Success | ✅ |
| `notification.marked_read` | Notification marked as read | notification.controller.js markNotificationRead | Success | ✅ |
| `notification.all_marked_read` | All notifications marked as read | notification.controller.js markAllNotificationsRead | Success | ✅ |
| `notification.deleted` | Notification deleted successfully | notification.controller.js deleteNotificationById | Success | ✅ |
| `notification.all_deleted` | All notifications deleted successfully | notification.controller.js deleteAllNotifications | Success | ✅ |
| `notification.retrieved_single` | Notification retrieved successfully | notification.controller.js getNotificationById | Success | ✅ |
| `notification.invalid_id` | Invalid notification ID | notification.controller.js | Validation | ❌ |
| `notification.not_found` | Notification not found | notification.controller.js | Error | ✅ |
| `notification.new_donor_matched_title` | New Donor Matched | notification.service.js:29 | Notification | ❌ |
| `notification.new_donor_matched_body` | A donor has matched your {label} request | notification.service.js:31 | Notification | ❌ |
| `notification.achievement_unlocked_title` | Achievement Unlocked: {title} | notification.service.js:231 | Notification | ❌ |
| `notification.achievement_unlocked_body` | Congratulations! You've unlocked: {title} | notification.service.js:232 | Notification | ❌ |
| `notification.appointment_booked_title` | New Appointment Booked | notification.service.js:714 | Notification | ❌ |
| `notification.appointment_booked_body` | A donor has booked an appointment for {date} | notification.service.js:715 | Notification | ❌ |
| `notification.appointment_cancelled_title` | Appointment cancelled by donor | notification.service.js:794 | Notification | ❌ |
| `notification.appointment_cancelled_body` | {name} cancelled their appointment on {date} | notification.service.js:795 | Notification | ❌ |
| `notification.support_reply_title` | Support Reply Received | admin.service.js:1449 | Notification | ❌ |
| `notification.support_reply_body` | Your support request "{subject}" has been answered. | admin.service.js:1450 | Notification | ❌ |
| `notification.urgent_blood_request_title` | Urgent Blood Request | admin.service.js:1627/1650 | Notification | ❌ |
| `notification.urgent_blood_request_body` | {hospital} needs {bloodType} donors urgently. {urgency} priority. | admin.service.js:1628/1651 | Notification | ❌ |
| `notification.accept_push_title` | Proceed to Hospital | request.controller.js sendAcceptNotifications | Notification | ❌ |
| `notification.accepted_full_push_title` | Request Fully Accepted | request.controller.js sendAcceptNotifications | Notification | ❌ |
| `notification.donor_pledged_push_title` | New Donor Pledged | request.controller.js sendAcceptNotifications | Notification | ❌ |
| `notification.request_reopened_title` | Request reopened | request.controller.js cancelRequest | Notification | ❌ |
| `notification.auto_cancelled_donor_title` | Donation Cancelled | scripts/auto-cancel-stale-donations.mjs | Notification | ❌ |
| `notification.auto_cancelled_donor_body` | Your donation pledge has been automatically cancelled due to not scheduling an appointment within 14 days. | scripts/auto-cancel-stale-donations.mjs | Notification | ❌ |
| `notification.auto_cancelled_hospital_title` | Donor Cancelled Pledge | scripts/auto-cancel-stale-donations.mjs | Notification | ❌ |
| `notification.auto_cancelled_hospital_body` | A donor's pledge for your request has been automatically cancelled due to not scheduling an appointment. | scripts/auto-cancel-stale-donations.mjs | Notification | ❌ |
| `notification.request_manual_intervention_title` | Manual Intervention Required | scripts/request-escalation-worker.mjs | Notification | ❌ |
| `notification.request_manual_intervention_body` | Your donation request has failed to attract donors after multiple re-broadcasts. Please intervene manually. | scripts/request-escalation-worker.mjs | Notification | ❌ |
| `notification.donor_arrival_timeout_title` | Donor Arrival Timeout | scripts/request-escalation-worker.mjs | Notification | ❌ |
| `notification.donor_arrival_timeout_body` | The donor who accepted your request for {bloodTypes} failed to arrive within the deadline. The request has been re-broadcasted. | scripts/request-escalation-worker.mjs | Notification | ❌ |
| `notification.account_suspended_title` | Account Suspended | src/utils/missed-donation.js | Notification | ❌ |
| `notification.account_suspended_body` | Your account has been suspended due to 3 missed donations. Please contact support to reactivate. | src/utils/missed-donation.js | Notification | ❌ |
| `notification.missed_donation_warning_title` | Missed Donation Warning | src/utils/missed-donation.js | Notification | ❌ |
| `notification.missed_donation_warning_body` | You have {count} missed donation(s). After {remaining} more, your account will be suspended. | src/utils/missed-donation.js | Notification | ❌ |

---

## 11. REWARD MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `reward.points_retrieved` | Points retrieved successfully | reward.controller.js getPoints | Success | ✅ |
| `reward.dashboard_retrieved` | Rewards dashboard retrieved | reward.controller.js getRewardsDashboard | Success | ✅ |
| `reward.stats_retrieved` | Rewards stats retrieved | reward.controller.js getRewardsStats | Success | ✅ |
| `reward.history_retrieved` | Points history retrieved successfully | reward.controller.js getPointsHistory | Success | ✅ |
| `reward.catalog_retrieved` | Rewards retrieved successfully | reward.controller.js getRewards | Success | ✅ |
| `reward.earning_rules_retrieved` | Reward earning rules retrieved successfully | reward.controller.js getEarningRules | Success | ✅ |
| `reward.redeemed_success` | Reward redeemed successfully | reward.controller.js redeemReward | Success | ✅ |
| `reward.redemptions_retrieved` | Redemptions retrieved successfully | reward.controller.js getRedemptions | Success | ✅ |
| `reward.history_retrieved2` | Reward history retrieved successfully | reward.controller.js getHistory | Success | ✅ |
| `reward.badges_retrieved` | Badges retrieved successfully | reward.controller.js getBadges | Success | ✅ |
| `reward.leaderboard_retrieved` | Leaderboard retrieved successfully | reward.controller.js getLeaderboard | Success | ✅ |
| `reward.points_adjusted` | Points adjusted successfully | locale | Success | ✅ |
| `reward.status_updated` | Reward status updated | locale | Success | ✅ |
| `reward.analytics_retrieved` | Rewards analytics retrieved | reward.controller.js adminGetRewardsAnalytics | Success | ✅ |
| `reward.config_retrieved` | Rewards config retrieved successfully | locale | Success | ✅ |
| `reward.config_updated` | Rewards config updated successfully | locale | Success | ✅ |
| `reward.insufficient_points` | Insufficient points | reward.service.js:632 | Error | ✅ |
| `reward.insufficient_points_detail` | Insufficient points. You have {balance} but need {cost}. | reward.service.js:581 | Error | ❌ |
| `reward.not_found` | Reward not found | reward.service.js:578/779 | Error | ❌ |
| `reward.not_available` | Reward is not available | reward.service.js:579/603 | Error | ❌ |
| `reward.daily_limit_reached` | Daily redemption limit reached for this reward | reward.service.js:612 | Error | ❌ |
| `reward.monthly_limit_reached` | Monthly redemption limit reached for this reward | reward.service.js:622 | Error | ❌ |
| `reward.amount_cannot_be_zero` | Amount cannot be zero | reward.service.js:730 | Validation | ❌ |
| `reward.negative_balance` | Adjustment would result in negative balance | reward.service.js:744/755 | Error | ❌ |
| `reward.error_amount_reason_required` | Amount and reason are required | locale | Validation | ✅ |
| `reward.error_invalid_status` | Status must be ACTIVE, INACTIVE, or LIMITED | locale | Validation | ✅ |

---

## 12. EMAIL TEMPLATE MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `email.verify_subject` | Verify Your LifeLink Email | emailTemplates.js, mailer.js | Email | ✅ |
| `email.reset_subject` | Reset Your LifeLink Password | emailTemplates.js | Email | ✅ |
| `email.otp_subject` | Your LifeLink Password Reset Code | emailTemplates.js | Email | ✅ |
| `email.welcome_subject` | Welcome to LifeLink! | mailer.js | Email | ❌ |
| `email.password_changed_subject` | Your LifeLink password was changed | mailer.js | Email | ❌ |
| `email.email_verified_subject` | Your LifeLink email is verified | mailer.js | Email | ❌ |
| `email.support_reply_subject` | Re: {subject} — LifeLink Support | mailer.js | Email | ❌ |
| `email.verify_preheader` | Your LifeLink verification code is {otp}. It expires in {minutes} minutes. | emailTemplates.js | Email | ❌ |
| `email.verify_heading` | Account verification | emailTemplates.js | Email | ❌ |
| `email.verify_title` | Your Verification Code | emailTemplates.js | Email | ❌ |
| `email.verify_greeting` | Hello {name}, | emailTemplates.js | Email | ❌ |
| `email.verify_instruction` | Use the one-time code below to verify your email address and activate your LifeLink account. | emailTemplates.js | Email | ❌ |
| `email.verify_code_label` | Verification code | emailTemplates.js | Email | ❌ |
| `email.verify_expiry` | This code expires in {minutes} minutes. | emailTemplates.js | Email | ❌ |
| `email.reset_title` | Reset Your Password | emailTemplates.js | Email | ❌ |
| `email.reset_instruction` | We received a request to reset your LifeLink password. Use the secure link below to choose a new password. | emailTemplates.js | Email | ❌ |
| `email.reset_button_text` | Reset Password | emailTemplates.js | Email | ❌ |
| `email.reset_fallback_link` | If the button does not open, copy this link into your browser: | emailTemplates.js | Email | ❌ |
| `email.reset_ignore` | If you did not request a password reset, you can ignore this email and your password will remain unchanged. | emailTemplates.js | Email | ❌ |
| `email.otp_title` | Your Password Reset Code | emailTemplates.js | Email | ❌ |
| `email.otp_greeting` | Hello {name}, | emailTemplates.js | Email | ❌ |
| `email.otp_instruction` | Use the one-time code below to verify your password reset request in LifeLink. This code is for password reset only and cannot be used to sign in. | emailTemplates.js | Email | ❌ |
| `email.otp_code_label` | Reset code | emailTemplates.js | Email | ❌ |
| `email.otp_expiry` | This code expires in {minutes} minutes. | emailTemplates.js | Email | ❌ |
| `email.otp_security` | Enter this code in the password reset screen to continue. Do not share it with anyone. | emailTemplates.js | Email | ❌ |
| `email.otp_ignore` | If you did not request a password reset, ignore this email. Your LifeLink account stays secure unless someone also has access to your email. | emailTemplates.js | Email | ❌ |
| `email.password_changed_preheader` | Your LifeLink password was changed successfully. | emailTemplates.js | Email | ❌ |
| `email.password_changed_heading` | Security alert | emailTemplates.js | Email | ❌ |
| `email.password_changed_title` | Password Changed | emailTemplates.js | Email | ❌ |
| `email.password_changed_body` | Your LifeLink account password was changed successfully. If you made this change, no further action is needed. | emailTemplates.js | Email | ❌ |
| `email.password_changed_cta` | Did not change your password? | emailTemplates.js | Email | ❌ |
| `email.password_changed_support` | Contact our support team immediately at support@lifelink.eg to secure your account. | emailTemplates.js | Email | ❌ |
| `email.verified_preheader` | Your LifeLink email address has been verified. Welcome! | emailTemplates.js | Email | ❌ |
| `email.verified_heading` | Account verified | emailTemplates.js | Email | ❌ |
| `email.verified_title` | Email Verified ✓ | emailTemplates.js | Email | ❌ |
| `email.verified_body` | Your email address has been verified successfully. Your LifeLink account is now fully active and ready to use. | emailTemplates.js | Email | ❌ |
| `email.verified_welcome` | Welcome to LifeLink! | emailTemplates.js | Email | ❌ |
| `email.verified_cta` | You can now schedule donations and help save lives. | emailTemplates.js | Email | ❌ |
| `email.verified_unknown` | If you did not create a LifeLink account, please contact us at support@lifelink.eg. | emailTemplates.js | Email | ❌ |
| `email.support_reply_preheader` | Your support request "{subject}" has received a response from the LifeLink team. | emailTemplates.js | Email | ❌ |
| `email.support_reply_heading` | Support reply | emailTemplates.js | Email | ❌ |
| `email.support_reply_title` | We've Responded to Your Request | emailTemplates.js | Email | ❌ |
| `email.support_reply_body` | Our support team has replied to your request: {subject} | emailTemplates.js | Email | ❌ |
| `email.support_reply_label` | Support team reply | emailTemplates.js | Email | ❌ |
| `email.support_reply_original` | Your original message | emailTemplates.js | Email | ❌ |
| `email.support_reply_footer` | If you need further assistance, you can submit a new support request in the LifeLink app. | emailTemplates.js | Email | ❌ |
| `email.footer_disclaimer` | This message was sent by LifeLink. If you were not expecting it, you can safely ignore it. | emailTemplates.js | Email | ❌ |
| `email.welcome_greeting` | Hello {name}, | mailer.js | Email | ❌ |
| `email.welcome_body` | Welcome to LifeLink! We're glad to have you. | mailer.js | Email | ❌ |
| `email.welcome_cta` | Your account is ready to use. | mailer.js | Email | ❌ |
| `email.welcome_support` | If you have any questions, feel free to reach out to our support team. | mailer.js | Email | ❌ |

---

## 13. SYSTEM & ERROR MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `error.unauthorized` | Unauthorized | role.middleware.js, auth.middleware.js, errorCodes.js | Error | ✅ |
| `error.forbidden` | Forbidden | role.middleware.js, errorCodes.js | Error | ✅ |
| `error.not_found` | Resource not found | errorCodes.js | Error | ✅ |
| `error.internal_server` | Internal server error | error.middleware.js | Error | ✅ |
| `error.validation_failed` | Validation failed | error.middleware.js, errorCodes.js | Error | ✅ |
| `error.invalid_id` | Invalid ID | error.middleware.js, errorCodes.js | Error | ✅ |
| `error.request_failed` | Request failed | error.middleware.js | Error | ❌ |
| `error.too_many_requests` | Too many requests, please try again later | rateLimit.middleware.js | Error | ❌ |
| `error.maintenance_mode` | System is under maintenance. Please try again later. | maintenance.middleware.js | Error | ❌ |
| `error.duplicate_field` | Duplicate {field} | error.middleware.js | Error | ❌ |
| `error.token_expired` | Token has expired | error.middleware.js | Error | ❌ |
| `error.invalid_token` | Invalid token | error.middleware.js | Error | ❌ |
| `error.route_not_found` | {method} {path} not found | app.js 404 handler | Error | ❌ |

---

## 14. DISCOVERY MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `discovery.hospitals_retrieved` | Hospitals retrieved successfully | discovery.controller.js listHospitals | Success | ✅ |
| `discovery.hospitals_map_retrieved` | Hospitals retrieved successfully for map | discovery.controller.js getHospitalsForMap | Success | ✅ |
| `discovery.nearby_hospitals_retrieved` | Nearby hospitals retrieved successfully | discovery.controller.js getNearbyHospitals | Success | ✅ |
| `discovery.hospital_searched` | Hospitals searched successfully | discovery.controller.js searchHospitals | Success | ✅ |
| `discovery.hospital_retrieved` | Hospital retrieved successfully | discovery.controller.js getHospitalById | Success | ✅ |
| `discovery.hospital_not_found` | Hospital not found | discovery.controller.js getHospitalById | Error | ✅ |
| `discovery.invalid_hospital_id` | Invalid hospital ID | discovery.controller.js getHospitalById | Validation | ❌ |
| `discovery.radius_positive` | radius_km must be a positive number | discovery.controller.js getNearbyHospitals | Validation | ❌ |
| `discovery.invalid_blood_type` | Invalid blood type. Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O- | discovery.controller.js | Validation | ❌ |

---

## 15. HELP & SUPPORT MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `help.faq_retrieved` | FAQ retrieved successfully | help.controller.js getFaq | Success | ✅ |
| `help.document_retrieved` | Document retrieved successfully | help.controller.js getDocument | Success | ✅ |
| `help.support_submitted` | Support request submitted successfully | help.controller.js contactSupport | Success | ✅ |
| `help.document_not_found` | Document not found | help.controller.js getDocument | Error | ✅ |
| `help.subject_message_required` | subject and message are required | help.controller.js contactSupport | Validation | ✅ |
| `help.identity_fields_forbidden` | Identity fields cannot be provided in the request body | help.controller.js contactSupport | Validation | ❌ |
| `help.subject_category_message_required` | subject, category, and message are required | help.controller.js contactSupport | Validation | ❌ |
| `help.tickets_retrieved` | Support tickets retrieved successfully | help.controller.js getMyTickets | Success | ❌ |
| `help.invalid_ticket_id` | Invalid ticket ID | help.controller.js getMyTicketById | Validation | ❌ |
| `help.ticket_not_found` | Support ticket not found | help.controller.js getMyTicketById | Error | ❌ |
| `help.ticket_retrieved` | Support ticket retrieved successfully | help.controller.js getMyTicketById | Success | ❌ |

---

## 16. ACTIVITY MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `activity.timeline_retrieved` | Activity timeline retrieved successfully | activity.controller.js getTimeline | Success | ✅ |
| `activity.invalid_page` | Page must be a positive integer | activity.controller.js getTimeline | Validation | ✅ |
| `activity.invalid_limit` | Limit must be a positive integer | activity.controller.js getTimeline | Validation | ✅ |
| `activity.invalid_type` | Invalid type filter: {type} | locale | Validation | ✅ |
| `activity.earned_points` | {points} Points Earned — {reason} | locale | Notification | ✅ |
| `activity.tier_promoted` | Tier Promoted | locale | Notification | ✅ |
| `activity.badge_unlocked` | Badge Unlocked | locale | Notification | ✅ |
| `activity.redeemed_reward` | Reward Redeemed | locale | Notification | ✅ |
| `activity.donation_created` | Donation Created | locale | Notification | ✅ |
| `activity.donation_verified` | Donation Verified | locale | Notification | ✅ |
| `activity.donation_confirmed` | Donation Confirmed | locale | Notification | ✅ |
| `activity.donation_completed` | Donation Completed | locale | Notification | ✅ |
| `activity.donation_cancelled` | Donation Cancelled | locale | Notification | ✅ |
| `activity.user_id_required` | userId is required | activity.service.js:65 | Validation | ❌ |
| `activity.type_required` | payload.type is required | activity.service.js:66 | Validation | ❌ |
| `activity.action_required` | payload.action is required | activity.service.js:67 | Validation | ❌ |
| `activity.title_required` | payload.title is required | activity.service.js:68 | Validation | ❌ |
| `activity.description_required` | payload.description is required | activity.service.js:69 | Validation | ❌ |

---

## 17. ANALYTICS MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `analytics.stats_retrieved` | Analytics retrieved successfully | analytics.controller.js | Success | ✅ |
| `analytics.donor_stats_retrieved` | Donor stats retrieved | analytics.controller.js getMyStats | Success | ❌ |
| `analytics.leaderboard_retrieved` | Leaderboard retrieved | analytics.controller.js getLeaderboard | Success | ❌ |
| `analytics.donation_type_stats` | Donation type stats retrieved | analytics.controller.js getDonationTypeStats | Success | ❌ |
| `analytics.dashboard_summary` | Dashboard summary retrieved | analytics.controller.js getDashboardSummary | Success | ❌ |
| `analytics.overview_retrieved` | Analytics overview retrieved | analytics.controller.js getAnalyticsOverview | Success | ❌ |
| `analytics.top_donors` | Top donors | analytics.controller.js getTopDonors | Success | ❌ |
| `analytics.critical_need_alert` | Critical need for {bloodTypes} | analytics.service.js:140 | Notification | ❌ |
| `analytics.critical_need_description` | Critical request for {bloodTypes} blood type(s). | analytics.service.js:142 | Notification | ❌ |
| `analytics.predicted_high_demand` | Predicted High Demand | analytics.service.js | Insight | ❌ |
| `analytics.demand_increase` | A {pct}% increase in blood requests is predicted next week. | analytics.service.js:218 | Insight | ❌ |
| `analytics.rising_demand` | Rising Demand Trend | analytics.service.js:221 | Insight | ❌ |
| `analytics.rising_demand_desc` | Blood requests are trending upward. Prepare additional resources. | analytics.service.js:221 | Insight | ❌ |
| `analytics.declining_demand` | Declining Demand | analytics.service.js:224 | Insight | ❌ |
| `analytics.declining_demand_desc` | Blood requests are declining. Review inventory allocation. | analytics.service.js:224 | Insight | ❌ |
| `analytics.shortage_risk` | Shortage Risk | analytics.service.js:235 | Insight | ❌ |
| `analytics.shortage_risk_desc` | {bloodType} blood stock is expected to deplete within the next 4 days. | analytics.service.js:235 | Insight | ❌ |
| `analytics.supply_warning` | Supply Warning | analytics.service.js:238 | Insight | ❌ |
| `analytics.supply_warning_desc` | {bloodType} blood supply is approaching critical levels. | analytics.service.js:238 | Insight | ❌ |
| `analytics.peak_day_insight` | Peak Day Insight | analytics.service.js:256 | Insight | ❌ |
| `analytics.peak_day_desc` | {day} shows {pct}% higher donation activity. Consider scheduling more drives on this day. | analytics.service.js:256 | Insight | ❌ |
| `analytics.retention_alert` | Donor Retention Alert | analytics.service.js:267 | Insight | ❌ |
| `analytics.retention_alert_desc` | Donor return rate has dropped significantly. Consider re-engagement campaigns. | analytics.service.js:267 | Insight | ❌ |
| `analytics.retention_positive` | Donor Growth Positive | analytics.service.js:270 | Insight | ❌ |
| `analytics.retention_positive_desc` | More donors are returning compared to last month. Momentum is strong. | analytics.service.js:270 | Insight | ❌ |
| `analytics.emergency_surge` | Emergency Demand Spike | analytics.service.js:280 | Insight | ❌ |
| `analytics.emergency_surge_desc` | Blood demand has surged unexpectedly in the last 3 days. Emergency response may be needed. | analytics.service.js:280 | Insight | ❌ |
| `analytics.donor_not_found` | Donor not found | analytics.service.js:472 | Error | ❌ |

---

## 18. UI LABELS

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `ui.accept` | Accept | emergency-notification.js | UI | ✅ |
| `ui.decline` | Decline | locale | UI | ✅ |
| `ui.view_details` | View Details | emergency-notification.js, locale | UI | ✅ |
| `ui.cancel` | Cancel | locale | UI | ✅ |
| `ui.confirm` | Confirm | locale | UI | ✅ |
| `ui.save` | Save | locale | UI | ✅ |
| `ui.submit` | Submit | locale | UI | ✅ |
| `ui.retry` | Retry | locale | UI | ✅ |
| `ui.loading` | Loading... | locale | UI | ✅ |
| `ui.no_results` | No results found | locale | UI | ✅ |
| `ui.emergency_requests` | Emergency Requests | locale | UI | ✅ |
| `ui.urgent_requests` | Urgent Requests | locale | UI | ✅ |
| `ui.donation_completed_success` | Donation completed successfully | locale | UI | ✅ |
| `ui.donation_verified_success` | Donation verified successfully | locale | UI | ✅ |
| `ui.donation_confirmed_success` | Donation confirmed successfully | locale | UI | ✅ |
| `ui.reward_redeemed_success` | Reward redeemed successfully | locale | UI | ✅ |
| `ui.profile_completed` | Profile Completed | locale | UI | ✅ |

---

## 19. PATIENT TYPE LABELS

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `patient_types.surgery` | Surgery | locale | UI | ✅ |
| `patient_types.accident` | Accident | locale | UI | ✅ |
| `patient_types.cancer` | Oncology | locale | UI | ✅ |
| `patient_types.maternity` | Maternity | locale | UI | ✅ |
| `patient_types.chronic_illness` | Chronic Illness | locale | UI | ✅ |
| `patient_types.emergency` | Emergency | locale | UI | ✅ |
| `patient_types.general` | General Transfusion | locale | UI | ✅ |
| `patient_types.cardiac_surgery` | Cardiac Surgery | locale | UI | ✅ |
| `patient_types.burns` | Severe Burns | locale | UI | ✅ |
| `patient_types.leukemia` | Leukemia | locale | UI | ✅ |
| `patient_types.hemophilia` | Hemophilia | locale | UI | ✅ |
| `patient_types.thalassemia` | Thalassemia | locale | UI | ✅ |
| `patient_types.dialysis` | Kidney Dialysis | locale | UI | ✅ |
| `patient_types.gastrointestinal_bleeding` | GI Bleeding | locale | UI | ✅ |
| `patient_types.organ_transplant` | Organ Transplant | locale | UI | ✅ |
| `patient_types.pediatric` | Pediatric Patient | locale | UI | ✅ |

---

## 20. DISEASE LABELS

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `disease.hiv_aids` | HIV/AIDS | constants/disease.constants.js | UI | ❌ |
| `disease.hepatitis_b` | Hepatitis B | constants/disease.constants.js | UI | ❌ |
| `disease.hepatitis_c` | Hepatitis C | constants/disease.constants.js | UI | ❌ |
| `disease.syphilis` | Syphilis | constants/disease.constants.js | UI | ❌ |
| `disease.malaria_active` | Malaria (active) | constants/disease.constants.js | UI | ❌ |
| `disease.tuberculosis_active` | Tuberculosis (active) | constants/disease.constants.js | UI | ❌ |
| `disease.cancer` | Cancer | constants/disease.constants.js | UI | ❌ |
| `disease.heart_disease` | Heart disease | constants/disease.constants.js | UI | ❌ |
| `disease.bleeding_disorder` | Bleeding disorder | constants/disease.constants.js | UI | ❌ |
| `disease.epilepsy` | Epilepsy / seizures | constants/disease.constants.js | UI | ❌ |
| `disease.diabetes_insulin` | Diabetes (insulin-dependent) | constants/disease.constants.js | UI | ❌ |
| `disease.chronic_kidney` | Chronic kidney disease | constants/disease.constants.js | UI | ❌ |
| `disease.chronic_liver` | Chronic liver disease | constants/disease.constants.js | UI | ❌ |
| `disease.autoimmune` | Autoimmune disease | constants/disease.constants.js | UI | ❌ |
| `disease.schizophrenia` | Schizophrenia | constants/disease.constants.js | UI | ❌ |
| `disease.recent_infection` | Recent infection / fever | constants/disease.constants.js | UI | ❌ |
| `disease.other` | Other disqualifying condition | constants/disease.constants.js | UI | ❌ |

---

## 21. DONATION TYPE LABELS

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `donation_type.whole_blood` | Whole Blood | constants/donation.constants.js | UI | ❌ |
| `donation_type.plasma` | Plasma | constants/donation.constants.js | UI | ❌ |
| `donation_type.platelets` | Platelets | constants/donation.constants.js | UI | ❌ |
| `donation_type.double_red_cells` | Double Red Cells | constants/donation.constants.js | UI | ❌ |

---

## 22. BADGE LABELS

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `badge.first_timer.name` | First Timer | locale | UI | ✅ |
| `badge.first_timer.description` | Completed your first blood donation | locale | UI | ✅ |
| `badge.regular_donor.name` | Regular Donor | locale | UI | ✅ |
| `badge.regular_donor.description` | Completed 5 blood donations | locale | UI | ✅ |
| `badge.life_saver.name` | Life Saver | locale | UI | ✅ |
| `badge.life_saver.description` | Completed 10 blood donations | locale | UI | ✅ |
| `badge.hero.name` | Hero | locale | UI | ✅ |
| `badge.hero.description` | Completed 20 blood donations | locale | UI | ✅ |
| `badge.legend.name` | Legend | locale | UI | ✅ |
| `badge.legend.description` | Completed 50 blood donations | locale | UI | ✅ |
| `badge.emergency_responder.name` | Emergency Responder | locale | UI | ✅ |
| `badge.emergency_responder.description` | Responded to 10 emergency requests | locale | UI | ✅ |
| `badge.community_helper.name` | Community Helper | locale | UI | ✅ |
| `badge.community_helper.description` | Responded to 25 emergency requests | locale | UI | ✅ |

---

## 23. RELATIVE TIME LABELS (activity.formatter.js)

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `time.just_now` | just now | utils/activity.formatter.js | UI | ❌ |
| `time.minute_ago` | 1 minute ago | utils/activity.formatter.js | UI | ❌ |
| `time.minutes_ago` | {value} minutes ago | utils/activity.formatter.js | UI | ❌ |
| `time.hour_ago` | 1 hour ago | utils/activity.formatter.js | UI | ❌ |
| `time.hours_ago` | {value} hours ago | utils/activity.formatter.js | UI | ❌ |
| `time.day_ago` | 1 day ago | utils/activity.formatter.js | UI | ❌ |
| `time.days_ago` | {value} days ago | utils/activity.formatter.js | UI | ❌ |
| `time.week_ago` | 1 week ago | utils/activity.formatter.js | UI | ❌ |
| `time.weeks_ago` | {value} weeks ago | utils/activity.formatter.js | UI | ❌ |
| `time.month_ago` | 1 month ago | utils/activity.formatter.js | UI | ❌ |
| `time.months_ago` | {value} months ago | utils/activity.formatter.js | UI | ❌ |
| `time.year_ago` | 1 year ago | utils/activity.formatter.js | UI | ❌ |
| `time.years_ago` | {value} years ago | utils/activity.formatter.js | UI | ❌ |

---

## 24. FORMAT LABELS (format.js)

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `format.distance_meters` | {distance} m | utils/format.js | UI | ❌ |
| `format.distance_kilometers` | {distance} km | utils/format.js | UI | ❌ |
| `format.time_minutes` | {minutes} min | utils/format.js | UI | ❌ |
| `format.time_hours` | {hours} h | utils/format.js | UI | ❌ |
| `format.time_hours_minutes` | {hours} h {minutes} min | utils/format.js | UI | ❌ |

---

## 25. EARNINGS RULE LABELS

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `reward.earning_rule.blood_donation` | Blood Donation | locale | UI | ✅ |
| `reward.earning_rule.plasma_donation` | Plasma Donation | locale | UI | ✅ |
| `reward.earning_rule.platelets_donation` | Platelet Donation | locale | UI | ✅ |
| `reward.earning_rule.first_donation` | First Donation Bonus | locale | UI | ✅ |
| `reward.earning_rule.emergency_response` | Emergency Response | locale | UI | ✅ |
| `reward.earning_rule.profile_completion` | Profile Completion | locale | UI | ✅ |
| `reward.earning_rule.referral` | Referral | locale | UI | ✅ |

---

## 26. TIER LABELS

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `tier.bronze` | Bronze | locale | UI | ✅ |
| `tier.silver` | Silver | locale | UI | ✅ |
| `tier.gold` | Gold | locale | UI | ✅ |
| `tier.platinum` | Platinum | locale | UI | ✅ |
| `tier.promoted_title` | 🎉 Tier Upgraded to {tier}! | locale | UI | ✅ |
| `tier.promoted_message` | Congratulations! You've reached {tier} tier. Keep donating to unlock more rewards! | locale | UI | ✅ |

---

## 27. TIER BENEFITS

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `tier.benefits.bronze.0` | Access to basic rewards | reward.service.js:457, locale | UI | ✅ |
| `tier.benefits.silver.0` | 10% more points per donation | reward.service.js:458, locale | UI | ✅ |
| `tier.benefits.silver.1` | Early access to limited rewards | reward.service.js:458, locale | UI | ✅ |
| `tier.benefits.gold.0` | 15% more points per donation | reward.service.js:459, locale | UI | ✅ |
| `tier.benefits.gold.1` | Exclusive gold rewards | reward.service.js:459, locale | UI | ✅ |
| `tier.benefits.platinum.0` | 20% more points per donation | reward.service.js:460, locale | UI | ✅ |
| `tier.benefits.platinum.1` | VIP support | reward.service.js:460, locale | UI | ✅ |
| `tier.benefits.platinum.2` | All exclusive rewards | reward.service.js:460, locale | UI | ✅ |

---

## 28. MODEL VALIDATION MESSAGES (Mongoose)

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `model.user.full_name_required` | Full name is required | User.model.js | Validation | ❌ |
| `model.user.full_name_min_length` | Full name must be at least 3 characters long | User.model.js | Validation | ❌ |
| `model.user.full_name_max_length` | Full name must be less than 100 characters long | User.model.js | Validation | ❌ |
| `model.user.email_required` | Email is required | User.model.js | Validation | ❌ |
| `model.user.email_invalid` | Invalid email address | User.model.js | Validation | ❌ |
| `model.user.password_required` | Password is required | User.model.js | Validation | ❌ |
| `model.user.password_min_length` | Minimum length of the password should be 8 | User.model.js | Validation | ❌ |
| `model.donor.phone_required` | Phone number is required | Donor.model.js | Validation | ❌ |
| `model.donor.blood_type_required` | Blood type is required | Donor.model.js | Validation | ❌ |
| `model.donor.gender_enum` | Gender must be male or female | Donor.model.js | Validation | ❌ |
| `model.donor.weight_positive` | Weight must be a positive number | Donor.model.js | Validation | ❌ |
| `model.donor.hemoglobin_positive` | Hemoglobin level must be a positive number | Donor.model.js | Validation | ❌ |
| `model.donor.health_notes_max_length` | Health history notes cannot exceed 1000 characters | Donor.model.js | Validation | ❌ |
| `model.activity.user_id_required` | User ID is required | Activity.model.js | Validation | ❌ |
| `model.activity.type_enum` | Type must be one of: {types} | Activity.model.js | Validation | ❌ |
| `model.activity.type_required` | Activity type is required | Activity.model.js | Validation | ❌ |
| `model.activity.action_required` | Action is required | Activity.model.js | Validation | ❌ |
| `model.activity.action_max_length` | Action cannot exceed 100 characters | Activity.model.js | Validation | ❌ |
| `model.activity.title_required` | Title is required | Activity.model.js | Validation | ❌ |
| `model.activity.title_max_length` | Title cannot exceed 200 characters | Activity.model.js | Validation | ❌ |
| `model.activity.description_required` | Description is required | Activity.model.js | Validation | ❌ |
| `model.activity.description_max_length` | Description cannot exceed 500 characters | Activity.model.js | Validation | ❌ |
| `model.activity.reference_type_enum` | Reference type must be one of: {types} | Activity.model.js | Validation | ❌ |
| `model.appointment.donor_id_required` | Donor ID is required | Appointment.model.js | Validation | ❌ |
| `model.appointment.hospital_id_required` | Hospital ID is required | Appointment.model.js | Validation | ❌ |
| `model.appointment.date_required` | Appointment date is required | Appointment.model.js | Validation | ❌ |
| `model.appointment.date_future` | Appointment date must be in the future | Appointment.model.js | Validation | ❌ |
| `model.appointment.notes_max_length` | Notes cannot exceed 500 characters | Appointment.model.js | Validation | ❌ |
| `model.appointment.invalid_disease_code` | Invalid disease code: {VALUE} | Appointment.model.js | Validation | ❌ |
| `model.appointment.reschedule_reason_max_length` | Reschedule reason cannot exceed 500 characters | Appointment.model.js | Validation | ❌ |
| `model.appointment.reschedule_history_max` | Reschedule history cannot exceed 10 entries | Appointment.model.js | Validation | ❌ |
| `model.audit_log.admin_id_required` | Admin ID is required | AuditLog.model.js | Validation | ❌ |
| `model.audit_log.action_required` | Action is required | AuditLog.model.js | Validation | ❌ |
| `model.audit_log.target_type_enum` | Target type must be User, Request, Donation, or System | AuditLog.model.js | Validation | ❌ |
| `model.donation.donor_id_required` | Donor ID is required | Donation.model.js | Validation | ❌ |
| `model.donation.status_enum` | Status must be pending, scheduled, completed, cancelled, rejected, expired, or abandoned | Donation.model.js | Validation | ❌ |
| `model.donation.quantity_required` | Quantity is required | Donation.model.js | Validation | ❌ |
| `model.donation.quantity_min` | Quantity must be at least 1 | Donation.model.js | Validation | ❌ |
| `model.donation.units_collected_min` | Units collected must be at least 1 | Donation.model.js | Validation | ❌ |
| `model.donation.hemoglobin_positive` | Hemoglobin level must be a positive number | Donation.model.js | Validation | ❌ |
| `model.donation.weight_positive` | Weight must be a positive number | Donation.model.js | Validation | ❌ |
| `model.donation.scheduled_date_future` | Scheduled date must be in the future | Donation.model.js | Validation | ❌ |
| `model.donation.completed_date_past` | Completed date must be in the past | Donation.model.js | Validation | ❌ |
| `model.donation.notes_max_length` | Notes cannot exceed 1000 characters | Donation.model.js | Validation | ❌ |
| `model.donation.appointment_required_schedule` | Appointment required to schedule donation | Donation.model.js | Validation | ❌ |
| `model.hospital.hospital_id_required` | Hospital ID is required | Hospital.model.js | Validation | ❌ |
| `model.hospital.slots_min` | Must have at least 1 slot per hour | Hospital.model.js | Validation | ❌ |
| `model.hospital.working_hours_start_min` | Working hours start must be between 0-23 | Hospital.model.js | Validation | ❌ |
| `model.hospital.working_hours_end_min` | Working hours end must be between 0-23 | Hospital.model.js | Validation | ❌ |
| `model.inbound_email.provider_required` | Provider is required | InboundEmail.model.js | Validation | ❌ |
| `model.notification.user_id_required` | User ID is required | Notification.model.js | Validation | ❌ |
| `model.notification.type_enum` | Type must be match, request, milestone, emergency, system, admin, or appointment | Notification.model.js | Validation | ❌ |
| `model.notification.type_required` | Notification type is required | Notification.model.js | Validation | ❌ |
| `model.notification.title_required` | Title is required | Notification.model.js | Validation | ❌ |
| `model.notification.title_max_length` | Title cannot exceed 200 characters | Notification.model.js | Validation | ❌ |
| `model.notification.message_required` | Message is required | Notification.model.js | Validation | ❌ |
| `model.notification.message_max_length` | Message cannot exceed 1000 characters | Notification.model.js | Validation | ❌ |
| `model.notification.related_type_enum` | Related type must be Request, Donation, User, Achievement, or Appointment | Notification.model.js | Validation | ❌ |
| `model.request.hospital_id_required` | Hospital ID is required | Request.model.js | Validation | ❌ |
| `model.request.type_required` | Request type is required | Request.model.js | Validation | ❌ |
| `model.request.urgency_required` | Urgency level is required | Request.model.js | Validation | ❌ |
| `model.request.required_by_required` | Required by date is required | Request.model.js | Validation | ❌ |
| `model.request.required_by_future` | Required by date must be in the future | Request.model.js | Validation | ❌ |
| `model.request.notes_max_length` | Notes cannot exceed 500 characters | Request.model.js | Validation | ❌ |
| `model.request.contact_required` | Hospital contact number is required | Request.model.js | Validation | ❌ |
| `model.request.contact_length` | Hospital contact number must be 10-11 digits long | Request.model.js | Validation | ❌ |
| `model.rewards_config.key_required` | Config key is required | RewardsConfig.model.js | Validation | ❌ |
| `model.role_permission.role_required` | Role is required | RolePermission.model.js | Validation | ❌ |
| `model.role_permission.display_name_required` | Display name is required | RolePermission.model.js | Validation | ❌ |
| `model.system_settings.key_required` | Setting key is required | SystemSettings.model.js | Validation | ❌ |
| `model.system_settings.value_required` | Setting value is required | SystemSettings.model.js | Validation | ❌ |

---

## 29. WEBHOOK MESSAGES

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `webhook.invalid_signature` | Invalid signature | webhook.controller.js | Error | ❌ |
| `webhook.malformed_payload` | Malformed payload | webhook.controller.js | Error | ❌ |
| `webhook.received` | Webhook received | webhook.controller.js | Success | ❌ |

---

## 30. APPOINTMENT DTO (donor rate limit)

| Key | Current Text | Where It's Used | Cat. | Status |
|-----|-------------|-----------------|------|--------|
| `donor_rate_limit.booking` | You can only book {limit} appointments per day | donor-rate-limit.middleware.js | Error | ❌ |
| `donor_rate_limit.cancellation` | You can only cancel {limit} appointments per day | donor-rate-limit.middleware.js | Error | ❌ |

---

## Summary Statistics

| Category | Total Messages | In `en.json` | Missing from Locale |
|----------|---------------|-------------|---------------------|
| Authentication | 50 | 11 | 39 |
| Donor | 24 | 18 | 6 |
| Appointment | 53 | 19 | 34 |
| Donation | 55 | 10 | 45 |
| Hospital | 47 | 10 | 37 |
| Request | 42 | 14 | 28 |
| Validation | 87 | 0 | 87 |
| Eligibility | 32 | 28 | 4 |
| Admin | 83 | 37 | 46 |
| Notification | 24 | 10 | 14 |
| Reward | 19 | 10 | 9 |
| Email | 49 | 4 | 45 |
| System & Error | 12 | 6 | 6 |
| Discovery | 7 | 5 | 2 |
| Help & Support | 10 | 4 | 6 |
| Activity | 14 | 8 | 6 |
| Analytics | 22 | 1 | 21 |
| UI Labels | 16 | 16 | 0 |
| Patient Types | 16 | 16 | 0 |
| Disease Labels | 17 | 0 | 17 |
| Donation Types | 4 | 0 | 4 |
| Badge Labels | 14 | 14 | 0 |
| Relative Time | 13 | 0 | 13 |
| Format Labels | 5 | 0 | 5 |
| Earnings Rules | 7 | 7 | 0 |
| Tier / Benefits | 12 | 12 | 0 |
| Model Validation | 60 | 0 | 60 |
| Webhook | 3 | 0 | 3 |
| Donor Rate Limit | 2 | 0 | 2 |
| **TOTAL** | **~790** | **~260** | **~530** |
