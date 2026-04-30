import fetch from 'node-fetch';

const BASE_URL = 'http://127.0.0.1:5000';

async function main() {
  console.log('--- FCM Smoke Test ---');
  
  // 1. Prepare test user
  const TEST_EMAIL = `donor+${Date.now()}@test.com`;
  const TEST_PASSWORD = 'SecurePass@123';
  // 1. Get token (attempt login uses dynamic test email)
  console.log(`Logging in as ${TEST_EMAIL}...`);
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  });
  
  let loginData = await loginRes.json();
  console.log('Login response status:', loginRes.status, 'body:', loginData);
  let token = loginData && loginData.data && loginData.data.accessToken;
  if (!token) {
    console.log(`Attempting to register test user ${TEST_EMAIL}...`);
    const signupRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-mode': 'true' },
      body: JSON.stringify({ fullName: 'Test Donor', email: TEST_EMAIL, password: TEST_PASSWORD, role: 'donor', phoneNumber: '0100000000', dateOfBirth: '1990-01-01' })
    });
    const signupData = await signupRes.json().catch(() => ({}));
    console.log('Signup response status:', signupRes.status, 'body:', signupData);

    // If the environment returned a verification token, verify the email automatically for E2E
    const verificationToken = signupData?.data?.verificationToken || signupData?.verificationToken || signupData?.data?.verification_token;
    if (verificationToken) {
      console.log('Auto-verifying email with token from signup response...');
      const verifyRes = await fetch(`${BASE_URL}/auth/verify-email-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-mode': 'true' },
        body: JSON.stringify({ token: verificationToken })
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      console.log('Verify email status:', verifyRes.status, 'body:', verifyData);
    }

    // Retry login
    const loginRes2 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
    });
    loginData = await loginRes2.json();
    console.log('Retry login status:', loginRes2.status, 'body:', loginData);
    token = loginData && loginData.data && loginData.data.accessToken;
    if (!token) {
      console.error('Login failed after signup/verif attempt, full response:', loginData);
      throw new Error('Login failed: missing accessToken after signup/verif');
    }
  }

  // 2. Unauthorized behavior
  const unauthRes = await fetch(`${BASE_URL}/auth/fcm-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fcmToken: 'test1' })
  });
  console.log(`Unauthorized check: ${unauthRes.status}`);

  // 3. Validation failure
  const validRes = await fetch(`${BASE_URL}/auth/fcm-token`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({})
  });
  console.log(`Validation check: ${validRes.status}`);

  // 4. Successful Registration
  const reg1 = await fetch(`${BASE_URL}/auth/fcm-token`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ fcmToken: 'token_A' })
  });
  console.log(`Reg token_A: ${reg1.status}`);

  // 5. Duplicate handling
  const reg2 = await fetch(`${BASE_URL}/auth/fcm-token`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ fcmToken: 'token_A' })
  });
  const reg2Data = await reg2.json();
  console.log(`Duplicate token_A tokenCount: ${reg2Data.data.tokenCount}`);

  // 6. Replace flow
  const rep = await fetch(`${BASE_URL}/auth/fcm-token`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ fcmToken: 'token_B' })
  });
  const repData = await rep.json();
  console.log(`Replace with token_B tokenCount: ${repData.data.tokenCount}`);

  // 7. Delete flow
  const del = await fetch(`${BASE_URL}/auth/fcm-token`, {
    method: 'DELETE',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ fcmToken: 'token_B' })
  });
  console.log(`Delete token_B: ${del.status}`);

  console.log('--- FCM Smoke Test Completed ---');
}

main().catch(console.error);
