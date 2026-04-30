import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { env } from './env.js';

// ─── Resolve absolute path ────────────────────────────────────────────────────
// process.cwd() is unreliable on Render — it resolves to the repo root
// (/opt/render/project/src) instead of the src/ directory, so the glob
// './src/routes/*.js' finds nothing and swagger generates an empty spec.
//
// import.meta.url always points to THIS file's real location on disk,
// so __dirname here = .../src/config  →  ../routes/*.js = .../src/routes/*.js
// This works correctly on both local Windows/Mac and Render production.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LifeLink API',
      version: '1.0.0',
      description:
        'OpenAPI documentation for the LifeLink donation platform API. ' +
        'Primary routes are mounted at root paths and compatibility aliases ' +
        'are also available under /api/v1/*.',
    },
    servers: [
      {
        url: env.API_BASE_URL || 'https://graduation-project-cy61.onrender.com',
        description: 'Production server',
      },
      {
        url: 'http://localhost:5000',
        description: 'Development server',
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

  // join(__dirname, '../routes/*.js') resolves to an absolute path:
  //   Local:  C:\...\src\routes\*.js
  //   Render: /opt/render/project/src/src/routes/*.js
  // Both are correct regardless of where Node was started from.
  apis: [join(__dirname, '../routes/*.js')],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
export default swaggerSpec;