/**
 * Tests for src/validation/auth.validation.js
 *
 * Pure unit tests - no DB needed. Validates field-level rules
 * and role-specific registration logic.
 */

import { describe, it, expect } from 'vitest';
import { validateChangePassword, validateLogin, validateRegister } from '../../src/validation/auth.validation.js';

describe('validateLogin', () => {
  it('should pass with valid email, password, and role', () => {
    const result = validateLogin({ email: 'user@example.com', password: 'SecurePass@123', role: 'donor' });
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

describe('validateRegister - donor', () => {
  const validDonor = {
    fullName: 'Aya Hassan',
    email: 'aya@example.com',
    password: 'SecurePass@123',
    confirmPassword: 'SecurePass@123',
    role: 'donor',
    phoneNumber: '01011111111',
    dateOfBirth: '1996-03-12',
    bloodType: 'A+',
  };

  it('should pass with all valid donor fields', () => {
    const result = validateRegister(validDonor);
    expect(result.valid).toBe(true);
  });

  it('should fail without phoneNumber', () => {
    const { phoneNumber, ...missingPhone } = validDonor;
    const result = validateRegister(missingPhone);
    expect(result.valid).toBe(false);
    expect(result.errors.phoneNumber).toBeDefined();
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
    const result = validateRegister({ ...validDonor, role: 'superadmin' });
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

  it('should accept valid donor signup with location coordinates', () => {
    const result = validateRegister({
      ...validDonor,
      location: { lat: 30.0444, lng: 31.2357 },
    });
    expect(result.valid).toBe(true);
  });

  it('should reject donor signup when only lat is provided', () => {
    const result = validateRegister({
      ...validDonor,
      location: { lat: 30.0444 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.location).toBeDefined();
  });

  it('should reject invalid coordinate range', () => {
    const result = validateRegister({
      ...validDonor,
      location: { lat: 120, lng: 31.2357 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.location).toBeDefined();
  });
});

describe('validateRegister - public signup restrictions', () => {
  it('should reject hospital public signup even with valid fields', () => {
    const result = validateRegister({
      fullName: 'Cairo Care Operations',
      email: 'ops@cairocare.com',
      password: 'SecurePass@123',
      confirmPassword: 'SecurePass@123',
      role: 'hospital',
      hospitalName: 'Cairo Care Hospital',
      hospitalId: 'HOSP-CAIRO-001',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.role).toBeDefined();
  });

  it('should reject admin public signup', () => {
    const result = validateRegister({
      fullName: 'Admin User',
      email: 'admin@example.com',
      password: 'SecurePass@123',
      confirmPassword: 'SecurePass@123',
      role: 'admin',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.role).toBeDefined();
  });
});

describe('validateChangePassword', () => {
  it('should pass with a valid password change payload', () => {
    const result = validateChangePassword({
      currentPassword: 'OldPass@123',
      newPassword: 'NewPass@123',
      confirmPassword: 'NewPass@123',
    });

    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('should fail when currentPassword is missing', () => {
    const result = validateChangePassword({
      newPassword: 'NewPass@123',
      confirmPassword: 'NewPass@123',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.currentPassword).toBeDefined();
  });

  it('should fail when confirmPassword does not match', () => {
    const result = validateChangePassword({
      currentPassword: 'OldPass@123',
      newPassword: 'NewPass@123',
      confirmPassword: 'WrongPass@123',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.confirmPassword).toBeDefined();
  });
});
