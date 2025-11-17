import mongoose from 'mongoose';

const GuestOrderSchema = new mongoose.Schema({
  items: Array,
  subtotal: Number,
  coupon: Object,
  name: String,
  phone: String,
  whatsapp: String,
  email: String,
  address: String,
  locationUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const GuestOrder = (mongoose && mongoose.models && mongoose.models.GuestOrder) ? mongoose.models.GuestOrder : mongoose.model('GuestOrder', GuestOrderSchema);
export default GuestOrder;
