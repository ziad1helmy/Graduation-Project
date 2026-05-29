import { DONATION_TYPE_LABELS, DONATION_TYPE_OPTIONS } from '../constants/donation.constants.js';

const DONOR_DETAILS_SELECT = 'fullName phoneNumber bloodType email gender dateOfBirth';
const HOSPITAL_DETAILS_SELECT = 'fullName hospitalName address contactNumber location';
const REQUEST_DETAILS_SELECT = 'type bloodType organType urgency unitsNeeded quantity notes hospitalId hospitalName';

const DONATION_TYPE_ALIASES = new Map([
  ['blood', DONATION_TYPE_LABELS.WHOLE_BLOOD],
  ['blood donation', DONATION_TYPE_LABELS.WHOLE_BLOOD],
  ['whole blood', DONATION_TYPE_LABELS.WHOLE_BLOOD],
  ['plasma', DONATION_TYPE_LABELS.PLASMA],
  ['plasma donation', DONATION_TYPE_LABELS.PLASMA],
  ['platelet', DONATION_TYPE_LABELS.PLATELETS],
  ['platelets', DONATION_TYPE_LABELS.PLATELETS],
  ['platelet donation', DONATION_TYPE_LABELS.PLATELETS],
  ['double red cells', DONATION_TYPE_LABELS.DOUBLE_RED_CELLS],
  ['double red cell', DONATION_TYPE_LABELS.DOUBLE_RED_CELLS],
]);

export const appointmentPopulateOptions = [
  { path: 'donorId', select: DONOR_DETAILS_SELECT },
  { path: 'hospitalId', select: HOSPITAL_DETAILS_SELECT },
  { path: 'requestId', select: REQUEST_DETAILS_SELECT },
];

const toPlainObject = (value) => {
  if (!value) return value;
  return value.toObject ? value.toObject() : value;
};

const normalizeDonationTypeLabel = (value) => {
  if (!value) return null;
  const rawValue = String(value).trim();
  const lowerValue = rawValue.toLowerCase();

  if (DONATION_TYPE_OPTIONS.includes(rawValue)) {
    return rawValue;
  }

  return DONATION_TYPE_ALIASES.get(lowerValue) || null;
};

const splitFullName = (fullName = null) => {
  const normalizedName = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!normalizedName) {
    return { firstName: null, lastName: null };
  }

  const [firstName, ...rest] = normalizedName.split(' ');
  return {
    firstName: firstName || null,
    lastName: rest.length > 0 ? rest.join(' ') : null,
  };
};

const formatAppointmentDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-CA');
};

const formatAppointmentTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const buildDonorDetails = (source) => {
  if (!source || typeof source !== 'object') return null;

  const fullName = source.fullName ?? null;
  const { firstName, lastName } = splitFullName(fullName);

  return {
    donorId: source._id || source.donorId || null,
    id: source._id || source.donorId || null,
    _id: source._id || source.donorId || null,
    firstName,
    lastName,
    fullName: source.fullName ?? null,
    phoneNumber: source.phoneNumber ?? null,
    bloodType: source.bloodType ?? null,
    email: source.email ?? null,
    gender: source.gender ?? null,
    dateOfBirth: source.dateOfBirth ?? null,
  };
};

const buildHospitalDetails = (source) => {
  if (!source || typeof source !== 'object') return null;

  const hospitalName = source.hospitalName ?? source.fullName ?? null;

  return {
    hospitalId: source._id || source.hospitalId || null,
    id: source._id || source.hospitalId || null,
    name: hospitalName,
    hospitalName,
    fullName: source.fullName ?? null,
    address: source.address ?? null,
    contactNumber: source.contactNumber ?? null,
    location: source.location ?? null,
  };
};

const buildRequestDetails = (source) => {
  if (!source || typeof source !== 'object') return null;

  return {
    requestId: source._id || source.requestId || null,
    id: source._id || source.requestId || null,
    urgencyLevel: source.urgency ?? null,
    urgency: source.urgency ?? null,
    unitsNeeded: source.unitsNeeded ?? source.quantity ?? null,
    notes: source.notes ?? null,
    type: source.type ?? null,
    bloodType: source.bloodType ?? null,
    organType: source.organType ?? null,
  };
};

