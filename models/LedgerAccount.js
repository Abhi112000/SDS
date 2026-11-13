import mongoose from 'mongoose';

const ReconciliationSchema = new mongoose.Schema({
  asOfDate: { type: Date, required: true },
  statementBalancePaise: { type: Number, required: true },
  note: { type: String, default: '' },
  actorId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const AccountAuditSchema = new mongoose.Schema({
  action: { type: String, enum: ['opening_balance_updated', 'reconciled'], required: true },
  actorId: { type: String, default: '' },
  at: { type: Date, default: Date.now },
  reason: { type: String, default: '' },
  changes: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const LedgerAccountSchema = new mongoose.Schema({
  account: { type: String, enum: ['cash', 'upi', 'bank', 'other'], required: true, unique: true },
  openingBalancePaise: { type: Number, default: 0, min: 0 },
  openingBalanceDate: { type: Date, default: new Date(0) },
  reconciliations: { type: [ReconciliationSchema], default: [] },
  audit: { type: [AccountAuditSchema], default: [] },
  updatedBy: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

const LedgerAccount = mongoose.models.LedgerAccount || mongoose.model('LedgerAccount', LedgerAccountSchema);
export default LedgerAccount;
