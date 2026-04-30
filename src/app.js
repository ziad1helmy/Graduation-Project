import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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

// ─── Resolve __dirname for ESM ────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const startedAt = new Date().toISOString();

// ─── Core middleware ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '1mb' }));

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
        console.warn(`[sanitize] Removed dangerous key: ${key}`);
      },
    };
    if (req.body && typeof req.body === 'object')
      sanitizeInPlace(req.body, { replaceWith: opts.replaceWith, request: req, onSanitize: opts.onSanitize });
    if (req.params && typeof req.params === 'object')
      sanitizeInPlace(req.params, { replaceWith: opts.replaceWith, request: req, onSanitize: opts.onSanitize });
    if (req.query && typeof req.query === 'object')
      sanitizeInPlace(req.query, { replaceWith: opts.replaceWith, request: req, onSanitize: opts.onSanitize });
  } catch (err) {
    console.warn('[sanitize] error:', err?.message ?? err);
  }
  next();
});

// ─── Health / root ────────────────────────────────────────────────────────────
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

app.get('/favicon.ico', (req, res) => res.status(204).end());

// ─── Routes ───────────────────────────────────────────────────────────────────
// Admin BEFORE maintenance middleware so admins always have access
app.use('/admin', limiter, adminRoutes);
app.use('/api/v1/admin', limiter, adminRoutes);

// Maintenance check — blocks non-admin routes when enabled
app.use(maintenanceMiddleware);

// ─── API Documentation (Swagger) ─────────────────────────────────────────────
// Placed AFTER maintenance middleware so it's never blocked and always accessible
// Runs in all environments except test.
if (env.NODE_ENV !== 'test') {
  try {
    const swaggerUi = (await import('swagger-ui-express')).default;
    const swaggerJsdoc = (await import('swagger-jsdoc')).default;

    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'LifeLink API',
          version: '1.0.0',
          description: 'Blood donation matching platform — REST API documentation',
        },
        servers: [
          {
            url: 'https://graduation-project-cy61.onrender.com/api/v1',
            description: 'Production (Render)',
          },
          {
            url: 'http://localhost:5000/api/v1',
            description: 'Local development',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
      apis: [join(__dirname, './routes/*.js')],
    };

    const swaggerSpec = swaggerJsdoc(swaggerOptions);

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

    console.log('[swagger] ✅ Docs available at /api-docs');
  } catch (err) {
    console.error('[swagger] ❌ Failed to initialize:', err?.message ?? err);
  }
}

// ─── Business Routes ──────────────────────────────────────────────────────────
app.use('/auth', authLimiter, authRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);

app.use('/donor', limiter, donorRoutes);
app.use('/api/v1/donor', limiter, donorRoutes);

app.use('/hospital', limiter, hospitalRoutes);
app.use('/api/v1/hospital', limiter, hospitalRoutes);

app.use('/rewards', limiter, rewardRoutes);
app.use('/api/v1/rewards', limiter, rewardRoutes);

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

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const err = new Error(`${req.method} ${req.originalUrl} not found`);
  err.statusCode = 404;
  next(err);
});

// ─── Central error handler ────────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
