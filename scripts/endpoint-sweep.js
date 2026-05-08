import fs from 'fs/promises';
import request from 'supertest';
import { connect, clearDatabase, closeDatabase } from '../tests/helpers/db.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-sweep';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-for-sweep';
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || '4';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.PORT = process.env.PORT || '0';

const PASSWORD = 'TestPass@123!';
const NEXT_PASSWORD = 'TestPass@456!';

const hrtimeMs = (start) => Number(process.hrtime.bigint() - start) / 1e6;

const uniqueEmail = (prefix) => `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2, 8)}@example.com`;

const buildQueryString = (query = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
};

const replacePathParams = (path, params = {}) => {
  let resolved = path;
  Object.entries(params).forEach(([key, value]) => {
    resolved = resolved.replaceAll(`{${key}}`, String(value));
    resolved = resolved.replaceAll(`:${key}`, String(value));
  });
  return resolved;
};

const getAuthHeader = (path, tokens) => {
  const donorToken = tokens.donorPostReset || tokens.donor;

  if (path.startsWith('/admin/') || path.startsWith('/rewards/admin')) return tokens.superadmin;
  if (path.startsWith('/hospital')) return tokens.hospital;
  if (path.startsWith('/donor')) return donorToken;
  if (path.startsWith('/rewards')) return donorToken;
  if (path.startsWith('/notifications')) return donorToken;
  if (path.startsWith('/donations')) return donorToken;
  if (path.startsWith('/support')) return donorToken;
  if (path === '/auth/me' || path === '/auth/validate-token' || path === '/auth/fcm-token') return donorToken;
  if (path === '/auth/logout' || path === '/auth/refresh-token' || path === '/auth/2fa/setup' || path === '/auth/2fa/confirm-setup' || path === '/auth/2fa/disable') return donorToken;
  return null;
};

const makeResponseSnapshot = (res) => {
  const body = res.body && Object.keys(res.body).length > 0 ? res.body : res.text;
  return body;
};

const createRequester = (app) => async (method, path, { body, token, query, headers } = {}) => {
  const fullPath = `${path}${buildQueryString(query)}`;
  const startedAt = process.hrtime.bigint();

  let req = request(app)[method.toLowerCase()](fullPath);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  if (headers) {
    for (const [key, value] of Object.entries(headers)) req = req.set(key, value);
  }
  if (body !== undefined) req = req.send(body);

  try {
    const res = await req;
    return {
      method,
      path: fullPath,
      status: res.status,
      durationMs: Number(hrtimeMs(startedAt).toFixed(3)),
      body: makeResponseSnapshot(res),
      error: null,
    };
  } catch (error) {
    return {
      method,
      path: fullPath,
      status: null,
      durationMs: Number(hrtimeMs(startedAt).toFixed(3)),
      body: error?.message || 'Request failed',
      error: error?.message || String(error),
    };
  }
};

