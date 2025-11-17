// Compatibility shim: many files import from lib/mongodb — re-export our dbConnect
import dbConnect from './dbConnect';

export default dbConnect;
