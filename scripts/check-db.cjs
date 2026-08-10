const mongoose = require('mongoose');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

async function checkDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Add it to .env.local before starting the dev server.');
  }

  const options = { serverSelectionTimeoutMS: 10000 };
  if (process.env.MONGODB_DB) options.dbName = process.env.MONGODB_DB;

  try {
    await mongoose.connect(uri, options);
    const databaseName = process.env.MONGODB_DB || mongoose.connection.db?.databaseName || '(unknown)';
    console.log(`MongoDB preflight passed: ${databaseName}`);
  } finally {
    await mongoose.disconnect();
  }
}

checkDatabase().catch(error => {
  console.error(`MongoDB preflight failed: ${error.message || error}`);
  process.exit(1);
});
