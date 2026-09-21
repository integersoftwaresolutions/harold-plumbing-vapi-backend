'use strict';

const crypto = require('crypto');

/**
 * Generate a short human-friendly confirmation ID, e.g. HP-7F2A91
 * @returns {string}
 */
function generateConfirmationId() {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `HP-${suffix}`;
}

module.exports = {
  generateConfirmationId,
};
