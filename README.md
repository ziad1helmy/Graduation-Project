# LifeLink Backend API

LifeLink is a Node.js + Express backend for donor-hospital donation workflows. This repository is the verified stabilization branch prepared for Flutter client integration.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Environment Configuration**:
   Copy the example environment file and fill in required values (e.g. MongoDB URI).
   ```bash
   cp .env.example .env
   ```
3. **Start the Development Server**:
   ```bash
   npm start
   ```
4. **Verify Runtime**:
   Ensure the API is active by checking the health endpoint:
   ```bash
   curl http://127.0.0.1:5000/health
   ```
5. **View API Documentation**:
   Open your browser to:
   `http://127.0.0.1:5000/api-docs`

## Key Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start backend with runtime checks |
| `npm run dev` | Start backend in watch mode |
| `npm run seed` | Seed local database with verified test accounts |
| `npm run test:auth-flow` | Run E2E authentication smoke tests |
| `npm run generate:openapi` | Update the `openapi.json` artifact from YAML |

## Test Accounts

For Flutter development, bypass SMTP verification by seeding the database with pre-verified accounts:

```bash
npm run seed
```

> [!WARNING]
> The seed script is strictly for **development environments only**. Built-in safeguards will actively prevent this script from executing against `NODE_ENV=production` or Atlas production clusters.

This generates:
- **Donor**: `donor@test.com` / `SecurePass@123`
- **Hospital**: `hospital@test.com` / `SecurePass@123`

## Technical Documentation

Detailed architectural notes, request collections, and OpenAPI files are located in the [`/docs`](docs/README.md) directory.

- **[docs/README.md](docs/README.md)**: Architecture, Auth Flows, and Testing details.
- **[docs/LifeLink-Auth-API.postman_collection.json](docs/LifeLink-Auth-API.postman_collection.json)**: Importable Postman workspace.
- **[openapi.yaml](openapi.yaml)**: OpenAPI / Swagger source of truth.
