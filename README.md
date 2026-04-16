# LifeLink Backend API

LifeLink is a Node.js + Express backend for blood-donation workflows between donors and hospitals. It provides secure authentication, role-based access control, donation request handling, donor matching, and notification-ready service integration.

## Feature Highlights

- Role-aware signup for donor and hospital accounts
- Login with JWT access/refresh tokens
- Email verification flow with tokenized verification links
- Forgot/reset password flow with expiring reset tokens
- Refresh token blacklist with SHA-256 token hashing and TTL cleanup
- Route-level rate limiting (production) with development test bypass header
- SMTP email delivery with HTML templates and development fallback behavior
- Auth E2E flow automation script for regression checks
- Swagger/OpenAPI docs available at `/api-docs`

## Architecture Overview

The project follows a layered architecture:

- `src/routes`: route definitions and OpenAPI annotations
- `src/controllers`: HTTP request/response orchestration
- `src/services`: core business logic (auth, matching, donation, notifications)
- `src/models`: Mongoose schemas and discriminators
- `src/middlewares`: auth, RBAC, rate limiting, centralized error handling
- `src/utils`: JWT helpers, mailer, response helpers, geolocation utilities
- `src/config`: environment, MongoDB, Swagger setup
- `scripts`: tooling and auth E2E automation

## API Base Paths

- `/auth`
- `/donor`
- `/hospital`
- `/admin`

Utility endpoints:

- `GET /`
- `GET /test`
- `GET /api-docs`
- `GET /openapi.json`

## Authentication Endpoints Summary

| Method | Path | Description |
|---|---|---|
| POST | `/auth/signup` | Register donor/hospital and send verification email |
| POST | `/auth/login` | Login (requires verified email) |
| POST | `/auth/logout` | Blacklist refresh token |
| POST | `/auth/refresh-token` | Issue a new access token from a valid refresh token |
| POST | `/auth/forgot-password` | Request password reset email (non-enumerating response) |
| POST | `/auth/reset-password` | Reset password with token and invalidate prior sessions |
| GET | `/auth/me` | Return authenticated user profile |
| GET | `/auth/verify-email` | Send email verification link to user email |
| GET | `/auth/verify-email-token` | Verify account using token |

## Security Features

- Password hashing at model layer using bcrypt pre-save middleware
- Email verification token hashing (SHA-256) before database storage
- Password reset token hashing (SHA-256) before database storage
- Expiring verification/reset tokens with strict validity checks
- Refresh-token blacklist persistence (`RefreshTokenBlacklist`) with TTL index
- Access/refresh token invalidation after password reset using `passwordChangedAt`
- Rate limiting in production: `5 requests / minute / IP`
- Development test bypass for rate limiter via header: `x-test-mode: true`
- Generic forgot-password response to avoid account enumeration

## Email System

- SMTP is used when mail credentials are configured.
- In development, if SMTP is unavailable, auth flow continues and email sending is safely skipped.
- Verification links and token values are logged in development fallback mode for local testing.
- Email templates are bilingual (Arabic + English style blocks).
- Branding logo is configurable through `EMAIL_LOGO_URL`.

## Environment Variables

Create a `.env` file in the project root.

Required/used variables:

- `PORT`
- `MONGO_URI` (alias supported: `MONGODB_URI`)
- `JWT_SECRET`
- `JWT_REFRESH_SECRET` (falls back to `JWT_SECRET` if omitted)
- `FRONTEND_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `EMAIL_LOGO_URL`

Additional optional variables in current codebase:

- `NODE_ENV`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `API_PREFIX`
- `CORS_ORIGIN`
- `BCRYPT_SALT_ROUNDS`

Use `.env.example` as the safe template.

## Setup (Step-by-Step)

1. Install dependencies:
   `npm install`
2. Create your local env file:
   `cp .env.example .env` (or copy manually on Windows)
3. Fill in real values for DB, JWT, and SMTP settings.
4. Start the API in development mode:
   `npm run dev`
5. Open API docs:
   `http://localhost:5000/api-docs`

## Scripts

| Command | Description |
|---|---|
| `npm start` | Run server |
| `npm run dev` | Run server with nodemon |
| `npm run generate:openapi` | Generate OpenAPI artifact |
| `npm run test:auth-flow` | Run end-to-end auth flow script |
| `npm test` | Placeholder script (not used for auth E2E) |

## E2E Auth Testing

Run:

`npm run test:auth-flow`

The script validates:

1. Signup
2. Login blocked before verification
3. Refresh token issuance
4. Logout blacklist behavior
5. Rejection of blacklisted refresh token
6. Email verification token flow
7. Login success after verification

## Additional Docs

- `AUTH_SYSTEM_OVERVIEW.md`: full auth flow and security design
- `LifeLink-Auth-API.postman_collection.json`: Postman testing collection
- `openapi.yaml` / `openapi.json`: generated API contract
