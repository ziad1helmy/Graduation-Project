# Deployment Monitoring & Logging Guide
**Phase 9 Deployment Tracking**

---

## Overview

This guide provides instructions for monitoring the LifeLink API refactor deployment and tracking migration progress.

---

## Pre-Deployment Setup

### 1. Enable Detailed Logging

**File**: `src/config/logger.js` or equivalent

Ensure these logs are captured:

```javascript
// Log all 404 errors to tracking system
logger.warn('404 Error', {
  method: req.method,
  path: req.path,
  userId: req.user?.userId,
  timestamp: new Date(),
  userAgent: req.headers['user-agent'],
  endpoint: req.originalUrl
});

// Track removed endpoint usage specifically
const REMOVED_ENDPOINTS = [
  '/donor/urgent-requests',
  '/urgent-requests'
];

if (REMOVED_ENDPOINTS.some(e => req.path.includes(e))) {
  logger.error('DEPRECATED_ENDPOINT_USED', {
    endpoint: req.path,
    method: req.method,
    userId: req.user?.userId,
    timestamp: new Date()
  });
}
```

### 2. Add Monitoring Dashboard

Set up alerts in your monitoring system (Datadog, NewRelic, CloudWatch):

**Alert 1: Removed Endpoints Usage**
```
IF error_code == 404 AND path CONTAINS 'urgent-requests'
THEN alert(severity=high, message='Old API endpoint used')
```

**Alert 2: Eligibility Filter Performance**
```
IF duration('GET /requests/nearby') > 100ms
THEN log(message='getNearbyRequests slow')
```

### 3. Create Tracking Dashboard

Build a dashboard showing:
- Daily count of requests to removed endpoints
- % of clients migrated
- Average response time for new endpoints
- Error rates

---

## Post-Deployment Monitoring (June 1 - July 1)

### Daily Check (7am UTC)

**Automated Check Script:**
```bash
#!/bin/bash
# check-migration-progress.sh

echo "=== LifeLink API Migration Daily Report ==="
echo "Date: $(date)"
echo ""

# Get 404 errors for removed endpoints
REMOVED_ENDPOINT_404S=$(curl -s \
  "https://monitoring.example.com/api/metrics?query=errors&path=urgent-requests&status=404&hours=24" \
  | jq '.total')

echo "404 Errors (Removed Endpoints): $REMOVED_ENDPOINT_404S"

# Get new endpoint usage
NEW_ENDPOINT_USAGE=$(curl -s \
  "https://monitoring.example.com/api/metrics?query=requests&path=nearby&param=urgency&hours=24" \
  | jq '.total')

echo "New Endpoint Usage: $NEW_ENDPOINT_USAGE"

# Calculate migration %
MIGRATION_PCT=$((NEW_ENDPOINT_USAGE * 100 / (NEW_ENDPOINT_USAGE + REMOVED_ENDPOINT_404S)))
echo "Estimated Migration: $MIGRATION_PCT%"

# Alert if too many old endpoint calls
if [ "$REMOVED_ENDPOINT_404S" -gt 100 ]; then
  echo "⚠️  WARNING: High usage of old endpoints detected"
  echo "   Action: Send follow-up email to API consumers"
fi
```

### Weekly Check (Every Monday)

**Email Summary Template:**

```
Subject: LifeLink API Migration Report - Week X

Metrics for Week of [DATE]:
- Removed endpoint calls: X
- New endpoint calls: Y
- Migration rate: Z%
- Error rate: A%

Top consumers still using old endpoints:
1. [Organization] - X calls
2. [Organization] - Y calls

Actions taken:
- [ ] Sent reminder emails to high-usage consumers
- [ ] Verified monitoring is working
- [ ] Checked error logs for issues
- [ ] Updated progress dashboard

Next week priorities:
- Follow up with non-migrating consumers
- Investigate any performance issues
- Ensure all migration guides are accessible
```

### Key Metrics to Track

#### 1. Adoption Metrics
```javascript
// Removed endpoint usage
GET /analytics/removed-endpoints?since=june1

// Expected result
{
  "total_requests": 2500,
  "endpoints": {
    "/donor/urgent-requests": 1200,
    "/donor/urgent-requests/{id}": 800,
    "/donor/urgent-requests/{id}/accept": 400,
    "/donor/urgent-requests/{id}/decline": 100
  },
  "unique_clients": 45,
  "trend": "decreasing"
}
```

