// user.js
import mongoose from "mongoose";

// Define the User schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  college: { type: String },
  company: { type: String },
  linkedin: { type: String },
  role: { type: String, enum: ["Admin", "Member"], default: "Member" },
  notifications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Notification' }],
  profilePicture: { type: String, default: 'http://res.cloudinary.com/dicevyk4v/image/upload/v1718561564/wbdquq18b6sy8e7uu1en.jpg' }, // URL of the profile picture
  resume: { type: String }, // URL of the resume
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Blog' }],
  otp: { type: String },
  otpExpiration: { type: Date },
  isVerified: { type: Boolean, default: false } // Additional fields added
  // Additional fields can be added as needed
});

// Create and export the User model
export const User = mongoose.model('User',UserSchema)
