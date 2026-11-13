import mongoose from 'mongoose';

const AuditEntrySchema = new mongoose.Schema({
  action: { type: String, enum: ['created', 'updated', 'finalized', 'unfinalized', 'voided'], required: true },
  actorId: { type: String, default: '' },
  at: { type: Date, default: Date.now },
  reason: { type: String, default: '' },
  changes: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const LedgerTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'sale', 'sales_refund', 'credit_sale', 'customer_payment', 'supplier_purchase',
      'supplier_payment', 'market_purchase', 'expense', 'owner_withdrawal',
      'owner_reimbursement', 'owner_investment', 'other_receipt', 'other_payment',
      'adjustment', 'transfer'
    ],
    required: true,
    index: true
  },
  date: { type: Date, required: true, index: true },
  amountPaise: { type: Number, required: true, min: 1 },
  paidAmountPaise: { type: Number, default: 0, min: 0 },
  paidByAccountPaise: {
    type: new mongoose.Schema({
      cash: { type: Number, min: 0, default: 0 },
      upi: { type: Number, min: 0, default: 0 },
      bank: { type: Number, min: 0, default: 0 },
      other: { type: Number, min: 0, default: 0 }
    }, { _id: false }),
    default: undefined
  },
  ownerContributionPaise: { type: Number, min: 0, default: 0 },
  appliedAmountPaise: { type: Number, min: 0 },
  advanceAppliedPaise: { type: Number, min: 0 },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerParty', default: null, index: true },
  account: { type: String, enum: ['cash', 'upi', 'bank', 'other', 'credit', ''], default: '' },
  transferTo: { type: String, enum: ['cash', 'upi', 'bank', 'other', ''], default: '' },
  category: { type: String, default: '' },
  linkedTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerTransaction', default: null, index: true },
  duplicateGuard: { type: String, default: undefined },
  reference: { type: String, default: '' },
  idempotencyKey: { type: String, default: undefined },
  description: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'finalized', 'voided'], default: 'finalized', index: true },
  voidReason: { type: String, default: '' },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
  audit: { type: [AuditEntrySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

LedgerTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
LedgerTransactionSchema.index({ duplicateGuard: 1 }, { unique: true, sparse: true });
LedgerTransactionSchema.index({ status: 1, date: -1 });
LedgerTransactionSchema.index({ partyId: 1, date: -1 });

const LedgerTransaction = mongoose.models.LedgerTransaction || mongoose.model('LedgerTransaction', LedgerTransactionSchema);
export default LedgerTransaction;
