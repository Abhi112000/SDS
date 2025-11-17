import mongoose from 'mongoose';
const CouponSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  type: { type: String, enum: ['percent','fixed'], default: 'percent' },
  value: Number,
  public: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  maxUses: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});
const Coupon = (mongoose && mongoose.models && mongoose.models.Coupon) ? mongoose.models.Coupon : mongoose.model('Coupon', CouponSchema);
export default Coupon;
