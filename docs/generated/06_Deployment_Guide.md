# LifeLink — Deployment Guide

> **Document Type:** Software Documentation  
> **Version:** 1.0  
> **Generated From:** Codebase Analysis — June 2026  

> ⚠️ **Important:** Docker and CI/CD pipelines are **not implemented** in this project. The steps below describe manual deployment. See Section 6 for what remains to be built.

---

## 1. Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ | ESM modules required (`"type": "module"` in `package.json`) |
| npm | 8+ | Bundled with Node.js |
| MongoDB | 6.0+ | Replica set required for multi-document transactions |
| Firebase Account | — | Required for FCM push notifications |
| Resend Account | — | Required for email delivery (OTP, password reset) |

**Source:** `README.md`, `docs/SETUP_AND_DEPLOYMENT.md`, `package.json`

---

## 2. Required Services

### 2.1 MongoDB

The application requires a MongoDB instance. Two options:

**Local MongoDB (development):**
```bash
# macOS (Homebrew)
brew tap mongodb/brew
brew install mongodb-community@6.0
brew services start mongodb-community@6.0
```

**MongoDB Atlas (recommended for production):**
1. Create a free cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a database user with read/write access
3. Whitelist your server IP (or `0.0.0.0/0` for development)
4. Copy the connection string:
   ```
   MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/lifelink?retryWrites=true&w=majority
   ```

**Connection pool settings (non-configurable via env):**
- `maxPoolSize: 10`
- `minPoolSize: 2`
- `serverSelectionTimeoutMS: 5000`
- `socketTimeoutMS: 45000`

**Source:** `src/config/db.js`

### 2.2 Firebase (FCM Push Notifications)

1. Create or select a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Firebase Cloud Messaging**
3. Go to Project Settings → Service Accounts → Generate new private key
4. Extract credentials from the downloaded JSON:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

**Alternative (file-based):**
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./config/service-account.json
```

> ⚠️ **Never commit `service-account.json` to git.** It is listed in `.gitignore`.

FCM is **optional** — if `FIREBASE_PROJECT_ID` is absent, push notifications are silently disabled. The system continues to function (only in-app notifications will work).

**Source:** `docs/SETUP_AND_DEPLOYMENT.md`, `.env.example`

### 2.3 Resend (Email)

1. Create account at [resend.com](https://resend.com)
2. Verify your sending domain
3. Create an API key:

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
MAIL_FROM=LifeLink <noreply@yourdomain.com>
```

**Development override (redirects all emails to one address):**
```env
DEV_MAIL_TO=your-personal-email@gmail.com
```

Email is **optional** in the sense that the server will start without it, but OTP verification and password reset will not function.

**Source:** `docs/SETUP_AND_DEPLOYMENT.md`, `.env.example`

---

## 3. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `PORT` | No | `5000` | HTTP server port |
| `MONGO_URI` | **Yes** | — | MongoDB connection URI |
| `JWT_SECRET` | **Yes** | — | JWT access token signing secret |
| `JWT_REFRESH_SECRET` | No | `JWT_SECRET` | Refresh token secret (recommended separate) |
| `JWT_EXPIRES_IN` | No | `7d` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | No | `30d` | Refresh token TTL |
| `RESEND_API_KEY` | No | — | Resend email API key |
| `MAIL_FROM` | No | `LifeLink <onboarding@resend.dev>` | Sender email address |
| `DEV_MAIL_TO` | No | — | Development email override |
| `EMAIL_LOGO_URL` | No | — | Logo URL embedded in emails |
| `FIREBASE_PROJECT_ID` | No | — | Firebase project (FCM disabled if absent) |
| `FIREBASE_CLIENT_EMAIL` | No | — | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | No | — | Firebase private key (escape `\n` characters) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | No | — | Alternative: path to service-account.json |
| `CORS_ORIGIN` | No | `*` | CORS allowed origin |
| `FRONTEND_URL` | No | `http://localhost:3000` | Frontend URL (used in email links) |
| `API_BASE_URL` | No | `http://localhost:{PORT}` | API base URL |
| `BCRYPT_SALT_ROUNDS` | No | `10` | bcrypt work factor (use `12` in production) |
| `MATCHING_DISTANCE_KM` | No | `30` | Default donor matching radius in km |
| `EMERGENCY_MATCHING_DISTANCE_KM` | No | `60` | Matching radius for high/critical urgency |
| `OUTBOX_POLL_INTERVAL_MS` | No | `5000` | Notification outbox worker poll interval |
| `ESCALATION_POLL_INTERVAL_MS` | No | `60000` | Request escalation worker poll interval |
| `ENABLE_GEOSPATIAL_INDEX` | No | `false` | Enable MongoDB 2dsphere index for location |

**Source:** `README.md`, `docs/SETUP_AND_DEPLOYMENT.md`, `.env.example`, `src/config/env.js`, `src/services/matching.service.js`, `src/server.js`

---

## 4. Local Development Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd LifeLink

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Start development server
npm run dev
```

Server starts at: `http://localhost:5000`  
API Documentation: `http://localhost:5000/api-docs`  
Health check: `http://localhost:5000/health`

