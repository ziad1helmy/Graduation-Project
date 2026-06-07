# Quick Start Guide - LifeLink Architecture Refactoring

**TL;DR:** Use this guide to quickly understand and implement the architectural improvements.

---

## 🎯 Goal

Transform LifeLink backend from **tightly-coupled monolith** → **loosely-coupled event-driven architecture**

## 📊 Impact

| Metric | Before | After |
|--------|--------|-------|
| Service coupling | Direct imports (6+) | Event-based (0 direct imports) |
| Request latency | ~1000ms (includes all side effects) | ~200ms (returns after DB write) |
| Lines in `matching.service.js` | 400+ | 200+ (split into 3 services) |
| Testability | Hard (must mock 3+ services) | Easy (mock event emitter) |

---

## 🚀 Quick Implementation Path

### Week 1: Foundation
1. ✅ EventBus service deployed
2. ✅ Repositories implemented
3. Deploy and test in dev environment

### Week 2: Activity Service Decoupling
1. Update services to emit events instead of calling `activityService`
2. Register event listeners
3. Test: Verify activity still logged, but asynchronously
4. Expected result: ~70% request latency reduction

### Week 3: Service Decomposition
1. Split `matching.service.js` into 3 focused services
2. Update imports in controllers/services
3. Test: Verify matching logic still works

### Week 4: Config Unification & Refinement
1. Create `ConfigService` for unified configuration
2. Update services to use it
3. Remove magic strings/hardcoded config values
4. Final testing & deployment

---

## 📝 Checklists by Role

### 👨‍💻 For Service Implementation (Tasks 6-10)

- [ ] Read `ARCHITECTURE_REFACTORING_GUIDE.md` (full details)
- [ ] Import EventBus in your service: `import eventBus from './eventBus.service.js'`
- [ ] Import Event constants: `import { DonationEvents } from '../constants/events.js'`
- [ ] Find `// Replace with event:` comments in your service
- [ ] Change `await activityService.logActivity(...)` → `eventBus.emit(DonationEvents.ACTIVITY_RECORDED, ...)`
- [ ] Use repositories instead of direct model imports
- [ ] Run tests: `npm test -- src/services/[service-name].test.js`

### 👨‍💼 For Code Review

- [ ] Services don't directly import other services (except repositories)
- [ ] All side effects (activity, notifications) emitted as events
- [ ] No circular imports detected
- [ ] Tests mock event emitter, not services
- [ ] Controllers unchanged (still call services directly)

### 🧪 For Testing

- [ ] Update test mocks to use event emitter:
```javascript
// Old
jest.mock('./activity.service.js');

// New
jest.mock('./eventBus.service.js');
eventBus.on('activity:recorded', jest.fn());
```

- [ ] Test event listeners registered: `registerEventListeners(services)`
- [ ] Verify events emitted with correct payload
- [ ] Test error handling in listeners

---

## 🔗 How to Use New Services

### EventBus

```javascript
import eventBus from '../services/eventBus.service.js';
import { DonationEvents } from '../constants/events.js';

// Emit event
eventBus.emit(DonationEvents.DONATION_CREATED, {
  donationId: '123',
  donorId: '456',
  requestId: '789',
});

// Listen for event
eventBus.on(DonationEvents.DONATION_COMPLETED, (payload) => {
  console.log('Donation completed:', payload);
});
```

### Repositories

```javascript
import donorRepository from '../repositories/DonorRepository.js';
import donationRepository from '../repositories/DonationRepository.js';

// Instead of: const donor = await Donor.findById(id);
const donor = await donorRepository.findById(id);

// Complex queries now abstracted
const nearby = await donorRepository.findNearby(
  { lat: 40.7128, lng: -74.0060 },
  { maxDistance: 50000, bloodType: 'O+' }
);

const stats = await donationRepository.getDonorStats(donorId);
```

### ConfigService

```javascript
import configService from '../services/config.service.js';

// Get any configuration from unified source
const maintenanceMode = await configService.get('maintenance_mode', false);
const pointsPerDonation = await configService.getUnified('POINTS_PER_DONATION', 100);

// Set configuration (persists to DB)
await configService.set('feature_flag_v2', true);
```

