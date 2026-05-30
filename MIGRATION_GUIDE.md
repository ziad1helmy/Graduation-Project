# LifeLink API Migration Guide - v2.0
**Effective Date**: June 1, 2026  
**Migration Window**: 30 days (until July 1, 2026)  
**Breaking Changes**: 4 endpoints removed and consolidated

---

## Overview

The LifeLink platform is consolidating its API to remove duplicate urgent request endpoints. **Urgent requests are now handled through regular request endpoints with an `urgency` parameter.**

This document guides you through updating your client application to use the new API.

---

## What Changed

### Removed Endpoints (Now Return 404)

The following endpoints have been **permanently removed** and will return `404 Not Found`:

```
GET  /donor/urgent-requests
GET  /donor/urgent-requests/{requestId}
POST /donor/urgent-requests/{requestId}/accept
POST /donor/urgent-requests/{requestId}/decline
```

These endpoints duplicated functionality available in the regular request endpoints.

### New Recommended Approach

Use the regular request endpoints with the `urgency` parameter instead:

```
GET  /requests/nearby?urgency=critical
GET  /requests/{id}
POST /requests/{id}/accept
```

---

## Migration Checklist

- [ ] Identify all calls to removed endpoints in your code
- [ ] Update to use new endpoints (see examples below)
- [ ] Remove decline button from UI (declining is now implicit)
- [ ] Test all request flows (accept, cancel, view details)
- [ ] Deploy to production
- [ ] Monitor logs for 404 errors
- [ ] Confirm all users migrated

---

## Detailed Migration Path

### 1. GET /donor/urgent-requests → GET /requests/nearby?urgency=critical

**OLD CODE:**
```javascript
// Get urgent requests for current donor
const response = await fetch('/donor/urgent-requests', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();
const urgentRequests = data.requests;
```

**NEW CODE:**
```javascript
// Get urgent requests with high or critical urgency
const response = await fetch('/requests/nearby?urgency=critical&lat=30.0&lng=31.0', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();
const urgentRequests = data.requests;
```

**Changes:**
- Filter by `urgency=critical` instead of separate endpoint
- Must provide `lat` and `lng` for location filtering
- Response structure unchanged (still returns `requests` array)

---

### 2. GET /donor/urgent-requests/{requestId} → GET /requests/{id}

