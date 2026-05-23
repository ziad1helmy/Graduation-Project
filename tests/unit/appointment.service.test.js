import { describe, it, expect, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import * as appointmentService from '../../src/services/appointment.service.js';
import Appointment from '../../src/models/Appointment.model.js';

vi.mock('../../src/models/Notification.model.js', () => ({ default: { create: vi.fn().mockResolvedValue(null) } }));

setupTestDB();

describe('Appointment Service', () => {
  it('books an appointment for eligible donor and request', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const request = await createRequest(hospital._id, { bloodType: donor.bloodType });

    const apptDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow

    const appt = await appointmentService.bookAppointment(donor._id, hospital._id, request._id, apptDate, 'notes');

    expect(appt).toBeTruthy();
    const found = await Appointment.findById(appt._id);
    expect(found).toBeTruthy();
    expect(found.status).toBe('pending');
  });

  it('persists donationType when booking an appointment', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const appt = await appointmentService.bookAppointment(
      donor._id,
      hospital._id,
      null,
      apptDate,
      'notes',
      'Double Red Cells'
    );

    expect(appt.donationType).toBe('Double Red Cells');

    const found = await Appointment.findById(appt._id);
    expect(found.donationType).toBe('Double Red Cells');
  });

  it('prevents booking in the past', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();

    const apptDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday

    await expect(
      appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate, '')
    ).rejects.toThrow('Appointment date must be in the future');
  });

  // Dev 1: Task 3 — GET /appointments/:appointmentId
  it('retrieves appointment by ID for the donor', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate, 'test notes');

    const retrieved = await appointmentService.getAppointmentById(created._id, donor._id);

    expect(retrieved).toBeTruthy();
    expect(retrieved._id).toEqual(created._id);
    expect(retrieved.notes).toBe('test notes');
    expect(retrieved.donorId).toEqual(donor._id);
  });

  it('throws error when appointment not found', async () => {
    const donor = await createDonor();
    const fakeId = '507f1f77bcf86cd799439011';

    await expect(
      appointmentService.getAppointmentById(fakeId, donor._id)
    ).rejects.toThrow('Appointment not found');
  });

  it('throws error when donor does not own the appointment', async () => {
    const hospital = await createHospital();
    const donor1 = await createDonor();
    const donor2 = await createDonor();
    const apptDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const created = await appointmentService.bookAppointment(donor1._id, hospital._id, null, apptDate);

    await expect(
      appointmentService.getAppointmentById(created._id, donor2._id)
    ).rejects.toThrow('Appointment not found');
  });

  // Dev 1: Task 4 — PATCH /appointments/:appointmentId (Reschedule)
  it('reschedules appointment to future date', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const newDate = new Date(Date.now() + 120 * 60 * 60 * 1000);

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);
    const rescheduled = await appointmentService.rescheduleAppointment(created._id, donor._id, newDate);

    expect(rescheduled.appointmentDate.getTime()).toBe(newDate.getTime());
  });

  it('prevents rescheduling to past date', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

    await expect(
      appointmentService.rescheduleAppointment(created._id, donor._id, pastDate)
    ).rejects.toThrow('New appointment date must be in the future');
  });

  it('prevents rescheduling completed appointments', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const newDate = new Date(Date.now() + 120 * 60 * 60 * 1000);

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);
    created.status = 'completed';
    await created.save();

    await expect(
      appointmentService.rescheduleAppointment(created._id, donor._id, newDate)
    ).rejects.toThrow('Only pending or confirmed appointments can be rescheduled');
  });

  // Dev 1: QR Token Generation
  it('generates unique QR token when booking appointment', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const appt = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

    expect(appt.qrToken).toBeTruthy();
    expect(typeof appt.qrToken).toBe('string');
    expect(appt.qrToken.length).toBeGreaterThan(20);
  });

  it('ensures QR tokens are unique across different appointments', async () => {
    const hospital1 = await createHospital();
    const hospital2 = await createHospital();
    const donor = await createDonor();
    const apptDate1 = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const apptDate2 = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const appt1 = await appointmentService.bookAppointment(donor._id, hospital1._id, null, apptDate1);
    const appt2 = await appointmentService.bookAppointment(donor._id, hospital2._id, null, apptDate2);

    expect(appt1.qrToken).not.toBe(appt2.qrToken);
  });

  it('returns available hourly slots based on hospital capacity', async () => {
    const hospital = await createHospital({
      slotsPerHour: 2,
      workingHoursStart: 9,
      workingHoursEnd: 11,
    });
    const donor1 = await createDonor();
    const donor2 = await createDonor();
    const slotDate = new Date();
    slotDate.setDate(slotDate.getDate() + 2);
    slotDate.setHours(9, 15, 0, 0);

    const slotDate2 = new Date(slotDate);
    slotDate2.setMinutes(30);

    await Appointment.create({
      donorId: donor1._id,
      hospitalId: hospital._id,
      appointmentDate: slotDate,
      status: 'pending',
    });

    await Appointment.create({
      donorId: donor2._id,
      hospitalId: hospital._id,
      appointmentDate: slotDate2,
      status: 'confirmed',
    });

    const availableSlots = await appointmentService.getAvailableSlots(hospital._id, slotDate.toISOString());

    expect(Array.isArray(availableSlots.timeSlots)).toBe(true);
    expect(availableSlots.timeSlots).toContain('10:00 AM');
    expect(availableSlots.timeSlots).not.toContain('09:00 AM');
  });
});
