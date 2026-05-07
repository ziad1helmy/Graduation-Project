import { describe, it, expect, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital } from '../helpers/factories.js';
import * as appointmentController from '../../src/controllers/appointment.controller.js';
import * as appointmentService from '../../src/services/appointment.service.js';

// Mock Notification model
vi.mock('../../src/models/Notification.model.js', () => ({ default: { create: vi.fn().mockResolvedValue(null) } }));

setupTestDB();

describe('Appointment Controller', () => {
  describe('Dev 1: Task 3 — getAppointmentById', () => {
    it('returns appointment by ID for the donor', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const apptDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const appt = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate, 'test notes');

      const req = {
        user: { userId: donor._id },
        params: { appointmentId: appt._id.toString() },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.getAppointmentById(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(callArgs.data._id).toEqual(appt._id);
      expect(callArgs.data.notes).toBe('test notes');
    });

    it('returns 404 when appointment not found', async () => {
      const donor = await createDonor();

      const req = {
        user: { userId: donor._id },
        params: { appointmentId: '507f1f77bcf86cd799439011' },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.getAppointmentById(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
    });

    it('returns 403 when donor does not own the appointment', async () => {
      const donor1 = await createDonor();
      const donor2 = await createDonor();
      const hospital = await createHospital();
      const apptDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const appt = await appointmentService.bookAppointment(donor1._id, hospital._id, null, apptDate);

      const req = {
        user: { userId: donor2._id },
        params: { appointmentId: appt._id.toString() },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.getAppointmentById(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
    });
  });

  describe('Dev 1: Task 4 — rescheduleAppointment', () => {
    it('reschedules appointment to future date', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const apptDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const newDate = new Date(Date.now() + 120 * 60 * 60 * 1000);

      const appt = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

      const req = {
        user: { userId: donor._id },
        params: { appointmentId: appt._id.toString() },
        body: { date: newDate.toISOString() },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.rescheduleAppointment(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(new Date(callArgs.data.appointmentDate).getTime()).toBe(newDate.getTime());
    });

    it('returns error when trying to reschedule to past date', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const apptDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const appt = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

      const req = {
        user: { userId: donor._id },
        params: { appointmentId: appt._id.toString() },
        body: { date: pastDate.toISOString() },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.rescheduleAppointment(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
    });

    it('returns 404 when appointment not found', async () => {
      const donor = await createDonor();
      const newDate = new Date(Date.now() + 120 * 60 * 60 * 1000);

      const req = {
        user: { userId: donor._id },
        params: { appointmentId: '507f1f77bcf86cd799439011' },
        body: { date: newDate.toISOString() },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.rescheduleAppointment(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
    });

    it('returns error when donor does not own the appointment', async () => {
      const donor1 = await createDonor();
      const donor2 = await createDonor();
      const hospital = await createHospital();
      const apptDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const newDate = new Date(Date.now() + 120 * 60 * 60 * 1000);

      const appt = await appointmentService.bookAppointment(donor1._id, hospital._id, null, apptDate);

      const req = {
        user: { userId: donor2._id },
        params: { appointmentId: appt._id.toString() },
        body: { date: newDate.toISOString() },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.rescheduleAppointment(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
    });
  });

  describe('Dev 2: Task 7 — getAvailableSlots', () => {
    it('returns available slots for a hospital and date', async () => {
      const hospital = await createHospital({
        slotsPerHour: 1,
        workingHoursStart: 9,
        workingHoursEnd: 11,
      });
      const donor = await createDonor();
      const date = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await appointmentService.bookAppointment(donor._id, hospital._id, null, date);

      const req = {
        user: { userId: donor._id },
        query: { hospitalId: hospital._id.toString(), date: date.toISOString() },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.getAvailableSlots(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(Array.isArray(callArgs.data.timeSlots)).toBe(true);
    });
  });
});
