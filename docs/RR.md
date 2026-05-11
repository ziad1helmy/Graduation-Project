Summary
I audited the backend reward/achievement implementation and traced code paths, models, services, controllers and routes. Below is a concise, evidence-backed report plus gaps and precise next steps.

1. Reward Points System — Status

User points storage: ✅ Fully Implemented

Files: DonorPoints.model.js
Model: DonorPoints — fields: donorId, pointsBalance, lifetimePointsEarned, tier, profileCompletionAwarded, firstDonationAwarded.
Used by: reward.service.js (getOrCreateAccount, awardPoints, getPointsSummary).
API: GET /rewards/points (reward.routes.js).


Points calculation: ✅ Fully Implemented

Files: PointsTransaction.model.js, reward.service.js
POINTS_CONFIG constants in PointsTransaction.model.js (BLOOD_DONATION=200, EMERGENCY_RESPONSE=100, PROFILE_COMPLETION=50, FIRST_DONATION=100, tier bonuses).
Flow: triggers (e.g. donation.service.updateDonationStatus) call rewardService.onDonationCompleted → awardPoints() creates PointsTransaction entries and updates DonorPoints atomically.
Points accumulation: ✅ Fully Implemented

Implemented with atomic $inc in awardPoints() in reward.service.js. Creates PointsTransaction records for every change.


Reward tiers/levels (BRONZE/SILVER/GOLD/PLATINUM): ✅ Fully Implemented

Files: DonorPoints.model.js (static calculateTier, pointsToNextTier, TIER_THRESHOLDS).
awardPoints() handles tier promotion detection and bonuses (calls awardPoints again for tier bonuses).
Progress calculation to next tier: ✅ Fully Implemented (data available) / ⚠️ Partially for dashboard convenience

DonorPoints.pointsToNextTier() and getPointsSummary() return pointsToNextTier, lifetimePointsEarned, currentTier, nextTier. (See reward.service.js:192)
Note: aggregated GET /rewards/dashboard returns points but does not include tier fields by default — the dedicated GET /rewards/points endpoint provides the full summary. Backend does not return a direct progressPercentage field; front-end can compute it from lifetimePointsEarned + known thresholds.
Achievement unlocking: ✅ Fully Implemented

Files: Badge.model.js, UserBadge.model.js, checkAndUpdateBadges() in reward.service.js.
Flow: Badge definitions seeded, checkAndUpdateBadges() computes metrics (completed donations, emergency responses), upserts UserBadge, awards badge points (creates PointsTransaction) and logs Activity + Notification.

Reward history tracking: ✅ Fully Implemented

Models: PointsTransaction (PointsTransaction.model.js) and RewardRedemption (RewardRedemption.model.js).
APIs: GET /rewards/points/history, GET /rewards/history (redemptions), GET /rewards/redemptions. Pagination implemented in getPointsHistory() and getDonorRedemptions() (see reward.service.js).
Activity timeline recorded via Activity model and activityService.logActivity().
2. UI Features vs Backend

Rewards Overview Card (as asked):

Current points: ✅ Supported — GET /rewards/points returns pointsBalance; GET /rewards/dashboard returns points.
Controller: reward.controller.js:1, route reward.routes.js:1.
Current level (BRONZE): ✅ Supported — getPointsSummary().currentTier via GET /rewards/points. GET /rewards/dashboard does NOT include currentTier (use /rewards/points).
Next level (SILVER): ✅ Supported — getPointsSummary().nextTier.
Remaining points to next level: ✅ Supported — getPointsSummary().pointsToNextTier.
Progress bar percentage: ✅ Implemented — backend now returns `progressPercentage` directly from `getPointsSummary()` and mirrors it in the dashboard response.
Ways To Earn Points:

Blood donation → configurable: ✅ Backed by MongoDB `RewardsConfig.points.bloodDonation`; awarded in `onDonationCompleted()` in `reward.service.js`.
Emergency response → configurable: ✅ Backed by MongoDB `RewardsConfig.points.emergencyResponse`; awarded when `isEmergency` is true.
Referral reward → configurable: ✅ Backed by MongoDB `RewardsConfig.points.referral`; exposed through the earning-rules API for frontend compatibility.
Profile completion → configurable: ✅ Backed by MongoDB `RewardsConfig.points.profileCompletion`; used by `onProfileCompleted()` in `reward.service.js`.
First donation bonus → configurable: ✅ Backed by MongoDB `RewardsConfig.points.firstDonation`; applied once per donor on the first completed donation.
Config vs Hardcoded:

Points values are stored in the singleton `RewardsConfig` document and cached in memory by `rewardsConfig.service.js`. Reward catalog costs are stored in DB (RewardCatalog).
3. Reward History / Activity Log

