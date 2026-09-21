'use strict';

/**
 * Development seed helper.
 *
 * Usage:
 *   node scripts/seed.js
 *   node scripts/seed.js --date 2026-09-25 --window 8am-12pm --count 3
 *   node scripts/seed.js --date 2026-09-25 --window 8am-12pm --count 3 --reset
 *
 * --reset clears InspectionBooking + WindowCapacity for that date/window first.
 * Never expose this script as a public HTTP route.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { InspectionBooking, WindowCapacity } = require('../src/models');
const { ALLOWED_WINDOWS, WINDOW_CAPACITY, APPOINTMENT_TYPE, BOOKING_STATUS } = require('../src/config/constants');
const { generateConfirmationId } = require('../src/utils/confirmationId');
const { normalizeAppointmentDate } = require('../src/utils/normalize');

function parseArgs(argv) {
  const args = {
    date: '2026-09-25',
    window: '8am-12pm',
    count: WINDOW_CAPACITY,
    reset: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--date') args.date = argv[++i];
    else if (token === '--window') args.window = argv[++i];
    else if (token === '--count') args.count = Number.parseInt(argv[++i], 10);
    else if (token === '--reset') args.reset = true;
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const date = normalizeAppointmentDate(args.date);
  const window = args.window;
  const count = args.count;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in .env');
  }
  if (!date) {
    throw new Error('Invalid --date. Use YYYY-MM-DD.');
  }
  if (!ALLOWED_WINDOWS.includes(window)) {
    throw new Error(`Invalid --window. Allowed: ${ALLOWED_WINDOWS.join(', ')}`);
  }
  if (!Number.isInteger(count) || count < 0 || count > WINDOW_CAPACITY) {
    throw new Error(`--count must be an integer from 0 to ${WINDOW_CAPACITY}`);
  }

  await connectDatabase(process.env.MONGODB_URI);

  if (args.reset) {
    await InspectionBooking.deleteMany({ date, window });
    await WindowCapacity.deleteMany({ date, window });
    // eslint-disable-next-line no-console
    console.log(`Reset bookings/capacity for ${date} ${window}`);
  }

  const existing = await InspectionBooking.countDocuments({
    date,
    window,
    status: BOOKING_STATUS.CONFIRMED,
  });

  const toCreate = Math.max(0, count - existing);
  const docs = [];

  for (let i = 0; i < toCreate; i += 1) {
    docs.push({
      confirmationId: generateConfirmationId(),
      name: `Seed Customer ${existing + i + 1}`,
      phone: `+1206555${String(1000 + existing + i).slice(-4)}`,
      address: `${100 + existing + i} Seed Street, Seattle`,
      issue: 'Seeded inspection for capacity testing',
      date,
      window,
      appointmentType: APPOINTMENT_TYPE,
      status: BOOKING_STATUS.CONFIRMED,
    });
  }

  if (docs.length) {
    await InspectionBooking.insertMany(docs);
  }

  await WindowCapacity.findOneAndUpdate(
    { date, window },
    {
      $set: {
        date,
        window,
        bookedCount: Math.min(WINDOW_CAPACITY, existing + docs.length),
      },
    },
    { upsert: true, new: true }
  );

  const finalCount = await InspectionBooking.countDocuments({
    date,
    window,
    status: BOOKING_STATUS.CONFIRMED,
  });
  const capacity = await WindowCapacity.findOne({ date, window }).lean();

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        date,
        window,
        createdNow: docs.length,
        jobsBooked: finalCount,
        capacityBookedCount: capacity?.bookedCount ?? 0,
        capacity: WINDOW_CAPACITY,
        full: finalCount >= WINDOW_CAPACITY,
      },
      null,
      2
    )
  );

  await disconnectDatabase();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err);
  try {
    await disconnectDatabase();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
