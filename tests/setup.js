/**
 * Global test setup — MongoDB Memory Server with Replica Set.
 *
 * Starts an in-memory MongoDB replica set (required for Mongoose transactions),
 * sets the connection URI in process.env, and tears down after.
 * Each test file connects/disconnects via the helpers in ./helpers/db.js.
 */

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll } from 'vitest';
import { clearTestDB } from './helpers/db.js';

let replSet;

export async function setup() {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  process.env.MONGO_URI = replSet.getUri();
  process.env.MONGODB_URI = replSet.getUri();
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-vitest';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-vitest';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '4'; // fast hashing for tests
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.PORT = '0'; // don't bind to any port
}

afterAll(async () => {
  if (process.env.MONGO_URI && process.env.MONGODB_URI) {
    await clearTestDB();
  }
});

export async function teardown() {
  if (replSet) {
    await replSet.stop();
  }
}
