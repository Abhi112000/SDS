const mongoose = require('mongoose');

const VisitorSessionSchema = new mongoose.Schema({
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  userName: { type: String, default: '' },
  email: { type: String, default: '' },
  deviceType: {
    type: String,
    default: 'unknown',
    enum: ['desktop', 'laptop', 'phone', 'tablet', 'unknown']
  },
  userAgent: { type: String, default: '' },
  page: { type: String, default: '/' },
  pageHistory: [{
    path: { type: String, default: '/' },
    title: { type: String, default: '' },
    action: { type: String, default: 'visit' },
    deviceType: { type: String, default: 'unknown' },
    userAgent: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  }],
  isActive: { type: Boolean, default: true },
  startedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.models.VisitorSession || mongoose.model('VisitorSession', VisitorSessionSchema);
