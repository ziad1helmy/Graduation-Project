import { calculateDistance } from './geo.js';
import {
  formatBloodTypeLabel,
  normalizeBloodTypeList,
} from './blood-type.js';

export const EMERGENCY_NOTIFICATION_TYPE = 'emergency_request';
export const EMERGENCY_NOTIFICATION_TITLE_KEY = 'emergency_request_title';
export const EMERGENCY_NOTIFICATION_BODY_KEY = 'emergency_request_body';
export const EMERGENCY_NOTIFICATION_ACTIONS = [
  { id: 'accept', labelKey: 'accept', label: 'Accept' },
  // { id: 'decline', labelKey: 'decline', label: 'Decline' }, // REMOVED: Phase 7 decline flow removal
  { id: 'view', labelKey: 'view_details', label: 'View Details' },
];

const toIsoString = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const formatDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(2)} km`;
};

const extractHospitalLocation = (request) => {
  const hospital = request?.hospitalId || {};
  const location = hospital.location || {};

  return {
    city: location.city || hospital.city || null,
    governorate: location.governorate || hospital.address?.governorate || hospital.governorate || null,
    latitude: request?.locationHospital?.latitude ?? request?.hospitalLocation?.lat ?? location.coordinates?.lat ?? null,
    longitude: request?.locationHospital?.longitude ?? request?.hospitalLocation?.lng ?? location.coordinates?.lng ?? null,
  };
};

const extractDonorLocation = (donor) => {
  const location = donor?.location || {};
  const coordinates = location.coordinates || {};

  return {
    latitude: coordinates.lat ?? location.latitude ?? location.lat ?? null,
    longitude: coordinates.lng ?? location.longitude ?? location.long ?? null,
  };
};

const buildDistanceInfo = (request, donor) => {
  const hospitalLocation = extractHospitalLocation(request);
  const donorLocation = extractDonorLocation(donor);

  if (
    !Number.isFinite(hospitalLocation.latitude)
    || !Number.isFinite(hospitalLocation.longitude)
    || !Number.isFinite(donorLocation.latitude)
    || !Number.isFinite(donorLocation.longitude)
  ) {
    return { distance: null, distanceKm: null };
  }

  const distanceKm = calculateDistance(
    { latitude: donorLocation.latitude, longitude: donorLocation.longitude },
    { latitude: hospitalLocation.latitude, longitude: hospitalLocation.longitude },
  );

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    distance: formatDistance(distanceKm),
  };
};

const buildRequestLocationLabel = (request) => {
  const hospitalLocation = extractHospitalLocation(request);
  return hospitalLocation.city || hospitalLocation.governorate || request?.hospitalName || null;
};

export const buildEmergencyRequestNotificationData = (request, donor = null) => {
  const requestId = request?._id?.toString?.() || request?.id?.toString?.() || String(request?.requestId || '');
  const hospitalName = request?.hospitalName
    || request?.hospitalId?.hospitalName
    || request?.hospitalId?.fullName
    || null;
  const location = buildRequestLocationLabel(request);
  const distanceInfo = buildDistanceInfo(request, donor);
  const requiredBy = toIsoString(request?.requiredBy);
  const createdAt = toIsoString(request?.createdAt);
  const unitsNeeded = request?.unitsNeeded ?? request?.quantity ?? 1;

  return {
    type: EMERGENCY_NOTIFICATION_TYPE,
    requestId,
    bloodType: normalizeBloodTypeList(request?.bloodType),
    bloodTypeLabel: formatBloodTypeLabel(request?.bloodType),
    urgency: request?.urgency || null,
    hospitalName,
    location,
    distance: distanceInfo.distance,
    distanceKm: distanceInfo.distanceKm,
    unitsNeeded,
    requiredBy,
    requestStatus: request?.status || null,
    createdAt,
    title_loc_key: EMERGENCY_NOTIFICATION_TITLE_KEY,
    body_loc_key: EMERGENCY_NOTIFICATION_BODY_KEY,
    requestDetailsScreen: 'EmergencyRequestDetailsScreen',
    requestDetailsRoute: requestId ? `/urgent-requests/${requestId}` : null,
    acceptEndpoint: requestId ? `/urgent-requests/${requestId}/accept` : null,
    // declineEndpoint removed: Phase 7 decline flow removal
    actionIds: EMERGENCY_NOTIFICATION_ACTIONS.map((action) => action.id),
    defaultActionId: 'view',
    notificationState: 'DISPLAYED',
    fsmState: 'DISPLAYED',
    actions: EMERGENCY_NOTIFICATION_ACTIONS.map((action) => ({
      ...action,
      endpoint: requestId
        ? action.id === 'accept'
          ? `/urgent-requests/${requestId}/accept`
          : `/urgent-requests/${requestId}`
        : null,
    })),
  };
};

export const buildEmergencyRequestNotificationContent = (request, donor = null) => {
  const language = donor?.settings?.language === 'ar' ? 'ar' : 'en';
  const data = buildEmergencyRequestNotificationData(request, donor);
  const bloodType = data.bloodTypeLabel || 'blood';
  const hospitalName = data.hospitalName || 'nearby hospital';
  const title = language === 'ar'
    ? '🚨 طلب دم طارئ'
    : '🚨 Emergency Blood Request';
  const body = language === 'ar'
    ? `مطلوب دم ${bloodType} بشكل عاجل بالقرب من ${hospitalName}`
    : `Critical ${bloodType} blood needed near ${hospitalName}`;

  return {
    title,
    body,
    language,
    data,
  };
};

export const buildEmergencyRequestFcmData = (request, donor = null) => {
  const data = buildEmergencyRequestNotificationData(request, donor);

  return {
    type: data.type,
    requestId: data.requestId,
    bloodType: JSON.stringify(data.bloodType || []),
    bloodTypeLabel: data.bloodTypeLabel || '',
    urgency: data.urgency || '',
    hospitalName: data.hospitalName || '',
    location: data.location || '',
    distance: data.distance || '',
    distanceKm: data.distanceKm === null ? '' : String(data.distanceKm),
    unitsNeeded: String(data.unitsNeeded ?? ''),
    requiredBy: data.requiredBy || '',
    requestStatus: data.requestStatus || '',
    createdAt: data.createdAt || '',
    title_loc_key: data.title_loc_key,
    body_loc_key: data.body_loc_key,
    requestDetailsScreen: data.requestDetailsScreen,
    requestDetailsRoute: data.requestDetailsRoute || '',
    acceptEndpoint: data.acceptEndpoint || '',
    // declineEndpoint removed: Phase 7 decline flow removal
    defaultActionId: data.defaultActionId,
    notificationState: data.notificationState,
    fsmState: data.fsmState,
    actionIds: JSON.stringify(data.actionIds),
    actions: JSON.stringify(data.actions),
  };
};