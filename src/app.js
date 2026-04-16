// Define the express app

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import authRoutes from './routes/auth.routes.js';
import donorRoutes from './routes/donor.routes.js';
import hospitalRoutes from './routes/hospital.routes.js';
import adminRoutes from './routes/admin.routes.js';
import errorMiddleware from './middlewares/error.middleware.js';
import { authLimiter, limiter } from './middlewares/rateLimit.middleware.js';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json());


app.post("/debug", (req, res) => {
  console.log(req.body);
  res.send("OK");
});

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

app.use('/auth', authLimiter, authRoutes);
app.use('/donor', limiter, donorRoutes);
app.use('/hospital', limiter, hospitalRoutes);
app.use('/admin', limiter, adminRoutes);

app.get('/test', (req, res) => {
  res.json({ message: 'Test route is working' });
});

// 404 handler – must be last so it only runs when no route matched
app.use((req, res, next) => {
  const err = new Error(`${req.method} ${req.originalUrl} not found`);
  err.statusCode = 404;
  next(err);
});

// Central error handler – always registered last
app.use(errorMiddleware);


export default app;
