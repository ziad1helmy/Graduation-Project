import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../../helpers/db.js';
import { createHospital } from '../../helpers/factories.js';
import Hospital from '../../../src/models/Hospital.model.js';

setupTestDB();

describe('Hospital model', () => {
  describe('Dev 2 Task 7: Appointment Slot Configuration', () => {
    it('accepts slotsPerHour configuration', async () => {
      const hospital = await createHospital({
        slotsPerHour: 6,
      });

      const retrieved = await Hospital.findById(hospital._id);
      expect(retrieved.slotsPerHour).toBe(6);
    });

    it('defaults slotsPerHour to 5', async () => {
      const hospital = await createHospital();

      const retrieved = await Hospital.findById(hospital._id);
      expect(retrieved.slotsPerHour).toBe(5);
    });

    it('enforces slotsPerHour minimum of 1', async () => {
      const hospital = await createHospital();

      await expect(
        Hospital.findByIdAndUpdate(hospital._id, { slotsPerHour: 0 }, { runValidators: true })
      ).rejects.toThrow();
    });

    it('accepts workingHoursStart in 24-hour format', async () => {
      const hospital = await createHospital({
        workingHoursStart: 8,
      });

      const retrieved = await Hospital.findById(hospital._id);
      expect(retrieved.workingHoursStart).toBe(8);
    });

    it('defaults workingHoursStart to 9', async () => {
      const hospital = await createHospital();

      const retrieved = await Hospital.findById(hospital._id);
      expect(retrieved.workingHoursStart).toBe(9);
    });

    it('accepts workingHoursEnd in 24-hour format', async () => {
      const hospital = await createHospital({
        workingHoursEnd: 18,
      });

      const retrieved = await Hospital.findById(hospital._id);
      expect(retrieved.workingHoursEnd).toBe(18);
    });

    it('defaults workingHoursEnd to 17', async () => {
      const hospital = await createHospital();

      const retrieved = await Hospital.findById(hospital._id);
      expect(retrieved.workingHoursEnd).toBe(17);
    });

    it('enforces hours between 0 and 23', async () => {
      const hospital = await createHospital();

      await expect(
        Hospital.findByIdAndUpdate(hospital._id, { workingHoursStart: 24 }, { runValidators: true })
      ).rejects.toThrow();

      await expect(
        Hospital.findByIdAndUpdate(hospital._id, { workingHoursEnd: -1 }, { runValidators: true })
      ).rejects.toThrow();
    });

    it('allows updating all slot configuration fields independently', async () => {
      const hospital = await createHospital();

      const updated = await Hospital.findByIdAndUpdate(
        hospital._id,
        {
          slotsPerHour: 7,
          workingHoursStart: 7,
          workingHoursEnd: 19,
        },
        { new: true }
      );

      expect(updated.slotsPerHour).toBe(7);
      expect(updated.workingHoursStart).toBe(7);
      expect(updated.workingHoursEnd).toBe(19);
    });

    it('tracks bloodBanksAvailable for blood type information', async () => {
      const hospital = await createHospital({
        bloodBanksAvailable: ['O+', 'O-', 'A+', 'B+'],
      });

      const retrieved = await Hospital.findById(hospital._id);
      expect(retrieved.bloodBanksAvailable).toEqual(['O+', 'O-', 'A+', 'B+']);
    });
  });

  describe('Hospital basic fields', () => {
    it('requires hospitalName', async () => {
      await expect(
        Hospital.create({
          email: `hospital${Date.now()}@test.com`,
          password: 'Password123!',
          fullName: 'Test Hospital',
        })
      ).rejects.toThrow();
    });

    it('tracks hospital location coordinates', async () => {
      const hospital = await createHospital({
        lat: 30.05,
        long: 31.25,
      });

      const retrieved = await Hospital.findById(hospital._id);
      expect(retrieved.lat).toBe(30.05);
      expect(retrieved.long).toBe(31.25);
    });
  });
});
