## Release Notes — 2026-04-29

Summary of notable changes applied during the 2026-04-28 → 2026-04-29 upgrade cycle:

- Appointments: Added appointment booking model, service, controller, and API routes for donors to book, list, and cancel appointments.
- Request snapshot: `Request` now snapshots hospital name/location at creation to preserve historical context.
- Admin enhancements: New admin role-permissions model and APIs; added ban/unban and admin CRUD features; tightened role-permissions update to protect built-in system roles.
- Donation completion: Added donation completion endpoints and compatibility alias routes for donor flows.
- Tests & E2E: Added E2E improvements and smoke-test fixes. `scripts/fcm-e2e.js` will auto-create and auto-verify a temporary test donor to avoid stale unverified accounts during local runs.
- OpenAPI: Regenerated `openapi.json` to include the new endpoints and updated JSDoc blocks.

Known issues / notes:

- Maps/Directions: No routing/directions API implemented yet (tracked as medium/high priority for client integration).
- CI/Verification: If your CI expects a fixed test account, either run `npm run seed` to create pre-verified users or revert the E2E auto-register behavior in `scripts/fcm-e2e.js`.

For full details and developer notes see `docs/API_QUICK_REFERENCE_AUDIT.md` and the `docs/` folder.
