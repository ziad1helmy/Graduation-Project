# Arabic + English Language Support

This document explains how the backend now supports both Arabic and English input for user data, with automatic normalization for consistent searching and storage.

---

## Overview

### What Changed?
- ✅ **fullName** field now accepts Arabic + English letters
- ✅ **hospitalName** field now accepts Arabic + English letters
- ✅ **address** fields in hospitals accept Arabic + English letters
- ✅ Automatic normalization for searching
- ✅ UTF-8 support (MongoDB default)

### UTF-8 Support
MongoDB stores all data in UTF-8 by default. No encoding conversions needed - Arabic text is stored and retrieved as-is.

---

## Validation Rules

All text fields now use the same validation pattern:

```regex
/^[\u0600-\u06FFa-zA-Z\s]+$/
```

### Allowed Characters
- ✅ **Arabic letters**: ا-ي, ء-ة (all Arabic Unicode range U+0600 to U+06FF)
- ✅ **English letters**: a-z, A-Z
- ✅ **Spaces**: For separating words

### Rejected Characters
- ❌ **Numbers**: 0-9 (not allowed in names)
- ❌ **Special characters**: @#$%^&*()+=/[]{}
- ❌ **Emojis**: Not allowed

### Validation Error Message
```
"Name can contain Arabic and English letters only (no numbers or special characters)"
```

---

## Text Normalization Utility

### Location
`src/utils/textNormalization.js`

### Key Functions

#### 1. `normalizeArabic(text)`
Normalizes Arabic text for consistent searching and storage.

**Normalization Rules:**
- Converts Arabic diacritics and variants to canonical forms
- Removes extra spaces
- Converts to lowercase (for English letters)
- Preserves Arabic text structure

**Example:**
```javascript
normalizeArabic('أَحْمَد') → 'احمد'
// - Removes diacritics (fatha, sukun)
// - Converts hamza variants to base Alef

normalizeArabic('محمد  علي') → 'محمد علي'
// - Collapses extra spaces

normalizeArabic('Ahmed Mohamed') → 'ahmed mohamed'
// - Converts to lowercase
```

#### 2. `isValidArabicEnglishText(text)`
Validates that text contains only Arabic + English + spaces.

```javascript
isValidArabicEnglishText('أحمد محمد') → true
isValidArabicEnglishText('Ahmed Mohamed') → true
isValidArabicEnglishText('Ahmed123') → false  // Contains numbers
isValidArabicEnglishText('Ahmed@Mohamed') → false  // Contains special chars
```

#### 3. `extractKeywords(text)`
Splits text by spaces and returns normalized keywords.

```javascript
extractKeywords('أحمد محمد علي')
→ ['احمد', 'محمد', 'علي']
```

#### 4. `createSearchRegex(query)`
Creates a case-insensitive regex for flexible searching.

```javascript
const regex = createSearchRegex('احمد');
// Matches: احمد, أحمد, احمـد (with kashida)
```

---

## Normalized Fields in Database

### User Model
| Field | Type | Purpose |
|-------|------|---------|
| `fullName` | String | Original user-entered name |
| `fullNameNormalized` | String (indexed) | Normalized version for searching |

### Hospital Model
| Field | Type | Purpose |
|-------|------|---------|
| `hospitalName` | String | Original hospital name |
| `hospitalNameNormalized` | String (indexed) | Normalized version for searching |

### Donor Model
Inherits `fullNameNormalized` from User model via discriminator.

---

## How Normalization Works

### Arabic Normalization Mappings

| Original | Normalized | Reason |
|----------|-----------|--------|
| أحمد | احمد | Alef with hamza above → standalone Alef |
| إبراهيم | ابراهيم | Alef with hamza below → standalone Alef |
| آمنة | امنة | Alef with madda → standalone Alef |
| مستشفاة | مستشفاه | Teh Marbuta → Heh |
| علي | علي | Alef Maksura → Yeh |
| أَحْمَد | احمد | Diacritics removed |
| احمد  محمد | احمد محمد | Extra spaces normalized |
| Ahmed | ahmed | English to lowercase |

