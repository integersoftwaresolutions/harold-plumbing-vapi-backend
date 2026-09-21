# Harold's Plumbing NW — Vapi Tool Backend

Node.js / Express backend that powers Vapi custom tools for **Harold's Plumbing NW** inbound voice calls.

Vapi does **not** live inside this repo. During a live phone call, the Vapi assistant invokes HTTP tools that hit this API to:

1. Check inspection appointment availability
2. Book an inspection
3. Log spam / vendor cold calls

## Architecture

```
Vapi Voice Assistant (configured separately)
        │  HTTPS tool calls
        ▼
Express API (this project)
        │
        ├── GET  /health
        ├── POST /api/check-availability
        ├── POST /api/book-inspection
        └── POST /api/log-spam
        │
        ▼
MongoDB (Mongoose)
        ├── InspectionBooking
        ├── WindowCapacity   ← atomic capacity counters
        └── SpamVendorLog
```

Folder layout:

```
src/
  config/       constants, env, MongoDB connection
  controllers/  thin HTTP handlers
  models/       Mongoose schemas
  routes/       route wiring
  services/     booking + spam business logic
  middleware/   auth, errors, async wrapper
  utils/        validation, normalization, IDs
  app.js        Express app factory
  server.js     process entrypoint
scripts/        seed + manual API checks
test/           automated integration tests
```

## Business rules

- Appointments are **inspections only**
- Allowed windows: `8am-12pm`, `12pm-5pm`
- Hard capacity: **3 bookings per date + window**
- Dates stored as normalized `YYYY-MM-DD` strings (calendar days; Pacific business windows, no time-of-day timestamps)

## Requirements

- Node.js 18+ locally (Vercel uses its current Node LTS)
- MongoDB 6+ (local or Atlas)
- npm

## Setup

```bash
cp .env.example .env
# Edit .env and set MONGODB_URI
npm install
```

### MongoDB setup

**Local**

```text
MONGODB_URI=mongodb://127.0.0.1:27017/harolds-plumbing
```

**Atlas**

```text
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER/harolds-plumbing?retryWrites=true&w=majority
```

Never commit a real connection string. `.env` is gitignored.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `PORT` | No | HTTP port (default `3000`) |
| `NODE_ENV` | No | `development`, `test`, or `production` |
| `VAPI_TOOL_SECRET` | No | Shared secret for `/api/*`. Empty = auth disabled |
| `BODY_SIZE_LIMIT` | No | Express JSON limit (default `32kb`) |

### Optional Vapi shared secret

- **Disabled (local default):** leave `VAPI_TOOL_SECRET` empty/unset
- **Enabled:** set `VAPI_TOOL_SECRET=some-long-random-value`
- When enabled, every `/api/*` request must include:

```http
X-Vapi-Tool-Secret: some-long-random-value
```

`GET /health` does **not** require the secret (useful for uptime checks).

## Run locally

```bash
npm start
```

Dev reload (Node 18+ watch):

```bash
npm run dev
```

## npm commands

| Command | Purpose |
|---|---|
| `npm start` | Start server |
| `npm run dev` | Start with `--watch` |
| `npm test` | Automated integration tests (in-memory MongoDB) |
| `npm run seed` | Seed bookings for capacity testing |
| `npm run test:manual` | Hit a running server with end-to-end checks |

## API documentation

Base URL (local): `http://localhost:3000`

### GET `/health`

No body. Confirms process health and MongoDB connectivity status (no credentials).

```json
{
  "success": true,
  "service": "harolds-plumbing-vapi-backend",
  "status": "ok",
  "mongodb": "connected"
}
```

### POST `/api/check-availability`

Request:

```json
{
  "date": "2026-09-25",
  "window": "8am-12pm"
}
```

Available:

```json
{
  "success": true,
  "available": true,
  "date": "2026-09-25",
  "window": "8am-12pm",
  "jobsBooked": 2,
  "capacity": 3,
  "remainingSlots": 1
}
```

Full:

```json
{
  "success": true,
  "available": false,
  "date": "2026-09-25",
  "window": "8am-12pm",
  "jobsBooked": 3,
  "capacity": 3,
  "remainingSlots": 0
}
```

### POST `/api/book-inspection`

Request:

```json
{
  "name": "John Smith",
  "phone": "+12065551234",
  "address": "123 Main Street, Seattle",
  "issue": "Water heater leaking",
  "date": "2026-09-25",
  "window": "8am-12pm"
}
```

Success:

```json
{
  "success": true,
  "booked": true,
  "confirmationId": "HP-7F2A91",
  "appointmentType": "inspection",
  "date": "2026-09-25",
  "window": "8am-12pm"
}
```

Window full:

```json
{
  "success": true,
  "booked": false,
  "reason": "WINDOW_FULL",
  "date": "2026-09-25",
  "window": "8am-12pm"
}
```

### POST `/api/log-spam`

Request:

```json
{
  "vendorName": "ABC Marketing",
  "pitchSummary": "SEO and Google ranking services"
}
```

`vendorName` may be omitted/unknown; `pitchSummary` is required.

```json
{
  "success": true,
  "logged": true
}
```

