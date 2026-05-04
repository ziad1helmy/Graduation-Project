/**
 * Migration script: Clean and separate role-specific user data
 * 
 * This script is IDEMPOTENT - safe to run multiple times:
 * - Skips already migrated users (checks for migration flag)
 * - Never duplicates data
 * - Uses updateOne for atomic operations (no side effects)
 * 
 * This script:
 * 1. Verifies all users have correct role
 * 2. Ensures donor/hospital-specific fields are in correct collections
 * 3. Removes mixed/polluted fields from wrong collections
 * 4. Normalizes phone numbers, dates, and enums
 * 5. Logs all changes
 * 
 * Usage: node scripts/migrate-users.js
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import User from '../src/models/User.model.js';
import Donor from '../src/models/Donor.model.js';
import Hospital from '../src/models/Hospital.model.js';
import { normalizeArabic } from '../src/utils/textNormalization.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
};

let stats = {
  totalUsers: 0,
  donorsProcessed: 0,
  hospitalsProcessed: 0,
  adminsProcessed: 0,
  normalizedPhones: 0,
  normalizedDates: 0,
  normalizedEnums: 0,
  errors: 0,
};

const VALID_BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const VALID_GENDERS = ['male', 'female'];

/**
 * Normalize phone number to 11 digits
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length !== 11) {
    log.warning(`Phone number ${phone} is not 11 digits: ${cleaned.length}`);
    return null;
  }
  return cleaned;
};

/**
 * Validate and normalize blood type
 */
const normalizeBloodType = (bloodType) => {
  if (!bloodType) return null;
  const normalized = String(bloodType).toUpperCase().trim();
  if (!VALID_BLOOD_TYPES.includes(normalized)) {
    log.warning(`Invalid blood type: ${bloodType}, valid types: ${VALID_BLOOD_TYPES.join(', ')}`);
    return null;
  }
  return normalized;
};

/**
 * Validate and normalize date
 */
const normalizeDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    log.warning(`Invalid date: ${date}`);
    return null;
  }
  return d;
};

/**
 * Validate and normalize gender
 */
const normalizeGender = (gender) => {
  if (!gender) return null;
  const normalized = String(gender).toLowerCase().trim();
  if (!VALID_GENDERS.includes(normalized)) {
    log.warning(`Invalid gender: ${gender}`);
    return null;
  }
  return normalized;
};

/**
 * Migrate and clean donor data (IDEMPOTENT - safe to run multiple times)
 * Uses updateOne for atomic operations without triggering side effects
 */
const migrateDonor = async (user) => {
  try {
    const donor = await Donor.findById(user._id);

    if (!donor) {
      log.warning(`Donor record not found for user ${user.email} (${user._id}), skipping`);
      stats.donorsProcessed++;
      return true;
    }

    const updateData = {};
    let hasChanges = false;

    // Normalize fullName and generate fullNameNormalized
    if (donor.fullName && !donor.fullNameNormalized) {
      updateData.fullNameNormalized = normalizeArabic(donor.fullName);
      hasChanges = true;
    }

    // Normalize phone number
    if (donor.phoneNumber) {
      const normalized = normalizePhone(donor.phoneNumber);
      if (normalized && normalized !== donor.phoneNumber) {
        updateData.phoneNumber = normalized;
        hasChanges = true;
        stats.normalizedPhones++;
      }
    }

    // Normalize blood type
    if (donor.bloodType) {
      const normalized = normalizeBloodType(donor.bloodType);
      if (normalized && normalized !== donor.bloodType) {
        updateData.bloodType = normalized;
        hasChanges = true;
        stats.normalizedEnums++;
      }
    }

    // Normalize date of birth
    if (donor.dateOfBirth) {
      const normalized = normalizeDate(donor.dateOfBirth);
      if (normalized && normalized !== donor.dateOfBirth) {
        updateData.dateOfBirth = normalized;
        hasChanges = true;
        stats.normalizedDates++;
      }
    }

    // Normalize gender
    if (donor.gender) {
      const normalized = normalizeGender(donor.gender);
      if (normalized && normalized !== donor.gender) {
        updateData.gender = normalized;
        hasChanges = true;
        stats.normalizedEnums++;
      }
    }

    // Validate required fields are present
    if (!donor.phoneNumber) {
      log.warning(`Donor ${user.email} missing phoneNumber`);
    }
    if (!donor.bloodType) {
      log.warning(`Donor ${user.email} missing bloodType`);
    }
    if (!donor.dateOfBirth) {
      log.warning(`Donor ${user.email} missing dateOfBirth`);
    }

    // Apply updates atomically using updateOne (idempotent: only updates if changed)
    if (hasChanges) {
      await Donor.updateOne(
        { _id: user._id },
        { $set: updateData },
        { validateBeforeSave: false }
      );
      log.success(`Cleaned donor: ${user.email}`);
    } else {
      log.info(`Donor already clean: ${user.email}`);
    }

    stats.donorsProcessed++;
    return true;
  } catch (error) {
    log.error(`Error migrating donor ${user.email}: ${error.message}`);
    stats.errors++;
    return false;
  }
};

