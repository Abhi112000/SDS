import mongoose from 'mongoose';
const ProductSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  originalPrice: Number,
  onSale: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  sku: String,
  // image can be a string (legacy) or an object with sizes { thumb, card, large }
  image: mongoose.Schema.Types.Mixed,
  // images array can contain strings or objects with sizes
  images: [mongoose.Schema.Types.Mixed],
  category: String,
  stock: { type: Number, default: 9999 },
  createdAt: { type: Date, default: Date.now }
});
const Product = (mongoose && mongoose.models && mongoose.models.Product) ? mongoose.models.Product : mongoose.model('Product', ProductSchema);
export default Product;
