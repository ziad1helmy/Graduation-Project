/**
 * Seed real Egyptian hospital data (20 hospitals from Wikidata) and
 * 100 realistic Egyptian donor profiles for dev/demo use.
 *
 * Run:  node scripts/seed-real-data.js
 *
 * The hospital names and coordinates are sourced from real Wikidata entries.
 * Donor data (names, phones, locations) is generated — no real PII.
 */

import mongoose from 'mongoose';
import { validateEnv } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { encryptAdminKey } from '../src/utils/admin-key-crypto.js';
import User from '../src/models/User.model.js';
import Donor from '../src/models/Donor.model.js';
import Hospital from '../src/models/Hospital.model.js';
import Request from '../src/models/Request.model.js';
import Donation from '../src/models/Donation.model.js';

// ─── Real Egyptian hospitals from Wikidata ──────────────────────────────────
// Each entry: { name, governorate, city, lat, lng, type }
const HOSPITALS = [
  { name: 'Qasr El Ayni Hospital (Cairo University)', gov: 'Cairo', city: 'Cairo', lat: 30.0314, lng: 31.2270, type: 'University Hospital' },
  { name: 'Ain Shams University Hospital (El Demerdash)', gov: 'Cairo', city: 'Cairo', lat: 30.0735, lng: 31.2761, type: 'University Hospital' },
  { name: "57357 Children's Cancer Hospital", gov: 'Cairo', city: 'Cairo', lat: 30.0189, lng: 31.2336, type: 'Specialized Hospital' },
  { name: 'Nasser Institute Hospital', gov: 'Cairo', city: 'Cairo', lat: 30.0968, lng: 31.2401, type: 'Teaching Hospital' },
  { name: 'El Sahel Teaching Hospital', gov: 'Cairo', city: 'Cairo', lat: 30.1070, lng: 31.2480, type: 'Teaching Hospital' },
  { name: 'Coptic Hospital', gov: 'Cairo', city: 'Cairo', lat: 30.0631, lng: 31.2525, type: 'General Hospital' },
  { name: 'Nile Badrawi Hospital', gov: 'Cairo', city: 'Cairo', lat: 29.9824, lng: 31.2311, type: 'General Hospital' },
  { name: 'Behman Hospital', gov: 'Cairo', city: 'Cairo', lat: 29.8552, lng: 31.3379, type: 'Specialized Hospital' },
  { name: 'Mansoura University Hospital', gov: 'Dakahlia', city: 'Mansoura', lat: 31.0405, lng: 31.3582, type: 'University Hospital' },
  { name: 'Alexandria University Hospital (El Shatby)', gov: 'Alexandria', city: 'Alexandria', lat: 31.2001, lng: 29.9187, type: 'University Hospital' },
  { name: 'Tanta University Hospital', gov: 'Gharbia', city: 'Tanta', lat: 30.8015, lng: 30.9951, type: 'University Hospital' },
  { name: 'Assiut University Hospitals', gov: 'Assiut', city: 'Assiut', lat: 27.1856, lng: 31.1657, type: 'University Hospital' },
  { name: 'Zagazig University Hospital', gov: 'Sharqia', city: 'Zagazig', lat: 30.5843, lng: 31.5011, type: 'University Hospital' },
  { name: 'Minia University Hospital', gov: 'Minia', city: 'Minia', lat: 28.0907, lng: 30.7647, type: 'University Hospital' },
  { name: 'Sohag University Hospitals', gov: 'Sohag', city: 'Sohag', lat: 26.5677, lng: 31.7076, type: 'University Hospital' },
  { name: 'Aswan University Hospitals', gov: 'Aswan', city: 'Aswan', lat: 24.0875, lng: 32.9079, type: 'University Hospital' },
  { name: 'Ismailia Medical Complex', gov: 'Ismailia', city: 'Ismailia', lat: 30.6209, lng: 32.2867, type: 'Medical Complex' },
  { name: 'Shebin El-Kom Teaching Hospital', gov: 'Monufia', city: 'Shebin El-Kom', lat: 30.5978, lng: 30.9053, type: 'Teaching Hospital' },
  { name: 'Sharm El Sheikh International Hospital', gov: 'South Sinai', city: 'Sharm El Sheikh', lat: 27.8816, lng: 34.2998, type: 'General Hospital' },
  { name: 'Al Ahrar Teaching Hospital', gov: 'Sharqia', city: 'Zagazig', lat: 30.5669, lng: 31.5015, type: 'Teaching Hospital' },
];

