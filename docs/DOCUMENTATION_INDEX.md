# LifeLink Documentation Index

This is the canonical documentation hub for LifeLink. All documents listed here reflect the **current, real state** of the codebase as of May 17, 2026, after the latest audit and doc sync.

---

## 📚 Primary Documentation (Source of Truth)

| File | Description |
|------|-------------|
| [README.md](../README.md) | Project overview, quick start, tech stack, feature status |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, layers, data flow, module map |
| [API_REFERENCE.md](API_REFERENCE.md) | Comprehensive REST API reference (all endpoints) |
| [AUTH_FLOW.md](AUTH_FLOW.md) | Authentication, authorization, 2FA, and FCM token flows |
| [DATA_MODELS.md](DATA_MODELS.md) | MongoDB schema reference (all 25 models) |
| [NOTIFICATION_SYSTEM.md](NOTIFICATION_SYSTEM.md) | FCM + in-app notification architecture |
| [MATCHING_ENGINE.md](MATCHING_ENGINE.md) | Blood-type compatibility + geo-proximity matching |
| [REWARDS_SYSTEM.md](REWARDS_SYSTEM.md) | Points, tiers, badges, and redemption |
| [ELIGIBILITY_RULES.md](ELIGIBILITY_RULES.md) | Donor eligibility rules engine |
| [ADMIN_SYSTEM.md](ADMIN_SYSTEM.md) | Admin panel capabilities, role permissions, audit log |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Comprehensive implementation audit (what's done, what's not) |
| [SETUP_AND_DEPLOYMENT.md](SETUP_AND_DEPLOYMENT.md) | Installation, environment config, and deployment guide |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | Bugs, technical debt, and inconsistencies |
| [SECURITY.md](SECURITY.md) | Security controls, threat mitigations, hardening notes |
| [TESTING.md](TESTING.md) | Test strategy, coverage, and how to run tests |

---

## 🗂️ Legacy and Research Documents

### `/docs/archive/` — Historical Context

These documents reflect earlier design decisions or sprint retrospectives. They may be **partially outdated** — use with caution.

| File | Status |
|------|--------|
| `AUDIT_REPORT.md` | ⚠️ Superseded by PROJECT_STATUS.md |
| `SYSTEM_REVIEW.md` | ⚠️ Superseded by ARCHITECTURE.md |
| `PROJECT_COMPLETION_SUMMARY.md` | 📚 Sprint summary — historical |
| `RELEASE_NOTES.md` | 📚 Historical release notes |
| `implementation_plan_v2.md` | 📚 Historical implementation plan |
| `implementation_plan_for_donor_missing.md` | 📚 Historical sprint plan |
| `CURL_EXAMPLES.sh` | 🔧 Useful but not maintained |
| `LifeLink-Auth-API.postman_collection.json` | 🔧 May be outdated |
| `ROADMAP.md` | 📚 Superseded by PROJECT_STATUS.md and implementation_plan.md |

### `/docs/feature-research/` — Deep-Dive Technical Research

These documents contain deeper technical analysis of specific subsystems. They remain valid as reference material but the canonical status of each system is in the primary docs above.

| File | Topic |
|------|-------|
| `REWARD_SYSTEM_ARCHITECTURE.md` | Rewards engine design decisions |
| `EMERGENCY_NOTIFICATION_SYSTEM.md` | Emergency broadcast design |
| `LOCATION_FLOW_COMPLETE.md` | Geo-location handling flow |
| `POINTS_SYSTEM.md` | Points calculation details |
| `2FA_SYSTEM_REVIEW.md` | 2FA implementation review |
| `SUPPORT_SYSTEM_REVIEW.md` | Support/help system review |
| `TESTING_APPOINTMENTS.md` | Appointment testing scenarios |
| `ARABIC_ENGLISH_SUPPORT.md` | i18n implementation |
| `AUDIT_ACTIVITY_ENDPOINT.md` | Audit log design |

---

## 📋 OpenAPI Specification

The authoritative machine-readable API contract is at the project root:

```
/openapi.yaml   ← Canonical OpenAPI 3 spec
```

Interactive Swagger UI is served at `/api-docs` when the server is running.

> **Rule**: The `openapi.yaml` is the ground truth for all API contracts. Route files include a comment reminder to update `openapi.yaml` for every endpoint change.

---

## 🔄 Documentation Update Process

When making changes to the codebase:

1. **New endpoint** → Update `openapi.yaml` AND `API_REFERENCE.md`
2. **New model field** → Update `DATA_MODELS.md`
3. **Auth flow change** → Update `AUTH_FLOW.md`
4. **Known bug found** → Add to `KNOWN_ISSUES.md`
5. **Feature completed** → Update `PROJECT_STATUS.md`