**Available npm scripts:**

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload (`scripts/run-server.js --dev`) |
| `npm start` | Start production (no hot reload) |
| `npm test` | Run all tests (Vitest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run seed` | Seed base data (default settings, reward catalog, badges) |
| `npm run seed-demo` | Seed demo users, hospitals, and requests |
| `npm run smoke` | Run smoke tests against a running server |

**Source:** `package.json`, `README.md`

---

## 5. Server Startup Sequence

On startup (`npm start` or `node src/server.js`):

1. **`validateEnv()`** — Verifies required environment variables are present; exits if missing
2. **`connectDB()`** — Establishes MongoDB connection
3. **`seedDefaultSettings()`** — Creates `SystemSettings` document if it doesn't exist (idempotent)
4. **`initializeDefaultConfig()`** — Creates `RewardsConfig` if it doesn't exist (idempotent)
5. **`seedRewardData()`** — Seeds `Badge` and `RewardCatalog` documents if they don't exist (idempotent)
6. **`app.listen(PORT)`** — Express HTTP server starts
7. **`startOutboxWorker(5000ms)`** — Notification outbox worker starts (in-process `setInterval`)
8. **`startEscalationWorker(60000ms)`** — Request escalation worker starts (in-process `setInterval`)

**Source:** `src/server.js`

---

## 6. Running Tests

Tests use an in-memory MongoDB server — no external database or Firebase credentials required:

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode for development
```

Test infrastructure:
- **Unit tests:** `tests/unit/` — pure function tests, no DB
- **Integration tests:** `tests/integration/` — full API via SuperTest + `MongoMemoryReplSet`
- **E2E/smoke tests:** `tests/e2e/` and `scripts/smoke.js` — require running server

**Source:** `docs/SETUP_AND_DEPLOYMENT.md`, `package.json` devDependencies

---

## 7. Production Deployment

> ⚠️ No Docker or CI/CD configuration is implemented. The following describes manual deployment.

### 7.1 Basic Production Start

```bash
NODE_ENV=production node src/server.js
```

### 7.2 With PM2 (Recommended)

```bash
npm install -g pm2
pm2 start src/server.js --name lifelink --instances max
pm2 save
pm2 startup
```

### 7.3 Production Checklist

**Security:**
- [ ] Set `NODE_ENV=production`
- [ ] Generate strong secrets: `openssl rand -hex 64`
- [ ] Set `JWT_SECRET` and `JWT_REFRESH_SECRET` to separate strong values
- [ ] Set `BCRYPT_SALT_ROUNDS=12`
- [ ] Set `CORS_ORIGIN` to your specific frontend domain (not `*`)
- [ ] Verify `config/service-account.json` is NOT in git
- [ ] Whitelist MongoDB Atlas IP to your server IP only

**Performance:**
- [ ] MongoDB Atlas with appropriate tier for expected load
- [ ] Configure `maxPoolSize` if default of 10 is insufficient
- [ ] PM2 cluster mode for multi-core utilization

**Monitoring:**
- [ ] Health check monitoring on `GET /health` endpoint
- [ ] Log aggregation configured
- [ ] Alerts for 5xx error rate spikes

**Source:** `docs/SETUP_AND_DEPLOYMENT.md`

---

## 8. Health Check Endpoint

The `GET /health` endpoint returns server status without authentication:

```json
{
  "app": "LifeLink",
  "status": "ok",
  "pid": 12345,
  "startedAt": "2026-06-24T10:00:00.000Z",
  "port": 5000,
  "env": "production",
  "db": {
    "status": "connected",
    "ok": true,
    "database": "lifelink"
  }
}
```

Returns `503` with `status: "degraded"` if MongoDB is not connected.

**Source:** `src/app.js` lines 117–129

---

## 9. Graceful Shutdown

The server handles `SIGINT`, `SIGTERM`, and `SIGUSR2` signals:

1. Stops accepting new HTTP connections
2. Clears the outbox worker interval
3. Clears the escalation worker interval
4. Waits 500ms for in-flight worker iterations to complete
5. Closes MongoDB connection
6. Exits (0 on clean shutdown, 1 on error)

If shutdown is not complete within 10 seconds, the process force-exits with code 1.

**Source:** `src/server.js` lines 92–148

---

## 10. What Is Not Yet Implemented

| Missing Infrastructure | Impact |
|----------------------|--------|
| Docker / docker-compose | Manual setup required for each deployment |
| CI/CD pipeline (GitHub Actions) | No automated testing or deployment on push |
| Redis-backed rate limiting | Rate limit state lost on server restart; not shared across instances |
| Async job queue (Bull/BullMQ) | Workers use in-process `setInterval`; not safe for horizontal scaling |
| Reverse proxy configuration (Nginx) | SSL termination and static file serving not configured |

**Source:** `README.md` Known Limitations, `docs/PROJECT_STATUS.md`

---

## Confidence Report

**Verified Facts:**
- Prerequisites (Node.js 20+, MongoDB 6.0+) from `README.md` and `docs/SETUP_AND_DEPLOYMENT.md`.
- Environment variable table comes from `.env.example`, `README.md`, and `docs/SETUP_AND_DEPLOYMENT.md`.
- Server startup sequence comes from `src/server.js` lines 1–52.
- Graceful shutdown logic comes from `src/server.js` lines 92–148.
- Health check response shape comes from `src/app.js` lines 117–129.
- npm scripts come from `package.json`.
- Production checklist comes from `docs/SETUP_AND_DEPLOYMENT.md`.
- Missing infrastructure items come from `README.md` Known Limitations and `docs/PROJECT_STATUS.md`.

**Assumptions:** None.

**Missing Information:**
- `MATCHING_DISTANCE_KM` and `EMERGENCY_MATCHING_DISTANCE_KM` are sourced from `matching.service.js` comments but are not documented in `.env.example`.
- `OUTBOX_POLL_INTERVAL_MS` and `ESCALATION_POLL_INTERVAL_MS` sourced from `server.js` but not in `.env.example`.
- `ENABLE_GEOSPATIAL_INDEX` sourced from `User.model.js` conditional but not in `.env.example`.

**Potential Uncertainty:**
- The `scripts/run-server.js --dev` mechanism was not read; the exact hot-reload tool used is unknown (may be nodemon or custom).
