/**
 * Geo utility module - Location-based calculations for donor matching
 */

/**
 * Parse latitude/longitude from a query object. Accepts any combination of
 * `lat`/`latitude` for latitude and `lng`/`long`/`longitude` for longitude.
 * @param {Object} query - Express req.query or any object with string/number values
 * @returns {{ lat: number|null, lng: number|null, hasCoordinates: boolean }}
 */
export const parseLatLng = (query = {}) => {
  const lat = Number(query.lat ?? query.latitude);
  const lng = Number(query.lng ?? query.long ?? query.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: null, lng: null, hasCoordinates: false };
  }
  return { lat, lng, hasCoordinates: true };
};

/**
 * Safely convert a value to a finite number, or null if not finite.
 * @param {*} value
 * @returns {number|null}
 */
const toFiniteNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Extract latitude/longitude from any of the supported object shapes.
 * Handles request documents, donor documents, hospital documents, and
 * flat coordinate objects. Pass `type` to skip the wrong field paths.
 * @param {Object|null|undefined} obj - The object to read coordinates from
 * @param {'request'|'donor'|'hospital'|'auto'} [type='auto'] - Hint for which paths to try
 * @returns {{ latitude: number, longitude: number }|null}
 */
export const extractLocation = (obj, type = 'auto') => {
  if (!obj || typeof obj !== 'object') return null;

  const candidates = [];

  if (type === 'auto' || type === 'request') {
    candidates.push(
      // Request: hospitalLocationGeo.coordinates[1], [0]
      [obj.hospitalLocationGeo?.coordinates?.[1], obj.hospitalLocationGeo?.coordinates?.[0]],
    );
  }

  if (type === 'auto' || type === 'request' || type === 'hospital') {
    candidates.push(
      // Hospital via request.hospitalId
      [obj.hospitalId?.location?.coordinates?.lat ?? obj.hospitalId?.lat, obj.hospitalId?.location?.coordinates?.lng ?? obj.hospitalId?.long],
    );
  }

  if (type === 'auto' || type === 'donor' || type === 'hospital') {
    candidates.push(
      // Donor: location.coordinates.{lat,lng}
      [obj.location?.coordinates?.lat, obj.location?.coordinates?.lng],
      // Donor: location.{latitude,longitude}
      [obj.location?.latitude, obj.location?.longitude],
      // Donor: location.{lat,lng}
      [obj.location?.lat, obj.location?.lng],
      // Flat: {lat, long} or {lat, lng}
      [obj.lat, obj.lng ?? obj.long],
      // Flat: {latitude, longitude}
      [obj.latitude, obj.longitude],
      // Flat: coordinates: {lat, lng}
      [obj.coordinates?.lat, obj.coordinates?.lng],
    );
  }

  for (const [lat, lng] of candidates) {
    const latitude = toFiniteNumber(lat);
    const longitude = toFiniteNumber(lng);
    if (latitude !== null && longitude !== null) {
      return { latitude, longitude };
    }
  }

  return null;
};

/**
 * Extract a geo point from any supported shape: object with lat/lng fields,
 * nested location objects, or GeoJSON-style arrays [lng, lat].
 * Returns { latitude, longitude } or null.
 * @param {Object|Array|null|undefined} location
 * @returns {{ latitude: number, longitude: number }|null}
 */
export const extractGeoPoint = (location = null) => {
  if (!location) return null;

  if (Array.isArray(location) && location.length >= 2) {
    const latitude = toFiniteNumber(location[1]);
    const longitude = toFiniteNumber(location[0]);
    if (latitude !== null && longitude !== null) return { latitude, longitude };
  }

  if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    const latitude = toFiniteNumber(location.coordinates[1]);
    const longitude = toFiniteNumber(location.coordinates[0]);
    if (latitude !== null && longitude !== null) return { latitude, longitude };
  }

  return extractLocation(location, 'auto');
};

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
    
    if (!donorHasLocation) return false;
    
    const distance = calculateDistance(location, donor.location);
    return distance <= radius;
  });
};

/**
 * Sort donors by proximity to a location
 * Supports both formats: {lat, long} and {latitude, longitude}
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

    if (donorHasLocation) {
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
