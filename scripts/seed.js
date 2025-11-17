/**
 * Run: node scripts/seed.js
 * Make sure MONGODB_URI is set in env when you run this script.
 */
const mongoose = require('mongoose');
const Product = require('../models/Product').default || require('../models/Product');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI;
if(!uri){ console.error('Set MONGODB_URI'); process.exit(1); }

async function main(){
  await mongoose.connect(uri);
  const data = JSON.parse(fs.readFileSync(path.join(__dirname,'../data/sample_products.json')));
  await Product.deleteMany({});
  await Product.insertMany(data);
  console.log('Seeded products');
  process.exit(0);
}
main().catch(e=>{ console.error(e); process.exit(1); });
