# LifeLink Architecture Refactoring Implementation Guide

**Date:** June 7, 2026  
**Objective:** Implement architectural improvements to address critical coupling and scalability issues  
**Status:** In Progress

---

## Overview

This document provides step-by-step implementation guidance for the architectural refactoring plan outlined in the Phase 05 Architecture Audit. The refactoring is organized into 10 key tasks, with supporting infrastructure already implemented.

## Completed Infrastructure

✅ **EventBus Service** ([src/services/eventBus.service.js](src/services/eventBus.service.js))
- Central event dispatcher using Node.js EventEmitter
- Error handling and statistics tracking
- Wrapped listener execution for async safety

✅ **Event Types Registry** ([src/constants/events.js](src/constants/events.js))
- Organized by domain (Donation, Reward, Activity, Notification, etc.)
- JSDoc payload documentation for each event
- Single source of truth for event names

✅ **Event Listeners Registry** ([src/services/eventListeners.registry.js](src/services/eventListeners.registry.js))
- Central registration point for all cross-service listeners
- Decouples services via pub/sub pattern
- Replaces direct service-to-service calls

✅ **Repository Layer** ([src/repositories/](src/repositories/))
- `BaseRepository.js` - Abstract base class with CRUD operations
- `DonorRepository.js` - Donor-specific queries
- `RequestRepository.js` - Request-specific queries
- `DonationRepository.js` - Donation-specific queries
- `ActivityRepository.js` - Activity logging queries

---

## Remaining Implementation Tasks

### Task 6: Decouple Activity Service with Events

**Current Problem:**
- 6 services directly import and call `activityService`
- Activity logging is synchronous and blocks request handling
- Makes testing difficult; all tests must mock activity service

**Solution:**
Replace direct service-to-service calls with event emissions.

**Implementation Steps:**

#### Step 6.1: Update Activity Service

Modify [src/services/activity.service.js](src/services/activity.service.js):

```javascript
import eventBus from './eventBus.service.js';
import { ActivityEvents } from '../constants/events.js';
import activityRepository from '../repositories/ActivityRepository.js';

// Replace direct calls with event emission
export const logActivity = async (donorId, data) => {
  try {
    // Create activity record synchronously
    const activity = await activityRepository.create({
      donorId,
      type: data.type,
      data,
      createdAt: new Date(),
    });

    // Emit event for listeners (async processing)
    eventBus.emit(ActivityEvents.ACTIVITY_RECORDED, {
      donorId,
      type: data.type,
      data,
      timestamp: new Date(),
    });

    return activity;
  } catch (error) {
    logger.error('Failed to log activity', { error, donorId, data });
    throw error;
  }
};
```

#### Step 6.2: Update Donation Service

Modify [src/services/donation.service.js](src/services/donation.service.js) to emit events instead of calling activity service:

```javascript
import eventBus from './eventBus.service.js';
import { DonationEvents, ActivityEvents } from '../constants/events.js';

export const createDonation = async (donorId, requestId, data) => {
  // ... existing donation creation logic ...

  // Replace:
  // await activityService.logActivity(donorId, { type: 'DONATION_CREATED', ... });
  
  // With:
  eventBus.emit(DonationEvents.DONATION_CREATED, {
    donationId: donation._id,
    donorId,
    requestId,
    data,
  });

  return donation;
};

export const completeDonation = async (donationId) => {
  // ... completion logic ...

  eventBus.emit(DonationEvents.DONATION_COMPLETED, {
    donationId,
    donorId: donation.donorId,
    pointsAwarded: donation.pointsAwarded,
  });
};
```

#### Step 6.3: Update Other Services

Apply similar pattern to:
- `reward.service.js` - Emit `BADGE_UNLOCKED`, `TIER_PROGRESSED` events
- `appointment.service.js` - Emit `APPOINTMENT_CONFIRMED`, `APPOINTMENT_COMPLETED` events
- `request-lifecycle.service.js` - Emit request state change events
- `admin.service.js` - Emit administrative action events

#### Step 6.4: Register Event Listeners

Call `registerEventListeners` in [src/server.js](src/server.js):

