const mongoose = require('mongoose');

const VisitorSettingSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.VisitorSetting || mongoose.model('VisitorSetting', VisitorSettingSchema);