Reward transaction history: ✅ Implemented — PointsTransaction model, getPointsHistory() endpoint (reward.service.js / GET /rewards/points/history).
Activity timeline: ✅ Implemented — Activity model + activityService.getUserTimeline() + GET /donor/activity (activity.controller.js). Supports type filtering.
Event-based point records: ✅ Implemented — PointsTransaction.referenceId stores links (e.g., donation_{id}, badge_{id}) and unique partial index for deduplication.
Timestamps for rewards: ✅ Implemented — Mongoose timestamps: true on transactions, redemptions and activities.
Reward source/type: ✅ Implemented — transactionType enum in PointsTransaction covers BLOOD_DONATION, EMERGENCY_RESPONSE, PROFILE_COMPLETION, FIRST_DONATION, TIER_BONUS, BADGE_UNLOCK, REWARD_REDEEMED, ADMIN_ADJUSTMENT.
Pagination/filtering: ✅ Implemented — getPointsHistory() and activity timeline implement pagination/filtering.
Models: No singular RewardHistory model — the audit/logging is split across PointsTransaction and RewardRedemption (which together serve reward-history needs).
Extras:

Notification integration: ✅ Implemented — Notification.create() invoked on tier promotion, badge unlock, reward redemption.
Donation-linked rewards: ✅ Implemented — donation.service.updateDonationStatus calls rewardService.onDonationCompleted().
4. Existing APIs (summary)
(All donor routes are under /rewards and require auth; activity endpoints under /donor/activity.)

GET /rewards/points — purpose: points & tier summary; returns { pointsBalance, lifetimePointsEarned, currentTier, nextTier, pointsToNextTier, tierBenefits } — frontend can consume directly to show overview and compute progress.
GET /rewards/dashboard — purpose: aggregated dashboard (points, catalog, last 10 history, badges); returns { points, progressPercentage, nextRewardPoints, pointsToNextReward, rewards:[], history:[], badges:{...} } — matches mobile “Rewards” screen format and now includes progress directly.
GET /rewards/earning-rules — frontend-friendly earning rules list with current configured point values.
GET /rewards/stats — header stats for rewards screen { points, nextReward:{pointsToGo}, badgesUnlocked, totalBadges, completionPercent }.
GET /rewards/points/history — paginated PointsTransaction list and pagination metadata.
GET /rewards/badges — badge list with donor progress and unlock status (calls getDonorBadges()).
GET /rewards/catalog — rewards available for redemption.
POST /rewards/catalog/:rewardId/redeem — redeem reward; returns confirmation code, remaining points, status.
GET /rewards/redemptions — donor redemption history (paginated).
GET /rewards/leaderboard — top donors by lifetime points.
POST /rewards/admin/users/:userId/points/adjust — admin adjust points.
PATCH /rewards/admin/catalog/:rewardId/status — admin change reward availability.
GET /rewards/admin/analytics — top rewards, tier distribution, total points issued.
GET /admin/rewards/config — current rewards config for administrators.
PUT /admin/rewards/config — update rewards config with validation and cache refresh.
GET /donor/activity — activity timeline; supports page, limit, type filter and returns activities + pagination.
Frontend consumption: dashboard + points endpoints provide nearly all data the UI needs. Where small differences exist (e.g., progress percentage), frontend can either compute it from data from GET /rewards/points or call both dashboard + points endpoints.

Caching: `rewardsConfig.service.js` keeps the config in process memory and refreshes it on startup seeding and every admin update so reward operations do not hit MongoDB on every award.

5. Database Audit (schemas / exact fields)

