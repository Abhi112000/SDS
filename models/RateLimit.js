import mongoose from 'mongoose';

const RateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  points: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

// TTL index will be set dynamically in code via expireAfterSeconds when using aggregation; keep simple for now
export default mongoose.models.RateLimit || mongoose.model('RateLimit', RateLimitSchema);
