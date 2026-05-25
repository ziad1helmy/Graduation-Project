/* eslint-disable no-console */
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

const BASE_URL = process.env.AUTH_BASE_URL || 'http://127.0.0.1:5000';

async function callApi(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  const email = 'ops@cairocare.demo';
  const password = 'HospitalPass@123';
  const hospitalId = 'HOSP-CAIRO-001';

  console.log('1) Valid login');
  const valid = await callApi('/auth/hospital/login', { method: 'POST', body: { email, password, hospitalId } });
  console.log('  status:', valid.status);
  console.log('  body:', JSON.stringify(valid.data));

  const accessToken = valid.data?.data?.accessToken;
  const refreshToken = valid.data?.data?.refreshToken;

  console.log('\n2) Invalid password');
  const invalidPass = await callApi('/auth/hospital/login', { method: 'POST', body: { email, password: 'WrongPass', hospitalId } });
  console.log('  status:', invalidPass.status, 'body:', JSON.stringify(invalidPass.data));

  console.log('\n3) Invalid hospitalId');
  const invalidHosp = await callApi('/auth/hospital/login', { method: 'POST', body: { email, password, hospitalId: 'BAD-ID' } });
  console.log('  status:', invalidHosp.status, 'body:', JSON.stringify(invalidHosp.data));

  console.log('\n4) Missing hospitalId');
  const missingHosp = await callApi('/auth/hospital/login', { method: 'POST', body: { email, password } });
  console.log('  status:', missingHosp.status, 'body:', JSON.stringify(missingHosp.data));

  console.log('\n5) Protected endpoint with valid JWT (/hospital/profile)');
  const profile = await callApi('/hospital/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
  console.log('  status:', profile.status, 'body:', JSON.stringify(profile.data));

  console.log('\n6) Protected endpoint with invalid JWT');
  const invalidJwt = await callApi('/hospital/profile', { headers: { Authorization: 'Bearer totally.invalid.token' } });
  console.log('  status:', invalidJwt.status, 'body:', JSON.stringify(invalidJwt.data));

  console.log('\n7) Protected endpoint with expired JWT (signed locally)');
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.log('  SKIPPED: JWT_SECRET not set in env');
  } else {
    const expired = jwt.sign({ userId: 'doesnotmatter', role: 'hospital' }, secret, { expiresIn: '-1s' });
    const expiredRes = await callApi('/hospital/profile', { headers: { Authorization: `Bearer ${expired}` } });
    console.log('  status:', expiredRes.status, 'body:', JSON.stringify(expiredRes.data));
  }

  console.log('\n8) Refresh token flow (use refreshToken from valid login)');
  const refreshRes = await callApi('/auth/refresh-token', { method: 'POST', body: { refreshToken } });
  console.log('  status:', refreshRes.status, 'body:', JSON.stringify(refreshRes.data));

  console.log('\nDone');
}

run().catch((err) => { console.error('Script error', err); process.exit(1); });
