import { BaseRepository } from './BaseRepository.js';
import EarningRule from '../models/EarningRule.model.js';

class EarningRuleRepository extends BaseRepository {
  constructor() {
    super(EarningRule, 'EarningRule');
  }

  async findByType(type) {
    return this.findOne({ type });
  }

  async findActive() {
    return this.find({ isActive: true }, { sort: { type: 1 } });
  }

  async findAllSorted() {
    return this.find({}, { sort: { type: 1 } });
  }

  async upsertByType(type, data) {
    return this.model.findOneAndUpdate(
      { type },
      { $set: data },
      { upsert: true, new: true, lean: true }
    );
  }
}

export default new EarningRuleRepository();
