# LifeLink Technical Documentation

Welcome to the LifeLink backend technical documentation hub. This directory contains API specifications, testing artifacts, and architectural information.

## Runtime Architecture
The backend is built with:
- **Node.js + Express**: Core web server
- **MongoDB + Mongoose**: Database and ODM
- **JWT**: Stateless session management and scoped tokens
- **Firebase Admin**: Push notifications (FCM)
- **Nodemailer**: SMTP email delivery

## Authentication Flow (Verified)
The authentication system uses role-based access control (RBAC) with MongoDB Discriminators (`User` -> `Donor` | `Hospital`).

1. **Registration**: 
   - `POST /auth/signup`
   - Role-specific schemas must be satisfied.
   - An unverified account is created, returning an access/refresh token.
2. **Email Verification**:
   - `POST /auth/verify-email` triggers a verification email.
   - `POST /auth/verify-email-token` verifies the token.
3. **Login**:
   - `POST /auth/login` checks credentials. If 2FA is active, returns a short-lived `tempToken` for `POST /auth/2fa/verify`.
4. **FCM Tokens**:
   - `POST /auth/fcm-token` registers a device token (Flutter should call this on startup/login).
   - Atomic array manipulation is used to prevent race-condition defects.

## Available Documentation Artifacts
- **[OpenAPI / Swagger](../openapi.yaml)**: Definitive source for API contracts.
- **[Postman Collection](LifeLink-Auth-API.postman_collection.json)**: Ready-to-import Postman workspace.
- **[CURL Examples](CURL_EXAMPLES.sh)**: Executable shell script containing curl commands for all auth paths.

## Running Tests
For end-to-end testing, the backend provides tools to bypass standard SMTP/OTP limits in development:

### 1. Seeding Test Accounts
Use the built-in seed script to insert pre-verified test accounts directly into the database:
```bash
npm run seed
```
This generates:
- **Donor**: `donor@test.com` / `SecurePass@123`
- **Hospital**: `hospital@test.com` / `SecurePass@123`

### 2. Auth Smoke Tests
To run the automated E2E sequence:
```bash
npm run test:auth-flow
```
*Note: The server must be running (`npm start`) before executing smoke tests.*
