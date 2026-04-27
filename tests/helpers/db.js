/**
 * Test DB helpers — connect, disconnect, and clean collections between tests.
 */

import mongoose from 'mongoose';

/**
 * Connect to the in-memory MongoDB set up by the global setup file.
 */
export async function connectTestDB() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (mongoose.connection.readyState !== 0) {
    return; // already connected
  }
  await mongoose.connect(uri);
}

/**
 * Drop all collections in the current database.
 * Use in afterEach or beforeEach to isolate tests.
 */
export async function clearTestDB() {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

/**
 * Disconnect and close the connection.
 */
export async function disconnectTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
