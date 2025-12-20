# Auth & Account Module API Testing Guide

## Base URL
```
http://localhost:3000/api
```

---

## 🔐 Auth Module Tests

### 1. Patient Registration (2-Step Process)

#### Step 1: Create Basic Account
**Endpoint:** `POST /auth/register/account`  
**Auth:** None (Public)

```json
{
  "username": "patient01",
  "email": "patient01@test.com",
  "password": "Patient123"
}
```

**Expected Response:**
- Status: 201
- Account created with INCOMPLETE status
- Returns: accountId, email, username

---

#### Step 2: Complete Profile
**Endpoint:** `POST /auth/register/profile/:accountId`  
**Auth:** None (Public)

```json
{
  "fullName": "John Patient",
  "gender": "MALE"
}
```

**Expected Response:**
- Status: 201
- Account status changed to PENDING_VERIFICATION
- Returns: Complete account data with profile
- Message: "Please request verification code via POST /mailer/send-verification-code"
- ⚠️ **No automatic email sent** - user must manually request code

---

#### Step 3: Request Verification Code
**Endpoint:** `POST /mailer/send-verification-code`  
**Auth:** None (Public)

```json
{
  "email": "patient01@test.com"
}
```

**Expected Response:**
- Status: 200
- Verification code sent to email
- Code expires in 10 minutes

---

### 2. Login
**Endpoint:** `POST /auth/login`  
**Auth:** None (Public)

```json
{
  "email": "patient01@test.com",
  "password": "Patient123"
}
```

**Expected Response:**
- Status: 200
- Returns: access_token, userId, user data
- ❌ Should fail if account status is INCOMPLETE
- ❌ Should fail if account status is PENDING_VERIFICATION (email not verified)

---

### 3. Email Verification
**Endpoint:** `POST /auth/verify-email`  
**Auth:** None (Public)

```json
{
  "email": "patient01@test.com",
  "code": "123456"
}
```

**Expected Response:**
- `isEmailVerified = true`
- Account status changed from PENDING_VERIFICATION to ACTIVE
- Welcome email sent automatically
- User can now login

**Error Cases:**
- ❌ 404: User not found
- ❌ 409: Email already verified
- ❌ 401: Invalid or expired code
- ❌ 401: Code already used
- New verification code sent to email

---

### 5. Forgot Password
**Endpoint:** `POST /auth/forgot-password`  
**Auth:** None (Public)

```json
{
  "email": "patient01@test.com"
}
```

**Expected Response:**
- Status: 200
- Password reset code sent to email

---

### 6. Reset Password
**Endpoint:** `POST /auth/reset-password`  
**Auth:** None (Public)

```json
{
  "email": "patient01@test.com",
  "code": "123456",
  "newPassword": "NewPassword123"
}
```

**Expected Response:**
- Status: 200
- Password successfully reset

---

## 🏥 Clinic Manager Flow

### 7. Register Clinic Manager (PATIENT → CLINIC_MANAGER)
**Endpoint:** `POST /auth/register-clinic-manager`  
**Auth:** Required (Bearer Token - PATIENT only)  
**Headers:** `Authorization: Bearer <patient_token>`

```json
{
  "username": "clinic01",
  "email": "clinic01@test.com",
  "password": "Clinic123",
  "fullName": "Clinic Manager",
  "phone": "0123456789",
  "clinicName": "Happy Clinic",
  "description": "Best clinic in town"
}
```

**Expected Response:**
- Status: 201
- CLINIC_MANAGER account created
- Includes clinic information

**Prerequisites:**
- User must be logged in as PATIENT
- TODO: Must have purchased clinic service

---

### 8. Add Staff by Manager
**Endpoint:** `POST /auth/clinic-manager/add-staff`  
**Auth:** Required (Bearer Token - CLINIC_MANAGER only)  
**Headers:** `Authorization: Bearer <manager_token>`

```json
{
  "email": "staff01@clinic.com",
  "password": "Staff123",
  "fullName": "Jane Staff",
  "gender": "FEMALE",
  "clinicRole": "RECEPTIONIST"
}
```

**Expected Response:**
- Status: 201
- CLINIC_STAFF account created with INCOMPLETE status
- Staff linked to manager via parentId
- Staff must complete profile before login

---

### 9. Add Doctor by Manager
**Endpoint:** `POST /auth/clinic-manager/add-doctor`  
**Auth:** Required (Bearer Token - CLINIC_MANAGER only)  
**Headers:** `Authorization: Bearer <manager_token>`

