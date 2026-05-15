#!/usr/bin/env node
/**
 * FCM Diagnostic Script
 * Checks: Firebase init, DB tokens, test send
 * 
 * Usage: node scripts/diagnose-fcm.mjs
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/lifelink';

console.log('\n══════════════════════════════════════════════');
console.log('  LifeLink FCM Diagnostic');
console.log('══════════════════════════════════════════════\n');

// ─── Step 1: Check Firebase env/config ───────────────────────────
console.log('── Step 1: Firebase Configuration ──\n');

const envProjectId = process.env.FIREBASE_PROJECT_ID;
const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

console.log(`  FIREBASE_PROJECT_ID:            ${envProjectId || '❌ NOT SET'}`);
console.log(`  FIREBASE_CLIENT_EMAIL:          ${envClientEmail || '❌ NOT SET'}`);
console.log(`  FIREBASE_PRIVATE_KEY:           ${envPrivateKey ? (envPrivateKey.startsWith('-----BEGIN') ? '✅ Valid PEM key' : `⚠️  Set but NOT a PEM key (${envPrivateKey.length} chars)`) : '❌ NOT SET'}`);
console.log(`  FIREBASE_SERVICE_ACCOUNT_PATH:  ${serviceAccountPath || '❌ NOT SET'}`);

let saProjectId, saClientEmail, saPrivateKey;
if (serviceAccountPath) {
  try {
    const fullPath = resolve(process.cwd(), serviceAccountPath);
    const parsed = JSON.parse(readFileSync(fullPath, 'utf8'));
    saProjectId = parsed.project_id;
    saClientEmail = parsed.client_email;
    saPrivateKey = parsed.private_key;
    console.log(`\n  Service Account File: ✅ Found at ${fullPath}`);
    console.log(`    project_id:    ${saProjectId || '❌ MISSING'}`);
    console.log(`    client_email:  ${saClientEmail || '❌ MISSING'}`);
    console.log(`    private_key:   ${saPrivateKey ? '✅ Present (' + saPrivateKey.length + ' chars)' : '❌ MISSING'}`);
  } catch (err) {
    console.log(`\n  Service Account File: ❌ FAILED to load — ${err.message}`);
  }
}

// Final resolved credentials (same logic as fcm.js)
const finalProjectId = saProjectId || envProjectId;
const finalClientEmail = saClientEmail || envClientEmail;
const finalPrivateKey = saPrivateKey || (envPrivateKey ? envPrivateKey.replace(/\\n/g, '\n') : undefined);

const canInitFirebase = !!(finalProjectId && finalClientEmail && finalPrivateKey);
console.log(`\n  ➤ Can initialize Firebase Admin: ${canInitFirebase ? '✅ YES' : '❌ NO — push notifications WILL NOT WORK'}`);

// ─── Step 2: Try to initialize Firebase Admin ────────────────────
console.log('\n── Step 2: Firebase Admin Initialization ──\n');

let firebaseAdmin = null;
if (canInitFirebase) {
  try {
    const admin = await import('firebase-admin');
    if (!admin.default.apps.length) {
      admin.default.initializeApp({
        credential: admin.default.credential.cert({
          projectId: finalProjectId,
          clientEmail: finalClientEmail,
          privateKey: finalPrivateKey,
        }),
      });
    }
    firebaseAdmin = admin.default;
    console.log('  ✅ Firebase Admin SDK initialized successfully');
  } catch (err) {
    console.log(`  ❌ Firebase Admin SDK failed to initialize: ${err.message}`);
  }
} else {
  console.log('  ⏭️  Skipping — credentials not available');
}

// ─── Step 3: Check database for FCM tokens ───────────────────────
console.log('\n── Step 3: Database — FCM Token Audit ──\n');

try {
  await mongoose.connect(MONGO_URI);
  console.log(`  ✅ Connected to MongoDB`);

  const userCollection = mongoose.connection.collection('users');

  // Count users with/without tokens
  const totalUsers = await userCollection.countDocuments({ deletedAt: null });
  const usersWithTokens = await userCollection.countDocuments({
    deletedAt: null,
    fcmTokens: { $exists: true, $not: { $size: 0 } },
  });
  const donorsWithTokens = await userCollection.countDocuments({
    deletedAt: null,
    role: 'donor',
    fcmTokens: { $exists: true, $not: { $size: 0 } },
  });
  const totalDonors = await userCollection.countDocuments({
    deletedAt: null,
    role: 'donor',
  });

  console.log(`  Total users:                    ${totalUsers}`);
  console.log(`  Users with FCM tokens:          ${usersWithTokens}`);
  console.log(`  Donors total:                   ${totalDonors}`);
  console.log(`  Donors with FCM tokens:         ${donorsWithTokens}`);
  console.log(`  Donors WITHOUT tokens:          ${totalDonors - donorsWithTokens}`);

  if (usersWithTokens === 0) {
    console.log('\n  ⚠️  NO USERS HAVE FCM TOKENS IN THE DATABASE!');
    console.log('  ➤ This means the Flutter app is NOT calling POST /auth/fcm-token');
    console.log('  ➤ Or the call is failing silently on the Flutter side');
  }

  // Show sample tokens
  const sampleUsers = await userCollection
    .find({ fcmTokens: { $exists: true, $not: { $size: 0 } } })
    .project({ fullName: 1, email: 1, role: 1, fcmTokens: 1 })
    .limit(5)
    .toArray();

  if (sampleUsers.length > 0) {
    console.log('\n  Sample users with tokens:');
    for (const u of sampleUsers) {
      const tokens = u.fcmTokens || [];
      console.log(`    • ${u.fullName} (${u.role}) — ${tokens.length} token(s)`);
      for (const t of tokens) {
        console.log(`      token: ${t.substring(0, 30)}...${t.substring(t.length - 10)}`);
      }
    }
  }

  // ─── Step 4: Test send (if possible) ─────────────────────────────
  if (firebaseAdmin && sampleUsers.length > 0) {
    console.log('\n── Step 4: Test FCM Send ──\n');
    const testToken = sampleUsers[0].fcmTokens[0];
    console.log(`  Sending test notification to: ${sampleUsers[0].fullName}`);
    console.log(`  Token: ${testToken.substring(0, 30)}...`);
    
    try {
      const result = await firebaseAdmin.messaging().send({
        token: testToken,
        notification: {
          title: '🔬 LifeLink FCM Test',
          body: 'If you see this, push notifications are working!',
        },
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
      });
      console.log(`  ✅ FCM send SUCCESS — message ID: ${result}`);
    } catch (err) {
      console.log(`  ❌ FCM send FAILED: ${err.code || err.message}`);
      if (err.code === 'messaging/registration-token-not-registered') {
        console.log('  ➤ This token is EXPIRED/INVALID — the device needs to re-register');
      }
      if (err.code === 'messaging/invalid-argument') {
        console.log('  ➤ The token format is invalid — check Flutter FCM setup');
      }
    }
  } else if (!firebaseAdmin) {
    console.log('\n── Step 4: Test FCM Send — SKIPPED (Firebase not initialized) ──');
  } else {
    console.log('\n── Step 4: Test FCM Send — SKIPPED (no tokens in DB) ──');
  }

} catch (err) {
  console.log(`  ❌ MongoDB connection failed: ${err.message}`);
} finally {
  await mongoose.disconnect();
}

console.log('\n══════════════════════════════════════════════');
console.log('  Diagnostic complete');
console.log('══════════════════════════════════════════════\n');
