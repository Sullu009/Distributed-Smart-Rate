'use strict';

require('dotenv').config();

const express = require('express');

const connectDB = require("./src/config/database");
const authRoutes = require("./src/routes/authRoutes");

const authMiddleware = require("./src/middleware/authMiddleware");
const createRoleRateLimiter = require("./src/middleware/roleRateLimiter");
const analyticsRoutes = require("./src/routes/analyticsRoutes");
const { createRedisClient } = require('./src/redisClient');

const { FixedWindowLimiter } = require('./src/limiters/fixedWindow');
const { SlidingWindowLimiter } = require('./src/limiters/slidingWindow');
const { TokenBucketLimiter } = require('./src/limiters/tokenBucket');

const { rateLimitMiddleware } = require('./src/middleware');
// Connect Database
connectDB();

const PORT = process.env.PORT || 3000;

// Lets you run several copies of this server (different ports)
// that all share the same Redis.
const INSTANCE_ID = process.env.INSTANCE_ID || `pid-${process.pid}`;

// Redis Client
const redis = createRedisClient();

const roleRateLimiter = createRoleRateLimiter(redis);

// Rate Limiters
const limiters = {
  fixed: new FixedWindowLimiter(redis, { limit: 5, windowSeconds: 10 }),
  sliding: new SlidingWindowLimiter(redis, { limit: 5, windowSeconds: 10 }),
  bucket: new TokenBucketLimiter(redis, {
    capacity: 5,
    refillRate: 0.5,
  }),
};

const app = express();

// Middleware
app.use(express.json());

// Authentication Routes
app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);

// Identify clients by IP
const byIp = (req) => req.ip;

// Fixed Window
app.get(
  "/api/fixed-window",
  authMiddleware,
  roleRateLimiter,
  (req, res) => {
    res.json({
      success: true,
      message: "Request Allowed",
      role: req.user.role,
      userId: req.user.id,
      algorithm: "fixed-window",
    });
  }
);

// Sliding Window
app.get(
  "/api/sliding-window",
  rateLimitMiddleware(limiters.sliding, { keyGenerator: byIp }),
  (req, res) => {
    res.json({
      ok: true,
      algorithm: "sliding-window",
      servedBy: INSTANCE_ID,
    });
  }
);

// Token Bucket
app.get(
  "/api/token-bucket",
  rateLimitMiddleware(limiters.bucket, { keyGenerator: byIp }),
  (req, res) => {
    res.json({
      ok: true,
      algorithm: "token-bucket",
      servedBy: INSTANCE_ID,
    });
  }
);

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    instance: INSTANCE_ID,
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`Instance: ${INSTANCE_ID}`);
});