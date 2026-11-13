import mongoose from 'mongoose';

const LedgerExpenseCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  createdBy: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const LedgerExpenseCategory = mongoose.models.LedgerExpenseCategory || mongoose.model('LedgerExpenseCategory', LedgerExpenseCategorySchema);
export default LedgerExpenseCategory;
