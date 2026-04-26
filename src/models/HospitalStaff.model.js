import mongoose from 'mongoose';

const hospitalStaffSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    position: {
      type: String,
      enum: ['PHLEBOTOMIST', 'NURSE', 'DOCTOR'],
      required: true,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ON_DUTY', 'OFF_DUTY', 'ON_LEAVE'],
      default: 'AVAILABLE',
    },
    phone: { type: String, default: null },
    shiftStart: { type: String, default: null },
    shiftEnd: { type: String, default: null },
  },
  { timestamps: true }
);

hospitalStaffSchema.index({ hospitalId: 1, createdAt: -1 });

const HospitalStaff = mongoose.model('HospitalStaff', hospitalStaffSchema);

export default HospitalStaff;
