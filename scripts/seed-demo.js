import mongoose from 'mongoose';
import { validateEnv } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.model.js';
import Donor from '../src/models/Donor.model.js';
import Hospital from '../src/models/Hospital.model.js';
import HospitalStaff from '../src/models/HospitalStaff.model.js';
import Request from '../src/models/Request.model.js';
import Donation from '../src/models/Donation.model.js';
import Notification from '../src/models/Notification.model.js';
import HelpDocument from '../src/models/HelpDocument.model.js';
import SupportMessage from '../src/models/SupportMessage.model.js';
import Appointment from '../src/models/Appointment.model.js';
import Activity from '../src/models/Activity.model.js';
import AuditLog from '../src/models/AuditLog.model.js';
import DonorPoints from '../src/models/DonorPoints.model.js';
import PointsTransaction from '../src/models/PointsTransaction.model.js';
import RewardCatalog from '../src/models/RewardCatalog.model.js';
import RewardRedemption from '../src/models/RewardRedemption.model.js';
import Badge from '../src/models/Badge.model.js';
import UserBadge from '../src/models/UserBadge.model.js';
import HospitalSettings from '../src/models/HospitalSettings.model.js';
import TwoFactor from '../src/models/TwoFactor.model.js';
import { seedDefaultSettings, seedDefaultRolePermissions } from '../src/services/admin.service.js';
import { seedRewardData } from '../src/services/reward.service.js';

const now = new Date();
const futureDate = (days, hour = 10) => {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  date.setHours(hour, 0, 0, 0);
  return date;
};
const pastDate = (days, hour = 10) => {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  date.setHours(hour, 0, 0, 0);
  return date;
};
const demoBaseUrl = `http://localhost:${process.env.PORT || 5000}`;

const demoCredentials = [
  { role: 'admin', email: 'admin@lifelink.demo', password: 'AdminPass@123', adminKey: 'ADMIN-DEMO-KEY-2026' },
  { role: 'superadmin', email: 'root@lifelink.demo', password: 'SuperAdminPass@123', adminKey: 'SUPERADMIN-DEMO-KEY-2026' },
  { role: 'donor', email: 'aya.hassan@lifelink.demo', password: 'DonorPass@123' },
  { role: 'donor', email: 'omar.nabil@lifelink.demo', password: 'DonorPass@123' },
  { role: 'donor', email: 'mariam.adel@lifelink.demo', password: 'DonorPass@123' },
  { role: 'donor', email: 'leila.mansour@lifelink.demo', password: 'DonorPass@123' },
  { role: 'donor', email: 'noor.tarek@lifelink.demo', password: 'DonorPass@123' },
  { role: 'hospital', email: 'ops@cairocare.demo', password: 'HospitalPass@123' },
  { role: 'hospital', email: 'bloodbank@nilehope.demo', password: 'HospitalPass@123' },
];

const donorsData = [
  {
    key: 'aya',
    fullName: 'Aya Hassan',
    email: 'aya.hassan@lifelink.demo',
    password: 'DonorPass@123',
    role: 'donor',
    phoneNumber: '01011111111',
    dateOfBirth: new Date('1996-03-12'),
    gender: 'female',
    bloodType: 'O+',
    isAvailable: true,
    weight: 60,
    hemoglobinLevel: 13.5,
    healthHistory: {
      chronicConditions: [],
      medications: [],
      allergies: ['Penicillin'],
      recentIllness: '',
      notes: 'Healthy demo donor for urgent blood requests.',
      lastCheckupDate: pastDate(20),
      updatedAt: now,
    },
    settings: {
      pushNotifications: true,
      emergencyAlerts: true,
      privacyMode: false,
      language: 'en',
    },
    location: {
      city: 'Cairo',
      governorate: 'Cairo',
      coordinates: { lat: 30.0444, lng: 31.2357 },
      lastUpdated: now,
    },
  },
  {
    key: 'omar',
    fullName: 'Omar Nabil',
    email: 'omar.nabil@lifelink.demo',
    password: 'DonorPass@123',
    role: 'donor',
    phoneNumber: '01022222222',
    dateOfBirth: new Date('1992-08-24'),
    gender: 'male',
    bloodType: 'A-',
    isAvailable: true,
    weight: 78,
    hemoglobinLevel: 14.4,
    healthHistory: {
      chronicConditions: [],
      medications: [],
      allergies: [],
      recentIllness: '',
      notes: 'Regular donor with upcoming booked donation.',
      lastCheckupDate: pastDate(35),
      updatedAt: now,
    },
    settings: {
      pushNotifications: true,
      emergencyAlerts: false,
      privacyMode: true,
      language: 'ar',
    },
    location: {
      city: 'Giza',
      governorate: 'Giza',
      coordinates: { lat: 29.987, lng: 31.2118 },
      lastUpdated: now,
    },
  },
  {
    key: 'mariam',
    fullName: 'Mariam Adel',
    email: 'mariam.adel@lifelink.demo',
    password: 'DonorPass@123',
    role: 'donor',
    phoneNumber: '01033333333',
    dateOfBirth: new Date('1998-11-03'),
    gender: 'female',
    bloodType: 'B+',
    isAvailable: true,
    weight: 64,
    hemoglobinLevel: 13.9,
    lastDonationDate: pastDate(90),
    healthHistory: {
      chronicConditions: [],
      medications: ['Iron supplement'],
      allergies: [],
      recentIllness: '',
      notes: 'Completed donor with points, rewards, and badge history.',
      lastCheckupDate: pastDate(50),
      updatedAt: now,
    },
    settings: {
      pushNotifications: true,
      emergencyAlerts: true,
      privacyMode: false,
      language: 'en',
    },
    location: {
      city: 'Nasr City',
      governorate: 'Cairo',
      coordinates: { lat: 30.0637, lng: 31.3303 },
      lastUpdated: now,
    },
  },
  {
    key: 'leila',
    fullName: 'Leila Mansour',
    email: 'leila.mansour@lifelink.demo',
    password: 'DonorPass@123',
    role: 'donor',
    phoneNumber: '01044444444',
    dateOfBirth: new Date('1994-06-18'),
    gender: 'female',
    bloodType: 'AB+',
    isAvailable: false,
    weight: 57,
    hemoglobinLevel: 12.8,
    healthHistory: {
      chronicConditions: [],
      medications: [],
      allergies: [],
      recentIllness: 'Recovered from a cold two weeks ago.',
      notes: 'Unavailable donor used for declined and cancelled scenarios.',
      lastCheckupDate: pastDate(15),
      updatedAt: now,
    },
    settings: {
      pushNotifications: false,
      emergencyAlerts: false,
      privacyMode: true,
      language: 'en',
    },
    location: {
      city: 'Dokki',
      governorate: 'Giza',
      coordinates: { lat: 30.0384, lng: 31.2109 },
      lastUpdated: now,
    },
  },
  {
    key: 'noor',
    fullName: 'Noor Tarek',
    email: 'noor.tarek@lifelink.demo',
    password: 'DonorPass@123',
    role: 'donor',
    phoneNumber: '01055555555',
    dateOfBirth: new Date('1997-01-27'),
    gender: 'female',
    bloodType: 'O-',
    isAvailable: true,
    weight: 62,
    hemoglobinLevel: 14.0,
    healthHistory: {
      chronicConditions: [],
      medications: [],
      allergies: ['Dust'],
      recentIllness: '',
      notes: 'Fresh donor reserved for appointment QR verification demos.',
      lastCheckupDate: pastDate(10),
      updatedAt: now,
    },
    settings: {
      pushNotifications: true,
      emergencyAlerts: true,
      privacyMode: false,
      language: 'en',
    },
    location: {
      city: 'Heliopolis',
      governorate: 'Cairo',
      coordinates: { lat: 30.091, lng: 31.3214 },
      lastUpdated: now,
    },
  },
];

