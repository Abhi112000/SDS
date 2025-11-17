/*
 * Usage: node scripts/import-products.js [path/to/file.json]
 * If no path provided, it will attempt to import all .json files in /data
 * The script performs idempotent upserts by sku (if present) or title.
 */
import fs from 'fs';
import path from 'path';
import dbConnect from '../lib/dbConnect';
import Product from '../models/Product';

async function importFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const items = JSON.parse(raw);
  if (!Array.isArray(items)) throw new Error('JSON must be an array of products');

  let imported = 0;
  for (const item of items) {
    const query = item.sku ? { sku: item.sku } : { title: item.title };
    const update = { $set: { ...item, updatedAt: new Date() } };
    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
    await Product.findOneAndUpdate(query, update, opts).exec();
    imported++;
  }
  return imported;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI not set — import will not run. Set it and retry.');
    process.exit(0);
  }

  await dbConnect();

  const arg = process.argv[2];
  const base = path.join(process.cwd(), 'data');
  const files = [];
  if (arg) {
    const p = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
    if (!fs.existsSync(p)) {
      console.error('File not found:', p);
      process.exit(1);
    }
    files.push(p);
  } else {
    if (!fs.existsSync(base)) {
      console.error('No data directory found at', base);
      process.exit(1);
    }
    for (const f of fs.readdirSync(base)) {
      if (f.toLowerCase().endsWith('.json')) files.push(path.join(base, f));
    }
  }

  if (!files.length) {
    console.error('No JSON files found to import.');
    process.exit(1);
  }

  let total = 0;
  for (const f of files) {
    try {
      const count = await importFile(f);
      console.log(`Imported ${count} items from ${path.basename(f)}`);
      total += count;
    } catch (err) {
      console.error('Failed to import', f, err.message || err);
    }
  }
  console.log(`Import complete — total items processed: ${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
