'use strict';

const mongoose = require('mongoose');
const { ALLOWED_WINDOWS, APPOINTMENT_TYPE, BOOKING_STATUS } = require('../config/constants');

const inspectionBookingSchema = new mongoose.Schema(
  {
    confirmationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    issue: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    /** Normalized calendar date YYYY-MM-DD (Pacific business day windows; no time component). */
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    window: {
      type: String,
      required: true,
      enum: ALLOWED_WINDOWS,
    },
    appointmentType: {
      type: String,
      required: true,
      default: APPOINTMENT_TYPE,
      enum: [APPOINTMENT_TYPE],
    },
    status: {
      type: String,
      required: true,
      default: BOOKING_STATUS.CONFIRMED,
      enum: Object.values(BOOKING_STATUS),
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

inspectionBookingSchema.index({ date: 1, window: 1, status: 1 });
inspectionBookingSchema.index({ confirmationId: 1 }, { unique: true });

const InspectionBooking = mongoose.model('InspectionBooking', inspectionBookingSchema);

module.exports = InspectionBooking;
