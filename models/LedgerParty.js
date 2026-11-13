import mongoose from 'mongoose';

const LedgerPartySchema = new mongoose.Schema({
  type: { type: String, enum: ['customer', 'supplier'], required: true, index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  phoneNormalized: { type: String, default: '', index: true },
  address: { type: String, default: '' },
  notes: { type: String, default: '' },
  linkedUserId: { type: String, default: '' },
  openingBalancePaise: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

LedgerPartySchema.add({
  audit: [{
    action: { type: String, enum: ['created', 'updated', 'archived', 'restored'], required: true },
    actorId: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} }
  }]
});

LedgerPartySchema.index({ type: 1, name: 1 });
LedgerPartySchema.index({ type: 1, phoneNormalized: 1 });

const LedgerParty = mongoose.models.LedgerParty || mongoose.model('LedgerParty', LedgerPartySchema);
export default LedgerParty;
