'use strict';

const mongoose = require('mongoose');
const { ALLOWED_WINDOWS, WINDOW_CAPACITY } = require('../config/constants');

/**
 * Atomic capacity counter per date + window.
 * bookedCount is incremented only when bookedCount < WINDOW_CAPACITY.
 */
const windowCapacitySchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    window: {
      type: String,
      required: true,
      enum: ALLOWED_WINDOWS,
    },
    bookedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: WINDOW_CAPACITY,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

windowCapacitySchema.index({ date: 1, window: 1 }, { unique: true });

const WindowCapacity = mongoose.model('WindowCapacity', windowCapacitySchema);

module.exports = WindowCapacity;
