import dbConnect from '@/lib/mongodb';
import RateLimit from '@/models/RateLimit';

// simple Mongo-backed rate limiter using points per key with expiry semantics
export default function rateLimit({ points = 5, windowSeconds = 60 } = {}){
  return async (key) => {
    await dbConnect();
    const now = new Date();
    const rl = await RateLimit.findOne({ key }).exec();
    if(!rl){
      await RateLimit.create({ key, points: 1, updatedAt: now });
      return true;
    }
    // if last update older than window, reset
    const age = (now - rl.updatedAt) / 1000;
    if(age > windowSeconds){
      rl.points = 1; rl.updatedAt = now; await rl.save(); return true;
    }
    if(rl.points >= points) return false;
    rl.points += 1; rl.updatedAt = now; await rl.save();
    return true;
  }
}
