/**
 * Unit tests for src/utils/state-machine.js
 *
 * These are pure-function tests – no database connection required.
 *
 * Coverage:
 *   1. Valid transitions for Request, Donation, Appointment
 *   2. Invalid transitions are blocked
 *   3. Terminal states cannot transition (without admin override)
 *   4. Admin override bypasses user-facing guards
 *   5. Orphan-state validations throw as expected
 *   6. Utility helpers (isTerminalState, getAllowedSources, getTransitionMatrix)
 */

import { describe, it, expect } from 'vitest';
import {
  validateTransition,
  validateOrphanState,
  isTerminalState,
  getAllowedSources,
  getTransitionMatrix,
  REQUEST_TRANSITIONS,
  DONATION_TRANSITIONS,
  APPOINTMENT_TRANSITIONS,
} from '../../src/utils/state-machine.js';

// ─── 1. Exported matrices have the expected shape ────────────────────────────

describe('Transition matrices', () => {
  it('REQUEST_TRANSITIONS has the correct states', () => {
    const states = Object.keys(REQUEST_TRANSITIONS);
    expect(states).toContain('pending');
    expect(states).toContain('accepted');
    expect(states).toContain('in-progress');
    expect(states).toContain('completed');
    expect(states).toContain('cancelled');
    expect(states).toContain('expired');
  });

  it('DONATION_TRANSITIONS has the correct states', () => {
    const states = Object.keys(DONATION_TRANSITIONS);
    expect(states).toContain('pending');
    expect(states).toContain('scheduled');
    expect(states).toContain('completed');
    expect(states).toContain('cancelled');
    expect(states).toContain('rejected');
  });

  it('APPOINTMENT_TRANSITIONS has the correct states', () => {
    const states = Object.keys(APPOINTMENT_TRANSITIONS);
    expect(states).toContain('pending');
    expect(states).toContain('confirmed');
    expect(states).toContain('completed');
    expect(states).toContain('cancelled');
  });

  it('terminal states have empty allowed-next-states', () => {
    expect(REQUEST_TRANSITIONS.completed).toEqual([]);
    expect(REQUEST_TRANSITIONS.cancelled).toEqual([]);
    expect(REQUEST_TRANSITIONS.expired).toEqual([]);
    expect(DONATION_TRANSITIONS.completed).toEqual([]);
    expect(DONATION_TRANSITIONS.cancelled).toEqual([]);
    expect(DONATION_TRANSITIONS.rejected).toEqual([]);
    expect(APPOINTMENT_TRANSITIONS.completed).toEqual([]);
    expect(APPOINTMENT_TRANSITIONS.cancelled).toEqual([]);
  });
});

// ─── 2. validateTransition – valid paths ─────────────────────────────────────

