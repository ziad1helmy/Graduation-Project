import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

async function connectDB() {
  try {
    // Prevent Mongoose from attempting to build indexes on startup.
    // This avoids duplicate-index warnings in development where models
    // may be loaded multiple times or indexes are created elsewhere.
    mongoose.set('autoIndex', false);

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      autoIndex: false,
    };

    await mongoose.connect(env.MONGO_URI, options);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', {
        message: err.message,
      });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected', {});
    });

    if (env.NODE_ENV !== 'test') {
      logger.info('MongoDB connected', {
        database: mongoose.connection.name,
      });
    }
  } catch (err) {
    logger.error('MongoDB connection failed', {
      message: err.message,
    });
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
    logger.warn('Continuing without database (development mode)', {});
  }
}

async function disconnectDB() {
  try {
    await mongoose.connection.close();
    if (env.NODE_ENV !== 'test') {
      logger.info('MongoDB connection closed', {});
    }
  } catch (err) {
    logger.error('Error closing MongoDB connection', {
      message: err.message,
    });
  }
}

export { connectDB, disconnectDB };
