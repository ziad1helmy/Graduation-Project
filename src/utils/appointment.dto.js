const DONOR_DETAILS_SELECT = 'fullName phoneNumber bloodType email';
const HOSPITAL_DETAILS_SELECT = 'fullName hospitalName address contactNumber location';

export const appointmentPopulateOptions = [
  { path: 'donorId', select: DONOR_DETAILS_SELECT },
  { path: 'hospitalId', select: HOSPITAL_DETAILS_SELECT },
];

const toPlainObject = (value) => {
  if (!value) return value;
  return value.toObject ? value.toObject() : value;
};

const buildDonorDetails = (source) => {
  if (!source || typeof source !== 'object') return null;

  return {
    fullName: source.fullName ?? null,
    phoneNumber: source.phoneNumber ?? null,
    bloodType: source.bloodType ?? null,
    email: source.email ?? null,
  };
};

export const toAppointmentResponse = (appointment) => {
  if (!appointment) return appointment;

  const src = toPlainObject(appointment);

  const sanitized = {
    _id: src._id,
    appointmentDate: src.appointmentDate || null,
    status: src.status || null,
    notes: src.notes || null,
    donorDetails: buildDonorDetails(src.donorDetails || src.donorId),
    donorId: src.donorId ? (typeof src.donorId === 'object' ? { _id: src.donorId._id } : src.donorId) : null,
    requestId: src.requestId
      ? (typeof src.requestId === 'object'
        ? {
            _id: src.requestId._id,
            type: src.requestId.type || null,
            bloodType: src.requestId.bloodType || null,
            organType: src.requestId.organType || null,
            urgency: src.requestId.urgency || null,
          }
        : src.requestId)
      : null,
    donationType: src.donationType || null,
    hospitalId: src.hospitalId ? (typeof src.hospitalId === 'object' ? { _id: src.hospitalId._id } : src.hospitalId) : null,
    createdAt: src.createdAt || null,
    updatedAt: src.updatedAt || null,
  };

  return sanitized;
};