describe('validateTransition – valid transitions', () => {
  // --- Request ---
  it('request: pending → accepted', () => {
    expect(() => validateTransition('request', 'pending', 'accepted')).not.toThrow();
  });

  it('request: pending → cancelled', () => {
    expect(() => validateTransition('request', 'pending', 'cancelled')).not.toThrow();
  });

  it('request: pending → expired', () => {
    expect(() => validateTransition('request', 'pending', 'expired')).not.toThrow();
  });

  it('request: accepted → in-progress', () => {
    expect(() => validateTransition('request', 'accepted', 'in-progress')).not.toThrow();
  });

  it('request: accepted → pending (reopen after rejection lifecycle)', () => {
    expect(() => validateTransition('request', 'accepted', 'pending')).not.toThrow();
  });

  it('request: accepted → cancelled', () => {
    expect(() => validateTransition('request', 'accepted', 'cancelled')).not.toThrow();
  });

  it('request: in-progress → completed', () => {
    expect(() => validateTransition('request', 'in-progress', 'completed')).not.toThrow();
  });

  it('request: in-progress → pending (reopen mid-flow)', () => {
    expect(() => validateTransition('request', 'in-progress', 'pending')).not.toThrow();
  });

  it('request: in-progress → cancelled', () => {
    expect(() => validateTransition('request', 'in-progress', 'cancelled')).not.toThrow();
  });

  it('request: in-progress → expired', () => {
    expect(() => validateTransition('request', 'in-progress', 'expired')).not.toThrow();
  });

  // --- Donation ---
  it('donation: pending → scheduled', () => {
    expect(() => validateTransition('donation', 'pending', 'scheduled')).not.toThrow();
  });

  it('donation: pending → cancelled', () => {
    expect(() => validateTransition('donation', 'pending', 'cancelled')).not.toThrow();
  });

  it('donation: pending → rejected', () => {
    expect(() => validateTransition('donation', 'pending', 'rejected')).not.toThrow();
  });

  it('donation: scheduled → completed', () => {
    expect(() => validateTransition('donation', 'scheduled', 'completed')).not.toThrow();
  });

  it('donation: scheduled → cancelled', () => {
    expect(() => validateTransition('donation', 'scheduled', 'cancelled')).not.toThrow();
  });

  it('donation: scheduled → rejected', () => {
    expect(() => validateTransition('donation', 'scheduled', 'rejected')).not.toThrow();
  });

  // --- Appointment ---
  it('appointment: pending → confirmed', () => {
    expect(() => validateTransition('appointment', 'pending', 'confirmed')).not.toThrow();
  });

  it('appointment: pending → completed is blocked', () => {
    expect(() => validateTransition('appointment', 'pending', 'completed')).toThrow(/not allowed/);
  });

  it('appointment: pending → cancelled', () => {
    expect(() => validateTransition('appointment', 'pending', 'cancelled')).not.toThrow();
  });

  it('appointment: confirmed → completed', () => {
    expect(() => validateTransition('appointment', 'confirmed', 'completed')).not.toThrow();
  });

  it('appointment: confirmed → cancelled', () => {
    expect(() => validateTransition('appointment', 'confirmed', 'cancelled')).not.toThrow();
  });
});

// ─── 3. validateTransition – blocked paths ───────────────────────────────────

describe('validateTransition – invalid / blocked transitions', () => {
  it('request: pending → completed (must go through accepted first)', () => {
    expect(() => validateTransition('request', 'pending', 'completed')).toThrow(/not allowed/);
  });

  it('request: pending → in-progress (must be accepted first)', () => {
    expect(() => validateTransition('request', 'pending', 'in-progress')).toThrow(/not allowed/);
  });

  it('request: same state → same state', () => {
    expect(() => validateTransition('request', 'pending', 'pending')).toThrow(/cannot transition from/);
  });

  it('donation: pending → completed (must be scheduled first)', () => {
    expect(() => validateTransition('donation', 'pending', 'completed')).toThrow(/not allowed/);
  });

  it('donation: same state → same state', () => {
    expect(() => validateTransition('donation', 'scheduled', 'scheduled')).toThrow(/cannot transition from/);
  });

  it('appointment: confirmed → pending (reset verification)', () => {
    expect(() => validateTransition('appointment', 'confirmed', 'pending')).not.toThrow();
  });

  it('unknown entity throws', () => {
    expect(() => validateTransition('unknown_entity', 'pending', 'active')).toThrow(/Unknown entity/);
  });

  it('unknown current status throws', () => {
    expect(() => validateTransition('request', 'mystery_status', 'accepted')).toThrow(/unknown current status/);
  });
});

// ─── 4. Terminal state protection ────────────────────────────────────────────

describe('validateTransition – terminal state protection', () => {
  const requestTerminals = ['completed', 'cancelled', 'expired'];
  const donationTerminals = ['completed', 'cancelled', 'rejected'];
  const appointmentTerminals = ['completed', 'cancelled'];

  for (const terminal of requestTerminals) {
    it(`request: ${terminal} → pending is blocked`, () => {
      expect(() => validateTransition('request', terminal, 'pending')).toThrow(/terminal state/);
    });
  }

  for (const terminal of donationTerminals) {
    it(`donation: ${terminal} → pending is blocked`, () => {
      expect(() => validateTransition('donation', terminal, 'pending')).toThrow(/terminal state/);
    });
  }

  for (const terminal of appointmentTerminals) {
    it(`appointment: ${terminal} → pending is blocked`, () => {
      expect(() => validateTransition('appointment', terminal, 'pending')).toThrow(/terminal state/);
    });
  }
});

