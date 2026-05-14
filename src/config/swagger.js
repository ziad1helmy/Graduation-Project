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
      'All donor-facing endpoints: profile, dashboard, urgent requests, appointments, donation history, rewards, badges, activity, settings, notifications, hospitals, analytics, campaigns',
  },
  {
    name: 'Hospital',
    description: 'Hospital self-management: profile, blood bank, capacity, QR verification, request management',
  },
  {
    name: 'Admin',
    description: 'Admin operations: user management, analytics, rewards, campaigns, system maintenance, metrics, and audit logs',
  },
];

const GENERIC_JSON_EXAMPLE = {
  success: true,
  message: 'Example response',
  data: {},
};

const DEMO_EXAMPLE_IDS = {
  donorId: '69f3df915f42685cbbbcbb18',
  donorIdAlt: '69f3df915f42685cbbbcbb19',
  donorIdCompleted: '69f3df915f42685cbbbcbb1a',
  hospitalId: '69f3df915f42685cbbbcbb1b',
  hospitalIdAlt: '69f3df925f42685cbbbcbb1c',
  requestIdCritical: '69fe540565ff7785a031314f',
  requestIdHigh: '69fe540565ff7785a0313150',
  requestIdCompleted: '69fe540565ff7785a0313151',
  requestIdCancelled: '69fe540565ff7785a0313152',
  requestIdOrgan: '69fe540565ff7785a0313153',
  requestIdONegative: '69fe540565ff7785a0313154',
  donationIdCompleted: '69fe540565ff7785a0313157',
  appointmentIdPending: '69fe540565ff7785a031315b',
  appointmentIdConfirmed: '69fe540565ff7785a031315c',
  appointmentIdVerify: '69fe540565ff7785a031315d',
  rewardId: '69fe540565ff7785a0313165',
  notificationId: '69fe540565ff7785a0313170',
  staffId: '69fe540565ff7785a0313180',
};