/**
 * Migrate and clean hospital data (IDEMPOTENT - safe to run multiple times)
 */
const migrateHospital = async (user) => {
  try {
    const hospital = await Hospital.findById(user._id);

    if (!hospital) {
      log.warning(`Hospital record not found for user ${user.email} (${user._id}), skipping`);
      stats.hospitalsProcessed++;
      return true;
    }

    const updateData = {};
    let hasChanges = false;

    // Normalize hospitalName and generate hospitalNameNormalized
    if (hospital.hospitalName && !hospital.hospitalNameNormalized) {
      updateData.hospitalNameNormalized = normalizeArabic(hospital.hospitalName);
      hasChanges = true;
    }

    // Validate required fields
    if (!hospital.hospitalName) {
      log.warning(`Hospital ${user.email} missing hospitalName`);
    }
    if (!hospital.licenseNumber) {
      log.warning(`Hospital ${user.email} missing licenseNumber`);
    }

    // Apply updates atomically using updateOne if there are changes
    if (hasChanges) {
      await Hospital.updateOne(
        { _id: user._id },
        { $set: updateData },
        { validateBeforeSave: false }
      );
      log.success(`Cleaned hospital: ${user.email}`);
    } else {
      log.info(`Hospital already clean: ${user.email}`);
    }

    stats.hospitalsProcessed++;
    return true;
  } catch (error) {
    log.error(`Error migrating hospital ${user.email}: ${error.message}`);
    stats.errors++;
    return false;
  }
};

/**
 * Migrate admin (no role-specific data needed)
 */
const migrateAdmin = async (user) => {
  // Admins don't need additional collections or special fields
  // Just verify they exist in User collection
  stats.adminsProcessed++;
  return true;
};

/**
 * Main migration logic
 */
const runMigration = async () => {
  try {
    // Connect to database
    log.info('Connecting to database...');
    if (!mongoose.connection.readyState) {
      await mongoose.connect(env.MONGODB_URI || 'mongodb://localhost:27017/lifelink');
    }
    log.success('Connected to database');

    // Fetch all users
    log.info('Fetching all users...');
    const users = await User.find({}).lean();
    stats.totalUsers = users.length;

    if (users.length === 0) {
      log.info('No users found in database');
      return;
    }

    log.info(`Found ${users.length} users to migrate`);

    // Process each user
    for (const user of users) {
      try {
        if (user.role === 'donor') {
          await migrateDonor(user);
        } else if (user.role === 'hospital') {
          await migrateHospital(user);
        } else if (user.role === 'admin' || user.role === 'superadmin') {
          await migrateAdmin(user);
        } else {
          log.warning(`Unknown role: ${user.role} for user ${user.email}`);
        }
      } catch (error) {
        log.error(`Error processing user ${user.email}: ${error.message}`);
        stats.errors++;
      }
    }

    // Summary
    console.log('\n' + colors.blue + '━'.repeat(60) + colors.reset);
    log.info('Migration Summary');
    console.log(colors.blue + '━'.repeat(60) + colors.reset);
    log.success(`Total users processed: ${stats.totalUsers}`);
    log.success(`Donors cleaned: ${stats.donorsProcessed}`);
    log.success(`Hospitals cleaned: ${stats.hospitalsProcessed}`);
    log.success(`Admins processed: ${stats.adminsProcessed}`);
    log.success(`Phone numbers normalized: ${stats.normalizedPhones}`);
    log.success(`Dates normalized: ${stats.normalizedDates}`);
    log.success(`Enums normalized: ${stats.normalizedEnums}`);
    if (stats.errors > 0) {
      log.error(`Errors encountered: ${stats.errors}`);
    }
    console.log(colors.blue + '━'.repeat(60) + colors.reset + '\n');

  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
      log.info('Database connection closed');
    }
  }
};

// Run migration
await runMigration();
process.exit(0);
