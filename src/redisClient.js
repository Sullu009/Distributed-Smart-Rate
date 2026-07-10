const Redis = require("ioredis");

function createRedisClient() {
  const redis = new Redis(process.env.REDIS_URL);

  redis.on("connect", () => {
    console.log("✅ Redis Connected");
  });

  redis.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });

  return redis;
}

module.exports = { createRedisClient };