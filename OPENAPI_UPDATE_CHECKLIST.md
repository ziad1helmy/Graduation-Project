# OpenAPI Specification Update Checklist
**Phase 9 Deployment - API Documentation**

---

## Overview

The OpenAPI specification needs to be updated to reflect the removal of deprecated endpoints and addition of new features.

This document provides a checklist for manually updating `openapi.yaml`.

---

## Changes Required

### 1. Remove 4 Deprecated Endpoint Sections

**Location**: Lines 2458-2610 (approximately)

**Sections to Remove**:

#### A. `GET /donor/urgent-requests`
```yaml
  /donor/urgent-requests:
    get:
      tags:
        - Donor
      summary: Get urgent donation requests for the authenticated donor
      # ... entire section until next /donor/urgent-requests/{requestId}
```

#### B. `GET /donor/urgent-requests/{requestId}`
```yaml
  /donor/urgent-requests/{requestId}:
    get:
      tags:
        - Donor
      summary: Get details for one urgent donation request
      # ... entire section until next /donor/urgent-requests/{requestId}/accept
```

#### C. `POST /donor/urgent-requests/{requestId}/accept`
```yaml
  /donor/urgent-requests/{requestId}/accept:
    post:
      tags:
        - Donor
      summary: Accept an urgent donation request
      # ... entire section until next /donor/urgent-requests/{requestId}/decline
```

#### D. `POST /donor/urgent-requests/{requestId}/decline`
```yaml
  /donor/urgent-requests/{requestId}/decline:
    post:
      tags:
        - Donor
      summary: Decline an urgent donation request
      # ... entire section until next path
```

**How to Remove**:
1. Open `openapi.yaml` in editor
2. Go to line 2458
3. Select from `/donor/urgent-requests:` down to the line before `/requests/nearby:`
4. Delete entire section
5. Ensure no orphaned references remain

### 2. Add Deprecation Notice to Removed Endpoints

If you want to keep removed endpoints in spec as "deprecated" (optional):

**Add this note to top of spec**:
```yaml
# DEPRECATED ENDPOINTS (removed June 1, 2026)
#
# The following endpoints have been removed and will return 404:
# - GET /donor/urgent-requests
# - GET /donor/urgent-requests/{requestId}
# - POST /donor/urgent-requests/{requestId}/accept
# - POST /donor/urgent-requests/{requestId}/decline
#
# Use regular /requests endpoints with urgency parameter instead.
# Migration guide: MIGRATION_GUIDE.md
```

### 3. Enhance `/requests/nearby` Documentation

**Location**: Lines 2610+ (after removal, lines will shift up)

**Update the endpoint to document urgency filtering**:

```yaml
  /requests/nearby:
    get:
      tags:
        - Donor
      summary: Get nearby requests around the caller's coordinates
      description: |-
        Returns request records enriched with distance, hospital contact data, and map coordinates.
        
        Supports filtering by urgency level to view regular or critical requests.
        This endpoint replaces the deprecated /donor/urgent-requests endpoints.
        
        Available to: donor, hospital, admin, superadmin roles
        Request-centric (not donor-centric): returns nearby requests/hospitals
        
        Demo seed available via `npm run seed-demo`. 
        Base URL example: https://graduation-project-cy61.onrender.com
        
        MIGRATION NOTE: Urgent requests are now accessed via urgency parameter
        instead of separate endpoints. See MIGRATION_GUIDE.md for details.
      security:
        - bearerAuth: []
      parameters:
        # ... existing parameters ...
        - in: query
          name: urgency
          required: false
          schema:
            type: string
            enum:
              - low
              - medium
              - high
              - critical
          description: |-
            Filter requests by urgency level.
            - `critical` and `high` are considered urgent
            - If not specified, returns all urgency levels
            - Use `urgency=critical` to replace old /donor/urgent-requests endpoint
          example: critical
        # ... other parameters continue ...
```

### 4. Update /requests/{id} Documentation (Optional)

**Add note about replacing urgent-request details endpoint**:

