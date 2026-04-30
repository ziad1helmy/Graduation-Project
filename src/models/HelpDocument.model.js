import mongoose from 'mongoose';

const helpDocumentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true },
    version: { type: String, default: '1.0' },
    documentUrl: { type: String, required: true },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

const HelpDocument = mongoose.model('HelpDocument', helpDocumentSchema);

export default HelpDocument;
