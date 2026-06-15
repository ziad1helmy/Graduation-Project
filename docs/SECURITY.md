# LifeLink Security Overview

---

## Security Controls Summary

| Control | Implementation | Status |
|---------|---------------|--------|
| HTTP Security Headers | Helmet.js | ✅ |
| CORS | express/cors | ✅ |
| NoSQL Injection Prevention | express-mongo-sanitize | ✅ |
| Rate Limiting | express-rate-limit (in-memory) | ✅ |
| Password Hashing | bcryptjs (10 rounds) | ✅ |
| JWT Access Tokens | HS256, 7-day TTL | ✅ |
| JWT Refresh Tokens | HS256, 30-day TTL, blacklisted | ✅ |
| OTP Hashing | SHA-256 before storage | ✅ |
| Admin Third Factor | `adminKey` pre-shared secret | ✅ |
| Soft Delete (not hard delete) | `deletedAt` field | ✅ |
| Suspension Check | Auth middleware | ✅ |
| Email Enumeration Protection | `forgotPassword` silent on "not found" | ✅ |
| Audit Logging | `AuditLog` collection | ✅ |
| Maintenance Mode Auth Bypass | Admin role check in middleware | ✅ |
| FCM Token Cap | Max 10 tokens per user | ✅ |
| Invalid FCM Token Cleanup | Automatic on delivery failure | ✅ |
| Strict Schema Mode (Hospital) | `hospitalSchema.strict('throw')` | ✅ |
| HTTPS | Not managed by app (handled by reverse proxy) | — |
| Redis Rate Limiting | Future enhancement for multi-instance scaling | ◻️ |
| Security Monitoring / SIEM | Future enhancement for centralized alerting | ◻️ |

---

## Authentication Security

### Password Storage
- bcryptjs with configurable salt rounds (default: 10, recommended: 12 in production)
- `passwordChangedAt` field invalidates refresh tokens issued before password change

### JWT Security
- **Separate secrets** for access and refresh tokens recommended (`JWT_REFRESH_SECRET`)
  - ⚠️ If `JWT_REFRESH_SECRET` is not set, falls back to `JWT_SECRET` — see KNOWN_ISSUES.md
- Refresh tokens are **hashed (SHA-256) before blacklist storage** — raw tokens never stored
- Blacklist entries TTL-indexed by `expiresAt` — auto-cleaned by MongoDB

### Admin Login Third Factor
- Admins require email + password + `adminKey`
- `adminKey` is a 32-character random hex string generated at admin creation
- Stored as **plaintext** in the `adminKey` field (acts as a pre-shared API key)
- ⚠️ If `adminKey` is leaked, admin account is compromised even without email + password brute force

---

## Rate Limiting

Two tiers of rate limiting:

| Limiter | Window | Dev Max | Prod Max | Applied To |
|---------|--------|---------|----------|-----------|
| `limiter` (general) | 15 min | 200 | 60 | All routes (global) |
| `authLimiter` | 15 min | 150 | 20 | Login/signup routes |

**Test bypass**: In development, requests with `X-Test-Mode: true` header bypass rate limiting.

**Known limitation**: Rate counters are in-memory and reset on server restart. Not effective for multi-instance deployments.

---

## Input Sanitization

### NoSQL Injection Prevention
`express-mongo-sanitize` strips `$` and `.` characters from request bodies and query strings, preventing MongoDB operator injection:
```
{ "$where": "this.password == 'x'" } → { } (sanitized)
```

### Schema Validation
- Mongoose schema validators provide a second layer
- `hospitalSchema.strict('throw')` rejects unknown fields at the model level (not just strips them)
- Manual validators in `/src/validation/` for request body shapes

---

## Data Privacy

- **Soft delete**: User accounts are soft-deleted (`deletedAt` set) — data is retained but access is blocked at auth middleware
- **Password exclusion**: Password hash is excluded from all default queries (`select: false`)
- **Admin queries**: Strip sensitive fields: `password, emailVerificationOtp, emailVerificationOtpExpires, resetPasswordToken, resetPasswordExpires, passwordChangedAt`
- **Donor privacy mode**: `settings.privacyMode` field exists on Donor schema — ⚠️ no enforcement logic implemented in API responses yet

---

## Security Events Logging

The `securityLogger` in `src/utils/logger.js` logs:
- Rate limit exceeded events (IP + endpoint)
- (Extendable for failed auth attempts, unusual access patterns)

Security events are structured logs — integrate with a SIEM or log aggregation service for alerting.

---

## Threat Mitigations

| Threat | Mitigation |
|--------|-----------|
| Brute force login | Auth rate limiter (20 req/15min prod) |
| OTP brute force | Max 5 attempts per OTP record |
| SQL/NoSQL injection | express-mongo-sanitize + Mongoose validation |
| XSS | Helmet Content-Security-Policy headers |
| Clickjacking | Helmet frameguard (deny) |
| MIME sniffing | Helmet noSniff |
| CSRF | JWT bearer token (not cookie-based — no CSRF surface) |
| Token leakage | Refresh tokens SHA-256 hashed in blacklist |
| Credential stuffing | Rate limiting + password validation on registration |
| Account enumeration | Forgot password returns success regardless of email existence |
| FCM token abuse | 10-token cap per user, automatic invalid token cleanup |

---

## Known Security Gaps

1. **In-memory rate limiting only** — counters reset on restart and do not scale across multiple instances (see KNOWN_ISSUES.md)
2. **`adminKey` plaintext storage** — consider hashing with bcrypt if treating it as a long-lived secret
3. **`JWT_REFRESH_SECRET` optional** — should be required in production
4. **`service-account.json` may be committed** — CRITICAL, see KNOWN_ISSUES.md
5. **No HTTPS enforcement** — must be handled by reverse proxy (Nginx/Cloudflare) in production
6. **`privacyMode` not enforced** — donor privacy mode flag has no API-level enforcement
7. **No security audit logging to external systems** — logs are file-based only
8. **No Redis-backed limiter** — only needed if the deployment expands beyond a single server or restarts must preserve counters
9. **No SIEM integration** — only needed for centralized alerting and compliance-grade monitoring

---

## Production Security Recommendations

1. Set `NODE_ENV=production` — enables strict rate limits, disables dev bypasses
2. Generate strong JWT secrets: `openssl rand -hex 64`
3. Use separate `JWT_SECRET` and `JWT_REFRESH_SECRET`
4. Set `BCRYPT_SALT_ROUNDS=12`
5. Restrict `CORS_ORIGIN` to your specific frontend domain
6. Use Redis-backed rate limiting only if you deploy multiple app instances
7. Deploy behind HTTPS-terminating reverse proxy (Nginx + Let's Encrypt)
8. Rotate Firebase service account credentials and use environment variables only (no file)
9. Enable MongoDB Atlas network access controls (IP whitelist)
10. Set up log aggregation and alerting on security events if you need centralized monitoring
