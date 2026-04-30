# LifeLink Backend — Final Action Plan

> **Status:** Feature-frozen, test-verified, demo-ready
> **Date:** 2026-04-30
> **Remaining work:** Deployment, communication, and presentation preparation — not engineering

---

## Priority Order

### 1. Fix the Three Document Errors
**Time estimate: 15 minutes**

Before anything else, correct `docs/PROJECT_REVIEW.md` while the details are fresh:

- Fix hospital routes integration test count: **35 → 23**
- Verify the matching score formula directly from `src/services/matching.service.js` and correct the description
- Remove the invented `/maps/directions` gap from the "What Is Not Tested" section

> Examiners may read this document. Wrong numbers undermine credibility.

---

### 2. Deploy to Railway
**Time estimate: 1–2 hours**

The backend is feature-frozen and test-verified. It needs to be live before Flutter integration can proceed. Without a deployed URL the Flutter team is blocked.

**Steps in order:**

```
1. Add engines field to package.json
2. Verify server.js uses process.env.PORT
3. Create Railway account → connect GitHub repo
4. Paste all .env variables into Railway dashboard
5. Deploy → verify /health endpoint responds
6. Verify /api-docs loads with full Swagger UI
7. Share the public URL with the Flutter team
```

**`package.json` addition:**
```json
"engines": {
  "node": ">=18.0.0"
}
```

> The Flutter team cannot make real progress against localhost. This is the highest-impact action remaining.

---

### 3. Run the Seed Script Against the Deployed Instance
**Time estimate: 20 minutes**

Once deployed, run against the production Atlas cluster:

```bash
npm run seed
```

This creates the following pre-verified test accounts for the Flutter team:

| Role | Email | Password |
|------|-------|----------|
| Donor | `donor@test.com` | `SecurePass@123` |
| Hospital | `hospital@test.com` | `SecurePass@123` |

> Without seeded data the Flutter team will waste time debugging login before they even reach real integration work.

---

### 4. Send the Flutter Team an Integration Handoff
**Time estimate: 30 minutes**

Write a short document or message containing exactly:

- The deployed base URL
- The two test account credentials
- The Swagger UI URL (`/api-docs`)
- The token format: `Authorization: Bearer <accessToken>`
- What to do when the access token expires: call `POST /api/v1/auth/refresh` with the `refreshToken`

**Five most important endpoints to hit first:**

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | POST | `/api/v1/auth/login` | Get access + refresh tokens |
| 2 | GET | `/api/v1/auth/me` | Verify token, get user profile |
| 3 | GET | `/api/v1/donor/requests` | List available blood requests |
| 4 | POST | `/api/v1/donor/respond/:requestId` | Donor responds to a request |
| 5 | GET | `/api/v1/rewards/points` | Get donor points summary |

---

### 5. Fix the Appointment Notification Bug Properly
**Time estimate: 30 minutes**

The current fix changed `type` to `'system'` — this works but gives the Flutter team no way to filter appointment-specific notifications in their UI.

**The correct fix — add `'appointment'` to the Notification model enum:**

```js
// src/models/Notification.model.js
type: {
  type: String,
  enum: ['match', 'request', 'milestone', 'emergency', 'system', 'admin', 'appointment'],
}

relatedType: {
  type: String,
  enum: ['Request', 'Donation', 'User', 'Achievement', 'Appointment'],
}
```

Then revert `src/services/appointment.service.js` back to:
```js
type: 'appointment',
relatedType: 'Appointment',
```

After this change run:
```bash
npm test
```

Confirm **242 tests still pass** before committing.

---

### 6. Prepare the Demo Script
**Time estimate: 1 hour**

Prepare and rehearse the exact sequence of actions for the graduation presentation. Use the Postman collection with a demo environment pointed at the deployed URL.

**Rehearse this exact flow (under 3 minutes):**

```
1. Login as hospital         → copy access token
2. Create a blood request    → copy requestId
3. Login as donor            → copy access token
4. Respond to the request    → show 201 response
5. Login as hospital         → complete the donation
6. Show donor points         → GET /api/v1/rewards/points
7. Show leaderboard          → GET /api/v1/rewards/leaderboard
```

This demonstrates the entire core value proposition end-to-end.

> Alternative: Use the live `/api-docs` Swagger UI directly in the browser. Less impressive than Postman but requires zero setup.

---

### 7. Prepare Examiner Q&A
**Time estimate: 1 hour**

Prepare a confident spoken answer for each likely question:

| Question | Key Points to Cover |
|----------|---------------------|
| Why MongoDB over a relational DB? | Flexible donor/hospital schemas, discriminator pattern, no rigid joins needed for geo queries |
| How does matching work? | Haversine formula, blood type compatibility matrix, location scoring, urgency weighting |
| How do you prevent duplicate points? | `PointsTransaction` partial unique index on `donorId + referenceId`, idempotency check before award |
| How does 2FA work? | TOTP via authenticator app, hashed backup codes, separate `TwoFactor` model |
| What happens if the server crashes mid-donation? | Mongoose transactions with `withTransaction()` — either all reward operations complete or none do |
| Why 242 tests? | Unit for pure logic, integration for HTTP contracts and role enforcement, E2E for full lifecycle |
| What would you do differently? | Native 2dsphere indexes instead of Haversine in memory, Redis queue for FCM instead of fire-and-forget |

---

## What You Should NOT Do Now

| Action | Why Not |
|--------|---------|
| Add new features | Project is feature-frozen. New code introduces new bugs with no time to test |
| Refactor existing services | Risk breaking passing tests with no benefit |
| Migrate to 2dsphere indexes | High-risk change, requires data migration, Haversine works fine at this scale |
| Add more tests | 242 is already exceptional. Diminishing returns |
| Change the database schema | Flutter team may already be building against current field names |

---

## Summary Timeline

| When | Action |
|------|--------|
| **Today** | Fix 3 doc errors → Deploy to Railway → Seed the DB |
| **Tomorrow** | Flutter handoff document → Fix notification enum properly |
| **This week** | Demo script rehearsal → Examiner Q&A preparation |

---

> The backend is done. The remaining work is deployment, communication, and presentation preparation — not engineering.
