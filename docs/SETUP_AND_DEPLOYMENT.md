# LifeLink Setup & Deployment Guide

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ | ESM modules required |
| npm | 8+ | Bundled with Node.js |
| MongoDB | 6.0+ | Local or MongoDB Atlas |
| Firebase Account | — | For FCM push notifications |
| Resend Account | — | For email delivery |

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd LifeLink
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Server
NODE_ENV=development
PORT=5000

# Database — Required
MONGO_URI=mongodb://localhost:27017/lifelink

# JWT — Required
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Email (Resend)
RESEND_API_KEY=re_your_api_key_here
MAIL_FROM=LifeLink <noreply@yourdomain.com>
DEV_MAIL_TO=your-dev-email@example.com   # Redirects all dev emails here

# Firebase FCM (optional — disables push notifications if absent)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQ...\n-----END RSA PRIVATE KEY-----\n"

# OR use a service account file path:
# FIREBASE_SERVICE_ACCOUNT_PATH=./config/service-account.json

# CORS
CORS_ORIGIN=*

# Security
BCRYPT_SALT_ROUNDS=10
```

> ⚠️ **Important**: If using `FIREBASE_PRIVATE_KEY`, the newlines in the PEM key must be literal `\n` escape sequences within a quoted string. The `env.js` normalizer will convert them automatically.

### 4. Start Development Server

```bash
npm run dev
```

The server starts with hot reload at `http://localhost:5000`.

Available endpoints:
- API: `http://localhost:5000/api/...`
- API Docs: `http://localhost:5000/api-docs`
- Health: `http://localhost:5000/health`

### 5. Seed Demo Data (Optional)

```bash
npm run seed-demo
```

Creates demo users, hospitals, and requests for testing.

---

## Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with nodemon hot reload |
| `npm start` | Start production (no hot reload) |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run generate:openapi` | Regenerate `openapi.yaml` from source |
| `npm run seed-demo` | Seed demo data |
| `npm run smoke-test` | Run smoke tests against running server |

---

## MongoDB Setup

### Local MongoDB

```bash
# macOS (Homebrew)
brew tap mongodb/brew
brew install mongodb-community@6.0
brew services start mongodb-community@6.0
```

MongoDB will be available at `mongodb://localhost:27017`.

### MongoDB Atlas (Cloud)

1. Create a free cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a database user with read/write access
3. Whitelist your IP address (or `0.0.0.0/0` for dev)
4. Copy the connection string:
   ```
   MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/lifelink?retryWrites=true&w=majority
   ```

### Required Indexes

The application creates these indexes automatically via Mongoose schema definitions:

| Collection | Index |
|-----------|-------|
| users | email (unique), role |
| users (donors) | bloodType, isAvailable |
| users (hospitals) | hospitalId (unique), hospitalNameNormalized |
| requests | status, urgency, bloodType, hospitalId |
| donations | donorId, requestId, donorId+status, requestId+status |
| appointments | donorId, hospitalId, status |
| notifications | userId+isRead, createdAt (TTL optional) |
| refreshtokenblacklists | tokenHash, expiresAt (TTL) |
| onetimeotps | email+purpose+expiresAt |
| pointstransactions | donorId, referenceId |

---

## Firebase Setup

### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Enable **Firebase Cloud Messaging** in project settings

### Get Service Account Credentials

1. In Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file

### Configure Credentials (Preferred: Environment Variables)

Extract these values from the downloaded JSON:

```env
FIREBASE_PROJECT_ID=your-project-id          # "project_id" in JSON
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...  # "client_email" in JSON
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE..."  # "private_key" in JSON
```

> The private key contains literal newlines. When placing in `.env`, replace each newline with `\n` and wrap the value in double quotes.

### Alternative: Service Account File

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./config/service-account.json
```

> ⚠️ **NEVER commit `service-account.json` to git.** Add it to `.gitignore`.

---

## Resend Email Setup

1. Create account at [resend.com](https://resend.com)
2. Verify your sending domain
3. Create an API key
4. Set:
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxx
   MAIL_FROM=LifeLink <noreply@yourdomain.com>
   ```

For development without a verified domain, use:
```env
DEV_MAIL_TO=your-personal-email@gmail.com
```
This redirects all emails to your address during development.

---

## Running Tests

Tests use an in-memory MongoDB server — no external database required.

```bash
npm test                    # Run once
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
```

### Test Structure

```
tests/
├── unit/            # Unit tests (services, utils)
├── integration/     # API integration tests (supertest)
├── e2e/             # End-to-end smoke tests
└── helpers/
    ├── factories.js  # Test data factories
    └── db.js         # In-memory MongoDB helpers
```

---

## Production Deployment Checklist

### Security

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong random secrets: `openssl rand -hex 64`
- [ ] Set `JWT_SECRET` and `JWT_REFRESH_SECRET` to separate, strong secrets
- [ ] Verify `config/service-account.json` is NOT committed to git
- [ ] Set `CORS_ORIGIN` to your specific frontend domain (not `*`)
- [ ] Set `BCRYPT_SALT_ROUNDS=12` (higher cost in production)
- [ ] Whitelist MongoDB Atlas IP to your server IP only

### Performance

- [ ] Enable MongoDB Atlas performance monitoring
- [ ] Set up Redis for rate limiting (replace in-memory store)
- [ ] Configure PM2 or similar process manager for clustering

### Monitoring

- [ ] Set up health check monitoring on `/health` endpoint
- [ ] Configure log aggregation (Logtail, Datadog, etc.)
- [ ] Set up alerts for 5xx error spikes

### Infrastructure (Not Currently Implemented)

> ⚠️ Docker and CI/CD pipelines are not yet configured. The following are recommendations for production deployment.

**Recommended stack**:
- Container: Docker + docker-compose
- Process manager: PM2 or Node.js cluster
- Reverse proxy: Nginx (SSL termination, static files)
- CI/CD: GitHub Actions

**Basic production start**:
```bash
NODE_ENV=production node src/server.js
```

Or with PM2:
```bash
pm2 start src/server.js --name lifelink --instances max
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `PORT` | No | `5000` | HTTP server port |
| `MONGO_URI` | **Yes** | — | MongoDB connection URI |
| `MONGODB_URI` | No | — | Alias for `MONGO_URI` |
| `JWT_SECRET` | **Yes** | — | JWT signing secret |
| `JWT_REFRESH_SECRET` | No | `JWT_SECRET` | Refresh token secret (recommended separate) |
| `JWT_EXPIRES_IN` | No | `7d` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | No | `30d` | Refresh token TTL |
| `RESEND_API_KEY` | No | — | Email API key |
| `MAIL_FROM` | No | `LifeLink <onboarding@resend.dev>` | Sender address |
| `DEV_MAIL_TO` | No | — | Dev email override |
| `EMAIL_LOGO_URL` | No | — | Logo URL in emails |
| `FIREBASE_PROJECT_ID` | No | — | Firebase project (FCM disabled if absent) |
| `FIREBASE_CLIENT_EMAIL` | No | — | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | No | — | Firebase private key |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | No | — | Path to service-account.json |
| `CORS_ORIGIN` | No | `*` | CORS allowed origin |
| `FRONTEND_URL` | No | `http://localhost:3000` | Frontend URL (used in emails) |
| `API_BASE_URL` | No | `http://localhost:{PORT}` | API base URL |
| `API_PREFIX` | No | `/api` | API route prefix |
| `BCRYPT_SALT_ROUNDS` | No | `10` | bcrypt work factor |
