'use strict';


function rateLimitMiddleware(limiter, { keyGenerator, cost = 1 } = {}) {
  const getKey = keyGenerator || ((req) => req.ip);

  return async function (req, res, next) {
    const identifier = getKey(req);

    try {
      const result = await limiter.consume(identifier, cost);

      res.set('X-RateLimit-Remaining', String(result.remaining));
      if (!result.allowed) {
        res.set('Retry-After', String(result.retryAfterSeconds));
        return res.status(429).json({
          error: 'Too Many Requests',
          retryAfterSeconds: result.retryAfterSeconds
        });
      }

      return next();
    } catch (err) {
      // Fail-open: if Redis is down, don't take the whole API down with it.
      // Flip this to fail-closed (return 503) if strict enforcement matters
      // more than availability for your use case.
      console.error('[rate-limit] error, failing open:', err.message);
      return next();
    }
  };
}

module.exports = { rateLimitMiddleware };
