import * as campaignService from '../services/campaign.service.js';
import { logger } from '../utils/logger.js';

/**
 * GET /campaigns/active
 * Get currently active campaigns
 */
export const getActiveCampaigns = async (req, res, next) => {
  try {
    const campaigns = await campaignService.getActiveCampaigns();
    return res.status(200).json({ success: true, data: campaigns });
  } catch (error) {
    logger.error('Error fetching active campaigns', { error: error?.message });
    return next(error);
  }
};

/**
 * GET /campaigns
 * List all campaigns with filters (Admin only)
 */
export const listCampaigns = async (req, res, next) => {
  try {
    const { status, donationType, active } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (donationType) filters.donationType = donationType;
    if (active !== undefined) filters.active = active === 'true';

    const campaigns = await campaignService.listCampaigns(filters);
    return res.status(200).json({ success: true, data: campaigns });
  } catch (error) {
    logger.error('Error listing campaigns', { error: error?.message });
    return next(error);
  }
};

/**
 * POST /campaigns
 * Create a new campaign (Admin only)
 */
export const createCampaign = async (req, res, next) => {
  try {
    const { name, description, startDate, endDate, multiplier, donationTypes, bloodTypes, urgencyLevel, maxRedemptions, banner, tags } = req.body;

    // Validation
    if (!name || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'name, startDate, and endDate are required',
      });
    }

    if (multiplier && (multiplier < 1.0 || multiplier > 3.0)) {
      return res.status(400).json({
        success: false,
        message: 'multiplier must be between 1.0 and 3.0',
      });
    }

    const campaign = await campaignService.createCampaign(
      {
        name,
        description,
        startDate,
        endDate,
        multiplier: multiplier || 1.0,
        donationTypes: donationTypes || ['blood'],
        bloodTypes: bloodTypes || [],
        urgencyLevel,
        maxRedemptions,
        banner,
        tags: tags || [],
        active: false,
      },
      req.user.userId
    );

    return res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Error creating campaign', { error: error?.message });
    return next(error);
  }
};

/**
 * PUT /campaigns/:campaignId
 * Update campaign (Admin only)
 */
export const updateCampaign = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const updates = req.body;

    if (updates.multiplier && (updates.multiplier < 1.0 || updates.multiplier > 3.0)) {
      return res.status(400).json({
        success: false,
        message: 'multiplier must be between 1.0 and 3.0',
      });
    }

    const campaign = await campaignService.updateCampaign(campaignId, updates);
    return res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Error updating campaign', { error: error?.message, campaignId: req.params?.campaignId });
    return next(error);
  }
};

/**
 * POST /campaigns/:campaignId/activate
 * Activate campaign (Admin only)
 */
export const activateCampaign = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const campaign = await campaignService.activateCampaign(campaignId);
    return res.status(200).json({ success: true, data: campaign, message: 'Campaign activated' });
  } catch (error) {
    logger.error('Error activating campaign', { error: error?.message, campaignId: req.params?.campaignId });
    return next(error);
  }
};

/**
 * POST /campaigns/:campaignId/deactivate
 * Deactivate campaign (Admin only)
 */
export const deactivateCampaign = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const campaign = await campaignService.deactivateCampaign(campaignId);
    return res.status(200).json({ success: true, data: campaign, message: 'Campaign deactivated' });
  } catch (error) {
    logger.error('Error deactivating campaign', { error: error?.message, campaignId: req.params?.campaignId });
    return next(error);
  }
};

/**
 * GET /campaigns/:campaignId/metrics
 * Get campaign performance metrics (Admin only)
 */
export const getCampaignMetrics = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const metrics = await campaignService.getCampaignMetrics(campaignId);
    return res.status(200).json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Error fetching campaign metrics', { error: error?.message, campaignId: req.params?.campaignId });
    return next(error);
  }
};

/**
 * DELETE /campaigns/:campaignId
 * Delete campaign (Admin only)
 */
export const deleteCampaign = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    await campaignService.updateCampaign(campaignId, { deletedAt: new Date() });
    return res.status(200).json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    logger.error('Error deleting campaign', { error: error?.message, campaignId: req.params?.campaignId });
    return next(error);
  }
};

export default {
  getActiveCampaigns,
  listCampaigns,
  createCampaign,
  updateCampaign,
  activateCampaign,
  deactivateCampaign,
  getCampaignMetrics,
  deleteCampaign,
};
