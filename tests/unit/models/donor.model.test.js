import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../../helpers/db.js';
import { createDonor } from '../../helpers/factories.js';
import Donor from '../../../src/models/Donor.model.js';

setupTestDB();

describe('Donor model', () => {
  describe('Settings subdocument', () => {
    it('creates donor with default settings', async () => {
      const donor = await createDonor();

      const retrieved = await Donor.findById(donor._id);

      expect(retrieved.settings).toBeTruthy();
      expect(retrieved.settings.pushNotifications).toBe(true);
      expect(retrieved.settings.emergencyAlerts).toBe(true);
      expect(retrieved.settings.privacyMode).toBe(false);
      expect(retrieved.settings.language).toBe('en');
    });

    it('allows updating individual settings fields', async () => {
      const donor = await createDonor();

      const updated = await Donor.findByIdAndUpdate(
        donor._id,
        {
          'settings.pushNotifications': false,
          'settings.language': 'ar',
        },
        { new: true }
      );

      expect(updated.settings.pushNotifications).toBe(false);
      expect(updated.settings.language).toBe('ar');
      expect(updated.settings.emergencyAlerts).toBe(true); // unchanged
      expect(updated.settings.privacyMode).toBe(false); // unchanged
    });

    it('validates language enum', async () => {
      const donor = await createDonor();

      await expect(
        Donor.findByIdAndUpdate(donor._id, { 'settings.language': 'fr' }, { runValidators: true })
      ).rejects.toThrow();
    });

    it('coerces pushNotifications to boolean', async () => {
      const donor = await createDonor();

      const updated = await Donor.findByIdAndUpdate(
        donor._id,
        { 'settings.pushNotifications': 'yes' },
        { new: true, runValidators: true }
      );

      expect(typeof updated.settings.pushNotifications).toBe('boolean');
      expect(updated.settings.pushNotifications).toBe(true);
    });

    it('allows switching language to ar', async () => {
      const donor = await createDonor();

      const updated = await Donor.findByIdAndUpdate(
        donor._id,
        { 'settings.language': 'ar' },
        { new: true, runValidators: true }
      );

      expect(updated.settings.language).toBe('ar');
    });
  });

  describe('Donor health and eligibility', () => {
    it('tracks bloodType', async () => {
      const donor = await createDonor({ bloodType: 'O+' });
      expect(donor.bloodType).toBe('O+');
    });

    it('allows setting lastDonationDate', async () => {
      const date = new Date('2026-01-01');
      const donor = await createDonor({ lastDonationDate: date });

      const retrieved = await Donor.findById(donor._id);
      expect(retrieved.lastDonationDate).toBeTruthy();
    });

    it('tracks suspension through base user fields', async () => {
      const donor = await createDonor();

      const updated = await Donor.findByIdAndUpdate(
        donor._id,
        { isSuspended: true },
        { new: true }
      );

      expect(updated.isSuspended).toBe(true);
    });
  });
});