export const buildAppointmentConfirmationResponse = (appointment) => {
  const src = toPlainObject(appointment);
  if (!src) return src;

  const donor = buildDonorDetails(src.donorId || src.donorDetails);
  const hospital = buildHospitalDetails(src.hospitalId);
  const request = buildRequestDetails(src.requestId);
  const appointmentDate = src.appointmentDate || null;
  const appointmentType = normalizeDonationTypeLabel(src.donationType) || src.donationType || null;

  return {
    success: true,
    data: {
      _id: src._id,
      appointmentId: src._id,
      donorId: donor?.donorId || (src.donorId && typeof src.donorId !== 'object' ? src.donorId : src.donorId?._id) || null,
      hospitalId: hospital?.hospitalId || (src.hospitalId && typeof src.hospitalId !== 'object' ? src.hospitalId : src.hospitalId?._id) || null,
      requestId: request?.requestId || (src.requestId && typeof src.requestId !== 'object' ? src.requestId : src.requestId?._id) || null,
      appointmentDate,
      appointmentTime: formatAppointmentTime(appointmentDate),
      appointmentDay: formatAppointmentDate(appointmentDate),
      status: src.status || null,
      donationType: appointmentType,
      notes: src.notes || null,
      qrToken: src.qrToken || null,
      qrExpiresAt: src.qrExpiresAt || null,
      verificationStatus: src.verificationStatus || null,
      verificationChecklist: src.verificationChecklist || null,
      rescheduleCount: src.rescheduleCount || 0,
      rescheduleHistory: src.rescheduleHistory || [],
      donorDetails: donor,
      hospitalDetails: hospital,
      requestDetails: request,
      donor: donor ? {
        donorId: donor.donorId,
        firstName: donor.firstName,
        lastName: donor.lastName,
        fullName: donor.fullName,
        email: donor.email,
        phoneNumber: donor.phoneNumber,
        bloodType: donor.bloodType,
        gender: donor.gender,
        dateOfBirth: donor.dateOfBirth,
      } : null,
      appointment: {
        appointmentId: src._id,
        donationType: appointmentType,
        appointmentDate,
        appointmentTime: formatAppointmentTime(appointmentDate),
        status: src.status || null,
        hospitalId: hospital?.hospitalId || null,
        hospitalName: hospital?.hospitalName || hospital?.name || null,
      },
      hospital: hospital ? {
        hospitalId: hospital.hospitalId,
        id: hospital.id,
        name: hospital.name,
        hospitalName: hospital.hospitalName,
      } : null,
      request: request ? {
        requestId: request.requestId,
        id: request.id,
        urgencyLevel: request.urgencyLevel,
        unitsNeeded: request.unitsNeeded,
        notes: request.notes,
      } : null,
      createdAt: src.createdAt || null,
      updatedAt: src.updatedAt || null,
    },
  };
};

export const toAppointmentResponse = (appointment) => {
  if (!appointment) return appointment;

  const src = toPlainObject(appointment);
  const confirmation = buildAppointmentConfirmationResponse(src)?.data;

  const sanitized = {
    _id: src._id,
    appointmentId: src._id,
    appointmentDate: src.appointmentDate || null,
    appointmentTime: confirmation?.appointmentTime || null,
    status: src.status || null,
    notes: src.notes || null,
    donorDetails: confirmation?.donorDetails || buildDonorDetails(src.donorDetails || src.donorId),
    donorId: confirmation?.donorId || (src.donorId ? (typeof src.donorId === 'object' ? { _id: src.donorId._id } : src.donorId) : null),
    requestId: src.requestId
      ? (typeof src.requestId === 'object'
        ? {
            _id: src.requestId._id,
            type: src.requestId.type || null,
            bloodType: src.requestId.bloodType || null,
            organType: src.requestId.organType || null,
            urgency: src.requestId.urgency || null,
            urgencyLevel: src.requestId.urgency || null,
            unitsNeeded: src.requestId.unitsNeeded || src.requestId.quantity || null,
            notes: src.requestId.notes || null,
            hospitalId: src.requestId.hospitalId || null,
            hospitalName: src.requestId.hospitalName || null,
          }
        : src.requestId)
      : null,
    donationType: confirmation?.donationType || src.donationType || null,
    hospitalId: confirmation?.hospitalId || (src.hospitalId ? (typeof src.hospitalId === 'object' ? { _id: src.hospitalId._id } : src.hospitalId) : null),
    donor: confirmation?.donor || null,
    appointment: confirmation?.appointment || null,
    hospital: confirmation?.hospital || null,
    request: confirmation?.request || null,
    hospitalDetails: confirmation?.hospitalDetails || null,
    requestDetails: confirmation?.requestDetails || null,
    qrToken: src.qrToken || null,
    qrExpiresAt: src.qrExpiresAt || null,
    verificationStatus: src.verificationStatus || null,
    verificationChecklist: src.verificationChecklist || null,
    rescheduleCount: src.rescheduleCount || 0,
    rescheduleHistory: src.rescheduleHistory || [],
    createdAt: src.createdAt || null,
    updatedAt: src.updatedAt || null,
  };

  return sanitized;
};
