'use strict';

/**
 * Fires a burst of requests at a running server instance and prints
 * how many were allowed vs rate-limited. Useful for visually confirming
 * each algorithm's behavior.
 *
 * Usage:
 *   node scripts/load-test.js http://localhost:3000/api/token-bucket 20
 */

const [, , urlArg, countArg] = process.argv;
const url = urlArg || 'http://localhost:3000/api/fixed-window';
const count = Number(countArg) || 20;

async function fireOnce(i) {
  const start = Date.now();
  try {
    const res = await fetch(url);
    const ms = Date.now() - start;
    const remaining = res.headers.get('x-ratelimit-remaining');
    return { i, status: res.status, ms, remaining };
  } catch (err) {
    return { i, status: 'ERR', ms: Date.now() - start, error: err.message };
  }
}

async function main() {
  console.log(`Firing ${count} requests at ${url}\n`);
  const results = [];
  for (let i = 1; i <= count; i++) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await fireOnce(i));
  }

  let allowed = 0;
  let denied = 0;
  for (const r of results) {
    const mark = r.status === 200 ? 'ALLOW' : r.status === 429 ? 'DENY ' : 'ERR  ';
    if (r.status === 200) allowed++;
    else denied++;
    console.log(
      `#${String(r.i).padStart(2, '0')}  ${mark}  status=${r.status}  remaining=${r.remaining ?? '-'}  (${r.ms}ms)`
    );
  }

  console.log(`\nAllowed: ${allowed}   Denied: ${denied}`);
}

main();
