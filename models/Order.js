import mongoose from 'mongoose';
const OrderSchema = new mongoose.Schema({
  userId: String,
  guest: { type: Boolean, default: false },
  items: [{ productId: String, title: String, qty: Number, price: Number }],
  subtotal: Number,
  coupon: { code: String, discountAmount: Number },
  total: Number,
  name: String,
  phone: String,
  email: String,
  whatsapp: String,
  address: String,
  deliveryPincode: String,
  locationUrl: String,
  deliveryLatitude: Number,
  deliveryLongitude: Number,
  deliveryDistanceKm: Number,
  deliveryRoughDistanceKm: Number,
  deliveryLocationPending: { type: Boolean, default: false },
  deliveryCharge: { type: Number, default: 0 },
  status: { type: String, default: 'new' },
  messages: [{ from: String, text: String, createdAt: Date }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});
const Order = (mongoose && mongoose.models && mongoose.models.Order) ? mongoose.models.Order : mongoose.model('Order', OrderSchema);
export default Order;
