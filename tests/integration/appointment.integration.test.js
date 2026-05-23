import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createAdmin } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Appointment from '../../src/models/Appointment.model.js';

const DONATION_FLOW_TYPES = [
  { donationType: 'Whole Blood', requestType: 'blood' },
  { donationType: 'Plasma', requestType: 'plasma' },
  { donationType: 'Platelets', requestType: 'platelets' },
  { donationType: 'Double Red Cells', requestType: 'blood' },
];

const bookAppointmentPayload = ({ hospitalId, requestId, appointmentDate, donationType }) => ({
  hospitalId: hospitalId.toString(),
  requestId: requestId.toString(),
  appointmentDate: appointmentDate.toISOString(),
  notes: 'Morning preference',
  donationType,
});

setupTestDB();

describe('Appointment Routes Integration', () => {
  it.each(DONATION_FLOW_TYPES)('books and retrieves appointments for %s', async ({ donationType, requestType }) => {
    await clearDatabase();
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();
    const request2 = await createRequest(hospital._id, {
      type: requestType,
      bloodType: 'O+',
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const rescheduleDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    const createResponse = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${token}`)
      .send(bookAppointmentPayload({
        hospitalId: hospital._id,
        requestId: request2._id,
        appointmentDate: futureDate,
        donationType,
      }));

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data).toHaveProperty('_id');
    expect(createResponse.body.data.donationType).toBe(donationType);

    const appointmentId = createResponse.body.data._id;

    const updateResponse = await request(app)
      .patch(`/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: rescheduleDate.toISOString(),
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.donationType).toBe(donationType);

    const detailResponse = await request(app)
      .get(`/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.donationType).toBe(donationType);

    const listResponse = await request(app)
      .get('/donations/book-appointment/my-appointments')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.appointments.some((appointment) => appointment._id === appointmentId)).toBe(true);
    expect(listResponse.body.data.appointments.find((appointment) => appointment._id === appointmentId).donationType).toBe(donationType);
  });

  it('POST /donations/book-appointment requires authentication', async () => {
    await clearDatabase();
    const hospital = await createHospital();

    const response = await request(app)
      .post('/donations/book-appointment')
      .send({
        hospitalId: hospital._id.toString(),
        appointmentDate: new Date().toISOString(),
      });

    expect(response.status).toBe(401);
  });

  it('POST /donations/book-appointment requires donor role', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const hospital = await createHospital();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hospitalId: hospital._id.toString(),
        appointmentDate: new Date().toISOString(),
      });

    expect(response.status).toBe(403);
  });

  it('POST /donations/book-appointment rejects past appointment dates', async () => {
    await clearDatabase();
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

    const response = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hospitalId: hospital._id.toString(),
        appointmentDate: pastDate.toISOString(),
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/future/i);
  });

  it('GET /donations/book-appointment/my-appointments returns donor appointments', async () => {
    await clearDatabase();
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();
    const request2 = await createRequest(hospital._id);
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Book an appointment
    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      requestId: request2._id,
      appointmentDate: futureDate,
      status: 'pending',
      notes: 'Test appointment',
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donations/book-appointment/my-appointments')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.appointments)).toBe(true);
    expect(response.body.data.appointments.length).toBeGreaterThan(0);
    expect(response.body.data.appointments[0].donorId).toBeDefined();
    expect(response.body.data.appointments[0].donorDetails).toBeDefined();
  });

  it('GET /donations/book-appointment/my-appointments requires authentication', async () => {
    await clearDatabase();

    const response = await request(app).get('/donations/book-appointment/my-appointments');

    expect(response.status).toBe(401);
  });

  it('DELETE /donations/book-appointment/:appointmentId cancels an appointment', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const request2 = await createRequest(hospital._id);
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const appointment = await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      requestId: request2._id,
      appointmentDate: futureDate,
      status: 'pending',
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .delete(`/donations/book-appointment/${appointment._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('cancelled');

    const updated = await Appointment.findById(appointment._id);
    expect(updated.status).toBe('cancelled');
  });

  it('DELETE /donations/book-appointment/:appointmentId requires authentication', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const request2 = await createRequest(hospital._id);
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const appointment = await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      requestId: request2._id,
      appointmentDate: futureDate,
      status: 'pending',
    });

    const response = await request(app).delete(`/donations/book-appointment/${appointment._id}`);

    expect(response.status).toBe(401);
  });
});
