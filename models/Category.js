import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  createdAt: { type: Date, default: Date.now }
});

CategorySchema.index({ parentId: 1, name: 1 }, { unique: true, sparse: true });

const Category = (mongoose && mongoose.models && mongoose.models.Category) ? mongoose.models.Category : mongoose.model('Category', CategorySchema);
export default Category;
