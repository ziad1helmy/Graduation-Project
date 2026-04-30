import mongoose from 'mongoose';
import { validateEnv } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.model.js';
import Donor from '../src/models/Donor.model.js';
import Hospital from '../src/models/Hospital.model.js';
import Request from '../src/models/Request.model.js';
import Donation from '../src/models/Donation.model.js';
import Notification from '../src/models/Notification.model.js';
import HelpDocument from '../src/models/HelpDocument.model.js';
import SupportMessage from '../src/models/SupportMessage.model.js';
import DonorPoints from '../src/models/DonorPoints.model.js';
import PointsTransaction from '../src/models/PointsTransaction.model.js';
import RewardCatalog from '../src/models/RewardCatalog.model.js';
import RewardRedemption from '../src/models/RewardRedemption.model.js';
import Badge from '../src/models/Badge.model.js';
import UserBadge from '../src/models/UserBadge.model.js';
import { seedDefaultSettings, seedDefaultRolePermissions } from '../src/services/admin.service.js';
import { seedRewardData } from '../src/services/reward.service.js';

const now = new Date();
const futureDate = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const pastDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const demoCredentials = [
  { role: 'admin', email: 'admin@lifelink.demo', password: 'AdminPass@123' },
  { role: 'superadmin', email: 'root@lifelink.demo', password: 'SuperAdminPass@123' },
  { role: 'donor', email: 'aya.hassan@lifelink.demo', password: 'DonorPass@123' },
  { role: 'donor', email: 'omar.nabil@lifelink.demo', password: 'DonorPass@123' },
  { role: 'donor', email: 'mariam.adel@lifelink.demo', password: 'DonorPass@123' },
  { role: 'hospital', email: 'ops@cairocare.demo', password: 'HospitalPass@123' },
  { role: 'hospital', email: 'bloodbank@nilehope.demo', password: 'HospitalPass@123' },
];

const donorsData = [
  {
    fullName: 'Aya Hassan',
    email: 'aya.hassan@lifelink.demo',
    password: 'DonorPass@123',
    role: 'donor',
    phoneNumber: '1011111111',
    dateOfBirth: new Date('1996-03-12'),
    gender: 'female',
    bloodType: 'O+',
    isAvailable: true,
    location: {
      city: 'Cairo',
      governorate: 'Cairo',
      coordinates: { lat: 30.0444, lng: 31.2357 },
      lastUpdated: now,
    },
  },
  {
    fullName: 'Omar Nabil',
    email: 'omar.nabil@lifelink.demo',
    password: 'DonorPass@123',
    role: 'donor',
    phoneNumber: '1022222222',
    dateOfBirth: new Date('1992-08-24'),
    gender: 'male',
    bloodType: 'A-',
    isAvailable: true,
    location: {
      city: 'Giza',
      governorate: 'Giza',
      coordinates: { lat: 29.987, lng: 31.2118 },
      lastUpdated: now,
    },
  },
  {
    fullName: 'Mariam Adel',
    email: 'mariam.adel@lifelink.demo',
    password: 'DonorPass@123',
    role: 'donor',
    phoneNumber: '1033333333',
    dateOfBirth: new Date('1998-11-03'),
    gender: 'female',
    bloodType: 'B+',
    isAvailable: true,
    location: {
      city: 'Nasr City',
      governorate: 'Cairo',
      coordinates: { lat: 30.0637, lng: 31.3303 },
      lastUpdated: now,
    },
  },
];

const hospitalsData = [
  {
    fullName: 'Cairo Care Operations',
    email: 'ops@cairocare.demo',
    password: 'HospitalPass@123',
    role: 'hospital',
    hospitalName: 'Cairo Care Hospital',
    hospitalId: 1001,
    licenseNumber: 'LIC-CAIRO-1001',
    contactNumber: '1044444444',
    address: { city: 'Cairo', governorate: 'Cairo' },
    location: {
      city: 'Cairo',
      governorate: 'Cairo',
      coordinates: { lat: 30.0511, lng: 31.2435 },
      lastUpdated: now,
    },
  },
  {
    fullName: 'Nile Hope Blood Bank',
    email: 'bloodbank@nilehope.demo',
    password: 'HospitalPass@123',
    role: 'hospital',
    hospitalName: 'Nile Hope Medical Center',
    hospitalId: 1002,
    licenseNumber: 'LIC-GIZA-1002',
    contactNumber: '1055555555',
    address: { city: 'Giza', governorate: 'Giza' },
    location: {
      city: 'Giza',
      governorate: 'Giza',
      coordinates: { lat: 29.9953, lng: 31.2087 },
      lastUpdated: now,
    },
  },
];

