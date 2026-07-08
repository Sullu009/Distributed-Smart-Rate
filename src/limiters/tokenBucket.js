'use strict';

/**
 * TOKEN BUCKET
 * ------------
 * Each key has a bucket that holds up to `capacity` tokens and refills
 * at `refillRate` tokens/second. Every request costs 1 token (by
 * default). If there aren't enough tokens, the request is rejected.
 *
 * This is the most flexible algorithm: it allows short bursts up to
 * the bucket capacity while still enforcing a smooth long-term rate,
 * which is why it's the default choice for APIs like Stripe's.
 *
 * State (tokens, last_refill_timestamp) is stored in a Redis hash and
 * updated atomically via a Lua script so concurrent requests from
 * different app servers never double-spend tokens.
 */

const SCRIPT = `
-- KEYS[1] = bucket key
-- ARGV[1] = capacity (max tokens)
-- ARGV[2] = refill rate (tokens per second)
-- ARGV[3] = now (ms)
-- ARGV[4] = tokens requested for this call
-- ARGV[5] = key TTL in seconds (cleanup for idle buckets)
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  last_refill = now
end

local elapsed_seconds = math.max(0, (now - last_refill) / 1000)
local refilled = math.min(capacity, tokens + (elapsed_seconds * refill_rate))

local allowed = 0
local remaining = refilled

if refilled >= requested then
  allowed = 1
  remaining = refilled - requested
end

redis.call('HMSET', key, 'tokens', remaining, 'last_refill', now)
redis.call('EXPIRE', key, ttl)

local retry_after = 0
if allowed == 0 then
  local deficit = requested - refilled
  retry_after = math.ceil(deficit / refill_rate)
end

return {allowed, math.floor(remaining), retry_after}
`;

class TokenBucketLimiter {
  constructor(
    redisClient,
    { capacity = 10, refillRate = 1, keyPrefix = 'rl:bucket', idleTtlSeconds = 3600 } = {}
  ) {
    this.redis = redisClient;
    this.capacity = capacity;
    this.refillRate = refillRate; // tokens per second
    this.keyPrefix = keyPrefix;
    this.idleTtlSeconds = idleTtlSeconds;
  }

  async consume(identifier, tokensRequested = 1) {
    const key = `${this.keyPrefix}:${identifier}`;
    const now = Date.now();
    const [allowed, remaining, retryAfterSeconds] = await this.redis.eval(
      SCRIPT,
      1,
      key,
      this.capacity,
      this.refillRate,
      now,
      tokensRequested,
      this.idleTtlSeconds
    );
    return {
      allowed: allowed === 1,
      remaining,
      retryAfterSeconds
    };
  }
}

module.exports = { TokenBucketLimiter, SCRIPT };
