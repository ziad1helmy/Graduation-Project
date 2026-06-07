/**
 * BaseRepository - Abstract repository pattern for data access abstraction
 * 
 * Provides common query operations and patterns for all data models.
 * Repositories encapsulate all model queries, reducing tight coupling to Mongoose
 * and enabling easier testing and caching strategies.
 */

import logger from '../utils/logger.js';

export class BaseRepository {
  /**
   * @param {Model} model - Mongoose model class
   * @param {string} modelName - Name of the model (for logging)
   */
  constructor(model, modelName = 'Unknown') {
    this.model = model;
    this.modelName = modelName;
  }

  /**
   * Create a new document
   * @param {object} data - Document data
   * @param {object} options - Additional options (session, etc.)
   * @returns {Promise<object>} Created document
   */
  async create(data, options = {}) {
    try {
      const document = await this.model.create([data], options);
      logger.debug(`${this.modelName} created`, { id: document[0]._id });
      return document[0];
    } catch (error) {
      logger.error(`Failed to create ${this.modelName}`, {
        error: error.message,
        data,
      });
      throw error;
    }
  }

  /**
   * Find document by ID
   * @param {string} id - Document ID
   * @param {object} options - Query options (projection, lean, etc.)
   * @returns {Promise<object|null>} Found document or null
   */
  async findById(id, options = {}) {
    try {
      const { projection = null, lean = true } = options;
      let query = this.model.findById(id);

      if (projection) {
        query = query.select(projection);
      }
      if (lean) {
        query = query.lean();
      }

      const document = await query.exec();
      return document;
    } catch (error) {
      logger.error(`Failed to find ${this.modelName} by ID`, {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Find one document matching criteria
   * @param {object} filter - Query filter
   * @param {object} options - Query options
   * @returns {Promise<object|null>} Found document or null
   */
  async findOne(filter = {}, options = {}) {
    try {
      const { projection = null, lean = true, sort = null } = options;
      let query = this.model.findOne(filter);

      if (projection) {
        query = query.select(projection);
      }
      if (sort) {
        query = query.sort(sort);
      }
      if (lean) {
        query = query.lean();
      }

      const document = await query.exec();
      return document;
    } catch (error) {
      logger.error(`Failed to find ${this.modelName}`, {
        error: error.message,
        filter,
      });
      throw error;
    }
  }

  /**
   * Find multiple documents matching criteria
   * @param {object} filter - Query filter
   * @param {object} options - Query options (projection, sort, skip, limit, lean)
   * @returns {Promise<array>} Array of documents
   */
  async find(filter = {}, options = {}) {
    try {
      const { projection = null, sort = null, skip = 0, limit = null, lean = true } = options;
      let query = this.model.find(filter);

      if (projection) {
        query = query.select(projection);
      }
      if (sort) {
        query = query.sort(sort);
      }
      if (skip > 0) {
        query = query.skip(skip);
      }
      if (limit) {
        query = query.limit(limit);
      }
      if (lean) {
        query = query.lean();
      }

      const documents = await query.exec();
      return documents;
    } catch (error) {
      logger.error(`Failed to find ${this.modelName}`, {
        error: error.message,
        filter,
      });
      throw error;
    }
  }

  /**
   * Find and count documents
   * @param {object} filter - Query filter
   * @param {object} options - Query options
   * @returns {Promise<{documents: array, count: number}>} Documents and total count
   */
  async findAndCount(filter = {}, options = {}) {
    try {
      const { projection = null, sort = null, skip = 0, limit = null, lean = true } = options;
      let query = this.model.find(filter);

      if (projection) {
        query = query.select(projection);
      }
      if (sort) {
        query = query.sort(sort);
      }

      const count = await this.model.countDocuments(filter);
      const documents = await query.skip(skip).limit(limit || 0).lean(lean).exec();

      return { documents, count };
    } catch (error) {
      logger.error(`Failed to find and count ${this.modelName}`, {
        error: error.message,
        filter,
      });
      throw error;
    }
  }

  /**
   * Update a document by ID
   * @param {string} id - Document ID
   * @param {object} update - Update data
   * @param {object} options - Additional options
   * @returns {Promise<object>} Updated document
   */
  async updateById(id, update, options = {}) {
    try {
      const { new: returnNew = true, lean = true } = options;
      const document = await this.model.findByIdAndUpdate(id, update, {
        new: returnNew,
        lean: returnNew ? lean : false,
      });

      logger.debug(`${this.modelName} updated`, { id });
      return document;
    } catch (error) {
      logger.error(`Failed to update ${this.modelName}`, {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Update multiple documents
   * @param {object} filter - Query filter
   * @param {object} update - Update data
   * @param {object} options - Additional options
   * @returns {Promise<object>} Update result
   */
  async updateMany(filter = {}, update = {}, options = {}) {
    try {
      const result = await this.model.updateMany(filter, update, options);
      logger.debug(`${this.modelName} documents updated`, {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      });
      return result;
    } catch (error) {
      logger.error(`Failed to update ${this.modelName}`, {
        error: error.message,
        filter,
      });
      throw error;
    }
  }

  /**
   * Delete document by ID (hard delete)
   * @param {string} id - Document ID
   * @returns {Promise<object>} Deleted document
   */
  async deleteById(id) {
    try {
      const document = await this.model.findByIdAndDelete(id);
      logger.debug(`${this.modelName} deleted`, { id });
      return document;
    } catch (error) {
      logger.error(`Failed to delete ${this.modelName}`, {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Delete multiple documents
   * @param {object} filter - Query filter
   * @returns {Promise<object>} Delete result
   */
  async deleteMany(filter = {}) {
    try {
      const result = await this.model.deleteMany(filter);
      logger.debug(`${this.modelName} documents deleted`, {
        deletedCount: result.deletedCount,
      });
      return result;
    } catch (error) {
      logger.error(`Failed to delete ${this.modelName}`, {
        error: error.message,
        filter,
      });
      throw error;
    }
  }

  /**
   * Count documents matching filter
   * @param {object} filter - Query filter
   * @returns {Promise<number>} Count of documents
   */
  async count(filter = {}) {
    try {
      const count = await this.model.countDocuments(filter);
      return count;
    } catch (error) {
      logger.error(`Failed to count ${this.modelName}`, {
        error: error.message,
        filter,
      });
      throw error;
    }
  }

  /**
   * Check if document exists matching filter
   * @param {object} filter - Query filter
   * @returns {Promise<boolean>} True if exists
   */
  async exists(filter = {}) {
    try {
      const exists = await this.model.exists(filter);
      return !!exists;
    } catch (error) {
      logger.error(`Failed to check ${this.modelName} existence`, {
        error: error.message,
        filter,
      });
      throw error;
    }
  }

  /**
   * Aggregate documents
   * @param {array} pipeline - MongoDB aggregation pipeline
   * @returns {Promise<array>} Aggregation result
   */
  async aggregate(pipeline = []) {
    try {
      const result = await this.model.aggregate(pipeline);
      return result;
    } catch (error) {
      logger.error(`Failed to aggregate ${this.modelName}`, {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Bulk write operations
   * @param {array} operations - Array of write operations
   * @returns {Promise<object>} Bulk write result
   */
  async bulkWrite(operations = []) {
    try {
      const result = await this.model.collection.bulkWrite(operations);
      logger.debug(`${this.modelName} bulk write completed`, {
        insertedCount: result.insertedCount,
        modifiedCount: result.modifiedCount,
        deletedCount: result.deletedCount,
      });
      return result;
    } catch (error) {
      logger.error(`Failed to bulk write ${this.modelName}`, {
        error: error.message,
      });
      throw error;
    }
  }
}

export default BaseRepository;
