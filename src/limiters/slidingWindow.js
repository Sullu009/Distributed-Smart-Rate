'use strict';

/**
 * SLIDING WINDOW COUNTER
 * ----------------------
 * Fixes the boundary-burst problem of the fixed window by blending the
 * previous window's count into the current one, weighted by how far
 * we are into the current window. This is the same approximation
 * algorithm used by Cloudflare's public rate limiter writeups.
 *
 * estimatedCount = previousWindowCount * (1 - elapsedFractionOfCurrentWindow)
 *                  + currentWindowCount
 *
 * It's an approximation (assumes uniform request distribution within
 * the previous window) but is very cheap: two counters instead of a
 * full log of timestamps.
 */

const SCRIPT = `
-- KEYS[1] = base key (we derive per-window sub-keys from it)
-- ARGV[1] = limit
-- ARGV[2] = window size in seconds
-- ARGV[3] = current unix time in ms
local base = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local window_ms = window * 1000
local current_window_index = math.floor(now / window_ms)
local elapsed_in_current = now - (current_window_index * window_ms)
local fraction_elapsed = elapsed_in_current / window_ms

local current_key = base .. ':' .. current_window_index
local previous_key = base .. ':' .. (current_window_index - 1)

local current_count = tonumber(redis.call('GET', current_key)) or 0
local previous_count = tonumber(redis.call('GET', previous_key)) or 0

local estimated = (previous_count * (1 - fraction_elapsed)) + current_count

if estimated >= limit then
  return {0, 0, math.ceil((window_ms - elapsed_in_current) / 1000)}
end

local new_count = redis.call('INCR', current_key)
if new_count == 1 then
  redis.call('EXPIRE', current_key, window * 2)
end

local remaining = limit - (estimated + 1)
if remaining < 0 then remaining = 0 end

return {1, math.floor(remaining), math.ceil((window_ms - elapsed_in_current) / 1000)}
`;

class SlidingWindowLimiter {
  constructor(redisClient, { limit = 10, windowSeconds = 60, keyPrefix = 'rl:sliding' } = {}) {
    this.redis = redisClient;
    this.limit = limit;
    this.windowSeconds = windowSeconds;
    this.keyPrefix = keyPrefix;
  }

  async consume(identifier) {
    const key = `${this.keyPrefix}:${identifier}`;
    const now = Date.now();
    const [allowed, remaining, retryAfterSeconds] = await this.redis.eval(
      SCRIPT,
      1,
      key,
      this.limit,
      this.windowSeconds,
      now
    );
    return {
      allowed: allowed === 1,
      remaining,
      retryAfterSeconds
    };
  }
}

module.exports = { SlidingWindowLimiter, SCRIPT };
