/**
 * Query utility module - Shared helpers for parsing and transforming query data
 */

import mongoose from 'mongoose';

/**
 * Safely convert a value to a finite number, or null if not finite.
 * Treats undefined, null, and empty string as null.
 * @param {*} value
 * @returns {number|null}
 */
export const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Check if a value is a valid MongoDB ObjectId.
 * @param {*} value
 * @returns {boolean}
 */
export const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

/**
 * Extract { lat, lng } from a coordinates object.
 * Accepts both { lat, lng } and { latitude, longitude } shapes.
 * @param {Object|null|undefined} coordinates
 * @returns {{ lat: number, lng: number }|null}
 */
export const toLocation = (coordinates) => {
  const lat = toNumber(coordinates?.lat ?? coordinates?.latitude);
  const lng = toNumber(coordinates?.lng ?? coordinates?.longitude);
  if (lat === null || lng === null) return null;
  return { lat, lng };
};

/**
 * Parse a boolean query string value. Returns true/false for recognized
 * values, the defaultValue for missing, and null for unrecognized values.
 * @param {*} value
 * @param {boolean} [defaultValue=null]
 * @returns {boolean|null}
 */
export const parseBooleanQuery = (value, defaultValue = null) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return null;
};

/**
 * Convert a Mongoose document (or plain object) to a plain JS object.
 * Handles null, undefined, Maps, and already-plain objects.
 * @param {*} value
 * @returns {Object}
 */
export const toPlainObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === 'function') return value.toObject();
  if (typeof value === 'object') return { ...value };
  return {};
};
