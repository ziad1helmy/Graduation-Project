import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { resolve } from 'path';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import donorRoutes from './routes/donor.routes.js';
import hospitalRoutes from './routes/hospital.routes.js';
import adminRoutes from './routes/admin.routes.js';
import rewardRoutes from './routes/reward.routes.js';
import donationRoutes from './routes/donation.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import discoveryRoutes from './routes/discovery.routes.js';
import helpRoutes from './routes/help.routes.js';
import supportRoutes from './routes/support.routes.js';
import errorMiddleware from './middlewares/error.middleware.js';
import { authLimiter, limiter } from './middlewares/rateLimit.middleware.js';
import maintenanceMiddleware from './middlewares/maintenance.middleware.js';

const app = express();
const startedAt = new Date().toISOString();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '1mb' }));
// express-mongo-sanitize attempted to replace `req.query` which is a getter in
// Express 5 and causes: "Cannot set property query of IncomingMessage which has only a getter".
// Replace with a minimal in-place sanitizer that does not reassign `req.query`.
const sanitizeInPlace = (obj, { replaceWith = '_' , request, onSanitize } = {}) => {
  if (!obj || typeof obj !== 'object') return obj;
  const seen = new Set();

  const recurse = (current) => {
    if (!current || typeof current !== 'object' || seen.has(current)) return;
    seen.add(current);

    for (const key of Object.keys(current)) {
      const value = current[key];

      // If key contains mongo-reserved characters, rename the key in-place
      if (key.includes('$') || key.includes('.')) {
        const newKey = key.replace(/\$/g, replaceWith).replace(/\./g, replaceWith);

        // Move value to new key without replacing the root object reference
        if (!(newKey in current)) current[newKey] = value;
        else current[newKey] = value;

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
    const opts = { replaceWith: '_', onSanitize: ({ req, key }) => { console.warn(`Sanitized key: ${key}`); } };

    // Sanitize common mutable containers in-place (do not reassign req.query)
    if (req.body && typeof req.body === 'object') sanitizeInPlace(req.body, { replaceWith: opts.replaceWith, request: req, onSanitize: opts.onSanitize });
    if (req.params && typeof req.params === 'object') sanitizeInPlace(req.params, { replaceWith: opts.replaceWith, request: req, onSanitize: opts.onSanitize });
    if (req.query && typeof req.query === 'object') sanitizeInPlace(req.query, { replaceWith: opts.replaceWith, request: req, onSanitize: opts.onSanitize });
  } catch (err) {
    // Never break request flow due to sanitization errors
    console.warn('[sanitize] error', err && err.message ? err.message : err);
  }
  next();
});

if (env.NODE_ENV !== 'production') {
  const swaggerUi = (await import('swagger-ui-express')).default;
  const { swaggerSpec } = await import('./config/swagger.js');

  app.use(express.static(resolve(process.cwd(), 'public')));

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'LifeLink API Docs',
    swaggerOptions: {
      persistAuthorization: true,
    },
  }));

  app.get('/openapi.json', (req, res) => {
    res.json(swaggerSpec);
  });
}

// Routes (order matters – specific routes before 404)
app.get('/', (req, res) => {
  res.json({ app: 'LifeLink', status: 'ok' });
});

app.get('/health', (req, res) => {
  res.json({
    app: 'LifeLink',
    status: 'ok',
    pid: process.pid,
    startedAt,
    port: env.PORT,
    env: env.NODE_ENV,
  });
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Admin routes are mounted BEFORE maintenance middleware
// so admins can always access the system
app.use('/admin', limiter, adminRoutes);
app.use('/api/v1/admin', limiter, adminRoutes);

// Maintenance middleware blocks non-admin routes when enabled
app.use(maintenanceMiddleware);

app.use('/auth', authLimiter, authRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/donor', limiter, donorRoutes);
app.use('/api/v1/donor', limiter, donorRoutes);
app.use('/hospital', limiter, hospitalRoutes);
app.use('/api/v1/hospital', limiter, hospitalRoutes);
app.use('/rewards', limiter, rewardRoutes);
app.use('/api/v1/rewards', limiter, rewardRoutes);
// Donor appointment routes (must be accessible to donors)
app.use('/donations/book-appointment', limiter, appointmentRoutes);
app.use('/api/v1/donations/book-appointment', limiter, appointmentRoutes);
app.use('/donations', limiter, donationRoutes);
app.use('/api/v1/donations', limiter, donationRoutes);
app.use('/notifications', limiter, notificationRoutes);
app.use('/api/v1/notifications', limiter, notificationRoutes);
app.use('/hospitals', limiter, discoveryRoutes);
app.use('/api/v1/hospitals', limiter, discoveryRoutes);
app.use('/help', helpRoutes);
app.use('/api/v1/help', helpRoutes);
app.use('/support', supportRoutes);
app.use('/api/v1/support', supportRoutes);



// 404 handler – must be last so it only runs when no route matched
app.use((req, res, next) => {
  const err = new Error(`${req.method} ${req.originalUrl} not found`);
  err.statusCode = 404;
  next(err);
});

// Central error handler – always registered last
app.use(errorMiddleware);


export default app;
