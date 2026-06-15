# LifeLink Testing Guide

---

## Test Infrastructure

| Tool | Purpose |
|------|---------|
| Vitest | Test runner (Jest-compatible API) |
| SuperTest | HTTP integration test client |
| `mongodb-memory-server` | In-memory MongoDB for tests (no external DB) |
| Custom factories | Test data generators (`tests/helpers/factories.js`) |

Tests run entirely in-memory — no external services required.

---

## Running Tests

```bash
npm test                    # Run all tests once
npm run test:watch          # Watch mode (re-runs on file change)
npm run test:coverage       # Generate coverage report
```

Coverage report is generated at `coverage/` directory (HTML + lcov).

---

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── auth.test.js
│   ├── matching.test.js
│   ├── eligibility.test.js
│   └── reward.test.js
├── integration/             # API integration tests
│   ├── auth.integration.test.js
│   ├── donor.integration.test.js
│   └── request.integration.test.js
├── e2e/                     # Smoke tests
│   └── smoke.test.js
└── helpers/
    ├── factories.js          # Test data factories
    └── db.js                 # In-memory MongoDB setup/teardown
```

---

## Test Categories

### Unit Tests

Test service logic in isolation (no HTTP, no real DB).

Key areas with unit test coverage:
- `matching.service` — blood type matrix, geo-scoring
- `eligibility.service` — all 5 rules (age, deferral, travel, interval, hemoglobin)
- `auth.service` — OTP generation
- `reward.service` — points calculation, tier advancement

### Integration Tests

Test full HTTP request-response cycles with in-memory MongoDB.

Key areas:
- Auth flows: register, login, OTP, FCM token
- Request lifecycle: create, accept, cancel, fulfill
- Donation flow: respond, complete, eligibility check

### E2E / Smoke Tests

Basic health checks against the running server (`npm run smoke-test`).

---

## Writing New Tests

### Test Database Setup

```javascript
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db.js';

const db = createTestDb();

beforeAll(async () => await db.connect());
afterEach(async () => await db.clearCollections());
afterAll(async () => await db.disconnect());
```

### Test Factories

```javascript
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';

// Create a donor with default test values
const donor = await createDonor({ bloodType: 'O+', isAvailable: true });

// Create a hospital
const hospital = await createHospital({ city: 'Cairo' });

// Create a blood request
const request = await createRequest(hospital._id, { bloodType: 'O+', urgency: 'critical' });
```

### Integration Test Pattern

```javascript
import request from 'supertest';
import app from '../../src/app.js';

test('POST /auth/login returns tokens', async () => {
  const { accessToken } = await loginDonor(donor);
  
  const res = await request(app)
    .get('/donor/profile')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  expect(res.body.data.bloodType).toBe('O+');
});
```

### Bypassing Rate Limits in Tests

Add the test bypass header (dev only):
```javascript
.set('X-Test-Mode', 'true')
```

---

## Coverage Goals

| Area | Current (estimated) | Target |
|------|-------------------|--------|
| Auth service | ~70% | 90% |
| Eligibility service | ~80% | 95% |
| Matching service | ~60% | 85% |
| Reward service | ~50% | 85% |
| Notification service | ~20% | 70% |
| Admin service | ~30% | 70% |
| Controllers | ~40% | 75% |
| **Overall** | **~40%** | **80%** |

---

## Known Test Gaps

1. **Notification delivery tests** — FCM calls are not mocked; notification integration tests skip push delivery verification
2. **Appointment QR flow** — no integration test for QR generation + scan + completion cycle
3. **Admin emergency broadcast** — no integration test
4. **Rate limiting behavior** — rate limit bypass header is used in all tests; no test verifying limits are enforced

---

## Mocking External Services

For tests that involve external services, use vitest mocking:

```javascript
// Mock FCM in notification tests
vi.mock('../../src/utils/fcm.js', () => ({
  sendToMultiple: vi.fn().mockResolvedValue({ successCount: 1, failureCount: 0 }),
  sendToOne: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock email in auth tests
vi.mock('../../src/utils/mailer.js', () => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue({ sent: true }),
  sendPasswordResetOtpEmail: vi.fn().mockResolvedValue({ sent: true }),
}));
```
