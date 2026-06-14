/**
 * Format utility module - Shared formatting helpers
 */

/**
 * Format a distance in kilometers for display.
 * Returns null for non-finite values, meters for < 1 km, otherwise km with 2 decimals.
 * @param {number} distanceKm
 * @returns {string|null}
 */
export const formatDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(2)} km`;
};

/**
 * Format an estimated travel time for a given distance.
 * @param {number} distanceKm
 * @param {number} [averageSpeedKmh=40]
 * @returns {string|null}
 */
export const formatEstimatedTime = (distanceKm, averageSpeedKmh = 40) => {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  const totalMinutes = Math.max(1, Math.round((distanceKm / averageSpeedKmh) * 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

/**
 * Format a value as a date-only ISO string (YYYY-MM-DD).
 * Returns null for falsy/invalid values.
 * @param {Date|string|number|null|undefined} value
 * @returns {string|null}
 */
export const formatDateOnly = (value) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
};

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

/**
 * Recursively converts any `dateOfBirth` field in a response payload to YYYY-MM-DD.
 * Keeps other timestamp fields such as createdAt/updatedAt untouched.
 * @param {unknown} value
 * @returns {unknown}
 */
export const serializeDateOfBirth = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => serializeDateOfBirth(item));
  }

  if (!value || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  const source = typeof value.toObject === 'function' ? value.toObject() : value;
  if (!isPlainObject(source)) {
    return source;
  }

  return Object.fromEntries(
    Object.entries(source).map(([key, item]) => ([
      key,
      key === 'dateOfBirth' ? formatDateOnly(item) : serializeDateOfBirth(item),
    ])),
  );
};