```javascript
import registerEventListeners from './services/eventListeners.registry.js';

// After database connection
await connectDB();

// Register all event listeners
const services = {
  activityService: require('./services/activity.service.js'),
  notificationService: require('./services/notification.service.js'),
  rewardService: require('./services/reward.service.js'),
  matchingService: require('./services/matching.service.js'),
  donationService: require('./services/donation.service.js'),
  appointmentService: require('./services/appointment.service.js'),
  requestLifecycleService: require('./services/request-lifecycle.service.js'),
};

await registerEventListeners(services);
```

**Outcome:**
- Activity service no longer called directly
- Reduced coupling between services
- Activity logging no longer blocks requests
- Easier to test (mock event emitter instead of service)

---

### Task 7: Split Matching Service into Focused Services

**Current Problem:**
- `matching.service.js` (400+ lines) combines 3 unrelated concerns:
  1. Blood type compatibility (50 lines)
  2. Geo-distance calculation (100 lines)
  3. Eligibility checking (delegates to eligibility service)
- Complex location parsing handles 8 coordinate format variations
- Difficult to test; changes in one area affect others

**Solution:**
Decompose into three focused services.

**Implementation Steps:**

#### Step 7.1: Create BloodTypeCompatibilityService

Create [src/services/bloodTypeCompatibility.service.js](src/services/bloodTypeCompatibility.service.js):

```javascript
import logger from '../utils/logger.js';
import { BLOOD_TYPE_MATRIX } from '../constants/donation.constants.js';

export const isCompatible = (donorBloodType, requestBloodType) => {
  try {
    const compatible = BLOOD_TYPE_MATRIX[donorBloodType]?.includes(requestBloodType);
    return !!compatible;
  } catch (error) {
    logger.error('Failed to check blood type compatibility', { error, donorBloodType, requestBloodType });
    throw error;
  }
};

export const getCompatibleDonorTypes = (requestBloodType) => {
  const compatible = [];
  for (const [donorType, recipients] of Object.entries(BLOOD_TYPE_MATRIX)) {
    if (recipients.includes(requestBloodType)) {
      compatible.push(donorType);
    }
  }
  return compatible;
};

export const normalizeBloodType = (bloodType) => {
  if (!bloodType) return null;
  const normalized = bloodType.toUpperCase().replace(/\s/g, '');
  if (!BLOOD_TYPE_MATRIX[normalized]) {
    throw new Error(`Invalid blood type: ${bloodType}`);
  }
  return normalized;
};
```

#### Step 7.2: Create GeoDistanceService

Create [src/services/geoDistance.service.js](src/services/geoDistance.service.js):

```javascript
import logger from '../utils/logger.js';

const EARTH_RADIUS_KM = 6371;

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  try {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = EARTH_RADIUS_KM * c;
    return distance;
  } catch (error) {
    logger.error('Failed to calculate distance', { error });
    throw error;
  }
};

export const parseCoordinates = (location) => {
  try {
    // Handle 8 coordinate format variations
    if (location?.coordinates && Array.isArray(location.coordinates)) {
      return { lat: location.coordinates[1], lng: location.coordinates[0] };
    }
    if (location?.latitude && location?.longitude) {
      return { lat: location.latitude, lng: location.longitude };
    }
    if (location?.lat && location?.lng) {
      return { lat: location.lat, lng: location.lng };
    }
    if (location?.lat && location?.lon) {
      return { lat: location.lat, lng: location.lon };
    }
    throw new Error('Invalid location format');
  } catch (error) {
    logger.error('Failed to parse coordinates', { error, location });
    throw error;
  }
};

export const filterByDistance = (donors, targetLocation, maxDistanceKm) => {
  const target = parseCoordinates(targetLocation);
  return donors
    .map((donor) => {
      const donorLoc = parseCoordinates(donor.location);
      const distance = calculateDistance(
        target.lat, target.lng,
        donorLoc.lat, donorLoc.lng
      );
      return { ...donor, distance };
    })
    .filter((donor) => donor.distance <= maxDistanceKm)
    .sort((a, b) => a.distance - b.distance);
};

const toRad = (degrees) => degrees * (Math.PI / 180);
```

#### Step 7.3: Create DonorMatchingService

Refactor [src/services/matching.service.js](src/services/matching.service.js) to use new services:

