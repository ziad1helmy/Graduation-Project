# LifeLink Roadmap

---

## Immediate Priority (Pre-Launch / Production Readiness)

### P0 — Critical for Production

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 1 | Verify `service-account.json` not in git, rotate if committed | Low | See KNOWN_ISSUES.md — Critical security risk |
| 2 | Set `JWT_REFRESH_SECRET` as required separate env var | Low | Enforced in production; dev/test keep the fallback |
| 3 | Use environment variables for all Firebase credentials | Low | Still deployment-only; no code change needed if env is already wired |
| 4 | Set `BCRYPT_SALT_ROUNDS=12` in production | Low | Default hardened in production; override via env if needed |
| 5 | Lock `CORS_ORIGIN` to specific domain | Low | Enforced in production; dev/test keep the wildcard fallback |

These P0 items are mostly deployment and environment hardening tasks. Items 2, 4, and 5 now have production-only enforcement in code; item 3 remains a deployment wiring task.

### P1 — Still Worth Doing, But Not Blocking Launch

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 6 | Fix N+1 query in `analytics.service.getDonorStats` | Low | Replace loop with `$lookup` aggregation |
| 7 | Fix duplicate `weight` field in `Donor.model.js` | Low | Remove second definition |
| 8 | Improve rate limiting resilience | Medium | Keep in-memory limiter for now; revisit Redis only if deployment scales beyond one instance |

---

## Short-Term Roadmap (Next Sprint)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 9 | Arabic locale file (`ar.json`) | Medium | Translate the public-facing keys first |
| 10 | Runtime i18n middleware | Medium | Read `user.settings.language` and apply locale to API responses |
| 11 | `2dsphere` index on Donor.location | Low | Enable native MongoDB geo-queries for matching |
| 12 | Expand test coverage | High | Target: stronger service-layer coverage |
| 13 | Implement `privacyMode` enforcement | Low | Filter donor fields in API responses when `privacyMode = true` |

---

## Medium-Term Roadmap

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 14 | Webhook handler implementation | Medium | Add signature verification + payload dispatch |
| 15 | Redemption catalog API | Medium | Catalog of redeemable items, not just points deduction |
| 16 | Donor waitlist for fully-matched requests | Medium | `WaitlistEntry` model exists but no management API |

---

## Long-Term Vision

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 18 | Real-time WebSocket notifications | High | Replace polling with socket.io or SSE |
| 19 | Mobile donor ID QR code | Medium | Permanent donor QR for quick hospital check-in |

## Future / Optional

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 21 | Async FCM notification queue | High | Worth doing only if notification traffic becomes a bottleneck |
| 22 | Redis-backed rate limiting | Medium | Only needed for multi-instance deployments |
| 23 | Docker + docker-compose setup | Medium | Useful for ops, not required for the academic scope |
| 24 | CI/CD pipeline (GitHub Actions) | Medium | Nice to have for release automation |
| 25 | Blood bank inventory management API | High | Larger domain expansion |
| 26 | Admin notifications / alert system | Medium | Extra operational feature |
| 27 | Push notification scheduling | Medium | Deferred/scheduled reminders |
| 28 | Hospital staff sub-accounts | High | Larger permission model |
| 29 | APM / Monitoring integration | Medium | Production observability enhancement |
| 30 | ML-based predictive donor matching | Very High | Research-heavy feature |
| 31 | Multi-tenant hospital networks | Very High | Enterprise expansion |
| 32 | Automated eligibility from wearable data | Very High | External health integrations |
| 33 | Cross-hospital blood request sharing | High | Federated network feature |

---

## Completed

| # | Item | Completed |
|---|------|-----------|
| ✅ | Multi-role authentication | 2025 |
| ✅ | Blood-type compatibility matching engine | 2025 |
| ✅ | FCM push notification system | 2026 |
| ✅ | Rewards / gamification system | 2025 |
| ✅ | Admin dashboard with analytics | 2025 |
| ✅ | Appointment booking with QR verification | 2026 |
| ✅ | Eligibility rules engine | 2025 |
| ✅ | Fix: `broadcastRequest` not triggering FCM | May 2026 |
| ✅ | Fix: Maintenance mode cache invalidation | May 2026 |
| ✅ | Production-grade documentation | May 2026 |