const DEMO_EXAMPLES = {
  baseUrl: 'https://graduation-project-cy61.onrender.com',
  donorLogin: {
    email: 'aya.hassan@lifelink.demo',
    password: 'DonorPass@123',
  },
  hospitalLogin: {
    email: 'ops@cairocare.demo',
    password: 'HospitalPass@123',
  },
  adminLogin: {
    email: 'admin@lifelink.demo',
    password: 'AdminPass@123',
    adminKey: 'ADMIN-DEMO-KEY-2026',
  },
  supportEmail: 'aya.hassan@lifelink.demo',
  qrToken: 'demo-qr-noor-verify',
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

const getDemoParameterExample = (path, parameter) => {
  const name = parameter?.name;
  if (!name) return undefined;

  const parameterExamples = {
    page: 1,
    limit: 10,
    skip: 0,
    read: false,
    month: '2026-05',
    months: 6,
    date: '2026-05-12',
    date_from: '2026-05-01T00:00:00.000Z',
    date_to: '2026-05-31T23:59:59.000Z',
    city: 'Cairo',
    governorate: 'Cairo',
    search: 'Cairo Care',
    urgency: 'critical',
    status: 'pending',
    type: 'blood',
    bloodType: 'O+',
    category: 'FOOD',
    sort_by: 'COST_ASC',
    role: 'custom-ops',
    action: 'suspend',
  };

  if (parameterExamples[name] !== undefined) {
    return parameterExamples[name];
  }

  if (name === 'hospitalId') return DEMO_EXAMPLE_IDS.hospitalId;
  if (name === 'appointmentId') return DEMO_EXAMPLE_IDS.appointmentIdConfirmed;
  if (name === 'requestId') {
    if (path.includes('/urgent-requests/')) return DEMO_EXAMPLE_IDS.requestIdCritical;
    if (path.includes('/hospital/requests/')) return DEMO_EXAMPLE_IDS.requestIdHigh;
    return DEMO_EXAMPLE_IDS.requestIdCritical;
  }
  if (name === 'rewardId') return DEMO_EXAMPLE_IDS.rewardId;
  if (name === 'userId') return DEMO_EXAMPLE_IDS.donorId;
  if (name === 'id') {
    if (path.includes('/admin/requests/')) return DEMO_EXAMPLE_IDS.requestIdCritical;
    if (path.includes('/admin/donors/')) return DEMO_EXAMPLE_IDS.donorId;
    if (path.includes('/admin/hospitals/')) return DEMO_EXAMPLE_IDS.hospitalId;
    if (path.includes('/admin/users/')) return DEMO_EXAMPLE_IDS.donorId;
    if (path.includes('/hospital/staff/')) return DEMO_EXAMPLE_IDS.staffId;
    if (path.includes('/notifications/')) return DEMO_EXAMPLE_IDS.notificationId;
    if (path.includes('/hospitals/')) return DEMO_EXAMPLE_IDS.hospitalId;
    return DEMO_EXAMPLE_IDS.requestIdCritical;
  }

  return undefined;
};

const enrichParameter = (parameter, spec, path) => {
  if (!parameter || !parameter.schema) {
    return;
  }

  const demoExample = getDemoParameterExample(path, parameter);
  if (demoExample !== undefined) {
    parameter.example = demoExample;
    return;
  }

  if (parameter.example !== undefined) {
    return;
  }

  const example = sampleFromSchema(parameter.schema, spec);
  if (example !== undefined) {
    parameter.example = example;
  }
};

const getDemoRequestExample = (path, method) => {
  const requestExamples = {
    'POST /auth/login': DEMO_EXAMPLES.donorLogin,
    'POST /auth/hospital/login': DEMO_EXAMPLES.hospitalLogin,
    'POST /auth/admin/login': DEMO_EXAMPLES.adminLogin,
    'POST /auth/forgot-password': { email: DEMO_EXAMPLES.supportEmail },
    'POST /auth/reset-password': { email: DEMO_EXAMPLES.supportEmail, otp: '123456', password: 'NewPass@123' },
    'POST /auth/verify-otp': { email: DEMO_EXAMPLES.supportEmail, otp: '123456' },
    'POST /auth/verify-email': { email: DEMO_EXAMPLES.supportEmail },
    'POST /auth/verify-email-otp': { email: DEMO_EXAMPLES.supportEmail, otp: '123456' },
    'POST /auth/2fa/verify': { tempToken: '<TEMP_2FA_TOKEN>', code: '123456' },
    'POST /auth/2fa/disable': { password: 'AdminPass@123' },
    'POST /auth/fcm-token': { fcmToken: 'fcm-test-token-1' },
    'PUT /auth/fcm-token': { fcmToken: 'fcm-test-token-2' },
    'DELETE /auth/fcm-token': { fcmToken: 'fcm-test-token-2' },
    'POST /donations/validate': { hospitalId: DEMO_EXAMPLE_IDS.hospitalId, date: '2026-05-12T10:00:00.000Z' },
    'POST /donations/complete': { donationId: DEMO_EXAMPLE_IDS.donationIdCompleted, notes: 'Donation completed successfully.' },
    'POST /donations/book-appointment': {
      hospitalId: DEMO_EXAMPLE_IDS.hospitalId,
      requestId: DEMO_EXAMPLE_IDS.requestIdCritical,
      appointmentDate: '2026-05-12T10:00:00.000Z',
      notes: 'Available in the morning.',
    },
    'PATCH /donations/book-appointment/{appointmentId}': { date: '2026-05-13', time: '11:00 AM' },
    'POST /appointments/verify-qr': { qrToken: DEMO_EXAMPLES.qrToken },
    'PUT /donor/profile': {
      fullName: 'Aya Hassan',
      phoneNumber: '01011111111',
      gender: 'female',
      weight: 60,
      location: { city: 'Cairo', governorate: 'Cairo' },
    },
    'POST /donor/respond/{requestId}': { quantity: 1 },
    'PUT /donor/availability': { isAvailable: true },
    'PATCH /donor/health-history': {
      chronicConditions: [],
      medications: ['Iron supplement'],
      allergies: ['Penicillin'],
      notes: 'Healthy and ready for donation.',
      lastCheckupDate: '2026-04-20',
    },
    'PUT /donor/settings': {
      pushNotifications: true,
      emergencyAlerts: true,
      privacyMode: false,
      language: 'en',
    },
    'PUT /hospital/profile': {
      fullName: 'Cairo Care Operations',
      hospitalName: 'Cairo Care Hospital',
      contactNumber: '1044444444',
      address: { city: 'Cairo', governorate: 'Cairo' },
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0511, lng: 31.2435 },
      },
    },
    'POST /hospital/request': {
      type: 'blood',
      bloodType: 'O+',
      urgency: 'critical',
      requiredBy: '2026-05-12T10:00:00.000Z',
      quantity: 3,
      notes: 'Emergency surgery support',
    },
    'PUT /hospital/requests/{requestId}': { status: 'in-progress' },
    'PUT /hospital/blood-bank-settings': {
      criticalThreshold: { 'O+': 4, 'A-': 2 },
      lowThreshold: { 'O+': 12, 'A-': 8 },
      automaticNotifications: true,
      notificationEmail: 'ops@cairocare.demo',
    },
    'PUT /hospital/notification-preferences': { email: true, push: true, sms: false },
    'POST /hospital/staff': {
      name: 'Sara Fawzy',
      position: 'PHLEBOTOMIST',
      status: 'ON_DUTY',
      phone: '01170000001',
      shiftStart: '09:00',
      shiftEnd: '17:00',
    },
    'POST /admin/system/maintenance': { enabled: false, message: 'Demo mode active' },
    'PUT /admin/donors/{id}': {
      fullName: 'Aya Hassan',
      phoneNumber: '01011111111',
      bloodType: 'O+',
      isAvailable: true,
    },
    'POST /admin/donors/{id}/ban': { reason: 'Temporary compliance review' },
    'PUT /admin/hospitals/{id}/status': { action: 'suspend', reason: 'Compliance audit' },
    'POST /admin/users/hospital': {
      fullName: 'Alexandria Demo Hospital',
      email: 'alex.demo@lifelink.demo',
      password: 'HospitalPass@123',
      hospitalName: 'Alexandria Demo Hospital',
      licenseNumber: 'LIC-ALEX-2001',
      contactNumber: '1066666666',
      lat: 31.2001,
      long: 29.9187,
      address: { city: 'Alexandria', governorate: 'Alexandria' },
    },
    'PATCH /admin/users/{id}/suspend': { reason: 'Repeated policy violation' },
    'PATCH /admin/requests/{id}/cancel': { reason: 'Transferred to another hospital' },
    'POST /admin/emergency/broadcast': {
      title: 'Emergency O+ Need',
      message: 'Critical O+ blood request in Cairo.',
      governorate: 'Cairo',
      city: 'Cairo',
      bloodTypes: ['O+'],
    },
    'POST /rewards/catalog/{rewardId}/redeem': {
      delivery_preference: 'IN_APP',
      delivery_contact: null,
    },
    'POST /rewards/admin/users/{userId}/points/adjust': {
      amount: 100,
      reason: 'Demo bonus points',
    },
    'PATCH /rewards/admin/catalog/{rewardId}/status': { status: 'ACTIVE' },
    'POST /support/contact': {
      subject: 'Need help with reward redemption',
      message: 'I want to confirm when the Coffee Voucher becomes available.',
    },
  };

  return requestExamples[`${method.toUpperCase()} ${path}`];
};

