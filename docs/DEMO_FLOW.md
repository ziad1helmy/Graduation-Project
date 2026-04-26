# LifeLink Demo Flow Guide

This document is designed for the graduation presentation and Flutter integration team to ensure a flawless, reliable demonstration of the LifeLink backend.

## 1. Pre-requisites & Setup

1. **Environment Configuration**
   Copy the example environment template to create your local `.env` file:
   ```bash
   cp .env.example .env
   ```
   Ensure `MONGO_URI` is pointing to a running MongoDB instance (local or Atlas development cluster).

2. **Dependencies**
   Install all required Node.js packages:
   ```bash
   npm install
   ```

## 2. Startup Sequence

Run the following commands in order to guarantee a clean environment:

1. **Seed the Database**
   This drops old test data and injects verified accounts, bypassing external SMTP verification requirements.
   ```bash
   npm run seed
   ```
   *Expected Output*: `✅ Test accounts seeded successfully!`

2. **Start the Server**
   Start the backend with runtime checks enabled. It automatically binds to port 5000.
   ```bash
   npm start
   ```
   *Expected Output*: `MongoDB connected: lifelink`

3. **Verify Health**
   Ensure the system is active by calling the health endpoint:
   ```bash
   curl http://127.0.0.1:5000/health
   ```
   *Expected Output*: JSON response with `status: ok` and the current process PID.

4. **Run Smoke Tests (Optional but Recommended)**
   Verify that all critical authentication and FCM lifecycle flows are functional:
   ```bash
   npm run smoke
   ```
   *Expected Output*: `✅ All smoke tests passed successfully!`

## 3. Demo Login Credentials

Use the following pre-verified accounts during the Flutter client demo:

### Donor Account
- **Email**: `donor@test.com`
- **Password**: `SecurePass@123`

### Hospital Account
- **Email**: `hospital@test.com`
- **Password**: `SecurePass@123`

## 4. Suggested Demo Flows

### Donor Flow
1. Login via `POST /auth/login` using the Donor Account credentials.
2. The client registers its device token via `POST /auth/fcm-token`.
3. View available hospital requests using the Donor API (`/donor`).

### Hospital Flow
1. Login via `POST /auth/login` using the Hospital Account credentials.
2. The client registers its device token via `POST /auth/fcm-token`.
3. Create a new donation request using the Hospital API (`/hospital`).

## 5. API Documentation

For live request building, schema validation, and endpoint exploration during the presentation, open the Swagger UI:
- **URL**: `http://127.0.0.1:5000/api-docs`

This interactive portal accurately reflects the `openapi.json` contract and supports authorized testing.
