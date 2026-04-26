import fetch from 'node-fetch';

const BASE_URL = 'http://127.0.0.1:5000';

async function main() {
  console.log('--- FCM Smoke Test ---');
  
  // 1. Get token
  console.log('Logging in as donor@test.com...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'donor@test.com', password: 'SecurePass@123' })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  if (!token) throw new Error('Login failed');

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
