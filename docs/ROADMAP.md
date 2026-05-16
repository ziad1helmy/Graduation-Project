# LifeLink Roadmap

---

## Immediate Priority (Pre-Launch / Production Readiness)

### P0 — Critical for Production

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 1 | Verify `service-account.json` not in git, rotate if committed | Low | See KNOWN_ISSUES.md — Critical security risk |
| 2 | Set `JWT_REFRESH_SECRET` as required separate env var | Low | Currently falls back to `JWT_SECRET` |
| 3 | Use environment variables for all Firebase credentials | Low | Remove dependency on `service-account.json` file |
| 4 | Set `BCRYPT_SALT_ROUNDS=12` in production | Low | Config change only |
| 5 | Lock `CORS_ORIGIN` to specific domain | Low | Config change only |

### P1 — High Priority

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 6 | **Async FCM notification queue** | High | Replace synchronous FCM with Bull/BullMQ + Redis workers |
| 7 | **Redis-backed rate limiting** | Medium | Replace in-memory store for multi-instance safety |
| 8 | **Docker + docker-compose setup** | Medium | For reproducible dev and prod environments |
| 9 | Fix N+1 query in `analytics.service.getDonorStats` | Low | Replace loop with `$lookup` aggregation |
| 10 | Fix duplicate `weight` field in `Donor.model.js` | Low | Remove second definition |

---

## Short-Term Roadmap (Next Sprint)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 11 | Arabic locale file (`ar.json`) | Medium | Translate all 40+ keys from `en.json` |
| 12 | Runtime i18n middleware | Medium | Read `user.settings.language`, load locale, apply to API responses |
| 13 | CI/CD pipeline (GitHub Actions) | Medium | Lint + test + deploy on push to main |
| 14 | `2dsphere` index on Donor.location | Low | Enable native MongoDB geo-queries for matching |
| 15 | Matching pre-filter via `$near` | Medium | Replace in-memory Haversine with MongoDB geo-query |
| 16 | Replace `console.error` with structured logger | Low | Several controllers and analytics service |
| 17 | Expand test coverage | High | Target: 80% coverage on service layer |
| 18 | Implement `privacyMode` enforcement | Low | Filter donor fields in API responses when `privacyMode = true` |

---

## Medium-Term Roadmap

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 19 | Webhook handler implementation | Medium | Add signature verification + payload dispatch |
| 20 | Blood bank inventory management API | High | `bloodBanksAvailable` schema field exists, no API |
| 21 | Admin notifications / alert system | Medium | Admins should receive FCM for critical events |
| 22 | 2FA time drift window (±1 TOTP period) | Low | Improve UX for users with clock skew |
| 23 | Redemption catalog API | Medium | Catalog of redeemable items, not just points deduction |
| 24 | CRLF normalization in `admin.routes.js` | Low | Cosmetic — convert to LF line endings |
| 25 | Hospital staff sub-accounts | High | Multiple users per hospital with different permissions |
| 26 | Donor waitlist for fully-matched requests | Medium | `WaitlistEntry` model exists but no management API |
| 27 | Push notification scheduling | Medium | Deferred/scheduled notifications (appointment reminders) |

---

## Long-Term Vision

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 28 | APM / Monitoring integration | Medium | Datadog, Sentry, or New Relic |
| 29 | ML-based predictive donor matching | Very High | Predict availability based on donation patterns |
| 30 | Multi-tenant hospital networks | Very High | Hospital groups with shared resources |
| 31 | Real-time WebSocket notifications | High | Replace polling with socket.io or SSE |
| 32 | Mobile donor ID QR code | Medium | Permanent donor QR for quick hospital check-in |
| 33 | Automated eligibility from wearable data | Very High | Integrate with health APIs for hemoglobin updates |
| 34 | Cross-hospital blood request sharing | High | Federated request network |

---

## Completed

| # | Item | Completed |
|---|------|-----------|
| ✅ | Multi-role authentication with 2FA | 2025 |
| ✅ | Blood-type compatibility matching engine | 2025 |
| ✅ | FCM push notification system | 2026 |
| ✅ | Rewards / gamification system | 2025 |
| ✅ | Admin dashboard with analytics | 2025 |
| ✅ | Appointment booking with QR verification | 2026 |
| ✅ | Eligibility rules engine | 2025 |
| ✅ | Campaign-based points multipliers | 2026 |
| ✅ | Fix: `broadcastRequest` not triggering FCM | May 2026 |
| ✅ | Fix: Maintenance mode cache invalidation | May 2026 |
| ✅ | Production-grade documentation | May 2026 |