---

## ❌ Common Mistakes (Avoid These!)

| ❌ Don't | ✅ Do |
|---------|------|
| `import donationService from './donation.service'` then call it | Emit event; service handles it async |
| `const donor = await Donor.findById(id)` | Use repository: `donorRepository.findById(id)` |
| Store config as magic strings | Use configService for all config |
| Direct MongoDB queries in controllers | Delegate to services + repositories |
| One giant service doing everything | Split into focused services |

---

## 🧪 Example: Refactoring a Service

### Before (Tightly Coupled)
```javascript
// src/services/donation.service.js
import Activity from '../models/Activity.model.js';
import * as matchingService from './matching.service.js';
import * as rewardService from './reward.service.js';
import * as activityService from './activity.service.js';
import * as notificationService from './notification.service.js';

export const createDonation = async (donorId, requestId) => {
  // Create donation
  const donation = await Donation.create({ donorId, requestId });

  // Call services in series (blocks request)
  await matchingService.checkEligibility(donorId);
  await rewardService.awardPoints(donorId);
  await activityService.logActivity(donorId, { type: 'DONATION_CREATED' });
  await notificationService.notifyMatch(donation);

  return donation;
};
```

### After (Loosely Coupled)
```javascript
// src/services/donation.service.js
import eventBus from './eventBus.service.js';
import { DonationEvents } from '../constants/events.js';
import donationRepository from '../repositories/DonationRepository.js';

export const createDonation = async (donorId, requestId) => {
  // Create donation using repository
  const donation = await donationRepository.create({
    donorId,
    requestId,
    status: 'pending',
  });

  // Emit event; listeners handle side effects asynchronously
  eventBus.emit(DonationEvents.DONATION_CREATED, {
    donationId: donation._id,
    donorId,
    requestId,
  });

  // Return immediately (request completes faster)
  return donation;
};
```

### Event Listeners (In eventListeners.registry.js)
```javascript
eventBus.on(DonationEvents.DONATION_CREATED, async (payload) => {
  // Eligibility check
  const { isEligible } = await eligibilityService.checkEligibility(payload.donorId);
  if (!isEligible) {
    eventBus.emit(DonationEvents.ELIGIBILITY_CHECK_FAILED, payload);
    return;
  }

  // Award points
  await rewardService.awardPoints(payload.donorId, 100);

  // Log activity
  await activityService.logActivity(payload.donorId, {
    type: 'DONATION_CREATED',
    donationId: payload.donationId,
  });

  // Send notification
  await notificationService.notifyMatch(payload);
});
```

---

## 📚 Reference Materials

- **Comprehensive Guide:** `ARCHITECTURE_REFACTORING_GUIDE.md`
- **Event Definitions:** `src/constants/events.js`
- **Event Registration:** `src/services/eventListeners.registry.js`
- **Repository Examples:** `src/repositories/*.js`
- **EventBus API:** `src/services/eventBus.service.js`

---

## ⚡ Performance Expectations

### Request Latency
- **Before:** ~1000ms (includes activity logging, notifications, points calculation)
- **After:** ~200ms (returns after DB write, before side effects)

### Database Queries
- **Before:** Multiple queries per request (model imports everywhere)
- **After:** Centralized repository queries (queryable, cacheable)

### Service Dependencies
- **Before:** `donation.service` imports 4+ other services
- **After:** `donation.service` imports 0 other services (only repositories + eventBus)

---

## 🆘 Troubleshooting

### Events not firing?
- Check event listener is registered: `registerEventListeners(services)` called in `server.js`
- Verify event name matches exactly: `DonationEvents.DONATION_CREATED` (not string typo)

### Repository queries not working?
- Import correct repository: `donorRepository` not `Donor` model
- Use method from BaseRepository: `findById()`, `find()`, `create()`, etc.
- Check error logs for query issues

### Circular imports?
- Don't import services in other services
- Use event emitter for cross-service communication
- Or use dependency injection pattern

---

## 📞 Questions?

Refer to specific sections in `ARCHITECTURE_REFACTORING_GUIDE.md` or check existing service implementations for examples.

**Last Updated:** June 7, 2026
