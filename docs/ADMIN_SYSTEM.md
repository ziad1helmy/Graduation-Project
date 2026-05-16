# LifeLink Admin System

---

## Overview

The LifeLink admin system provides a full management panel for platform administrators. Admins manage users, hospitals, requests, rewards configuration, and system settings. All admin operations are logged to the audit trail.

---

## Role Hierarchy

```
superadmin
    └── Full access: can create/delete admins, manage role permissions
admin
    └── Operational access: user management, request management, analytics
```

Both roles are stored in the `users` collection (no discriminator sub-schema — just `role: 'admin'` or `role: 'superadmin'`).

---

## Admin Authentication

Admin login requires **three factors**:

```
POST /admin/login
{
  "email": "admin@lifelink.com",
  "password": "SecurePassword",
  "adminKey": "abc123def456..."
}
```

- `adminKey` is a 32-char random hex string generated at admin account creation
- It is returned **once** on creation and stored as plaintext on the User document
- Admin login also supports 2FA (same TOTP flow as donors)

See [AUTH_FLOW.md](AUTH_FLOW.md) for full login flow details.

---

## Admin Creation

Only **superadmins** can create admin accounts:

```
POST /admin/admins (superadmin only)
{
  "fullName": "Admin User",
  "email": "admin@example.com",
  "password": "SecurePass123!",
  "role": "admin"    // or "superadmin"
}
```

Response includes the generated `adminKey` (store it — not recoverable):
```json
{
  "data": {
    "admin": { ... },
    "adminKey": "a1b2c3d4e5f6..."
  }
}
```

Admin accounts are created with `isEmailVerified: true` by default (no email verification required).

---

## User Management Capabilities

### All Users
- List with filters: role, verified status, suspended status, text search
- Get user details (with role-specific stats — donation count for donors, request count for hospitals)
- Manual email verification / unverification
- Suspend / unsuspend
- Soft delete (sets `deletedAt`, blocks all access)

### Donors
- All of the above
- Update donor fields: name, email, blood type, location, hemoglobin, deferral dates
- Ban (suspend alias with audit log `user.ban_donor`)
- Unban

### Hospitals
- Create hospital accounts (admin-created, pre-verified)
- Suspend / unsuspend with reason

### Admin Accounts (Superadmin Only)
- Create, update, delete admin accounts
- Cannot delete own account
- Cannot modify system roles (`admin`, `superadmin`) via role permissions API

---

## Request Management

Admins have read + write access to all blood/organ requests across all hospitals:

- List all requests with filters (status, urgency, blood type, hospital, type)
- Get request statistics (counts by status, urgency, blood type)
- Get request details with populated hospital and matched donors
- Get donations for a specific request
- Fulfill a request (override status to `fulfilled`)
- Cancel a request (with required reason)
- **Broadcast a request**: manually triggers the matching engine to find compatible donors and send FCM + in-app notifications

---

## Emergency Operations

| Endpoint | Description |
|----------|-------------|
| `POST /admin/emergency/broadcast` | Send emergency alert to all compatible donors for a blood type |
| `GET /admin/emergency/critical` | List all critical-urgency active requests |
| `GET /admin/emergency/shortage-alerts` | List blood types with no available donors |

**Emergency broadcast body:**
```json
{
  "bloodType": "O-",
  "message": "Critical shortage — please donate urgently",
  "urgency": "critical"
}
```

The broadcast sends FCM push notifications + creates in-app notifications for all donors with compatible blood types who have `emergencyAlerts: true` in their settings.

---

## System Management

### Maintenance Mode

Toggle maintenance mode to block all non-admin API access:

```
POST /admin/system/maintenance
{
  "enabled": true,
  "message": "System is under maintenance. Please check back in 2 hours."
}
```

When enabled, all non-admin requests return `503 Service Unavailable` with the maintenance message.

The maintenance state is:
1. Stored in `SystemSettings` collection (key: `maintenance_mode`)
2. Cached in application memory for performance
3. Cache is immediately invalidated when the setting changes (no stale state)
4. Admin users bypass maintenance mode via role check

### System Health

```
GET /admin/system/health
```

Returns:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "database": "connected",
  "memory": {
    "used": "145 MB",
    "total": "512 MB"
  },
  "timestamp": "2026-05-16T08:00:00.000Z"
}
```

---

## Analytics

Admin analytics are powered by `analytics.service.js`:

| Endpoint | Data |
|----------|------|
| `GET /admin/analytics/dashboard` | Users, requests, donations summary + critical alerts |
| `GET /admin/analytics/donations?months=6` | Monthly donation trends (total, completed, success rate, units) |
| `GET /admin/analytics/blood-types` | Donor supply vs active request demand by blood type |
| `GET /admin/analytics/top-donors?limit=10` | Top donors by completed donation count |
| `GET /admin/analytics/growth?months=6` | User, request, and donation growth by month |

Also available:
- `GET /admin/blood-inventory-summary` — aggregated blood bank status
- `GET /admin/alerts` — combined view of critical requests + shortage alerts

---

## Rewards Configuration

Admins can update all reward system parameters without code changes:

```
GET  /admin/rewards/config     → Current config
PUT  /admin/rewards/config     → Update config
```

Configurable values (validated by `validateRewardsConfigBody`):
- Points per donation type (blood, plasma, platelets, organ)
- Emergency bonus multiplier
- Tier thresholds (Silver, Gold, Platinum)
- Tier bonus points
- Redemption daily/monthly limits

---

## Audit Logging

Every admin operation creates an `AuditLog` document:

```javascript
{
  adminId: ObjectId,   // Who performed the action
  action: String,      // e.g., "user.verify", "user.suspend", "system.maintenance"
  targetType: String,  // e.g., "User", "Request", "RolePermission"
  targetId: ObjectId,  // ID of affected entity
  createdAt: Date
}
```

Audit logs are queryable:
```
GET /admin/audit-logs?action=user.suspend&adminId=<id>&page=1&limit=20
```

Logged actions:
| Action | Trigger |
|--------|---------|
| `user.verify` | Email verification |
| `user.unverify` | Email unverification |
| `user.suspend` | Suspend user |
| `user.unsuspend` | Unsuspend user |
| `user.delete` | Soft delete user |
| `user.ban_donor` | Ban donor |
| `user.unban_donor` | Unban donor |
| `user.update_donor` | Update donor fields |
| `user.create_admin` | Create admin account |
| `user.update_admin` | Update admin |
| `user.delete_admin` | Delete admin |
| `user.suspend_hospital` | Suspend hospital |
| `user.unsuspend_hospital` | Unsuspend hospital |
| `system.maintenance` | Toggle maintenance mode |
| `permissions.create_role` | Create role permission |
| `permissions.update_role` | Update role permissions |
| `permissions.delete_role` | Delete role |

---

## Role Permission System

The role permission system allows superadmins to define capability matrices for custom roles. **System roles** (`admin`, `superadmin`, `donor`, `hospital`) cannot be modified or deleted.

**Permission structure:**
```javascript
{
  role: "custom_moderator",
  displayName: "Moderator",
  description: "...",
  isSystemRole: false,
  permissions: {
    donor_management: { view: true, manage: false, ban: false },
    hospital_management: { view: true, manage: false, suspend: false },
    admin_management: { view: false, create: false, delete: false },
    system_settings: { view: false, manage: false },
    audit_logging: { view: true, export: false },
    reporting: { view: true, export: false },
  }
}
```

> ⚠️ **Note**: The role permissions stored in MongoDB are informational/RBAC reference data. The actual access control in the API is enforced by the `requireRole('admin', 'superadmin')` middleware, not by dynamic permission lookups from the database.
