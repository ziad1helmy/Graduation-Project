import mongoose from 'mongoose';

const inboundEmailSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: [true, 'Provider is required'],
      default: 'resend',
      trim: true,
    },
    providerEventId: {
      type: String,
      trim: true,
      index: true,
    },
    messageId: {
      type: String,
      trim: true,
      index: true,
    },
    from: {
      type: String,
      default: '',
      trim: true,
    },
    to: {
      type: [String],
      default: [],
    },
    cc: {
      type: [String],
      default: [],
    },
    bcc: {
      type: [String],
      default: [],
    },
    subject: {
      type: String,
      default: '',
      trim: true,
    },
    text: {
      type: String,
      default: '',
    },
    html: {
      type: String,
      default: '',
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    attachments: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

inboundEmailSchema.index({ isArchived: 1, isRead: 1, receivedAt: -1 });
inboundEmailSchema.index({ receivedAt: -1, createdAt: -1 });
inboundEmailSchema.index({ subject: 'text', from: 'text', text: 'text', to: 'text' });

const InboundEmail = mongoose.model('InboundEmail', inboundEmailSchema);

export default InboundEmail;