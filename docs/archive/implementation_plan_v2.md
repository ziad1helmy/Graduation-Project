# 🛠️ Implementation Plan v2 — Donor Gap Fixes

> Based on `missing_from_needs_of_donor.md` gap analysis.
> All tasks use additive changes only — no rewrites.

---

## 🔴 PHASE 1 — High Priority (Blocking Flutter)

---

### TASK 1 — Register `POST /appointments/verify-qr`

**Problem:** Flutter Hospital QR Scanner calls `/appointments/verify-qr` but it doesn't exist.  
**Fix:** Register the route + fix the existing `scanQr` handler.

**File 1:** `src/app.js`
```js
// Add after the /donations route
import appointmentVerifyRoutes from './routes/appointmentVerify.routes.js';
app.use('/appointments', limiter, appointmentVerifyRoutes);
```

**File 2 (NEW):** `src/routes/appointmentVerify.routes.js`
```js
import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import { verifyQr } from '../controllers/donation.controller.js';

const router = Router();
router.post('/verify-qr', authMiddleware, requireRole('hospital','admin','superadmin'), verifyQr);
export default router;
```

**File 3:** `src/controllers/donation.controller.js` — add `verifyQr` export (alias + fixes):
```js
export const verifyQr = async (req, res, next) => {
  // Same as scanQr but:
  // 1. Error messages match Flutter spec exactly
  // 2. Response shape is nested donation object
  const qrToken = req.body.qrToken || req.body.qrCode;
  if (!qrToken) return response.error(res, 400, 'qrToken is required');

  const appointment = await Appointment.findOne({ qrToken })
    .populate('donorId', 'bloodType suspensionStatus lastDonationDate')
    .populate('hospitalId', 'fullName hospitalName');

  if (!appointment) return response.error(res, 404, 'Invalid QR code');
  if (appointment.qrScannedAt) return response.error(res, 409, 'QR code already used');
  if (appointment.status === 'cancelled') return response.error(res, 400, 'Appointment is cancelled');
  if (!['pending', 'confirmed'].includes(appointment.status))
    return response.error(res, 400, 'Appointment is not active');

  // Check QR expiry if qrExpiresAt is set
  if (appointment.qrExpiresAt && new Date() > appointment.qrExpiresAt)
    return response.error(res, 400, 'QR code expired');

  const donor = appointment.donorId;
  const eligibility = await eligibilityService.canDonate(donor, { persistTravelDeferral: false });
  if (!eligibility.eligible) return response.error(res, 403, eligibility.reason || 'Donor not eligible');

  const donation = await Donation.create({
    donorId: donor._id,
    requestId: appointment.requestId || null,
    quantity: 1,
    status: 'completed',
    completedDate: new Date(),
  });

  appointment.status = 'completed';
  appointment.qrScannedAt = new Date();
  await appointment.save();

  await Donor.findByIdAndUpdate(donor._id, { lastDonationDate: new Date() });
  await rewardService.onDonationCompleted(donor._id, donation._id, false);

  activityService.logActivity(donor._id, {
    type: 'donation', action: 'qr_verified',
    title: 'Donation Verified', description: 'Hospital QR verified',
    referenceId: donation._id.toString(), referenceType: 'Donation',
  }).catch(() => {});

  const hospitalName = appointment.hospitalId?.hospitalName || appointment.hospitalId?.fullName || 'Hospital';
  const pointsEarned = appointment.donationType === 'Whole Blood' ? 100 : 120;

  return response.success(res, 200, 'Donation verified successfully', {
    donation: {
      donationId: donation._id,
      type: appointment.donationType || 'Whole Blood',
      date: appointment.qrScannedAt,
      location: hospitalName,
      status: 'confirmed',
    },
    pointsEarned,
  });
};
```

**File 4:** `src/models/Appointment.model.js` — add `qrExpiresAt`:
```js
qrExpiresAt: { type: Date, default: null },
```

Also in `appointment.service.js → bookAppointment`, set expiry on QR generation:
```js
appointment.qrExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
```

**Fix date-check bug** in existing `scanQr` (line 126-128):
```js
// REMOVE this block — it incorrectly rejects same-day appointments:
// if (appointment.appointmentDate && new Date(appointment.appointmentDate) <= new Date()) {
//   return response.error(res, 400, 'Appointment date has passed');
// }
```

