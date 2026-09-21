'use strict';

/**
 * Manual end-to-end curl-style API checks against a running server.
 *
 * Prerequisites:
 *   1. MongoDB reachable via MONGODB_URI in .env
 *   2. Server running: npm start
 *
 * Usage:
 *   npm run test:manual
 *   BASE_URL=http://localhost:3000 npm run test:manual
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
const SECRET = (process.env.VAPI_TOOL_SECRET || '').trim();

async function request(method, urlPath, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (SECRET) {
    headers['X-Vapi-Tool-Secret'] = SECRET;
  }

  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const date = '2099-01-15';
  const window = '8am-12pm';
  const results = [];

  // Health
  {
    const { status, json } = await request('GET', '/health');
    assert(status === 200 && json.success === true, 'health failed');
    results.push('health: PASS');
  }

  // Clear path: book until full using unique phones
  const stamp = Date.now();
  for (let i = 1; i <= 3; i += 1) {
    const { status, json } = await request('POST', '/api/book-inspection', {
      name: `Manual Test ${stamp}-${i}`,
      phone: `+1206555${String(1000 + (stamp % 8000) + i).slice(-4)}`,
      address: '123 Manual Test Ave, Seattle',
      issue: 'Manual capacity test leak',
      date,
      window,
    });
    assert(status === 200 && json.booked === true, `booking ${i} failed: ${JSON.stringify(json)}`);
    results.push(`booking ${i}: PASS (${json.confirmationId})`);
  }

  {
    const { status, json } = await request('POST', '/api/check-availability', { date, window });
    assert(status === 200 && json.available === false && json.jobsBooked === 3, 'availability full check failed');
    results.push('availability full: PASS');
  }

  {
    const { status, json } = await request('POST', '/api/book-inspection', {
      name: 'Should Fail',
      phone: '+12065559999',
      address: '999 Full Street, Seattle',
      issue: 'Should be rejected',
      date,
      window,
    });
    assert(status === 200 && json.booked === false && json.reason === 'WINDOW_FULL', 'fourth booking should fail');
    results.push('fourth booking rejected: PASS');
  }

  {
    const { status, json } = await request('POST', '/api/check-availability', {
      date,
      window: 'midnight-sunrise',
    });
    assert(status === 400 && json.error === 'VALIDATION_ERROR', 'invalid window should fail');
    results.push('invalid window: PASS');
  }

  {
    const { status, json } = await request('POST', '/api/log-spam', {
      vendorName: 'Manual SEO Co',
      pitchSummary: 'Ranking and lead gen pitch',
    });
    assert(status === 200 && json.logged === true, 'spam log failed');
    results.push('spam log: PASS');
  }

  // eslint-disable-next-line no-console
  console.log(results.join('\n'));
  // eslint-disable-next-line no-console
  console.log('All manual checks passed.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Manual test failed:', err.message);
  process.exit(1);
});
