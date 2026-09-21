'use strict';

const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const request = require('supertest');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

process.env.NODE_ENV = 'test';
process.env.VAPI_TOOL_SECRET = '';

const { createApp } = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { InspectionBooking, WindowCapacity, SpamVendorLog } = require('../src/models');
const { WINDOW_CAPACITY } = require('../src/config/constants');

/**
 * Prefer an explicit test URI; otherwise derive from MONGODB_URI; otherwise local default.
 * Uses a dedicated database name so tests do not wipe demo data.
 */
function resolveTestMongoUri() {
  if (process.env.TEST_MONGODB_URI) {
    return process.env.TEST_MONGODB_URI;
  }
  const base = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/harolds-plumbing';
  // Swap / append db name for isolation
  if (base.includes('/harolds-plumbing')) {
    return base.replace('/harolds-plumbing', '/harolds-plumbing-test');
  }
  return 'mongodb://127.0.0.1:27017/harolds-plumbing-test';
}

describe("Harold's Plumbing Vapi backend", () => {
  /** @type {import('express').Express} */
  let app;
  let usedMemoryServer = false;
  /** @type {import('mongodb-memory-server').MongoMemoryServer|null} */
  let mongoServer = null;

  before(async () => {
    let uri = resolveTestMongoUri();

    try {
      await connectDatabase(uri);
    } catch (err) {
      // Fallback: in-memory MongoDB when Docker/local Mongo is unavailable.
      // eslint-disable-next-line no-console
      console.warn(`External MongoDB unavailable (${err.message}). Trying mongodb-memory-server...`);
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
      usedMemoryServer = true;
      process.env.MONGODB_URI = uri;
      await connectDatabase(uri);
    }

    process.env.MONGODB_URI = uri;
    app = createApp();
  });

  after(async () => {
    await disconnectDatabase();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Promise.all([
      InspectionBooking.deleteMany({}),
      WindowCapacity.deleteMany({}),
      SpamVendorLog.deleteMany({}),
    ]);
  });

  it('GET /health returns ok and mongodb status', async () => {
    const res = await request(app).get('/health').expect(200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.service, 'harolds-plumbing-vapi-backend');
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.mongodb, 'connected');
  });

  it('POST /api/check-availability reports empty slot available', async () => {
    const res = await request(app)
      .post('/api/check-availability')
      .send({ date: '2026-09-25', window: '8am-12pm' })
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.available, true);
    assert.equal(res.body.jobsBooked, 0);
    assert.equal(res.body.capacity, WINDOW_CAPACITY);
    assert.equal(res.body.remainingSlots, 3);
  });

  it('POST /api/book-inspection books first inspection', async () => {
    const res = await request(app)
      .post('/api/book-inspection')
      .send({
        name: 'John Smith',
        phone: '+12065551234',
        address: '123 Main Street, Seattle',
        issue: 'Water heater leaking',
        date: '2026-09-25',
        window: '8am-12pm',
      })
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.booked, true);
    assert.match(res.body.confirmationId, /^HP-[A-F0-9]{6}$/);
    assert.equal(res.body.appointmentType, 'inspection');
  });

  it('availability decreases after a booking', async () => {
    await request(app)
      .post('/api/book-inspection')
      .send({
        name: 'Jane Doe',
        phone: '2065551234',
        address: '456 Pine Street, Seattle',
        issue: 'Clogged drain',
        date: '2026-09-25',
        window: '8am-12pm',
      })
      .expect(200);

    const res = await request(app)
      .post('/api/check-availability')
      .send({ date: '2026-09-25', window: '8am-12pm' })
      .expect(200);

    assert.equal(res.body.jobsBooked, 1);
    assert.equal(res.body.remainingSlots, 2);
    assert.equal(res.body.available, true);
  });

  it('three bookings fill the window and fourth is rejected', async () => {
    const date = '2026-09-26';
    const window = '12pm-5pm';

    for (let i = 1; i <= 3; i += 1) {
      const res = await request(app)
        .post('/api/book-inspection')
        .send({
          name: `Customer ${i}`,
          phone: `+1206555100${i}`,
          address: `${i}00 Oak Ave, Seattle`,
          issue: `Issue ${i}`,
          date,
          window,
        })
        .expect(200);
      assert.equal(res.body.booked, true);
    }

    const availability = await request(app)
      .post('/api/check-availability')
      .send({ date, window })
      .expect(200);

    assert.equal(availability.body.available, false);
    assert.equal(availability.body.jobsBooked, 3);
    assert.equal(availability.body.remainingSlots, 0);

    const fourth = await request(app)
      .post('/api/book-inspection')
      .send({
        name: 'Overflow Customer',
        phone: '+12065551999',
        address: '999 Full Street, Seattle',
        issue: 'Should not book',
        date,
        window,
      })
      .expect(200);

    assert.equal(fourth.body.success, true);
    assert.equal(fourth.body.booked, false);
    assert.equal(fourth.body.reason, 'WINDOW_FULL');

    const count = await InspectionBooking.countDocuments({ date, window });
    assert.equal(count, 3);
  });

  it('rejects concurrent overbooking beyond capacity', async () => {
    const date = '2026-09-27';
    const window = '8am-12pm';

    const payloads = Array.from({ length: 8 }, (_, i) => ({
      name: `Race ${i}`,
      phone: `+12065552${String(100 + i).slice(-3)}`,
      address: `${i} Race Lane, Seattle`,
      issue: 'Concurrent booking test',
      date,
      window,
    }));

    const results = await Promise.all(
      payloads.map((body) => request(app).post('/api/book-inspection').send(body))
    );

    const booked = results.filter((r) => r.status === 200 && r.body.booked === true);
    const rejected = results.filter(
      (r) => r.status === 200 && r.body.booked === false && r.body.reason === 'WINDOW_FULL'
    );

    assert.equal(booked.length, 3);
    assert.equal(rejected.length, 5);

    const count = await InspectionBooking.countDocuments({ date, window, status: 'confirmed' });
    assert.equal(count, 3);

    const capacity = await WindowCapacity.findOne({ date, window }).lean();
    assert.equal(capacity.bookedCount, 3);
  });

  it('rejects invalid appointment window', async () => {
    const res = await request(app)
      .post('/api/check-availability')
      .send({ date: '2026-09-25', window: '9am-11am' })
      .expect(400);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'VALIDATION_ERROR');
  });

  it('rejects invalid date and missing booking fields', async () => {
    const badDate = await request(app)
      .post('/api/check-availability')
      .send({ date: '09-25-2026', window: '8am-12pm' })
      .expect(400);
    assert.equal(badDate.body.error, 'VALIDATION_ERROR');

    const missing = await request(app)
      .post('/api/book-inspection')
      .send({
        name: 'No Phone',
        address: '123 Main Street, Seattle',
        issue: 'Leak',
        date: '2026-09-25',
        window: '8am-12pm',
      })
      .expect(400);
    assert.equal(missing.body.error, 'VALIDATION_ERROR');
  });

  it('POST /api/log-spam stores vendor pitch', async () => {
    const res = await request(app)
      .post('/api/log-spam')
      .send({
        vendorName: 'ABC Marketing',
        pitchSummary: 'SEO and Google ranking services',
      })
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.logged, true);

    const logs = await SpamVendorLog.find({}).lean();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].vendorName, 'ABC Marketing');
  });

  it('allows unknown vendorName for spam logs', async () => {
    const res = await request(app)
      .post('/api/log-spam')
      .send({ pitchSummary: 'Cold call about website redesign' })
      .expect(200);

    assert.equal(res.body.logged, true);
    const log = await SpamVendorLog.findOne({}).lean();
    assert.equal(log.vendorName, 'Unknown');
  });

  it('enforces optional VAPI_TOOL_SECRET when configured', async () => {
    process.env.VAPI_TOOL_SECRET = 'test-secret';
    const securedApp = createApp();

    const denied = await request(securedApp)
      .post('/api/log-spam')
      .send({ pitchSummary: 'blocked without secret' })
      .expect(401);
    assert.equal(denied.body.error, 'UNAUTHORIZED');

    const allowed = await request(securedApp)
      .post('/api/log-spam')
      .set('X-Vapi-Tool-Secret', 'test-secret')
      .send({ pitchSummary: 'allowed with secret' })
      .expect(200);
    assert.equal(allowed.body.logged, true);

    process.env.VAPI_TOOL_SECRET = '';
  });

  it('records whether memory server fallback was needed', () => {
    // Informational assertion so the suite always documents the DB mode used.
    assert.equal(typeof usedMemoryServer, 'boolean');
  });
});
