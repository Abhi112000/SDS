import mongoose from 'mongoose';

const InvoiceSchema = new mongoose.Schema({
  invoiceId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['custom','order'], default: 'custom' },
  orderId: { type: String },
  payload: { type: Object },
  subtotal: Number,
  discount: Number,
  shipping: Number,
  deliveryPincode: String,
  deliveryDistanceKm: Number,
  deliveryRoughDistanceKm: Number,
  deliveryLocationPending: { type: Boolean, default: false },
  deliveryLocationUrl: String,
  tax: Number,
  total: Number,
  // payment/status fields
  status: { type: String, enum: ['unpaid','paid','partially-paid'], default: 'unpaid' },
  paidAmount: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  createdBy: String,
  createdAt: { type: Date, default: Date.now }
});

const Invoice = (mongoose && mongoose.models && mongoose.models.Invoice) ? mongoose.models.Invoice : mongoose.model('Invoice', InvoiceSchema);
export default Invoice;
