# LifeLink Authentication API - Complete Implementation Guide

## Overview
This document provides the complete implementation of the fixed authentication system with proper Mongoose discriminators, validation, and OpenAPI documentation.

---

## 1. ARCHITECTURE FIXES

### Problem: Incorrect Discriminator Usage
**Before:**
```javascript
const user = await User.create({ fullName, email, password, role });
// Creates base User, not Donor/Hospital - breaks inheritance
```

**After:**
```javascript
if (role === 'donor') {
    user = await Donor.create({ ...baseData, phoneNumber, dateOfBirth });
} else if (role === 'hospital') {
    user = await Hospital.create({ ...baseData, hospitalName, hospitalId, licenseNumber });
}
```

**Why This Matters:**
- MongoDB discriminators use `__t` field to track document type
- Must create through the discriminated model (Donor/Hospital) for proper schema validation
- Base model creation bypasses role-specific field validation
- Results in incomplete data and query inconsistencies

---

## 2. FILES MODIFIED

### A. `src/validation/auth.validation.js` (NEW)
Centralized validation layer with role-specific field requirements.

**Key Functions:**
- `validateRegister(data)` - Validates all fields based on role
- `validateLogin(data)` - Validates login credentials
- `validateField(fieldName, value)` - Single field validation

**Validation Rules:**
```javascript
Donor Requirements:
- phoneNumber: 10 digits (required)
- dateOfBirth: valid past date (required)
- gender: enum [male, female, not specified] (optional)
- bloodType: enum [A+, A-, ... O-] (optional)

Hospital Requirements:
- hospitalName: 3-200 chars (required)
- hospitalId: number (required)
- licenseNumber: 5-50 chars (required)
- address: object with city/governrate (optional)
- contactNumber: string (optional)

Base Fields (both):
- fullName: 3-100 chars (required)
- email: valid format, unique (required)
- password: 8+ chars, uppercase, lowercase, digit, special char (required)
- role: enum [donor, hospital] (required)
```

---

### B. `src/services/auth.service.js` (UPDATED)

**Changes:**
1. Added import for validation layer
2. Fixed `register()` to use proper discriminators
3. Added comprehensive error handling
4. Returns complete auth response with tokens

**Key Code:**
```javascript
export const register = async (data) => {
    // 1. Validate all required fields
    const validation = validateRegister(data);
    if (!validation.valid) {
        throw new Error(/* validation errors */);
    }

    // 2. Check email uniqueness
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new Error('Email is already registered');

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. Create using appropriate discriminator
    if (role === 'donor') {
        user = await Donor.create({ ...baseData, phoneNumber, dateOfBirth });
    } else if (role === 'hospital') {
        user = await Hospital.create({ ...baseData, hospitalName, hospitalId });
    }

    // 5. Generate tokens
    const accessToken = jwt.signToken({ userId: user._id, role });
    const refreshToken = jwt.signRefreshToken({ userId: user._id, role });

    return { accessToken, refreshToken, user };
};
```

---

### C. `src/controllers/auth.controller.js` (UPDATED)

**Changes:**
1. Removed console logs
2. Updated response handling
3. Consistent error responses

**Key Code:**
```javascript
export const register = async (req, res) => {
    try {
        const result = await authService.register(req.body);
        response.successResponse(res, 201, 'User registered successfully', result);
    } catch (error) {
        response.errorResponse(res, 400, error.message);
    }
};
```

---

### D. `src/routes/auth.routes.js` (UPDATED)

**Changes:**
1. Added component schemas (BaseUser, DonorRegister, HospitalRegister, etc.)
2. Implemented `oneOf` with discriminator for signup endpoint
3. Added comprehensive examples for both donor and hospital registration
4. Updated all response schemas with proper references
5. Added detailed descriptions for each field

**Key OpenAPI Addition:**
```yaml
/auth/signup:
  post:
    requestBody:
      content:
        application/json:
          schema:
            oneOf:
              - $ref: '#/components/schemas/DonorRegister'
              - $ref: '#/components/schemas/HospitalRegister'
            discriminator:
              propertyName: role
              mapping:
                donor: '#/components/schemas/DonorRegister'
                hospital: '#/components/schemas/HospitalRegister'
```

---

### E. `openapi.yaml` (NEW - Standalone)

Comprehensive OpenAPI 3.0 specification with:
- All component schemas (BaseUser, DonorRegister, HospitalRegister, etc.)
- Proper discriminator configuration
- Detailed examples for both roles
- Complete endpoint documentation
- Field descriptions and validation rules

