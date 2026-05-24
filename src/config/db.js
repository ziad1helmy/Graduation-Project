import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Returns a human-readable readyState label.
 * 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
function readyStateLabel(state) {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][state] ?? 'unknown';
}

/**
 * Returns a snapshot of the current MongoDB connection health.
 * Safe to call at any point — never throws.
 */
export function getDBHealth() {
  const state = mongoose.connection.readyState;
  return {
    status: readyStateLabel(state),
    ok: state === 1,
    database: state === 1 ? (mongoose.connection.name ?? null) : null,
  };
}

async function connectDB() {
  try {
    // Prevent Mongoose from building indexes on startup.
    // Indexes are managed explicitly via schema.index() and created by
    // a separate migration/seed step to avoid duplicate-index warnings.
    mongoose.set('autoIndex', false);

    const options = {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      autoIndex: false,
    };

    await mongoose.connect(env.MONGO_URI, options);

    // ── Connection event listeners ──────────────────────────────────────────
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { message: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected — Mongoose will attempt to reconnect automatically', {});
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected', { database: mongoose.connection.name });
    });

    mongoose.connection.on('close', () => {
      logger.info('MongoDB connection closed', {});
    });

    if (env.NODE_ENV !== 'test') {
      logger.info('MongoDB connected', {
        database: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
      });
    }
  } catch (err) {
    logger.error('MongoDB connection failed', { message: err.message });

    if (env.NODE_ENV === 'production') {
      // In production a missing DB is fatal — exit so the process manager restarts.
      process.exit(1);
    }

    // In dev/test we continue so the rest of the code can still load.
    logger.warn('Continuing without database (development/test mode)', {});
  }
}

async function disconnectDB() {
  try {
    await mongoose.connection.close();
    if (env.NODE_ENV !== 'test') {
      logger.info('MongoDB connection closed', {});
    }
  } catch (err) {
    logger.error('Error closing MongoDB connection', { message: err.message });
  }
}

export { connectDB, disconnectDB };