#### 2. New Endpoint Adoption
```javascript
// New endpoint usage
GET /analytics/new-endpoints?since=june1&param=urgency

// Expected result
{
  "total_requests": 8500,
  "endpoint": "/requests/nearby",
  "query_params": {
    "urgency=critical": 3200,
    "urgency=high": 2100,
    "urgency=medium": 1800,
    "urgency=low": 1400
  },
  "unique_clients": 120,
  "trend": "increasing"
}
```

#### 3. Error Tracking
```javascript
// Error rates
GET /analytics/errors?since=june1

// Expected result
{
  "404_errors": {
    "total": 2500,
    "top_paths": [
      "/donor/urgent-requests",
      "/urgent-requests"
    ]
  },
  "400_errors": 150,  // Missing lat/lng
  "401_errors": 50,   // Auth issues
  "other_errors": 100
}
```

#### 4. Performance Metrics
```javascript
// Response times for new endpoints
GET /analytics/performance?endpoint=/requests/nearby&since=june1

// Expected result
{
  "p50_ms": 45,
  "p95_ms": 120,
  "p99_ms": 250,
  "error_rate": "0.2%",
  "trend": "stable"
}
```

---

## Monitoring Commands

### Check Removed Endpoint Usage (Hourly)

```bash
# View last hour of removed endpoint requests
grep -E '(urgent-requests|/urgent-requests)' /var/log/lifelink/app.log \
  | grep -E '(GET|POST|DELETE)' \
  | tail -50

# Count by endpoint
grep -E '(urgent-requests|/urgent-requests)' /var/log/lifelink/app.log \
  | cut -d' ' -f1 \
  | sort | uniq -c | sort -rn
```

### Check New Endpoint Usage (Hourly)

```bash
# View successful /requests/nearby calls with urgency
grep 'GET /requests/nearby' /var/log/lifelink/app.log \
  | grep 'urgency=' \
  | tail -100

# Count by urgency level
grep 'GET /requests/nearby' /var/log/lifelink/app.log \
  | grep -oP 'urgency=\K[^&]+' \
  | sort | uniq -c
```

### Monitor Error Rate (Every 30 minutes)

```bash
# Get 404 errors by path
grep ' 404 ' /var/log/lifelink/app.log | tail -1000 | \
  cut -d' ' -f9 | sort | uniq -c | sort -rn | head -20
```

---

## Critical Alerts

### Alert 1: Removed Endpoints Still in Use (HIGH)

**Trigger**: More than 10 requests to removed endpoints in last hour

**Action**:
1. Check which clients are using old endpoints
2. Send immediate support email
3. Offer manual assistance if needed
4. Escalate if pattern continues

**Configuration**:
```yaml
alerts:
  - name: removed_endpoints_usage
    condition: count(404 AND path CONTAINS 'urgent-requests') > 10
    window: 1h
    severity: HIGH
    action:
      - email: api-support@lifelink.com
      - slack: #api-migrations
      - log: ALERT
```

### Alert 2: New Endpoints Performing Poorly (MEDIUM)

**Trigger**: Response time > 500ms for `/requests/nearby?urgency=*`

**Action**:
1. Check database performance
2. Check for eligibility filter bottleneck
3. Scale if needed
4. Investigate if new code introduced regression

**Configuration**:
```yaml
alerts:
  - name: new_endpoints_slow
    condition: duration(GET /requests/nearby) > 500ms
    window: 5m
    severity: MEDIUM
    action:
      - log: PERFORMANCE_WARNING
      - metrics: performance_degradation
```

### Alert 3: Migration Not Progressing (MEDIUM)

**Trigger**: No increase in new endpoint usage for 7 days

**Action**:
1. Review email delivery status
2. Check if consumers received notifications
3. Send follow-up reminders
4. Offer manual support

**Configuration**:
```yaml
alerts:
  - name: slow_migration
    condition: trend(new_endpoints_usage) == flat for 7d
    severity: MEDIUM
    action:
      - email: api-support@lifelink.com
      - log: MIGRATION_ALERT
```

---

## Troubleshooting Guide

### Problem: Still Seeing 404s for Old Endpoints

**Expected**: This is normal during June 1-30 window

**Investigation**:
```bash
# Check specific endpoint usage
curl -s https://api.lifelink.com/donor/urgent-requests \
  -H "Authorization: Bearer $TOKEN" 2>&1 | head -20

# Should return 404 with message about deprecated endpoint
```

**Action**:
- Confirm endpoints returning 404
- Track which clients are affected
- Send migration reminders

### Problem: New Endpoints Showing High Response Times

