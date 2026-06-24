export const DISQUALIFYING_DISEASES = [
  { code: 'HIV_AIDS', label: 'HIV/AIDS', deferralDays: null },
  { code: 'HEPATITIS_B', label: 'Hepatitis B', deferralDays: null },
  { code: 'HEPATITIS_C', label: 'Hepatitis C', deferralDays: null },
  { code: 'SYPHILIS', label: 'Syphilis', deferralDays: 365 },
  { code: 'MALARIA', label: 'Malaria (active)', deferralDays: 365 },
  { code: 'TUBERCULOSIS', label: 'Tuberculosis (active)', deferralDays: 730 },
  { code: 'CANCER', label: 'Cancer', deferralDays: null },
  { code: 'HEART_DISEASE', label: 'Heart disease', deferralDays: null },
  { code: 'BLEEDING_DISORDER', label: 'Bleeding disorder', deferralDays: null },
  { code: 'EPILEPSY', label: 'Epilepsy / seizures', deferralDays: null },
  { code: 'DIABETES_INSULIN', label: 'Diabetes (insulin-dependent)', deferralDays: null },
  { code: 'CHRONIC_KIDNEY', label: 'Chronic kidney disease', deferralDays: null },
  { code: 'CHRONIC_LIVER', label: 'Chronic liver disease', deferralDays: null },
  { code: 'AUTOIMMUNE', label: 'Autoimmune disease', deferralDays: null },
  { code: 'SCHIZOPHRENIA', label: 'Schizophrenia', deferralDays: null },
  { code: 'RECENT_INFECTION', label: 'Recent infection / fever', deferralDays: 14 },
  { code: 'OTHER', label: 'Other disqualifying condition', deferralDays: null },
];

export const DISEASE_SCREENING_DEFAULTS = {
  screeningCompleted: false,
  disqualifyingDiseaseFound: false,
  disqualifyingDiseases: [],
  notes: '',
  screenedAt: null,
};

export const DISQUALIFYING_DISEASE_CODES = DISQUALIFYING_DISEASES.map((d) => d.code);