```json
{
  "email": "doctor01@clinic.com",
  "password": "Doctor123",
  "fullName": "Dr. John Smith",
  "gender": "MALE",
  "academicDegree": "MD, PhD",
  "experience": "10 years in cardiology",
  "position": "Chief Cardiologist"
}
```

**Expected Response:**
- Status: 201
- DOCTOR account created with INCOMPLETE status
- Doctor linked to manager via parentId
- Doctor must complete profile before login

---

## 👤 Account Module Tests

### 10. Get All Accounts
**Endpoint:** `GET /accounts`  
**Auth:** Required (Bearer Token - ADMIN recommended)  
**Headers:** `Authorization: Bearer <token>`

**Query Params:** `?includeDeleted=false`

**Expected Response:**
- Status: 200
- Returns: Array of all accounts with profiles

---

### 11. Get Account by ID
**Endpoint:** `GET /accounts/:id`  
**Auth:** Required (Bearer Token)  
**Headers:** `Authorization: Bearer <token>`

**Expected Response:**
- Status: 200
- Returns: Account details with profile information

---

### 12. Update Account Profile
**Endpoint:** `PATCH /accounts/:id`  
**Auth:** Required (Bearer Token - Own account or ADMIN)  
**Headers:** `Authorization: Bearer <token>`

```json
{
  "fullName": "John Updated Patient",
  "phone": "0987654321",
  "dateOfBirth":UT /accounts/:id`  
**Auth:** Required (Bearer Token - Own account or ADMIN)  
**Headers:** `Authorization: Bearer <token>`

```json
{
  "fullName": "John Updated Patient",
  "phone": "0987654321",
  "dob": "1990-01-01",
  "gender": "MALE"
}
```

**Expected Response:**
- Status: 200
- Returns: Updated account data

---

### 12.1. Update Email (PATIENT Only)
**Endpoint:** `PUT /accounts/:id`  
**Auth:** Required (Bearer Token - PATIENT only)  
**Headers:** `Authorization: Bearer <token>`

```json
{
  "email": "newemail@test.com"
}
```

**Expected Response:**
- Status: 200
- Email updated successfully
- `isEmailVerified = false`
- Account status changed to PENDING_VERIFICATION
- ⚠️ **User cannot login** until email is verified
- Message: "Please request verification code via POST /mailer/send-verification-code"

**Next Steps After Email Change:**
1. POST /mailer/send-verification-code (with new email)
2. POST /auth/verify-email (with new email + code)
3. Login again with new email

**Access Control:**
- ✅ **PATIENT**: Can change their own email
- ❌ **DOCTOR**: Cannot change email (must contact admin)
- ❌ **CLINIC_STAFF**: Cannot change email (must contact admin)
- ❌ **CLINIC_MANAGER**: Cannot change email (must contact admin)
- ❌ **ADMIN**: Cannot change email (must contact admin)

**Error Cases:**
- ❌ 403: Non-PATIENT trying to change email
- ❌ 409: New email already exists
- ❌ 404: Account not found
```json
{
  "oldPassword": "Patient123",
  "newPassword": "NewPassword456"
}
```

**Expected Response:**
- Status: 200
- Password successfully changed

---

### 14. Soft Delete Account
**Endpoint:** `DELETE /accounts/:id`  
**Auth:** Required (Bearer Token - ADMIN or own account)  
**Headers:** `Authorization: Bearer <token>`

**Expected Response:**
- Status: 200
- Account soft deleted (deletedAt set)

---

### 15. Restore Deleted Account
**Endpoint:** `PATCH /accounts/:id/restore`  
**Auth:** Required (Bearer Token - ADMIN)  
**Headers:** `Authorization: Bearer <token>`

**Expected Response:**
- Status: 200
- Account restored (deletedAt cleared)

---

### 16. Permanent Delete Account
**Endpoint:** `DELETE /accounts/:id/permanent`  
**Auth:** Required (Bearer Token - ADMIN only)  
**Headers:** `Authorization: Bearer <token>`

**Expected Response:**
- SPOST /auth/register/account → Get accountId
2. POST /auth/register/profile/:accountId → Status: PENDING_VERIFICATION
3. POST /mailer/send-verification-code → Receive code via email
4. POST /auth/verify-email → Status: ACTIVE, isEmailVerified: true
5. POST /auth/login → Get access token
6. Access protected endpoints with token

