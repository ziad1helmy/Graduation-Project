# API Consumer Notification Template

**Subject:** Important: LifeLink API Update - Migration Required by July 1, 2026

---

Dear LifeLink API Consumers,

We're writing to inform you about important changes to the LifeLink API that require your attention.

## What's Happening

We are consolidating the LifeLink API to provide a cleaner, more consistent interface. **Four urgent-request endpoints are being removed** and their functionality is being merged into the regular request endpoints.

**Affected Endpoints (Retiring June 1, 2026):**
- `GET /donor/urgent-requests`
- `GET /donor/urgent-requests/{requestId}`
- `POST /donor/urgent-requests/{requestId}/accept`
- `POST /donor/urgent-requests/{requestId}/decline`

**What This Means for You:**

If your application uses any of the above endpoints, **you must update your code by June 30, 2026** to avoid 404 errors and application failures.

## How to Migrate

### Quick Start

Replace urgent-request endpoints with regular request endpoints using the `urgency` parameter:

**Before (Old API):**
```javascript
GET /donor/urgent-requests
```

**After (New API):**
```javascript
GET /requests/nearby?urgency=critical&lat=30.0&lng=31.0
```

### See the Full Migration Guide

We've created a detailed **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** with:
- Code examples for each endpoint change
- Step-by-step migration instructions
- Testing checklist
- Common questions and answers

## Timeline

| Date | Event |
|------|-------|
| **June 1** | Old endpoints stop working (return 404) |
| **June 1-30** | 30-day migration window |
| **July 1** | Support for old endpoints ends |

## Why These Changes?

The refactor improves the API by:
- ✅ **Reducing complexity** - Fewer, cleaner endpoints
- ✅ **Improving consistency** - All requests handled uniformly
- ✅ **Fixing bugs** - Missing eligibility checks now enforced
- ✅ **Better UX** - Simplified decline flow

## Resources

- 📖 **Migration Guide**: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- 📋 **API Documentation**: [/docs/API_REFERENCE.md](./docs/API_REFERENCE.md)
- 🔧 **Examples**: See code examples in migration guide
- 💬 **Support**: api-support@lifelink.com

## Do You Need Help?

If you have questions:

1. **Check the migration guide** - Most common questions are answered there
2. **Review the code examples** - Each endpoint has before/after code
3. **Contact us** - Email api-support@lifelink.com for specific issues

## Key Points to Remember

✅ **You must update your code** - Old endpoints will return 404  
✅ **30-day migration window** - June 1-30, 2026  
✅ **No additional authentication needed** - Auth tokens work the same  
✅ **New endpoints available now** - You can start migrating immediately  
✅ **Support available** - We're here to help  

## For Existing Users

If you're using these endpoints:
- `POST /requests/{id}/accept` - ✅ **No changes needed**
- `POST /donor/respond/{requestId}` - ✅ **No changes needed**
- `GET /requests/nearby` - ✅ **No changes needed** (now has better filtering)

## FAQ

**Q: Will this break my app?**  
A: Yes, if you use the removed endpoints. Update during the 30-day window.

**Q: How much work is the migration?**  
A: Usually 1-2 hours depending on your codebase size.

**Q: Can I test the new endpoints now?**  
A: Yes! They're available immediately. Test while old endpoints still work.

**Q: What if I can't migrate in time?**  
A: Your app will get 404 errors. Contact us ASAP if you need an extension.

---

## Next Steps

1. **Read the migration guide**: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
2. **Identify affected endpoints** in your code
3. **Update to new endpoints** using the provided examples
4. **Test in staging** to verify everything works
5. **Deploy to production** before July 1

---

## Contact Information

**API Support**: api-support@lifelink.com  
**Documentation**: https://docs.lifelink.com  
**Status Page**: https://lifelink-status.example.com  

We're here to help make this transition smooth!

---

**LifeLink Team**  
May 30, 2026

---

## Email Sending Instructions

### To Send This Email

1. **Add to mailing list**: Get list of all API token holders from database
2. **Personalize**: Add customer name, account info if available
3. **Send via**: Use official company email account
4. **Timing**: Send 30 days before cutoff (now, on June 1)
5. **Follow-up**: Send reminder on June 15, June 25

### Email Distribution List

```sql
-- Get all active API token holders (customize for your system)
SELECT email, organization_name, created_at 
FROM api_tokens 
WHERE status = 'active' 
AND created_at > DATE_SUB(NOW(), INTERVAL 6 MONTH)
GROUP BY email;
```

### Follow-up Email (June 15)

**Subject:** [REMINDER] LifeLink API Migration - 16 Days Left

"Hi,

This is a friendly reminder that the LifeLink API endpoints listed below will stop working on July 1, 2026:
- GET /donor/urgent-requests
- GET /donor/urgent-requests/{requestId}
- POST /donor/urgent-requests/{requestId}/accept
- POST /donor/urgent-requests/{requestId}/decline

You have **16 days** to migrate to the new endpoints.

[Include migration guide link and support contact]"

### Final Email (June 25)

**Subject:** [URGENT] LifeLink API Migration - 6 Days Left

"Hi,

This is the final reminder before the old API endpoints stop working on July 1, 2026.

If you haven't migrated yet:
1. Review: [MIGRATION_GUIDE.md]
2. Update: Your endpoint URLs
3. Test: In staging environment
4. Deploy: Before July 1

[Include migration guide link and support contact]"

---

## Alternative: In-App Notification

If emailing all consumers is not feasible, add a banner to the developer portal:

```html
<div class="alert alert-warning">
  <strong>⚠️ API Migration Required</strong>
  <p>Four endpoints are retiring June 1. <a href="/migration-guide">Learn how to migrate</a></p>
  <button class="close">×</button>
</div>
```

Show to users who have active API tokens using removed endpoints.
