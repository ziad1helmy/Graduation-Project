import app from './app.js';
import { env, validateEnv } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { seedDefaultSettings } from './services/admin.service.js';
import { seedRewardData } from './services/reward.service.js';

validateEnv();
await connectDB();

// Seed default system settings and reward catalog (no-op if already exist)
await seedDefaultSettings();
await seedRewardData();

const server = app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} (${env.NODE_ENV}) [pid ${process.pid}]`);
  console.log(`Health endpoint available at http://localhost:${env.PORT}/health`);
  console.log('Swagger docs available at /api-docs');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${env.PORT} is already in use. A stale or parallel backend process may still be running.`);
  } else {
    console.error('Server startup error:', error.message);
  }
  process.exit(1);
});

let isShuttingDown = false;
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[Server] Received ${signal}. Shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  server.close(async (serverError) => {
    await disconnectDB();
    clearTimeout(forceExitTimer);

    if (signal === 'SIGUSR2') {
      process.kill(process.pid, 'SIGUSR2');
      return;
    }

    process.exit(serverError ? 1 : 0);
  });
};

['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal).catch((error) => {
      console.error('[Server] Shutdown error:', error.message);
      process.exit(1);
    });
  });
});
