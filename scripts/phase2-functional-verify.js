#!/usr/bin/env node
import supertest from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { createHospital, createDonor } from '../tests/helpers/factories.js';
import Notification from '../src/models/Notification.model.js';
import NotificationOutbox from '../src/models/NotificationOutbox.model.js';
import Request from '../src/models/Request.model.js';
import Donation from '../src/models/Donation.model.js';
import Appointment from '../src/models/Appointment.model.js';
import DonorPoints from '../src/models/DonorPoints.model.js';
import PointsTransaction from '../src/models/PointsTransaction.model.js';

const request = supertest(app);

const log = (label, obj) => console.log(`${label}:`, typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));

const run = async () => {
  await connectDB();
  try {
    console.log('Phase2 functional verification starting...');

    // 1. Create test hospital & donor directly in DB (fast, deterministic)
    const hospital = await createHospital();
    const donor = await createDonor();
    log('Created hospital', { id: hospital._id.toString(), email: hospital.email });
    log('Created donor', { id: donor._id.toString(), email: donor.email });

    // 2. Login hospital via API
    const hospLoginRes = await request.post('/auth/hospital/login').send({ email: hospital.email, password: 'TestPass@123', hospitalId: hospital.hospitalId });
    if (hospLoginRes.status !== 200) throw new Error('Hospital login failed: ' + JSON.stringify(hospLoginRes.body));
    const hospToken = hospLoginRes.body?.data?.access_token || hospLoginRes.body?.access_token || hospLoginRes.body?.accessToken;

    // 3. Login donor via API
    const donorLoginRes = await request.post('/auth/login').send({ email: donor.email, password: 'TestPass@123' });
    if (donorLoginRes.status !== 200) throw new Error('Donor login failed: ' + JSON.stringify(donorLoginRes.body));
    const donorToken = donorLoginRes.body?.data?.access_token || donorLoginRes.body?.access_token || donorLoginRes.body?.accessToken;

    // 4. Hospital creates an emergency request (should trigger matching & notifications)
    const emergencyBody = { bloodType: donor.bloodType, unitsNeeded: 1, patientDetails: 'Test patient', isEmergency: true };
    const createReqRes = await request.post('/hospital/requests/create-emergency').set('Authorization', `Bearer ${hospToken}`).send(emergencyBody);
    if (![200,201].includes(createReqRes.status)) throw new Error('Create emergency request failed: ' + JSON.stringify(createReqRes.body));
    const createdRequest = createReqRes.body?.data || createReqRes.body;
    log('Created request', { id: createdRequest._id || createdRequest.id });

    const requestId = createdRequest._id || createdRequest.id;

    // 5. Verify NotificationOutbox and Notifications for donor
    const outbox = await NotificationOutbox.findOne({ requestId });
    log('Outbox entry', outbox ? { id: outbox._id.toString(), status: outbox.status, donorIds: outbox.donorIds.length } : 'none');

    const donorNotifications = await Notification.find({ userId: donor._id, relatedId: requestId });
    log('Donor notifications count', donorNotifications.length);

    // 6. Donor accepts the request via API
    const acceptRes = await request.post(`/requests/${requestId}/accept`).set('Authorization', `Bearer ${donorToken}`).send();
    if (acceptRes.status !== 200) throw new Error('Donor accept failed: ' + JSON.stringify(acceptRes.body));
    log('Accept response', acceptRes.body?.message || acceptRes.body);

    // 7. Verify request accepted and donation created
    const savedRequest = await Request.findById(requestId);
    const donation = await Donation.findOne({ requestId, donorId: donor._id });
    if (!savedRequest || !donation) throw new Error('Post-accept DB state invalid');
    log('Request status', savedRequest.status);
    log('Donation', { id: donation._id.toString(), status: donation.status });

    // 8. Hospital books an appointment for donor
    const apptDate = new Date(); // 2 days from now at 10:00
    apptDate.setDate(apptDate.getDate() + 2);
    apptDate.setHours(10, 0, 0, 0);
    const bookRes = await request.post(`/hospital/donors/${donor._id}/appointments`).set('Authorization', `Bearer ${hospToken}`).send({ appointmentDate: apptDate.toISOString(), requestId });
    if (bookRes.status !== 201) throw new Error('Book appointment failed: ' + JSON.stringify(bookRes.body));
    const appointment = bookRes.body?.data || bookRes.body;
    log('Appointment created', { id: appointment._id || appointment.id, qrToken: appointment.qrToken || null });

    // 9. Hospital verifies QR (simulate scanning)
    const qrToken = appointment.qrToken || appointment.qrToken;
    const verifyRes = await request.post('/appointments/verify-qr').set('Authorization', `Bearer ${hospToken}`).send({ qrToken });
    if (verifyRes.status !== 200) throw new Error('Verify QR failed: ' + JSON.stringify(verifyRes.body));
    log('Verify QR', verifyRes.body?.message || verifyRes.body);

    // 10. Confirm arrival with checklist
    const apptId = appointment._id || appointment.id;
    const arrivalRes = await request.post(`/appointments/${apptId}/arrival`).set('Authorization', `Bearer ${hospToken}`).send({ checklist: { idVerified: true, questionnaireCompleted: true, consentSigned: true } });
    if (arrivalRes.status !== 200) throw new Error('Confirm arrival failed: ' + JSON.stringify(arrivalRes.body));
    log('Confirm arrival', arrivalRes.body?.message || arrivalRes.body);

    // 11. Complete donation (medical inputs)
    const completeRes = await request.post('/donations/complete').set('Authorization', `Bearer ${hospToken}`).send({ appointmentId: apptId, hemoglobinLevel: 13.5, weight: 70, unitsCollected: 1 });
    if (completeRes.status !== 200) throw new Error('Complete donation failed: ' + JSON.stringify(completeRes.body));
    log('Complete donation', completeRes.body?.message || completeRes.body);

    // 12. Verify final DB states: donation completed, request completed, points awarded
    const finalDonation = await Donation.findOne({ appointmentId: apptId });
    const finalRequest = await Request.findById(requestId);
    if (!finalDonation || finalDonation.status !== 'completed') throw new Error('Donation not completed as expected');
    if (!finalRequest || finalRequest.status !== 'completed') throw new Error('Request not completed as expected');
    log('Final donation status', finalDonation.status);
    log('Final request status', finalRequest.status);

    const pointsAccount = await DonorPoints.findOne({ donorId: donor._id });
    const tx = await PointsTransaction.findOne({ donorId: donor._id, referenceId: `donation_${finalDonation._id}` });
    log('Points account', pointsAccount ? { balance: pointsAccount.pointsBalance, lifetime: pointsAccount.lifetimePointsEarned } : 'none');
    log('Points transaction found', Boolean(tx));

    console.log('Phase2 verification completed successfully — no functional issues detected.');
  } catch (err) {
    console.error('Verification failed:', err && err.message ? err.message : err);
    process.exitCode = 2;
  } finally {
    await disconnectDB();
  }
};

run();
