import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import Campaign from '../../src/models/Campaign.model.js';
import * as campaignService from '../../src/services/campaign.service.js';

setupTestDB();

describe('Campaign Service', () => {
  let adminUser;

  beforeEach(async () => {
    adminUser = await createHospital(); // Using hospital as admin for testing
  });

  describe('getActiveCampaigns', () => {
    it('should return empty array when no campaigns exist', async () => {
      const campaigns = await campaignService.getActiveCampaigns();
      expect(Array.isArray(campaigns)).toBe(true);
      expect(campaigns.length).toBe(0);
    });

    it('should return active campaigns within current date range', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow

      await Campaign.create({
        name: 'Summer Blood Drive',
        description: 'Help save lives this summer',
        active: true,
        startDate,
        endDate,
        multiplier: 1.5,
        donationTypes: ['blood'],
        createdBy: adminUser._id,
      });

      const campaigns = await campaignService.getActiveCampaigns();
      expect(campaigns.length).toBe(1);
      expect(campaigns[0].name).toBe('Summer Blood Drive');
      expect(campaigns[0].multiplier).toBe(1.5);
    });

    it('should not return inactive campaigns', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await Campaign.create({
        name: 'Inactive Campaign',
        active: false,
        startDate,
        endDate,
        multiplier: 2.0,
        donationTypes: ['blood'],
        createdBy: adminUser._id,
      });

      const campaigns = await campaignService.getActiveCampaigns();
      expect(campaigns.length).toBe(0);
    });

    it('should not return expired campaigns', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday

      await Campaign.create({
        name: 'Expired Campaign',
        active: true,
        startDate,
        endDate,
        multiplier: 2.0,
        donationTypes: ['blood'],
        createdBy: adminUser._id,
      });

      const campaigns = await campaignService.getActiveCampaigns();
      expect(campaigns.length).toBe(0);
    });
  });

  describe('getApplicableMultiplier', () => {
    it('should return 1.0 when no campaigns apply', async () => {
      const multiplier = await campaignService.getApplicableMultiplier('blood', 'O+', 'high');
      expect(multiplier).toBe(1.0);
    });

    it('should return campaign multiplier for matching donation type', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await Campaign.create({
        name: 'Plasma Bonus',
        active: true,
        startDate,
        endDate,
        multiplier: 2.0,
        donationTypes: ['plasma'],
        createdBy: adminUser._id,
      });

      const multiplier = await campaignService.getApplicableMultiplier('plasma', 'O+', 'high');
      expect(multiplier).toBe(2.0);
    });

    it('should return 1.0 for non-matching donation type', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await Campaign.create({
        name: 'Blood Only',
        active: true,
        startDate,
        endDate,
        multiplier: 2.0,
        donationTypes: ['blood'],
        createdBy: adminUser._id,
      });

      const multiplier = await campaignService.getApplicableMultiplier('plasma', 'O+', 'high');
      expect(multiplier).toBe(1.0);
    });

    it('should return highest multiplier when multiple campaigns apply', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await Campaign.create({
        name: 'Campaign 1',
        active: true,
        startDate,
        endDate,
        multiplier: 1.5,
        donationTypes: ['blood'],
        createdBy: adminUser._id,
      });

      await Campaign.create({
        name: 'Campaign 2',
        active: true,
        startDate,
        endDate,
        multiplier: 2.5,
        donationTypes: ['blood'],
        createdBy: adminUser._id,
      });

      const multiplier = await campaignService.getApplicableMultiplier('blood', 'O+', 'high');
      expect(multiplier).toBe(2.5);
    });

    it('should filter by blood type if specified', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await Campaign.create({
        name: 'O+ Only',
        active: true,
        startDate,
        endDate,
        multiplier: 2.0,
        donationTypes: ['blood'],
        bloodTypes: ['O+', 'O-'],
        createdBy: adminUser._id,
      });

      const multiplierMatch = await campaignService.getApplicableMultiplier('blood', 'O+', 'high');
      expect(multiplierMatch).toBe(2.0);

      const multiplierNoMatch = await campaignService.getApplicableMultiplier('blood', 'A+', 'high');
      expect(multiplierNoMatch).toBe(1.0);
    });
  });

  describe('createCampaign', () => {
    it('should create a new campaign', async () => {
      const campaignData = {
        name: 'Winter Drive',
        description: 'Help during winter season',
        active: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        multiplier: 1.8,
        donationTypes: ['blood', 'plasma'],
      };

      const campaign = await campaignService.createCampaign(campaignData, adminUser._id);
      expect(campaign).toBeTruthy();
      expect(campaign.name).toBe('Winter Drive');
      expect(campaign.createdBy).toEqual(adminUser._id);
    });
  });

  describe('updateCampaign', () => {
    it('should update campaign properties', async () => {
      const campaign = await Campaign.create({
        name: 'Original',
        active: false,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        multiplier: 1.0,
        donationTypes: ['blood'],
        createdBy: adminUser._id,
      });

      const updated = await campaignService.updateCampaign(campaign._id, {
        name: 'Updated',
        multiplier: 2.0,
      });

      expect(updated.name).toBe('Updated');
      expect(updated.multiplier).toBe(2.0);
    });
  });

  describe('activateCampaign and deactivateCampaign', () => {
    it('should activate and deactivate campaigns', async () => {
      const campaign = await Campaign.create({
        name: 'Test Campaign',
        active: false,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        multiplier: 1.5,
        donationTypes: ['blood'],
        createdBy: adminUser._id,
      });

      let activated = await campaignService.activateCampaign(campaign._id);
      expect(activated.active).toBe(true);

      let deactivated = await campaignService.deactivateCampaign(campaign._id);
      expect(deactivated.active).toBe(false);
    });
  });

  describe('listCampaigns', () => {
    it('should list all campaigns with filters', async () => {
      const now = new Date();
      await Campaign.create({
        name: 'Active Now',
        active: true,
        startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        multiplier: 1.5,
        donationTypes: ['blood'],
        createdBy: adminUser._id,
      });

      await Campaign.create({
        name: 'Future',
        active: true,
        startDate: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 72 * 60 * 60 * 1000),
        multiplier: 2.0,
        donationTypes: ['plasma'],
        createdBy: adminUser._id,
      });

      const activeCampaigns = await campaignService.listCampaigns({ status: 'active' });
      expect(activeCampaigns.length).toBe(1);
      expect(activeCampaigns[0].name).toBe('Active Now');

      const futureCampaigns = await campaignService.listCampaigns({ status: 'upcoming' });
      expect(futureCampaigns.length).toBe(1);
      expect(futureCampaigns[0].name).toBe('Future');
    });
  });
});
