import RewardsConfig, { DEFAULT_REWARDS_CONFIG, REWARDS_CONFIG_KEY } from '../models/RewardsConfig.model.js';
import EarningRule, { DEFAULT_EARNING_RULES, EARNING_RULE_TYPES } from '../models/EarningRule.model.js';
import earningRuleRepo from '../repositories/EarningRuleRepository.js';
import { logAudit } from './audit.service.js';
import { HttpError } from '../utils/HttpError.js';

let cachedRewardsConfig = null;
let cachedEarningRulesMap = null;

const cloneConfig = (config) => ({
  points: { ...config.points },
  tiers: { ...config.tiers },
  tierBonuses: { ...config.tierBonuses },
});

const normalizeConfig = (config = DEFAULT_REWARDS_CONFIG) => ({
  points: {
    bloodDonation: Number(config.points?.bloodDonation),
    plasmaDonation: Number(config.points?.plasmaDonation),
    plateletsDonation: Number(config.points?.plateletsDonation),
    doubleRedCellsDonation: Number(config.points?.doubleRedCellsDonation),
    emergencyResponse: Number(config.points?.emergencyResponse),
    profileCompletion: Number(config.points?.profileCompletion),
    referral: Number(config.points?.referral),
    firstDonation: Number(config.points?.firstDonation),
  },
  tiers: {
    bronze: Number(config.tiers?.bronze),
    silver: Number(config.tiers?.silver),
    gold: Number(config.tiers?.gold),
    platinum: Number(config.tiers?.platinum),
  },
  tierBonuses: {
    silver: Number(config.tierBonuses?.silver),
    gold: Number(config.tierBonuses?.gold),
    platinum: Number(config.tierBonuses?.platinum),
  },
});

const toPlainConfig = (doc) => ({
  points: { ...doc.points },
  tiers: { ...doc.tiers },
  tierBonuses: { ...doc.tierBonuses },
});

export const invalidateRewardsConfigCache = () => {
  cachedRewardsConfig = null;
  cachedEarningRulesMap = null;
};

/**
 * Build a points map from EarningRule documents: { bloodDonation: 200, plasmaDonation: 150, ... }
 */
const buildEarningRulesMap = async () => {
  if (cachedEarningRulesMap) {
    return { ...cachedEarningRulesMap };
  }

  const rules = await earningRuleRepo.findAllSorted();
  if (rules.length === 0) {
    await seedDefaultEarningRules();
    return buildEarningRulesMap();
  }

  cachedEarningRulesMap = {};
  for (const rule of rules) {
    cachedEarningRulesMap[rule.type] = rule.points;
  }

  return { ...cachedEarningRulesMap };
};

/**
 * Seed default earning rules if none exist.
 */
export const seedDefaultEarningRules = async () => {
  const existing = await EarningRule.countDocuments();
  if (existing > 0) return;

  for (const rule of DEFAULT_EARNING_RULES) {
    await EarningRule.create(rule);
  }

  cachedEarningRulesMap = null;
};

