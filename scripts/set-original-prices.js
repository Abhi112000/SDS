/**
 * Simple script to set originalPrice for products.
 * Usage:
 *  node scripts/set-original-prices.js --all --factor=1.2   # set originalPrice = price * factor for all products
 *  node scripts/set-original-prices.js --id=<productId> --original=200
 */
const mongoose = require('mongoose');
const Product = require('../models/Product').default || require('../models/Product');
require('dotenv').config();

async function main(){
  const args = require('minimist')(process.argv.slice(2));
  const uri = process.env.MONGODB_URI;
  if(!uri){ console.error('MONGODB_URI required in env'); process.exit(1); }
  await mongoose.connect(uri, {});
  if(args.all){
    const factor = Number(args.factor) || 1.2;
    const prods = await Product.find({});
    for(const p of prods){
      p.originalPrice = Math.round((p.price || 0) * factor);
      await p.save();
      console.log('updated', p._id);
    }
    process.exit(0);
  }
  if(args.id && args.original){
    const p = await Product.findById(args.id);
    if(!p){ console.error('not found'); process.exit(2); }
    p.originalPrice = Number(args.original);
    await p.save();
    console.log('updated', p._id);
    process.exit(0);
  }
  console.log('no action specified'); process.exit(1);
}

main().catch(e=>{ console.error(e); process.exit(2); });
