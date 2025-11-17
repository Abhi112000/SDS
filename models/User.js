import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  googleId: { type: String },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  locationUrl: { type: String, default: '' },
  resetToken: { type: String },
  resetExpires: { type: Date },
  role: { type: String, enum: ['user','admin'], default: 'user' },
  disabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Force collection 'dev' (put user documents into the 'dev' collection)
const User = (mongoose && mongoose.models && mongoose.models.User) ? mongoose.models.User : mongoose.model('User', UserSchema, 'users');
export default User;