```yaml
  /requests/{id}:
    get:
      tags:
        - Request
      summary: Get request details by ID
      description: |-
        Get full details for a specific request, including hospital info, 
        blood type, location, urgency level, and status.
        
        Works for all request types (urgent, regular, etc).
        This endpoint replaces /donor/urgent-requests/{requestId}.
      # ... rest of endpoint ...
```

### 5. Add Migration Notes Section

**Add to top-level spec info section**:

```yaml
info:
  title: LifeLink API
  version: 2.0
  description: |-
    Blood donation platform API
    
    ## Migration Notice (Effective June 1, 2026)
    
    Four urgent-request endpoints have been removed and consolidated:
    - ❌ GET /donor/urgent-requests → Use GET /requests/nearby?urgency=critical
    - ❌ GET /donor/urgent-requests/{id} → Use GET /requests/{id}
    - ❌ POST /donor/urgent-requests/{id}/accept → Use POST /requests/{id}/accept
    - ❌ POST /donor/urgent-requests/{id}/decline → Removed (don't respond = decline)
    
    See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for details and code examples.
```

---

## Validation Checklist

After making changes, verify the spec:

- [ ] **Syntax Valid**: `npm run validate-openapi`
  ```bash
  swagger-cli validate openapi.yaml
  ```

- [ ] **No Broken References**: Check for references to removed endpoints
  ```bash
  grep -n "/donor/urgent-requests" openapi.yaml
  # Should return 0 matches
  ```

- [ ] **All Tags Present**: Verify tags still exist
  ```bash
  grep "tags:" openapi.yaml | sort | uniq
  # Should include: Donor, Request, Hospital, Admin, Auth, etc.
  ```

- [ ] **Examples Valid**: Check JSON examples are valid
  ```bash
  npm run validate-spec-examples
  ```

- [ ] **URLs Correct**: Verify base URL examples
  ```bash
  grep -n "https://graduation-project" openapi.yaml
  # Should have valid examples
  ```

- [ ] **No Orphaned Definitions**: Check components/schemas
  ```bash
  grep "UrgentRequest:" openapi.yaml
  # May need to remove if exists
  ```

---

## Testing Checklist

After updating spec:

### 1. Swagger UI Rendering
- [ ] Open Swagger UI at `/api-docs`
- [ ] Verify page loads without errors
- [ ] Check that urgent endpoints are NOT listed
- [ ] Check that `/requests/nearby` shows urgency parameter
- [ ] Try example requests in UI (shouldn't work for removed endpoints)

### 2. Spec Validation
- [ ] Run spec validator:
  ```bash
  npm run validate-openapi
  ```
- [ ] Should return "Valid OpenAPI 3.0.x specification"

### 3. Client Generation
- [ ] Generate TypeScript client:
  ```bash
  npx openapi-generator-cli generate -i openapi.yaml -g typescript
  ```
- [ ] Check generated client doesn't include removed endpoints
- [ ] Compile client code without errors

### 4. Documentation Generation
- [ ] Regenerate API docs:
  ```bash
  npm run generate-docs
  ```
- [ ] Verify HTML output shows updated endpoints
- [ ] Check migration notes are visible

---

## Tools for OpenAPI Updates

### 1. Online Validators
- [Swagger Editor](https://editor.swagger.io/) - Paste spec, validates in real-time
- [API Doctor](https://www.getpostman.com/tools/openapi-validator/) - Validates & suggests fixes

### 2. Command Line Tools
```bash
# Install validator
npm install -g swagger-cli

# Validate spec
swagger-cli validate openapi.yaml

# Lint spec (style issues)
npx spectacle --lint openapi.yaml
```

### 3. Diff Tools
```bash
# Compare old vs new spec
diff openapi.yaml.backup openapi.yaml

# Visual diff
meld openapi.yaml.backup openapi.yaml
```

---

## Example: Complete Updated Section

After removing urgent endpoints, the paths should look like:

```yaml
paths:
  # ... auth endpoints ...
  
  /requests/nearby:
    get:
      tags:
        - Donor
      summary: Get nearby requests (updated with urgency filter)
      # ... updated description with urgency param ...
      
  /requests/{id}:
    get:
      tags:
        - Request
      summary: Get request details (replaces /donor/urgent-requests/{id})
      # ... updated description ...
    post:
      tags:
        - Request
      summary: Accept a request
      # ... unchanged ...
  
  /donor/requests:
    get:
      tags:
        - Donor
      summary: Get compatible requests for donor
      # ... unchanged ...
  
  /donor/matches:
    get:
      tags:
        - Donor
      summary: Get matching requests for donor
      # ... unchanged ...
  
  # /donor/urgent-requests* - REMOVED
  # /requests/nearby was UPDATED with urgency parameter
  
  # ... other endpoints continue ...
```

---

## Post-Update Tasks

### 1. Update Documentation Files

**Files that reference OpenAPI**:
```bash
grep -r "/donor/urgent-requests" docs/ README.md --include="*.md"
```

Update these files:
- [ ] [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)
- [ ] [README.md](./README.md)
- [ ] [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [ ] [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Already done ✓

### 2. Update Code Examples

Look for code examples in docs that use old endpoints:

**In docs/**:
```bash
grep -r "/donor/urgent-requests" docs/ --include="*.md"
```

Replace with new endpoints following migration guide format.

### 3. Update Postman/API Client Collections

If using Postman:
- [ ] Remove removed endpoints from collection
- [ ] Add urgency parameter examples to /requests/nearby
- [ ] Update any test scripts
- [ ] Export updated collection

### 4. Update SDKs

If auto-generating SDKs from OpenAPI:
- [ ] Regenerate TypeScript SDK
- [ ] Regenerate Python SDK  
- [ ] Regenerate Go SDK
- [ ] Test generated clients
- [ ] Publish new SDK versions

### 5. Update API Gateway Rules (If Applicable)

If using API Gateway (AWS, Kong, etc):
- [ ] Remove route rules for /donor/urgent-requests
- [ ] Add rate limiting if needed for new endpoints
- [ ] Verify routing still works
- [ ] Test with curl

---

## Rollback Plan

If issues found with updated spec:

### Quick Rollback
```bash
# Restore backup
cp openapi.yaml.backup openapi.yaml

# Redeploy
npm run build
```

### What to Check If Issues
1. Syntax errors - use online validator
2. Broken references - search for removed paths
3. Missing examples - verify all endpoints have examples
4. Invalid JSON in examples - use JSON validator

---

## Verification Commands

Run these to verify spec is correct:

```bash
# 1. Validate syntax
swagger-cli validate openapi.yaml

# 2. Check for removed endpoints
grep -c "/donor/urgent-requests" openapi.yaml
# Should be 0

# 3. Check urgency parameter exists
grep -n "urgency" openapi.yaml
# Should show parameter definition

# 4. Count total paths
grep "^  /" openapi.yaml | wc -l
# Should be ~50+ endpoints

# 5. Verify example URLs are valid
grep "https://graduation-project" openapi.yaml | head -5
```

---

## Common Issues & Fixes

### Issue: "No paths found starting with /"
**Cause**: Indentation error in YAML

**Fix**: Use 2-space indentation consistently
```bash
# Check indentation
cat -A openapi.yaml | grep "^  /" | head -5
```

### Issue: "Duplicate path /requests/nearby"
**Cause**: Didn't fully remove old section

**Fix**: Search for duplicates
```bash
grep -n "^  /requests/nearby" openapi.yaml
# Should appear only once
```

### Issue: "Invalid example - not valid JSON"
**Cause**: Missing quotes or commas in example

**Fix**: Validate examples online
```bash
# Extract examples
grep -A 5 "example:" openapi.yaml | grep -v "^--$"
```

---

## Sign-Off Checklist

- [ ] All 4 deprecated endpoints removed from spec
- [ ] /requests/nearby updated with urgency parameter documentation
- [ ] Spec validates without errors
- [ ] No broken references to removed endpoints
- [ ] Migration notes added to spec
- [ ] Documentation files updated
- [ ] Swagger UI renders correctly
- [ ] Generated clients compile without errors
- [ ] Backup of old spec saved

---

**Document Version**: 1.0  
**Last Updated**: May 30, 2026  
**Estimated Time**: 30 minutes to 1 hour  
**Difficulty**: Low (mostly copy-paste and search-replace)