---

### TASK 2 — `GET /rewards/dashboard`

**Problem:** Missing endpoint. Flutter Rewards screen loads all data in one call.

**File:** `src/routes/reward.routes.js` — add:
```js
router.get('/dashboard', requireRole('donor'), rc.getRewardsDashboard);
```

**File:** `src/controllers/reward.controller.js` — add:
```js
export const getRewardsDashboard = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const [pointsSummary, rewards, history, badges] = await Promise.all([
      rewardService.getPointsSummary(donorId),
      rewardService.getRewardsCatalog({}),
      rewardService.getPointsHistory(donorId, { page: 1, limit: 10 }),
      rewardService.getDonorBadges(donorId),
    ]);

    const nextRewardPoints = rewards.rewards.find(r => r.pointsCost > pointsSummary.pointsBalance)?.pointsCost || 0;

    response.success(res, 200, 'Rewards dashboard retrieved', {
      points: pointsSummary.pointsBalance,
      nextRewardPoints,
      pointsToNextReward: Math.max(0, nextRewardPoints - pointsSummary.pointsBalance),
      rewards: rewards.rewards.map(r => ({
        id: r._id, title: r.name,
        pointsRequired: r.pointsCost, isAvailable: r.status === 'ACTIVE',
      })),
      history: history.transactions.slice(0, 10).map(t => ({
        id: t._id, type: t.transactionType,
        title: t.description, points: t.pointsAmount, createdAt: t.createdAt,
      })),
      badges: {
        unlocked: badges.unlockedCount,
        total: badges.totalCount,
        completion: badges.completionPercentage,
        list: badges.badges.map(b => ({
          id: b.badgeId, title: b.badgeName,
          description: b.badgeDescription,
          isUnlocked: b.unlockStatus === 'UNLOCKED',
          progress: b.progressCurrent, target: b.progressTarget,
        })),
      },
    });
  } catch (err) { next(err); }
};
```

---

### TASK 3 — `GET /rewards/stats`

**File:** `src/routes/reward.routes.js` — add:
```js
router.get('/stats', requireRole('donor'), rc.getRewardsStats);
```

**File:** `src/controllers/reward.controller.js` — add:
```js
export const getRewardsStats = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const [pointsSummary, badges] = await Promise.all([
      rewardService.getPointsSummary(donorId),
      rewardService.getDonorBadges(donorId),
    ]);
    const catalog = await rewardService.getRewardsCatalog({});
    const nextReward = catalog.rewards.find(r => r.pointsCost > pointsSummary.pointsBalance);

    response.success(res, 200, 'Rewards stats retrieved', {
      points: pointsSummary.pointsBalance,
      nextReward: { pointsToGo: nextReward ? nextReward.pointsCost - pointsSummary.pointsBalance : 0 },
      badgesUnlocked: badges.unlockedCount,
      totalBadges: badges.totalCount,
      completionPercent: badges.completionPercentage,
    });
  } catch (err) { next(err); }
};
```

---

### TASK 4 — `GET /donor/stats`

**File:** `src/routes/donor.routes.js` — add:
```js
router.get('/stats', donorController.getDonorStats);
```

**File:** `src/controllers/donor.controller.js` — add:
```js
export const getDonorStats = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const [donationStats, pointsSummary] = await Promise.all([
      donationService.getDonorStats(donorId),
      rewardService.getPointsSummary(donorId),
    ]);
    response.success(res, 200, 'Donor stats retrieved', {
      totalDonations: donationStats?.totalDonations || 0,
      points: pointsSummary?.pointsBalance || 0,
      livesSaved: (donationStats?.totalDonations || 0) * 3,
    });
  } catch (err) { next(err); }
};
```

---

### TASK 5 — Fix `GET /donor/urgent-requests` response fields

**Problem:** Missing `title`, `distance`, `isEmergency`, `patientType`, `contactNumber`, `location`.

