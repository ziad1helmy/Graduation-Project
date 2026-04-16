import mongoose from 'mongoose';
import { env } from './env.js';

async function connectDB() {
  try {
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    };

    await mongoose.connect(env.MONGO_URI, options);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    if (env.NODE_ENV !== 'test') {
      console.log(`MongoDB connected: ${mongoose.connection.name}`);
    }
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
    console.warn('Continuing without database (development mode).');
  }
}

async function disconnectDB() {
  try {
    await mongoose.connection.close();
    if (env.NODE_ENV !== 'test') {
      console.log('MongoDB connection closed');
    }
  } catch (err) {
    console.error('Error closing MongoDB connection:', err.message);
  }
}

export { connectDB, disconnectDB };