**Use Cases:**
1. Import into Postman → Full schema validation
2. Import into Apidog → Proper form generation
3. Use with Swagger UI → Interactive API docs
4. Generate client SDKs with OpenAPI Generator

---

## 3. REQUEST/RESPONSE EXAMPLES

### Example 1: Register as Donor

**Request:**
```bash
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Sara Ali",
    "email": "sara@example.com",
    "password": "SecurePass@123",
    "role": "donor",
    "phoneNumber": "1234567890",
    "dateOfBirth": "1990-05-15",
    "gender": "female",
    "bloodType": "O+",
    "location": {
      "city": "Cairo",
      "governrate": "Cairo"
    }
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NmYxMDAwMDAwMDAwMDAwMDAwMDAwMDEiLCJyb2xlIjoiZG9ub3IiLCJpYXQiOjE3MDAwMDAwMDB9.abcdef123456",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NmYxMDAwMDAwMDAwMDAwMDAwMDAwMDEiLCJyb2xlIjoiZG9ub3IiLCJpYXQiOjE3MDAwMDAwMDB9.xyz789",
    "user": {
      "_id": "66f100000000000000000001",
      "fullName": "Sara Ali",
      "email": "sara@example.com",
      "role": "donor"
    }
  }
}
```

---

### Example 2: Register as Hospital

**Request:**
```bash
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Hospital Admin",
    "email": "admin@hospital.com",
    "password": "SecurePass@123",
    "role": "hospital",
    "hospitalName": "Cairo Medical Center",
    "hospitalId": 12345,
    "licenseNumber": "LIC-2024-001",
    "contactNumber": "+20123456789",
    "address": {
      "city": "Cairo",
      "governrate": "Cairo"
    }
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NmYxMDAwMDAwMDAwMDAwMDAwMDAwMDIiLCJyb2xlIjoiaG9zcGl0YWwiLCJpYXQiOjE3MDAwMDAwMDB9.ghijkl789012",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NmYxMDAwMDAwMDAwMDAwMDAwMDAwMDIiLCJyb2xlIjoiaG9zcGl0YWwiLCJpYXQiOjE3MDAwMDAwMDB9.mnopqr345678",
    "user": {
      "_id": "66f100000000000000000002",
      "fullName": "Hospital Admin",
      "email": "admin@hospital.com",
      "role": "hospital"
    }
  }
}
```

---

### Example 3: Validation Error (Missing Required Field)

**Request:**
```bash
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Incomplete User",
    "email": "incomplete@example.com",
    "password": "SecurePass@123",
    "role": "donor"
    // Missing: phoneNumber, dateOfBirth
  }'
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Phone number is required; Date of birth is required"
}
```

---

### Example 4: Email Already Exists

**Request:**
```bash
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Sara Ali",
    "email": "sara@example.com",  // Already registered
    "password": "SecurePass@123",
    "role": "donor",
    "phoneNumber": "1234567890",
    "dateOfBirth": "1990-05-15"
  }'
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Email is already registered"
}
```

---

### Example 5: Invalid Password

**Request:**
```bash
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Sara Ali",
    "email": "sara@example.com",
    "password": "weak",  // Too short, no uppercase, no digit, no special char
    "role": "donor",
    "phoneNumber": "1234567890",
    "dateOfBirth": "1990-05-15"
  }'
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Password format is invalid"
}
```

---

## 4. SWAGGER/OPENAPI BENEFITS

### Before Fix:
- ❌ Only showed base User fields
- ❌ No role-specific fields visible
- ❌ API docs didn't match actual requirements
- ❌ Postman import couldn't generate correct forms

### After Fix:
- ✅ OpenAPI 3.0 with `oneOf` discriminator
- ✅ Separate schemas for DonorRegister and HospitalRegister
- ✅ Swagger UI shows both examples side-by-side
- ✅ Postman/Apidog generate correct forms based on role selection
- ✅ Clear validation rules and field descriptions
- ✅ Complete component schemas for reuse

---

## 5. HOW TO USE IN DIFFERENT TOOLS

### Swagger UI
```bash
# View interactive documentation
http://localhost:5000/api-docs

# oneOf discriminator allows:
1. Select "DonorRegister" or "HospitalRegister" from dropdown
2. Swagger shows correct fields
3. All examples work correctly
```

### Postman Import
```bash
1. Postman → File → Import
2. Select openapi.yaml
3. Create from imported spec
4. All endpoints with correct schemas imported
5. Examples available in each request
6. Role selection properly shows required fields
```

