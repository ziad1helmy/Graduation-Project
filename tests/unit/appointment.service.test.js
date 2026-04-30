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

  it('prevents booking in the past', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();

    const apptDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday

    await expect(
      appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate, '')
    ).rejects.toThrow('Appointment date must be in the future');
  });
});
