import { describe, it, expect } from 'vitest';
import {
  validateNearbyRequestsQuery,
  validateRequestIdParam,
  validateQrBody,
} from '../../src/validation/request.validation.js';
import { validateCreateEmergencyRequestBody } from '../../src/validation/hospital.validation.js';

describe('request validation', () => {
  it('accepts a valid nearby query', () => {
    const result = validateNearbyRequestsQuery({ lat: '30.0444', lng: '31.2357', radius: '10', page: '1', limit: '20' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects an invalid qr payload', () => {
    const result = validateQrBody({});
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/qrToken/i);
  });

  it('rejects missing request id', () => {
    const result = validateRequestIdParam({});
    expect(result.valid).toBe(false);
  });

  it('accepts a valid emergency request payload', () => {
    const result = validateCreateEmergencyRequestBody({
      bloodType: 'A+',
      unitsNeeded: 2,
      patientDetails: 'emergency',
      isEmergency: true,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.bloodTypes).toEqual(['A+']);
    expect(result.unitsNeeded).toBe(2);
  });

  it('rejects unexpected fields in emergency request payload', () => {
    const result = validateCreateEmergencyRequestBody({
      bloodType: 'A+',
      unitsNeeded: 2,
      patientDetails: 'emergency',
      hospitalId: 'bad-id',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Unexpected field/i);
  });

  it('rejects invalid patientDetails in emergency request', () => {
    const result = validateCreateEmergencyRequestBody({
      bloodType: 'A+',
      unitsNeeded: 2,
      patientDetails: 'Not a valid condition',
      isEmergency: true,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/patientDetails must be one of/i);
  });
});