const enrichMediaType = (mediaType, spec, fallbackExample = GENERIC_JSON_EXAMPLE, explicitExample) => {
  if (!mediaType) {
    return;
  }

  if (explicitExample !== undefined) {
    mediaType.example = explicitExample;
    return;
  }

  if (mediaType.example !== undefined || mediaType.examples) {
    return;
  }

  const example = sampleFromSchema(mediaType.schema, spec);
  mediaType.example = example !== undefined ? example : fallbackExample;
};

const appendDemoDescription = (operation, path, method) => {
  const demoRequestExample = getDemoRequestExample(path, method);
  const demoNote = [
    'Demo seed available via `npm run seed-demo`.',
    `Base URL example: ${DEMO_EXAMPLES.baseUrl}`,
    demoRequestExample ? 'This operation includes a seeded demo request example.' : 'Parameter examples are aligned with the seeded demo dataset where possible.',
  ].join(' ');

  operation.description = operation.description
    ? `${operation.description}\n\n${demoNote}`
    : demoNote;
};

const enrichOperation = (operation, spec, path, method) => {
  if (!operation || typeof operation !== 'object') {
    return;
  }

  let hasExample = false;
  appendDemoDescription(operation, path, method);

  for (const parameter of operation.parameters || []) {
    enrichParameter(parameter, spec, path);
    hasExample = hasExample || parameter.example !== undefined;
  }

  const demoRequestExample = getDemoRequestExample(path, method);
  if (operation.requestBody?.content) {
    for (const [contentType, mediaType] of Object.entries(operation.requestBody.content)) {
      if (contentType === 'application/json' || contentType.endsWith('+json')) {
        enrichMediaType(mediaType, spec, {}, demoRequestExample);
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
  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      enrichOperation(operation, spec, path, method);
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
        'All routes are mounted at root paths. ' +
        'For realistic data and examples, run `npm run seed-demo` and use the seeded demo credentials, QR tokens, and printed IDs.',
    },
    servers: [
      {
        url: 'https://graduation-project-cy61.onrender.com',
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
