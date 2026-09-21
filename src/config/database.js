'use strict';

const mongoose = require('mongoose');

/**
 * Reuse one connection across Vercel warm invocations.
 * @returns {{ promise: Promise<typeof mongoose>|null }}
 */
function getCache() {
  const g = globalThis;
  if (!g.__haroldsMongoose) {
    g.__haroldsMongoose = { promise: null };
  }
  return g.__haroldsMongoose;
}

/**
 * Connect to MongoDB using MONGODB_URI from the environment.
 * Safe to call on every serverless request; reuses an existing connection.
 * @param {string} [uri]
 * @returns {Promise<typeof mongoose>}
 */
async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return mongoose;
  }

  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    throw new Error('MONGODB_URI is required');
  }

  const cache = getCache();
  if (cache.promise) {
    return cache.promise;
  }

  mongoose.set('strictQuery', true);

  cache.promise = mongoose
    .connect(uri.trim(), {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 5,
    })
    .then(() => mongoose)
    .catch((err) => {
      cache.promise = null;
      throw err;
    });

  return cache.promise;
}

/**
 * @returns {'connected'|'connecting'|'disconnected'|'disconnecting'|'unknown'}
 */
function getDatabaseStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
}

async function disconnectDatabase() {
  const cache = getCache();
  cache.promise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
};
