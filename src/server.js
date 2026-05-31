// Notification delivery uses direct FCM sends; background worker removed
import app from './app.js';
import { env, validateEnv } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { seedDefaultSettings } from './services/admin.service.js';
import { seedRewardData } from './services/reward.service.js';
import { initializeDefaultConfig } from './services/rewardsConfig.service.js';
// Notification delivery now uses direct FCM with retry wrapper; outbox worker disabled
import { logger } from './utils/logger.js';
import outboxWorker from './workers/notificationOutbox.worker.js';

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

// Start a lightweight outbox worker in-process for simple deployments.
// The worker is safe to run in multiple instances because it claims entries atomically.
let outboxInterval = null;
const startOutboxWorker = (intervalMs = 5000) => {
  if (process.env.NODE_ENV === 'test') return;
  if (outboxInterval) return;
  outboxInterval = setInterval(async () => {
    try {
      await outboxWorker.processPendingOutbox({ maxIterations: 20 });
    } catch (err) {
      logger.warn('Outbox worker iteration failed', { message: err.message });
    }
  }, intervalMs);
  logger.info('Notification Outbox worker started', { intervalMs });
};

// Start worker by default in non-test environments. For production, consider running a separate worker process.
startOutboxWorker(parseInt(process.env.OUTBOX_POLL_INTERVAL_MS, 10) || 5000);

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
  // Stop background workers (outbox) to prevent them from issuing DB ops during shutdown
  try {
    if (outboxInterval) {
      clearInterval(outboxInterval);
      outboxInterval = null;
    }
    // Small grace period for any in-flight worker iteration to complete
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (e) {
    logger.warn('Error while stopping workers during shutdown', { message: e.message });
  }

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
