// Define the user schema
/**
 * fields:
 * - name: string, required, trim: true
 * - email: string, required, unique, lowercase
 * - password: string, required, minlength: 8, select: false
 * - role: string, enum: ['admin', 'donor', 'hospital'], default: 'donor', discriminatorKey: 'role'
 * - createdAt: date, default: Date.now
 * - updatedAt: date, default: Date.now
 * - timestamps: true
 */

// Define the user model
import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    fullName: { 
       type: String,
       required: [true, 'Username is required'],
       trim: true,
       minlength: [3, 'Username must be at least 3 characters long'],
       maxlength: [100, 'Username must be less than 20 characters long'],
       // This will be in the validation later
       // Should we create a default rondme username for the user?
       // If yes, how to create it?
       // If no, how to handle the case where the username is not provided?
       // And how to handel it in the DB, Will the email be enough?
      //  validate: {
      //   validator: function(v) {
      //     return /^[a-zA-Z0-9]+$/.test(v);
      //   },
      //   message: 'Username must contain only letters and numbers',
      // },
    },
      email: { type: String,
       required: [true, 'Email is required'],
       unique: true,
       lowercase: true,
       trim: true,
       // This will be in the validation later
       validate: {
        validator: function(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email address',
      },
    },
    password: {
      type: String, 
      required: [true, 'Password is required'], 
      minlength: [8, 'Minimum length of the password should be 8'], 
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "donor", "hospital"],
      default: "donor",
    },
  },
  // Explain the discriminatorKey: "role" logically and why it is used
  { timestamps: true },
);

const User = mongoose.model('User', userSchema);

export default User;
