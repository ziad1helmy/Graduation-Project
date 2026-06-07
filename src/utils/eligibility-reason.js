export const buildSafetyRejectionReason = (eligibility, donor) => {
  const isSuspended = donor.isSuspended;
  const isAvailable = donor.isOptedIn !== false;
  const isDeferred = donor.temporaryDeferralUntil && new Date(donor.temporaryDeferralUntil) > new Date();
  const hasMedicalRestrictions = donor.healthHistory?.chronicConditions?.length > 0;

  if (!eligibility.eligible) return eligibility.reason;
  if (isSuspended) return 'Donor is suspended';
  if (!isAvailable) return 'Donor is opted out';
  if (isDeferred) return 'Donor is temporarily deferred';
  if (hasMedicalRestrictions) return 'Donor has chronic conditions';
  return null;
};

export const isDonorIneligible = (eligibility, donor) => {
  return !eligibility.eligible
    || donor.isSuspended
    || donor.isOptedIn === false
    || (donor.temporaryDeferralUntil && new Date(donor.temporaryDeferralUntil) > new Date())
    || donor.healthHistory?.chronicConditions?.length > 0;
};