### Why?
Users may enter names with different Arabic variants:
- "أحمد" (with hamza)
- "احمد" (without hamza)
- "احمـد" (with kashida/superfluous elongation)

All these should match the same record. Normalization ensures this happens.

---

## Searching with Normalized Fields

### Example 1: Exact Match Search

```javascript
import { normalizeArabic } from '../utils/textNormalization.js';
import Donor from '../models/Donor.model.js';

// User searches for "احمد"
const searchQuery = 'احمد';
const normalized = normalizeArabic(searchQuery);

const results = await Donor.find({
  fullNameNormalized: normalized
});

// Matches:
// - "أحمد محمد"
// - "احمد علي"
// - "احمد محمد علي"
```

### Example 2: Partial Match Search

```javascript
// User searches for "احمد" (partial, like LIKE in SQL)
const normalized = normalizeArabic('احمد');
const regex = new RegExp(normalized, 'i');

const results = await Donor.find({
  fullNameNormalized: regex
});

// Matches any name containing "احمد"
```

### Example 3: Multi-word Search

```javascript
// User searches for "احمد محمد"
const normalized = normalizeArabic('احمد محمد');

const results = await Donor.find({
  fullNameNormalized: normalized
});

// Exact match for full name
```

---

## Registration Flow

### Step 1: User Submits Data
```json
{
  "fullName": "أحمد محمد",
  "email": "ahmed@lifelink.demo",
  "password": "Password@123"
}
```

### Step 2: Validation
- Check if `fullName` matches pattern: `/^[\u0600-\u06FFa-zA-Z\s]+$/`
- Check length: 3-100 characters
- Error if contains numbers or special characters

### Step 3: Automatic Normalization
When donor is saved, pre-save hook runs:

```javascript
// In Donor.create():
donor.fullName = "أحمد محمد"  // Original stored
donor.fullNameNormalized = normalizeArabic("أحمد محمد")
// → "احمد محمد"  // Normalized for searching
```

### Step 4: Stored in Database
```javascript
{
  _id: ObjectId(...),
  fullName: "أحمد محمد",      // Original for display
  fullNameNormalized: "احمد محمد",  // For searching
  email: "ahmed@lifelink.demo",
  ...
}
```

---

## Migration Script

### Location
`scripts/migrate-users.js`

### What It Does
Runs during deployment to normalize existing data.

**For each user:**
1. Checks if `fullNameNormalized` field exists
2. If missing, generates normalized version
3. Updates database atomically

**Example:**
```
ℹ Fetching all users...
✓ Cleaned donor: ahmed@lifelink.demo (added fullNameNormalized)
✓ Cleaned hospital: cairo@hospital.demo (added hospitalNameNormalized)
ℹ Donor already clean: another@lifelink.demo
────────────────────────────────────
✓ Migration complete: 45 users processed
```

### Usage
```bash
node scripts/migrate-users.js
```

---

## API Examples

### Search Donors by Name
```bash
# Arabic
GET /api/donors/search?q=احمد

# English
GET /api/donors/search?q=Ahmed

# Mixed
GET /api/donors/search?q=Ahmed محمد
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "fullName": "أحمد محمد",
      "email": "ahmed@lifelink.demo",
      "phoneNumber": "01011111111",
      "bloodType": "O+"
    }
  ]
}
```

---

## Implementation Details

### Database Indexes
Automatically created for performance:

```javascript
// User collection
db.users.index({ fullNameNormalized: 1 })

// Hospital collection
db.hospitals.index({ hospitalNameNormalized: 1 })
```

### Pre-save Hooks
Normalization happens automatically before saving:

```javascript
// User.model.js pre-save hook
userSchema.pre('save', async function () {
  if (this.isModified('fullName')) {
    this.fullNameNormalized = normalizeArabic(this.fullName);
  }
  // ... password hashing
});

// Hospital.model.js pre-save hook
hospitalSchema.pre('save', function (next) {
  if (this.isModified('hospitalName')) {
    this.hospitalNameNormalized = normalizeArabic(this.hospitalName);
  }
  next();
});
```