### Scenario 1.1: Patient Change Email
1. Login as PATIENT → Get token
2. PUT /accounts/:id (with new email) → Status: PENDING_VERIFICATION, isEmailVerified: false
3. ❌ Login fails (account is PENDING_VERIFICATION)
4. POST /mailer/send-verification-code (with new email) → Receive code
5. POST /auth/verify-email (with new email) → Status: ACTIVE, isEmailVerified: true
6. POST /auth/login (with new email) → Success
### 17. Ban Account
**Endpoint:** `PATCH /accounts/:id/ban`  
**Auth:** Required (Bearer Token - ADMIN only)  
**Headers:** `Authorization: Bearer <token>`

```json
{
  "reason": "Violation of terms of service"
}
```

**Expected Response:**
- Status: 200
- Account status changed to BANNED
- User cannot login

---

### 18. Unban Account
**Endpoint:** `PATCH /accounts/:id/unban`  
**Auth:** Required (Bearer Token - ADMIN only)  
**Headers:** `Authorization: Bearer <token>`

**Expected Response:**
- Status: 200
- Account status changed to ACTIVE
- User can login again

---

## 📋 Test Sequence (Happy Path)

### Scenario 1: Patient Registration → Login
1. Create basic account → Get accountId
2. Complete profile with accountId
3. Verify email with code
4. Login with credentials
5. Access protected endpoints with token

### Scenario 2: Patient → Clinic Manager → Add Staff/Doctor
1. Login as PATIENT
2. Register as CLINIC_MANAGER (with patient token)
3. Login with clinic manager credentials
4. Add STAFF account (staff receives INCOMPLETE account)
5. Add DOCTOR account (doctor receives INCOMPLETE account)
6. Staff/Doctor login should fail (INCOMPLETE status)

### Scenario 3: Admin Operations
1. Login as ADMIN
2. Get all accounts
3. Ban a user account
4. Unban the account (Step 2)
- **PENDING_VERIFICATION**: Cannot login, must verify email first
- **ACTIVE**: Normal active account, can login
- **SUSPENDED**: Temporarily disabled, cannot login
- **BANNED**: Permanently banned, cannot login

### Email Verification Rules:
- ⚠️ **Manual Code Request**: User must call POST /mailer/send-verification-code
- ⚠️ **No Auto-Send**: System does NOT automatically send verification code after registration
- ⚠️ **Code Expiration**: 10 minutes for email verification, 15 minutes for password reset
- ⚠️ **One-Time Use**: Code can only be used once
- ⚠️ **PATIENT Only**: Only PATIENT role can change their own email
- ⚠️ **Re-verification**: Changing email requires re-verification (status → PENDING_VERIFICATION)

## 🔍 Important Notes

### Account Status Flow:
- **INCOMPLETE**: Cannot login, must complete profile
- **PENDING_VERIFICATION**: Can exist but should verify email
- **ACTIVE**: Normal active account
- **SUSPENDED**: Temporarily disabled
- **BANNED**: Permanently banned, cannot login

### Role Hierarchy:manually request code, verify, and login
- ✅ INCOMPLETE accounts blocked from login
- ✅ PENDING_VERIFICATION accounts blocked from login
- ✅ Manual verification code request works
- ✅ Verification code expires after 10 minutes
- ✅ Code is one-time use only
- ✅ PATIENT can change their own email (requires re-verification)
- ✅ Non-PATIENT roles blocked from changing email
- ✅ Email change triggers PENDING_VERIFICATION statusLINIC_MANAGER
- **CLINIC_MANAGER**: Can create STAFF and DOCTOR (INCOMPLETE accounts)
- **CLINIC_STAFF**: No creation permissions
- **DOCTOR**: No creation permissions
- **ADMIN**: Full system access

### 2-Step Registration:
- All accounts must follow 2-step pattern
- Step 1: Creates INCOMPLETE account
- Step 2: Completes profile, changes status to PENDING_VERIFICATION or ACTIVE
- INCOMPLETE accounts cannot login

---

## ✅ Success Criteria

- ✅ Patient can register, verify, and login
- ✅ INCOMPLETE accounts blocked from login
- ✅ PATIENT can upgrade to CLINIC_MANAGER (after purchase)
- ✅ CLINIC_MANAGER can create STAFF/DOCTOR (INCOMPLETE)
- ✅ STAFF/DOCTOR cannot create new accounts
- ✅ Password reset flow works
- ✅ Account CRUD operations work
- ✅ Ban/unban functionality works
- ✅ Soft delete and restore work
- ✅ Role-based access control enforced
