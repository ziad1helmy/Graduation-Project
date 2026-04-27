/**
 * Tests for src/validation/auth.validation.js
 *
 * Pure unit tests — no DB needed. Validates field-level rules
 * and role-specific registration logic.
 */

import { describe, it, expect } from 'vitest';
import { validateLogin, validateRegister } from '../../src/validation/auth.validation.js';

// ──────────────────────────────────────────────
//  Login Validation
// ──────────────────────────────────────────────

describe('validateLogin', () => {
  it('should pass with valid email and password', () => {
    const result = validateLogin({ email: 'user@example.com', password: 'SecurePass@123' });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('should fail without email', () => {
    const result = validateLogin({ password: 'SecurePass@123' });
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });

  it('should fail without password', () => {
    const result = validateLogin({ email: 'user@example.com' });
    expect(result.valid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });

  it('should fail with invalid email format', () => {
    const result = validateLogin({ email: 'not-an-email', password: 'SecurePass@123' });
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });

  it('should fail with weak password (no special chars)', () => {
    const result = validateLogin({ email: 'user@example.com', password: 'weakpass1' });
    expect(result.valid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });
});

// ──────────────────────────────────────────────
//  Donor Registration Validation
// ──────────────────────────────────────────────

describe('validateRegister — donor', () => {
  const validDonor = {
    fullName: 'Aya Hassan',
    email: 'aya@example.com',
    password: 'SecurePass@123',
    role: 'donor',
    phoneNumber: '1011111111',
    dateOfBirth: '1996-03-12',
  };

  it('should pass with all valid donor fields', () => {
    const result = validateRegister(validDonor);
    expect(result.valid).toBe(true);
  });

  it('should pass without phoneNumber (optional in validation layer)', () => {
    const { phoneNumber, ...missingPhone } = validDonor;
    const result = validateRegister(missingPhone);
    // phoneNumber is not required in validation rules — Mongoose schema enforces it
    expect(result.valid).toBe(true);
  });

  it('should fail with invalid phoneNumber format', () => {
    const result = validateRegister({ ...validDonor, phoneNumber: '123' });
    expect(result.valid).toBe(false);
    expect(result.errors.phoneNumber).toBeDefined();
  });

  it('should fail without dateOfBirth for donor', () => {
    const { dateOfBirth, ...missingDob } = validDonor;
    const result = validateRegister(missingDob);
    expect(result.valid).toBe(false);
    expect(result.errors.dateOfBirth).toBeDefined();
  });

  it('should fail with short fullName', () => {
    const result = validateRegister({ ...validDonor, fullName: 'AB' });
    expect(result.valid).toBe(false);
    expect(result.errors.fullName).toBeDefined();
  });

  it('should fail with invalid role', () => {
    const result = validateRegister({ ...validDonor, role: 'admin' });
    expect(result.valid).toBe(false);
    expect(result.errors.role).toBeDefined();
  });

  it('should accept optional gender field', () => {
    const result = validateRegister({ ...validDonor, gender: 'female' });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid gender', () => {
    const result = validateRegister({ ...validDonor, gender: 'unknown' });
    expect(result.valid).toBe(false);
    expect(result.errors.gender).toBeDefined();
  });
});

// ──────────────────────────────────────────────
//  Hospital Registration Validation
// ──────────────────────────────────────────────

describe('validateRegister — hospital', () => {
  const validHospital = {
    fullName: 'Cairo Care Operations',
    email: 'ops@cairocare.com',
    password: 'SecurePass@123',
    role: 'hospital',
    hospitalName: 'Cairo Care Hospital',
    hospitalId: 1001,
    licenseNumber: 'LIC-CAIRO-1001',
  };

  it('should pass with all valid hospital fields', () => {
    const result = validateRegister(validHospital);
    expect(result.valid).toBe(true);
  });

  it('should fail without hospitalName', () => {
    const { hospitalName, ...missing } = validHospital;
    const result = validateRegister(missing);
    expect(result.valid).toBe(false);
    expect(result.errors.hospitalName).toBeDefined();
  });

  it('should fail without hospitalId', () => {
    const { hospitalId, ...missing } = validHospital;
    const result = validateRegister(missing);
    expect(result.valid).toBe(false);
    expect(result.errors.hospitalId).toBeDefined();
  });

  it('should fail without licenseNumber', () => {
    const { licenseNumber, ...missing } = validHospital;
    const result = validateRegister(missing);
    expect(result.valid).toBe(false);
    expect(result.errors.licenseNumber).toBeDefined();
  });
});
