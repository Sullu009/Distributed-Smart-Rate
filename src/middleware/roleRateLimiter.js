const { FixedWindowLimiter } = require("../limiters/fixedWindow");

function createRoleRateLimiter(redis) {
  const freeLimiter = new FixedWindowLimiter(redis, {
    limit: 20,
    windowSeconds: 60,
    keyPrefix: "rl:free",
  });

  const premiumLimiter = new FixedWindowLimiter(redis, {
    limit: 100,
    windowSeconds: 60,
    keyPrefix: "rl:premium",
  });

  return async (req, res, next) => {
    try {
      const role = req.user.role;

      // ADMIN = Unlimited
      if (role === "ADMIN") {
        return next();
      }

      const limiter =
        role === "PREMIUM"
          ? premiumLimiter
          : freeLimiter;

      const result = await limiter.consume(req.user.id);

      res.set(
        "X-RateLimit-Remaining",
        String(result.remaining)
      );

      if (!result.allowed) {
        return res.status(429).json({
          success: false,
          message: "Rate limit exceeded",
          retryAfter: result.retryAfterSeconds,
        });
      }

      next();
    } catch (err) {
      console.error(err);
      next();
    }
  };
}

module.exports = createRoleRateLimiter;