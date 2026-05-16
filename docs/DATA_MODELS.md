# LifeLink Data Models Reference

> Covers all 25 Mongoose models. Last audited: May 2026.

---

## Discriminator Hierarchy

```
users collection
├── User (base schema)        — fields shared by all roles
├── Donor (__t: 'donor')      — donor-specific fields
└── Hospital (__t: 'hospital') — hospital-specific fields
```

Admin and superadmin accounts are stored as `User` documents with `role: 'admin'` or `role: 'superadmin'` — they have no discriminator sub-schema.

---

## User (Base Schema)

**Collection**: `users`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `fullName` | String | Yes | 2–100 chars |
| `fullNameNormalized` | String | No | Lowercase Arabic-normalized, auto-set |
| `email` | String | Yes | Unique, lowercase, trimmed |
| `password` | String | Yes | bcrypt hash, `select: false` |
| `role` | String | Yes | `donor`, `hospital`, `admin`, `superadmin` |
| `isEmailVerified` | Boolean | — | Default: `false` |
| `emailVerifiedAt` | Date | — | |
| `emailVerificationOtp` | String | — | Hashed OTP, `select: false` |
| `emailVerificationOtpExpires` | Date | — | |
| `isSuspended` | Boolean | — | Default: `false` |
| `suspendedAt` | Date | — | |
| `suspendedReason` | String | — | |
| `deletedAt` | Date | — | Soft delete timestamp |
| `resetPasswordToken` | String | — | Hashed, `select: false` |
| `resetPasswordExpires` | Date | — | |
| `passwordChangedAt` | Date | — | Used for refresh token invalidation |
| `fcmTokens` | [String] | — | Firebase device tokens, max 10 |
| `location` | Object | — | `{ coordinates: { lat, lng }, city, state, country }` |
| `adminKey` | String | — | Admin-only: third login factor |
| `createdAt` | Date | — | Auto |
| `updatedAt` | Date | — | Auto |

**Indexes**: email (unique), role, fullNameNormalized

**Hooks**:
- `pre('save')`: bcrypt password hashing (10 rounds), Arabic name normalization

---

## Donor (Discriminator)

