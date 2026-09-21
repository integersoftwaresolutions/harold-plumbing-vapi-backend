'use strict';

const { InspectionBooking, WindowCapacity } = require('../models');
const { WINDOW_CAPACITY, APPOINTMENT_TYPE, BOOKING_STATUS } = require('../config/constants');
const { generateConfirmationId } = require('../utils/confirmationId');
const { AppError } = require('../utils/AppError');

/**
 * Ensure a capacity document exists for date+window.
 * Unique index makes concurrent first-creates safe (retry on duplicate key).
 */
async function ensureCapacityDoc(date, window) {
  try {
    await WindowCapacity.updateOne(
      { date, window },
      { $setOnInsert: { date, window, bookedCount: 0 } },
      { upsert: true }
    );
  } catch (err) {
    // Another request may have created it simultaneously.
    if (err && err.code === 11000) {
      return;
    }
    throw err;
  }
}

/**
 * Atomically claim one slot if capacity remains.
 * @returns {Promise<object|null>} updated capacity doc, or null if full
 */
async function tryReserveSlot(date, window) {
  await ensureCapacityDoc(date, window);

  return WindowCapacity.findOneAndUpdate(
    { date, window, bookedCount: { $lt: WINDOW_CAPACITY } },
    { $inc: { bookedCount: 1 } },
    { new: true }
  );
}

/**
 * Release a previously reserved slot (compensation on booking write failure).
 */
async function releaseSlot(date, window) {
  await WindowCapacity.findOneAndUpdate(
    { date, window, bookedCount: { $gt: 0 } },
    { $inc: { bookedCount: -1 } },
    { new: true }
  );
}

/**
 * Lightweight availability check for live voice calls.
 */
async function checkAvailability(date, window) {
  const capacityDoc = await WindowCapacity.findOne({ date, window }).lean();
  const jobsBooked = capacityDoc ? capacityDoc.bookedCount : 0;
  const remainingSlots = Math.max(0, WINDOW_CAPACITY - jobsBooked);

  return {
    success: true,
    available: remainingSlots > 0,
    date,
    window,
    jobsBooked,
    capacity: WINDOW_CAPACITY,
    remainingSlots,
  };
}

/**
 * Book an inspection with atomic capacity reservation to prevent overbooking.
 */
async function bookInspection(payload) {
  const { name, phone, address, issue, date, window } = payload;

  const reserved = await tryReserveSlot(date, window);
  if (!reserved) {
    return {
      success: true,
      booked: false,
      reason: 'WINDOW_FULL',
      date,
      window,
    };
  }

  let confirmationId = generateConfirmationId();
  let booking;

  try {
    // Rare confirmationId collision: retry a few times.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        booking = await InspectionBooking.create({
          confirmationId,
          name,
          phone,
          address,
          issue,
          date,
          window,
          appointmentType: APPOINTMENT_TYPE,
          status: BOOKING_STATUS.CONFIRMED,
        });
        break;
      } catch (err) {
        if (err && err.code === 11000 && err.keyPattern && err.keyPattern.confirmationId) {
          confirmationId = generateConfirmationId();
          continue;
        }
        throw err;
      }
    }

    if (!booking) {
      throw new AppError('INTERNAL_ERROR', 'Unable to process the request.', 500);
    }
  } catch (err) {
    await releaseSlot(date, window);
    throw err;
  }

  return {
    success: true,
    booked: true,
    confirmationId: booking.confirmationId,
    appointmentType: APPOINTMENT_TYPE,
    date: booking.date,
    window: booking.window,
  };
}

module.exports = {
  checkAvailability,
  bookInspection,
  tryReserveSlot,
  releaseSlot,
  ensureCapacityDoc,
};
