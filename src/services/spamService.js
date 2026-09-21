'use strict';

const { SpamVendorLog } = require('../models');

async function logSpam({ vendorName, pitchSummary }) {
  await SpamVendorLog.create({
    vendorName,
    pitchSummary,
  });

  return {
    success: true,
    logged: true,
  };
}

module.exports = {
  logSpam,
};
