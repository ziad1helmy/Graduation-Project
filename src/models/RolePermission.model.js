import mongoose from 'mongoose';

const permissionGroupSchema = new mongoose.Schema(
  {
    view: { type: Boolean, default: false },
    manage: { type: Boolean, default: false },
    ban: { type: Boolean, default: false },
    suspend: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    export: { type: Boolean, default: false },
  },
  { _id: false }
);

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: [true, 'Role is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    permissions: {
      donor_management: { type: permissionGroupSchema, default: () => ({}) },
      hospital_management: { type: permissionGroupSchema, default: () => ({}) },
      admin_management: { type: permissionGroupSchema, default: () => ({}) },
      system_settings: { type: permissionGroupSchema, default: () => ({}) },
      audit_logging: { type: permissionGroupSchema, default: () => ({}) },
      reporting: { type: permissionGroupSchema, default: () => ({}) },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);

export default RolePermission;
