'use strict';

const { loadEnv, getConfig } = require('./config');
const { connectDatabase } = require('./config/database');
const { createApp } = require('./app');

loadEnv();

async function start() {
  const config = getConfig();

  if (!config.mongoUri) {
    // eslint-disable-next-line no-console
    console.error('Missing MONGODB_URI. Copy .env.example to .env and set your connection string.');
    process.exit(1);
  }

  try {
    await connectDatabase(config.mongoUri);
    // eslint-disable-next-line no-console
    console.log('MongoDB connected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Harold's Plumbing Vapi backend listening on port ${config.port}`);
    // eslint-disable-next-line no-console
    console.log(`Auth: ${config.authEnabled ? 'VAPI_TOOL_SECRET enabled' : 'disabled (dev mode)'}`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`${signal} received, shutting down...`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
