/**
 * Tests for src/utils/jwt.js
 *
 * Covers token signing, verification, expiry, and error handling.
 */

import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, signRefreshToken, verifyRefreshToken } from '../../src/utils/jwt.js';

describe('JWT — Access Tokens', () => {
  it('should sign and verify a valid token', () => {
    const payload = { userId: '123', role: 'donor' };
    const token = signToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('123');
    expect(decoded.role).toBe('donor');
    expect(decoded.exp).toBeDefined();
  });

  it('should reject a tampered token', () => {
    const token = signToken({ userId: '123' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('should reject an expired token', async () => {
    const token = signToken({ userId: '123' }, { expiresIn: '1ms' });
    // Wait for token to expire
    await new Promise((r) => setTimeout(r, 50));
    expect(() => verifyToken(token)).toThrow();
  });

  it('should throw for null/undefined token', () => {
    expect(() => verifyToken(null)).toThrow('Token is required');
    expect(() => verifyToken(undefined)).toThrow('Token is required');
    expect(() => verifyToken('')).toThrow('Token is required');
  });
});

describe('JWT — Refresh Tokens', () => {
  it('should sign and verify a valid refresh token', () => {
    const payload = { userId: '456' };
    const token = signRefreshToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe('456');
  });

  it('should use a different secret from access tokens', () => {
    const payload = { userId: '789' };
    const accessToken = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Tokens should be different (different secrets, different expiry)
    expect(accessToken).not.toBe(refreshToken);
  });

  it('should reject null refresh token', () => {
    expect(() => verifyRefreshToken(null)).toThrow('Token is required');
  });
});
