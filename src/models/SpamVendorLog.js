'use strict';

const mongoose = require('mongoose');

const spamVendorLogSchema = new mongoose.Schema(
  {
    vendorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      default: 'Unknown',
    },
    pitchSummary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

spamVendorLogSchema.index({ createdAt: -1 });

const SpamVendorLog = mongoose.model('SpamVendorLog', spamVendorLogSchema);

module.exports = SpamVendorLog;