```javascript
import donorRepository from '../repositories/DonorRepository.js';
import requestRepository from '../repositories/RequestRepository.js';
import * as bloodTypeCompatibility from './bloodTypeCompatibility.service.js';
import * as geoDistance from './geoDistance.service.js';
import * as eligibilityService from './eligibility.service.js';
import logger from '../utils/logger.js';

export const findCompatibleDonors = async (request, options = {}) => {
  try {
    const { maxDistanceKm = 100, maxResults = 50 } = options;

    // Step 1: Get all donors compatible by blood type
    const compatibleTypes = bloodTypeCompatibility.getCompatibleDonorTypes(request.bloodType);
    const donors = await donorRepository.find(
      { bloodType: { $in: compatibleTypes } },
      { limit: 500 } // Get more to filter by eligibility/distance
    );

    // Step 2: Check eligibility for each donor
    const eligibleDonors = [];
    for (const donor of donors) {
      const { isEligible } = await eligibilityService.checkEligibility(donor._id);
      if (isEligible) {
        eligibleDonors.push(donor);
      }
    }

    // Step 3: Filter by distance and sort
    const nearby = geoDistance.filterByDistance(
      eligibleDonors,
      request.location,
      maxDistanceKm
    );

    return nearby.slice(0, maxResults);
  } catch (error) {
    logger.error('Failed to find compatible donors', { error });
    throw error;
  }
};

export const checkCompatibility = async (donor, request) => {
  try {
    // Blood type check
    const bloodTypeOk = bloodTypeCompatibility.isCompatible(donor.bloodType, request.bloodType);
    if (!bloodTypeOk) {
      return { compatible: false, reason: 'Blood type mismatch' };
    }

    // Eligibility check
    const { isEligible, reason } = await eligibilityService.checkEligibility(donor._id);
    if (!isEligible) {
      return { compatible: false, reason };
    }

    // Distance check (optional)
    const distance = geoDistance.calculateDistance(
      donor.location.lat, donor.location.lng,
      request.location.lat, request.location.lng
    );

    return { compatible: true, distance };
  } catch (error) {
    logger.error('Failed to check compatibility', { error });
    throw error;
  }
};
```

**Outcome:**
- Each service has single responsibility
- Easier to test each component independently
- Reusable services (e.g., geoDistance used elsewhere)
- Removed location format handling complexity

---

### Task 8: Fix Circular Import Issues

**Problem:**
Matching service imports eligibility service; eligibility service may import back.

**Investigation Steps:**

1. Inspect [src/services/eligibility.service.js](src/services/eligibility.service.js) for imports of matching service
2. If circular, refactor to break dependency

**Solution Options:**

**Option A: Lazy Loading** (if circular):
```javascript
// matching.service.js
export const checkEligibility = async (donorId) => {
  // Import only when needed
  const { checkEligibility } = await import('./eligibility.service.js');
  return checkEligibility(donorId);
};
```

**Option B: Dependency Injection**:
```javascript
// services/index.js
export const createServices = () => ({
  matching: createMatchingService(eligibility),
  eligibility: createEligibilityService(),
});
```

**Option C: Extract Common Logic**:
If circular dependency exists, extract shared logic to utility module:
```javascript
// utils/eligibility-rules.js (no service imports)
export const validateAge = (age) => age >= 18 && age <= 65;
export const validateDonationInterval = (lastDonationDate) => {
  // ...
};
```

---

### Task 9: Unify Configuration Management

**Current Problem:**
Configuration split across 3 sources:
- Environment variables (.env)
- System settings (MongoDB)
- Reward configuration (MongoDB)

**Solution:**
Create unified `ConfigService` that provides consistent interface.

**Implementation:**

Create [src/services/config.service.js](src/services/config.service.js):