// ─── Egyptian name pools for realistic donor generation ─────────────────────
const MALE_FIRST_NAMES = [
  'Ahmed', 'Mohamed', 'Mahmoud', 'Ali', 'Hassan', 'Omar', 'Khaled', 'Mostafa',
  'Youssef', 'Ibrahim', 'Abdelrahman', 'Karim', 'Hossam', 'Amr', 'Tamer',
  'Sherif', 'Nader', 'Sameh', 'Wael', 'Hany', 'Hesham', 'Maged', 'Ashraf',
  'Gamal', 'Samy', 'Raouf', 'Essam', 'Mamdouh', 'Adel', 'Tarek',
];

const FEMALE_FIRST_NAMES = [
  'Fatma', 'Nour', 'Aya', 'Mariam', 'Sara', 'Nadia', 'Heba', 'Dina',
  'Rania', 'Amira', 'Laila', 'Hala', 'Mona', 'Ghada', 'Soha', 'Yasmine',
  'Salma', 'Nada', 'Mai', 'Reem', 'Shaimaa', 'Doaa', 'Eman', 'Marwa',
  'Shahd', 'Lina', 'Meral', 'Samar', 'Nermeen', 'Hagar',
];

const LAST_NAMES = [
  'Abdel Aziz', 'El Sayed', 'Mahmoud', 'Hassan', 'Ali', 'Ibrahim',
  'Youssef', 'Khalil', 'Mostafa', 'Sherif', 'Kamal', 'Fathy', 'Mansour',
  'Naguib', 'Tawfik', 'Soliman', 'Shaheen', 'El Sharkawy', 'Abdel Rahman',
  'Gad', 'Farouk', 'Rashad', 'Nour', 'Ezzat', 'Hefny', 'Sadek',
  'El Masry', 'El Hindi', 'Shaker', 'Badr',
];

// Spread donors across 15 Egyptian governorates to enable realistic geo-matching
const GOVERNORATES = [
  { gov: 'Cairo', cities: ['Cairo', 'Nasr City', 'Heliopolis', 'Maadi', 'Helwan', 'Shubra', 'Zamalek', 'Mohandessin', 'Dokki'], latBase: 30.05, lngBase: 31.25 },
  { gov: 'Giza', cities: ['Giza', 'Haram', 'Faisal', 'Agouza', 'Imbaba', 'Dokki'], latBase: 30.01, lngBase: 31.20 },
  { gov: 'Alexandria', cities: ['Alexandria', 'Smouha', 'Sidi Bishr', 'Miami', 'Louran'], latBase: 31.20, lngBase: 29.92 },
  { gov: 'Dakahlia', cities: ['Mansoura', 'Talkha', 'Mit Ghamr'], latBase: 31.04, lngBase: 31.38 },
  { gov: 'Gharbia', cities: ['Tanta', 'El Mahalla', 'Kafr El Zayat'], latBase: 30.80, lngBase: 31.00 },
  { gov: 'Sharqia', cities: ['Zagazig', 'Belbeis', 'Abu Hammad'], latBase: 30.58, lngBase: 31.50 },
  { gov: 'Assiut', cities: ['Assiut', 'Abnoub', 'Manfalut'], latBase: 27.18, lngBase: 31.17 },
  { gov: 'Monufia', cities: ['Shebin El-Kom', 'Menouf', 'Sars El-Layan'], latBase: 30.60, lngBase: 30.90 },
  { gov: 'Minia', cities: ['Minia', 'Samalout', 'Maghagha'], latBase: 28.09, lngBase: 30.76 },
  { gov: 'Sohag', cities: ['Sohag', 'Akhmim', 'Tahta'], latBase: 26.57, lngBase: 31.70 },
  { gov: 'Aswan', cities: ['Aswan', 'Edfu', 'Kom Ombo'], latBase: 24.09, lngBase: 32.90 },
  { gov: 'Ismailia', cities: ['Ismailia', 'Fayed', 'Qantara'], latBase: 30.62, lngBase: 32.29 },
  { gov: 'South Sinai', cities: ['Sharm El Sheikh', 'Dahab', 'El Tor'], latBase: 27.88, lngBase: 34.30 },
  { gov: 'Beheira', cities: ['Damanhour', 'Kafr El Dawwar', 'Rashid'], latBase: 31.03, lngBase: 30.47 },
  { gov: 'Kafr El Sheikh', cities: ['Kafr El Sheikh', 'Desouk', 'Beyla'], latBase: 31.10, lngBase: 30.95 },
];