export const initializeDefaultConfig = async () => {
  const config = await RewardsConfig.findOneAndUpdate(
    { configKey: REWARDS_CONFIG_KEY },
    {
      $setOnInsert: {
        configKey: REWARDS_CONFIG_KEY,
        ...cloneConfig(DEFAULT_REWARDS_CONFIG),
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  await seedDefaultEarningRules();

  cachedRewardsConfig = toPlainConfig(config);
  return cloneConfig(cachedRewardsConfig);
};

export const getRewardsConfig = async () => {
  if (cachedRewardsConfig) {
    const config = cloneConfig(cachedRewardsConfig);
    const pointsMap = await buildEarningRulesMap();
    config.points = { ...pointsMap };
    return config;
  }

  const config = await RewardsConfig.findOne({ configKey: REWARDS_CONFIG_KEY });
  if (!config) {
    return initializeDefaultConfig();
  }

  cachedRewardsConfig = toPlainConfig(config);

  const pointsMap = await buildEarningRulesMap();
  cachedRewardsConfig.points = { ...pointsMap };

  return cloneConfig(cachedRewardsConfig);
};

export const updateRewardsConfig = async (updates = {}, updatedBy = null) => {
  const sanitizedConfig = normalizeConfig(updates);

  const config = await RewardsConfig.findOneAndUpdate(
    { configKey: REWARDS_CONFIG_KEY },
    {
      $set: {
        ...sanitizedConfig,
        updatedBy,
      },
      $setOnInsert: {
        configKey: REWARDS_CONFIG_KEY,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  cachedRewardsConfig = toPlainConfig(config);

  if (updates.points) {
    for (const [type, points] of Object.entries(updates.points)) {
      await earningRuleRepo.upsertByType(type, { points, title: DEFAULT_EARNING_RULES.find(r => r.type === type)?.title || type });
    }
    cachedEarningRulesMap = null;
  }

  const pointsMap = await buildEarningRulesMap();
  cachedRewardsConfig.points = { ...pointsMap };

  if (updatedBy) {
    await logAudit(updatedBy, 'admin.update_rewards_config', 'System', config._id, sanitizedConfig);
  }

  return cloneConfig(cachedRewardsConfig);
};

// ──────────────────────────────────────────────
//  Earning Rule CRUD (individual rule management)
// ──────────────────────────────────────────────

/** POST - Create a new earning rule */
export const createEarningRule = async (data, createdBy = null) => {
  if (!EARNING_RULE_TYPES.includes(data.type)) {
    throw new HttpError(400, `Invalid rule type. Must be one of: ${EARNING_RULE_TYPES.join(', ')}`);
  }

  const existing = await earningRuleRepo.findByType(data.type);
  if (existing) {
    throw new HttpError(409, `Earning rule '${data.type}' already exists`);
  }

  const rule = await earningRuleRepo.create({
    type: data.type,
    title: data.title,
    points: data.points,
    category: data.category,
    isActive: data.isActive !== undefined ? data.isActive : true,
  });

  cachedEarningRulesMap = null;

  if (createdBy) {
    await logAudit(createdBy, 'admin.create_earning_rule', 'EarningRule', rule._id, data);
  }

  return rule;
};

/** GET - List all earning rules */
export const listEarningRules = async () => {
  return earningRuleRepo.findAllSorted();
};

/** GET - Get a single earning rule by ID */
export const getEarningRuleById = async (id) => {
  const rule = await earningRuleRepo.findById(id);
  if (!rule) {
    throw new HttpError(404, 'Earning rule not found');
  }
  return rule;
};

/** PATCH - Update an earning rule */
export const updateEarningRule = async (id, updates, updatedBy = null) => {
  const rule = await earningRuleRepo.findById(id, { lean: false });
  if (!rule) {
    throw new HttpError(404, 'Earning rule not found');
  }

  if (updates.type !== undefined && updates.type !== rule.type) {
    if (!EARNING_RULE_TYPES.includes(updates.type)) {
      throw new HttpError(400, `Invalid rule type. Must be one of: ${EARNING_RULE_TYPES.join(', ')}`);
    }
    const existing = await earningRuleRepo.findByType(updates.type);
    if (existing && existing._id.toString() !== id) {
      throw new HttpError(409, `Earning rule '${updates.type}' already exists`);
    }
  }

  const allowedFields = ['type', 'title', 'points', 'category', 'isActive'];
  const sanitized = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      sanitized[field] = updates[field];
    }
  }

  const updated = await earningRuleRepo.updateById(id, sanitized);
  cachedEarningRulesMap = null;

  if (updatedBy) {
    await logAudit(updatedBy, 'admin.update_earning_rule', 'EarningRule', id, sanitized);
  }

  return updated;
};

/** DELETE - Delete an earning rule */
export const deleteEarningRule = async (id, deletedBy = null) => {
  const rule = await earningRuleRepo.findById(id);
  if (!rule) {
    throw new HttpError(404, 'Earning rule not found');
  }

  await earningRuleRepo.deleteById(id);
  cachedEarningRulesMap = null;

  if (deletedBy) {
    await logAudit(deletedBy, 'admin.delete_earning_rule', 'EarningRule', id, { type: rule.type });
  }
};

