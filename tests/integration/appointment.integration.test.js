import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createAdmin } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Appointment from '../../src/models/Appointment.model.js';

setupTestDB();

describe('Appointment Routes Integration', () => {
  it('POST /donations/book-appointment books an appointment for authenticated donor', async () => {
    await clearDatabase();
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();
    const request2 = await createRequest(hospital._id);

    const token = signToken({ userId: donor._id.toString(), role: donor.role });
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const response = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hospitalId: hospital._id.toString(),
        requestId: request2._id.toString(),
        appointmentDate: futureDate.toISOString(),
        notes: 'Morning preference',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('_id');
    expect(response.body.data.status).toBe('pending');
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