### Error shape

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid appointment window."
}
```

```json
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "message": "Unable to process the request."
}
```

## Capacity enforcement

Overbooking is prevented with a dedicated `WindowCapacity` collection:

1. Upsert a `{ date, window, bookedCount }` document (unique compound index)
2. Atomically reserve a slot with:

```js
findOneAndUpdate(
  { date, window, bookedCount: { $lt: 3 } },
  { $inc: { bookedCount: 1 } }
)
```

3. If no document is returned → window is full (`WINDOW_FULL`)
4. If reserved → create the `InspectionBooking`
5. If booking insert fails → decrement `bookedCount` (compensation)

A previous availability check is **never** trusted alone. Booking always re-checks capacity atomically.

## How to test locally

### Automated tests (recommended)

Uses `mongodb-memory-server` — no external MongoDB required:

```bash
npm test
```

Covers health, availability, booking, capacity fill, fourth rejection, concurrent overbooking, validation, spam logging, and optional secret auth.

### Seed a full window

Requires real `MONGODB_URI` in `.env`:

```bash
npm run seed -- --date 2026-09-25 --window 8am-12pm --count 3 --reset
```

Then start the server and call check-availability / book-inspection.

### Manual script against a running server

```bash
npm start
# other terminal
npm run test:manual
```

### Example curl

```bash
curl -s http://localhost:3000/health

curl -s -X POST http://localhost:3000/api/check-availability \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-09-25\",\"window\":\"8am-12pm\"}"

curl -s -X POST http://localhost:3000/api/book-inspection \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"John Smith\",\"phone\":\"+12065551234\",\"address\":\"123 Main Street, Seattle\",\"issue\":\"Water heater leaking\",\"date\":\"2026-09-25\",\"window\":\"8am-12pm\"}"

curl -s -X POST http://localhost:3000/api/log-spam \
  -H "Content-Type: application/json" \
  -d "{\"vendorName\":\"ABC Marketing\",\"pitchSummary\":\"SEO and Google ranking services\"}"
```

If `VAPI_TOOL_SECRET` is set, add:

```bash
-H "X-Vapi-Tool-Secret: YOUR_SECRET"
```

## How Vapi should call each endpoint

Configure three **Custom Tools** (server URL = your deployed backend):

| Suggested tool name | Method | Path |
|---|---|---|
| `check_availability` | POST | `/api/check-availability` |
| `book_inspection` | POST | `/api/book-inspection` |
| `log_spam` | POST | `/api/log-spam` |

Example base: `https://YOUR-BACKEND-DOMAIN.com`

Headers for all `/api/*` tools:

```http
Content-Type: application/json
X-Vapi-Tool-Secret: <value of VAPI_TOOL_SECRET if enabled>
```

This backend does **not** configure the Vapi assistant, system prompt, phone number, or tool schemas inside Vapi — only the HTTP APIs those tools call.

## Deployment (Vercel)

This repo is set up to import into Vercel as-is. Vercel runs Express as a serverless function (`api/index.js`); do not use `npm start` on Vercel.

### 1. MongoDB Atlas

1. Create a cluster and a database user
2. Get a connection string, for example:

```text
mongodb+srv://USER:PASSWORD@CLUSTER/harolds-plumbing?retryWrites=true&w=majority
```

3. **Network Access:** allow `0.0.0.0/0` (Vercel serverless IPs are dynamic). Restricting to a single IP will fail.

### 2. Import the GitHub repo in Vercel

1. [Vercel New Project](https://vercel.com/new) → Import `harold-plumbing-vapi-backend`
2. Framework Preset: leave as **Other** (or empty). `vercel.json` already configures the build
3. Root Directory: `.` (default)
4. Add environment variables (Production, Preview, and Development):

| Variable | Required | Value |
|---|---|---|
| `MONGODB_URI` | Yes | Atlas connection string |
| `VAPI_TOOL_SECRET` | Recommended | Long random secret Vapi will send as `X-Vapi-Tool-Secret` |
| `NODE_ENV` | No | Vercel sets `production` automatically |
| `PORT` | No | Do not set — Vercel ignores it |

5. Deploy

### 3. Confirm

After deploy, open:

```text
https://YOUR-PROJECT.vercel.app/health
```

You should see `"mongodb": "connected"`. If you get `SERVICE_UNAVAILABLE` or a timeout, Atlas network access is almost always the cause (`0.0.0.0/0` not allowed, or a bad `MONGODB_URI`).

### 4. Point Vapi at Vercel

Use the Vercel URL as the tool server base:

| Tool | Method | URL |
|---|---|---|
| `check_availability` | POST | `https://YOUR-PROJECT.vercel.app/api/check-availability` |
| `book_inspection` | POST | `https://YOUR-PROJECT.vercel.app/api/book-inspection` |
| `log_spam` | POST | `https://YOUR-PROJECT.vercel.app/api/log-spam` |

If `VAPI_TOOL_SECRET` is set, every `/api/*` call must include:

```http
X-Vapi-Tool-Secret: <same value as in Vercel>
```

Local `npm start` is unchanged (`src/server.js`). Other Node hosts (Render, Railway, Fly.io) can still run `npm start`.

### Production considerations

- Enable `VAPI_TOOL_SECRET` so random internet clients cannot book/log freely
- Use TLS termination in front of the app
- Monitor MongoDB indexes and connection pool
- Keep responses short — they are consumed mid-call by a voice agent
- Do not expose seed/reset as public HTTP routes
- Stack traces are suppressed when `NODE_ENV=production`

## License

UNLICENSED — demo project for Harold's Plumbing NW.
