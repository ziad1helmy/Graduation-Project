import mongoose from 'mongoose';

/**
 * Activity Model — Unified, append-only event log for user actions.
 *
 * Represents ALL user actions in a single timeline.
 * Display strings (title, description) are pre-rendered at write-time
 * so the mobile client receives display-ready payloads.
 *
 * Fields:
 *  - userId        : ObjectId (ref: User) — owner of the activity
 *  - type          : enum — category discriminator (donation, reward, etc.)
 *  - action        : string — granular verb (e.g. "completed_donation")
 *  - title         : string — display-ready title for the UI
 *  - description   : string — summary sentence for the UI
 *  - referenceId   : string — ID of related entity (for dedup + deep linking)
 *  - referenceType : enum — type of referenced entity
 *  - metadata      : Mixed — lightweight snapshot of event data (avoids JOINs)
 *  - icon          : string — icon identifier for the Flutter UI
 *  - createdAt     : Date (auto) — timeline sort key
 *
 * Indexes:
 *  - { userId, createdAt: -1 }                  — primary timeline query
 *  - { userId, type, createdAt: -1 }            — per-category filtering
 *  - { userId, action, referenceId } (unique)   — deduplication
 *  - { createdAt } TTL                          — auto-prune after 365 days
 */

const ACTIVITY_TYPES = [
  'donation',
  'reward',
  'emergency_response',
  'profile_update',
  'appointment',
  'badge',
  'achievement',
  'referral',
  'subscription',
  'admin_action',
];

const REFERENCE_TYPES = [
  'Donation',
  'PointsTransaction',
  'RewardRedemption',
  'Request',
  'User',
  'Badge',
];

const activitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },

    // type: {
    //   type: String,
    //   enum: {
    //     values: ACTIVITY_TYPES,
    //     message: `Type must be one of: ${ACTIVITY_TYPES.join(', ')}`,
    //   },
    //   required: [true, 'Activity type is required'],
    // },

    action: {
      type: String,
      required: [true, 'Action is required'],
      maxlength: [100, 'Action cannot exceed 100 characters'],
    },

    title: {
      type: String,
      required: [true, 'Title is required'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    referenceId: {
      type: String,
      default: null,
    },

    referenceType: {
      type: String,
      enum: {
        values: REFERENCE_TYPES,
        message: `Reference type must be one of: ${REFERENCE_TYPES.join(', ')}`,
      },
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    icon: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Primary timeline query: GET /donor/activity?page=1&limit=20
activitySchema.index({ userId: 1, createdAt: -1 });

// Per-category filter: GET /donor/activity?type=donation
activitySchema.index({ userId: 1, type: 1, createdAt: -1 });

// Deduplication: prevent duplicate activities for the same event.
// Only enforced when referenceId is a non-null string.
// Same proven pattern as PointsTransaction.model.js.
activitySchema.index(
  { userId: 1, action: 1, referenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { referenceId: { $type: 'string' } },
  }
);

// Auto-prune activities older than 365 days to bound collection growth
activitySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);

const Activity = mongoose.model('Activity', activitySchema);

export default Activity;
