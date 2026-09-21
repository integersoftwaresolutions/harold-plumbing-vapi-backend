'use strict';

const { getConfig } = require('../config');
const { connectDatabase } = require('../config/database');

/**
 * Connect (or reuse) MongoDB before handling a request.
 * Required on Vercel, where there is no long-lived process startup.
 */
async function ensureDatabase(req, res, next) {
  const { mongoUri } = getConfig();

  if (!mongoUri) {
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Missing MONGODB_URI. Set it in the environment variables.',
    });
  }

  try {
    await connectDatabase(mongoUri);
    return next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection failed:', err.message);
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database unavailable.',
    });
  }
}

module.exports = {
  ensureDatabase,
};