**Investigation**:
```bash
# Check if eligibility filtering is slow
curl -s 'https://api.lifelink.com/requests/nearby?lat=30&lng=31' \
  -H "Authorization: Bearer $TOKEN" \
  -w "Response time: %{time_total}s\n"

# Expected: < 100ms
# If > 500ms: Check database performance
```

**Action**:
- Check database indexes
- Monitor CPU/memory usage
- Profile eligibility service
- Add caching if needed

### Problem: Migration Stuck Below 50%

**Investigation**:
1. Check notification delivery:
   ```bash
   grep "migration notification" /var/log/mail.log | wc -l
   ```

2. Check if emails were bounced:
   ```bash
   grep "bounce" /var/log/mail.log | grep "urgent-requests" | head -20
   ```

3. Check if consumers have support tickets:
   ```bash
   SELECT COUNT(*) FROM support_tickets 
   WHERE created >= '2026-06-01' 
   AND message LIKE '%urgent-requests%'
   ```

**Action**:
- Resend notifications with updated migration guide
- Call high-value consumers directly
- Offer extended migration window if needed

---

## Success Criteria

### By June 15 (Week 2)
- ✓ All systems logging removed endpoint usage
- ✓ Dashboard showing real-time metrics
- ✓ At least 25% of consumers migrated
- ✓ No performance issues with new endpoints
- ✓ All notifications sent successfully

### By June 30 (Week 4)
- ✓ At least 80% of consumers migrated
- ✓ Removed endpoint usage < 100 calls/day
- ✓ New endpoint performance stable
- ✓ No critical issues reported
- ✓ Support team trained on migration

### After July 1 (Week 5+)
- ✓ Removed endpoints returning 404
- ✓ < 10 calls/day to old endpoints
- ✓ All high-value consumers migrated
- ✓ Remaining non-migrated consumers contacted
- ✓ Plan for forced deprecation if needed

---

## Communication Plan

### Daily (To Internal Team)
- Morning: Check previous night's logs
- Review: Top 10 consumers by removed endpoint usage
- Action: Send follow-ups if needed

### Weekly (To Stakeholders)
- Summary: Migration progress %, issues
- Metrics: Adoption rate, performance
- Actions: Planned for next week

### Bi-Weekly (To Consumers)
- June 1: Initial notification sent
- June 15: Reminder for non-migrated consumers
- June 25: Final warning before cutoff
- July 1: Endpoint shutdown confirmation

---

## Rollback Plan (If Needed)

If critical issues discovered:

### Option 1: Restore Old Endpoints (Temporary)
1. Uncomment routes in src/app.js
2. Reactivate handlers in controllers
3. Deploy hotfix
4. Notify consumers (extended deadline)

### Option 2: Keep Old Endpoints Longer
1. Announce 2-week extension
2. Continue monitoring
3. Plan better migration support
4. Set new cutoff date

### Decision Criteria for Rollback
- > 10% of consumers unable to migrate
- Critical bugs in new implementation
- > 50% error rate in new endpoints
- Major performance degradation

---

## Post-Cutoff (After July 1)

### Week of July 1
- [ ] Confirm all old endpoints return 404
- [ ] Check for unexpected 404 volume
- [ ] Contact any remaining non-migrated consumers
- [ ] Offer manual API access if needed

### Week of July 15
- [ ] Stop logging old endpoint requests
- [ ] Archive old endpoint code to branch
- [ ] Remove old handlers from production
- [ ] Update documentation

### Month of August
- [ ] Analyze migration metrics
- [ ] Write post-mortem
- [ ] Document lessons learned
- [ ] Plan next API refactor

---

## Tools & Resources

### Monitoring Tools
- **Real-time**: New Relic, Datadog, CloudWatch
- **Logs**: ELK Stack, Splunk, CloudWatch Logs
- **Alerts**: PagerDuty, Opsgenie, CloudWatch Alarms
- **Dashboard**: Grafana, DataDog, CloudWatch

### Log Analysis Commands
```bash
# Real-time monitoring
tail -f /var/log/lifelink/app.log | grep 'urgent-requests'

# Count errors by type
cat /var/log/lifelink/app.log | grep 'urgent-requests' | \
  cut -d' ' -f11 | sort | uniq -c | sort -rn

# Find top consumers
grep 'urgent-requests' /var/log/lifelink/app.log | \
  cut -d' ' -f3 | sort | uniq -c | sort -rn | head -10
```

---

**Document Version**: 1.0  
**Last Updated**: May 30, 2026  
**Review Frequency**: Daily during June 1-30
