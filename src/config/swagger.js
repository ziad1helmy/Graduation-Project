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

const swaggerTags = [
  {
    name: 'Auth',
    description: 'Registration, login, email verification, password reset, 2FA, and token management for all roles',
  },
  {
    name: 'Donor',
    description:
      'All donor-facing endpoints: profile, dashboard, urgent requests, appointments, donation history, rewards, badges, activity, settings, notifications, hospitals',
  },
  {
    name: 'Hospital',
    description: 'Hospital self-management: profile, blood bank, capacity, QR verification, request management',
  },
  {
    name: 'Admin',
    description: 'Admin operations: user management, analytics, reward adjustments, system maintenance',
  },
];

const GENERIC_JSON_EXAMPLE = {
  success: true,
  message: 'Example response',
  data: {},
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const resolveRef = (ref, spec) => {
  if (!ref || typeof ref !== 'string' || !ref.startsWith('#/')) {
    return undefined;
  }

  return ref.split('/').slice(1).reduce((current, segment) => current?.[segment], spec);
};

const mergeExamples = (target, source) => {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return target;
  }

  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      target[key] = value.map((item) => (isPlainObject(item) ? { ...item } : item));
      continue;
    }

    if (isPlainObject(value)) {
      target[key] = mergeExamples(isPlainObject(target[key]) ? { ...target[key] } : {}, value);
      continue;
    }

    target[key] = value;
  }

  return target;
};

const sampleFromSchema = (schema, spec, visited = new Set()) => {
  if (!schema || typeof schema !== 'object') {
    return undefined;
  }

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;

  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, spec);
    if (!resolved || visited.has(schema.$ref)) {
      return undefined;
    }

    visited.add(schema.$ref);
    return sampleFromSchema(resolved, spec, visited);
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return sampleFromSchema(schema.oneOf[0], spec, visited);
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return sampleFromSchema(schema.anyOf[0], spec, visited);
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf.reduce((accumulator, item) => {
      const sample = sampleFromSchema(item, spec, visited);
      if (isPlainObject(sample) && isPlainObject(accumulator)) {
        return mergeExamples(accumulator, sample);
      }

      if (sample !== undefined && accumulator === undefined) {
        return sample;
      }

      if (sample !== undefined && !isPlainObject(sample)) {
        return sample;
      }

      return accumulator;
    }, undefined);
  }

  if (schema.enum?.length) {
    return schema.enum[0];
  }

  if (schema.type === 'array' || schema.items) {
    const itemExample = sampleFromSchema(schema.items || {}, spec, visited);
    return itemExample === undefined ? [] : [itemExample];
  }

  if (schema.type === 'object' || schema.properties) {
    const sample = {};
    for (const [key, propertySchema] of Object.entries(schema.properties || {})) {
      const propertySample = sampleFromSchema(propertySchema, spec, visited);
      if (propertySample !== undefined) {
        sample[key] = propertySample;
      }
    }

    if (Object.keys(sample).length > 0) {
      return sample;
    }

    return undefined;
  }

  switch (schema.type) {
    case 'string':
      switch (schema.format) {
        case 'date-time':
          return '2026-05-08T12:00:00.000Z';
        case 'date':
          return '2026-05-08';
        case 'email':
          return 'user@example.com';
        case 'password':
          return 'P@ssw0rd123';
        case 'uuid':
          return '550e8400-e29b-41d4-a716-446655440000';
        case 'uri':
          return 'https://example.com';
        default:
          return 'string';
      }
    case 'integer':
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'null':
      return null;
    default:
      return undefined;
  }
};

const enrichParameter = (parameter, spec) => {
  if (!parameter || parameter.example !== undefined || !parameter.schema) {
    return;
  }

  const example = sampleFromSchema(parameter.schema, spec);
  if (example !== undefined) {
    parameter.example = example;
  }
};

const enrichMediaType = (mediaType, spec, fallbackExample = GENERIC_JSON_EXAMPLE) => {
  if (!mediaType || mediaType.example !== undefined || mediaType.examples) {
    return;
  }

  const example = sampleFromSchema(mediaType.schema, spec);
  mediaType.example = example !== undefined ? example : fallbackExample;
};

const enrichOperation = (operation, spec) => {
  if (!operation || typeof operation !== 'object') {
    return;
  }

  let hasExample = false;

  for (const parameter of operation.parameters || []) {
    enrichParameter(parameter, spec);
    hasExample = hasExample || parameter.example !== undefined;
  }

  if (operation.requestBody?.content) {
    for (const [contentType, mediaType] of Object.entries(operation.requestBody.content)) {
      if (contentType === 'application/json' || contentType.endsWith('+json')) {
        enrichMediaType(mediaType, spec, {});
        hasExample = hasExample || mediaType.example !== undefined;
      }
    }
  }

  if (operation.responses) {
    for (const response of Object.values(operation.responses)) {
      if (!response?.content) continue;

      for (const [contentType, mediaType] of Object.entries(response.content)) {
        if (contentType === 'application/json' || contentType.endsWith('+json')) {
          enrichMediaType(mediaType, spec);
          hasExample = hasExample || mediaType.example !== undefined;
        }
      }
    }

    if (!hasExample) {
      const preferredResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['202'] || operation.responses.default;
      if (preferredResponse && preferredResponse.content == null) {
        preferredResponse.content = {
          'application/json': {
            example: GENERIC_JSON_EXAMPLE,
          },
        };
        hasExample = true;
      }

      if (!hasExample) {
        operation.responses = operation.responses || {};
        if (!operation.responses['200']) {
          operation.responses['200'] = {
            description: 'Example response',
          };
        }

        operation.responses['200'].content = {
          'application/json': {
            example: GENERIC_JSON_EXAMPLE,
          },
        };
      }
    }
  }

  if (!hasExample) {
    operation.responses = operation.responses || {};
    if (!operation.responses['200']) {
      operation.responses['200'] = {
        description: 'Example response',
      };
    }

    operation.responses['200'].content = {
      'application/json': {
        example: GENERIC_JSON_EXAMPLE,
      },
    };
  }
};

const enrichSwaggerExamples = (spec) => {
  for (const pathItem of Object.values(spec.paths || {})) {
    for (const operation of Object.values(pathItem || {})) {
      enrichOperation(operation, spec);
    }
  }

  return spec;
};

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LifeLink API',
      version: '1.0.0',
      description:
        'OpenAPI documentation for the LifeLink donation platform API. ' +
        'All routes are mounted at root paths.',
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
    tags: swaggerTags,
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

export const swaggerSpec = enrichSwaggerExamples(swaggerJsdoc(swaggerOptions));
export default swaggerSpec;