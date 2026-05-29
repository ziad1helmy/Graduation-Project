# LifeLink Donor Eligibility Rules

> All eligibility logic lives in `src/services/eligibility.service.js`.

---

## Overview

Before a donor can respond to a blood request, they must pass a series of eligibility rules. Rules are evaluated sequentially — the first failing rule short-circuits the chain and returns the reason.

```javascript
// Called from: donation.service.validateEligibility()
// Which is called from: donor.controller.respondToRequest()
//                       donor.controller.getDonationEligibility()

canDonate(donor, { donationType: request.type })
  → returns { eligible: boolean, reason: string, nextEligibleDate?: Date }
```

---

## Rule Pipeline

Rules are evaluated in this order:

### Rule 1: Minimum Age (17 years)

```
calculateAge(donor.dateOfBirth) < 17 → INELIGIBLE
```

- Uses `dateOfBirth` field (required for donors)
- Returns `nextEligibleDate` = the donor's 17th birthday if they fail

### Rule 2: Temporary Deferral

```
donor.temporaryDeferralUntil !== null
  AND now < temporaryDeferralUntil → INELIGIBLE
```

- Set by admin (e.g., after a medical event or travel deferral auto-applied)
- `lastDeferralReason` is returned as the failure reason
- Returns `nextEligibleDate` = `temporaryDeferralUntil`

### Rule 3: Travel to High-Risk (Malaria) Country

```
for each entry in donor.travelHistory:
  if entry.country IN malariaRiskCountries:
    deferralUntil = entry.returnDate + 28 days
    if deferralUntil > now → INELIGIBLE
```

- Country list loaded from `src/data/malariaRiskCountries.json` (static, loaded once on startup)
- Country matching is case-insensitive, trimmed string comparison
- If deferred by travel: `donor.temporaryDeferralUntil` is automatically set and persisted (if `persistTravelDeferral = true`)
- Returns `nextEligibleDate` = latest deferral expiry date among all at-risk countries visited

### Rule 4: Donation Interval

```
requiredInterval = COOLDOWN_DAYS_BY_TYPE[donationType] OR GENDER_DONATION_INTERVAL_DAYS[gender] OR 56
nextEligibleDate = donor.lastDonationDate + requiredInterval days
if nextEligibleDate > now → INELIGIBLE
```

**Cooldown periods by donation type:**

| Donation Type | Cooldown (Days) |
|--------------|----------------|
| blood | 56 |
| plasma | 14 |
| platelets | 7 |

**Gender-based fallback** (when no type specified):

| Gender | Interval |
|--------|---------|
| male | 84 |
| female | 112 |
| (default) | 56 |

Priority: type-based cooldown → gender-based → default 56 days

### Rule 5: Hemoglobin Level

```
donor.hemoglobinLevel !== null
  AND donor.hemoglobinLevel < 12.5 → INELIGIBLE
```

- If `hemoglobinLevel` is null/undefined, this rule is skipped (donor assumed eligible)
- Minimum: **12.5 g/dL**

---

## Rule Result Shape

```javascript
{
  eligible: boolean,
  reason: string,              // Human-readable reason
  nextEligibleDate?: Date      // When they can next donate (if applicable)
}
```

---

## Eligibility Check Endpoint (Donor)

```
GET /donor/donations/eligibility?requestId=<id>
```

Allows donors to check their eligibility for a specific request before committing to respond. Returns:
```json
{
  "eligible": true,
  "reason": "Donor is eligible"
}
```
or:
```json
{
  "eligible": false,
  "reason": "You need to wait before donating again",
  "nextEligibleDate": "2026-07-15T00:00:00.000Z"
}
```

---

## Admin Deferral

Admins can manually set a temporary deferral on a donor via `PUT /admin/donors/:id`:

```json
{
  "temporaryDeferralUntil": "2026-08-01T00:00:00.000Z",
  "lastDeferralReason": "Post-surgical recovery"
}
```

---

## Notes

- **Missing `dateOfBirth`**: If `dateOfBirth` is null, the age rule returns `INELIGIBLE` with reason "Date of birth is required"
- **Missing `lastDonationDate`**: The interval rule is skipped (first-time donors pass automatically)
- **Empty `travelHistory`**: The travel rule is skipped
- **Rule order matters**: A suspended or deleted donor is blocked at the **auth middleware** layer, before ever reaching eligibility checks. Eligibility rules assume the user is authenticated and active.
