const mongoose = require('mongoose');

const InvoiceSettingSchema = new mongoose.Schema({
  brandName: { type: String, default: 'Shree Durga Stationary' },
  address: { type: String, default: 'Shop No. 12, Market Road, City Name, State - ZIP' },
  phone: { type: String, default: '9818630972, 8077148123' },
  email: { type: String, default: 'contact.sdstationary@gmail.com' },
  // use provided logo.jpeg by default (no cropping, will be resized via CSS)
  logoPath: { type: String, default: '/images/logo.jpeg' },
  watermarkText: { type: String, default: 'SD Stationary invoice' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.InvoiceSetting || mongoose.model('InvoiceSetting', InvoiceSettingSchema);
