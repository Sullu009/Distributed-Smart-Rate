'use strict';

const Redis = require('ioredis');

/**
 * Creates a single shared ioredis connection.
 * All limiter instances and all "server" processes should reuse the same
 * Redis deployment so that limits are enforced consistently across a
 * horizontally scaled fleet of app servers.
 */
function createRedisClient(overrides = {}) {
  const {
    host = process.env.REDIS_HOST || '127.0.0.1',
    port = Number(process.env.REDIS_PORT) || 6379,
    password = process.env.REDIS_PASSWORD || undefined,
    db = Number(process.env.REDIS_DB) || 0,
    lazyConnect = false
  } = overrides;

  const client = new Redis({
    host,
    port,
    password,
    db,
    lazyConnect,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 200, 2000);
    }
  });

  client.on('error', (err) => {
    // In production, forward this to real logging/alerting instead of console.
    console.error('[redis] connection error:', err.message);
  });

  return client;
}

module.exports = { createRedisClient };
