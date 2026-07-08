'use strict';

/**
 * Spins up TWO independent instances of server.js on different ports,
 * both pointed at the same Redis. Then sends requests alternating
 * between them from what looks like the same client IP.
 *
 * If the rate limiter were only in-memory (e.g. a plain JS Map), each
 * server would allow its own quota independently and the client could
 * get 2x the intended limit. Because state lives in Redis, the two
 * "servers" share one counter and the total stays capped correctly.
 *
 * Usage: node scripts/simulate-distributed.js
 * (requires Redis running and reachable via REDIS_HOST/REDIS_PORT)
 */

const { spawn } = require('child_process');
const path = require('path');

const PORT_A = 4001;
const PORT_B = 4002;

function startInstance(port, instanceId) {
  const child = spawn('node', [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), INSTANCE_ID: instanceId },
    stdio: 'inherit'
  });
  return child;
}

async function waitForHealth(port, retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Instance on port ${port} never became healthy`);
}

async function main() {
  console.log('Starting two server instances sharing one Redis...\n');
  const instanceA = startInstance(PORT_A, 'server-A');
  const instanceB = startInstance(PORT_B, 'server-B');

  try {
    await Promise.all([waitForHealth(PORT_A), waitForHealth(PORT_B)]);

    console.log('\nBoth instances up. Sending 12 requests, alternating A/B/A/B...');
    console.log('(fixed-window limit is 5 per 10s — total across BOTH servers should cap at 5)\n');

    let allowed = 0;
    let denied = 0;

    for (let i = 1; i <= 12; i++) {
      const port = i % 2 === 0 ? PORT_B : PORT_A;
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`http://localhost:${port}/api/fixed-window`);
      const body = await res.json().catch(() => ({}));
      const mark = res.status === 200 ? 'ALLOW' : 'DENY ';
      if (res.status === 200) allowed++;
      else denied++;
      console.log(`#${String(i).padStart(2, '0')} -> port ${port}  ${mark}  servedBy=${body.servedBy || '-'}`);
    }

    console.log(`\nTotal across both servers -> Allowed: ${allowed}  Denied: ${denied}`);
    console.log('If Allowed is capped at 5 despite hitting two different processes, the shared Redis state is working.');
  } finally {
    instanceA.kill();
    instanceB.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
