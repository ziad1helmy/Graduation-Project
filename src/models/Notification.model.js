import mongoose from 'mongoose';

/**
 * Notification Model - User notification system for matches, requests, achievements
 * 
 * Fields:
 * - userId: reference to User, required
 * - type: 'match', 'request', 'milestone', enum, required
 * - title: notification title, required
 * - message: notification message body, required
 * - read: notification read status, default: false
 * - relatedId: reference to related document (Request, Donation, etc), optional
 * - relatedType: type of related document (Request, Donation, User), optional
 * - data: additional data payload for notification, optional
 * - createdAt: timestamp, auto
 * - updatedAt: timestamp, auto
 */

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    
    type: {
      type: String,
      enum: {
        values: ['match', 'request', 'milestone', 'emergency', 'system', 'admin', 'appointment'],
        message: 'Type must be match, request, milestone, emergency, system, admin, or appointment',
      },
      required: [true, 'Notification type is required'],
    },
    
    title: {
      type: String,
      required: [true, 'Title is required'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    
    message: {
      type: String,
      required: [true, 'Message is required'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    
    read: {
      type: Boolean,
      default: false,
    },
    
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      optional: true,
    },
    
    relatedType: {
      type: String,
      enum: {
        values: ['Request', 'Donation', 'User', 'Achievement', 'Appointment'],
        message: 'Related type must be Request, Donation, User, Achievement, or Appointment',
      },
      optional: true,
    },
    
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
notificationSchema.index({ read: 1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ relatedId: 1, relatedType: 1 });
// Auto-delete notifications older than 90 days to prevent unbounded growth
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
