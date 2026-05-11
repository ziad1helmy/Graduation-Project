import Campaign from '../models/Campaign.model.js';
import Donation from '../models/Donation.model.js';
import Request from '../models/Request.model.js';

/**
 * Campaign Service
 * Manages seasonal campaigns and point multipliers
 */

/**
 * Get currently active campaigns
 */
export const getActiveCampaigns = async () => {
  try {
    const now = new Date();
    const campaigns = await Campaign.find({
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .select('name description multiplier donationTypes bloodTypes urgencyLevel banner tags')
      .lean();

    return campaigns;
  } catch (error) {
    console.error('Error fetching active campaigns', error);
    throw error;
  }
};

/**
 * Get applicable multiplier for a donation
 * Returns the highest multiplier if multiple campaigns apply
 */
export const getApplicableMultiplier = async (donationType, bloodType, urgencyLevel) => {
  try {
    const activeCampaigns = await getActiveCampaigns();

    let maxMultiplier = 1.0;

    for (const campaign of activeCampaigns) {
      // Check if campaign has reached max redemptions
      if (campaign.maxRedemptions && campaign.currentRedemptions >= campaign.maxRedemptions) {
        continue;
      }

      // Check donation type match
      if (!campaign.donationTypes.includes(donationType)) {
        continue;
      }

      // Check blood type match (if specified)
      if (campaign.bloodTypes.length > 0 && !campaign.bloodTypes.includes(bloodType)) {
        continue;
      }

      // Check urgency level match (if specified)
      if (campaign.urgencyLevel && urgencyLevel !== campaign.urgencyLevel) {
        continue;
      }

      // Update max multiplier
      maxMultiplier = Math.max(maxMultiplier, campaign.multiplier);
    }

    return maxMultiplier;
  } catch (error) {
    console.error('Error calculating applicable multiplier', error);
    throw error;
  }
};

/**
 * Create a new campaign (Admin only)
 */
export const createCampaign = async (campaignData, adminId) => {
  try {
    const campaign = new Campaign({
      ...campaignData,
      createdBy: adminId,
    });

    await campaign.save();
    return campaign;
  } catch (error) {
    console.error('Error creating campaign', error);
    throw error;
  }
};

/**
 * Update campaign
 */
export const updateCampaign = async (campaignId, updates) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(
      campaignId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!campaign) throw new Error('Campaign not found');
    return campaign;
  } catch (error) {
    console.error('Error updating campaign', error);
    throw error;
  }
};

/**
 * Activate campaign
 */
export const activateCampaign = async (campaignId) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(
      campaignId,
      { $set: { active: true } },
      { new: true }
    );

    if (!campaign) throw new Error('Campaign not found');
    return campaign;
  } catch (error) {
    console.error('Error activating campaign', error);
    throw error;
  }
};

/**
 * Deactivate campaign
 */
export const deactivateCampaign = async (campaignId) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(
      campaignId,
      { $set: { active: false } },
      { new: true }
    );

    if (!campaign) throw new Error('Campaign not found');
    return campaign;
  } catch (error) {
    console.error('Error deactivating campaign', error);
    throw error;
  }
};

/**
 * Get campaign performance metrics
 */
export const getCampaignMetrics = async (campaignId) => {
  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    // Find donations completed during campaign period
    const donations = await Donation.find({
      status: 'completed',
      completedDate: {
        $gte: campaign.startDate,
        $lte: campaign.endDate,
      },
    })
      .populate('requestId', 'type bloodType urgency')
      .lean();

    let applicableDonations = 0;
    let totalMultipliedPoints = 0;

    const POINTS_BY_TYPE = {
      blood: 200,
      plasma: 150,
      platelets: 175,
      organ: 500,
    };

    for (const donation of donations) {
      const request = donation.requestId;
      if (!request) continue;

      const donationType = request.type || 'blood';

      // Check if donation matches campaign criteria
      if (!campaign.donationTypes.includes(donationType)) continue;
      if (campaign.bloodTypes.length > 0 && !campaign.bloodTypes.includes(request.bloodType)) continue;
      if (campaign.urgencyLevel && request.urgency !== campaign.urgencyLevel) continue;

      applicableDonations++;
      const basePoints = POINTS_BY_TYPE[donationType] || 0;
      totalMultipliedPoints += basePoints * campaign.multiplier;
    }

    return {
      campaignId,
      campaignName: campaign.name,
      period: `${campaign.startDate.toISOString()} to ${campaign.endDate.toISOString()}`,
      applicableDonations,
      totalMultipliedPoints,
      baseTotalPoints: applicableDonations > 0 
        ? totalMultipliedPoints / campaign.multiplier 
        : 0,
      averageMultiplier: campaign.multiplier,
      pointsBoost: applicableDonations > 0 
        ? Math.round((totalMultipliedPoints - (totalMultipliedPoints / campaign.multiplier)) / applicableDonations)
        : 0,
    };
  } catch (error) {
    console.error('Error fetching campaign metrics', error);
    throw error;
  }
};

/**
 * List all campaigns with filters
 */
export const listCampaigns = async (filters = {}) => {
  try {
    const query = {};

    if (filters.active !== undefined) {
      query.active = filters.active;
    }

    if (filters.status === 'upcoming') {
      query.startDate = { $gt: new Date() };
    } else if (filters.status === 'active') {
      const now = new Date();
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    } else if (filters.status === 'expired') {
      query.endDate = { $lt: new Date() };
    }

    if (filters.donationType) {
      query.donationTypes = filters.donationType;
    }

    const campaigns = await Campaign.find(query)
      .select('name description active startDate endDate multiplier donationTypes currentRedemptions maxRedemptions')
      .sort({ startDate: -1 })
      .lean();

    return campaigns;
  } catch (error) {
    console.error('Error listing campaigns', error);
    throw error;
  }
};

export default {
  getActiveCampaigns,
  getApplicableMultiplier,
  createCampaign,
  updateCampaign,
  activateCampaign,
  deactivateCampaign,
  getCampaignMetrics,
  listCampaigns,
};