// Egyptian blood type distribution (approximate)
const BLOOD_TYPES = ['O+', 'A+', 'B+', 'O-', 'A-', 'B-', 'AB+', 'AB-'];
const BLOOD_WEIGHTS = [35, 28, 22, 5, 4, 4, 1.5, 0.5];

// ─── Helpers ────────────────────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const weightedPick = (items, weights) => {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
};

const randomPhone = () => {
  const prefixes = ['010', '011', '012', '015'];
  const prefix = pick(prefixes);
  const rest = String(Math.floor(10000000 + Math.random() * 90000000));
  return prefix + rest;
};

const randomAge = (min = 18, max = 55) => {
  const now = new Date();
  const year = now.getFullYear() - min - Math.floor(Math.random() * (max - min));
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(year, month, day);
};

const randomHemoglobin = (gender) => {
  if (gender === 'male') return +(12 + Math.random() * 5).toFixed(1);
  return +(11 + Math.random() * 4).toFixed(1);
};

const randomWeight = (gender) => {
  if (gender === 'male') return Math.floor(65 + Math.random() * 40);
  return Math.floor(55 + Math.random() * 30);
};

const randomLocation = () => {
  const gov = pick(GOVERNORATES);
  const city = pick(gov.cities);
  const lat = +(gov.latBase + (Math.random() - 0.5) * 0.15).toFixed(4);
  const lng = +(gov.lngBase + (Math.random() - 0.5) * 0.15).toFixed(4);
  return { governorate: gov.gov, city, lat, lng };
};

const randomHealthHistory = () => {
  const conditions = ['Asthma', 'Diabetes', 'Hypertension', 'Anemia', 'Heart condition'];
  const meds = ['Iron supplement', 'Vitamin D', 'Antihistamine', 'Thyroid medication', 'Blood pressure medication'];
  const allergies = ['Penicillin', 'Aspirin', 'Dust', 'Pollen', 'Sulfa drugs', 'Latex'];

  const hasCondition = Math.random() < 0.15;
  const onMeds = Math.random() < 0.2;
  const hasAllergies = Math.random() < 0.25;

  return {
    chronicConditions: hasCondition ? [pick(conditions)] : [],
    medications: onMeds ? [pick(meds)] : [],
    allergies: hasAllergies ? [pick(allergies)] : [],
    recentIllness: Math.random() < 0.1 ? 'Recovered from a cold two weeks ago.' : '',
    notes: '',
    lastCheckupDate: new Date(Date.now() - Math.floor(Math.random() * 180 + 10) * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  };
};

const randomSettings = () => ({
  pushNotifications: Math.random() < 0.85,
  emergencyAlerts: Math.random() < 0.75,
  privacyMode: Math.random() < 0.2,
  language: Math.random() < 0.3 ? 'ar' : 'en',
});

const makeEmail = (fullName) => {
  const slug = fullName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
  return `${slug}@lifelink.demo`;
};

// ─── Seed helpers (mirror seed-demo.js patterns) ────────────────────────────

const now = new Date();
const pastDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const futureDate = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function ensureUser(model, payload) {
  const normalizedPayload = payload.role === 'hospital' && !payload.name
    ? { ...payload, name: payload.hospitalName }
    : payload;

  const { adminKey: plaintextKey, ...userPayload } = normalizedPayload;

  const existingBase = await User.findOne({ email: userPayload.email }).select('+password +adminKey');

  if (existingBase && existingBase.role !== userPayload.role) {
    throw new Error(`Existing user role mismatch for ${userPayload.email}`);
  }

  let user;
  if (!existingBase) {
    user = await model.create({
      ...userPayload,
      isEmailVerified: true,
      emailVerifiedAt: now,
      isSuspended: false,
      deletedAt: null,
    });
  } else {
    user = await model.findById(existingBase._id).select('+password +adminKey');
    Object.entries(userPayload).forEach(([key, value]) => {
      user[key] = value;
    });
    user.isEmailVerified = true;
    user.emailVerifiedAt = now;
    user.deletedAt = null;
    await user.save();
    user = await model.findById(existingBase._id).select('+adminKey');
  }

  if (plaintextKey) {
    user.adminKey = encryptAdminKey(plaintextKey, user._id.toString());
    await user.save({ validateBeforeSave: false });
  }

  return user;
}

async function ensureRequest(filter, data) {
  if (!data.hospitalLocationGeo && data.hospitalLocation) {
    const { lat, lng } = data.hospitalLocation;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      data.hospitalLocationGeo = { type: 'Point', coordinates: [lng, lat] };
    }
  }
  return Request.findOneAndUpdate(filter, { $set: data }, { upsert: true, returnDocument: 'after', runValidators: true });
}

