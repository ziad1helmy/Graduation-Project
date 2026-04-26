import response from '../utils/response.js';
import Hospital from '../models/Hospital.model.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';

const toRad = (deg) => (deg * Math.PI) / 180;

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const mapHospital = (h) => ({
  hospitalId: h._id,
  hospital_id: h._id,
  name: h.hospitalName || h.fullName,
  fullName: h.fullName,
  contactNumber: h.contactNumber || null,
  email: h.email,
  address: h.address || null,
  location: h.location || null,
});

export const listHospitals = async (req, res, next) => {
  try {
    const { city, governorate, search } = req.query;
    const { skip, limit, page } = parsePagination(req.query, 20);

    const query = { role: 'hospital', deletedAt: null, isSuspended: false, isEmailVerified: true };
    if (city) query['address.city'] = city;
    if (governorate) query['address.governorate'] = governorate;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { hospitalName: { $regex: search, $options: 'i' } },
      ];
    }

    const [hospitals, total] = await Promise.all([
      Hospital.find(query).sort({ hospitalName: 1, fullName: 1 }).skip(skip).limit(limit),
      Hospital.countDocuments(query),
    ]);

    return response.success(res, 200, 'Hospitals retrieved successfully', {
      hospitals: hospitals.map(mapHospital),
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

export const getHospitalById = async (req, res, next) => {
  try {
    const hospital = await Hospital.findOne({
      _id: req.params.id,
      role: 'hospital',
      deletedAt: null,
      isSuspended: false,
      isEmailVerified: true,
    });

    if (!hospital) {
      return response.error(res, 404, 'Hospital not found');
    }

    return response.success(res, 200, 'Hospital retrieved successfully', {
      hospital: mapHospital(hospital),
    });
  } catch (error) {
    next(error);
  }
};

export const getNearbyHospitals = async (req, res, next) => {
  try {
    const lat = Number(req.query.latitude);
    const lng = Number(req.query.longitude);
    const radiusKm = req.query.radius_km ? Number(req.query.radius_km) : null;

    const query = { role: 'hospital', deletedAt: null, isSuspended: false, isEmailVerified: true };
    const hospitals = await Hospital.find(query).limit(500);

    let mapped = hospitals.map((h) => {
      const entry = mapHospital(h);
      const hLat = h.location?.coordinates?.lat;
      const hLng = h.location?.coordinates?.lng;
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(hLat) && Number.isFinite(hLng)) {
        entry.distanceKm = Number(haversineKm(lat, lng, hLat, hLng).toFixed(2));
      }
      return entry;
    });

    if (Number.isFinite(radiusKm)) {
      mapped = mapped.filter((h) => h.distanceKm !== undefined && h.distanceKm <= radiusKm);
    }

    mapped.sort((a, b) => {
      if (a.distanceKm === undefined && b.distanceKm === undefined) return 0;
      if (a.distanceKm === undefined) return 1;
      if (b.distanceKm === undefined) return -1;
      return a.distanceKm - b.distanceKm;
    });

    return response.success(res, 200, 'Nearby hospitals retrieved successfully', {
      hospitals: mapped,
      total: mapped.length,
    });
  } catch (error) {
    next(error);
  }
};
