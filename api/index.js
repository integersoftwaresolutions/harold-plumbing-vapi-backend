'use strict';

/**
 * Vercel serverless entry. Do not call app.listen() here.
 * vercel.json routes every HTTP path to this file so Express owns routing
 * (/health, /api/check-availability, /api/book-inspection, /api/log-spam).
 */
const { loadEnv } = require('../src/config');
const { createApp } = require('../src/app');

loadEnv();

module.exports = createApp();
