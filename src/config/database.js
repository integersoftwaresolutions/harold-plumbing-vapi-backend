'use strict';

const mongoose = require('mongoose');

/**
 * Connect to MongoDB using MONGODB_URI from the environment.
 * @param {string} [uri]
 * @returns {Promise<typeof mongoose>}
 */
async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    throw new Error('MONGODB_URI is required');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri.trim(), {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10,
  });

  return mongoose;
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
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
};