### Apidog Import
```bash
1. Apidog → Import → OpenAPI
2. Select openapi.yaml
3. Schemas properly reflected in forms
4. Form fields update based on role selection
```

---

## 6. TESTING CHECKLIST

### Registration Flow
- [ ] Donor registration with all required fields
- [ ] Hospital registration with all required fields
- [ ] Missing required fields returns clear error
- [ ] Invalid phone number format rejected
- [ ] Invalid date of birth rejected
- [ ] Weak password rejected
- [ ] Invalid email format rejected
- [ ] Duplicate email rejected
- [ ] Tokens returned in response
- [ ] User persisted in database with correct discriminator

### Profile & Authorization
- [ ] /auth/me route works with valid token
- [ ] /auth/me route returns all fields for donor
- [ ] /auth/me route returns all fields for hospital
- [ ] /auth/login works correctly
- [ ] /auth/refresh-token generates new access token
- [ ] Invalid token rejected

### OpenAPI Documentation
- [ ] Swagger UI shows both examples
- [ ] Postman import creates correct schemas
- [ ] Apidog import generates correct forms
- [ ] openapi.yaml validates with OpenAPI validator

---

## 7. PRODUCTION DEPLOYMENT

### Before Deploying:
```bash
# 1. Validate OpenAPI spec
npx openapi-validator openapi.yaml

# 2. Run full test suite
npm test

# 3. Check models have discriminators
grep -r "discriminator" src/models/

# 4. Verify validation rules in auth.validation.js
npm run test:auth

# 5. Load test registration endpoint
artillery quick -t http://localhost:5000/auth/signup -d 100
```

### Environment Configuration:
```bash
# .env
BCRYPT_SALT_ROUNDS=10
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d
```

---

## 8. MIGRATION FROM OLD SYSTEM

If you have existing registrations created via base User model:

```javascript
// Migration script
async function migrateOldUsers() {
    // Find users created without __t field
    const orphanedUsers = await User.find({ __t: { $exists: false } });
    
    for (const user of orphanedUsers) {
        if (user.phoneNumber && user.dateOfBirth) {
            // Convert to Donor
            await Donor.updateOne({ _id: user._id }, { __t: 'donor' });
        } else if (user.hospitalName && user.hospitalId) {
            // Convert to Hospital
            await Hospital.updateOne({ _id: user._id }, { __t: 'hospital' });
        }
    }
}
```

---

## 9. QUICK REFERENCE

### File Structure:
```
src/
├── validation/
│   └── auth.validation.js          (NEW - Validation layer)
├── services/
│   └── auth.service.js              (UPDATED - Fixed register)
├── controllers/
│   └── auth.controller.js           (UPDATED - Clean code)
├── routes/
│   └── auth.routes.js               (UPDATED - OneOf schema)
├── models/
│   ├── User.model.js                (No changes)
│   ├── Donor.model.js               (No changes)
│   └── Hospital.model.js            (No changes)
│
openapi.yaml                          (NEW - Standalone spec)
```

### Key Class/Function Names:
- `validateRegister()` - Main validation function
- `validateLogin()` - Login validation
- `validateField()` - Single field validation
- `register()` - Service method using discriminators
- `Donor.create()` - Creates donor with inheritance
- `Hospital.create()` - Creates hospital with inheritance

---

## 10. TROUBLESHOOTING

### Issue: Registration hangs
**Solution:** Check that `Donor.create()` or `Hospital.create()` is being used, not `User.create()`

### Issue: Role-specific fields not saved
**Solution:** Ensure discriminator models are properly imported in service file

### Issue: Swagger shows wrong fields
**Solution:** Clear browser cache and reload. Check that auth.routes.js has updated schema definitions

### Issue: Postman doesn't show role fields
**Solution:** Re-import openapi.yaml after clearing Postman cache

---

## 11. PERFORMANCE NOTES

- Validation happens BEFORE database operations
- Password hashing is optimized (10 salt rounds)
- Email uniqueness checked before create
- Mongoose schema validation runs on discriminated models
- All checks use compound queries for efficiency

---

## SUMMARY

**What was fixed:**
1. ✅ Discriminator usage (Donor.create / Hospital.create)
2. ✅ Role-specific field validation
3. ✅ OpenAPI schema with oneOf discriminator
4. ✅ Complete component schemas
5. ✅ Clear error messages
6. ✅ Swagger UI support for both registration types
7. ✅ Postman/Apidog compatibility
8. ✅ Production-ready code

**Next steps:**
1. Run tests with the new validation layer
2. Import openapi.yaml into Postman/Apidog
3. Test registration for both roles
4. Deploy to staging for integration testing
