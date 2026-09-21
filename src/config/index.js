'use strict';

const { ALLOWED_WINDOWS, WINDOW_CAPACITY, APPOINTMENT_TYPE, BOOKING_STATUS } = require('./constants');

function loadEnv() {
  // eslint-disable-next-line global-require
  require('dotenv').config();
}

function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const mongoUri = process.env.MONGODB_URI || '';
  const vapiToolSecret = (process.env.VAPI_TOOL_SECRET || '').trim();
  const bodySizeLimit = process.env.BODY_SIZE_LIMIT || '32kb';

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: Number.isFinite(port) && port > 0 ? port : 3000,
    mongoUri,
    vapiToolSecret,
    authEnabled: Boolean(vapiToolSecret),
    bodySizeLimit,
    allowedWindows: ALLOWED_WINDOWS,
    windowCapacity: WINDOW_CAPACITY,
    appointmentType: APPOINTMENT_TYPE,
    bookingStatus: BOOKING_STATUS,
  };
}

module.exports = {
  loadEnv,
  getConfig,
};
