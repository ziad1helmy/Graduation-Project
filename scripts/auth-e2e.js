/* eslint-disable no-console */

const BASE_URL = process.env.AUTH_BASE_URL || 'http://127.0.0.1:5000';
const VERIFY_TOKEN = process.env.E2E_VERIFY_TOKEN || '';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'SecurePass@123';
const TEST_MODE_HEADER = process.env.E2E_TEST_MODE || 'true';

function buildEmail() {
  return `e2e.${Date.now()}@example.com`;
}

async function callApi(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-test-mode': TEST_MODE_HEADER,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    status: response.status,
    ok: response.ok,
    retryAfter: response.headers.get('retry-after'),
    data,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getHealth() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}

async function callApiWith429Retry(path, options = {}, label = 'API call') {
  const firstAttempt = await callApi(path, options);
  if (firstAttempt.status !== 429) {
    return firstAttempt;
  }

  const retryAfterSeconds = Number(firstAttempt.retryAfter);
  const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? retryAfterSeconds * 1000
    : 61000;

  console.log(`   Rate limited on ${label}. Waiting ${Math.ceil(waitMs / 1000)}s then retrying...`);
  await sleep(waitMs);

  return callApi(path, options);
}

function expectStatus(result, expected, label) {
  if (result.status !== expected) {
    const message = result?.data?.message || 'No message';
    throw new Error(`${label} failed. Expected ${expected}, got ${result.status}. Message: ${message}`);
  }
}

function expectOneOfStatuses(result, expectedStatuses, label) {
  if (!expectedStatuses.includes(result.status)) {
    const message = result?.data?.message || 'No message';
    throw new Error(
      `${label} failed. Expected one of [${expectedStatuses.join(', ')}], got ${result.status}. Message: ${message}`
    );
  }
}

async function main() {
  console.log(`Base URL: ${BASE_URL}`);
  const health = await getHealth();
  if (!health?.app || health.app !== 'LifeLink') {
    throw new Error(`Backend is not reachable at ${BASE_URL}. Start the latest LifeLink server before running this script.`);
  }
  console.log(`Connected to LifeLink backend pid=${health.pid} startedAt=${health.startedAt}`);

  const testEmail = buildEmail();
  console.log(`Using test email: ${testEmail}`);

  console.log('\n1) Sign up donor account');
  const signup = await callApiWith429Retry('/auth/signup', {
    method: 'POST',
    body: {
      fullName: 'E2E Donor',
      email: testEmail,
      password: TEST_PASSWORD,
      role: 'donor',
      phoneNumber: '1234567890',
      dateOfBirth: '1990-05-15',
      gender: 'female',
      bloodType: 'O+',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
      },
    },
  });
  expectStatus(signup, 201, 'Signup');
  const signupRefreshToken = signup?.data?.data?.refreshToken;
  const autoVerificationToken = signup?.data?.data?.verificationToken || '';
  if (!signupRefreshToken) {
    throw new Error('Signup did not return refreshToken');
  }
  console.log('   OK');

  console.log('\n2) Login before email verification should fail');
  const loginBeforeVerify = await callApiWith429Retry('/auth/login', {
    method: 'POST',
    body: {
      email: testEmail,
      password: TEST_PASSWORD,
    },
  });
  expectStatus(loginBeforeVerify, 401, 'Login before verification');
  console.log(`   OK (${loginBeforeVerify?.data?.message || 'Rejected as expected'})`);

  console.log('\n3) Refresh with signup refresh token should succeed');
  const refreshBeforeLogout = await callApiWith429Retry('/auth/refresh-token', {
    method: 'POST',
    body: {
      refreshToken: signupRefreshToken,
    },
  });
  expectStatus(refreshBeforeLogout, 200, 'Refresh before logout');
  console.log('   OK');

  console.log('\n4) Logout should blacklist refresh token');
  const logout = await callApiWith429Retry('/auth/logout', {
    method: 'POST',
    body: {
      refreshToken: signupRefreshToken,
    },
  });
  expectStatus(logout, 200, 'Logout');
  console.log('   OK');

  console.log('\n5) Refresh with blacklisted token should fail');
  const refreshAfterLogout = await callApiWith429Retry('/auth/refresh-token', {
    method: 'POST',
    body: {
      refreshToken: signupRefreshToken,
    },
  });
  expectOneOfStatuses(refreshAfterLogout, [400, 401], 'Refresh after logout');
  console.log(`   OK (${refreshAfterLogout?.data?.message || 'Rejected as expected'})`);

  const token = autoVerificationToken || VERIFY_TOKEN;
  const usingAutoToken = Boolean(autoVerificationToken);
  const usingEnvToken = Boolean(!autoVerificationToken && VERIFY_TOKEN);

  if (!token) {
    console.log('\n6) Request verification email');
    const requestVerifyEmail = await callApiWith429Retry(
      '/auth/verify-email',
      { method: 'POST', body: { email: testEmail } },
      'request verification email'
    );
    expectStatus(requestVerifyEmail, 200, 'Request verification email');
    console.log('   OK');

    console.log('\n7) Verify email + login skipped (no auto token or E2E_VERIFY_TOKEN provided)');
    console.log('   Use one of:');
    console.log('   1) Run in development and use signup auto token response');
    console.log('   2) Set E2E_VERIFY_TOKEN=<token-from-email> and rerun');
    return;
  }

  if (usingAutoToken) {
    console.log('\n6) Using auto-generated token from signup response');
  } else if (usingEnvToken) {
    console.log('\n6) Using ENV token (E2E_VERIFY_TOKEN)');
  }

  console.log('\n7) Verify email token');
  const verifyToken = await callApiWith429Retry(
    '/auth/verify-email-token',
    { method: 'POST', body: { token: token } },
    'verify email token'
  );
  expectStatus(verifyToken, 200, 'Verify email token');
  console.log('   OK');

  console.log('\n8) Login after verification should succeed');
  const loginAfterVerify = await callApiWith429Retry('/auth/login', {
    method: 'POST',
    body: {
      email: testEmail,
      password: TEST_PASSWORD,
    },
  });
  expectStatus(loginAfterVerify, 200, 'Login after verification');
  console.log('   OK');

  console.log('\nAuth E2E flow completed successfully.');
}

main().catch((error) => {
  console.error('\nAuth E2E flow failed:');
  console.error(error.message);
  process.exit(1);
});
