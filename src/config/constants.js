'use strict';

const ALLOWED_WINDOWS = Object.freeze(['8am-12pm', '12pm-5pm']);
const WINDOW_CAPACITY = 3;
const APPOINTMENT_TYPE = 'inspection';
const BOOKING_STATUS = Object.freeze({
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
});

module.exports = {
  ALLOWED_WINDOWS,
  WINDOW_CAPACITY,
  APPOINTMENT_TYPE,
  BOOKING_STATUS,
};