async function ensureDonation(filter, data) {
  return Donation.findOneAndUpdate(filter, { $set: data }, { upsert: true, returnDocument: 'after', runValidators: true });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function seedHospitals() {
  console.log('Seeding 20 real Egyptian hospitals...');
  const docs = [];
  for (let i = 0; i < HOSPITALS.length; i++) {
    const h = HOSPITALS[i];
    const idx = String(i + 1).padStart(3, '0');
    const doc = await ensureUser(Hospital, {
      fullName: h.name,
      hospitalName: h.name,
      name: h.name,
      email: `hospital${idx}@lifelink.data`,
      password: 'HospitalPass@123',
      role: 'hospital',
      hospitalId: `HOSP-REAL-${idx}`,
      hospitalType: h.type,
      phone: randomPhone(),
      city: h.city,
      state: h.gov,
      lat: h.lat,
      long: h.lng,
      capacity: Math.floor(15 + Math.random() * 40),
      slotsPerHour: 4 + Math.floor(Math.random() * 4),
      workingHoursStart: 8,
      workingHoursEnd: 18,
      bloodBanksAvailable: BLOOD_TYPES.filter(() => Math.random() < 0.7),
      address: { city: h.city, governorate: h.gov, district: h.city },
      location: {
        city: h.city,
        governorate: h.gov,
        coordinates: { lat: h.lat, lng: h.lng },
        lastUpdated: now,
      },
    });
    docs.push(doc);
    if ((i + 1) % 5 === 0) console.log(`  ✓ ${i + 1}/${HOSPITALS.length} hospitals seeded`);
  }
  console.log(`  ✓ All ${HOSPITALS.length} hospitals seeded`);
  return docs;
}

async function seedDonors() {
  console.log('Seeding 100 realistic Egyptian donors...');
  const docs = [];
  for (let i = 0; i < 100; i++) {
    const isMale = Math.random() < 0.5;
    const firstName = isMale ? pick(MALE_FIRST_NAMES) : pick(FEMALE_FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;
    const email = makeEmail(fullName);
    const gender = isMale ? 'male' : 'female';
    const loc = randomLocation();
    const bloodType = weightedPick(BLOOD_TYPES, BLOOD_WEIGHTS);

    const donor = await ensureUser(Donor, {
      fullName,
      email,
      password: 'DonorPass@123',
      role: 'donor',
      isOptedIn: Math.random() < 0.85,
      phoneNumber: randomPhone(),
      dateOfBirth: randomAge(),
      gender,
      bloodType,
      weight: randomWeight(gender),
      hemoglobinLevel: randomHemoglobin(gender),
      healthHistory: randomHealthHistory(),
      settings: randomSettings(),
      location: {
        city: loc.city,
        governorate: loc.governorate,
        coordinates: { lat: loc.lat, lng: loc.lng },
        lastUpdated: new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000),
      },
    });
    docs.push(donor);
  }
  console.log('  ✓ All 100 donors seeded');
  return docs;
}

async function seedRequests(hospitals) {
  console.log('Seeding sample blood requests and donations...');
  const docs = [];
  for (let i = 0; i < Math.min(30, HOSPITALS.length); i++) {
    const hospital = hospitals[i];
    const needsBlood = BLOOD_TYPES.filter(() => Math.random() < 0.4);
    if (needsBlood.length === 0) continue;

    const urgency = ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)];
    const status = urgency === 'critical' ? 'pending' : (Math.random() < 0.5 ? 'pending' : 'accepted');
    const qty = 1 + Math.floor(Math.random() * 4);

    const request = await ensureRequest(
      { hospitalId: hospital._id, notes: `[real-data] request-${i}` },
      {
        hospitalId: hospital._id,
        type: 'blood',
        bloodType: needsBlood,
        urgency,
        status,
        requiredBy: futureDate(1 + Math.floor(Math.random() * 10)),
        quantity: qty,
        hospitalContact: hospital.phone,
        hospitalLocation: hospital.location.coordinates,
        hospitalName: hospital.hospitalName || hospital.fullName,
        notes: `[real-data] request-${i}`,
      }
    );
    docs.push(request);
  }
  console.log(`  ✓ ${docs.length} blood requests created`);
  return docs;
}

