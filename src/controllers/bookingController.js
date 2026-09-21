'use strict';

const bookingService = require('../services/bookingService');
const { checkAvailabilitySchema, bookInspectionSchema, parseOrThrow } = require('../utils/validation');

async function checkAvailability(req, res) {
  const data = parseOrThrow(checkAvailabilitySchema, req.body);
  const result = await bookingService.checkAvailability(data.date, data.window);
  res.status(200).json(result);
}

async function bookInspection(req, res) {
  const data = parseOrThrow(bookInspectionSchema, req.body);
  const result = await bookingService.bookInspection(data);
  res.status(200).json(result);
}

module.exports = {
  checkAvailability,
  bookInspection,
};
