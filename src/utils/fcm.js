import { env } from '../config/env.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from './logger.js';
import User from '../models/User.model.js';

/**
 * FCM (Firebase Cloud Messaging) utility for push notifications.
 *
 * This module provides a lightweight FCM integration using the HTTP v1 API.
 * The Firebase Admin SDK can be used as an alternative for more complex setups.
 *
 * Setup:
 * 1. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env
 * 2. Or use FIREBASE_SERVICE_ACCOUNT_PATH to load from a JSON file
 *
 * For now, this module logs notifications in development and sends via FCM in production.
 */

let firebaseInitialized = false;
let firebaseAdmin = null;

/**
 * Initialize Firebase Admin SDK (lazy init).
 */
const initFirebase = async () => {
  if (firebaseInitialized) return !!firebaseAdmin;

  try {
    // Dynamic import to avoid requiring firebase-admin when not needed
    const admin = await import('firebase-admin');

    let projectId = env.FIREBASE_PROJECT_ID;
    let clientEmail = env.FIREBASE_CLIENT_EMAIL;
    let privateKey = env.FIREBASE_PRIVATE_KEY;

    if ((!projectId || !clientEmail || !privateKey) && env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      try {
        const serviceAccountPath = resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);
        const parsed = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
        projectId = projectId || parsed.project_id;
        clientEmail = clientEmail || parsed.client_email;
        privateKey = privateKey || parsed.private_key;
      } catch (fileError) {
        logger.warn('Failed to load Firebase service account file', {
          path: env.FIREBASE_SERVICE_ACCOUNT_PATH,
        });
      }
    }

    if (!projectId || !clientEmail || !privateKey) {
      logger.warn('Firebase credentials not configured', {
        message: 'Push notifications disabled',
      });
      firebaseInitialized = true;
      return false;
    }

    if (!admin.default.apps.length) {
      admin.default.initializeApp({
        credential: admin.default.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    firebaseAdmin = admin.default;
    firebaseInitialized = true;
    logger.info('Firebase Admin initialized', {});
    return true;
  } catch (error) {
    logger.warn('Firebase initialization failed', {
      message: error.message,
    });
    firebaseInitialized = true;
    return false;
  }
};

/**
 * Build FCM platform-specific notification options from a generic config.
 */
/**
 * Maximum tokens per FCM multicast call (Firebase limit).
 */
const FCM_MULTICAST_LIMIT = 500;

/**
 * FCM error codes that indicate an invalid/expired token that should be removed.
 */
const INVALID_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Build FCM platform-specific notification options from a generic config.
 */
const buildPlatformNotification = (data = {}, options = {}) => {
  const androidNotification = {};

  if (options.channelId) androidNotification.channelId = options.channelId;
  if (options.clickAction) androidNotification.clickAction = options.clickAction;
  if (options.sound) androidNotification.sound = options.sound;
  if (options.titleLocKey || data.title_loc_key) {
    androidNotification.titleLocKey = options.titleLocKey || data.title_loc_key;
  }
  if (options.bodyLocKey || data.body_loc_key) {
    androidNotification.bodyLocKey = options.bodyLocKey || data.body_loc_key;
  }
  if (options.titleLocArgs) androidNotification.titleLocArgs = options.titleLocArgs;
  if (options.bodyLocArgs) androidNotification.bodyLocArgs = options.bodyLocArgs;

  const apnsPayload = {};
  if (options.apnsCategory) {
    apnsPayload.category = options.apnsCategory;
  }
  if (options.sound) {
    apnsPayload.sound = options.sound;
  }

  const payload = {};

  // Android config: priority + notification
  const androidConfig = {};
  if (options.priority === 'high') androidConfig.priority = 'high';
  if (Object.keys(androidNotification).length > 0) androidConfig.notification = androidNotification;
  if (Object.keys(androidConfig).length > 0) payload.android = androidConfig;

  // APNS config: priority + payload
  if (Object.keys(apnsPayload).length > 0 || options.priority === 'high') {
    payload.apns = {
      ...(options.priority === 'high' ? { headers: { 'apns-priority': '10' } } : {}),
      payload: { aps: apnsPayload },
    };
  }

  return payload;
};

/**
 * Send push notification to a single device.
 * @param {string} fcmToken - Device FCM token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 * @param {Object} options - Optional platform-specific notification settings
 */
export const sendToDevice = async (fcmToken, title, body, data = {}, options = {}) => {
  if (!fcmToken) return null;

  const initialized = await initFirebase();

  if (!initialized || !firebaseAdmin) {
    if (env.NODE_ENV === 'development') {
      logger.debug('Push notification skipped', {
        reason: 'Firebase unavailable',
      });
    }
    return null;
  }

  try {
    const message = {
      token: fcmToken,
      notification: { title, body },
      ...buildPlatformNotification(data, options),
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    };

    const response = await firebaseAdmin.messaging().send(message);
    return response;
  } catch (error) {
    logger.error('FCM send error', {
      message: error.message,
    });
    return null;
  }
};

/**
 * Remove invalid FCM tokens from user records (fire-and-forget).
 * Called automatically after multicast sends detect expired/invalid tokens.
 */
const cleanupInvalidTokens = (invalidTokens) => {
  if (!invalidTokens || invalidTokens.length === 0) return;

  User.updateMany(
    { fcmTokens: { $in: invalidTokens } },
    { $pull: { fcmTokens: { $in: invalidTokens } } }
  ).catch((err) => {
    logger.warn('FCM token cleanup failed', { message: err.message, count: invalidTokens.length });
  });

  logger.info('FCM invalid tokens queued for cleanup', { count: invalidTokens.length });
};

/**
 * Send a single multicast batch (up to 500 tokens) and collect invalid tokens.
 */
const sendMulticastBatch = async (tokens, message) => {
  const batchMessage = { ...message, tokens };
  const response = await firebaseAdmin.messaging().sendEachForMulticast(batchMessage);

  // Collect invalid/expired tokens for cleanup
  const invalidTokens = [];
  if (response.responses) {
    response.responses.forEach((resp, idx) => {
      if (resp.error && INVALID_TOKEN_ERRORS.has(resp.error.code)) {
        invalidTokens.push(tokens[idx]);
      }
    });
  }

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
  };
};

/**
 * Send push notification to multiple devices.
 * Automatically chunks into batches of 500 (FCM limit) and cleans up invalid tokens.
 * @param {string[]} fcmTokens - Array of device FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 * @param {Object} options - Optional platform-specific notification settings
 * @returns {Object} - { successCount, failureCount }
 */
export const sendToMultiple = async (fcmTokens, title, body, data = {}, options = {}) => {
  if (!fcmTokens || fcmTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  // Remove duplicates and empty tokens
  const uniqueTokens = [...new Set(fcmTokens.filter(Boolean))];

  const initialized = await initFirebase();

  if (!initialized || !firebaseAdmin) {
    if (env.NODE_ENV === 'development') {
      logger.debug('Batch push skipped', {
        deviceCount: uniqueTokens.length,
        reason: 'Firebase unavailable',
      });
    }
    return { successCount: 0, failureCount: 0, skipped: true };
  }

  try {
    const baseMessage = {
      notification: { title, body },
      ...buildPlatformNotification(data, options),
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    };

    let totalSuccess = 0;
    let totalFailure = 0;
    const allInvalidTokens = [];

    // Chunk tokens into batches of FCM_MULTICAST_LIMIT (500)
    for (let i = 0; i < uniqueTokens.length; i += FCM_MULTICAST_LIMIT) {
      const batch = uniqueTokens.slice(i, i + FCM_MULTICAST_LIMIT);
      const result = await sendMulticastBatch(batch, baseMessage);
      totalSuccess += result.successCount;
      totalFailure += result.failureCount;
      allInvalidTokens.push(...result.invalidTokens);
    }

    // Fire-and-forget cleanup of invalid tokens
    cleanupInvalidTokens(allInvalidTokens);

    return {
      successCount: totalSuccess,
      failureCount: totalFailure,
    };
  } catch (error) {
    logger.error('FCM batch send error', {
      message: error.message,
      tokenCount: uniqueTokens.length,
    });
    return { successCount: 0, failureCount: uniqueTokens.length };
  }
};

export default { sendToDevice, sendToMultiple };
