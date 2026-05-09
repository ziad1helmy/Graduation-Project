import { describe, it, expect } from 'vitest';
import {
  validateNearbyRequestsQuery,
  validateRequestIdParam,
  validateQrBody,
} from '../../src/validation/request.validation.js';

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
});
