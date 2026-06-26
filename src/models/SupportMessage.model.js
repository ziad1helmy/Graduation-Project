import mongoose from 'mongoose';

const supportMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['TECHNICAL', 'ACCOUNT', 'DONATION', 'REWARDS', 'OTHER'],
      trim: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    attachmentUrls: [{ type: String }],
    status: {
      type: String,
      enum: ['OPEN', 'REVIEWED', 'CLOSED'],
      default: 'OPEN',
    },
    adminReply: {
      type: String,
      default: null,
      trim: true,
      maxlength: 4000,
    },
    adminReplyAt: {
      type: Date,
      default: null,
    },
    adminReplyBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isRead: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true, strict: 'throw' }
);

supportMessageSchema.index({ userId: 1 });
supportMessageSchema.index({ status: 1 });
supportMessageSchema.index({ category: 1 });
supportMessageSchema.index({ isArchived: 1 });
supportMessageSchema.index({ isRead: 1 });
supportMessageSchema.index({ status: 1, createdAt: -1 });
supportMessageSchema.index({ status: 1, adminReplyAt: 1 });
supportMessageSchema.index({ createdAt: -1 });

const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema);

export default SupportMessage;
