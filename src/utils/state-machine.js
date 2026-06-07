/**
 * LifeLink – Centralized State Machine Engine
 *
 * This module is the SOLE source of truth for all entity status transitions.
 * Controllers and services must call `validateTransition` before persisting any
 * status change.  Direct status mutations that bypass this engine are a bug.
 *
 * Design notes
 * ─────────────
 * • Terminal states have an empty allowed-next-states array [].
 * • Admin overrides (options.isAdminOverride = true) bypass user-facing guards
 *   but are still logged – use sparingly and only from maintenance utilities.
 * • `validateOrphanState` asserts cross-entity consistency rules; call it after
 *   all related documents have been updated so the check reflects final state.
 */

// ─── Transition Matrices ────────────────────────────────────────────────────

/**
 * Request state machine.
 *
 * Business rules
 * ──────────────
 * pending     – open for donor responses
 * accepted    – a donor accepted; donation record created
 * in-progress – donation appointment confirmed / active (appointment flow)
 * completed   – donation completed; request fulfilled
 * cancelled   – withdrawn by hospital or donor who held the accepted slot
 * expired     – requiredBy date passed without fulfilment
 *
 * accepted → pending  : valid "reopen" after a rejection lifecycle
 *                       (hospital rejects the donation → request reverts to pending)
 *                       OR no-arrival timeout (donor didn't arrive)
 * accepted → completed: valid for Hospital Request flow (direct completion on hospital confirm)
 * in-progress → pending: valid when a scheduled donation is cancelled/rejected
 *                        mid-flow and the request is reopened for new responses
 *
 * Paths that look suspicious but are intentionally excluded:
 *   pending → completed  (must go through accepted first)
 *   in-progress → accepted (no meaningful business case)
 */
export const REQUEST_TRANSITIONS = {
  pending: ['accepted', 'cancelled', 'expired'],
  accepted: ['in-progress', 'pending', 'cancelled', 'expired', 'completed'],
  'in-progress': ['completed', 'pending', 'cancelled', 'expired'],
  completed: [],
  cancelled: [],
  expired: [],
};

/**
 * Donation state machine.
 *
 * pending   – donor expressed intent; awaiting appointment (appointment flow)
 *           – donor accepted Hospital Request; QR generated; awaiting hospital scan/confirm
 * scheduled – appointment confirmed; donation in-flight (appointment flow)
 * completed – blood collected; terminal
 * cancelled – withdrawn by donor
 * rejected  – hospital refused; terminal
 * expired   – no-arrival timeout (Hospital Request flow); terminal
 * abandoned – donor never followed through
 */
export const DONATION_TRANSITIONS = {
  pending: ['scheduled', 'completed', 'cancelled', 'rejected', 'expired', 'abandoned'],
  scheduled: ['completed', 'cancelled', 'rejected'],
  completed: [],
  cancelled: [],
  rejected: [],
  expired: [],
  abandoned: [],
};

/**
 * Appointment state machine.
 *
 * pending   – booked, awaiting confirmation
 * confirmed – donor confirmed arrival; QR scanned
 * completed – donation completed at the hospital
 * cancelled – withdrawn by either party
 */
export const APPOINTMENT_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'pending'],
  completed: [],
  cancelled: [],
};

// ─── Entity Registry ─────────────────────────────────────────────────────────

const TRANSITION_MAPS = {
  request: REQUEST_TRANSITIONS,
  donation: DONATION_TRANSITIONS,
  appointment: APPOINTMENT_TRANSITIONS,
};

const TERMINAL_STATES = {
  request: ['completed', 'cancelled', 'expired'],
  donation: ['completed', 'cancelled', 'rejected', 'expired', 'abandoned'],
  appointment: ['completed', 'cancelled'],
};

// ─── Core Validation ─────────────────────────────────────────────────────────

/**
 * Validate a status transition.
 *
 * @param {string} entityName  'request' | 'donation' | 'appointment'
 * @param {string} fromStatus  Current status of the document
 * @param {string} toStatus    Desired next status
 * @param {{ isAdminOverride?: boolean }} [options]
 * @throws {Error} When the transition is illegal
 * @returns {void}
 */
