import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../src/models/User.model.js';
import Donor from '../src/models/Donor.model.js';
import Hospital from '../src/models/Hospital.model.js';
import Request from '../src/models/Request.model.js';
import Donation from '../src/models/Donation.model.js';
import DonorPoints from '../src/models/DonorPoints.model.js';
import PointsTransaction from '../src/models/PointsTransaction.model.js';

const seedTestAccounts = async () => {
  try {
    console.log('Connecting to MongoDB...');
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
    
    if (
      process.env.NODE_ENV === 'production' || 
      uri.toLowerCase().includes('prod') || 
      uri.toLowerCase().includes('production')
    ) {
      console.error('❌ Safe-guard: Cannot run seed script against a production cluster!');
      process.exit(1);
    }
    
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const testDonor = {
      fullName: 'Test Donor',
      email: 'donor@test.com',
      password: 'SecurePass@123',
      role: 'donor',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      phoneNumber: '01000000000',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      bloodType: 'O+',
      location: {
        city: 'Test City',
        governorate: 'Test Governorate',
        coordinates: { lat: 30.0444, lng: 31.2357 },
      },
    };

    const testHospital = {
      fullName: 'Test Hospital',
      name: 'General Test Hospital',
      email: 'hospital@test.com',
      password: 'SecurePass@123',
      role: 'hospital',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      hospitalName: 'General Test Hospital',
      hospitalId: 'TEST-HOSP-001',
      phone: '2000000000',
      address: {
        city: 'Test City',
        governorate: 'Test Governorate',
      },
      location: {
        city: 'Test City',
        governorate: 'Test Governorate',
        coordinates: { lat: 30.0444, lng: 31.2357 },
      },
    };

    console.log('Cleaning up existing test accounts...');
    await User.deleteMany({ email: { $in: [testDonor.email, testHospital.email] } });
    await Donation.deleteMany({ notes: /^\[seed\] donor-history/i });
    await Request.deleteMany({ notes: /^\[seed\] donor-history/i });
    await PointsTransaction.deleteMany({ description: /^\[seed\] donor-history/i });

    console.log('Inserting Donor test account...');
    await Donor.create(testDonor);
    
    console.log('Inserting Hospital test account...');
    await Hospital.create(testHospital);

    const donor = await Donor.findOne({ email: testDonor.email });
    const hospital = await Hospital.findOne({ email: testHospital.email });

    const baseRequest = await Request.create({
      hospitalId: hospital._id,
      type: 'blood',
      bloodType: [donor.bloodType],
      urgency: 'high',
      status: 'pending',
      requiredBy: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      quantity: 2,
      hospitalContact: hospital.phone,
      hospitalLocation: donor.location?.coordinates || { lat: 30.0444, lng: 31.2357 },
      hospitalName: hospital.hospitalName || hospital.fullName,
      notes: '[seed] donor-history request',
    });

    const seededDonations = await Donation.insertMany([
      {
        donorId: donor._id,
        requestId: baseRequest._id,
        status: 'completed',
        quantity: 1,
        completedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        notes: '[seed] donor-history completed donation',
      },
      {
        donorId: donor._id,
        requestId: baseRequest._id,
        status: 'scheduled',
        quantity: 1,
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        notes: '[seed] donor-history scheduled donation',
      },
      {
        donorId: donor._id,
        requestId: baseRequest._id,
        status: 'pending',
        quantity: 1,
        notes: '[seed] donor-history pending donation',
      },
    ]);

    const completedDonation = seededDonations.find((d) => d.status === 'completed');

    await DonorPoints.findOneAndUpdate(
      { donorId: donor._id },
      {
        donorId: donor._id,
        pointsBalance: 250,
        lifetimePointsEarned: 250,
        tier: 'bronze',
        profileCompletionAwarded: true,
        firstDonationAwarded: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await PointsTransaction.insertMany([
      {
        donorId: donor._id,
        pointsAmount: 200,
        transactionType: 'BLOOD_DONATION',
        description: '[seed] donor-history blood donation points',
        referenceId: `donation_${completedDonation._id.toString()}`,
        balanceAfter: 200,
      },
      {
        donorId: donor._id,
        pointsAmount: 50,
        transactionType: 'PROFILE_COMPLETION',
        description: '[seed] donor-history profile completion points',
        referenceId: null,
        balanceAfter: 250,
      },
    ]);

    console.log('\n✅ Test accounts and donor history seeded successfully!');
    console.log('--------------------------------------------------');
    console.log('Test Donor:');
    console.log(`  Email:    ${testDonor.email}`);
    console.log(`  Password: SecurePass@123`);
    console.log('  Donation history: 3 records (completed + scheduled + pending)');
    console.log('  Points history: 2 records (blood donation + profile completion)');
    console.log('--------------------------------------------------');
    console.log('Test Hospital:');
    console.log(`  Email:    ${testHospital.email}`);
    console.log(`  Password: SecurePass@123`);
    console.log('--------------------------------------------------');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('MongoDB connection closed.');
    }
  }
};

seedTestAccounts();
