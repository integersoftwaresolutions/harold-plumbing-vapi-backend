'use strict';

const { AppError } = require('../utils/AppError');
const { getConfig } = require('../config');

/**
 * Optional shared-secret gate for /api/* routes.
 * Disabled when VAPI_TOOL_SECRET is empty/unset.
 */
function optionalVapiSecret(req, res, next) {
  const { authEnabled, vapiToolSecret } = getConfig();

  if (!authEnabled) {
    return next();
  }

  const provided = req.get('X-Vapi-Tool-Secret') || req.get('x-vapi-tool-secret') || '';

  if (!provided || provided !== vapiToolSecret) {
    return next(
      new AppError('UNAUTHORIZED', 'Invalid or missing Vapi tool secret.', 401)
    );
  }

  return next();
}

module.exports = {
  optionalVapiSecret,
};
