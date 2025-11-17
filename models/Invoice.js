import mongoose from 'mongoose';

const InvoiceSchema = new mongoose.Schema({
  invoiceId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['custom','order'], default: 'custom' },
  orderId: { type: String },
  payload: { type: Object },
  subtotal: Number,
  discount: Number,
  shipping: Number,
  tax: Number,
  total: Number,
  createdBy: String,
  createdAt: { type: Date, default: Date.now }
});

const Invoice = (mongoose && mongoose.models && mongoose.models.Invoice) ? mongoose.models.Invoice : mongoose.model('Invoice', InvoiceSchema);
export default Invoice;