**File:** `src/controllers/donor.controller.js` — update `getUrgentRequests`:
```js
export const getUrgentRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, lat, lng } = req.query;
    const skip = (page - 1) * limit;
    const filter = { status: { $in: ['pending', 'in-progress'] }, urgency: { $in: ['high', 'critical'] } };

    const [requests, total] = await Promise.all([
      Request.find(filter)
        .populate('hospitalId', 'fullName hospitalName contactNumber lat long')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Request.countDocuments(filter),
    ]);

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const mapped = requests.map(r => {
      const hospital = r.hospitalId;
      const hLat = hospital?.lat;
      const hLng = hospital?.long;
      let distance = null;
      if (Number.isFinite(userLat) && Number.isFinite(userLng) && hLat && hLng) {
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(hLat - userLat), dLng = toRad(hLng - userLng);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(userLat))*Math.cos(toRad(hLat))*Math.sin(dLng/2)**2;
        distance = parseFloat((2 * 6371 * Math.asin(Math.sqrt(a))).toFixed(2));
      }
      return {
        id: r._id,
        title: `Urgent ${r.type === 'blood' ? 'Blood' : 'Organ'} Request — ${r.bloodType || r.organType || ''}`.trim(),
        bloodType: r.bloodType || null,
        unitsNeeded: r.quantity || 1,
        hospitalName: hospital?.hospitalName || hospital?.fullName || null,
        distance,
        isEmergency: r.urgency === 'critical',
        patientType: r.type || 'blood',
        contactNumber: hospital?.contactNumber || null,
        createdAt: r.createdAt,
        location: (hLat && hLng) ? { lat: hLat, lng: hLng } : null,
      };
    });

    return response.success(res, 200, 'Urgent requests retrieved', {
      requests: mapped,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) { next(err); }
};
```

---

### TASK 6 — Fix `GET /donor/profile` — add stats + badge progress

**File:** `src/controllers/donor.controller.js` — update `getProfile`:
```js
export const getProfile = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const [donor, donationStats, pointsSummary, badges] = await Promise.all([
      Donor.findById(donorId).select('-password'),
      donationService.getDonorStats(donorId),
      rewardService.getPointsSummary(donorId),
      rewardService.getDonorBadges(donorId),
    ]);
    if (!donor) return response.error(res, 404, 'Donor profile not found');

    // Compute age from dateOfBirth
    const age = donor.dateOfBirth
      ? Math.floor((Date.now() - new Date(donor.dateOfBirth)) / (365.25 * 24 * 3600 * 1000))
      : null;

    const unlocked = badges.badges.filter(b => b.unlockStatus === 'UNLOCKED');
    const locked = badges.badges.filter(b => b.unlockStatus !== 'UNLOCKED');
    const currentBadge = unlocked.at(-1)?.badgeName || null;
    const nextBadge = locked[0]?.badgeName || null;
    const progressPercentage = locked[0]
      ? Math.round((locked[0].progressCurrent / locked[0].progressTarget) * 100)
      : 100;

    response.success(res, 200, 'Donor profile retrieved successfully', {
      ...donor.toObject(),
      age,
      stats: {
        totalDonations: donationStats?.totalDonations || 0,
        points: pointsSummary?.pointsBalance || 0,
        livesSaved: (donationStats?.totalDonations || 0) * 3,
      },
      badgeProgress: { currentBadge, nextBadge, progressPercentage },
    });
  } catch (err) { next(err); }
};
```

---

### TASK 7 — Fix `long` → `lng` in all hospital responses

**File:** `src/controllers/discovery.controller.js` — update `mapHospital`:
```js
const mapHospital = (h, extras = {}) => ({
  hospitalId: h._id,
  hospital_id: h._id,
  name: h.hospitalName || h.fullName,
  fullName: h.fullName,
  phoneNumber: h.contactNumber || h.phone || null,  // renamed
  contactNumber: h.contactNumber || h.phone || null,
  email: h.email,
  address: h.address || null,
  location: h.lat && h.long ? { lat: h.lat, lng: h.long } : null,  // lng not long
  lat: h.lat || null,
  lng: h.long || null,   // expose as lng
  bloodTypes: h.bloodBanksAvailable || [],
  isAvailable: (h.bloodBanksAvailable || []).length > 0,
  urgentNeedsCount: extras.urgentNeedsCount ?? 0,
  ...extras,
});
```

Also update `getHospitalsForMap` return:
```js
hospitals: hospitals.map(h => ({
  id: h._id, name: h.hospitalName || h.fullName,
  lat: h.lat ?? null, lng: h.long ?? null,  // lng not long
})),
```

---

## 🟡 PHASE 2 — Medium Priority

---

### TASK 8 — Add `search` + `bloodType` filter to `GET /hospitals/nearby`