const helpDocuments = [
  { type: 'guidelines', title: 'Donation Guidelines', version: '1.0', documentUrl: '/docs/donation-guidelines.html' },
  { type: 'privacy', title: 'Privacy Policy', version: '1.0', documentUrl: '/docs/privacy-policy.html' },
  { type: 'terms', title: 'Terms & Conditions', version: '1.0', documentUrl: '/docs/terms-and-conditions.html' },
];

async function ensureUser(model, payload) {
  const existingBase = await User.findOne({ email: payload.email }).select('+password');

  if (existingBase && existingBase.role !== payload.role) {
    throw new Error(`Existing user role mismatch for ${payload.email}: expected ${payload.role}, found ${existingBase.role}`);
  }

  if (!existingBase) {
    return model.create({
      ...payload,
      isEmailVerified: true,
      emailVerifiedAt: now,
      isSuspended: false,
      deletedAt: null,
    });
  }

  const doc = await model.findById(existingBase._id).select('+password');
  Object.entries(payload).forEach(([key, value]) => {
    doc[key] = value;
  });
  doc.isEmailVerified = true;
  doc.emailVerifiedAt = now;
  doc.isSuspended = false;
  doc.deletedAt = null;
  doc.password = payload.password;
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
    { upsert: true, new: true }
  );
}

async function ensureRequest(filter, data) {
  return Request.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true, runValidators: true });
}

async function ensureDonation(filter, data) {
  return Donation.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true, runValidators: true });
}

async function ensureNotification(data) {
  return Notification.findOneAndUpdate(
    { userId: data.userId, title: data.title, 'data.demoKey': data.data?.demoKey || null },
    { $set: data },
    { upsert: true, new: true }
  );
}

async function ensureSupportMessage(data) {
  return SupportMessage.findOneAndUpdate(
    { email: data.email, subject: data.subject },
    { $set: data },
    { upsert: true, new: true }
  );
}

async function ensurePointsAccount(donorId, payload) {
  return DonorPoints.findOneAndUpdate(
    { donorId },
    { $set: { donorId, ...payload } },
    { upsert: true, new: true }
  );
}

async function ensurePointsTransaction(payload) {
  return PointsTransaction.findOneAndUpdate(
    { donorId: payload.donorId, transactionType: payload.transactionType, referenceId: payload.referenceId },
    { $setOnInsert: payload },
    { upsert: true, new: true }
  );
}

async function ensureRedemption(payload) {
  return RewardRedemption.findOneAndUpdate(
    { confirmationCode: payload.confirmationCode },
    { $set: payload },
    { upsert: true, new: true, runValidators: true }
  );
}

