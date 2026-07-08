'use strict';

/**
 * FIXED WINDOW COUNTER
 * ---------------------
 * Splits time into fixed-size buckets (e.g. every 60s). Each request
 * increments a counter for the current bucket. If the counter exceeds
 * the limit, the request is rejected until the bucket rolls over.
 *
 * Pros: cheap (one INCR), easy to reason about.
 * Cons: allows up to 2x the limit in bursts right at window boundaries
 *       (e.g. a burst at 0:59 and another at 1:00 can total 2x limit
 *       within ~1 second of real time).
 *
 * The whole check-and-increment is done in a single Lua script so it's
 * atomic even when many app server instances hit the same Redis key
 * concurrently.
 */

const SCRIPT = `
-- KEYS[1] = rate limit key
-- ARGV[1] = limit (max requests per window)
-- ARGV[2] = window size in seconds
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, window)
end

local ttl = redis.call('TTL', key)
if current > limit then
  return {0, 0, ttl}
else
  return {1, limit - current, ttl}
end
`;

class FixedWindowLimiter {
  constructor(redisClient, { limit = 10, windowSeconds = 60, keyPrefix = 'rl:fixed' } = {}) {
    this.redis = redisClient;
    this.limit = limit;
    this.windowSeconds = windowSeconds;
    this.keyPrefix = keyPrefix;
  }

  /**
   * @param {string} identifier - e.g. IP address, API key, user id
   * @returns {Promise<{allowed: boolean, remaining: number, retryAfterSeconds: number}>}
   */
  async consume(identifier) {
    const key = `${this.keyPrefix}:${identifier}`;
    const [allowed, remaining, ttl] = await this.redis.eval(
      SCRIPT,
      1,
      key,
      this.limit,
      this.windowSeconds
    );
    return {
      allowed: allowed === 1,
      remaining,
      retryAfterSeconds: ttl > 0 ? ttl : this.windowSeconds
    };
  }
}

module.exports = { FixedWindowLimiter, SCRIPT };
