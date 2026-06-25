import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { getDBHealth } from './config/db.js';
import swaggerSpec from './config/swagger.js';
import { logger, requestLogger, securityLogger } from './utils/logger.js';
import authRoutes from './routes/auth.routes.js';
import donorRoutes from './routes/donor.routes.js';
import hospitalRoutes from './routes/hospital.routes.js';
import adminRoutes from './routes/admin.routes.js';
import rewardRoutes from './routes/reward.routes.js';
import donationRoutes from './routes/donation.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import appointmentVerifyRoutes from './routes/appointmentVerify.routes.js';
import requestRoutes from './routes/request.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import discoveryRoutes from './routes/discovery.routes.js';
import helpRoutes from './routes/help.routes.js';
import supportRoutes from './routes/support.routes.js';
import activityRoutes from './routes/activity.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import errorMiddleware from './middlewares/error.middleware.js';
import authMiddleware from './middlewares/auth.middleware.js';
import requireRole from './middlewares/role.middleware.js';
import * as donorController from './controllers/donor.controller.js';
import * as activityController from './controllers/activity.controller.js';
import * as rc from './controllers/reward.controller.js';
import { authLimiter, limiter } from './middlewares/rateLimit.middleware.js';
import maintenanceMiddleware from './middlewares/maintenance.middleware.js';
import webhookRoutes from './routes/webhook.routes.js';
import i18nMiddleware from './middlewares/i18n.middleware.js';

const app = express();
const startedAt = new Date().toISOString();

// ─── Core middleware ──────────────────────────────────────────────────────────
// Security & CORS
app.use(helmet()); // Security headers (applied globally before routes)
app.use(cors({ origin: env.CORS_ORIGIN }));

// Logging middleware (logs all requests with response time)
app.use(requestLogger);

// Webhooks need the raw request body, so mount them before JSON parsing.
app.use('/api/webhooks', webhookRoutes);

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Internationalization helper (exposes `req.t()` and `req.lang`)
app.use(i18nMiddleware);

// ─── NoSQL injection sanitizer ────────────────────────────────────────────────
const sanitizeInPlace = (obj, { replaceWith = '_', request, onSanitize } = {}) => {
  if (!obj || typeof obj !== 'object') return obj;
  const seen = new Set();

  const recurse = (current) => {
    if (!current || typeof current !== 'object' || seen.has(current)) return;
    seen.add(current);

    for (const key of Object.keys(current)) {
      const value = current[key];

      if (key.includes('$') || key.includes('.')) {
        const newKey = key.replace(/\$/g, replaceWith).replace(/\./g, replaceWith);
        current[newKey] = value;

        try {
          if (typeof onSanitize === 'function') onSanitize({ req: request, key });
        } catch (e) {
          // swallow sanitize callback errors
        }

        delete current[key];
        recurse(current[newKey]);
      } else {
        recurse(value);
      }
    }
  };

  recurse(obj);
  return obj;
};

app.use((req, res, next) => {
  try {
    const opts = {
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        securityLogger.injectionAttempt(req.ip, key);
      },
    };
    if (req.body && typeof req.body === 'object')
      sanitizeInPlace(req.body, { replaceWith: opts.replaceWith, request: req, onSanitize: opts.onSanitize });
    if (req.params && typeof req.params === 'object')
      sanitizeInPlace(req.params, { replaceWith: opts.replaceWith, request: req, onSanitize: opts.onSanitize });
    if (req.query && typeof req.query === 'object')
      sanitizeInPlace(req.query, { replaceWith: opts.replaceWith, request: req, onSanitize: opts.onSanitize });
  } catch (err) {
    logger.warn('Sanitization error', {
      message: err?.message,
      ip: req.ip,
    });
  }
  next();
});

// ─── Health / root ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ app: 'LifeLink', status: 'ok' });
});

app.get('/health', (req, res) => {
  const db = getDBHealth();
  const status = db.ok ? 'ok' : 'degraded';
  res.status(db.ok ? 200 : 503).json({
    app: 'LifeLink',
    status,
    pid: process.pid,
    startedAt,
    port: env.PORT,
    env: env.NODE_ENV,
    db,
  });
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// ─── Routes ───────────────────────────────────────────────────────────────────
// Admin BEFORE maintenance middleware so admins always have access
app.use('/admin', limiter, adminRoutes);

// ─── API Documentation (Swagger) ─────────────────────────────────────────────
// Placed BEFORE maintenance middleware so it's never blocked and always accessible
// Runs in all environments except test.
if (env.NODE_ENV !== 'test') {
  try {
    const swaggerUi = (await import('swagger-ui-express')).default;

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customSiteTitle: 'LifeLink API Docs',
      customCssUrl: '/swagger-custom.css',
      customJs: '/swagger-custom.js',
      swaggerOptions: {
        persistAuthorization: true,
      },
    }));

    app.get('/openapi.json', (req, res) => {
      res.json(swaggerSpec);
    });

    logger.info('Swagger documentation initialized', {
      endpoint: '/api-docs',
    });
  } catch (err) {
    logger.error('Failed to initialize Swagger documentation', {
      message: err?.message,
    });
  }
}

// Maintenance check — blocks non-admin routes when enabled
app.use(maintenanceMiddleware);

// Serve static files from public directory
app.use(express.static('public'));

// ─── Business Routes ──────────────────────────────────────────────────────────
// Mount all routes at base path
app.use('/auth', authLimiter, authRoutes);
app.use('/donor', limiter, donorRoutes);
app.use('/donor', limiter, activityRoutes);
app.use('/hospital', limiter, hospitalRoutes);
app.use('/rewards', limiter, rewardRoutes);
app.use('/requests', limiter, requestRoutes);
app.use('/appointments', limiter, appointmentVerifyRoutes);
app.use('/donations/book-appointment', limiter, appointmentRoutes);
app.use('/donations', limiter, donationRoutes);
app.use('/notifications', limiter, notificationRoutes);
app.use('/hospitals', limiter, discoveryRoutes);
app.use('/analytics', limiter, analyticsRoutes);
app.use('/help', helpRoutes);
app.use('/support', limiter, supportRoutes);

// Flutter-facing aliases that keep the newer root paths stable.
app.get('/dashboard', limiter, authMiddleware, requireRole('donor'), donorController.getDashboard);
app.get('/activity', limiter, authMiddleware, requireRole('donor'), activityController.getTimeline);

// REMOVED: Phase 7 - Urgent request endpoints removed
// Use GET /requests/nearby?urgency=critical instead
// app.get('/urgent-requests', limiter, authMiddleware, requireRole('donor'), donorController.getUrgentRequests);
// app.get('/urgent-requests/:requestId', limiter, authMiddleware, requireRole('donor'), donorController.getUrgentRequestDetails);
// app.post('/urgent-requests/:requestId/accept', limiter, authMiddleware, requireRole('donor'), donorController.respondToRequest);
// app.post('/urgent-requests/:requestId/decline', limiter, authMiddleware, requireRole('donor'), donorController.declineUrgentRequest);

// Alias /badges -> /rewards/badges
app.get('/badges', limiter, authMiddleware, requireRole('donor'), rc.getBadges);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const err = new Error(`${req.method} ${req.originalUrl} not found`);
  err.statusCode = 404;
  next(err);
});

// ─── Central error handler ────────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
