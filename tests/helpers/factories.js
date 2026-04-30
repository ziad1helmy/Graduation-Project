/**
 * Test data factories — create valid model instances with sensible defaults.
 * Override any field by passing it in the overrides object.
 */

import User from '../../src/models/User.model.js';
import Donor from '../../src/models/Donor.model.js';
import Hospital from '../../src/models/Hospital.model.js';
import Request from '../../src/models/Request.model.js';
import Donation from '../../src/models/Donation.model.js';

// Use a high-entropy counter to guarantee uniqueness across parallel test files
let counter = Math.floor(Math.random() * 100000);
const nextNum = () => ++counter;

export const buildDonor = (overrides = {}) => ({
  role: 'donor',
  fullName: 'Test Donor',
  email: 'donor@example.com',
  password: 'Password123!',
  phoneNumber: '0123456789',
  dateOfBirth: '1990-01-01',
  bloodType: 'A+',
  ...overrides,
});

/**
 * Create a donor user in the database.
 */
export async function createDonor(overrides = {}) {
  const n = nextNum();
  const phone = String(n).padStart(10, '1').slice(-10); // always 10 digits
  return Donor.create({
    fullName: `Test Donor ${n}`,
    email: `donor${n}_${Date.now()}@test.com`,
    password: 'TestPass@123',
    role: 'donor',
    phoneNumber: phone,
    dateOfBirth: new Date('1995-01-15'),
    gender: 'male',
    bloodType: 'O+',
    isAvailable: true,
    isEmailVerified: true,
    location: {
      city: 'Cairo',
      governorate: 'Cairo',
      coordinates: { lat: 30.0444, lng: 31.2357 },
      lastUpdated: new Date(),
    },
    ...overrides,
  });
}

/**
 * Create a hospital user in the database.
 */
export async function createHospital(overrides = {}) {
  const n = nextNum();
  const phone = String(n).padStart(10, '1').slice(-10);
  return Hospital.create({
    fullName: `Test Hospital Admin ${n}`,
    email: `hospital${n}_${Date.now()}@test.com`,
    password: 'TestPass@123',
    role: 'hospital',
    hospitalName: `Test Hospital ${n}`,
    hospitalId: 1000000 + n,
    licenseNumber: `LIC-TEST-${n}`,
    contactNumber: phone,
    address: { city: 'Cairo', governorate: 'Cairo' },
    isEmailVerified: true,
    location: {
      city: 'Cairo',
      governorate: 'Cairo',
      coordinates: { lat: 30.0511, lng: 31.2435 },
      lastUpdated: new Date(),
    },
    ...overrides,
  });
}

/**
 * Create a blood donation request.
 */
export async function createRequest(hospitalId, overrides = {}) {
  return Request.create({
    hospitalId,
    type: 'blood',
    bloodType: 'O+',
    urgency: 'high',
    status: 'pending',
    requiredBy: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    quantity: 2,
    hospitalContact: '1044444444',
    ...overrides,
  });
}

/**
 * Create a donation record.
 */
export async function createDonation(donorId, requestId, overrides = {}) {
  return Donation.create({
    donorId,
    requestId,
    quantity: 1,
    status: 'pending',
    ...overrides,
  });
}

/**
 * Create an admin user.
 */
export async function createAdmin(overrides = {}) {
  const n = nextNum();
  return User.create({
    fullName: `Test Admin ${n}`,
    email: `admin${n}_${Date.now()}@test.com`,
    password: 'TestPass@123',
    role: 'admin',
    isEmailVerified: true,
    ...overrides,
  });
}
