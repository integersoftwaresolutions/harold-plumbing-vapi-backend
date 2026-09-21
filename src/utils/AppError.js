'use strict';

class AppError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [statusCode=400]
   * @param {object} [details]
   */
  constructor(code, message, statusCode = 400, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

module.exports = {
  AppError,
};
