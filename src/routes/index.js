'use strict';

const express = require('express');
const healthController = require('../controllers/healthController');
const bookingController = require('../controllers/bookingController');
const spamController = require('../controllers/spamController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { optionalVapiSecret } = require('../middleware/auth');

const router = express.Router();

router.get('/health', healthController.health);

router.post(
  '/api/check-availability',
  optionalVapiSecret,
  asyncHandler(bookingController.checkAvailability)
);

router.post(
  '/api/book-inspection',
  optionalVapiSecret,
  asyncHandler(bookingController.bookInspection)
);

router.post(
  '/api/log-spam',
  optionalVapiSecret,
  asyncHandler(spamController.logSpam)
);

module.exports = router;
