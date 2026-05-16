#!/bin/bash
# LifeLink Authentication API - cURL Examples
# Run these commands directly in your terminal

BASE_URL="http://localhost:5000"

# ============================================================================
# 1. DONOR REGISTRATION
# ============================================================================

echo "1. Register as Donor"
echo "==================="

curl -X POST $BASE_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Sara Ali",
    "email": "sara.donor@example.com",
    "password": "SecurePass@123",
    "role": "donor",
    "phoneNumber": "1234567890",
    "dateOfBirth": "1990-05-15",
    "gender": "female",
    "bloodType": "O+",
    "location": {
      "city": "Cairo",
      "governorate": "Cairo"
    }
  }'

echo -e "\n\n"

# ============================================================================
# 2. HOSPITAL REGISTRATION
# ============================================================================

echo "2. Register as Hospital"
echo "======================="

curl -X POST $BASE_URL/auth/signup \
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
      "governorate": "Cairo Governrate"
    }
  }'

echo -e "\n\n"

# ============================================================================
# 3. LOGIN - Donor
# ============================================================================

echo "3. Login as Donor"
echo "================="

# Save tokens to variables
DONOR_LOGIN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sara.donor@example.com",
    "password": "SecurePass@123"
  }')

echo "Donor Login Response:"
echo $DONOR_LOGIN | jq .

# Extract tokens
DONOR_ACCESS_TOKEN=$(echo $DONOR_LOGIN | jq -r '.data.accessToken')
DONOR_REFRESH_TOKEN=$(echo $DONOR_LOGIN | jq -r '.data.refreshToken')

echo -e "\nDonor Access Token: $DONOR_ACCESS_TOKEN"
echo "Donor Refresh Token: $DONOR_REFRESH_TOKEN"

echo -e "\n\n"

# ============================================================================
# 4. LOGIN - Hospital
# ============================================================================

echo "4. Login as Hospital"
echo "====================="

HOSPITAL_LOGIN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hospital.com",
    "password": "SecurePass@123"
  }')

echo "Hospital Login Response:"
echo $HOSPITAL_LOGIN | jq .

HOSPITAL_ACCESS_TOKEN=$(echo $HOSPITAL_LOGIN | jq -r '.data.accessToken')
HOSPITAL_REFRESH_TOKEN=$(echo $HOSPITAL_LOGIN | jq -r '.data.refreshToken')

echo -e "\nHospital Access Token: $HOSPITAL_ACCESS_TOKEN"
echo "Hospital Refresh Token: $HOSPITAL_REFRESH_TOKEN"

echo -e "\n\n"

# ============================================================================
# 5. GET CURRENT USER - Donor
# ============================================================================

echo "5. Get Current Donor Profile"
echo "============================="

curl -s -X GET $BASE_URL/auth/me \
  -H "Authorization: Bearer $DONOR_ACCESS_TOKEN" | jq .

echo -e "\n\n"

# ============================================================================
# 6. GET CURRENT USER - Hospital
# ============================================================================

echo "6. Get Current Hospital Profile"
echo "==============================="

curl -s -X GET $BASE_URL/auth/me \
  -H "Authorization: Bearer $HOSPITAL_ACCESS_TOKEN" | jq .

echo -e "\n\n"

# ============================================================================
# 7. REFRESH TOKEN
# ============================================================================

echo "7. Refresh Donor Token"
echo "======================"

curl -s -X POST $BASE_URL/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$DONOR_REFRESH_TOKEN\"
  }" | jq .

echo -e "\n\n"

# ============================================================================
# 8. VALIDATION ERROR EXAMPLES
# ============================================================================

echo "8a. Missing Required Field (Phone Number)"
echo "=========================================="

curl -s -X POST $BASE_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Incomplete User",
    "email": "incomplete@example.com",
    "password": "SecurePass@123",
    "role": "donor",
    "dateOfBirth": "1990-05-15"
  }' | jq .

echo -e "\n\n"

echo "8b. Invalid Phone Number"
echo "========================"

curl -s -X POST $BASE_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Sara Ali",
    "email": "sara2@example.com",
    "password": "SecurePass@123",
    "role": "donor",
    "phoneNumber": "123",
    "dateOfBirth": "1990-05-15"
  }' | jq .

echo -e "\n\n"

echo "8c. Invalid Date of Birth (Future Date)"
echo "========================================"

curl -s -X POST $BASE_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Sara Ali",
    "email": "sara3@example.com",
    "password": "SecurePass@123",
    "role": "donor",
    "phoneNumber": "1234567890",
    "dateOfBirth": "2025-05-15"
  }' | jq .

echo -e "\n\n"

echo "8d. Weak Password"
echo "================="

curl -s -X POST $BASE_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Sara Ali",
    "email": "sara4@example.com",
    "password": "weak",
    "role": "donor",
    "phoneNumber": "1234567890",
    "dateOfBirth": "1990-05-15"
  }' | jq .

echo -e "\n\n"

echo "8e. Invalid Email Format"
echo "======================="

curl -s -X POST $BASE_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Sara Ali",
    "email": "not-an-email",
    "password": "SecurePass@123",
    "role": "donor",
    "phoneNumber": "1234567890",
    "dateOfBirth": "1990-05-15"
  }' | jq .

echo -e "\n\n"

echo "8f. Hospital - Missing Required Hospital Fields"
echo "==============================================="

curl -s -X POST $BASE_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Hospital Admin",
    "email": "admin2@hospital.com",
    "password": "SecurePass@123",
    "role": "hospital"
  }' | jq .

echo -e "\n\n"

# ============================================================================
# 9. LOGOUT
# ============================================================================

echo "9. Logout"
echo "========="

curl -s -X POST $BASE_URL/auth/logout \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$DONOR_REFRESH_TOKEN\"
  }" | jq .

echo -e "\n\n"

# ============================================================================
# 10. FORGOT PASSWORD
# ============================================================================

echo "10. Forgot Password"
echo "==================="

curl -s -X POST $BASE_URL/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sara.donor@example.com"
  }' | jq .

echo -e "\n\n"

# ============================================================================
# NOTES
# ============================================================================

echo "=============================================="
echo "API Testing Notes:"
echo "=============================================="
echo ""
echo "1. Replace URLs with your actual server URL"
echo "2. Store tokens in variables for subsequent requests"
echo "3. Use ' jq ' to pretty-print JSON responses"
echo "4. For Windows, use 'curl' command or PowerShell equivalent"
echo ""
echo "Common password pattern:"
echo "  - At least 8 characters"
echo "  - At least one uppercase letter (A-Z)"
echo "  - At least one lowercase letter (a-z)"
echo "  - At least one digit (0-9)"
echo "  - At least one special character (@\$!%*?&)"
echo ""
echo "Phone number pattern:"
echo "  - Exactly 10 digits"
echo ""
echo "Date format:"
echo "  - YYYY-MM-DD (ISO 8601)"
echo ""