DonorPoints (DonorPoints.model.js) fields:
donorId:ObjectId, pointsBalance:Number, lifetimePointsEarned:Number, tier:String (enum: bronze,silver,gold,platinum), profileCompletionAwarded:Boolean, firstDonationAwarded:Boolean, timestamps.
PointsTransaction (PointsTransaction.model.js):
donorId:ObjectId, pointsAmount:Number, transactionType:String (enum), description:String, referenceId:String, balanceAfter:Number, adminId:ObjectId, timestamps.
Also exports POINTS_CONFIG.
RewardCatalog (RewardCatalog.model.js):
name, description, pointsCost, category, iconType, colorCode, status, dailyLimit, monthlyLimit, redemptionCount, timestamps.
RewardRedemption (RewardRedemption.model.js):
donorId, rewardId, pointsSpent, confirmationCode, status, deliveryMethod, deliveryContact, expiresAt, timestamps.
Badge (Badge.model.js):
badgeName, badgeDescription, badgeIcon, category, rarity, unlockCondition, unlockThreshold, pointsReward, sortOrder.
UserBadge (UserBadge.model.js):
donorId, badgeId, unlockStatus, progressCurrent, progressTarget, unlockedAt, timestamps.
Activity (Activity.model.js):
userId, type, action, title, description, referenceId, referenceType, metadata, icon, createdAt.
User does NOT contain a points field — points are stored in DonorPoints.
6. Gap Analysis (what's missing vs UI requirements)

Missing or incomplete items:

Referral points flow: no REFERRAL entry in POINTS_CONFIG and no referral awarding or referral-tracking model. (Missing feature.)
Configurable points values: POINTS_CONFIG is hardcoded in code. No admin API or DB-backed config to change per-event point values at runtime. (Partial gap: implemented but not configurable.)
Precomputed tier progressPercentage in dashboard response: backend provides pointsToNextTier and lifetimePointsEarned but not a ready progressPercentage. (Minor; can be computed client-side.)
No dedicated endpoint exposing "Ways to Earn" values / labels (e.g., GET /rewards/earnings-config) so UI has to hardcode or compute labels from docs/strings. (Missing convenience API.)
Referral activity type exists in Activity model but lacks points awarding and dedup/referral validation logic (e.g., referral codes, who referred whom). (Missing.)
No explicit audit record called RewardHistory — but PointsTransaction + RewardRedemption serve this purpose (OK, not a blocker).
No admin UI/API for editing POINTS_CONFIG (would require DB-backed config).
7. Final Verdict

A. Current Completion Percentage: ~90% complete for core points/tier/badges/redemptions/activity functionality. Core production-grade pieces are in place (atomic transactions, audit logs, activity timeline, notifications). Missing elements are configuration, referral flow, and small API conveniences.

B. Minimal Work Needed (exact list so frontend screens are fully functional):

Implement referral awarding:
Add REFERRAL (e.g., 150) to points config (or DB-config) and implement rewardService.onReferral(referredUserId, referrerId, referenceId) to award points with dedup via PointsTransaction.referenceId. Also add Referral model/table to track invites/referrals and prevent double-crediting.
Files to change/create: add handling in PointsTransaction.model.js (enum), add referral.service.js, update controllers if front-end triggers referrals.
Make POINTS_CONFIG admin-configurable (preferred):
Create PointsConfig collection or SystemSettings doc and an admin API GET/PUT /admin/rewards/config to read/adjust point values.
Update reward.service to read config (cache) rather than hard-coded constant.
Add progressPercentage to the dashboard response (optional convenience):
Modify getRewardsDashboard or getPointsSummary to return a tierProgressPercent computed from lifetimePointsEarned and tier thresholds (use existing DonorPoints.TIER_THRESHOLDS).
Add GET /rewards/earnings-config for UI (labels + values) if you prefer frontend to use backend canonical values.
Add referral UI/backend flow: model Referral with fields referrerId, referredEmail/Id, status, awardedAt.
(Optional) Expose tier thresholds in API (so front-end doesn't need to hardcode thresholds).
Add documentation endpoint or OpenAPI update to ensure mobile team knows exactly how to compute progress and where to fetch values.
C. Recommended Architecture (concise)

Schema:
DonorPoints (already good): keep separate for atomic updates.
PointsTransaction (audit log): immutable, with referenceId and transactionType enum.
RewardCatalog + RewardRedemption (already implemented): keep as-is.
Referral model: { referrerId, referredId/email, referenceCode, status, awardedAt, createdAt }.
SystemSetting or PointsConfig doc: store all per-event point values and tier thresholds; admin-editable.
Reward transaction flow:
Central awardPoints(donorId, amount, type, description, referenceId) (already present) — keep this as single source of truth. Make it read point values from DB-config (fall back to constants if not configured).
Always write PointsTransaction inside the same Mongo transaction that updates DonorPoints (already implemented).
Achievement system:
Keep Badge and UserBadge as-is; run checkAndUpdateBadges() after events that affect metrics.
For heavy badge calculations, use a background worker or queue for large-scale recalculations (not required now).
Tier progression:
Centralize thresholds in DonorPoints statics (already done). Return tierProgressPercent in getPointsSummary.
Keep tier promotion bonus awarding inside awardPoints() post-transaction (already implemented) but ensure idempotency via referenceId dedup.
Activity feed:
Continue using Activity append-only model with dedup indices; keep activityService.logActivity() fire-and-forget and used by other services. Provide GET /donor/activity for UI with type filter and pagination (already present).
Config & Admin:
Add a PointsConfig document and admin endpoints to change point values and tier thresholds safely; update services to read config on startup and refresh on change.
Quick references (key files)

Models: DonorPoints.model.js, PointsTransaction.model.js, RewardCatalog.model.js, RewardRedemption.model.js, Badge.model.js, UserBadge.model.js, Activity.model.js.
Services: reward.service.js, activity.service.js, donation.service.js.
Controllers & routes: reward.controller.js, reward.routes.js, activity.controller.js, activity.routes.js.
Would you like me to:

Implement the missing referral flow and add a Referral model and controller (I can scaffold code + tests), or
Make POINTS_CONFIG DB-backed and add an admin API to edit point values, or
Add progressPercentage to getRewardsDashboard/getPointsSummary now?
GPT-5 mini • 0x