**OLD CODE:**
```javascript
// Get urgent request details
const response = await fetch(`/donor/urgent-requests/${requestId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();
const details = data.request;
```

**NEW CODE:**
```javascript
// Get request details (works for all urgency levels)
const response = await fetch(`/requests/${requestId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();
const details = data;
```

**Changes:**
- Use `/requests/{id}` instead of `/donor/urgent-requests/{id}`
- Response structure is same (returns request object)
- Works for all request types, not just urgent

---

### 3. POST /donor/urgent-requests/{requestId}/accept → POST /requests/{id}/accept

**OLD CODE:**
```javascript
// Accept an urgent request
const response = await fetch(`/donor/urgent-requests/${requestId}/accept`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ quantity: 1 })
});
const { data } = await response.json();
```

**NEW CODE:**
```javascript
// Accept any request (urgent or regular)
const response = await fetch(`/requests/${requestId}/accept`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();
```

**Changes:**
- Use `/requests/{id}/accept` instead of `/donor/urgent-requests/{id}/accept`
- No request body needed (quantity automatically determined)
- Works for all request types

---

### 4. POST /donor/urgent-requests/{requestId}/decline → REMOVED

**OLD CODE:**
```javascript
// Decline an urgent request
const response = await fetch(`/donor/urgent-requests/${requestId}/decline`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ reason: 'Not available' })
});
```

**NEW APPROACH:**
Simply don't respond to the request. It will remain visible for 30 days and then expire.

**Why Removed?**
- Explicit declines created complexity
- Non-response already indicates non-interest
- Simplifies state management

**UI Changes Needed:**
- Remove "Decline" button from urgent request screens
- Show "Found another donor" or "Not interested" → user simply navigates away
- No API call needed

---

## Impact on Your Application

### Flutter/Mobile Apps

**Old Flow:**
```
1. User views urgent requests → GET /donor/urgent-requests
2. User sees request details → GET /donor/urgent-requests/{id}
3. User accepts → POST /donor/urgent-requests/{id}/accept
4. User declines → POST /donor/urgent-requests/{id}/decline
```

**New Flow:**
```
1. User views urgent requests → GET /requests/nearby?urgency=critical
2. User sees request details → GET /requests/{id}
3. User accepts → POST /requests/{id}/accept
4. User declines → (Remove decline button, just navigate away)
```

### Web Clients

Same migration path as above - update API endpoints in your client library.

### Server-to-Server Integrations

If you're calling the API from a backend service:

**Before:**
```javascript
const urgentRequests = await fetch('/donor/urgent-requests');
```

**After:**
```javascript
const urgentRequests = await fetch('/requests/nearby?urgency=critical&lat=X&lng=Y');
```

---

## Testing Checklist

After updating your code, verify:

### Functional Tests
- [ ] Can fetch nearby requests with urgency filter
- [ ] Can fetch request details
- [ ] Can accept urgent requests
- [ ] Emergency notifications still received
- [ ] Urgent requests marked with urgency level

### Error Handling
- [ ] Old endpoints return 404 (handled gracefully)
- [ ] New endpoints return valid responses
- [ ] Error messages display correctly
- [ ] Network timeouts handled

### UI/UX Tests
- [ ] Urgent requests display correctly
- [ ] Accept button works
- [ ] No "Decline" button exists
- [ ] Emergency badges visible (if applicable)
- [ ] Priority sorting works

---

## Backward Compatibility Notes

### What Still Works ✓
- `POST /requests/{id}/accept` - Primary acceptance flow still works
- `POST /donor/respond/{requestId}` - Alternate response flow still works
- `GET /requests/nearby` - Regular nearby requests still work
- All authentication and authorization unchanged

### What Changed ⚠️
- `/donor/urgent-requests*` endpoints removed
- Decline functionality removed (simplification)
- Urgency now accessed via query parameter instead of separate endpoint

### What Never Existed ✗
- `/donor/urgent-requests/{id}/accept` was never implemented (declared in spec but no handler)
- This is why it's being removed

---

## Common Questions

### Q: Will this break my production app?
**A:** Yes, if you use the removed endpoints. Update now during the 30-day migration window.

### Q: How do I know if I'm using the old endpoints?
**A:** Look for these strings in your code:
```
/donor/urgent-requests
```
If found, you need to migrate.

### Q: What if I don't migrate by July 1?
**A:** Your app will get 404 errors when trying to use these endpoints. Users won't see urgent requests.

### Q: Can I still get urgent requests?
**A:** Yes! Use `GET /requests/nearby?urgency=critical` instead.

### Q: Why remove the decline endpoint?
**A:** To simplify the API. Users indicate non-interest by not responding. Explicit declines added complexity without much benefit.

### Q: Will my old decline tracking be lost?
**A:** No. Existing decline records are preserved in the database for analytics.

### Q: How do I update without crashing production?
**A:** 
1. Update code to use new endpoints
2. Test thoroughly in staging
3. Deploy with feature flag to gradually roll out
4. Monitor error logs during rollout

---

## Error Handling Guide

### 404 Not Found - Old Endpoint Used

**Error:**
```json
{
  "statusCode": 404,
  "message": "GET /donor/urgent-requests not found"
}
```

**Solution:** Update endpoint URL to `/requests/nearby?urgency=critical`

### 400 Bad Request - Missing Parameters

**Error:**
```json
{
  "statusCode": 400,
  "message": "lat and lng are required"
}
```

**Solution:** Add location parameters: `?lat=30.0&lng=31.0`

### 401 Unauthorized

**Error:**
```json
{
  "statusCode": 401,
  "message": "Missing or invalid JWT"
}
```

**Solution:** Ensure Authorization header is present: `Authorization: Bearer YOUR_TOKEN`

---

## Support & Questions

If you have questions during migration:

1. **Check this guide** - Most common questions answered above
2. **Review examples** - Code samples provided for each endpoint
3. **Check status page** - https://lifelink-status.example.com
4. **Contact support** - api-support@lifelink.com

---

## Timeline

| Date | Milestone |
|------|-----------|
| June 1 | Old endpoints go offline (404) |
| June 1-30 | Migration window (30 days) |
| July 1 | Support for old endpoints ends |
| July 15 | Cleanup of old endpoint code in backend |

---

## Summary

**Old Way:**
```
GET /donor/urgent-requests
GET /donor/urgent-requests/{id}
POST /donor/urgent-requests/{id}/accept
POST /donor/urgent-requests/{id}/decline
```

**New Way:**
```
GET /requests/nearby?urgency=critical
GET /requests/{id}
POST /requests/{id}/accept
(no decline - just don't respond)
```

That's it! Update your endpoints and you're done.

---

**Document Version**: 1.0  
**Last Updated**: May 30, 2026  
**Next Review**: June 15, 2026
