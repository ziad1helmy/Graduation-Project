import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createAdmin, createDonation } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Appointment from '../../src/models/Appointment.model.js';
import Donation from '../../src/models/Donation.model.js';
import Request from '../../src/models/Request.model.js';

vi.mock('../../src/services/activity.service.js', () => ({ logActivity: vi.fn().mockResolvedValue(null) }));

const DONATION_FLOW_TYPES = [
  { donationType: 'Whole Blood', requestType: 'blood' },
  { donationType: 'Plasma', requestType: 'plasma' },
  { donationType: 'Platelets', requestType: 'platelets' },
  { donationType: 'Double Red Cells', requestType: 'double_red_cells' },
];

const bookAppointmentPayload = ({ hospitalId, requestId, appointmentDate, donationType }) => ({
  hospitalId: hospitalId.toString(),
  requestId: requestId.toString(),
  appointmentDate: appointmentDate.toISOString(),
  notes: 'Morning preference',
  donationType,
});

const makeFutureAppointmentDate = (daysAhead = 2, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  while (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(hour, 0, 0, 0);
  return date;
};

const makeRescheduleDate = (daysAhead = 5, hour = 11) => {
  const date = makeFutureAppointmentDate(daysAhead, hour);
  return date;
};

const makePastAppointmentDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 2);
  date.setHours(10, 0, 0, 0);
  return date;
};

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
    const futureDate = makeFutureAppointmentDate();
    const rescheduleDate = makeRescheduleDate();

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
    const savedAppointment = await Appointment.findById(appointmentId);

    expect(savedAppointment).toBeTruthy();
    expect(savedAppointment.donorId.toString()).toBe(donor._id.toString());
    expect(savedAppointment.requestId.toString()).toBe(request2._id.toString());
    expect(savedAppointment.hospitalId.toString()).toBe(hospital._id.toString());
    expect(new Date(savedAppointment.appointmentDate).toISOString()).toBe(futureDate.toISOString());

    const linkedDonation = await Donation.findOne({ appointmentId });
    expect(linkedDonation).toBeTruthy();
    expect(linkedDonation.donorId.toString()).toBe(donor._id.toString());
    expect(linkedDonation.requestId.toString()).toBe(request2._id.toString());

    const updateResponse = await request(app)
      .patch(`/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        appointmentDate: rescheduleDate.toISOString(),
        donationType: 'Plasma',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.donationType).toBe('Plasma');
    expect(updateResponse.body.data.appointment.appointmentId).toBeDefined();
    expect(updateResponse.body.data.donor.email).toBeDefined();

    const detailResponse = await request(app)
      .get(`/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.donationType).toBe('Plasma');
    expect(detailResponse.body.data.appointmentTime).toBeDefined();

    const listResponse = await request(app)
      .get('/donations/book-appointment/my-appointments')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.appointments.some((appointment) => appointment._id === appointmentId)).toBe(true);
    expect(listResponse.body.data.appointments.find((appointment) => appointment._id === appointmentId).donationType).toBe('Plasma');
  });

  it('PATCH /appointments/:appointmentId stores a reschedule reason and returns updated history', async () => {
    await clearDatabase();
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();
    const request2 = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });
    const token = signToken({ userId: donor._id.toString(), role: donor.role });
    const futureDate = makeFutureAppointmentDate();
    const rescheduleDate = makeRescheduleDate();

    const createResponse = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${token}`)
      .send(bookAppointmentPayload({
        hospitalId: hospital._id,
        requestId: request2._id,
        appointmentDate: futureDate,
        donationType: 'Whole Blood',
      }));

    const appointmentId = createResponse.body.data._id;

    const updateResponse = await request(app)
      .patch(`/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        appointmentDate: rescheduleDate.toISOString(),
        reason: 'Travel conflict',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.rescheduleHistory).toHaveLength(1);
    expect(updateResponse.body.data.rescheduleHistory[0].reason).toBe('Travel conflict');
  });

  it('POST /donations/book-appointment rejects donors with an active donation', async () => {
    await clearDatabase();
    const donor = await createDonor({
      bloodType: 'O+',
      dateOfBirth: new Date('1990-01-01'),
      hemoglobinLevel: 14.5,
    });
    const hospital = await createHospital();
    const request1 = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });
    await createDonation(donor._id, request1._id, { status: 'pending' });
    const request2 = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });
    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${token}`)
      .send(bookAppointmentPayload({
        hospitalId: hospital._id,
        requestId: request2._id,
        appointmentDate: makeFutureAppointmentDate(),
        donationType: 'Whole Blood',
      }));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Donor already has an active donation in progress');
  });

  it('PATCH /appointments/:appointmentId rejects reschedule when linked request is completed', async () => {
    await clearDatabase();
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();
    const request2 = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });
    const token = signToken({ userId: donor._id.toString(), role: donor.role });
    const futureDate = makeFutureAppointmentDate();
    const rescheduleDate = makeRescheduleDate();

    const createResponse = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${token}`)
      .send(bookAppointmentPayload({
        hospitalId: hospital._id,
        requestId: request2._id,
        appointmentDate: futureDate,
        donationType: 'Whole Blood',
      }));

    const appointmentId = createResponse.body.data._id;
    await Appointment.updateOne({ _id: appointmentId }, { $set: { status: 'pending' } });
    await request2.updateOne({ $set: { status: 'completed', completedAt: new Date() } });

    const updateResponse = await request(app)
      .patch(`/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        appointmentDate: rescheduleDate.toISOString(),
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.message).toBe('The linked request is no longer active');
  });

  it('PATCH /appointments/:appointmentId rejects no-op reschedules', async () => {
    await clearDatabase();
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();
    const request2 = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });
    const token = signToken({ userId: donor._id.toString(), role: donor.role });
    const futureDate = makeFutureAppointmentDate();

    const createResponse = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${token}`)
      .send(bookAppointmentPayload({
        hospitalId: hospital._id,
        requestId: request2._id,
        appointmentDate: futureDate,
        donationType: 'Whole Blood',
      }));

    const appointmentId = createResponse.body.data._id;

    const updateResponse = await request(app)
      .patch(`/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        appointmentDate: futureDate.toISOString(),
        donationType: 'Whole Blood',
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.message).toBe('New appointment details must be different from the current appointment');
  });

  it('POST /donations/book-appointment requires authentication', async () => {
    await clearDatabase();
    const hospital = await createHospital();

    const response = await request(app)
      .post('/donations/book-appointment')
      .send({
        hospitalId: hospital._id.toString(),
        appointmentDate: makeFutureAppointmentDate().toISOString(),
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
    const pastDate = makePastAppointmentDate();

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

  it('POST /donations/book-appointment rejects appointments inside the minimum advance window', async () => {
    await clearDatabase();
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });
    const soon = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const response = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hospitalId: hospital._id.toString(),
        appointmentDate: soon.toISOString(),
        donationType: 'Whole Blood',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Appointment must be at least 24 hours in advance');
  });

  it('GET /donations/book-appointment/my-appointments returns donor appointments', async () => {
    await clearDatabase();
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();
    const request2 = await createRequest(hospital._id);
    const futureDate = makeFutureAppointmentDate();

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
    expect(response.body.data.appointments[0].donorId).toBe(donor._id.toString());
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
    const futureDate = makeFutureAppointmentDate();

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

  it('DELETE /donations/book-appointment/:appointmentId rolls back if linked donation save fails', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const request2 = await createRequest(hospital._id, { status: 'accepted' });
    const appointment = await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      requestId: request2._id,
      appointmentDate: makeFutureAppointmentDate(),
      status: 'confirmed',
      donationType: 'Whole Blood',
      qrToken: `cancel-rollback-${Date.now()}`,
    });
    await Donation.create({
      donorId: donor._id,
      requestId: request2._id,
      appointmentId: appointment._id,
      status: 'scheduled',
      quantity: 1,
    });

    const saveSpy = vi.spyOn(Donation.prototype, 'save').mockRejectedValueOnce(new Error('transaction failed'));
    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .delete(`/donations/book-appointment/${appointment._id}`)
      .set('Authorization', `Bearer ${token}`);

    saveSpy.mockRestore();

    expect(response.status).toBeGreaterThanOrEqual(500);

    const storedAppointment = await Appointment.findById(appointment._id);
    const storedDonation = await Donation.findOne({ appointmentId: appointment._id });
    const storedRequest = await Request.findById(request2._id);

    expect(storedAppointment.status).toBe('confirmed');
    expect(storedDonation.status).toBe('scheduled');
    expect(storedRequest.status).toBe('accepted');
  });

  it('DELETE /donations/book-appointment/:appointmentId requires authentication', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const request2 = await createRequest(hospital._id);
    const futureDate = makeFutureAppointmentDate();

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
