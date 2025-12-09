import mongoose from 'mongoose';

const InventorySchema = new mongoose.Schema({
  sku: { type: String, index: true },
  name: { type: String, required: true },
  category: { type: String, index: true },
  // monetary fields are stored as Decimal128 for precision
  costPrice: { type: mongoose.Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
  sellingPrice: { type: mongoose.Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
  stock: { type: Number, default: 0 },
  minStockLevel: { type: Number, default: 0 },
  lifetimeProfit: { type: mongoose.Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
  meta: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

InventorySchema.pre('save', function(next){
  this.updatedAt = new Date();
  next();
});

// text index on name to speed up search (and keep sku indexed already)
InventorySchema.index({ name: 'text' });

const Inventory = (mongoose && mongoose.models && mongoose.models.Inventory) ? mongoose.models.Inventory : mongoose.model('Inventory', InventorySchema);
export default Inventory;
