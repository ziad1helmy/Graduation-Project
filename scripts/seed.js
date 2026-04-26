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
      phoneNumber: '1000000000',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'not specified',
      bloodType: 'O+',
      location: {
        city: 'Test City',
        governorate: 'Test Governorate',
        coordinates: { lat: 30.0444, lng: 31.2357 },
      },
    };

    const testHospital = {
      fullName: 'Test Hospital',
      email: 'hospital@test.com',
      password: 'SecurePass@123',
      role: 'hospital',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      hospitalName: 'General Test Hospital',
      hospitalId: 99999,
      licenseNumber: 'TEST-LIC-999',
      contactNumber: '2000000000',
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

    console.log('Inserting Donor test account...');
    await Donor.create(testDonor);
    
    console.log('Inserting Hospital test account...');
    await Hospital.create(testHospital);

    console.log('\n✅ Test accounts seeded successfully!');
    console.log('--------------------------------------------------');
    console.log('Test Donor:');
    console.log(`  Email:    ${testDonor.email}`);
    console.log(`  Password: SecurePass@123`);
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
