/**
 * Run: node scripts/create-admin.js
 * Usage: MONGODB_URI="..." ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=pass node scripts/create-admin.js
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User').default || require('../models/User');

const uri = process.env.MONGODB_URI;
if(!uri){ console.error('Set MONGODB_URI'); process.exit(1); }

async function main(){
  await mongoose.connect(uri);
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'password123';
  const hash = await bcrypt.hash(password, 10);
  const now = new Date();
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { name: 'Local Admin', email, passwordHash: hash, role: 'admin', disabled: false, createdAt: now } },
    { upsert: true, new: true }
  );
  console.log('Admin created/updated:', user.email);
  console.log('Credentials ->', email, password);
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1); });
