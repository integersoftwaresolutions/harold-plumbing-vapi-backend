'use strict';

const { z } = require('zod');
const { ALLOWED_WINDOWS } = require('../config/constants');
const {
  cleanString,
  normalizeAppointmentDate,
  normalizePhone,
  isValidPhone,
} = require('./normalize');
const { AppError } = require('./AppError');

const windowSchema = z
  .string()
  .transform((v) => cleanString(v))
  .refine((v) => ALLOWED_WINDOWS.includes(v), {
    message: 'Invalid appointment window.',
  });

const dateSchema = z
  .string()
  .transform((v) => normalizeAppointmentDate(v))
  .refine((v) => v !== null, {
    message: 'Invalid date. Use YYYY-MM-DD.',
  });

const checkAvailabilitySchema = z.object({
  date: dateSchema,
  window: windowSchema,
});

const bookInspectionSchema = z.object({
  name: z
    .string()
    .transform((v) => cleanString(v))
    .refine((v) => v.length >= 2 && v.length <= 120, {
      message: 'Name is required.',
    }),
  phone: z
    .string()
    .transform((v) => normalizePhone(v))
    .refine((v) => isValidPhone(v), {
      message: 'Invalid phone number.',
    }),
  address: z
    .string()
    .transform((v) => cleanString(v))
    .refine((v) => v.length >= 5 && v.length <= 300, {
      message: 'Address is required.',
    }),
  issue: z
    .string()
    .transform((v) => cleanString(v))
    .refine((v) => v.length >= 3 && v.length <= 500, {
      message: 'Issue description is required.',
    }),
  date: dateSchema,
  window: windowSchema,
});

const logSpamSchema = z.object({
  vendorName: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((v) => {
      const cleaned = cleanString(v == null ? '' : v);
      return cleaned || 'Unknown';
    }),
  pitchSummary: z
    .string()
    .transform((v) => cleanString(v))
    .refine((v) => v.length >= 2 && v.length <= 1000, {
      message: 'pitchSummary is required.',
    }),
});

/**
 * Parse with Zod and throw AppError on failure.
 * @template T
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} payload
 * @returns {T}
 */
function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (result.success) {
    return result.data;
  }

  const first = result.error.issues[0];
  const message = first?.message || 'Invalid request payload.';
  throw new AppError('VALIDATION_ERROR', message, 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

module.exports = {
  checkAvailabilitySchema,
  bookInspectionSchema,
  logSpamSchema,
  parseOrThrow,
};
