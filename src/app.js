import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { resolve } from 'path';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import authRoutes from './routes/auth.routes.js';
import donorRoutes from './routes/donor.routes.js';
import hospitalRoutes from './routes/hospital.routes.js';
import adminRoutes from './routes/admin.routes.js';
import rewardRoutes from './routes/reward.routes.js';
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
app.use(express.json());
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
