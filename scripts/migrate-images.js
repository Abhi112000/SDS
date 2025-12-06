/**
 * Run: node scripts/migrate-images.js
 * This script will convert legacy `image` string fields and string entries inside `images` array
 * into standardized image objects: { url: <string>, legacy: true }
 * It updates Product.image to object shape and Product.images to array of objects where needed.
 * Make sure MONGODB_URI is set in your environment when running.
 */

const mongoose = require('mongoose');
const Product = require('../models/Product').default || require('../models/Product');
const uri = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL;
if(!uri){ console.error('Set MONGODB_URI environment variable'); process.exit(1); }

async function main(){
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');
  const cursor = Product.find({ $or: [ { image: { $type: 'string' } }, { images: { $elemMatch: { $type: 'string' } } } ] }).cursor();
  let count = 0;
  for(let doc = await cursor.next(); doc != null; doc = await cursor.next()){
    const updates = {};
    // convert image string to object
    if(typeof doc.image === 'string' && doc.image){
      updates.image = { url: doc.image, legacy: true };
    }
    // convert images array elements that are strings into objects
    if(Array.isArray(doc.images) && doc.images.some(i => typeof i === 'string')){
      const newImages = (doc.images || []).map(i => (typeof i === 'string' ? { url: i, legacy: true } : i));
      updates.images = newImages;
    }

    // if product had only image and no images array, create images array from image
    if(!Array.isArray(doc.images) && typeof doc.image === 'string' && doc.image){
      updates.images = [{ url: doc.image, legacy: true }];
      updates.image = { url: doc.image, legacy: true };
    }

    if(Object.keys(updates).length){
      await Product.updateOne({ _id: doc._id }, { $set: updates });
      count++;
      console.log('Updated', doc._id.toString());
    }
  }
  console.log('Migration complete. Documents updated:', count);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
