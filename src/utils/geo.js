/**
 * Geo utility module - Location-based calculations for donor matching
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * Supports both formats: {lat, long} and {latitude, longitude}
 * @param {Object} loc1 - {lat, long} or {latitude, longitude}
 * @param {Object} loc2 - {lat, long} or {latitude, longitude}
 * @returns {number} - Distance in kilometers
 */
export const calculateDistance = (loc1, loc2) => {
  const R = 6371; // Earth's radius in kilometers
  const lat1 = loc1.lat ?? loc1.latitude;
  const lng1 = loc1.long ?? loc1.longitude;
  const lat2 = loc2.lat ?? loc2.latitude;
  const lng2 = loc2.long ?? loc2.longitude;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} - radians
 */
const toRad = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Find donors within a certain radius from a location
 * Supports both formats: {lat, long} and {latitude, longitude}
 * @param {Array} donors - Array of donor documents
 * @param {Object} location - {lat, long} or {latitude, longitude}
 * @param {number} radius - Radius in kilometers
 * @returns {Array} - Filtered donors within radius
 */
export const findNearby = (donors, location, radius = 50) => {
  const hasLocation = location && (
    (location.lat !== undefined && location.long !== undefined) ||
    (location.latitude !== undefined && location.longitude !== undefined)
  );
  
  if (!hasLocation) {
    return donors; // If no location specified, return all donors
  }

  return donors.filter((donor) => {
    const donorHasLocation = donor.location && (
      (donor.location.lat !== undefined && donor.location.long !== undefined) ||
      (donor.location.latitude !== undefined && donor.location.longitude !== undefined)
    );
    
   Supports both formats: {lat, long} and {latitude, longitude}
 * @param {Array} donors - Array of donor documents
 * @param {Object} location - {lat, long} or {latitude, longitude}
 * @returns {Array} - Sorted donors by distance ascending
 */
export const sortByProximity = (donors, location) => {
  const hasLocation = location && (
    (location.lat !== undefined && location.long !== undefined) ||
    (location.latitude !== undefined && location.longitude !== undefined)
  );
  
  if (!hasLocation) {
    return donors;
  }

  const donorsWithDistance = donors.map((donor) => {
    let distance = Infinity;

    const donorHasLocation = donor.location && (
      (donor.location.lat !== undefined && donor.location.long !== undefined) ||
      (donor.location.latitude !== undefined && donor.location.longitude !== undefined)
    );

    if (donorHasLocation
 * @returns {Array} - Sorted donors by distance ascending
 */
export const sortByProximity = (donors, location) => {
  if (!location || !location.latitude || !location.longitude) {
    return donors;
  }

  const donorsWithDistance = donors.map((donor) => {
    let distance = Infinity;

    if (donor.location && donor.location.latitude && donor.location.longitude) {
      distance = calculateDistance(location, donor.location);
    }

    return { ...donor.toObject?.() || donor, distance };
  });

  return donorsWithDistance.sort((a, b) => a.distance - b.distance);
};

/**
 * Calculate compatibility score based on location
 * Closer donors get higher scores
 * @param {number} distance - Distance in kilometers
 * @param {number} maxDistance - Maximum acceptable distance
 * @returns {number} - Score between 0 and 100
 */
export const getLocationScore = (distance, maxDistance = 100) => {
  if (distance > maxDistance) return 0;
  return Math.max(0, 100 - (distance / maxDistance) * 100);
};
