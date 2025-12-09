import mongoose from 'mongoose';

const SaleSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  sku: String,
  name: String,
  // store monetary values as Decimal128
  costPrice: { type: mongoose.Schema.Types.Decimal128, required: true },
  sellingPrice: { type: mongoose.Schema.Types.Decimal128, required: true },
  quantity: { type: Number, required: true },
  profit: { type: mongoose.Schema.Types.Decimal128, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId },
  timestamp: { type: Date, default: Date.now, index: true },
  note: String,
  source: { type: String, default: 'admin' }
});

const Sale = (mongoose && mongoose.models && mongoose.models.Sale) ? mongoose.models.Sale : mongoose.model('Sale', SaleSchema);
export default Sale;