**Collection**: `users` (`__t: 'donor'`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `phoneNumber` | String | Yes | 11 digits |
| `dateOfBirth` | Date | Yes | Used for eligibility age check |
| `bloodType` | String | Yes | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| `gender` | String | No | `male`, `female`, `other` |
| `weight` | Number | No | kg |
| `isAvailable` | Boolean | — | Default: `true` |
| `lastDonationDate` | Date | — | Updated on donation completion |
| `temporaryDeferralUntil` | Date | — | Admin-set or travel-auto-set |
| `lastDeferralReason` | String | — | |
| `hemoglobinLevel` | Number | — | g/dL — checked in eligibility |
| `travelHistory` | [Object] | — | `[{ country, returnDate }]` |
| `suspensionStatus` | String | — | `active`, `suspended` (legacy field) |
| `pointsBalance` | Number | — | Default: 0 |
| `currentTier` | String | — | `Bronze`, `Silver`, `Gold`, `Platinum` |
| `badges` | [Object] | — | Array of unlocked badge records |
| `healthHistory` | Object | — | `{ chronicConditions, medications, allergies, recentIllness, notes, lastCheckupDate, updatedAt }` |
| `settings` | Object | — | `{ pushNotifications, emergencyAlerts, privacyMode, language }` |

⚠️ **Known issue**: `weight` field defined twice in schema (duplicate definition).

---

## Hospital (Discriminator)

**Collection**: `users` (`__t: 'hospital'`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | String | Yes | 3–200 chars |
| `hospitalId` | String | Yes | Unique business ID |
| `hospitalType` | String | — | Default: `General Hospital` |
| `workingHours` | String | — | Display string |
| `workingHoursStart` | Number | — | Hour 0–23, default 9 |
| `workingHoursEnd` | Number | — | Hour 0–23, default 17 |
| `slotsPerHour` | Number | — | Default: 5 |
| `phone` | String | — | |
| `address` | Mixed | — | |
| `city` | String | — | |
| `state` | String | — | |
| `zipCode` | String | — | |
| `lat` | Number | — | Latitude (-90 to 90) |
| `long` | Number | — | Longitude (-180 to 180) |
| `adminContactName` | String | — | |
| `adminContactPhone` | String | — | |
| `emergencyContact` | String | — | |
| `bloodBanksAvailable` | [String] | — | Supported blood types |
| `capacity` | Number | — | |
| `hospitalName` | String | — | Legacy alias for `name` (backward compat) |
| `hospitalNameNormalized` | String | — | Lowercase normalized, indexed |
| `contactNumber` | String | — | Legacy alias for `phone` |

**Hooks**: `pre('save')` syncs `name ↔ hospitalName`, `phone ↔ contactNumber`, normalizes Arabic name

**Note**: `strict: 'throw'` — unknown fields raise hard errors

---

## Request

**Collection**: `requests`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `hospitalId` | ObjectId (ref: User) | Yes | |
| `type` | String | Yes | `blood`, `organ` |
| `bloodType` | String | No | Required if type=blood |
| `organType` | String | No | Required if type=organ |
| `urgency` | String | Yes | `low`, `medium`, `high`, `critical` |
| `quantity` | Number | Yes | Units needed (decrements as donors respond) |
| `status` | String | — | `pending`, `in-progress`, `completed`, `cancelled`, `fulfilled` |
| `description` | String | No | |
| `notes` | String | No | |
| `location` | Object | No | Geo-location for display |
| `acceptedDonorId` | ObjectId | No | Bound donor for direct accept flow |
| `qrToken` | String | No | QR verification token |
| `qrExpires` | Date | No | |
| `fulfilledAt` | Date | No | |
| `cancelledAt` | Date | No | |
| `cancelReason` | String | No | |
| `createdAt` | Date | — | Auto |

**Indexes**: status, urgency, bloodType, hospitalId, status+urgency, hospitalId+status

---

## Donation

**Collection**: `donations`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `donorId` | ObjectId (ref: User) | Yes | |
| `requestId` | ObjectId (ref: Request) | No | |
| `status` | String | — | `pending`, `scheduled`, `completed`, `cancelled`, `rejected` |
| `quantity` | Number | Yes | Min 1 |
| `scheduledDate` | Date | No | Must be in future |
| `completedDate` | Date | No | Must be in past |
| `notes` | String | No | Max 1000 chars |
| `qrToken` | String | No | Indexed |
| `qrExpires` | Date | No | |

**Indexes**: donorId, requestId, status, donorId+status, requestId+status

---

## Appointment

**Collection**: `appointments`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `donorId` | ObjectId (ref: User) | Yes | |
| `hospitalId` | ObjectId (ref: User) | Yes | |
| `requestId` | ObjectId (ref: Request) | No | |
| `appointmentDate` | Date | Yes | Must be in future |
| `status` | String | — | `pending`, `confirmed`, `completed`, `cancelled` |
| `notes` | String | No | Max 500 chars |
| `cancelledAt` | Date | No | |
| `donationType` | String | — | `Whole Blood`, `Platelets`, `Plasma` |
| `qrToken` | String | No | Unique, sparse indexed |
| `qrScannedAt` | Date | No | |
| `qrExpiresAt` | Date | No | |

---

## Notification

**Collection**: `notifications`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | Recipient |
| `type` | String | `match`, `emergency`, `appointment`, `reward`, `system` |
| `title` | String | |
| `body` | String | |
| `data` | Mixed | Arbitrary JSON payload |
| `isRead` | Boolean | Default: false |
| `readAt` | Date | |
| `createdAt` | Date | Auto |

**Indexes**: userId+isRead, createdAt

---

## PointsTransaction

**Collection**: `pointstransactions`

| Field | Type | Notes |
|-------|------|-------|
| `donorId` | ObjectId | |
| `transactionType` | String | `BLOOD_DONATION`, `REDEMPTION`, `TIER_BONUS`, `BADGE_BONUS`, `CAMPAIGN_BONUS` |
| `pointsAmount` | Number | Positive (earn) or negative (redeem) |
| `referenceId` | String | e.g., `"donation_<id>"` |
| `description` | String | |
| `metadata` | Object | |
| `createdAt` | Date | Auto |

**Indexes**: donorId, referenceId

---

## TwoFactor

**Collection**: `twofactors`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | Ref to User, unique |
| `enabled` | Boolean | Default: false |
| `secret` | String | Active TOTP secret |
| `backupCodes` | [String] | One-time use backup codes |
| `pendingSecret` | String | Pre-confirm secret |
| `pendingBackupCodes` | [String] | Pre-confirm backup codes |
| `verifiedAt` | Date | When 2FA was confirmed |
| `disabledAt` | Date | |

---

## OneTimeOtp

**Collection**: `onetimeotps`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | |
| `email` | String | |
| `purpose` | String | `password_reset` |
| `otpHash` | String | SHA-256 hash of OTP |
| `expiresAt` | Date | 10-minute TTL |
| `attempts` | Number | Max 5 |
| `verifiedAt` | Date | |
| `resetTokenUsedAt` | Date | |
| `lastSentAt` | Date | |

**Indexes**: email+purpose+expiresAt

---

## RefreshTokenBlacklist

**Collection**: `refreshtokenblacklists`

| Field | Type | Notes |
|-------|------|-------|
| `tokenHash` | String | SHA-256 hash of raw token, unique |
| `userId` | String | |
| `expiresAt` | Date | TTL index — auto-removed by MongoDB |

---

## AuditLog

**Collection**: `auditlogs`

| Field | Type | Notes |
|-------|------|-------|
| `adminId` | ObjectId | Admin who performed action |
| `action` | String | e.g., `user.verify`, `user.suspend` |
| `targetType` | String | e.g., `User`, `Request` |
| `targetId` | ObjectId | |
| `createdAt` | Date | Auto |

---

## SystemSettings

**Collection**: `systemsettings`

| Field | Type | Notes |
|-------|------|-------|
| `key` | String | Unique key (e.g., `maintenance_mode`) |
| `value` | Mixed | Boolean, String, Number |
| `updatedBy` | ObjectId | Admin who last changed it |
| `updatedAt` | Date | Auto |

Seeded on startup: `maintenance_mode: false`, `maintenance_message: ''`

---

## RewardsConfig

**Collection**: `rewardsconfigs`

| Field | Type | Notes |
|-------|------|-------|
| `key` | String | Config key (unique) |
| `value` | Mixed | Configurable value |
| `description` | String | |
| `updatedBy` | ObjectId | |
| `updatedAt` | Date | |

Seeded on startup with default point values, tier thresholds, redemption limits.

---

## Campaign

**Collection**: `campaigns`

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | Required |
| `description` | String | |
| `multiplier` | Number | Points multiplier (e.g., 2.0) |
| `startDate` | Date | Required |
| `endDate` | Date | Required |
| `isActive` | Boolean | Default: true |
| `targetBloodTypes` | [String] | Optional: filter by blood type |
| `createdBy` | ObjectId | Admin |

---

## Activity

**Collection**: `activities`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | Donor ID |
| `type` | String | `donation`, `profile_update`, `emergency_response`, etc. |
| `action` | String | Specific action name |
| `title` | String | Display title |
| `description` | String | Human-readable description |
| `referenceId` | String | Related document ID |
| `referenceType` | String | Related document type |
| `metadata` | Object | Arbitrary additional data |
| `createdAt` | Date | Auto |

---

## Other Models (Schema summaries)

| Model | Collection | Key Fields |
|-------|-----------|-----------|
| Badge | badges | name, description, requirement (donations needed), bonusPoints |
| RolePermission | rolepermissions | role, displayName, isSystemRole, permissions (nested object) |
| HospitalSettings | hospitalsettings | hospitalId, workingHoursStart, workingHoursEnd, slotsPerHour |
| HelpDocument | helpdocuments | title, content, category, isPublished |
| SupportMessage | supportmessages | userId, subject, body, status (open/resolved) |
| WaitlistEntry | waitlistentries | donorId, hospitalId, requestId, status |
