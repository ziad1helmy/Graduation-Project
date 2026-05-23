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

  const response = toPlainObject(appointment);
  const donorSource = response.donorDetails || response.donorId;

  if (donorSource) {
    response.donorDetails = buildDonorDetails(donorSource);
  }

  return response;
};