**File:** `src/controllers/discovery.controller.js` — update `getNearbyHospitals`:
```js
const { search, bloodType } = req.query;
// After building `query` object, add:
if (search) {
  query.$or = [
    { fullName: { $regex: search, $options: 'i' } },
    { hospitalName: { $regex: search, $options: 'i' } },
  ];
}
if (bloodType) query.bloodBanksAvailable = bloodType;
```

Also add pagination — replace `.limit(500)` with:
```js
const { skip, limit, page } = parsePagination(req.query, 20);
const hospitals = await Hospital.find(query).skip(skip).limit(limit);
// Change response to include pagination meta
```

---

### TASK 9 — Add `hospitalType` + `workingHours` to Hospital model and responses

**File:** `src/models/Hospital.model.js` — add fields:
```js
hospitalType: { type: String, default: 'General Hospital', trim: true },
workingHours: { type: String, default: '9AM - 5PM', trim: true },
```

**File:** `src/controllers/discovery.controller.js` — add to `mapHospital`:
```js
hospitalType: h.hospitalType || h.type || 'General Hospital',
workingHours: h.workingHours || '9AM - 5PM',
```

---

### TASK 10 — Fix `POST /donations/validate` response field name

**File:** `src/controllers/donation.controller.js` — `validateDonationEligibility` already returns `canDonate`. ✅ Already correct — **no change needed.**

---

### TASK 11 — Fix activity `description` → `subTitle` + add `points` field

**File:** `src/controllers/activity.controller.js` — in `getTimeline`, map output:
```js
activities: activities.map(a => ({
  id: a._id,
  type: a.type,
  title: a.title,
  subTitle: a.description,   // rename for Flutter
  points: a.metadata?.pointsAmount || 0,
  createdAt: a.createdAt,
})),
```

---

### TASK 12 — Add `GET /donor/rewards`

**File:** `src/routes/donor.routes.js` — add:
```js
router.get('/rewards', donorController.getDonorRewards);
```

**File:** `src/controllers/donor.controller.js` — add:
```js
export const getDonorRewards = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const [pointsSummary, badges] = await Promise.all([
      rewardService.getPointsSummary(donorId),
      rewardService.getDonorBadges(donorId),
    ]);
    const earned = badges.badges.filter(b => b.unlockStatus === 'UNLOCKED');
    const locked = badges.badges.filter(b => b.unlockStatus !== 'UNLOCKED');
    response.success(res, 200, 'Donor rewards retrieved', {
      currentPoints: pointsSummary.pointsBalance,
      earnedBadges: earned.map(b => ({ id: b.badgeId, title: b.badgeName, description: b.badgeDescription })),
      lockedBadges: locked.map(b => ({ id: b.badgeId, title: b.badgeName, progress: b.progressCurrent, target: b.progressTarget })),
      nextMilestone: pointsSummary.pointsToNextTier,
    });
  } catch (err) { next(err); }
};
```

---

### TASK 13 — Decrement `unitsNeeded` on urgent request accept + auto-close

**File:** `src/controllers/donor.controller.js` — in `respondToRequest`, after creating donation:
```js
// Decrement quantity and auto-close if 0
const updatedRequest = await Request.findByIdAndUpdate(
  requestId,
  { $inc: { quantity: -1 } },
  { new: true }
);
if (updatedRequest && updatedRequest.quantity <= 0) {
  await Request.findByIdAndUpdate(requestId, { status: 'completed' });
}
```

---

### TASK 14 — Add root `GET /badges` alias

**File:** `src/app.js` — add:
```js
// Alias /badges -> /rewards/badges
app.get('/badges', authMiddleware, requireRole('donor'), rc.getBadges);
```
OR in `src/routes/reward.routes.js` (simpler — already mounted at `/rewards`):
Register in a new public-ish route or alias in `donor.routes.js` which already has `/badges`.

---

### TASK 15 — Add `weight` field to Donor model and profile update

**File:** `src/models/Donor.model.js` — add:
```js
weight: { type: Number, default: null, min: 0 },
```

**File:** `src/controllers/donor.controller.js` — `updateProfile`:
```js
if (req.body.weight !== undefined) updateData.weight = req.body.weight;
if (req.body.age !== undefined) {
  // store as computed dob offset or just store weight; age is derived from dateOfBirth
  // Skip age write — it's computed on read. Log a warning if provided.
}
// Make bloodType read-only — remove bloodType from updateData
```

