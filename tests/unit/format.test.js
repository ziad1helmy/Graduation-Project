import { describe, it, expect } from 'vitest';
import { formatDateOnly, serializeDateOfBirth } from '../../src/utils/format.js';

describe('format utilities', () => {
  it('formats valid date-only values as YYYY-MM-DD', () => {
    expect(formatDateOnly(new Date('2026-06-14T18:45:00.000Z'))).toBe('2026-06-14');
    expect(formatDateOnly('2026-06-14T00:00:00.000Z')).toBe('2026-06-14');
  });

  it('returns null for invalid date-only values', () => {
    expect(formatDateOnly(null)).toBeNull();
    expect(formatDateOnly('not-a-date')).toBeNull();
  });

  it('recursively serializes only dateOfBirth fields', () => {
    const payload = {
      user: {
        dateOfBirth: new Date('1995-01-15T00:00:00.000Z'),
        createdAt: '2026-06-14T09:30:00.000Z',
      },
      donor: {
        details: {
          dateOfBirth: '1991-02-03T00:00:00.000Z',
        },
      },
    };

    expect(serializeDateOfBirth(payload)).toEqual({
      user: {
        dateOfBirth: '1995-01-15',
        createdAt: '2026-06-14T09:30:00.000Z',
      },
      donor: {
        details: {
          dateOfBirth: '1991-02-03',
        },
      },
    });
  });
});
