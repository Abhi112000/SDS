/**
 * Migration: convert numeric money fields to mongoose Decimal128
 * Run with: node ./scripts/migrate-money-to-decimal.js
 */
const dbConnect = require('../lib/mongodb').default || require('../lib/mongodb');
const mongoose = require('mongoose');
const Inventory = require('../models/Inventory').default || require('../models/Inventory');

async function run(){
  try{
    await dbConnect();
    console.log('Connected to DB');
    const items = await Inventory.find({}).lean();
    console.log('Found', items.length, 'inventory items');
    let count = 0;
    for(const it of items){
      const update = {};
      // costPrice
      const cp = it.costPrice;
      if(cp == null || typeof cp === 'number'){
        const val = Number(cp || 0).toFixed(2);
        update.costPrice = mongoose.Types.Decimal128.fromString(val);
      }
      const sp = it.sellingPrice;
      if(sp == null || typeof sp === 'number'){
        const val = Number(sp || 0).toFixed(2);
        update.sellingPrice = mongoose.Types.Decimal128.fromString(val);
      }
      const lp = it.lifetimeProfit;
      if(lp == null || typeof lp === 'number'){
        const val = Number(lp || 0).toFixed(2);
        update.lifetimeProfit = mongoose.Types.Decimal128.fromString(val);
      }
      if(Object.keys(update).length){
        await Inventory.updateOne({ _id: it._id }, { $set: update });
        count++;
      }
    }
    console.log('Updated', count, 'documents');
    process.exit(0);
  }catch(e){
    console.error(e);
    process.exit(1);
  }
}

run();
