# Seed Credentials Reference

All passwords, emails, and keys used across the project's seed scripts.

---

## `npm run seed` — Test Accounts

| Role | Email | Password | Key / ID |
|------|-------|----------|----------|
| Donor | `donor@test.com` | `SecurePass@123` | — |
| Hospital | `hospital@test.com` | `SecurePass@123` | `TEST-HOSP-001` |

---

## `npm run seed-demo` — Demo Accounts

### Admins

| Role | Email | Password | Admin Key |
|------|-------|----------|-----------|
| Admin | `admin@lifelink.demo` | `AdminPass@123` | `ADM001` |
| Superadmin | `root@lifelink.demo` | `SuperAdminPass@123` | `SUP001` |

### Donors

| Name | Email | Password | Blood Type |
|------|-------|----------|------------|
| Aya Hassan | `aya.hassan@lifelink.demo` | `DonorPass@123` | O+ |
| Omar Nabil | `omar.nabil@lifelink.demo` | `DonorPass@123` | A- |
| Mariam Adel | `mariam.adel@lifelink.demo` | `DonorPass@123` | B+ |
| Leila Mansour | `leila.mansour@lifelink.demo` | `DonorPass@123` | AB+ |
| Noor Tarek | `noor.tarek@lifelink.demo` | `DonorPass@123` | O- |
| Yasmine Farouk | `cairo.responder@lifelink.demo` | `DonorPass@123` | O+ |
| Tarek Mahmoud | `giza.responder@lifelink.demo` | `DonorPass@123` | A- |
| Salma Kareem | `nearby.available@lifelink.demo` | `DonorPass@123` | O+ |

### Hospitals

| Name | Email | Password | Hospital ID |
|------|-------|----------|-------------|
| Cairo Care Hospital | `ops@cairocare.demo` | `HospitalPass@123` | `HOSP-CAIRO-001` |
| Nile Hope Medical Center | `bloodbank@nilehope.demo` | `HospitalPass@123` | `HOSP-GIZA-001` |

---

## `npm run seed-real-data` — Real Egypt Data

### Admins

None created (reuses existing demo admins).

### Hospitals — 20 real Egyptian hospitals from Wikidata

| # | Hospital | Email | Password | Governorate |
|---|----------|-------|----------|-------------|
| 1 | Qasr El Ayni Hospital (Cairo University) | `hospital001@lifelink.data` | `HospitalPass@123` | Cairo |
| 2 | Ain Shams University Hospital (El Demerdash) | `hospital002@lifelink.data` | `HospitalPass@123` | Cairo |
| 3 | 57357 Children's Cancer Hospital | `hospital003@lifelink.data` | `HospitalPass@123` | Cairo |
| 4 | Nasser Institute Hospital | `hospital004@lifelink.data` | `HospitalPass@123` | Cairo |
| 5 | El Sahel Teaching Hospital | `hospital005@lifelink.data` | `HospitalPass@123` | Cairo |
| 6 | Coptic Hospital | `hospital006@lifelink.data` | `HospitalPass@123` | Cairo |
| 7 | Nile Badrawi Hospital | `hospital007@lifelink.data` | `HospitalPass@123` | Cairo |
| 8 | Behman Hospital | `hospital008@lifelink.data` | `HospitalPass@123` | Cairo |
| 9 | Mansoura University Hospital | `hospital009@lifelink.data` | `HospitalPass@123` | Dakahlia |
| 10 | Alexandria University Hospital (El Shatby) | `hospital010@lifelink.data` | `HospitalPass@123` | Alexandria |
| 11 | Tanta University Hospital | `hospital011@lifelink.data` | `HospitalPass@123` | Gharbia |
| 12 | Assiut University Hospitals | `hospital012@lifelink.data` | `HospitalPass@123` | Assiut |
| 13 | Zagazig University Hospital | `hospital013@lifelink.data` | `HospitalPass@123` | Sharqia |
| 14 | Minia University Hospital | `hospital014@lifelink.data` | `HospitalPass@123` | Minia |
| 15 | Sohag University Hospitals | `hospital015@lifelink.data` | `HospitalPass@123` | Sohag |
| 16 | Aswan University Hospitals | `hospital016@lifelink.data` | `HospitalPass@123` | Aswan |
| 17 | Ismailia Medical Complex | `hospital017@lifelink.data` | `HospitalPass@123` | Ismailia |
| 18 | Shebin El-Kom Teaching Hospital | `hospital018@lifelink.data` | `HospitalPass@123` | Monufia |
| 19 | Sharm El Sheikh International Hospital | `hospital019@lifelink.data` | `HospitalPass@123` | South Sinai |
| 20 | Al Ahrar Teaching Hospital | `hospital020@lifelink.data` | `HospitalPass@123` | Sharqia |

### Donors — 100 realistic Egyptian profiles

All 100 donors use the shared password `DonorPass@123`.  
Emails follow the pattern `firstname.lastname@lifelink.demo`.

**Common password:** `DonorPass@123`

Example emails (first 5):
- `dina.mansour@lifelink.demo`
- `dina.gad@lifelink.demo`
- `amr.nour@lifelink.demo`
- `gamal.khalil@lifelink.demo`
- `raouf.rashad@lifelink.demo`

To list all donor emails after seeding, run a quick query in MongoDB:

```js
db.users.find({ role: 'donor', email: /@lifelink\.demo$/ }, { email: 1, fullName: 1 })
```

---

## Test factories (`tests/helpers/factories.js`)

Used by Vitest — not seeded to the database, but referenced here for awareness.

| Factory | Default Password | Notes |
|---------|-----------------|-------|
| `buildDonor()` / `createDonor()` | `Password123!` | Donor role |
| `createHospital()` | `TestPass@123` | Hospital role |
| `createAdmin()` | `TestPass@123` | Admin role |
