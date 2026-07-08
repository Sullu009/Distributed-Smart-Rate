# Distributed Rate Limiter (Node.js + Redis)

A rate limiter that works correctly across **multiple app server instances**
by keeping all state in Redis instead of process memory. Includes three
interchangeable algorithms, an Express middleware, a demo API, and scripts
to prove it actually behaves as "distributed."

## Why Redis, not an in-memory Map?

If you rate-limit with a plain JS object/Map, each server process has its
own counter. Put two servers behind a load balancer and a client can get
2x (or Nx) the intended limit by hitting different instances. Redis gives
every instance a single shared source of truth, and Lua scripts (`EVAL`)
make the read-modify-write sequence atomic so concurrent requests from
different servers never race each other.

## Algorithms implemented

| Algorithm | File | Behavior |
|---|---|---|
| Fixed Window Counter | `src/limiters/fixedWindow.js` | Simplest. Counts requests in fixed N-second buckets. Can allow ~2x limit right at a window boundary. |
| Sliding Window Counter | `src/limiters/slidingWindow.js` | Blends previous + current window counts, weighted by elapsed time, to smooth out boundary bursts. |
| Token Bucket | `src/limiters/tokenBucket.js` | Bucket refills continuously at a fixed rate; allows short bursts up to capacity while enforcing a smooth long-term rate. |

Each algorithm's full logic runs as a single Lua script inside Redis, so
the "check current count, then increment" sequence is atomic — no race
conditions between concurrent requests from different servers.

## Project layout

```
rate-limiter/
├── server.js                     # demo Express server exposing all 3 algorithms
├── src/
│   ├── redisClient.js            # shared ioredis connection
│   ├── middleware.js             # Express middleware wrapping any limiter
│   └── limiters/
│       ├── fixedWindow.js
│       ├── slidingWindow.js
│       └── tokenBucket.js
├── scripts/
│   ├── load-test.js              # fires N requests at one endpoint, tabulates allow/deny
│   └── simulate-distributed.js   # runs 2 server instances sharing 1 Redis, proves shared limit
├── test/limiters.test.js         # unit tests using ioredis-mock (no real Redis needed)
└── docker-compose.yml            # local Redis for development
```

## Setup

```bash
npm install
cp .env.example .env       # adjust if your Redis isn't on localhost:6379
docker-compose up -d redis # or point REDIS_HOST/PORT at any existing Redis
npm start
```

Server starts on `http://localhost:3000` with three endpoints, each with
its own limiter configured in `server.js`:

- `GET /api/fixed-window` — 5 requests / 10s
- `GET /api/sliding-window` — 5 requests / 10s
- `GET /api/token-bucket` — capacity 5, refills 1 token every 2s

Every response includes an `X-RateLimit-Remaining` header. When you're
rate-limited you get `HTTP 429` with a `Retry-After` header.

## Try it

```bash
# hammer one endpoint and watch it start denying requests
node scripts/load-test.js http://localhost:3000/api/token-bucket 15

# prove the limit is shared across multiple server processes
node scripts/simulate-distributed.js
```

`simulate-distributed.js` starts two independent server processes on
different ports (both pointed at the same Redis) and alternates requests
between them. Because the counter lives in Redis rather than in each
process's memory, the total allowed requests stays capped at the
configured limit even though no single process ever saw more than half
the traffic — that's the part that would silently break with an
in-memory limiter.

## Run tests (no Redis required)

```bash
npm test
```

Tests use `ioredis-mock` so they run the exact same Lua scripts against
an in-memory Redis emulation — no server needed for CI.

## Using the middleware in your own routes

```js
const { createRedisClient } = require('./src/redisClient');
const { TokenBucketLimiter } = require('./src/limiters/tokenBucket');
const { rateLimitMiddleware } = require('./src/middleware');

const redis = createRedisClient();
const limiter = new TokenBucketLimiter(redis, { capacity: 20, refillRate: 2 });

app.use('/api/', rateLimitMiddleware(limiter, {
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
}));
```

## Design notes / things worth knowing for an interview

- **Fail-open vs fail-closed**: `src/middleware.js` currently fails open
  (allows the request through) if Redis is unreachable, so a Redis outage
  degrades to "no rate limiting" rather than taking your API down. Flip
  that to return `503` if strict enforcement matters more than uptime.
- **Key design**: identifiers are namespaced (`rl:fixed:<id>`,
  `rl:bucket:<id>`, etc.) so the same client can be limited independently
  per algorithm/route.
- **TTLs**: every key sets an expiry so idle clients' keys get cleaned up
  automatically instead of accumulating in Redis forever.
- **Clustering**: for very high throughput, `EVAL` on a single key works
  fine with Redis Cluster as long as you don't try to combine multiple
  identifiers' keys in one script call (cross-slot operations aren't
  supported in cluster mode) — this project never does that.
