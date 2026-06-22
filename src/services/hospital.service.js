import crypto from 'crypto';
import Hospital from '../models/Hospital.model.js';
import User from '../models/User.model.js';
import { logAudit } from './audit.service.js';

const allowedBloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const normalizeBloodBanksAvailable = (values = []) => {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value).trim().toUpperCase()).filter((value) => allowedBloodTypes.includes(value)))];
};

const generateTemporaryPassword = () => crypto.randomBytes(12).toString('hex');

export const createHospitalByAdmin = async (data, adminId) => {
  const normalizedEmail = String(data.email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  const requiredFields = ['name', 'type', 'phone'];
  for (const field of requiredFields) {
    if (!data[field] || typeof data[field] !== 'string' || !String(data[field]).trim()) {
      throw new Error(`${field} is required`);
    }
  }

  const existingEmail = await User.findOne({ email: normalizedEmail });
  if (existingEmail) {
    throw new Error('Email already registered');
  }

  let hospitalId = data.hospitalId || data.hospitalCode;
  if (!hospitalId || typeof hospitalId !== 'string' || !hospitalId.trim()) {
    let isUnique = false;
    while (!isUnique) {
      hospitalId = `HOSP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const existing = await Hospital.findOne({ hospitalId });
      if (!existing) {
        isUnique = true;
      }
    }
  } else {
    hospitalId = hospitalId.trim();
    const existingHospitalId = await Hospital.findOne({ hospitalId });
    if (existingHospitalId) {
      throw new Error('Hospital ID already registered');
    }
  }

  const generatedPassword = data.password ? String(data.password) : generateTemporaryPassword();
  const phone = String(data.phone).trim();
  const hospital = await Hospital.create({
    fullName: String(data.name).trim(),
    hospitalName: String(data.name).trim(),
    type: String(data.type).trim(),
    email: normalizedEmail,
    password: generatedPassword,
    role: 'hospital',
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    phone,
    contactNumber: data.contactNumber ? String(data.contactNumber).trim() : phone,
    address: data.address ?? null,
    city: data.city ? String(data.city).trim() : null,
    state: data.state ? String(data.state).trim() : null,
    zipCode: data.zipCode ? String(data.zipCode).trim() : null,
    hospitalId,
    adminContactName: data.adminContactName ? String(data.adminContactName).trim() : null,
    adminContactPhone: data.adminContactPhone ? String(data.adminContactPhone).trim() : null,
    emergencyContact: data.emergencyContact ? String(data.emergencyContact).trim() : null,
    bloodBanksAvailable: normalizeBloodBanksAvailable(data.bloodBanksAvailable),
    capacity: data.capacity !== undefined && data.capacity !== null && data.capacity !== ''
      ? Number(data.capacity)
      : null,
    lat: data.lat !== undefined && data.lat !== null ? Number(data.lat) : null,
    long: data.long !== undefined && data.long !== null ? Number(data.long) : null,
    licenseNumber: data.licenseNumber ? String(data.licenseNumber).trim() : null,
  });

  await logAudit(adminId, 'hospital.create', 'User', hospital._id);

  return {
    hospital,
    ...(data.password ? {} : { temporaryPassword: generatedPassword }),
  };
};