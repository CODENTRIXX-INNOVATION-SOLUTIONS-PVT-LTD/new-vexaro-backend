'use strict';

const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { env } = require('./env');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vexaro Courier API',
      version: '1.0.0',
      description: 'Enterprise Courier Shipping & Billing Platform REST API documentation.',
    },
    servers: [
      {
        url: `http://localhost:${env.PORT || 5000}/api/v1`,
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.routes.js', './src/modules/**/*.model.js'],
};

const swaggerSpec = swaggerJSDoc(options);

const setupSwagger = (app) => {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

module.exports = { setupSwagger, swaggerSpec };
