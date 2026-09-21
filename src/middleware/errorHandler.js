'use strict';

const { AppError } = require('../utils/AppError');
const { getConfig } = require('../config');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { isProduction } = getConfig();

  if (err instanceof AppError) {
    const body = {
      success: false,
      error: err.code,
      message: err.message,
    };
    if (!isProduction && err.details) {
      body.details = err.details;
    }
    return res.status(err.statusCode).json(body);
  }

  // Zod-like / mongoose validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: err.message || 'Invalid request payload.',
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Invalid request payload.',
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'CONFLICT',
      message: 'A conflicting record already exists.',
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Invalid JSON body.',
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large.',
    });
  }

  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  return res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'Unable to process the request.',
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: 'Endpoint not found.',
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
