import swaggerJsdoc from 'swagger-jsdoc';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LifeLink API',
      version: '1.0.0',
      description: 'OpenAPI documentation for the LifeLink donation platform API.',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local development server',
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
  apis: ['./src/routes/auth.routes.js', './src/routes/donor.routes.js', './src/routes/hospital.routes.js'],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;