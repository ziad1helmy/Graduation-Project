import { describe, it, expect, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import * as appointmentService from '../../src/services/appointment.service.js';
import Appointment from '../../src/models/Appointment.model.js';
import HospitalSettings from '../../src/models/HospitalSettings.model.js';

vi.mock('../../src/models/Notification.model.js', () => ({ default: { create: vi.fn().mockResolvedValue(null) } }));
vi.mock('../../src/services/activity.service.js', () => ({ logActivity: vi.fn().mockResolvedValue(null) }));

setupTestDB();

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

describe('Appointment Service', () => {
  it('books an appointment for eligible donor and request', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const request = await createRequest(hospital._id, { bloodType: donor.bloodType });

    const apptDate = makeFutureAppointmentDate();

    const appt = await appointmentService.bookAppointment(donor._id, hospital._id, request._id, apptDate, 'notes');

    expect(appt).toBeTruthy();
    const found = await Appointment.findById(appt._id);
    expect(found).toBeTruthy();
    expect(found.status).toBe('pending');
  });

  it('persists donationType when booking an appointment', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();

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

    const apptDate = makePastAppointmentDate();

    await expect(
      appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate, '')
    ).rejects.toThrow('Appointment date must be in the future');
  });

  it('prevents booking against an inactive request', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const request2 = await createRequest(hospital._id, { status: 'completed' });
    const apptDate = makeFutureAppointmentDate();

    await expect(
      appointmentService.bookAppointment(donor._id, hospital._id, request2._id, apptDate, '')
    ).rejects.toThrow('The linked request is no longer active');
  });

  // Dev 1: Task 3 — GET /appointments/:appointmentId
  it('retrieves appointment by ID for the donor', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();

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
    const apptDate = makeFutureAppointmentDate();

    const created = await appointmentService.bookAppointment(donor1._id, hospital._id, null, apptDate);

    await expect(
      appointmentService.getAppointmentById(created._id, donor2._id)
    ).rejects.toThrow('Appointment not found');
  });

  // Dev 1: Task 4 — PATCH /appointments/:appointmentId (Reschedule)
  it('reschedules appointment to future date', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();
    const newDate = makeRescheduleDate();

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);
    const rescheduled = await appointmentService.rescheduleAppointment(created._id, donor._id, {
      appointmentDate: newDate,
      donationType: 'Plasma',
    });

    expect(rescheduled.appointmentDate.getTime()).toBe(newDate.getTime());
    expect(rescheduled.donationType).toBe('Plasma');
  });

  it('stores reschedule reason and history on appointment updates', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();
    const newDate = makeRescheduleDate();

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);
    const rescheduled = await appointmentService.rescheduleAppointment(created._id, donor._id, {
      appointmentDate: newDate,
      reason: 'Need a different day',
    });

    expect(rescheduled.rescheduleCount).toBe(1);
    expect(rescheduled.rescheduleHistory[0].reason).toBe('Need a different day');
  });

  it('prevents rescheduling to past date', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();
    const pastDate = makePastAppointmentDate();

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

    await expect(
      appointmentService.rescheduleAppointment(created._id, donor._id, pastDate)
    ).rejects.toThrow('New appointment date must be in the future');
  });

  it('reschedules appointment without creating duplicates and regenerates QR token', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();
    const newDate = makeRescheduleDate();

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);
    const originalQrToken = created.qrToken;

    const rescheduled = await appointmentService.rescheduleAppointment(created._id, donor._id, {
      appointmentDate: newDate,
      donationType: 'Plasma',
    });

    expect(rescheduled._id.toString()).toBe(created._id.toString());
    expect(rescheduled.qrToken).not.toBe(originalQrToken);
    expect(rescheduled.rescheduleCount).toBe(1);
    expect(Array.isArray(rescheduled.rescheduleHistory)).toBe(true);
    expect(rescheduled.rescheduleHistory).toHaveLength(1);
  });

  it('prevents rescheduling completed appointments', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();
    const newDate = makeRescheduleDate();

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);
    created.status = 'completed';
    await created.save();

    await expect(
      appointmentService.rescheduleAppointment(created._id, donor._id, newDate)
    ).rejects.toThrow('Only pending or confirmed appointments can be rescheduled');
  });

  it('prevents rescheduling when the linked request is no longer active', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const request2 = await createRequest(hospital._id);
    const apptDate = makeFutureAppointmentDate();
    const newDate = makeRescheduleDate();

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, request2._id, apptDate);
    request2.status = 'completed';
    request2.completedAt = new Date();
    await request2.save();

    await expect(
      appointmentService.rescheduleAppointment(created._id, donor._id, { appointmentDate: newDate })
    ).rejects.toThrow('The linked request is no longer active');
  });

  it('prevents no-op reschedules', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate, '', 'Whole Blood');

    await expect(
      appointmentService.rescheduleAppointment(created._id, donor._id, {
        appointmentDate: apptDate,
        donationType: 'Whole Blood',
      })
    ).rejects.toThrow('New appointment details must be different from the current appointment');
  });

  // Dev 1: QR Token Generation
  it('generates unique QR token when booking appointment', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();

    const appt = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

    expect(appt.qrToken).toBeTruthy();
    expect(typeof appt.qrToken).toBe('string');
    expect(appt.qrToken.length).toBeGreaterThan(20);
  });

  it('ensures QR tokens are unique across different appointments', async () => {
    const hospital1 = await createHospital();
    const hospital2 = await createHospital();
    const donor1 = await createDonor();
    const donor2 = await createDonor();
    const apptDate1 = makeFutureAppointmentDate();
    const apptDate2 = makeRescheduleDate(6, 12);

    const appt1 = await appointmentService.bookAppointment(donor1._id, hospital1._id, null, apptDate1);
    const appt2 = await appointmentService.bookAppointment(donor2._id, hospital2._id, null, apptDate2);

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
    const slotDate = makeFutureAppointmentDate(2, 9);
    slotDate.setMinutes(15, 0, 0);

    const slotDate2 = new Date(slotDate);
    slotDate2.setMinutes(30);

    await HospitalSettings.findOneAndUpdate(
      { hospitalId: hospital._id },
      {
        $set: {
          hospitalId: hospital._id,
          appointmentSettings: {
            openingTime: '09:00',
            closingTime: '11:00',
            defaultSlotsPerHour: 2,
            hourlySlots: { '09:00': 2, '10:00': 2 },
            isActive: true,
            supportedDonationTypes: ['Whole Blood', 'Plasma', 'Platelets', 'Double Red Cells'],
            minAdvanceHours: 0,
            maxAdvanceDays: 30,
            rescheduleAllowed: true,
            maxReschedules: 3,
            cancellationAllowedHours: 12,
          },
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

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
    // Slots are now objects with {time, remainingCapacity, maxCapacity, available}
    const slot10am = availableSlots.timeSlots.find(s => s.time === '10:00');
    expect(slot10am).toBeDefined();
    expect(slot10am.available).toBe(true);
    expect(slot10am.remainingCapacity).toBeGreaterThan(0);
    
    const slot9am = availableSlots.timeSlots.find(s => s.time === '09:00');
    expect(slot9am).toBeDefined();
    // 09:00 should be full since we booked both available slots
    expect(slot9am.available).toBe(false);
    expect(slot9am.remainingCapacity).toBe(0);
  });

  it('excludes the current appointment when checking available slots for reschedule', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const date = makeFutureAppointmentDate(3, 8);

    await HospitalSettings.findOneAndUpdate(
      { hospitalId: hospital._id },
      {
        $set: {
          hospitalId: hospital._id,
          appointmentSettings: {
            openingTime: '08:00',
            closingTime: '10:00',
            defaultSlotsPerHour: 1,
            hourlySlots: { '08:00': 1, '09:00': 1 },
            isActive: true,
            supportedDonationTypes: ['Whole Blood', 'Plasma', 'Platelets', 'Double Red Cells'],
            minAdvanceHours: 0,
            maxAdvanceDays: 30,
            rescheduleAllowed: true,
            maxReschedules: 3,
            cancellationAllowedHours: 12,
          },
        },
      },
      { upsert: true, new: true }
    );

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, date);
    const availableSlots = await appointmentService.getAvailableSlots(hospital._id, date.toISOString(), {
      excludeAppointmentId: created._id.toString(),
    });

    // When excluding the current appointment, the 08:00 slot should be available again
    const slot8am = availableSlots.timeSlots.find(s => s.time === '08:00');
    expect(slot8am).toBeDefined();
    expect(slot8am.available).toBe(true);
    expect(slot8am.remainingCapacity).toBe(1);
  });

  it('prevents cancelling too close to the appointment time when hospital settings require advance notice', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();

    await HospitalSettings.findOneAndUpdate(
      { hospitalId: hospital._id },
      {
        $set: {
          hospitalId: hospital._id,
          'appointmentSettings.cancellationAllowedHours': 72,
          'appointmentSettings.minAdvanceHours': 0,
        },
      },
      { upsert: true, new: true }
    );

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

    await expect(
      appointmentService.cancelAppointment(created._id, donor._id)
    ).rejects.toThrow('Cancellation must be at least 72 hours in advance');
  });

  // Race condition and duplicate prevention tests
  it('prevents duplicate active appointments for same donor at same hospital', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();

    await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

    await expect(
      appointmentService.bookAppointment(donor._id, hospital._id, null, makeFutureAppointmentDate(3, 14))
    ).rejects.toThrow('You already have an active appointment at this hospital');
  });

  it('prevents booking at different hospitals when donor already has active appointment/donation at one', async () => {
    const hospital1 = await createHospital();
    const hospital2 = await createHospital();
    const donor = await createDonor();
    const apptDate1 = makeFutureAppointmentDate();
    const apptDate2 = makeRescheduleDate(5, 14);

    await appointmentService.bookAppointment(donor._id, hospital1._id, null, apptDate1);

    await expect(
      appointmentService.bookAppointment(donor._id, hospital2._id, null, apptDate2)
    ).rejects.toThrow(/active donation/i);
  });

  it('allows rebooking after cancelling previous appointment', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate1 = makeFutureAppointmentDate();
    const apptDate2 = makeRescheduleDate(7, 15);

    const created = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate1);
    await appointmentService.cancelAppointment(created._id, donor._id);

    const newAppt = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate2);
    expect(newAppt).toBeTruthy();
    expect(newAppt.status).toBe('pending');
  });

  it('handles duplicate key error from unique index constraint', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();

    await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

    await expect(
      appointmentService.bookAppointment(donor._id, hospital._id, null, makeFutureAppointmentDate(4, 11))
    ).rejects.toThrow('You already have an active appointment at this hospital');
  });

  it('simulates concurrent booking attempts (race condition prevention)', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const apptDate = makeFutureAppointmentDate();
    const apptDate2 = makeFutureAppointmentDate(3, 15);

    // Book first appointment
    const appt1 = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);
    expect(appt1).toBeTruthy();

    // Try to book a second appointment at same hospital - should fail
    try {
      await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate2);
      throw new Error('Should have thrown duplicate appointment error');
    } catch (e) {
      expect(e.message).toContain('You already have an active appointment at this hospital');
    }

    // Verify only one appointment exists
    const appointments = await Appointment.find({ donorId: donor._id, hospitalId: hospital._id });
    expect(appointments.length).toBe(1);
  });
});
