import { describe, it, expect, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital } from '../helpers/factories.js';
import * as appointmentController from '../../src/controllers/appointment.controller.js';
import * as appointmentService from '../../src/services/appointment.service.js';
import { HttpError } from '../../src/utils/HttpError.js';

vi.mock('../../src/models/Notification.model.js', () => ({ default: { create: vi.fn().mockResolvedValue(null) } }));
vi.mock('../../src/services/activity.service.js', () => ({ logActivity: vi.fn().mockResolvedValue(null) }));

setupTestDB();

/**
 * Asserts that the controller forwarded an HttpError to next() with the
 * expected status code. With the asyncHandler wrapper, domain errors are
 * no longer mapped to res.json directly — they are thrown as HttpError
 * and the global error middleware writes the JSON response.
 */
const expectHttpError = (next, statusCode, messagePattern) => {
  expect(next).toHaveBeenCalledTimes(1);
  const err = next.mock.calls[0][0];
  expect(err).toBeInstanceOf(HttpError);
  expect(err.statusCode).toBe(statusCode);
  if (messagePattern) expect(err.message).toMatch(messagePattern);
};

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

describe('Appointment Controller', () => {
  describe('getAppointmentById', () => {
    it('returns appointment by ID for the donor', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const apptDate = makeFutureAppointmentDate();

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

      expectHttpError(next, 404, /appointment.error_not_found/);
    });

    it('returns error when donor does not own the appointment', async () => {
      const donor1 = await createDonor();
      const donor2 = await createDonor();
      const hospital = await createHospital();
      const apptDate = makeFutureAppointmentDate();

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

      expectHttpError(next, 404, /appointment.error_not_found/);
    });
  });

  describe('rescheduleAppointment', () => {
    it('reschedules appointment to future date', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const apptDate = makeFutureAppointmentDate();
      const newDate = makeRescheduleDate();

      const appt = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

      const req = {
        user: { userId: donor._id },
        params: { appointmentId: appt._id.toString() },
        body: { appointmentDate: newDate.toISOString(), donationType: 'Plasma' },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.rescheduleAppointment(req, res, next);

      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      // appointmentDate is date-only YYYY-MM-DD; precise time lives in appointmentTime
      expect(callArgs.data.appointmentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(callArgs.data.appointmentTime).toBeDefined();
      expect(callArgs.data.donationType).toBe('Plasma');
      expect(callArgs.data.donor.firstName).toBeDefined();
      expect(callArgs.data.hospital.name).toBeDefined();
    });

    it.each([
      ['12h format', '02:30 PM'],
      ['24h format', '14:30'],
    ])('reschedules appointment using separate date and time (%s)', async (_, time) => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const apptDate = makeFutureAppointmentDate();

      const appt = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

      const rescheduleDate = makeRescheduleDate();
      const rescheduleDateStr = rescheduleDate.toISOString().slice(0, 10);
      const req = {
        user: { userId: donor._id },
        params: { appointmentId: appt._id.toString() },
        body: { date: rescheduleDateStr, time, donationType: 'Plasma' },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.rescheduleAppointment(req, res, next);

      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      // appointmentDate is date-only YYYY-MM-DD; time precision lives in appointmentTime
      expect(callArgs.data.appointmentDate).toBe(rescheduleDateStr);
      expect(callArgs.data.appointmentTime).toBe('2:30 PM');
    });

    it('includes the reschedule reason in appointment history', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const apptDate = makeFutureAppointmentDate();
      const newDate = makeRescheduleDate();

      const appt = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

      const req = {
        user: { userId: donor._id },
        params: { appointmentId: appt._id.toString() },
        body: { appointmentDate: newDate.toISOString(), reason: 'Need a different time' },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.rescheduleAppointment(req, res, next);

      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(Array.isArray(callArgs.data.rescheduleHistory)).toBe(true);
      expect(callArgs.data.rescheduleHistory[0].reason).toBe('Need a different time');
    });

    it('returns error when trying to reschedule to past date', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const apptDate = makeFutureAppointmentDate();
      const pastDate = makePastAppointmentDate();

      const appt = await appointmentService.bookAppointment(donor._id, hospital._id, null, apptDate);

      const req = {
        user: { userId: donor._id },
        params: { appointmentId: appt._id.toString() },
        body: { appointmentDate: pastDate.toISOString() },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.rescheduleAppointment(req, res, next);

      expectHttpError(next, 400, /future/);
    });

    it('returns 404 when appointment not found', async () => {
      const donor = await createDonor();
      const newDate = makeRescheduleDate();

      const req = {
        user: { userId: donor._id },
        params: { appointmentId: '507f1f77bcf86cd799439011' },
        body: { appointmentDate: newDate.toISOString() },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.rescheduleAppointment(req, res, next);

      expectHttpError(next, 404, /appointment.error_not_found/);
    });

    it('returns error when donor does not own the appointment', async () => {
      const donor1 = await createDonor();
      const donor2 = await createDonor();
      const hospital = await createHospital();
      const apptDate = makeFutureAppointmentDate();
      const newDate = makeRescheduleDate();

      const appt = await appointmentService.bookAppointment(donor1._id, hospital._id, null, apptDate);

      const req = {
        user: { userId: donor2._id },
        params: { appointmentId: appt._id.toString() },
        body: { appointmentDate: newDate.toISOString() },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await appointmentController.rescheduleAppointment(req, res, next);

      expectHttpError(next, 404, /appointment.error_not_found/);
    });
  });

  describe('getAvailableSlots', () => {
    it('returns available slots for a hospital and date', async () => {
      const hospital = await createHospital({
        slotsPerHour: 1,
        workingHoursStart: 9,
        workingHoursEnd: 11,
      });
      const donor = await createDonor();
      const date = makeFutureAppointmentDate();

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

      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(Array.isArray(callArgs.data.timeSlots)).toBe(true);
    });

    it('forwards excludeAppointmentId when provided', async () => {
      const donor = await createDonor();
      const req = {
        user: { userId: donor._id },
        query: {
          hospitalId: '507f1f77bcf86cd799439011',
          date: makeFutureAppointmentDate().toISOString(),
          excludeAppointmentId: '507f1f77bcf86cd799439012',
        },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();
      const slotsSpy = vi.spyOn(appointmentService, 'getAvailableSlots').mockResolvedValueOnce({
        timeSlots: ['08:00 AM'],
      });

      await appointmentController.getAvailableSlots(req, res, next);

      expect(slotsSpy).toHaveBeenCalledWith(req.query.hospitalId, req.query.date, {
        excludeAppointmentId: req.query.excludeAppointmentId,
      });
      expect(res.json).toHaveBeenCalled();
    });
  });
});