const hospitalsData = [
  {
    key: 'cairoCare',
    fullName: 'Cairo Care Operations',
    email: 'ops@cairocare.demo',
    password: 'HospitalPass@123',
    role: 'hospital',
    hospitalName: 'Cairo Care Hospital',
    name: 'Cairo Care Hospital',
    licenseNumber: 'LIC-CAIRO-1001',
    contactNumber: '1044444444',
    phone: '1044444444',
    city: 'Cairo',
    state: 'Cairo',
    lat: 30.0511,
    long: 31.2435,
    bloodBanksAvailable: ['O+', 'O-', 'A+', 'A-', 'B+', 'AB+'],
    capacity: 30,
    address: { city: 'Cairo', governorate: 'Cairo', district: 'Garden City' },
    location: {
      city: 'Cairo',
      governorate: 'Cairo',
      coordinates: { lat: 30.0511, lng: 31.2435 },
      lastUpdated: now,
    },
    slotsPerHour: 5,
    workingHoursStart: 9,
    workingHoursEnd: 17,
  },
  {
    key: 'nileHope',
    fullName: 'Nile Hope Blood Bank',
    email: 'bloodbank@nilehope.demo',
    password: 'HospitalPass@123',
    role: 'hospital',
    hospitalName: 'Nile Hope Medical Center',
    name: 'Nile Hope Medical Center',
    licenseNumber: 'LIC-GIZA-1002',
    contactNumber: '1055555555',
    phone: '1055555555',
    city: 'Giza',
    state: 'Giza',
    lat: 29.9953,
    long: 31.2087,
    bloodBanksAvailable: ['O-', 'A-', 'B-', 'AB-', 'O+'],
    capacity: 24,
    address: { city: 'Giza', governorate: 'Giza', district: 'Mohandessin' },
    location: {
      city: 'Giza',
      governorate: 'Giza',
      coordinates: { lat: 29.9953, lng: 31.2087 },
      lastUpdated: now,
    },
    slotsPerHour: 6,
    workingHoursStart: 8,
    workingHoursEnd: 18,
  },
];

const helpDocuments = [
  { type: 'guidelines', title: 'Donation Guidelines', version: '1.0', documentUrl: '/docs/donation-guidelines.html' },
  { type: 'privacy', title: 'Privacy Policy', version: '1.0', documentUrl: '/docs/privacy-policy.html' },
  { type: 'terms', title: 'Terms & Conditions', version: '1.0', documentUrl: '/docs/terms-and-conditions.html' },
];

async function ensureUser(model, payload) {
  const normalizedPayload = payload.role === 'hospital' && !payload.name
    ? { ...payload, name: payload.hospitalName }
    : payload;

  const existingBase = await User.findOne({ email: normalizedPayload.email }).select('+password +adminKey');

  if (existingBase && existingBase.role !== normalizedPayload.role) {
    throw new Error(`Existing user role mismatch for ${normalizedPayload.email}: expected ${normalizedPayload.role}, found ${existingBase.role}`);
  }

  if (!existingBase) {
    return model.create({
      ...normalizedPayload,
      isEmailVerified: true,
      emailVerifiedAt: now,
      isSuspended: normalizedPayload.isSuspended || false,
      deletedAt: null,
    });
  }

  const doc = await model.findById(existingBase._id).select('+password +adminKey');
  Object.entries(normalizedPayload).forEach(([key, value]) => {
    doc[key] = value;
  });
  doc.isEmailVerified = true;
  doc.emailVerifiedAt = now;
  doc.deletedAt = null;
  await doc.save();
  return doc;
}

