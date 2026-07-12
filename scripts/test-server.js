#!/usr/bin/env node
// Playwright テスト用: MongoMemoryServer を起動してから Next.js を起動するラッパー
// Playwright の webServer として使用する
'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');

async function main() {
  // 1. In-memory MongoDB を起動
  const mongod = await MongoMemoryServer.create({ instance: { port: 27099 } });
  const mongoUri = mongod.getUri();
  console.log('[test-server] MongoDB URI:', mongoUri);

  // 2. Next.js dev サーバーを起動（MONGODB_URI を注入）
  const next = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'dev', '--port', '3000'],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        MONGODB_URI: mongoUri,
        NODE_ENV: 'development',
      },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );

  next.on('error', (err) => {
    console.error('[test-server] Next.js error:', err);
    process.exit(1);
  });

  // 3. プロセス終了時のクリーンアップ
  const cleanup = async (signal) => {
    console.log(`\n[test-server] ${signal} received. Shutting down...`);
    next.kill('SIGTERM');
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));
}

main().catch((err) => {
  console.error('[test-server] Fatal error:', err);
  process.exit(1);
});
