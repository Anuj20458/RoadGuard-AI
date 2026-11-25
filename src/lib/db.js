import mongoose from "mongoose";

/**
 * Global cache so Next.js development hot-reloads reuse the same
 * Mongoose connection instead of opening a new one on every reload.
 */
const globalForMongoose = globalThis;

if (!globalForMongoose.__mongooseCache) {
  globalForMongoose.__mongooseCache = {
    conn: null,
    promise: null,
  };
}

const cached = globalForMongoose.__mongooseCache;

/**
 * Connects to MongoDB Atlas using Mongoose and caches the active connection.
 *
 * @returns {Promise<typeof mongoose>} The connected Mongoose instance.
 */
export async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (mongoose.connection.readyState !== 1) {
    cached.conn = null;
  }

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    const error = new Error("MONGODB_URI environment variable is not defined.");
    error.code = "MISSING_MONGODB_URI";
    throw error;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(mongoUri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000,
      })
      .then((mongooseInstance) => mongooseInstance);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }

  return cached.conn;
}

export default connectDB;