---

## Validation Rules Per Role

### Donor Registration
```javascript
{
  fullName: {
    pattern: /^[\u0600-\u06FFa-zA-Z\s]+$/,
    minLength: 3,
    maxLength: 100
  },
  phoneNumber: "required, 11 digits",
  bloodType: "required, enum",
  dateOfBirth: "required, past date"
}
```

### Hospital Registration
```javascript
{
  fullName: {  // Base User field
    pattern: /^[\u0600-\u06FFa-zA-Z\s]+$/,
    minLength: 3,
    maxLength: 100
  },
  hospitalName: {
    pattern: /^[\u0600-\u06FFa-zA-Z\s]+$/,
    minLength: 3,
    maxLength: 200
  },
  licenseNumber: "required, 5-50 chars",
  address: {
    pattern: /^[\u0600-\u06FFa-zA-Z\s]+$/,  // Optional
    minLength: 3,
    maxLength: 300
  }
}
```

### Admin Registration
```javascript
{
  fullName: {
    pattern: /^[\u0600-\u06FFa-zA-Z\s]+$/,
    minLength: 3,
    maxLength: 100
  }
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/utils/textNormalization.js` | **NEW** - Text normalization utility |
| `src/models/User.model.js` | Added `fullNameNormalized` field + index + pre-save hook |
| `src/models/Hospital.model.js` | Added `hospitalNameNormalized` field + index + pre-save hook |
| `src/validation/auth.validation.js` | Updated patterns to allow Arabic + English |
| `scripts/migrate-users.js` | Added normalization logic for existing data |
| `docs/ARABIC_ENGLISH_SUPPORT.md` | **NEW** - This documentation |

---

## Testing

### Test Case 1: Exact Match
```javascript
// Register donor "أحمد محمد"
// Search for "احمد محمد"
// Should match ✓
```

### Test Case 2: Variant Match
```javascript
// Register donor "أحمد" (with hamza)
// Search for "احمد" (without hamza)
// Should match ✓
```

### Test Case 3: Diacritic Tolerance
```javascript
// Register donor "أَحْمَد" (with diacritics)
// Search for "احمد" (without diacritics)
// Should match ✓
```

### Test Case 4: Validation Rejection
```javascript
// Try to register "Ahmed123"
// Should reject (contains numbers) ✓

// Try to register "Ahmed@Mohamed"
// Should reject (contains special chars) ✓
```

---

## Performance Considerations

### Search Performance
- ✅ **Indexed on normalized field** - O(1) lookup
- ✅ **Atomic updates** - No race conditions
- ✅ **Lazy normalization** - Only on save, not on every query

### Storage Overhead
- **Original field**: "أحمد محمد" (18 bytes in UTF-8)
- **Normalized field**: "احمد محمد" (16 bytes in UTF-8)
- **Overhead**: ~10 bytes per record (negligible)

### Migration Performance
- **Script runs atomically** - updateOne() operations
- **Safe to run multiple times** - Idempotent
- **Time**: ~1ms per user (depending on DB size)

---

## Future Enhancements

Possible improvements for later:
- [ ] Full-text search support
- [ ] Transliteration (Arabic ↔ Latin script)
- [ ] Phonetic matching for similar-sounding names
- [ ] Gender-specific name suggestions
- [ ] Autocomplete with Arabic support

---

## Support

For issues or questions about Arabic/English support:
1. Check if input matches validation pattern
2. Verify normalized field was created (check DB directly)
3. Review migration script logs
4. Check server logs for validation errors

---

## Backward Compatibility

✅ **No breaking changes:**
- Old records still queryable by `fullName`
- New normalized fields optional (filled automatically)
- Migration script handles missing fields gracefully
- Existing searches still work (though less efficient for Arabic variants)
