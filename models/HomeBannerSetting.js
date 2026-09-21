const mongoose = require('mongoose');

const HomeBannerSlideSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  altText: { type: String, default: 'Stationery product' },
  caption: { type: String, default: '' },
  link: { type: String, default: '/shop' }
}, { _id: false });

const HomeBannerSettingSchema = new mongoose.Schema({
  slides: { type: [HomeBannerSlideSchema], default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.HomeBannerSetting || mongoose.model('HomeBannerSetting', HomeBannerSettingSchema);