async function ensureAdmin(payload) {
  return ensureUser(User, payload);
}

async function ensureDocument(document) {
  return HelpDocument.findOneAndUpdate(
    { type: document.type },
    { $set: { ...document, updatedAt: now } },
    { upsert: true, returnDocument: 'after' }
  );
}

async function ensureRequest(filter, data) {
  return Request.findOneAndUpdate(filter, { $set: data }, { upsert: true, returnDocument: 'after', runValidators: true });
}

async function ensureDonation(filter, data) {
  return Donation.findOneAndUpdate(filter, { $set: data }, { upsert: true, returnDocument: 'after', runValidators: true });
}

async function ensureNotification(data) {
  return Notification.findOneAndUpdate(
    { userId: data.userId, title: data.title, 'data.demoKey': data.data?.demoKey || null },
    { $set: data },
    { upsert: true, returnDocument: 'after' }
  );
}

async function ensureSupportMessage(data) {
  return SupportMessage.findOneAndUpdate(
    { email: data.email, subject: data.subject },
    { $set: data },
    { upsert: true, returnDocument: 'after' }
  );
}

async function ensurePointsAccount(donorId, payload) {
  return DonorPoints.findOneAndUpdate(
    { donorId },
    { $set: { donorId, ...payload } },
    { upsert: true, returnDocument: 'after' }
  );
}

async function ensurePointsTransaction(payload) {
  return PointsTransaction.findOneAndUpdate(
    { donorId: payload.donorId, transactionType: payload.transactionType, referenceId: payload.referenceId },
    { $setOnInsert: payload },
    { upsert: true, returnDocument: 'after' }
  );
}

