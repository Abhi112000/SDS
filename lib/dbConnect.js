import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || null;

async function dbConnect() {
  if (!MONGODB_URI) {
    console.warn('Warning: MONGODB_URI is not set. Database operations will not work. Define it in .env.local to enable DB.');
    return null;
  }

  // If already connected, reuse the existing connection
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    // readyState 1 means connected
    return mongoose;
  }

  // Keep mongoose bufferCommands enabled (default) so queries issued
  // while the driver is still establishing a connection don't throw.
  const connectOpts = { serverSelectionTimeoutMS: 10000 };
  if (MONGODB_DB) connectOpts.dbName = MONGODB_DB;

  try {
    await mongoose.connect(MONGODB_URI, connectOpts);
    try {
      const db = mongoose.connection.db;
      const dbName = (MONGODB_DB && MONGODB_DB) || (db && db.databaseName) || '(unknown)';
      console.log(`MongoDB connected: ${dbName}`);
    } catch (metaErr) {
      console.log('MongoDB connected (could not read meta):', metaErr.message || metaErr);
    }
    return mongoose;
  } catch (err) {
    console.error('MongoDB connection error:', err.message || err);
    throw err;
  }
}

export default dbConnect;