---

## 🟢 PHASE 3 — Low Priority

---

### TASK 16 — Add `pointsEarned` to donation history

**File:** `src/controllers/donor.controller.js` — `getDonationHistory`:

After fetching donations, join PointsTransaction for each donation:
```js
// Use aggregation instead of simple find:
const donationsWithPoints = await Donation.aggregate([
  { $match: filter },
  { $sort: { createdAt: -1 } },
  { $skip: skip }, { $limit: limit },
  { $lookup: {
    from: 'pointstransactions',
    let: { donId: { $toString: '$_id' } },
    pipeline: [
      { $match: { $expr: { $and: [
        { $eq: ['$referenceId', { $concat: ['donation_', '$$donId'] }] },
        { $eq: ['$transactionType', 'BLOOD_DONATION'] },
      ]}}},
      { $project: { pointsAmount: 1 } },
    ],
    as: 'pointsTx',
  }},
  { $addFields: { pointsEarned: { $ifNull: [{ $arrayElemAt: ['$pointsTx.pointsAmount', 0] }, 0] } }},
  { $project: { pointsTx: 0 } },
]);
```

---

### TASK 17 — Add `rejected` status to Donation model

**File:** `src/models/Donation.model.js` — find `enum` for status and add `'rejected'`:
```js
enum: ['pending', 'scheduled', 'completed', 'cancelled', 'rejected'],
```

---

## 📋 Summary Table

| # | Task | Files | Priority |
|---|------|-------|----------|
| 1 | Register `POST /appointments/verify-qr` + fix QR handler | `app.js`, new route file, `donation.controller.js`, `Appointment.model.js` | 🔴 |
| 2 | `GET /rewards/dashboard` | `reward.routes.js`, `reward.controller.js` | 🔴 |
| 3 | `GET /rewards/stats` | `reward.routes.js`, `reward.controller.js` | 🔴 |
| 4 | `GET /donor/stats` | `donor.routes.js`, `donor.controller.js` | 🔴 |
| 5 | Fix urgent requests response fields | `donor.controller.js` | 🔴 |
| 6 | Enrich `GET /donor/profile` with stats + badge progress | `donor.controller.js` | 🔴 |
| 7 | Fix `long` → `lng` in all hospital responses | `discovery.controller.js` | 🔴 |
| 8 | Add `search` + `bloodType` to nearby hospitals | `discovery.controller.js` | 🟡 |
| 9 | Add `hospitalType` + `workingHours` | `Hospital.model.js`, `discovery.controller.js` | 🟡 |
| 10 | Fix activity `description` → `subTitle` + add `points` | `activity.controller.js` | 🟡 |
| 11 | `GET /donor/rewards` | `donor.routes.js`, `donor.controller.js` | 🟡 |
| 12 | Decrement `unitsNeeded` on accept + auto-close | `donor.controller.js` | 🟡 |
| 13 | Add root `/badges` alias | `app.js` or `donor.routes.js` | 🟡 |
| 14 | Add `weight` to Donor model + profile update | `Donor.model.js`, `donor.controller.js` | 🟡 |
| 15 | `pointsEarned` in donation history | `donor.controller.js` | 🟢 |
| 16 | Add `rejected` status to Donation model | `Donation.model.js` | 🟢 |

---

## 🔗 File Ownership (No Conflicts)

| File | Tasks |
|------|-------|
| `src/controllers/donor.controller.js` | 4, 5, 6, 11, 12, 14, 15 |
| `src/controllers/reward.controller.js` | 2, 3 |
| `src/controllers/discovery.controller.js` | 7, 8, 9 |
| `src/controllers/activity.controller.js` | 10 |
| `src/controllers/donation.controller.js` | 1 |
| `src/routes/donor.routes.js` | 4, 11, 13, 14 |
| `src/routes/reward.routes.js` | 2, 3 |
| `src/models/Appointment.model.js` | 1 |
| `src/models/Hospital.model.js` | 9 |
| `src/models/Donor.model.js` | 14 |
| `src/models/Donation.model.js` | 16 |
| `src/app.js` | 1 |
| `src/routes/appointmentVerify.routes.js` *(new)* | 1 |