// ─── 5. Admin override ───────────────────────────────────────────────────────

describe('validateTransition – admin override', () => {
  it('allows normally-blocked transition when isAdminOverride = true', () => {
    expect(() =>
      validateTransition('request', 'completed', 'pending', { isAdminOverride: true })
    ).not.toThrow();
  });

  it('allows cross-entity repair transition when isAdminOverride = true', () => {
    expect(() =>
      validateTransition('donation', 'completed', 'pending', { isAdminOverride: true })
    ).not.toThrow();
  });

  it('isAdminOverride = false still enforces guards', () => {
    expect(() =>
      validateTransition('request', 'completed', 'pending', { isAdminOverride: false })
    ).toThrow(/terminal state/);
  });
});

// ─── 6. validateOrphanState ──────────────────────────────────────────────────

describe('validateOrphanState – request', () => {
  it('R1: completed request with completed donation passes', () => {
    const doc = { status: 'completed', acceptedDonationId: 'abc' };
    const related = { donation: { status: 'completed' } };
    expect(() => validateOrphanState('request', doc, related)).not.toThrow();
  });

  it('R1: completed request without donation throws', () => {
    const doc = { status: 'completed', acceptedDonationId: 'abc' };
    expect(() => validateOrphanState('request', doc, {})).toThrow(/no linked donation/);
  });

  it('R1: completed request with non-completed donation throws', () => {
    const doc = { status: 'completed', acceptedDonationId: 'abc' };
    const related = { donation: { status: 'pending' } };
    expect(() => validateOrphanState('request', doc, related)).toThrow(/non-completed donation/);
  });

  it('R2: accepted request without acceptedDonationId throws', () => {
    const doc = { status: 'accepted', acceptedDonationId: null };
    expect(() => validateOrphanState('request', doc, {})).toThrow(/missing acceptedDonationId/);
  });

  it('R2: accepted request with acceptedDonationId passes', () => {
    const doc = { status: 'accepted', acceptedDonationId: 'donationId' };
    expect(() => validateOrphanState('request', doc, {})).not.toThrow();
  });

  it('pending request passes with no related docs', () => {
    const doc = { status: 'pending' };
    expect(() => validateOrphanState('request', doc, {})).not.toThrow();
  });
});

describe('validateOrphanState – donation', () => {
  it('D1: completed donation with completed appointment passes', () => {
    const doc = { status: 'completed', appointmentId: 'apptId' };
    const related = { appointment: { status: 'completed' } };
    expect(() => validateOrphanState('donation', doc, related)).not.toThrow();
  });

  it('D1: completed donation without appointment throws', () => {
    const doc = { status: 'completed', appointmentId: null };
    expect(() => validateOrphanState('donation', doc, {})).toThrow(/no linked appointment/);
  });

  it('D1: completed donation with non-completed appointment throws', () => {
    const doc = { status: 'completed', appointmentId: 'apptId' };
    const related = { appointment: { status: 'confirmed' } };
    expect(() => validateOrphanState('donation', doc, related)).toThrow(/non-completed appointment/);
  });

  it('D2: scheduled donation without appointmentId throws', () => {
    const doc = { status: 'scheduled', appointmentId: null };
    expect(() => validateOrphanState('donation', doc, {})).toThrow(/missing appointmentId/);
  });

  it('D2: scheduled donation with appointmentId passes', () => {
    const doc = { status: 'scheduled', appointmentId: 'apptId' };
    expect(() => validateOrphanState('donation', doc, {})).not.toThrow();
  });
});

