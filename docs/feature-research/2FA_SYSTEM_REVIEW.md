# Two-Factor Authentication (2FA) Codebase Review

Date: 2026-05-15

This document provides a comprehensive review of the current 2FA implementation within the authentication system, analyzing its flow, gaps, adherence to security best practices, and actionable improvements.

## 1. Analyze the current flow
The 2FA system follows a standard TOTP (Time-based One-Time Password) implementation using a separate `TwoFactor` mongoose model.

1. **Setup (`POST /auth/2fa/setup`)**: Authenticated user requests 2FA. The server generates a TOTP secret and backup codes, storing them as `pendingSecret` and `pendingBackupCodes` in the database. Returns a `qr_code` URI for Authenticator apps.
2. **Confirm Setup (`POST /auth/2fa/confirm-setup`)**: User submits the first OTP. The server verifies it against `pendingSecret`. On success, it atomically moves the pending credentials to `secret` and `backupCodes` and sets `enabled: true`.
3. **Login Verification (`POST /auth/2fa/verify`)**: During login, if a user has 2FA enabled, they receive a `requires2FA: true` response with a `tempToken`. They submit this `tempToken` and their 6-digit `code` to this endpoint. The server validates the scoped JWT, reads the secret, and verifies the TOTP within a 90-second window (T-30s, T, T+30s). It also accepts backup codes.
4. **Disable (`POST /auth/2fa/disable`)**: Requires the user's password. Verifies the password, then atomically disables 2FA and deletes the secrets from the database.

## 2. Identify what's missing
While the core TOTP logic is sound, there are several critical security gaps:

*   **No Brute-Force Protection**: TOTP codes are only 6 digits (1,000,000 possibilities). There is no account-level lockout mechanism. An attacker who compromises a password can brute-force the 6-digit code.
*   **Plaintext Secrets**: The TOTP `secret` and `backupCodes` are stored in plaintext in the database. If the database is compromised, attackers can generate valid TOTP codes for any user.
*   **Missing Rate Limiting (Fixed)**: A strict IP-based rate limiter is now explicitly applied to the `/auth/2fa/verify` endpoint.
*   **No Recovery Process**: If a user loses their authenticator app *and* their backup codes, there is no administrative flow or email-based recovery fallback to reset 2FA.

## 3. Check best practices
*   **TOTP Time Window (Pass)**: The verification accepts codes for the current, previous, and next 30-second windows. This is a best practice to account for clock drift.
*   **Backup Code Invalidation (Pass)**: Backup codes are removed atomically using `$pull` immediately after they are used, preventing replay attacks.
*   **Atomic Operations (Pass)**: The setup and disable flows use `findOneAndUpdate` to avoid race conditions and ensure dirty state isn't left behind.
*   **Secret Storage (Fail)**: TOTP secrets are extremely sensitive. Storing them in plaintext violates standard cryptographic best practices. They should be encrypted at rest.
*   **Rate Limiting / Account Lockout (Fixed)**: An account-level lockout mechanism freezes 2FA verification after 5 failed attempts. A strict rate limiter also throttles the endpoint.

## 4. Suggest improvements with code examples

### Improvement A: Account-Level Lockout (Brute-Force Protection)
Add a `failedAttempts` counter and a `lockedUntil` timestamp to the `TwoFactor` schema.
```javascript
// In TwoFactor.model.js
const twoFactorSchema = new mongoose.Schema({
  // ... existing fields
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null }
});

// In auth.service.js -> verify2FALogin
if (tf.lockedUntil && tf.lockedUntil > new Date()) {
  throw createServiceError('Account temporarily locked due to too many failed 2FA attempts', 429);
}

// On failed verification:
await TwoFactor.updateOne({ userId }, { 
  $inc: { failedAttempts: 1 },
  $set: { lockedUntil: (tf.failedAttempts >= 4) ? new Date(Date.now() + 15 * 60000) : null }
});
```

### Improvement B: Encrypt Secrets at Rest
Use Node's built-in `crypto` module to encrypt the TOTP secret before saving to the database, and decrypt it in memory during verification.
```javascript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.TWO_FA_ENCRYPTION_KEY; // Must be 32 bytes
const IV_LENGTH = 16;

function encryptSecret(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptSecret(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

### Improvement C: Apply Strict Rate Limiting
In `src/app.js` or `auth.routes.js`, apply a very strict, dedicated rate limiter to the verify endpoint.
```javascript
import rateLimit from 'express-rate-limit';

const strict2FALimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many 2FA attempts, please try again later'
});

router.post('/2fa/verify', strict2FALimiter, AUC.verify2FA);
```

## 5. Priority list (What to fix first vs later)

1.  ~~**CRITICAL (Do this today):** Implement Account-Level Lockout (Improvement A) to prevent brute-forcing of the 6-digit PIN.~~ *(Completed)*
2.  ~~**HIGH:** Apply a strict IP-based rate limiter specifically to `/auth/2fa/verify` (Improvement C) as defense-in-depth against distributed attacks.~~ *(Completed)*
3.  **MEDIUM:** Refactor the codebase to Encrypt TOTP Secrets at rest (Improvement B). This is vital for long-term security but requires careful data migration if users already have 2FA enabled.
4.  **LOW:** Implement a fallback recovery process (e.g., an Admin panel to reset 2FA, or an email-based reset flow with a 7-day delay for security).
