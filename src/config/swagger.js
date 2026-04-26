import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.js';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LifeLink API',
      version: '1.0.0',
      description: 'OpenAPI documentation for the LifeLink donation platform API. Primary routes are mounted at root paths and compatibility aliases are also available under /api/v1/*.',
    },
    servers: [
      {
        url: env.API_BASE_URL,
        description: env.NODE_ENV === 'production' ? 'Production server' : 'Configured server',
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
  },
  apis: [
    './src/routes/auth.routes.js',
    './src/routes/donor.routes.js',
    './src/routes/hospital.routes.js',
    './src/routes/admin.routes.js',
    './src/routes/reward.routes.js',
    './src/routes/notification.routes.js',
    './src/routes/discovery.routes.js',
    './src/routes/help.routes.js',
    './src/routes/support.routes.js',
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;
