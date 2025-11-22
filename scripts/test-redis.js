#!/usr/bin/env node
/*
  scripts/test-redis.js
  Simple Redis connection tester. It will use the following environment variables if set:
    - REDIS_URL (preferred)
    - REDIS_USERNAME, REDIS_PASSWORD, REDIS_HOST, REDIS_PORT, REDIS_TLS
    - REDIS_DB (optional)

  Example (inline):
    REDIS_USERNAME=default REDIS_PASSWORD=secret REDIS_HOST=host REDIS_PORT=14530 REDIS_TLS=true node scripts/test-redis.js

*/
const { createClient } = require('redis');

function buildClientFromEnv() {
  const url = process.env.REDIS_URL;
  if (url) {
    return createClient({ url });
  }

  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
  const tls = process.env.REDIS_TLS === 'true' || process.env.REDIS_TLS === '1';
  const db = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined;

  // If username present construct a URL (works well with ACL-enabled Redis)
  if (username) {
    const scheme = tls ? 'rediss' : 'redis';
    const userEnc = encodeURIComponent(username);
    const passEnc = password ? encodeURIComponent(password) : '';
    const urlStr = `${scheme}://${userEnc}:${passEnc}@${host}:${port}`;
    return createClient({ url: urlStr, database: db });
  }

  // Otherwise use socket options
  return createClient({
    socket: {
      host,
      port,
      tls: tls || undefined
    },
    password: password || undefined,
    database: db
  });
}

async function run() {
  const client = buildClientFromEnv();

  client.on('error', (err) => console.error('Redis client error:', err));
  client.on('connect', () => console.log('Redis client event: connect'));
  client.on('ready', () => console.log('Redis client event: ready'));

  try {
    console.log('Connecting to Redis...');
    await client.connect();

    const testKey = 'localbuy:test:connection';
    const testValue = { ok: true, ts: new Date().toISOString() };

    console.log('Setting test key...');
    await client.setEx(testKey, 30, JSON.stringify(testValue));

    console.log('Reading test key...');
    const raw = await client.get(testKey);
    console.log('Raw value from Redis:', raw);

    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = raw; }
    console.log('Parsed value:', parsed);

    console.log('Deleting test key...');
    await client.del(testKey);

    console.log('Disconnecting...');
    await client.disconnect();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err && err.message ? err.message : err);
    try { await client.disconnect(); } catch (e) {}
    process.exit(2);
  }
}

run();
