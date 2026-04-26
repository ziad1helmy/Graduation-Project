# Release Notes: v1.0-demo

The LifeLink backend has reached its primary stabilization milestone, transitioning from feature development into a feature-frozen release candidate. The focus of this release is rigorous reliability, clean integration contracts, and flawless demonstration capabilities.

## Major Stabilization Milestones
- **Authentication Hardening**: The core authentication pipeline has been heavily normalized. The email verification endpoints (`/auth/verify-email` and `/auth/verify-email-token`) were fully migrated to standard `POST` operations that rely on JSON bodies rather than URL parameters, eliminating previous API inconsistencies.
- **FCM Lifecycle Stabilization**: The critical `MongoServerError code 40` defect has been eradicated. The `POST /auth/fcm-token` endpoint now uses an atomic, in-memory `Set` deduplication process before triggering document saves. This resolves race conditions under heavy concurrent loads (e.g., app startup).
- **Security Middleware**: The API is now actively defended by `helmet` for HTTP header security and `express-rate-limit` for DDoS/brute-force mitigation on authentication and core endpoints.

## Tooling & Verification Additions
- **Seed Workflow (`npm run seed`)**: A local database injection tool was developed to bypass SMTP verification during Flutter integration. It safely cleans previous sessions and inserts pre-verified `donor@test.com` and `hospital@test.com` identities. It is guarded against accidental execution in production environments.
- **Unified Smoke Testing (`npm run smoke`)**: A rigorous automated sequence now sequentially validates the `/health` endpoint, the entire E2E Auth Flow (signup, login, refresh, logout, verification), and the FCM Token Lifecycle (duplicate handling, replacement, deletion).
- **Runtime Verification**: The core authentication and device registration paths have achieved 100% pass rates through real execution checks.

## Documentation Restructuring
- The repository root has been purged of obsolete, speculative, and duplicated tracking files.
- The `README.md` is strictly focused on immediate startup and environmental requirements.
- The `/docs` folder acts as the centralized technical hub, containing `API_STATUS.md`, `DEMO_FLOW.md`, Postman collections, and CURL examples matching the verified OpenAPI specifications.

## Known Remaining Limitations
- **Partial Module Status**: The Hospital Discovery (`/hospitals`), Help, and Support modules are currently scaffolded/partial and provide limited functionality.
- **Automated Verification Coverage**: While the authentication module is aggressively covered by `npm run smoke`, the core Donor/Hospital modules (request matching, donation history) rely on manual client testing and are not currently evaluated by the automated CI pipeline.
