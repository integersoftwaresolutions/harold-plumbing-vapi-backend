'use strict';

/**
 * Collapse whitespace and trim. Returns empty string for non-strings.
 * @param {unknown} value
 * @returns {string}
 */
function cleanString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize appointment date to YYYY-MM-DD (calendar day, no timezone shift).
 * Accepts YYYY-MM-DD only to avoid ambiguous parsing.
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeAppointmentDate(value) {
  const raw = cleanString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = raw.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  // Reject impossible calendar dates via UTC Date round-trip (date-only, no TZ drift).
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return raw;
}

/**
 * Light phone normalization: keep leading +, digits only elsewhere.
 * @param {unknown} value
 * @returns {string}
 */
function normalizePhone(value) {
  const raw = cleanString(value);
  if (!raw) {
    return '';
  }

  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Basic phone sanity check after normalization.
 * @param {string} phone
 * @returns {boolean}
 */
function isValidPhone(phone) {
  if (!phone) {
    return false;
  }
  // 10–15 digits, optional leading +
  return /^\+?\d{10,15}$/.test(phone);
}

module.exports = {
  cleanString,
  normalizeAppointmentDate,
  normalizePhone,
  isValidPhone,
};
