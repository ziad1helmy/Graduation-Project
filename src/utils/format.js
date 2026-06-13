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
