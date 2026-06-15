# LifeLink Authentication & Authorization Flow

---

## Role System

LifeLink has four roles stored in the `User.role` field:

| Role | Description | Who Creates Them |
|------|-------------|-----------------|
| `donor` | Blood donor (mobile app user) | Self-registration |
| `hospital` | Hospital staff account | Admin only |
| `admin` | Platform administrator | Superadmin only |
| `superadmin` | Full-access administrator | System seeded / another superadmin |

Donor and Hospital extend the base User via Mongoose discriminators (the `__t` field is automatically set). Admin and superadmin are plain User documents — they do not use a discriminator, they are identified only by `role: 'admin'` or `role: 'superadmin'`.

---

## Token System

### Access Token
- Algorithm: HS256 JWT
- Default TTL: `7d` (configurable via `JWT_EXPIRES_IN`)
- Payload: `{ userId, role, iat, exp }`
- Used as: `Authorization: Bearer <token>` header

### Refresh Token
- Algorithm: HS256 JWT
- Default TTL: `30d` (configurable via `JWT_REFRESH_EXPIRES_IN`)
- Secret: `JWT_REFRESH_SECRET` (falls back to `JWT_SECRET` if not set)
- Stored in: MongoDB `RefreshTokenBlacklist` when revoked
- Blacklist entry TTL: matches token expiry (`expiresAt` field, TTL-indexed)

### Scoped Tokens (Internal)
Used for password reset intermediate state and similar temporary flows:
- Payload includes: `{ ...userPayload, purpose: 'password_reset' }`
- TTL: 10 minutes
- Verified by checking `decoded.purpose === expectedPurpose`

---

## Signup Flow (Donors Only)

```
POST /auth/signup
    │
    ├── Validate role === 'donor' (other roles blocked from public signup)
    ├── Run validateRegister() — check required fields, format
    ├── Check email uniqueness in DB
    ├── Normalize location coordinates (supports lat/lng, latitude/longitude, nested coordinates)
    ├── Donor.create({ ...baseData, phoneNumber, dateOfBirth, bloodType, gender })
    ├── user.createEmailVerificationOtp() — 6-digit OTP, 10-min TTL
    ├── user.save() — OTP persisted (hashed)
    ├── sendEmailVerificationEmail() — async with 2-second timeout (fire-and-forget on timeout)
    └── Return { accessToken, refreshToken, user, verificationEmail }
```

**Notes:**
- Signup returns tokens immediately (user is logged in before verifying email)
- Email verification is required for login on subsequent sessions (`isEmailVerified` checked in `loadLoginUser`)
- OTP stored as SHA-256 hash in `emailVerificationOtp` field on User model

---

## Email Verification Flow

```
1. User receives email with 6-digit OTP

2. POST /auth/verify-email-otp { email, otp }
    ├── Find user by email
    ├── Compare hashed OTP (SHA-256)
    ├── Check expiry (emailVerificationOtpExpires)
    ├── Set isEmailVerified = true
    └── Return success

3. POST /auth/verify-email { email }   ← Resend OTP
    └── Regenerates OTP and sends again
```

---

## Login Flow (Donor / Hospital)

```
POST /auth/login          (donor)
POST /auth/hospital/login (hospital)
    │
    ├── Normalize email
    ├── Find user (email + role) — select +password, +deletedAt, +isSuspended, +isEmailVerified
    ├── Check: not deleted, not suspended, email verified
    ├── bcrypt.compare(password, hash)
    ├── Role check: user.role must match requested role
    ├── Hospital extra: user.hospitalId must match provided hospitalId
    └── Return { accessToken, refreshToken, user }
```

---

## Admin Login Flow

```
POST /auth/admin/login
    │
    ├── email + password + adminKey required
    ├── Find user where role IN ['admin', 'superadmin']
    ├── Check: not deleted, not suspended, email verified
    ├── bcrypt.compare(password, hash)
    └── Return { accessToken, refreshToken, admin } (admin shape, not user shape)
```

