'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const { getConfig } = require('./config');
const routes = require('./routes');
const { ensureDatabase } = require('./middleware/ensureDatabase');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp() {
  const config = getConfig();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: config.bodySizeLimit }));
  app.use(
    mongoSanitize({
      replaceWith: '_',
      allowDots: true,
    })
  );
  app.use(ensureDatabase);

  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
