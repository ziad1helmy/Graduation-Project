import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../../helpers/db.js';
import { createDonor, createHospital } from '../../helpers/factories.js';
import Appointment from '../../../src/models/Appointment.model.js';
import crypto from 'crypto';

setupTestDB();

describe('Appointment model', () => {
  describe('Dev 1: QR Token Fields', () => {
    it('accepts qrToken as unique indexed field', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const qrToken = crypto.randomBytes(32).toString('hex');

      const appointment = await Appointment.create({
        donorId: donor._id,
        hospitalId: hospital._id,
        appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        qrToken,
        status: 'pending',
      });

      expect(appointment.qrToken).toBe(qrToken);
      const retrieved = await Appointment.findById(appointment._id);
      expect(retrieved.qrToken).toBe(qrToken);
    });

    it('enforces qrToken uniqueness', async () => {
      const donor1 = await createDonor();
      const donor2 = await createDonor();
      const hospital = await createHospital();
      const qrToken = crypto.randomBytes(32).toString('hex');

      await Appointment.create({
        donorId: donor1._id,
        hospitalId: hospital._id,
        appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        qrToken,
        status: 'pending',
      });

      await expect(
        Appointment.create({
          donorId: donor2._id,
          hospitalId: hospital._id,
          appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
          qrToken, // same token
          status: 'pending',
        })
      ).rejects.toThrow();
    });

    it('tracks qrScannedAt timestamp', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const qrToken = crypto.randomBytes(32).toString('hex');
      const scannedAt = new Date();

      const appointment = await Appointment.create({
        donorId: donor._id,
        hospitalId: hospital._id,
        appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        qrToken,
        qrScannedAt: scannedAt,
        status: 'pending',
      });

      expect(appointment.qrScannedAt).toBeTruthy();
      const retrieved = await Appointment.findById(appointment._id);
      expect(retrieved.qrScannedAt).toBeTruthy();
    });

    it('defaults qrScannedAt to null', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const qrToken = crypto.randomBytes(32).toString('hex');

      const appointment = await Appointment.create({
        donorId: donor._id,
        hospitalId: hospital._id,
        appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        qrToken,
        status: 'pending',
      });

      expect(appointment.qrScannedAt).toBeNull();
    });
  });

  describe('Dev 1: Donation Type', () => {
    it('accepts valid donationType enum values', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const qrToken = crypto.randomBytes(32).toString('hex');

      const appt = await Appointment.create({
        donorId: donor._id,
        hospitalId: hospital._id,
        appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        qrToken,
        donationType: 'Platelets',
        status: 'pending',
      });

      expect(appt.donationType).toBe('Platelets');
    });

    it('defaults donationType to Whole Blood', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const qrToken = crypto.randomBytes(32).toString('hex');

      const appt = await Appointment.create({
        donorId: donor._id,
        hospitalId: hospital._id,
        appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        qrToken,
        status: 'pending',
      });

      expect(appt.donationType).toBe('Whole Blood');
    });

    it('rejects invalid donationType', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const qrToken = crypto.randomBytes(32).toString('hex');

      await expect(
        Appointment.create({
          donorId: donor._id,
          hospitalId: hospital._id,
          appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
          qrToken,
          donationType: 'InvalidType',
          status: 'pending',
        })
      ).rejects.toThrow();
    });

    it('accepts all valid donationType enum options', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const validTypes = ['Whole Blood', 'Platelets', 'Plasma'];

      for (const type of validTypes) {
        const qrToken = crypto.randomBytes(32).toString('hex');
        const appt = await Appointment.create({
          donorId: donor._id,
          hospitalId: hospital._id,
          appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
          qrToken,
          donationType: type,
          status: 'pending',
        });
        expect(appt.donationType).toBe(type);
      }
    });
  });

  describe('Appointment status and dates', () => {
    it('requires appointmentDate to be set', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();

      await expect(
        Appointment.create({
          donorId: donor._id,
          hospitalId: hospital._id,
          status: 'pending',
        })
      ).rejects.toThrow();
    });

    it('tracks appointment status changes', async () => {
      const donor = await createDonor();
      const hospital = await createHospital();
      const qrToken = crypto.randomBytes(32).toString('hex');

      const appt = await Appointment.create({
        donorId: donor._id,
        hospitalId: hospital._id,
        appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        qrToken,
        status: 'pending',
      });

      expect(appt.status).toBe('pending');

      const updated = await Appointment.findByIdAndUpdate(appt._id, { status: 'confirmed' }, { new: true });
      expect(updated.status).toBe('confirmed');
    });
  });
});