export const validateTransition = (entityName, fromStatus, toStatus, options = {}) => {
  const { isAdminOverride = false } = options;

  const matrix = TRANSITION_MAPS[entityName];
  if (!matrix) {
    throw new Error(`Unknown entity type: "${entityName}". Expected one of: ${Object.keys(TRANSITION_MAPS).join(', ')}.`);
  }

  // No-op: transitioning to the same state is always a logic error in user-facing flows.
  if (fromStatus === toStatus) {
    throw new Error(
      `[StateMachine] ${entityName}: cannot transition from "${fromStatus}" to itself.`,
    );
  }

  // Admin maintenance paths bypass user-facing guards.
  // These should only be used from admin utilities / data-repair scripts.
  if (isAdminOverride) {
    return; // allowed unconditionally; caller is responsible for audit trail
  }

  const allowedNextStates = matrix[fromStatus];

  if (allowedNextStates === undefined) {
    throw new Error(
      `[StateMachine] ${entityName}: unknown current status "${fromStatus}".`,
    );
  }

  if (allowedNextStates.length === 0) {
    throw new Error(
      `[StateMachine] ${entityName}: "${fromStatus}" is a terminal state and cannot transition to "${toStatus}".`,
    );
  }

  if (!allowedNextStates.includes(toStatus)) {
    throw new Error(
      `[StateMachine] ${entityName}: transition from "${fromStatus}" to "${toStatus}" is not allowed. ` +
      `Allowed next states: [${allowedNextStates.join(', ')}].`,
    );
  }
};

/**
 * Returns true when the given status is a terminal state for the entity.
 *
 * @param {string} entityName
 * @param {string} status
 * @returns {boolean}
 */
export const isTerminalState = (entityName, status) => {
  return (TERMINAL_STATES[entityName] ?? []).includes(status);
};

// ─── Orphan State Validation ──────────────────────────────────────────────────

/**
 * Validate cross-entity consistency rules after a transition.
 *
 * Call this AFTER saving all related documents so the check sees the final
 * persisted state.  Each rule is documented inline.
 *
 * @param {string} entityName  'request' | 'donation' | 'appointment'
 * @param {object} doc         The primary document that was just updated
 * @param {object} [related]   Related documents keyed by name, e.g. { donation, appointment }
 * @throws {Error} When an impossible cross-entity state is detected
 */
export const validateOrphanState = (entityName, doc, related = {}) => {
  if (entityName === 'request') {
    const { donation, appointment } = related;

    // Rule R1: A completed request must have a completed donation.
    if (doc.status === 'completed') {
      if (!donation) {
        throw new Error('[OrphanCheck] Completed request has no linked donation.');
      }
      if (donation.status !== 'completed') {
        throw new Error(
          `[OrphanCheck] Completed request has a non-completed donation (status: "${donation.status}").`,
        );
      }
    }

    // Rule R2: An accepted request must have an acceptedDonationId.
    if (doc.status === 'accepted' && !doc.acceptedDonationId) {
      throw new Error('[OrphanCheck] Accepted request is missing acceptedDonationId.');
    }
  }

  if (entityName === 'donation') {
    const { appointment } = related;

    // Rule D1: A completed donation must have a completed appointment (unless it is a request-linked donation under Flow A).
    if (doc.status === 'completed' && !doc.requestId) {
      if (!appointment) {
        throw new Error('[OrphanCheck] Completed donation has no linked appointment.');
      }
      if (appointment.status !== 'completed') {
        throw new Error(
          `[OrphanCheck] Completed donation has a non-completed appointment (status: "${appointment.status}").`,
        );
      }
    }

    // Rule D2: A scheduled donation must have an appointmentId.
    if (doc.status === 'scheduled' && !doc.appointmentId && !doc.requestId) {
      throw new Error('[OrphanCheck] Scheduled donation is missing appointmentId.');
    }
  }

  if (entityName === 'appointment') {
    const { donation } = related;

    // Rule A1: A completed appointment must have a linked donation.
    if (doc.status === 'completed' && !donation) {
      throw new Error('[OrphanCheck] Completed appointment has no linked donation.');
    }

    // Rule A2: A confirmed appointment must not be linked to a rejected/cancelled donation.
    if (doc.status === 'confirmed' && donation) {
      if (['rejected', 'cancelled'].includes(donation.status)) {
        throw new Error(
          `[OrphanCheck] Confirmed appointment is linked to a "${donation.status}" donation.`,
        );
      }
    }
  }
};

// ─── Convenience Helpers ─────────────────────────────────────────────────────

/**
 * Returns the list of states that can transition to the given `toStatus`
 * for the specified entity (reverse lookup).
 *
 * @param {string} entityName
 * @param {string} toStatus
 * @returns {string[]}
 */
export const getAllowedSources = (entityName, toStatus) => {
  const matrix = TRANSITION_MAPS[entityName];
  if (!matrix) return [];
  return Object.entries(matrix)
    .filter(([, next]) => next.includes(toStatus))
    .map(([from]) => from);
};

/**
 * Returns the full transition matrix for an entity (read-only copy).
 *
 * @param {string} entityName
 * @returns {Record<string, string[]>}
 */
export const getTransitionMatrix = (entityName) => {
  const matrix = TRANSITION_MAPS[entityName];
  if (!matrix) return {};
  return Object.fromEntries(
    Object.entries(matrix).map(([from, next]) => [from, [...next]]),
  );
};