describe('validateOrphanState – appointment', () => {
  it('A1: completed appointment with linked donation passes', () => {
    const doc = { status: 'completed' };
    const related = { donation: { status: 'completed' } };
    expect(() => validateOrphanState('appointment', doc, related)).not.toThrow();
  });

  it('A1: completed appointment without donation throws', () => {
    const doc = { status: 'completed' };
    expect(() => validateOrphanState('appointment', doc, {})).toThrow(/no linked donation/);
  });

  it('A2: confirmed appointment with rejected donation throws', () => {
    const doc = { status: 'confirmed' };
    const related = { donation: { status: 'rejected' } };
    expect(() => validateOrphanState('appointment', doc, related)).toThrow(/"rejected" donation/);
  });

  it('A2: confirmed appointment with cancelled donation throws', () => {
    const doc = { status: 'confirmed' };
    const related = { donation: { status: 'cancelled' } };
    expect(() => validateOrphanState('appointment', doc, related)).toThrow(/"cancelled" donation/);
  });

  it('A2: confirmed appointment with pending donation passes', () => {
    const doc = { status: 'confirmed' };
    const related = { donation: { status: 'pending' } };
    expect(() => validateOrphanState('appointment', doc, related)).not.toThrow();
  });

  it('pending appointment without donation passes', () => {
    const doc = { status: 'pending' };
    expect(() => validateOrphanState('appointment', doc, {})).not.toThrow();
  });
});

// ─── 7. Utility helpers ──────────────────────────────────────────────────────

describe('isTerminalState', () => {
  it('returns true for request terminal states', () => {
    expect(isTerminalState('request', 'completed')).toBe(true);
    expect(isTerminalState('request', 'cancelled')).toBe(true);
    expect(isTerminalState('request', 'expired')).toBe(true);
  });

  it('returns false for request non-terminal states', () => {
    expect(isTerminalState('request', 'pending')).toBe(false);
    expect(isTerminalState('request', 'accepted')).toBe(false);
    expect(isTerminalState('request', 'in-progress')).toBe(false);
  });

  it('returns true for donation terminal states', () => {
    expect(isTerminalState('donation', 'completed')).toBe(true);
    expect(isTerminalState('donation', 'cancelled')).toBe(true);
    expect(isTerminalState('donation', 'rejected')).toBe(true);
  });

  it('returns true for appointment terminal states', () => {
    expect(isTerminalState('appointment', 'completed')).toBe(true);
    expect(isTerminalState('appointment', 'cancelled')).toBe(true);
  });

  it('returns false for unknown entity', () => {
    expect(isTerminalState('unknown', 'completed')).toBe(false);
  });
});

describe('getAllowedSources', () => {
  it('returns all states that can transition to "completed" for request', () => {
    const sources = getAllowedSources('request', 'completed');
    expect(sources).toContain('in-progress');
    expect(sources).not.toContain('pending'); // pending cannot go directly to completed
  });

  it('returns all states that can transition to "rejected" for donation', () => {
    const sources = getAllowedSources('donation', 'rejected');
    expect(sources).toContain('pending');
    expect(sources).toContain('scheduled');
  });

  it('returns empty array for unknown entity', () => {
    expect(getAllowedSources('unknown', 'completed')).toEqual([]);
  });
});

describe('getTransitionMatrix', () => {
  it('returns a copy of the request matrix', () => {
    const matrix = getTransitionMatrix('request');
    expect(matrix.pending).toContain('accepted');
    expect(matrix.completed).toEqual([]);
  });

  it('returns empty object for unknown entity', () => {
    expect(getTransitionMatrix('unknown')).toEqual({});
  });

  it('returned matrix is a deep copy (mutations do not affect the original)', () => {
    const matrix = getTransitionMatrix('request');
    matrix.pending.push('MUTATED');
    // Original should be unchanged
    expect(REQUEST_TRANSITIONS.pending).not.toContain('MUTATED');
  });
});
