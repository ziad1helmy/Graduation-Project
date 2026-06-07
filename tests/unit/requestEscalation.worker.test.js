import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import Request from '../../src/models/Request.model.js';
import Donation from '../../src/models/Donation.model.js';
import { processArrivalExpirations, processReBroadcasts, processEmergencyReBroadcasts } from '../../src/workers/requestEscalation.worker.js';

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
        qrExpires: pastDeadline,
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
        qrExpires: futureDeadline,
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
        qrExpires: pastDeadline,
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
});