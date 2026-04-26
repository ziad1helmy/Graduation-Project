# API Status Inventory

This document defines the exact execution/verification state of the LifeLink backend endpoints.

## Classification Definitions
- **Runtime Verified**: Fully complete, runtime tested via automated E2E flows or manual smoke scripts, and functionally stable.
- **Implemented**: Logic exists in controllers and services, routes are mounted, but not exhaustively verified through automated runtime tests.
- **Partial/Scaffolded**: Route placeholders exist with minimal or incomplete service logic.

## Status by Route Family

### Authentication (`/auth`, `/api/v1/auth`)
**Status**: **Runtime Verified**
- Signup, Login, Token Refresh, Logout
- Email Verification (POST)
- Password Reset (OTP flow)
- 2FA Setup and Verification
- FCM Token Registration Lifecycle (`POST`, `PUT`, `DELETE` /auth/fcm-token)

### Donor (`/donor`, `/api/v1/donor`)
**Status**: **Implemented**
- Profile management
- Request browsing and matching
- Donation history and availability

### Hospital (`/hospital`, `/api/v1/hospital`)
**Status**: **Implemented**
- Profile management
- Request lifecycle (create, update, delete)
- Donation tracking
- Staff endpoints

### Admin (`/admin`, `/api/v1/admin`)
**Status**: **Implemented**
- User management (suspend, delete, verify)
- System maintenance
- Analytics and reporting
- Emergency broadcasts

### Notifications (`/notifications`)
**Status**: **Implemented**
- FCM payload construction
- In-app notification history

### Rewards (`/rewards`)
**Status**: **Implemented**
- Point balances
- Badges and gamification

### Utility (`/hospitals`, `/help`, `/support`)
**Status**: **Partial/Scaffolded**
- Hospital discovery
- Static support references
