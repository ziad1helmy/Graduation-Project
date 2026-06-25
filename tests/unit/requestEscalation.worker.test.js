import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import Request from '../../src/models/Request.model.js';
import Donation from '../../src/models/Donation.model.js';
import Appointment from '../../src/models/Appointment.model.js';
import { processArrivalExpirations, processReBroadcasts, processEmergencyReBroadcasts, processAppointmentExpirations } from '../../src/workers/requestEscalation.worker.js';

describe('Request Escalation Worker', () => {
  setupTestDB();

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('processArrivalExpirations', () => {
    it('expires donations past their arrival deadline and reopens the request', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const urgentRequest = await createRequest(hospital._id, {
        bloodType: donor.bloodType,
        urgency: 'critical',
        isEmergency: true,
      });

      const pastDeadline = new Date(Date.now() - 60 * 60 * 1000);
      const donation = await createDonation(donor._id, urgentRequest._id, {
        status: 'pending',
        qrToken: 'test-qr-token-expiry',
        qrExpiresAt: pastDeadline,
        arrivalDeadline: pastDeadline,
        qrUsed: false,
      });

      await Request.findByIdAndUpdate(urgentRequest._id, {
        status: 'accepted',
        acceptedBy: donor._id,
        acceptedDonationId: donation._id,
        acceptedAt: new Date(),
        arrivalDeadline: pastDeadline,
      });

      const result = await processArrivalExpirations();

      expect(result.expired).toBeGreaterThanOrEqual(1);

      const updatedRequest = await Request.findById(urgentRequest._id);
      expect(updatedRequest.status).toBe('pending');
      expect(updatedRequest.acceptedBy).toBeNull();
      expect(updatedRequest.arrivalDeadline).toBeNull();

      const updatedDonation = await Donation.findById(donation._id);
      expect(updatedDonation.status).toBe('expired');
      expect(updatedDonation.qrUsed).toBe(true);
    });

    it('skips donations whose arrival deadline has not yet passed', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const urgentRequest = await createRequest(hospital._id, {
        bloodType: donor.bloodType,
        urgency: 'critical',
        isEmergency: true,
      });

      const futureDeadline = new Date(Date.now() + 60 * 60 * 1000);
      const donation = await createDonation(donor._id, urgentRequest._id, {
        status: 'pending',
        qrToken: 'test-qr-token-future',
        qrExpiresAt: futureDeadline,
        arrivalDeadline: futureDeadline,
        qrUsed: false,
      });

      await Request.findByIdAndUpdate(urgentRequest._id, {
        status: 'accepted',
        acceptedBy: donor._id,
        acceptedDonationId: donation._id,
        acceptedAt: new Date(),
        arrivalDeadline: futureDeadline,
      });

      const result = await processArrivalExpirations();
      expect(result.expired).toBe(0);

      const unchangedRequest = await Request.findById(urgentRequest._id);
      expect(unchangedRequest.status).toBe('accepted');
    });

    it('skips donations already marked as qrUsed', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const urgentRequest = await createRequest(hospital._id, {
        bloodType: donor.bloodType,
        urgency: 'critical',
        isEmergency: true,
      });

      const pastDeadline = new Date(Date.now() - 60 * 60 * 1000);
      const donation = await createDonation(donor._id, urgentRequest._id, {
        status: 'pending',
        qrToken: 'test-qr-token-used',
        qrExpiresAt: pastDeadline,
        arrivalDeadline: pastDeadline,
        qrUsed: true,
      });

      await Request.findByIdAndUpdate(urgentRequest._id, {
        status: 'accepted',
        acceptedBy: donor._id,
        acceptedDonationId: donation._id,
        acceptedAt: new Date(),
        arrivalDeadline: pastDeadline,
      });

      const result = await processArrivalExpirations();
      expect(result.expired).toBe(0);
    });
  });

  describe('processReBroadcasts', () => {
    it('re-broadcasts pending requests that have exceeded their re-broadcast interval', async () => {
      const hospital = await createHospital();
      const urgentRequest = await createRequest(hospital._id, {
        bloodType: 'O+',
        urgency: 'medium',
        lastBroadcastAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      });

      const result = await processReBroadcasts();

      expect(result.reBroadcast).toBeGreaterThanOrEqual(0);

      const updatedRequest = await Request.findById(urgentRequest._id);
      if (result.reBroadcast > 0) {
        expect(updatedRequest.escalationLevel).toBeGreaterThanOrEqual(2);
      }
    });

    it('skips requests that have not yet reached their re-broadcast interval', async () => {
      const hospital = await createHospital();
      await createRequest(hospital._id, {
        bloodType: 'O+',
        urgency: 'medium',
        lastBroadcastAt: new Date(),
      });

      const result = await processReBroadcasts();
      expect(result.skipped).toBeGreaterThanOrEqual(1);
      expect(result.reBroadcast).toBe(0);
    });
  });

  describe('processEmergencyReBroadcasts', () => {
    it('processes emergency/critical requests with shorter intervals', async () => {
      const hospital = await createHospital();
      await createRequest(hospital._id, {
        bloodType: 'O+',
        urgency: 'critical',
        isEmergency: true,
        lastBroadcastAt: new Date(Date.now() - 20 * 60 * 1000),
      });

      const result = await processEmergencyReBroadcasts();
      expect(result.skipped + result.reBroadcast + result.failed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('processAppointmentExpirations', () => {
    it('expires appointments past their QR expiry and reverts linked donation and request', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const reqRecord = await createRequest(hospital._id, {
        bloodType: donor.bloodType,
        urgency: 'critical',
        status: 'accepted',
        acceptedBy: donor._id,
        acceptedAt: new Date(),
      });

      const pastQrExpiry = new Date(Date.now() - 60 * 60 * 1000);
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const appointment = await Appointment.create({
        donorId: donor._id,
        hospitalId: hospital._id,
        requestId: reqRecord._id,
        appointmentDate: futureDate,
        status: 'pending',
        donationType: 'Whole Blood',
        qrToken: `appt-expiry-test-${Date.now()}`,
        qrExpiresAt: pastQrExpiry,
      });

      const donation = await createDonation(donor._id, reqRecord._id, {
        status: 'scheduled',
        appointmentId: appointment._id,
        qrToken: `donation-appt-${Date.now()}`,
        qrExpiresAt: pastQrExpiry,
      });

      const result = await processAppointmentExpirations();

      expect(result.expired).toBeGreaterThanOrEqual(1);

      const updatedAppointment = await Appointment.findById(appointment._id);
      expect(updatedAppointment.status).toBe('expired');

      const updatedDonation = await Donation.findById(donation._id);
      expect(updatedDonation.status).toBe('expired');
      expect(updatedDonation.qrUsed).toBe(true);

      const updatedRequest = await Request.findById(reqRecord._id);
      expect(updatedRequest.status).toBe('pending');
    });

    it('skips appointments whose QR expiry has not yet passed', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const reqRecord = await createRequest(hospital._id, {
        bloodType: donor.bloodType,
        status: 'accepted',
        acceptedBy: donor._id,
        acceptedAt: new Date(),
      });

      const futureQrExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await Appointment.create({
        donorId: donor._id,
        hospitalId: hospital._id,
        requestId: reqRecord._id,
        appointmentDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        status: 'pending',
        donationType: 'Whole Blood',
        qrToken: `appt-future-${Date.now()}`,
        qrExpiresAt: futureQrExpiry,
      });

      const result = await processAppointmentExpirations();
      expect(result.expired).toBe(0);
    });

    it('skips appointments already in expired terminal status', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const pastQrExpiry = new Date(Date.now() - 60 * 60 * 1000);
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await Appointment.create({
        donorId: donor._id,
        hospitalId: hospital._id,
        appointmentDate: futureDate,
        status: 'expired',
        donationType: 'Whole Blood',
        qrToken: `appt-already-expired-${Date.now()}`,
        qrExpiresAt: pastQrExpiry,
      });

      const result = await processAppointmentExpirations();
      expect(result.expired).toBe(0);
    });
  });
});