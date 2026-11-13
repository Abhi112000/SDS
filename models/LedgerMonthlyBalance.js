import mongoose from 'mongoose';

const LedgerMonthlyBalanceSchema = new mongoose.Schema({
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, unique: true },
  openingBalancePaise: { type: Number, required: true, min: 0 },
  note: { type: String, default: '' },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const LedgerMonthlyBalance = mongoose.models.LedgerMonthlyBalance ||
  mongoose.model('LedgerMonthlyBalance', LedgerMonthlyBalanceSchema);
export default LedgerMonthlyBalance;
