import mongoose from 'mongoose';
import response from '../utils/response.js';
import Hospital from '../models/Hospital.model.js';
import HospitalSettings from '../models/HospitalSettings.model.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import Request from '../models/Request.model.js';
import { calculateDistance, parseLatLng } from '../utils/geo.js';
import { formatDistance } from '../utils/format.js';
import { isValidObjectId } from '../utils/query.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const mapHospital = (h, extras = {}) => ({
  hospitalId: h._id,
  hospital_id: h._id,
  name: h.hospitalName || h.fullName,
  fullName: h.fullName,
  contactNumber: h.contactNumber || h.phone || null,
  email: h.email,
  address: h.address || null,
  location: Number.isFinite(h.lat) && Number.isFinite(h.long)
    ? { lat: h.lat, lng: h.long }
    : null,
  lat: h.lat ?? null,
  lng: h.long ?? null,
  long: h.long ?? null,
  hospitalType: h.hospitalType || h.type || 'General Hospital',
  workingHours: h.workingHours || '9AM - 5PM',
  bloodTypes: h.bloodBanksAvailable || [],
  isAvailable: (h.bloodBanksAvailable || []).length > 0,
  urgentNeedsCount: extras.urgentNeedsCount ?? 0,
  appointmentSchedulingEnabled: extras.appointmentSchedulingEnabled ?? true,
  hospitalActive: extras.hospitalActive ?? true,
  hospitalVerified: extras.hospitalVerified ?? h.isEmailVerified ?? false,
  ...extras,
});

export const listHospitals = asyncHandler(async (req, res) => {
  const { city, governorate, search } = req.query;
  const { offset, limit, page } = parsePagination(req.query, 20);

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
    Hospital.find(query).sort({ hospitalName: 1, fullName: 1 }).skip(offset).limit(limit),
    Hospital.countDocuments(query),
  ]);

  // Fetch HospitalSettings for each hospital to include scheduling status
  const hospitalIds = hospitals.map(h => h._id);
  const settingsMap = new Map();
  if (hospitalIds.length > 0) {
    const settings = await HospitalSettings.find({ hospitalId: { $in: hospitalIds } });
    settings.forEach(s => settingsMap.set(s.hospitalId.toString(), s));
  }

  return response.success(res, 200, 'Hospitals retrieved successfully', {
    hospitals: hospitals.map(h => {
      const settings = settingsMap.get(h._id.toString());
      return mapHospital(h, {
        appointmentSchedulingEnabled: settings?.appointmentSettings?.isActive ?? true,
        hospitalActive: !h.isSuspended,
        hospitalVerified: h.isEmailVerified,
      });
    }),
    pagination: paginationMeta(total, page, limit),
  });
});

export const getHospitalById = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid hospital ID');
  }

  const hospital = await Hospital.findOne({
    _id: req.params.id,
    role: 'hospital',
    deletedAt: null,
    isSuspended: false,
    isEmailVerified: true,
  });

  if (!hospital) {
    throw new HttpError(404, 'Hospital not found');
  }

  // Fetch HospitalSettings for this hospital
  const settings = await HospitalSettings.findOne({ hospitalId: hospital._id });

  // If client provided a lat/long, compute distance to this hospital
  const { lat, lng, hasCoordinates } = parseLatLng(req.query);
  const result = mapHospital(hospital, {
    appointmentSchedulingEnabled: settings?.appointmentSettings?.isActive ?? true,
    hospitalActive: !hospital.isSuspended,
    hospitalVerified: hospital.isEmailVerified,
  });
  const hLat = hospital.lat ?? hospital.location?.coordinates?.lat;
  const hLng = hospital.long ?? hospital.location?.coordinates?.lng;
  if (hasCoordinates && Number.isFinite(hLat) && Number.isFinite(hLng)) {
    const distanceKm = calculateDistance({ lat, long: lng }, { lat: hLat, long: hLng });
    result.distanceKm = Number(distanceKm.toFixed(2));
    result.distanceMeters = Math.round(distanceKm * 1000);
    result.distance = formatDistance(distanceKm);
  }

  return response.success(res, 200, 'Hospital retrieved successfully', {
    hospital: result,
  });
});