```javascript
import logger from '../utils/logger.js';
import SystemSettings from '../models/SystemSettings.model.js';
import RewardsConfig from '../models/RewardsConfig.model.js';

class ConfigService {
  constructor() {
    this.cache = {};
    this.cacheExpiry = {};
    this.CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get system configuration value
   */
  async get(key, defaultValue = null) {
    try {
      // Check cache
      if (this.isValidCache(key)) {
        return this.cache[key];
      }

      // Load from database
      const setting = await SystemSettings.findOne({ key });
      const value = setting?.value ?? defaultValue;

      // Update cache
      this.cache[key] = value;
      this.cacheExpiry[key] = Date.now() + this.CACHE_TTL_MS;

      return value;
    } catch (error) {
      logger.error('Failed to get config', { key, error });
      return defaultValue;
    }
  }

  /**
   * Get all system configuration
   */
  async getAll() {
    try {
      const settings = await SystemSettings.find({}).lean();
      const config = {};
      settings.forEach((s) => {
        config[s.key] = s.value;
      });
      return config;
    } catch (error) {
      logger.error('Failed to get all config', { error });
      throw error;
    }
  }

  /**
   * Set configuration value
   */
  async set(key, value) {
    try {
      const setting = await SystemSettings.findOneAndUpdate(
        { key },
        { value },
        { upsert: true, new: true }
      );

      // Invalidate cache
      delete this.cache[key];
      delete this.cacheExpiry[key];

      logger.info('Config updated', { key, value });
      return setting;
    } catch (error) {
      logger.error('Failed to set config', { key, error });
      throw error;
    }
  }

  /**
   * Get reward configuration
   */
  async getRewardConfig(key = null) {
    try {
      if (key) {
        return await RewardsConfig.findOne({ key }).lean();
      }
      return await RewardsConfig.find({}).lean();
    } catch (error) {
      logger.error('Failed to get reward config', { key, error });
      throw error;
    }
  }

  /**
   * Get environment configuration (from .env)
   */
  getEnv(key, defaultValue = null) {
    return process.env[key] ?? defaultValue;
  }

  /**
   * Unified get: Try system settings → reward config → env vars → default
   */
  async getUnified(key, defaultValue = null) {
    // Try system settings
    const systemValue = await this.get(key);
    if (systemValue !== null && systemValue !== undefined) {
      return systemValue;
    }

    // Try reward config
    const rewardValue = await this.getRewardConfig(key);
    if (rewardValue) {
      return rewardValue.value;
    }

    // Try environment
    const envValue = this.getEnv(key);
    if (envValue !== undefined) {
      return envValue;
    }

    return defaultValue;
  }

  isValidCache(key) {
    if (!this.cache.hasOwnProperty(key)) return false;
    if (!this.cacheExpiry[key]) return false;
    return this.cacheExpiry[key] > Date.now();
  }

  clearCache() {
    this.cache = {};
    this.cacheExpiry = {};
  }
}

export default new ConfigService();
```

**Update services to use ConfigService:**

```javascript
// donation.service.js
import configService from './config.service.js';

export const calculatePoints = async (donation) => {
  const pointsPerDonation = await configService.getUnified('POINTS_PER_DONATION', 100);
  // ... calculate points ...
};
```

---

### Task 10: Refactor Service Orchestration

**Problem:**
Services call each other in long chains; donation creation triggers 4+ sequential service calls.

**Solution:**
Use event-driven pattern to decouple orchestration.

**Before:**
```javascript
// Controller
const donation = await donationService.createDonation(donorId, requestId);
```

```javascript
// Service (synchronous chain)
export const createDonation = async (donorId, requestId) => {
  const donation = await Donation.create(...);
  await matchingService.checkEligibility(...);  // Wait
  await rewardService.awardPoints(...);         // Wait
  await activityService.logActivity(...);       // Wait
  await notificationService.notify(...);        // Wait
  return donation;
};
```

**After:**
```javascript
// Controller - No change needed
const donation = await donationService.createDonation(donorId, requestId);
```

```javascript
// Service (emit events, let listeners handle)
export const createDonation = async (donorId, requestId) => {
  const donation = await Donation.create(...);
  
  // Emit event; listeners will handle async side effects
  eventBus.emit(DonationEvents.DONATION_CREATED, {
    donationId: donation._id,
    donorId,
    requestId,
  });
  
  // Return immediately without waiting
  return donation;
};
```