async function ensureRedemption(payload) {
  return RewardRedemption.findOneAndUpdate(
    { confirmationCode: payload.confirmationCode },
    { $set: payload },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
}

async function ensureUserBadge(payload) {
  return UserBadge.findOneAndUpdate(
    { donorId: payload.donorId, badgeId: payload.badgeId },
    { $set: payload },
    { upsert: true, returnDocument: 'after' }
  );
}

async function ensureActivity(userId, payload) {
  return Activity.findOneAndUpdate(
    { userId, action: payload.action, referenceId: payload.referenceId },
    { $set: { userId, ...payload } },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
}

async function ensureAuditLog(payload) {
  return AuditLog.findOneAndUpdate(
    {
      adminId: payload.adminId,
      action: payload.action,
      targetType: payload.targetType || null,
      targetId: payload.targetId || null,
    },
    { $set: payload },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
}

async function ensureHospitalSettings(hospitalId, payload) {
  return HospitalSettings.findOneAndUpdate(
    { hospitalId },
    { $set: { hospitalId, ...payload } },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
}

async function ensureTwoFactor(payload) {
  return TwoFactor.findOneAndUpdate(
    { userId: payload.userId },
    { $set: payload },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
}

async function ensureAppointment(filter, data) {
  return Appointment.findOneAndUpdate(filter, { $set: data }, { upsert: true, returnDocument: 'after', runValidators: true });
}

async function ensureStaff(filter, data) {
  return HospitalStaff.findOneAndUpdate(filter, { $set: data }, { upsert: true, returnDocument: 'after', runValidators: true });
}

function printCredentials() {
  console.log('');
  console.log('Demo credentials:');
  demoCredentials.forEach((entry) => {
    const adminInfo = entry.adminKey ? ` | adminKey: ${entry.adminKey}` : '';
    console.log(`- ${entry.role}: ${entry.email} / ${entry.password}${adminInfo}`);
  });
}

function printReferenceBlock(label, lines) {
  console.log('');
  console.log(label);
  lines.forEach((line) => console.log(`- ${line}`));
}

function printSnippetBlock(label, snippets) {
  console.log('');
  console.log(label);
  snippets.forEach((snippet) => {
    console.log('');
    console.log(snippet.title);
    console.log(snippet.command);
  });
}

async function main() {
  validateEnv();
  await connectDB();

  if (mongoose.connection.readyState !== 1) {
    throw new Error('Demo seed requires an active MongoDB connection.');
  }

  await seedDefaultSettings();
  await seedDefaultRolePermissions();
  await seedRewardData();

  const admin = await ensureAdmin({
    fullName: 'LifeLink Demo Admin',
    email: 'admin@lifelink.demo',
    password: 'AdminPass@123',
    role: 'admin',
    adminKey: 'ADMIN-DEMO-KEY-2026',
    location: {
      city: 'Cairo',
      governorate: 'Cairo',
      coordinates: { lat: 30.0444, lng: 31.2357 },
      lastUpdated: now,
    },
  });

  const superAdmin = await ensureAdmin({
    fullName: 'LifeLink Super Admin',
    email: 'root@lifelink.demo',
    password: 'SuperAdminPass@123',
    role: 'superadmin',
    adminKey: 'SUPERADMIN-DEMO-KEY-2026',
    location: {
      city: 'Cairo',
      governorate: 'Cairo',
      coordinates: { lat: 30.0444, lng: 31.2357 },
      lastUpdated: now,
    },
  });

  const donors = {};
  for (const donorData of donorsData) {
    const { key, ...payload } = donorData;
    const donor = await ensureUser(Donor, payload);
    donors[key] = donor;
  }

  const hospitals = {};
  for (const hospitalData of hospitalsData) {
    const { key, ...payload } = hospitalData;
    const hospital = await ensureUser(Hospital, payload);
    hospitals[key] = hospital;
  }

  for (const document of helpDocuments) {
    await ensureDocument(document);
  }

  const requests = {};
  requests.cairoCriticalBlood = await ensureRequest(
    { hospitalId: hospitals.cairoCare._id, notes: '[demo-seed] cairo-critical-o-positive' },
    {
      hospitalId: hospitals.cairoCare._id,
      type: 'blood',
      bloodType: 'O+',
      urgency: 'critical',
      status: 'pending',
      requiredBy: futureDate(2),
      quantity: 3,
      cause: 'Emergency surgery support',
      notes: '[demo-seed] cairo-critical-o-positive',
      hospitalContact: hospitals.cairoCare.contactNumber,
      hospitalLocation: hospitals.cairoCare.location.coordinates,
      hospitalName: hospitals.cairoCare.hospitalName,
    }
  );

  requests.gizaHighBlood = await ensureRequest(
    { hospitalId: hospitals.nileHope._id, notes: '[demo-seed] giza-high-a-negative' },
    {
      hospitalId: hospitals.nileHope._id,
      type: 'blood',
      bloodType: 'A-',
      urgency: 'high',
      status: 'in-progress',
      requiredBy: futureDate(3),
      quantity: 2,
      cause: 'ICU demand spike',
      notes: '[demo-seed] giza-high-a-negative',
      hospitalContact: hospitals.nileHope.contactNumber,
      hospitalLocation: hospitals.nileHope.location.coordinates,
      hospitalName: hospitals.nileHope.hospitalName,
    }
  );

  requests.cairoCompletedBlood = await ensureRequest(
    { hospitalId: hospitals.cairoCare._id, notes: '[demo-seed] cairo-completed-b-plus' },
    {
      hospitalId: hospitals.cairoCare._id,
      type: 'blood',
      bloodType: 'B+',
      urgency: 'medium',
      status: 'completed',
      requiredBy: futureDate(1),
      quantity: 1,
      cause: 'Routine ward support',
      notes: '[demo-seed] cairo-completed-b-plus',
      hospitalContact: hospitals.cairoCare.contactNumber,
      hospitalLocation: hospitals.cairoCare.location.coordinates,
      hospitalName: hospitals.cairoCare.hospitalName,
    }
  );

  requests.gizaCancelledBlood = await ensureRequest(
    { hospitalId: hospitals.nileHope._id, notes: '[demo-seed] giza-cancelled-ab-positive' },
    {
      hospitalId: hospitals.nileHope._id,
      type: 'blood',
      bloodType: 'AB+',
      urgency: 'low',
      status: 'cancelled',
      requiredBy: futureDate(4),
      quantity: 1,
      cause: 'Case resolved by transfer',
      notes: '[demo-seed] giza-cancelled-ab-positive',
      hospitalContact: hospitals.nileHope.contactNumber,
      hospitalLocation: hospitals.nileHope.location.coordinates,
      hospitalName: hospitals.nileHope.hospitalName,
    }
  );

  requests.cairoOrgan = await ensureRequest(
    { hospitalId: hospitals.cairoCare._id, notes: '[demo-seed] cairo-organ-kidney-high' },
    {
      hospitalId: hospitals.cairoCare._id,
      type: 'organ',
      organType: 'kidney',
      urgency: 'high',
      status: 'pending',
      requiredBy: futureDate(5),
      quantity: 1,
      cause: 'Urgent transplant waiting list',
      notes: '[demo-seed] cairo-organ-kidney-high',
      hospitalContact: hospitals.cairoCare.contactNumber,
      hospitalLocation: hospitals.cairoCare.location.coordinates,
      hospitalName: hospitals.cairoCare.hospitalName,
    }
  );

  requests.gizaOminus = await ensureRequest(
    { hospitalId: hospitals.nileHope._id, notes: '[demo-seed] giza-medium-o-negative' },
    {
      hospitalId: hospitals.nileHope._id,
      type: 'blood',
      bloodType: 'O-',
      urgency: 'medium',
      status: 'pending',
      requiredBy: futureDate(6),
      quantity: 2,
      cause: 'NICU reserve replenishment',
      notes: '[demo-seed] giza-medium-o-negative',
      hospitalContact: hospitals.nileHope.contactNumber,
      hospitalLocation: hospitals.nileHope.location.coordinates,
      hospitalName: hospitals.nileHope.hospitalName,
    }
  );

  requests.cairoPlasma = await ensureRequest(
    { hospitalId: hospitals.cairoCare._id, notes: '[demo-seed] cairo-critical-plasma' },
    {
      hospitalId: hospitals.cairoCare._id,
      type: 'plasma',
      bloodType: 'AB+',
      urgency: 'critical',
      status: 'pending',
      requiredBy: futureDate(1),
      quantity: 5,
      cause: 'Trauma patient requiring urgent plasma transfusion',
      notes: '[demo-seed] cairo-critical-plasma',
      hospitalContact: hospitals.cairoCare.contactNumber,
      hospitalLocation: hospitals.cairoCare.location.coordinates,
      hospitalName: hospitals.cairoCare.hospitalName,
    }
  );

  requests.gizaPlatelets = await ensureRequest(
    { hospitalId: hospitals.nileHope._id, notes: '[demo-seed] giza-high-platelets' },
    {
      hospitalId: hospitals.nileHope._id,
      type: 'platelets',
      bloodType: 'O+',
      urgency: 'high',
      status: 'in-progress',
      requiredBy: futureDate(2),
      quantity: 3,
      cause: 'Cancer patient undergoing chemotherapy',
      notes: '[demo-seed] giza-high-platelets',
      hospitalContact: hospitals.nileHope.contactNumber,
      hospitalLocation: hospitals.nileHope.location.coordinates,
      hospitalName: hospitals.nileHope.hospitalName,
    }
  );

  const donations = {};
  donations.ayaPending = await ensureDonation(
    { donorId: donors.aya._id, requestId: requests.cairoCriticalBlood._id, status: 'pending' },
    {
      donorId: donors.aya._id,
      requestId: requests.cairoCriticalBlood._id,
      status: 'pending',
      quantity: 1,
      notes: 'Confirmed availability for urgent O+ request.',
    }
  );

  donations.omarScheduled = await ensureDonation(
    { donorId: donors.omar._id, requestId: requests.gizaHighBlood._id, status: 'scheduled' },
    {
      donorId: donors.omar._id,
      requestId: requests.gizaHighBlood._id,
      status: 'scheduled',
      quantity: 1,
      scheduledDate: futureDate(1, 11),
      notes: 'Scheduled for tomorrow morning.',
    }
  );

  donations.mariamCompleted = await ensureDonation(
    { donorId: donors.mariam._id, requestId: requests.cairoCompletedBlood._id, status: 'completed' },
    {
      donorId: donors.mariam._id,
      requestId: requests.cairoCompletedBlood._id,
      status: 'completed',
      quantity: 1,
      completedDate: pastDate(5),
      notes: 'Completed donation used for rewards and history.',
    }
  );

  donations.leilaDeclined = await ensureDonation(
    { donorId: donors.leila._id, requestId: requests.cairoOrgan._id, status: 'cancelled' },
    {
      donorId: donors.leila._id,
      requestId: requests.cairoOrgan._id,
      status: 'cancelled',
      quantity: 1,
      notes: 'Declined urgent request due to temporary unavailability.',
    }
  );

  donations.noorRejected = await ensureDonation(
    { donorId: donors.noor._id, requestId: requests.gizaOminus._id, status: 'rejected' },
    {
      donorId: donors.noor._id,
      requestId: requests.gizaOminus._id,
      status: 'rejected',
      quantity: 1,
      notes: 'Hospital rejected after duplicate offline booking.',
    }
  );

  donations.leilaCancelled = await ensureDonation(
    { donorId: donors.leila._id, requestId: requests.gizaCancelledBlood._id, status: 'cancelled' },
    {
      donorId: donors.leila._id,
      requestId: requests.gizaCancelledBlood._id,
      status: 'cancelled',
      quantity: 1,
      notes: 'Auto-cancelled because request was resolved elsewhere.',
    }
  );

  donations.mariam_plasma_completed = await ensureDonation(
    { donorId: donors.mariam._id, requestId: requests.cairoPlasma._id, status: 'completed' },
    {
      donorId: donors.mariam._id,
      requestId: requests.cairoPlasma._id,
      status: 'completed',
      quantity: 1,
      completedDate: pastDate(3),
      notes: 'Plasma donation for trauma patient - critical urgency.',
    }
  );

  donations.leila_platelets_pending = await ensureDonation(
    { donorId: donors.leila._id, requestId: requests.gizaPlatelets._id, status: 'pending' },
    {
      donorId: donors.leila._id,
      requestId: requests.gizaPlatelets._id,
      status: 'pending',
      quantity: 1,
      notes: 'Platelets donation for cancer patient support.',
    }
  );

  const appointments = {};
  appointments.ayaUrgent = await ensureAppointment(
    { donorId: donors.aya._id, notes: '[demo-seed] appointment-aya-urgent' },
    {
      donorId: donors.aya._id,
      hospitalId: hospitals.cairoCare._id,
      requestId: requests.cairoCriticalBlood._id,
      appointmentDate: futureDate(3, 10),
      status: 'pending',
      notes: '[demo-seed] appointment-aya-urgent',
      qrToken: 'demo-qr-aya-critical',
      qrExpiresAt: futureDate(4, 10),
      donationType: 'Whole Blood',
    }
  );

  appointments.omarScheduled = await ensureAppointment(
    { donorId: donors.omar._id, notes: '[demo-seed] appointment-omar-request' },
    {
      donorId: donors.omar._id,
      hospitalId: hospitals.nileHope._id,
      requestId: requests.gizaHighBlood._id,
      appointmentDate: futureDate(4, 9),
      status: 'confirmed',
      notes: '[demo-seed] appointment-omar-request',
      qrToken: 'demo-qr-omar-request',
      qrExpiresAt: futureDate(5, 9),
      donationType: 'Platelets',
    }
  );

  appointments.noorVerify = await ensureAppointment(
    { donorId: donors.noor._id, notes: '[demo-seed] appointment-noor-verify' },
    {
      donorId: donors.noor._id,
      hospitalId: hospitals.cairoCare._id,
      requestId: null,
      appointmentDate: futureDate(2, 12),
      status: 'confirmed',
      notes: '[demo-seed] appointment-noor-verify',
      qrToken: 'demo-qr-noor-verify',
      qrExpiresAt: futureDate(3, 12),
      donationType: 'Plasma',
    }
  );

  appointments.leilaCancelled = await ensureAppointment(
    { donorId: donors.leila._id, notes: '[demo-seed] appointment-leila-cancelled' },
    {
      donorId: donors.leila._id,
      hospitalId: hospitals.nileHope._id,
      requestId: requests.gizaCancelledBlood._id,
      appointmentDate: futureDate(5, 14),
      status: 'cancelled',
      notes: '[demo-seed] appointment-leila-cancelled',
      cancelledAt: pastDate(1),
      qrToken: 'demo-qr-leila-cancelled',
      qrExpiresAt: futureDate(6, 14),
      donationType: 'Whole Blood',
    }
  );

  await ensureStaff(
    { hospitalId: hospitals.cairoCare._id, name: 'Sara Fawzy' },
    {
      hospitalId: hospitals.cairoCare._id,
      name: 'Sara Fawzy',
      position: 'PHLEBOTOMIST',
      status: 'ON_DUTY',
      phone: '01170000001',
      shiftStart: '09:00',
      shiftEnd: '17:00',
    }
  );

  await ensureStaff(
    { hospitalId: hospitals.cairoCare._id, name: 'Ahmed Samir' },
    {
      hospitalId: hospitals.cairoCare._id,
      name: 'Ahmed Samir',
      position: 'DOCTOR',
      status: 'AVAILABLE',
      phone: '01170000002',
      shiftStart: '10:00',
      shiftEnd: '18:00',
    }
  );

  await ensureStaff(
    { hospitalId: hospitals.nileHope._id, name: 'Mona Hany' },
    {
      hospitalId: hospitals.nileHope._id,
      name: 'Mona Hany',
      position: 'NURSE',
      status: 'ON_DUTY',
      phone: '01180000001',
      shiftStart: '08:00',
      shiftEnd: '16:00',
    }
  );

  await ensureStaff(
    { hospitalId: hospitals.nileHope._id, name: 'Khaled Adel' },
    {
      hospitalId: hospitals.nileHope._id,
      name: 'Khaled Adel',
      position: 'PHLEBOTOMIST',
      status: 'OFF_DUTY',
      phone: '01180000002',
      shiftStart: '12:00',
      shiftEnd: '20:00',
    }
  );

  await ensureNotification({
    userId: donors.aya._id,
    type: 'request',
    title: 'Urgent O+ Request Nearby',
    message: 'Cairo Care Hospital needs O+ blood donors for an urgent case.',
    relatedId: requests.cairoCriticalBlood._id,
    relatedType: 'Request',
    data: { demoKey: 'notif_aya_urgent_request', requestId: requests.cairoCriticalBlood._id.toString() },
    read: false,
  });

  await ensureNotification({
    userId: donors.omar._id,
    type: 'system',
    title: 'Appointment Confirmed',
    message: 'Your Nile Hope donation appointment is confirmed.',
    relatedId: appointments.omarScheduled._id,
    relatedType: 'Appointment',
    data: { demoKey: 'notif_omar_appointment', appointmentId: appointments.omarScheduled._id.toString() },
    read: false,
  });

  await ensureNotification({
    userId: donors.mariam._id,
    type: 'milestone',
    title: 'Reward Ready To Redeem',
    message: 'You have enough points to redeem a Coffee Voucher.',
    data: { demoKey: 'notif_mariam_reward_ready' },
    read: false,
  });

  await ensureNotification({
    userId: hospitals.cairoCare._id,
    type: 'admin',
    title: 'Demo Dashboard Ready',
    message: 'Your seeded hospital requests, appointments, and donation data are ready.',
    data: { demoKey: 'notif_hospital_dashboard' },
    read: false,
  });

  await ensureSupportMessage({
    userId: donors.aya._id,
    email: donors.aya.email,
    role: 'donor',
    subject: 'Need help with reward redemption',
    message: 'I can see my points balance but I want to confirm when the Coffee Voucher becomes available.',
    attachmentUrls: [],
    status: 'OPEN',
  });

  await ensureSupportMessage({
    userId: hospitals.cairoCare._id,
    email: hospitals.cairoCare.email,
    role: 'hospital',
    subject: 'Nearby donors list check',
    message: 'Please confirm our updated coordinates are reflected in nearby discovery results.',
    attachmentUrls: [],
    status: 'REVIEWED',
  });

  await ensureSupportMessage({
    userId: donors.noor._id,
    email: donors.noor.email,
    role: 'donor',
    subject: 'QR verification question',
    message: 'Can I use the same QR code twice if my first check-in fails?',
    attachmentUrls: [],
    status: 'REVIEWED',
  });

  const coffeeVoucher = await RewardCatalog.findOne({ name: 'Coffee Voucher' });
  const firstTimerBadge = await Badge.findOne({ badgeName: 'First Timer' });

  await ensurePointsAccount(donors.aya._id, {
    pointsBalance: 850,
    lifetimePointsEarned: 950,
    tier: 'bronze',
    profileCompletionAwarded: true,
    firstDonationAwarded: true,
  });

  await ensurePointsAccount(donors.omar._id, {
    pointsBalance: 1600,
    lifetimePointsEarned: 1750,
    tier: 'silver',
    profileCompletionAwarded: true,
    firstDonationAwarded: true,
  });

  await ensurePointsAccount(donors.mariam._id, {
    pointsBalance: 850,
    lifetimePointsEarned: 1350,
    tier: 'silver',
    profileCompletionAwarded: true,
    firstDonationAwarded: true,
  });

  await ensurePointsAccount(donors.noor._id, {
    pointsBalance: 200,
    lifetimePointsEarned: 200,
    tier: 'bronze',
    profileCompletionAwarded: true,
    firstDonationAwarded: false,
  });

  await ensurePointsTransaction({
    donorId: donors.mariam._id,
    pointsAmount: 50,
    transactionType: 'PROFILE_COMPLETION',
    description: 'Profile completed',
    referenceId: 'demo_profile_mariam',
    balanceAfter: 50,
  });

  await ensurePointsTransaction({
    donorId: donors.mariam._id,
    pointsAmount: 200,
    transactionType: 'BLOOD_DONATION',
    description: 'Completed donation',
    referenceId: 'donation_' + donations.mariamCompleted._id.toString(),
    balanceAfter: 250,
  });

  await ensurePointsTransaction({
    donorId: donors.mariam._id,
    pointsAmount: 100,
    transactionType: 'FIRST_DONATION',
    description: 'First donation bonus',
    referenceId: 'demo_first_donation_mariam',
    balanceAfter: 350,
  });

  await ensurePointsTransaction({
    donorId: donors.mariam._id,
    pointsAmount: 1000,
    transactionType: 'ADMIN_ADJUSTMENT',
    description: 'Demo bonus points for rewards showcase',
    referenceId: 'demo_bonus_mariam',
    balanceAfter: 1350,
  });

  await ensurePointsTransaction({
    donorId: donors.noor._id,
    pointsAmount: 200,
    transactionType: 'PROFILE_COMPLETION',
    description: 'Profile completed',
    referenceId: 'demo_profile_noor',
    balanceAfter: 200,
  });

  if (coffeeVoucher) {
    await ensureRedemption({
      donorId: donors.mariam._id,
      rewardId: coffeeVoucher._id,
      pointsSpent: coffeeVoucher.pointsCost,
      confirmationCode: 'RWD-2026-DEMO01',
      status: 'CONFIRMED',
      deliveryMethod: 'IN_APP',
      deliveryContact: null,
      expiresAt: futureDate(30),
    });

    await ensurePointsTransaction({
      donorId: donors.mariam._id,
      pointsAmount: -coffeeVoucher.pointsCost,
      transactionType: 'REWARD_REDEEMED',
      description: `Reward redeemed: ${coffeeVoucher.name}`,
      referenceId: 'demo_redemption_mariam',
      balanceAfter: 850,
    });
  }

  if (firstTimerBadge) {
    await ensureUserBadge({
      donorId: donors.mariam._id,
      badgeId: firstTimerBadge._id,
      unlockStatus: 'UNLOCKED',
      progressCurrent: 1,
      progressTarget: 1,
      unlockedAt: pastDate(5),
    });
  }

  await ensureActivity(donors.aya._id, {
    type: 'profile_update',
    action: 'profile_completed',
    title: 'Profile Completed',
    description: 'Aya Hassan completed her donor profile and enabled donation alerts.',
    referenceId: 'activity_profile_aya_hassan',
    referenceType: 'User',
    icon: 'user-check',
    metadata: {
      completedFields: ['phoneNumber', 'location', 'availability', 'healthHistory'],
    },
  });

  await ensureActivity(donors.omar._id, {
    type: 'emergency_response',
    action: 'responded_to_urgent_request',
    title: 'Urgent Request Accepted',
    description: 'Omar Nabil responded to a high-priority A- request for ICU support.',
    referenceId: `activity_request_${requests.gizaHighBlood._id}`,
    referenceType: 'Request',
    icon: 'zap',
    metadata: {
      requestId: requests.gizaHighBlood._id.toString(),
      bloodType: 'A-',
      urgency: 'high',
    },
  });

  await ensureActivity(donors.mariam._id, {
    type: 'donation',
    action: 'completed_donation',
    title: 'Blood Donation Completed',
    description: 'Mariam Adel completed a B+ donation for routine ward support.',
    referenceId: donations.mariamCompleted._id.toString(),
    referenceType: 'Donation',
    icon: 'heart',
    metadata: {
      requestId: requests.cairoCompletedBlood._id.toString(),
      bloodType: 'B+',
      quantity: 1,
    },
  });

  await ensureActivity(donors.leila._id, {
    type: 'emergency_response',
    action: 'declined_urgent_request',
    title: 'Urgent Request Declined',
    description: 'Leila Mansour declined the emergency kidney request while unavailable.',
    referenceId: donations.leilaDeclined._id.toString(),
    referenceType: 'Donation',
    icon: 'x-circle',
    metadata: {
      requestId: requests.cairoOrgan._id.toString(),
      urgency: 'high',
    },
  });

  if (coffeeVoucher) {
    await ensureActivity(donors.mariam._id, {
      type: 'reward',
      action: 'reward_redeemed',
      title: 'Reward Redeemed',
      description: 'Mariam Adel redeemed the Coffee Voucher reward.',
      referenceId: 'activity_reward_mariam_coffee',
      referenceType: 'RewardRedemption',
      icon: 'gift',
      metadata: {
        rewardName: coffeeVoucher.name,
        pointsSpent: coffeeVoucher.pointsCost,
        confirmationCode: 'RWD-2026-DEMO01',
      },
    });
  }

  if (firstTimerBadge) {
    await ensureActivity(donors.mariam._id, {
      type: 'reward',
      action: 'badge_unlocked',
      title: 'Badge Unlocked',
      description: 'Mariam Adel unlocked the First Timer badge.',
      referenceId: `activity_badge_${firstTimerBadge._id}`,
      referenceType: 'Badge',
      icon: 'award',
      metadata: {
        badgeName: firstTimerBadge.badgeName,
        category: firstTimerBadge.category,
      },
    });
  }

  await ensureAuditLog({
    adminId: admin._id,
    action: 'user.verify',
    targetType: 'User',
    targetId: donors.aya._id,
  });

  await ensureAuditLog({
    adminId: admin._id,
    action: 'request.fulfill',
    targetType: 'Request',
    targetId: requests.cairoCompletedBlood._id,
  });

  await ensureAuditLog({
    adminId: superAdmin._id,
    action: 'request.broadcast',
    targetType: 'Request',
    targetId: requests.cairoCriticalBlood._id,
  });

  await ensureAuditLog({
    adminId: superAdmin._id,
    action: 'system.maintenance',
    targetType: 'System',
    targetId: null,
  });

  await ensureTwoFactor({
    userId: admin._id,
    enabled: true,
    secret: 'JBSWY3DPEHPK3PXP',
    backupCodes: ['LL-DEMO-1', 'LL-DEMO-2', 'LL-DEMO-3', 'LL-DEMO-4'],
    verifiedAt: pastDate(1),
    disabledAt: null,
    pendingSecret: null,
    pendingBackupCodes: [],
  });

  await ensureHospitalSettings(hospitals.cairoCare._id, {
    bloodBankSettings: {
      criticalThreshold: { 'O+': 4, 'A-': 2, 'O-': 2 },
      lowThreshold: { 'O+': 12, 'A-': 8, 'O-': 5 },
      automaticNotifications: true,
      notificationEmail: 'ops@cairocare.demo',
    },
    notificationPreferences: {
      email: true,
      push: true,
      sms: false,
    },
  });

  await ensureHospitalSettings(hospitals.nileHope._id, {
    bloodBankSettings: {
      criticalThreshold: { 'B+': 3, 'A-': 2, 'O-': 2 },
      lowThreshold: { 'B+': 10, 'A-': 7, 'O-': 5 },
      automaticNotifications: true,
      notificationEmail: 'bloodbank@nilehope.demo',
    },
    notificationPreferences: {
      email: true,
      push: true,
      sms: true,
    },
  });

  console.log('');
  console.log('LifeLink demo seed completed successfully.');
  printCredentials();

  printReferenceBlock('Seeded demo coverage:', [
    '5 donors with varied blood types, availability, settings, health history, points, and activity',
    '2 hospitals with discovery-ready coordinates, slot configuration, blood bank settings, and staff',
    '6 requests covering blood + organ and pending/in-progress/completed/cancelled states',
    '6 donations covering pending/scheduled/completed/cancelled/rejected states',
    '4 appointments covering pending/confirmed/cancelled and QR verification flows',
    'Notifications, rewards, badges, support messages, audit logs, and 2FA seed data',
  ]);

  printReferenceBlock('Key request IDs for manual API testing:', [
    `critical blood request: ${requests.cairoCriticalBlood._id}`,
    `high blood request: ${requests.gizaHighBlood._id}`,
    `completed blood request: ${requests.cairoCompletedBlood._id}`,
    `cancelled blood request: ${requests.gizaCancelledBlood._id}`,
    `organ request: ${requests.cairoOrgan._id}`,
    `pending O- request: ${requests.gizaOminus._id}`,
  ]);

  printReferenceBlock('Key appointment / QR tokens:', [
    `aya pending request-linked appointment: ${appointments.ayaUrgent._id} | qrToken: demo-qr-aya-critical`,
    `omar confirmed request-linked appointment: ${appointments.omarScheduled._id} | qrToken: demo-qr-omar-request`,
    `noor standalone verification appointment: ${appointments.noorVerify._id} | qrToken: demo-qr-noor-verify`,
    `leila cancelled appointment: ${appointments.leilaCancelled._id} | qrToken: demo-qr-leila-cancelled`,
  ]);

  printReferenceBlock('Useful IDs for role-specific endpoints:', [
    `Aya donorId: ${donors.aya._id}`,
    `Omar donorId: ${donors.omar._id}`,
    `Mariam donorId: ${donors.mariam._id}`,
    `Cairo Care hospitalId: ${hospitals.cairoCare._id}`,
    `Nile Hope hospitalId: ${hospitals.nileHope._id}`,
    `Mariam completed donationId: ${donations.mariamCompleted._id}`,
  ]);

  printSnippetBlock('Quick test snippets:', [
    {
      title: 'Donor login',
      command: `curl -X POST ${demoBaseUrl}/auth/login -H "Content-Type: application/json" -d "{\\"email\\":\\"aya.hassan@lifelink.demo\\",\\"password\\":\\"DonorPass@123\\"}"`,
    },
    {
      title: 'Hospital login',
      command: `curl -X POST ${demoBaseUrl}/auth/hospital/login -H "Content-Type: application/json" -d "{\\"email\\":\\"ops@cairocare.demo\\",\\"password\\":\\"HospitalPass@123\\"}"`,
    },
    {
      title: 'Admin login',
      command: `curl -X POST ${demoBaseUrl}/auth/admin/login -H "Content-Type: application/json" -d "{\\"email\\":\\"admin@lifelink.demo\\",\\"password\\":\\"AdminPass@123\\",\\"adminKey\\":\\"ADMIN-DEMO-KEY-2026\\"}"`,
    },
    {
      title: 'Donor requests feed after login',
      command: `curl ${demoBaseUrl}/donor/requests -H "Authorization: Bearer <DONOR_ACCESS_TOKEN>"`,
    },
    {
      title: 'Hospital request details',
      command: `curl ${demoBaseUrl}/hospital/requests/${requests.gizaHighBlood._id} -H "Authorization: Bearer <HOSPITAL_ACCESS_TOKEN>"`,
    },
    {
      title: 'Admin request details',
      command: `curl ${demoBaseUrl}/admin/requests/${requests.cairoCriticalBlood._id} -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>"`,
    },
    {
      title: 'QR verification demo',
      command: `curl -X POST ${demoBaseUrl}/appointments/verify-qr -H "Authorization: Bearer <HOSPITAL_ACCESS_TOKEN>" -H "Content-Type: application/json" -d "{\\"qrToken\\":\\"demo-qr-noor-verify\\"}"`,
    },
    {
      title: 'Appointment slots demo',
      command: `curl "${demoBaseUrl}/appointments/available-slots?hospitalId=${hospitals.cairoCare._id}&date=${futureDate(3, 10).toISOString().slice(0, 10)}" -H "Authorization: Bearer <DONOR_ACCESS_TOKEN>"`,
    },
  ]);

  console.log('');
  console.log('FAQ content is served by the help controller and does not require database seeding.');
}

try {
  await main();
} catch (error) {
  console.error('Demo seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