export const getNearbyHospitals = asyncHandler(async (req, res) => {
  const { search, bloodType } = req.query;
  const { lat, lng, hasCoordinates } = parseLatLng(req.query);
  const radiusKm = req.query.radius_km ? Number(req.query.radius_km) : null;

  if (radiusKm !== null && (!Number.isFinite(radiusKm) || radiusKm <= 0)) {
    throw new HttpError(400, 'radius_km must be a positive number');
  }

  if (bloodType && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodType)) {
    throw new HttpError(400, 'Invalid blood type. Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-');
  }

  const query = { role: 'hospital', deletedAt: null, isSuspended: false, isEmailVerified: true };
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { hospitalName: { $regex: search, $options: 'i' } },
    ];
  }
  if (bloodType) query.bloodBanksAvailable = bloodType;

  const hospitals = await Hospital.find(query);

  const urgentCounts = await Request.aggregate([
    { $match: { status: { $in: ['pending', 'in-progress'] }, urgency: { $in: ['high', 'critical'] } } },
    { $group: { _id: '$hospitalId', count: { $sum: 1 } } },
  ]);
  const urgentMap = Object.fromEntries(urgentCounts.map(u => [u._id.toString(), u.count]));

  // Fetch HospitalSettings for all hospitals
  const hospitalIds = hospitals.map(h => h._id);
  const settingsMap = new Map();
  if (hospitalIds.length > 0) {
    const settings = await HospitalSettings.find({ hospitalId: { $in: hospitalIds } });
    settings.forEach(s => settingsMap.set(s.hospitalId.toString(), s));
  }

  let mapped = hospitals.map((h) => {
    const settings = settingsMap.get(h._id.toString());
    const entry = mapHospital(h, {
      appointmentSchedulingEnabled: settings?.appointmentSettings?.isActive ?? true,
      hospitalActive: !h.isSuspended,
      hospitalVerified: h.isEmailVerified,
    });
    // Support both new format (lat/long) and old format (location.coordinates)
    const hLat = h.lat ?? h.location?.coordinates?.lat;
    const hLng = h.long ?? h.location?.coordinates?.lng;
    if (hasCoordinates && Number.isFinite(hLat) && Number.isFinite(hLng)) {
      const distanceKm = calculateDistance({ lat, long: lng }, { lat: hLat, long: hLng });
      entry.distanceKm = Number(distanceKm.toFixed(2));
      entry.distanceMeters = Math.round(distanceKm * 1000);
      entry.distance = formatDistance(distanceKm);
    }
    entry.urgentNeedsCount = urgentMap[h._id.toString()] || 0;
    return entry;
  });

  // Only apply radius filter when the caller supplied coordinates; otherwise
  // every entry lacks distanceKm and the filter would drop the whole result.
  if (Number.isFinite(radiusKm) && hasCoordinates) {
    mapped = mapped.filter((h) => h.distanceKm !== undefined && h.distanceKm <= radiusKm);
  }

  mapped.sort((a, b) => {
    if (a.distanceKm === undefined && b.distanceKm === undefined) return 0;
    if (a.distanceKm === undefined) return 1;
    if (b.distanceKm === undefined) return -1;
    return a.distanceKm - b.distanceKm;
  });

  const { offset, limit, page } = parsePagination(req.query, 20);
  const paginated = mapped.slice(offset, offset + limit);

  return response.success(res, 200, 'Nearby hospitals retrieved successfully', {
    hospitals: paginated,
    pagination: paginationMeta(mapped.length, page, limit),
  });
});

export const searchHospitals = asyncHandler(async (req, res) => {
  const { lat, lng, hasCoordinates } = parseLatLng(req.query);
  const { q = '', bloodType, availableOnly } = req.query;

  if (bloodType && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodType)) {
    throw new HttpError(400, 'Invalid blood type. Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-');
  }

  const query = { role: 'hospital', deletedAt: null, isSuspended: false, isEmailVerified: true };
  if (q) {
    query.$or = [
      { fullName: { $regex: q, $options: 'i' } },
      { hospitalName: { $regex: q, $options: 'i' } },
    ];
  }
  if (bloodType) {
    query.bloodBanksAvailable = bloodType;
  }

  const hospitals = await Hospital.find(query).sort({ hospitalName: 1, fullName: 1 }).limit(100);

  // Fetch HospitalSettings for all hospitals
  const hospitalIds = hospitals.map(h => h._id);
  const settingsMap = new Map();
  if (hospitalIds.length > 0) {
    const settings = await HospitalSettings.find({ hospitalId: { $in: hospitalIds } });
    settings.forEach(s => settingsMap.set(s.hospitalId.toString(), s));
  }

  let results = hospitals.map((hospital) => {
    const settings = settingsMap.get(hospital._id.toString());
    return mapHospital(hospital, {
      appointmentSchedulingEnabled: settings?.appointmentSettings?.isActive ?? true,
      hospitalActive: !hospital.isSuspended,
      hospitalVerified: hospital.isEmailVerified,
    });
  });

  if (hasCoordinates) {
    results = results.map((hospital) => {
      if (Number.isFinite(hospital.lat) && Number.isFinite(hospital.long)) {
        const distanceKm = calculateDistance({ lat, long: lng }, { lat: hospital.lat, long: hospital.long });
        return {
          ...hospital,
          distanceKm: Number(distanceKm.toFixed(2)),
          distanceMeters: Math.round(distanceKm * 1000),
          distance: formatDistance(distanceKm),
        };
      }
      return hospital;
    });
    // sort by distance when provided
    results.sort((a, b) => {
      if (a.distanceKm === undefined && b.distanceKm === undefined) return 0;
      if (a.distanceKm === undefined) return 1;
      if (b.distanceKm === undefined) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }

  if (availableOnly === 'true' || availableOnly === '1') {
    results = results.filter((hospital) => hospital.isAvailable);
  }

  return response.success(res, 200, 'Hospitals searched successfully', { hospitals: results });
});

export const getHospitalsForMap = asyncHandler(async (req, res) => {
  const hospitals = await Hospital.find({
    role: 'hospital',
    deletedAt: null,
    isSuspended: false,
    isEmailVerified: true,
  }).select('hospitalName fullName lat long');

  return response.success(res, 200, 'Hospitals retrieved successfully for map', {
    hospitals: hospitals.map((h) => ({
      id: h._id,
      name: h.hospitalName || h.fullName,
      lat: h.lat ?? null,
      long: h.long ?? null,
    })),
  });
});