**Event Listeners** (from [src/services/eventListeners.registry.js](src/services/eventListeners.registry.js)):
```javascript
eventBus.on(DonationEvents.DONATION_CREATED, async (payload) => {
  // Eligibility check
  const { isEligible } = await eligibilityService.checkEligibility(payload.donorId);
  if (!isEligible) {
    eventBus.emit(DonationEvents.ELIGIBILITY_CHECK_FAILED, payload);
    return;
  }

  // Award points
  await rewardService.awardPoints(payload.donorId);

  // Log activity
  await activityService.logActivity(payload.donorId, {
    type: 'DONATION_CREATED',
    donationId: payload.donationId,
  });

  // Send notification
  await notificationService.notifyMatch(payload);
});
```

**Benefits:**
- Request completes faster (returns after DB write, before side effects)
- Services are independent (no direct imports)
- Easy to add/remove side effects (just add/remove event listener)
- Better scalability (can move listeners to separate worker process)
- Easier testing (mock event emitter)

---

## Implementation Checklist

- [ ] Task 6: Decouple Activity Service
  - [ ] Update activity.service.js to emit events
  - [ ] Update donation.service.js to emit events instead of calling activity
  - [ ] Update reward.service.js to emit events
  - [ ] Update appointment.service.js to emit events
  - [ ] Update request-lifecycle.service.js to emit events
  - [ ] Update admin.service.js to emit events
  - [ ] Register event listeners in server.js
  - [ ] Test: Verify activity logging still works asynchronously

- [ ] Task 7: Split Matching Service
  - [ ] Create bloodTypeCompatibility.service.js
  - [ ] Create geoDistance.service.js
  - [ ] Refactor matching.service.js to use new services
  - [ ] Update all imports in controllers/services
  - [ ] Test: Verify matching logic works correctly

- [ ] Task 8: Fix Circular Imports
  - [ ] Audit matching.service.js ↔ eligibility.service.js imports
  - [ ] Implement solution (lazy loading, DI, or extraction)
  - [ ] Test: Verify services load without errors

- [ ] Task 9: Unify Configuration
  - [ ] Create config.service.js with unified interface
  - [ ] Update services to use configService instead of direct env/db queries
  - [ ] Test: Verify config values are consistent

- [ ] Task 10: Refactor Service Orchestration
  - [ ] Apply event-driven pattern to all services
  - [ ] Verify tests pass with async event handling
  - [ ] Monitor performance improvements

---

## Testing Strategy

After each task, implement tests:

```javascript
// test/services/eventBus.test.js
import eventBus from '../../src/services/eventBus.service.js';
import { DonationEvents } from '../../src/constants/events.js';

describe('EventBus', () => {
  it('should emit and handle events', (done) => {
    const payload = { donorId: '123', requestId: '456' };
    
    eventBus.on(DonationEvents.DONATION_CREATED, (data) => {
      expect(data).toEqual(payload);
      done();
    });

    eventBus.emit(DonationEvents.DONATION_CREATED, payload);
  });
});
```

---

## Deployment Strategy

1. **Phase 1:** Deploy event infrastructure (eventBus, eventListeners, repositories)
2. **Phase 2:** Deploy activity service decoupling (non-breaking change)
3. **Phase 3:** Deploy matching service split (update imports gradually)
4. **Phase 4:** Deploy config unification (gradual service adoption)
5. **Phase 5:** Deploy orchestration refactoring (final phase)

**Feature flags recommended for gradual rollout:**
```javascript
if (process.env.USE_EVENT_DRIVEN === 'true') {
  // Use new event-based flow
} else {
  // Use legacy direct service calls
}
```

---

## Monitoring & Metrics

Track improvements post-deployment:

- Request latency (should decrease as activity logging becomes async)
- Service coupling (count of service imports in each module)
- Event throughput (events/second processed by listeners)
- Error rates in async event handling

```javascript
// Track event metrics
eventBus.on('*', (event, payload) => {
  metrics.increment('events.emitted', { eventName: event });
  logger.debug(`Event: ${event}`, { payload });
});
```

---

## References

- Event-Driven Architecture: https://martinfowler.com/articles/201701-event-driven.html
- Repository Pattern: https://martinfowler.com/eaaCatalog/repository.html
- Single Responsibility Principle: https://en.wikipedia.org/wiki/Single_responsibility_principle
- Coupling & Cohesion: https://en.wikipedia.org/wiki/Coupling_(computer_programming)

