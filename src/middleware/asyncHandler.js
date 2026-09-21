'use strict';

/**
 * Wrap async route handlers so rejections reach the error middleware.
 * @param {(req,res,next)=>Promise<unknown>} fn
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  asyncHandler,
};