const bodyFor = (path, ctx) => {
  if (path === '/auth/signup' || path === '/auth/register') return ctx.signupBodies.donor;
  if (path === '/auth/login') return { email: ctx.signupBodies.donor.email, password: PASSWORD, role: 'donor' };
  if (path === '/auth/admin/login') return { email: ctx.signupBodies.admin.email, password: PASSWORD, adminKey: ctx.adminKey };
  if (path === '/auth/send-otp' || path === '/auth/verify-email' || path === '/auth/forgot-password') return { email: ctx.signupBodies.donor.email };
  if (path === '/auth/verify-otp') return { email: ctx.signupBodies.donor.email, otp: ctx.otpCode };
  if (path === '/auth/reset-password') return { email: ctx.signupBodies.donor.email, otp: ctx.otpCode, password: NEXT_PASSWORD };
  if (path === '/auth/verify-email-token') return { token: ctx.verificationToken };
  if (path === '/auth/logout' || path === '/auth/refresh-token') return { refreshToken: ctx.refreshToken };
  if (path === '/auth/fcm-token') return { fcmToken: 'fcm-test-token-1' };
  if (path === '/auth/2fa/confirm-setup') return { code: ctx.twoFactorBackupCode };
  if (path === '/auth/2fa/verify') return { tempToken: ctx.twoFactorTempToken, code: ctx.twoFactorCode };
  if (path === '/hospital/request') return ctx.hospitalRequestBody;
  if (path === '/hospital/profile') return { fullName: 'Updated Hospital Name' };
  if (path === '/hospital/staff') return { name: 'Test Nurse', position: 'Nurse', status: 'active', phone: '01234567890', shiftStart: '08:00', shiftEnd: '16:00' };
  if (path === '/hospital/blood-bank-settings') return { criticalThreshold: { 'O+': 2 }, lowThreshold: { 'O+': 5 }, automaticNotifications: true, notificationEmail: ctx.signupBodies.hospital.email };
  if (path === '/hospital/notification-preferences') return { email: true, push: true, sms: false };
  if (path === '/donor/profile') return { fullName: 'Updated Donor Name', phoneNumber: '01098765432', gender: 'male' };
  if (path === '/donor/availability') return { isAvailable: false };
  if (path === '/donor/health-history') return { hasChronicIllness: false, isSmoker: false };
  if (path === '/donor/respond/{requestId}') return { quantity: 1 };
  if (path === '/donations/book-appointment') return ctx.appointmentBody;
  if (path === '/support/contact') return { subject: 'Endpoint sweep', message: 'Testing support endpoint' };
  if (path === '/rewards/catalog/{rewardId}/redeem') return { delivery_preference: 'IN_APP' };
  if (path === '/rewards/admin/users/{userId}/points/adjust') return { amount: 250, reason: 'Endpoint sweep' };
  if (path === '/rewards/admin/catalog/{rewardId}/status') return { status: 'ACTIVE' };
  if (path === '/admin/hospitals') return ctx.adminHospitalBody;
  if (path === '/admin/users/hospital') return ctx.signupBodies.hospital;
  if (path === '/admin/admins') return ctx.signupBodies.superadmin;
  if (path === '/admin/permissions/roles') return { role: 'auditor', permissions: ['read'] };
  if (path === '/admin/permissions/roles/{role}') return { permissions: ['read'] };
  if (path === '/admin/donors/{id}') return { fullName: 'Updated by sweep' };
  if (path === '/admin/hospitals/{id}') return { fullName: 'Updated by sweep' };
  if (path === '/admin/hospitals/{id}/status') return { status: 'active' };
  if (path === '/admin/donors/{id}/ban' || path === '/admin/donors/{id}/unban') return { reason: 'Endpoint sweep' };
  if (path === '/admin/users/{id}/verify' || path === '/admin/users/{id}/unverify' || path === '/admin/users/{id}/suspend' || path === '/admin/users/{id}/unsuspend') return { reason: 'Endpoint sweep' };
  if (path === '/admin/requests/{id}/fulfill' || path === '/admin/requests/{id}/cancel') return { note: 'Endpoint sweep' };
  if (path === '/admin/requests/{id}/broadcast') return { message: 'Endpoint sweep' };
  if (path === '/admin/emergency/broadcast') return { title: 'Endpoint sweep', message: 'Testing emergency broadcast' };
  if (path === '/admin/system/maintenance') return { enabled: false };
  if (path === '/notifications/{id}/read' || path === '/notifications/read-all') return {};
  if (path === '/donor/urgent-requests/{requestId}/accept') return { quantity: 1 };
  if (path === '/hospital/requests/{requestId}') return { status: 'completed' };
  if (path === '/donations/complete') return { requestId: ctx.requestId, donorId: ctx.donorId, quantity: 1 };
  return undefined;
};

const isMethod = (methods, method) => methods.includes(method.toUpperCase());