**Admin key** is a 16-byte random hex string generated when the admin account is created. It is returned once on creation and stored as plaintext in the `adminKey` field (not hashed — by design, as it acts as a pre-shared key that admins need to store).

---


## Logout Flow

```
POST /auth/logout { refreshToken, fcmToken? }
    │
    ├── jwt.verifyRefreshToken(refreshToken)
    ├── Hash token (SHA-256)
    ├── RefreshTokenBlacklist.updateOne({ $setOnInsert }) — upsert (idempotent)
    ├── If fcmToken provided: User.updateOne({ $pull: fcmTokens }) — fire-and-forget
    └── Return { success: true }
```

---

## Refresh Token Flow

```
POST /auth/refresh-token { refreshToken }
    │
    ├── Hash token → check blacklist
    ├── jwt.verifyRefreshToken(refreshToken)
    ├── Find user — check passwordChangedAt vs token iat
    │   (if password changed after token issued → reject)
    └── Return { accessToken }  ← new access token only, same refresh token
```

---

## FCM Token Management

Donors register their device's Firebase Cloud Messaging token to receive push notifications.

### Register (Append)
```
POST /auth/fcm-token (requires auth) { fcmToken }
    │
    ├── Normalize token (trim)
    ├── Deduplicate: uniqueCleanTokens([...existing, new])
    ├── Enforce cap: MAX 10 tokens per user (slice from end)
    └── user.save()
```

### Replace (All Tokens)
```
PUT /auth/fcm-token (requires auth) { fcmToken }
    │
    └── User.updateOne({ $set: { fcmTokens: [newToken] } })
```

### Remove (On Logout / Explicit)
```
DELETE /auth/fcm-token (requires auth) { fcmToken }
    │
    └── User.updateOne({ $pull: { fcmTokens: token } })
```

**Cap**: Maximum 10 FCM tokens per user. Oldest tokens are evicted when cap is exceeded (slice from start).

---

## Auth Middleware

All protected routes pass through `auth.middleware.js`:

```
Authorization: Bearer <token>
    │
    ├── jwt.verifyToken(token) — throws if expired/invalid
    ├── User.findById(userId) — select +deletedAt, +isSuspended
    ├── Check: user.deletedAt — 401 if deleted
    ├── Check: user.isSuspended — 403 if suspended
    ├── Attach to req.user = { _id, userId, role, ... }
    └── next()
```

---

## Role Middleware

```javascript
requireRole('admin', 'superadmin')   // called after authMiddleware
    │
    ├── Check req.user.role in allowed roles
    └── 403 if not allowed
```

Used on admin routes: `router.use(authMiddleware, requireRole('admin', 'superadmin'))`

---

## Password Reset Flow

```
1. POST /auth/forgot-password { email }
    └── Sends OTP via email (fire-and-forget, silently handles "not found")

2. POST /auth/verify-otp { email, otp }   (optional step to pre-validate)
    └── Returns { verified: true }

3. POST /auth/reset-password { email, otp, password }
    │
    ├── Find most recent unused OTP for email with PASSWORD_RESET_OTP_PURPOSE
    ├── Check expiry and attempts (max 5)
    ├── bcrypt.hash(newPassword)
    ├── user.password = hashed, user.passwordChangedAt = now
    ├── Mark OTP as used (resetTokenUsedAt)
    └── Send confirmation email (fire-and-forget)
```

---

## Security Notes

1. **OTP storage**: All OTPs (email verification + password reset) stored as SHA-256 hashes, never plaintext
2. **Refresh token revocation**: SHA-256 hash of the raw refresh token is stored in blacklist (so raw token never persists)
3. **Timing safety**: Admin login uses `bcrypt.compare` (constant-time) for passwords
4. **Email enumeration**: `forgotPassword` silently ignores "Account not found" — returns success regardless to prevent email enumeration
5. **Hospital ID**: Hospital login requires the `hospitalId` field to match — prevents cross-hospital account access even with valid credentials
