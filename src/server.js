import app from './app.js';
import { env, validateEnv } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { seedDefaultSettings } from './services/admin.service.js';
import { seedRewardData } from './services/reward.service.js';
import { initializeDefaultConfig } from './services/rewardsConfig.service.js';
import { logger } from './utils/logger.js';

validateEnv();
await connectDB();

// Seed default system settings and reward catalog (no-op if already exist)
await seedDefaultSettings();
await initializeDefaultConfig();
await seedRewardData();


const server = app.listen(env.PORT, () => {
  logger.info('Server started', {
    port: env.PORT,
    environment: env.NODE_ENV,
    pid: process.pid,
  });
  logger.info('Health endpoint available', {
    endpoint: `/health`,
  });
  logger.info('API documentation available', {
    endpoint: `/api-docs`,
  });

});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error('Port already in use', {
      port: env.PORT,
      message: 'A stale or parallel backend process may still be running.',
    });
  } else {
    logger.error('Server startup error', {
      message: error.message,
    });
  }
  process.exit(1);
});

let isShuttingDown = false;
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('Server shutting down', {
    signal,
    message: 'Graceful shutdown initiated',
  });

  const forceExitTimer = setTimeout(() => {
    logger.error('Server forced shutdown', {
      message: 'Forced shutdown after timeout.',
    });
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
      logger.error('Shutdown error', {
        message: error.message,
      });
      process.exit(1);
    });
  });
});