async function seedDonations(requests, donors) {
  let count = 0;
  for (let i = 0; i < requests.length && i < donors.length; i++) {
    const request = requests[i];
    const donor = donors[i];
    const statuses = ['pending', 'scheduled', 'completed', 'completed', 'cancelled'];
    const status = pick(statuses);

    const data = {
      donorId: donor._id,
      requestId: request._id,
      status,
      quantity: 1,
      notes: `[real-data] donation-${i}`,
    };

    if (status === 'scheduled') {
      data.scheduledDate = futureDate(1 + Math.floor(Math.random() * 5));
    }
    if (status === 'completed') {
      data.completedDate = pastDate(1 + Math.floor(Math.random() * 30));
    }

    await ensureDonation({ donorId: donor._id, requestId: request._id }, data);
    count++;
  }
  console.log(`  ✓ ${count} donations linked to requests`);
  return count;
}

function printSummary(hospitals, donors, requests, donations) {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Real Egypt Data Seed — Complete                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Hospitals: ${hospitals.length} (real Wikidata data)`);
  console.log(`  Donors:    ${donors.length} (realistic Egyptian profiles)`);
  console.log(`  Requests:  ${requests.length}`);
  console.log(`  Donations: ${donations}`);
  console.log('');
  console.log('Credentials (all accounts — password varies by role):');
  console.log(`  Donors:    any donor email / DonorPass@123`);
  console.log(`  Hospitals: any hospital email / HospitalPass@123`);
  console.log('');
  console.log('Sample hospital logins (one per governorate):');
  const seenGovs = new Set();
  for (let i = 0; i < HOSPITALS.length; i++) {
    const h = HOSPITALS[i];
    if (!seenGovs.has(h.gov)) {
      seenGovs.add(h.gov);
      const idx = String(i + 1).padStart(3, '0');
      console.log(`  ${h.gov.padEnd(14)} → hospital${idx}@lifelink.data / HospitalPass@123`);
    }
  }
  console.log('');
  console.log('Sample donor logins (first 5):');
  for (let i = 0; i < 5 && i < donors.length; i++) {
    console.log(`  ${donors[i].email} / DonorPass@123`);
  }
  console.log(`  ... and ${donors.length - 5} more donors`);
}

async function main() {
  validateEnv();

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
  if (
    process.env.NODE_ENV === 'production' ||
    uri.toLowerCase().includes('prod') ||
    uri.toLowerCase().includes('production')
  ) {
    console.error('❌ Safe-guard: Cannot run seed script against a production cluster!');
    process.exit(1);
  }

  await connectDB();

  if (mongoose.connection.readyState !== 1) {
    throw new Error('Seed requires an active MongoDB connection.');
  }

  const hospitals = await seedHospitals();
  const donors = await seedDonors();
  const requests = await seedRequests(hospitals);
  const donationCount = await seedDonations(requests, donors);

  printSummary(hospitals, donors, requests, donationCount);
}

try {
  await main();
} catch (error) {
  console.error('Real data seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
