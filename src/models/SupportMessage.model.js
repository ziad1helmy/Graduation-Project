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
      enum: ['OPEN', 'REVIEWED'],
      default: 'OPEN',
    },
  },
  { timestamps: true }
);

supportMessageSchema.index({ createdAt: -1 });

const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema);

export default SupportMessage;
