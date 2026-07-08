'use strict';

/**
 * Plain-assert test runner (no test framework needed) using ioredis-mock
 * so these run without a real Redis server. Run with: npm test
 */

const assert = require('assert');
const RedisMock = require('ioredis-mock');
const { FixedWindowLimiter } = require('../src/limiters/fixedWindow');
const { SlidingWindowLimiter } = require('../src/limiters/slidingWindow');
const { TokenBucketLimiter } = require('../src/limiters/tokenBucket');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok  - ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL - ${name}`);
    console.log(`         ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('Fixed Window Limiter');
  {
    const redis = new RedisMock();
    const limiter = new FixedWindowLimiter(redis, { limit: 3, windowSeconds: 10, keyPrefix: 'test:fixed' });

    await test('allows requests up to the limit', async () => {
      for (let i = 0; i < 3; i++) {
        const r = await limiter.consume('user1');
        assert.strictEqual(r.allowed, true, `request ${i + 1} should be allowed`);
      }
    });

    await test('rejects the request after the limit', async () => {
      const r = await limiter.consume('user1');
      assert.strictEqual(r.allowed, false);
      assert.ok(r.retryAfterSeconds > 0);
    });

    await test('tracks separate counters per identifier', async () => {
      const r = await limiter.consume('user2');
      assert.strictEqual(r.allowed, true);
    });
  }

  console.log('\nSliding Window Limiter');
  {
    const redis = new RedisMock();
    const limiter = new SlidingWindowLimiter(redis, { limit: 3, windowSeconds: 10, keyPrefix: 'test:sliding' });

    await test('allows requests up to the limit', async () => {
      for (let i = 0; i < 3; i++) {
        const r = await limiter.consume('userA');
        assert.strictEqual(r.allowed, true, `request ${i + 1} should be allowed`);
      }
    });

    await test('rejects once over the limit within the window', async () => {
      const r = await limiter.consume('userA');
      assert.strictEqual(r.allowed, false);
    });
  }

  console.log('\nToken Bucket Limiter');
  {
    const redis = new RedisMock();
    const limiter = new TokenBucketLimiter(redis, { capacity: 3, refillRate: 1, keyPrefix: 'test:bucket' });

    await test('allows burst up to capacity', async () => {
      for (let i = 0; i < 3; i++) {
        const r = await limiter.consume('userX');
        assert.strictEqual(r.allowed, true, `request ${i + 1} should be allowed`);
      }
    });

    await test('rejects once bucket is empty', async () => {
      const r = await limiter.consume('userX');
      assert.strictEqual(r.allowed, false);
    });

    await test('refills over time', async () => {
      // Wait ~1.1s so refillRate=1 token/sec gives us a token back.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const r = await limiter.consume('userX');
      assert.strictEqual(r.allowed, true);
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
