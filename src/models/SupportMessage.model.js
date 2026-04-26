import mongoose from 'mongoose';

const supportMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    attachmentUrls: [{ type: String }],
    email: { type: String, default: null },
    role: { type: String, default: null },
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