async function ensureUserBadge(payload) {
  return UserBadge.findOneAndUpdate(
    { donorId: payload.donorId, badgeId: payload.badgeId },
    { $set: payload },
    { upsert: true, new: true }
  );
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
    location: {
      city: 'Cairo',
      governorate: 'Cairo',
      coordinates: { lat: 30.0444, lng: 31.2357 },
      lastUpdated: now,
    },
  });

  await ensureAdmin({
    fullName: 'LifeLink Super Admin',
    email: 'root@lifelink.demo',
    password: 'SuperAdminPass@123',
    role: 'superadmin',
    location: {
      city: 'Cairo',
      governorate: 'Cairo',
      coordinates: { lat: 30.0444, lng: 31.2357 },
      lastUpdated: now,
    },
  });

  const donors = {};
  for (const donorData of donorsData) {
    const donor = await ensureUser(Donor, donorData);
    donors[donor.email] = donor;
  }

  const hospitals = {};
  for (const hospitalData of hospitalsData) {
    const hospital = await ensureUser(Hospital, hospitalData);
    hospitals[hospital.email] = hospital;
  }

  for (const document of helpDocuments) {
    await ensureDocument(document);
  }

  const cairoUrgentRequest = await ensureRequest(
    { hospitalId: hospitals['ops@cairocare.demo']._id, notes: '[demo-seed] cairo-o-positive-critical' },
    {
      hospitalId: hospitals['ops@cairocare.demo']._id,
      type: 'blood',
      bloodType: 'O+',
      urgency: 'critical',
      status: 'pending',
      requiredBy: futureDate(2),
      quantity: 3,
      cause: 'Emergency surgery support',
      notes: '[demo-seed] cairo-o-positive-critical',
      hospitalContact: '1044444444',
    }
  );

  const gizaActiveRequest = await ensureRequest(
    { hospitalId: hospitals['bloodbank@nilehope.demo']._id, notes: '[demo-seed] giza-a-negative-high' },
    {
      hospitalId: hospitals['bloodbank@nilehope.demo']._id,
      type: 'blood',
      bloodType: 'A-',
      urgency: 'high',
      status: 'in-progress',
      requiredBy: futureDate(3),
      quantity: 2,
      cause: 'ICU demand spike',
      notes: '[demo-seed] giza-a-negative-high',
      hospitalContact: '1055555555',
    }
  );

  const completedRequest = await ensureRequest(
    { hospitalId: hospitals['ops@cairocare.demo']._id, notes: '[demo-seed] completed-b-plus-medium' },
    {
      hospitalId: hospitals['ops@cairocare.demo']._id,
      type: 'blood',
      bloodType: 'B+',
      urgency: 'medium',
      status: 'completed',
      requiredBy: futureDate(1),
      quantity: 1,
      cause: 'Routine ward support',
      notes: '[demo-seed] completed-b-plus-medium',
      hospitalContact: '1044444444',
    }
  );

  await ensureDonation(
    { donorId: donors['aya.hassan@lifelink.demo']._id, requestId: cairoUrgentRequest._id, status: 'pending' },
    {
      donorId: donors['aya.hassan@lifelink.demo']._id,
      requestId: cairoUrgentRequest._id,
      status: 'pending',
      quantity: 1,
      notes: 'Confirmed availability for urgent demo request.',
    }
  );

  await ensureDonation(
    { donorId: donors['omar.nabil@lifelink.demo']._id, requestId: gizaActiveRequest._id, status: 'scheduled' },
    {
      donorId: donors['omar.nabil@lifelink.demo']._id,
      requestId: gizaActiveRequest._id,
      status: 'scheduled',
      quantity: 1,
      scheduledDate: futureDate(1),
      notes: 'Scheduled for tomorrow morning.',
    }
  );

  await ensureDonation(
    { donorId: donors['mariam.adel@lifelink.demo']._id, requestId: completedRequest._id, status: 'completed' },
    {
      donorId: donors['mariam.adel@lifelink.demo']._id,
      requestId: completedRequest._id,
      status: 'completed',
      quantity: 1,
      completedDate: pastDate(5),
      notes: 'Completed donation used for seeded history and rewards.',
    }
  );

  await ensureNotification({
    userId: donors['aya.hassan@lifelink.demo']._id,
    type: 'request',
    title: 'Urgent O+ Request Nearby',
    message: 'Cairo Care Hospital needs O+ blood donors for an urgent case.',
    relatedId: cairoUrgentRequest._id,
    relatedType: 'Request',
    data: { demoKey: 'notif_urgent_request_aya', requestId: cairoUrgentRequest._id.toString() },
    read: false,
  });

  await ensureNotification({
    userId: donors['mariam.adel@lifelink.demo']._id,
    type: 'system',
    title: 'Reward Ready To Redeem',
    message: 'You have enough points to redeem a Coffee Voucher.',
    data: { demoKey: 'notif_rewards_mariam' },
    read: false,
  });

  await ensureNotification({
    userId: hospitals['ops@cairocare.demo']._id,
    type: 'admin',
    title: 'Demo Dashboard Ready',
    message: 'Your seeded hospital requests and donation data are ready for the demo.',
    data: { demoKey: 'notif_hospital_dashboard' },
    read: false,
  });

  await ensureSupportMessage({
    userId: donors['aya.hassan@lifelink.demo']._id,
    email: 'aya.hassan@lifelink.demo',
    role: 'donor',
    subject: 'Need help with reward redemption',
    message: 'I can see my points balance but I want to confirm when the Coffee Voucher becomes available.',
    attachmentUrls: [],
    status: 'OPEN',
  });

  await ensureSupportMessage({
    userId: hospitals['ops@cairocare.demo']._id,
    email: 'ops@cairocare.demo',
    role: 'hospital',
    subject: 'Nearby donors list check',
    message: 'Please confirm our updated hospital coordinates are reflected in nearby discovery results.',
    attachmentUrls: [],
    status: 'REVIEWED',
  });

  const coffeeVoucher = await RewardCatalog.findOne({ name: 'Coffee Voucher' });
  const firstTimerBadge = await Badge.findOne({ badgeName: 'First Timer' });

  await ensurePointsAccount(donors['aya.hassan@lifelink.demo']._id, {
    pointsBalance: 850,
    lifetimePointsEarned: 950,
    tier: 'bronze',
    profileCompletionAwarded: true,
    firstDonationAwarded: true,
  });

  await ensurePointsAccount(donors['omar.nabil@lifelink.demo']._id, {
    pointsBalance: 1600,
    lifetimePointsEarned: 1750,
    tier: 'silver',
    profileCompletionAwarded: true,
    firstDonationAwarded: true,
  });

  await ensurePointsAccount(donors['mariam.adel@lifelink.demo']._id, {
    pointsBalance: 850,
    lifetimePointsEarned: 1350,
    tier: 'silver',
    profileCompletionAwarded: true,
    firstDonationAwarded: true,
  });

  await ensurePointsTransaction({
    donorId: donors['mariam.adel@lifelink.demo']._id,
    pointsAmount: 50,
    transactionType: 'PROFILE_COMPLETION',
    description: 'Profile completed',
    referenceId: 'demo_profile_mariam',
    balanceAfter: 50,
  });

  await ensurePointsTransaction({
    donorId: donors['mariam.adel@lifelink.demo']._id,
    pointsAmount: 200,
    transactionType: 'BLOOD_DONATION',
    description: 'Completed donation',
    referenceId: 'demo_donation_mariam',
    balanceAfter: 250,
  });

  await ensurePointsTransaction({
    donorId: donors['mariam.adel@lifelink.demo']._id,
    pointsAmount: 100,
    transactionType: 'FIRST_DONATION',
    description: 'First donation bonus',
    referenceId: 'demo_first_donation_mariam',
    balanceAfter: 350,
  });

  if (coffeeVoucher) {
    await ensureRedemption({
      donorId: donors['mariam.adel@lifelink.demo']._id,
      rewardId: coffeeVoucher._id,
      pointsSpent: coffeeVoucher.pointsCost,
      confirmationCode: 'RWD-2026-DEMO01',
      status: 'CONFIRMED',
      deliveryMethod: 'IN_APP',
      deliveryContact: null,
      expiresAt: futureDate(30),
    });

  await ensurePointsTransaction({
    donorId: donors['mariam.adel@lifelink.demo']._id,
    pointsAmount: 1000,
    transactionType: 'ADMIN_ADJUSTMENT',
    description: 'Demo bonus points for rewards showcase',
    referenceId: 'demo_bonus_mariam',
    balanceAfter: 1350,
  });

  await ensurePointsTransaction({
    donorId: donors['mariam.adel@lifelink.demo']._id,
    pointsAmount: -coffeeVoucher.pointsCost,
    transactionType: 'REWARD_REDEEMED',
    description: `Reward redeemed: ${coffeeVoucher.name}`,
    referenceId: 'demo_redemption_mariam',
      balanceAfter: 850,
    });
  }

  if (firstTimerBadge) {
    await ensureUserBadge({
      donorId: donors['mariam.adel@lifelink.demo']._id,
      badgeId: firstTimerBadge._id,
      unlockStatus: 'UNLOCKED',
      progressCurrent: 1,
      progressTarget: 1,
      unlockedAt: pastDate(5),
    });
  }

  console.log('');
  console.log('LifeLink demo seed completed successfully.');
  console.log('');
  console.log('Demo credentials:');
  demoCredentials.forEach((entry) => {
    console.log(`- ${entry.role}: ${entry.email} / ${entry.password}`);
  });
  console.log('');
  console.log('Seeded demo data includes donors, hospitals, admin, requests, donations, notifications, rewards, help documents, support messages, and reward examples.');
  console.log('FAQ content is served from the built-in help controller and does not require database seeding.');
}

try {
  await main();
} catch (error) {
  console.error('Demo seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