const main = async () => {
  await connect();
  const { seedDefaultSettings } = await import('../src/services/admin.service.js');
  const { seedRewardData } = await import('../src/services/reward.service.js');
  const { default: User } = await import('../src/models/User.model.js');
  const { signToken } = await import('../src/utils/jwt.js');
  const { default: app } = await import('../src/app.js');

  await clearDatabase();
  await seedDefaultSettings();
  await seedRewardData();

  const donorEmail = uniqueEmail('donor');
  const hospitalEmail = uniqueEmail('hospital');
  const adminEmail = uniqueEmail('admin');
  const superadminEmail = uniqueEmail('superadmin');

  const signupBodies = {
    donor: {
      fullName: 'Sweep Donor',
      email: donorEmail,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      role: 'donor',
      phoneNumber: '01234567890',
      dateOfBirth: '1990-01-01',
      gender: 'male',
      bloodType: 'O+',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
      },
    },
    hospital: {
      fullName: 'Sweep Hospital',
      name: 'Sweep Hospital',
      email: hospitalEmail,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      role: 'hospital',
      type: 'hospital',
      hospitalName: 'Sweep Hospital',
      phone: '0100000001',
      licenseNumber: 'LIC-SWEEP-001',
      address: {
        city: 'Cairo',
        governorate: 'Cairo',
      },
      contactNumber: '0100000001',
      location: 'Cairo, Cairo',
    },
    admin: {
      fullName: 'Sweep Admin',
      email: adminEmail,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      role: 'admin',
    },
    superadmin: {
      fullName: 'Sweep Superadmin',
      email: superadminEmail,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      role: 'admin',
    },
  };

  const signup = async (label, payload) => {
    const res = await request(app).post('/auth/signup').send(payload);
    if (res.status >= 400) {
      throw new Error(`${label} signup failed: ${res.status} ${res.body?.message || res.text}`);
    }
    return res.body.data;
  };

  const donorSignup = await signup('donor', signupBodies.donor);
  const hospitalSignup = await signup('hospital', signupBodies.hospital);
  const adminSignup = await signup('admin', signupBodies.admin);

  const superadminDoc = await User.create({
    fullName: signupBodies.superadmin.fullName,
    email: signupBodies.superadmin.email,
    password: signupBodies.superadmin.password,
    role: 'superadmin',
    isEmailVerified: true,
  });

  const tokens = {
    donor: donorSignup.tokens.accessToken,
    hospital: hospitalSignup.tokens.accessToken,
    admin: adminSignup.tokens.accessToken,
    superadmin: signToken({ userId: superadminDoc._id.toString(), role: 'superadmin' }),
  };

  const adminKey = adminSignup.user?.adminKey || adminSignup.adminKey;

  const ctx = {
    signupBodies,
    donorId: donorSignup.user._id,
    hospitalId: hospitalSignup.user._id,
    adminId: adminSignup.user._id,
    superadminId: superadminDoc._id.toString(),
    verificationToken: donorSignup.verificationToken,
    refreshToken: donorSignup.tokens.refreshToken,
    hospitalRefreshToken: hospitalSignup.tokens.refreshToken,
    adminRefreshToken: adminSignup.tokens.refreshToken,
    donorEmail,
    hospitalEmail,
    adminEmail,
    adminKey,
    otpCode: null,
    resetToken: null,
    twoFactorBackupCode: null,
    twoFactorTempToken: null,
    twoFactorCode: null,
    requestId: null,
    appointmentId: null,
    rewardId: null,
    appointmentBody: null,
    hospitalRequestBody: null,
    adminHospitalBody: {
      name: 'Sweep Admin Hospital',
      type: 'hospital',
      email: uniqueEmail('admin-hospital'),
      phone: '0100000002',
      licenseNumber: 'LIC-SWEEP-ADMIN-001',
      city: 'Cairo',
      state: 'Cairo',
      bloodBanksAvailable: ['O+', 'A+'],
      capacity: 25,
    },
  };

  const donorVerify = await request(app).post('/auth/verify-email-token').send({ token: donorSignup.verificationToken });
  const hospitalVerify = await request(app).post('/auth/verify-email-token').send({ token: hospitalSignup.verificationToken });
  const adminVerify = await request(app).post('/auth/verify-email-token').send({ token: adminSignup.verificationToken });

  ctx.donorVerifyStatus = donorVerify.status;
  ctx.hospitalVerifyStatus = hospitalVerify.status;
  ctx.adminVerifyStatus = adminVerify.status;

  const donorLogin = await request(app).post('/auth/login').send({ email: donorEmail, password: PASSWORD, role: 'donor' });
  const hospitalLogin = await request(app).post('/auth/login').send({ email: hospitalEmail, password: PASSWORD, role: 'hospital', licenseNumber: 'LIC-SWEEP-001' });
  ctx.donorLoginStatus = donorLogin.status;
  ctx.hospitalLoginStatus = hospitalLogin.status;

  const donorOtp = await request(app).post('/auth/forgot-password').send({ email: donorEmail });
  ctx.otpCode = donorOtp.body?.data?.otp;
  const otpVerify = await request(app).post('/auth/verify-otp').send({ email: donorEmail, otp: ctx.otpCode });
  const donorReset = await request(app).post('/auth/reset-password').send({ email: donorEmail, otp: ctx.otpCode, password: NEXT_PASSWORD });
  ctx.resetStatus = donorReset.status;
  const donorLoginAfterReset = await request(app).post('/auth/login').send({ email: donorEmail, password: NEXT_PASSWORD, role: 'donor' });
  ctx.donorLoginAfterResetStatus = donorLoginAfterReset.status;
  tokens.donorPostReset = donorLoginAfterReset.body?.data?.accessToken || tokens.donor;
  ctx.refreshToken = donorLoginAfterReset.body?.data?.refreshToken || ctx.refreshToken;

  const donor2FASetup = await request(app).post('/auth/2fa/setup').set('Authorization', `Bearer ${tokens.donorPostReset}`);
  ctx.twoFactorSecret = donor2FASetup.body?.data?.secret;
  ctx.twoFactorBackupCodes = donor2FASetup.body?.data?.backup_codes || [];
  ctx.twoFactorCode = ctx.twoFactorBackupCodes[0];
  const donor2FAConfirm = await request(app).post('/auth/2fa/confirm-setup').set('Authorization', `Bearer ${tokens.donorPostReset}`).send({ code: ctx.twoFactorCode });
  ctx.donor2FAConfirmStatus = donor2FAConfirm.status;
  const donor2FALogin = await request(app).post('/auth/login').send({ email: donorEmail, password: NEXT_PASSWORD, role: 'donor' });
  ctx.twoFactorTempToken = donor2FALogin.body?.data?.tempToken;
  const donor2FAVerify = await request(app).post('/auth/2fa/verify').send({ tempToken: ctx.twoFactorTempToken, code: ctx.twoFactorBackupCodes[1] || ctx.twoFactorCode });
  ctx.donor2FAVerifyStatus = donor2FAVerify.status;
  const donor2FADisable = await request(app).post('/auth/2fa/disable').set('Authorization', `Bearer ${tokens.donorPostReset}`).send({ password: NEXT_PASSWORD });
  ctx.donor2FADisableStatus = donor2FADisable.status;

  const hospitalRequest = await request(app)
    .post('/hospital/request')
    .set('Authorization', `Bearer ${tokens.hospital}`)
    .send({
      type: 'blood',
      bloodType: 'O+',
      urgency: 'high',
      requiredBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      quantity: 2,
      hospitalContact: '0100000001',
      notes: 'Endpoint sweep request',
    });

  ctx.requestId = hospitalRequest.body?.data?._id;
  ctx.hospitalRequestBody = {
    type: 'blood',
    bloodType: 'O+',
    urgency: 'high',
    requiredBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    quantity: 2,
    hospitalContact: '0100000001',
    notes: 'Endpoint sweep request',
  };

  const donationAppointment = await request(app)
    .post('/donations/book-appointment')
    .set('Authorization', `Bearer ${tokens.donor}`)
    .send({
      hospitalId: ctx.hospitalId,
      requestId: ctx.requestId,
      appointmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Morning preference',
    });

  ctx.appointmentId = donationAppointment.body?.data?._id;
  ctx.appointmentBody = {
    hospitalId: ctx.hospitalId,
    requestId: ctx.requestId,
    appointmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Morning preference',
  };

  const donorRespond = await request(app)
    .post(`/donor/respond/${ctx.requestId}`)
    .set('Authorization', `Bearer ${tokens.donor}`)
    .send({ quantity: 1 });

  ctx.donationId = donorRespond.body?.data?._id;

  const rewardsCatalog = await request(app).get('/rewards/catalog').set('Authorization', `Bearer ${tokens.donor}`);
  const rewardsList = rewardsCatalog.body?.data?.rewards || rewardsCatalog.body?.data?.catalog || rewardsCatalog.body?.data || [];
  ctx.rewardId = rewardsList?.[0]?._id || rewardsList?.[0]?.id || rewardsList?.[0]?.rewardId || rewardsList?.[0];

  if (ctx.rewardId) {
    await request(app)
      .post(`/rewards/catalog/${ctx.rewardId}/redeem`)
      .set('Authorization', `Bearer ${tokens.donor}`)
      .send({ delivery_preference: 'IN_APP' });
  }

  await request(app)
    .post(`/rewards/admin/users/${ctx.donorId}/points/adjust`)
    .set('Authorization', `Bearer ${tokens.admin}`)
    .send({ amount: 250, reason: 'Endpoint sweep' });

  const openapi = JSON.parse(await fs.readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
  const endpoints = Object.entries(openapi.paths || {}).flatMap(([path, operations]) =>
    Object.keys(operations).map((method) => ({ path, method: method.toUpperCase() }))
  );

  const requestWithTiming = createRequester(app);
  const results = [];

  for (const endpoint of endpoints) {
    const token = getAuthHeader(endpoint.path, tokens);
    const resolvedPath = replacePathParams(endpoint.path, {
      requestId: ctx.requestId,
      appointmentId: ctx.appointmentId,
      id: ctx.hospitalId,
      rewardId: ctx.rewardId,
      userId: ctx.donorId,
      role: 'auditor',
    });
    const body = bodyFor(endpoint.path, ctx);
    const result = await requestWithTiming(endpoint.method, resolvedPath, {
      token,
      body,
      headers: endpoint.path === '/auth/verify-email-token' ? { accept: 'application/json' } : undefined,
      query: endpoint.path === '/donor/requests' ? { urgency: 'high' } : undefined,
    });
    results.push(result);
    const statusLabel = result.status === null ? 'ERR' : String(result.status).padStart(3, ' ');
    console.log(`${statusLabel} ${String(result.durationMs).padStart(7, ' ')}ms ${endpoint.method.padEnd(6, ' ')} ${resolvedPath}`);
  }

  const summary = results.map((result) => ({
    ...result,
    category:
      result.status === null || result.status >= 500 ? 'failing' : result.durationMs >= 1000 ? 'slow' : 'working',
  }));

  await fs.writeFile(
    new URL('../endpoint-sweep-report.json', import.meta.url),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      summary,
    }, null, 2),
    'utf8'
  );

  const totals = summary.reduce(
    (acc, item) => {
      acc[item.category] += 1;
      return acc;
    },
    { working: 0, slow: 0, failing: 0 }
  );

  console.log('');
  console.log(`Working: ${totals.working}, Slow: ${totals.slow}, Failing: ${totals.failing}`);
  console.log('Report written to endpoint-sweep-report.json');
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });