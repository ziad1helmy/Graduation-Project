import { env } from '../config/env.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from './logger.js';

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
const buildPlatformNotification = (data = {}, options = {}) => {
  const androidNotification = {};

  if (options.channelId) androidNotification.channelId = options.channelId;
  if (options.clickAction) androidNotification.clickAction = options.clickAction;
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

  const payload = {};
  if (Object.keys(androidNotification).length > 0) {
    payload.android = { notification: androidNotification };
  }
  if (Object.keys(apnsPayload).length > 0) {
    payload.apns = { payload: { aps: apnsPayload } };
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
 * Send push notification to multiple devices.
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
    const message = {
      notification: { title, body },
      ...buildPlatformNotification(data, options),
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      tokens: uniqueTokens,
    };

    const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
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
