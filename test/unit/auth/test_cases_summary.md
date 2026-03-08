# Tổng Hợp Các Trường Hợp Unit Test - Module Auth (Login Feature)

Dưới đây là danh sách các trường hợp kiểm thử (test cases) đã được thực hiện cho module Auth.

## 1. Service Definition
- **TC-01**: `should be defined`
  - Kiểm tra service được khởi tạo thành công.

---

## 2. Successful Login (Happy Paths)
Kiểm thử luồng đăng nhập thành công cho các vai trò khác nhau.

### Clinic Roles - Active Subscription
- **TC-02**: `should allow DOCTOR login when root admin subscription is ACTIVE`
  - Kiểm tra DOCTOR có parent → grandparent (CLINIC_ADMIN) có subscription ACTIVE.
  - Verify JWT token generation.
  - Verify user marked online.

- **TC-03**: `should allow CLINIC_ADMIN login when subscription is NON_RENEWING`
  - Kiểm tra CLINIC_ADMIN với subscription NON_RENEWING (cancelled but valid).
  - Verify login allowed.

- **TC-04**: `should allow CLINIC_MANAGER login when subscription is ACTIVE`
  - Kiểm tra CLINIC_MANAGER với parent (CLINIC_ADMIN) có subscription ACTIVE.
  - Verify subscription validation called.

- **TC-05**: `should allow CLINIC_STAFF login when subscription is ACTIVE`
  - Kiểm tra CLINIC_STAFF với hierarchy Staff → Manager → Admin.
  - Verify subscription validation called.

### Non-Clinic Roles (Bypass Subscription Check)
- **TC-06**: `should allow PATIENT login (bypasses subscription check)`
  - Kiểm tra PATIENT không cần subscription.
  - Verify login success without subscription lookup.

- **TC-07**: `should allow ADMIN login (bypasses subscription check)`
  - Kiểm tra ADMIN (System Admin) bypass subscription check.
  - Verify login success without subscription lookup.

### User Data & Online Status
- **TC-08**: `should return user data with generalAccount information`
  - Verify response chứa user profile từ GeneralAccount.
  - Verify `findGeneralAccountByUserId` được gọi.

- **TC-09**: `should mark user as online after successful login`
  - Verify `socketGatewayService.markUserOnline` được gọi.
  - Verify timing: sau khi JWT generated.

---

## 3. Subscription Failures (Guard Check)
Kiểm thử Clinic Subscription Guard - các trường hợp bị chặn.

### Blocked Subscription Statuses
- **TC-10**: `should block CLINIC_MANAGER when subscription is EXPIRED`
  - Verify throw `ForbiddenException`.
  - Message: "Clinic subscription is not active or has expired."

- **TC-11**: `should block CLINIC_STAFF when subscription is PENDING_PAYMENT`
  - Verify throw `ForbiddenException`.
  - Verify user NOT marked online.

- **TC-12**: `should block DOCTOR when subscription is REJECTED`
  - Verify throw `ForbiddenException`.
  - Verify JWT NOT generated.

- **TC-13**: `should block CLINIC_ADMIN when subscription is PENDING_SEPAY_SETUP`
  - Verify throw `ForbiddenException`.

- **TC-14**: `should block CLINIC_ADMIN when subscription is PENDING_MANAGER_SETUP`
  - Verify throw `ForbiddenException`.

- **TC-15**: `should block CLINIC_ADMIN when subscription is PENDING_LEGAL_SETUP`
  - Verify throw `ForbiddenException`.

- **TC-16**: `should block CLINIC_ADMIN when subscription is PENDING_APPROVAL`
  - Verify throw `ForbiddenException`.

### Missing Subscription & Invalid Hierarchy
- **TC-17**: `should block login when subscription not found`
  - Verify throw `ForbiddenException`.
  - Message: "Clinic subscription not found. Please contact support."

- **TC-18**: `should block CLINIC_STAFF when parent hierarchy is invalid`
  - Verify throw `ForbiddenException`.
  - Message contains: "Invalid account hierarchy".

- **TC-19**: `should block DOCTOR when no parent account found`
  - Verify throw `ForbiddenException`.
  - Message contains: "No parent account found".

---

## 4. Parent Manager Status Validation (NEW - Cascading Login Block)
Kiểm thử logic chặn đăng nhập CLINIC_STAFF/DOCTOR khi parent Manager bị vô hiệu hóa hoặc chờ phê duyệt.

### MANAGER_DISABLED Blocking
- **TC-20**: `should block CLINIC_STAFF when parent manager is MANAGER_DISABLED`
  - Parent Manager status = MANAGER_DISABLED.
  - Verify throw `ForbiddenException`.
  - Message: "Your clinic branch has been temporarily disabled. Please contact your clinic administrator for assistance."
  - Verify validateAccountAccess called first.
  - Verify validateParentManagerStatus called.
  - Verify JWT NOT generated.
  - Verify user NOT marked online.

- **TC-21**: `should block DOCTOR when parent manager is MANAGER_DISABLED`
  - Parent Manager status = MANAGER_DISABLED.
  - Verify throw `ForbiddenException`.
  - Message: "temporarily disabled".
  - Verify validateAccountAccess called before parent check.
  - Verify validateParentManagerStatus called.
  - Verify JWT NOT generated.

### PENDING_APPROVAL Blocking
- **TC-22**: `should block CLINIC_STAFF when parent manager is PENDING_APPROVAL`
  - Parent Manager status = PENDING_APPROVAL.
  - Verify throw `ForbiddenException`.
  - Message: "Your clinic branch is pending legal document approval. You will be able to login once verification is complete."
  - Verify validateParentManagerStatus called.
  - Verify validateClinicSubscription NOT called (early exit).

- **TC-23**: `should block DOCTOR when parent manager is PENDING_APPROVAL`
  - Parent Manager status = PENDING_APPROVAL.
  - Verify throw `ForbiddenException`.
  - Message: "pending legal document approval".
  - Verify validateParentManagerStatus called.

### ACTIVE Manager Allows Login
- **TC-24**: `should allow CLINIC_STAFF login when parent manager is ACTIVE`
  - Parent Manager status = ACTIVE.
  - Verify login success.
  - Verify JWT token generated.
  - Verify validateAccountAccess called.
  - Verify validateParentManagerStatus called and passed.
  - Verify validateClinicSubscription called.
  - Verify user marked online.

### Bypass Parent Check for Other Roles
- **TC-25**: `should NOT check parent status for CLINIC_ADMIN role`
  - CLINIC_ADMIN role (no parent).
  - Verify validateParentManagerStatus called but returns early.
  - Verify login success.
  - Verify JWT token generated.

- **TC-26**: `should NOT check parent status for PATIENT role`
  - PATIENT role (no parent).
  - Verify validateParentManagerStatus called but returns early.
  - Verify login success.
  - Verify JWT token generated.

---

## 5. Standard Auth Failures
Kiểm thử các lỗi xác thực cơ bản (email/password, account status).

### Credential Failures
- **TC-27**: `should throw UnauthorizedException when password is incorrect`
  - Verify bcrypt.compare returns false.
  - Verify throw `UnauthorizedException`.

- **TC-28**: `should throw UnauthorizedException when user not found`
  - Verify findByEmail returns null.
  - Verify throw `UnauthorizedException`.

### Account Status Blocks
- **TC-29**: `should validate account access before subscription check`
  - Verify validateAccountAccess called first.
  - Verify subscription check NOT called if account status blocked.

- **TC-30**: `should throw ForbiddenException when account status is BAN` (UPDATED)
  - Account status = BAN.
  - Message: "Your account has been banned".

- **TC-31**: `should throw UnauthorizedException when account status is DELETED`
  - Account status = DELETED.
  - Message: "account has been deleted".

---

## 6. UNVERIFIED Status Handling (NEW)
Kiểm thử logic đăng nhập cho tài khoản chưa xác thực email.

### UNVERIFIED Login Flow
- **TC-32**: `should allow UNVERIFIED user to login and return access token`
  - Account status = UNVERIFIED.
  - Verify JWT token generated.
  - Verify response.data.accessToken exists.
  - Verify response.data.userId correct.

- **TC-33**: `should return warning message for UNVERIFIED status`
  - Account status = UNVERIFIED.
  - Verify message = "Login successful. Please verify your email address to access full features."

- **TC-34**: `should return standard message for ACTIVE status`
  - Account status = ACTIVE.
  - Verify message = "User logged in successfully".

- **TC-35**: `should call validateClinicSubscription for UNVERIFIED clinic users`
  - UNVERIFIED DOCTOR role.
  - Verify validateClinicSubscription called.

- **TC-36**: `should mark UNVERIFIED user as online after login`
  - Account status = UNVERIFIED.
  - Verify socketGatewayService.markUserOnline called with correct userId.

- **TC-37**: `should generate JWT with correct payload for UNVERIFIED user`
  - Account status = UNVERIFIED.
  - Verify payload = `{ sub: userId, email: email, role: role }`.

- **TC-38**: `should fetch general account data for UNVERIFIED user`
  - Account status = UNVERIFIED.
  - Verify findGeneralAccountByUserId called with correct userId.

- **TC-39**: `should validate account access (BAN/DELETED check) for UNVERIFIED users`
  - Account status = UNVERIFIED.
  - Verify validateAccountAccess called.
  - UNVERIFIED should not throw exception.

---

## 7. JWT Token Generation
Kiểm thử logic tạo JWT token.

### Token Payload
- **TC-40**: `should generate JWT token with correct payload`
  - Verify payload = `{ sub: userId, email: email, role: role }`.
  - Verify jwtService.sign called with correct payload.

- **TC-41**: `should return accessToken in response`
  - Verify response.data.accessToken exists.
  - Verify token value matches jwtService.sign output.

---

## 8. Integration Flow
Kiểm thử luồng tích hợp đầy đủ và thứ tự thực thi.

### Execution Order
- **TC-42**: `should execute complete login flow in correct order`
  - Verify call order:
    1. findByEmail
    2. validateAccountAccess
    3. validateParentManagerStatus (NEW)
    4. validateClinicSubscription
    5. jwtSign
    6. markUserOnline
    7. findGeneralAccountByUserId

### Short-Circuit Behaviors
- **TC-43**: `should not call subscription validation if password is wrong`
  - Verify early exit on password mismatch.
  - Verify validateAccountAccess NOT called.
  - Verify validateClinicSubscription NOT called.

- **TC-44**: `should not mark user online if subscription validation fails`
  - Verify exception thrown before markUserOnline.
  - Verify jwtService.sign NOT called.
  - Verify markUserOnline NOT called.

---

## Tổng Kết

| Metric | Giá trị |
|:-------|:--------|
| **Tổng số Test Cases** | 44 |
| **Passed** | 44 |
| **Skipped** | 0 |
| **File Test** | `auth.service.spec.ts` |
| **Command** | `npx jest test/unit/auth` |
| **Coverage Categories** | 8 |

---

## Phân Bố Test Cases Theo Nhóm

| Category | Test Count | Percentage |
|:---------|:-----------|:-----------|
| Service Definition | 1 | 2.3% |
| Successful Login | 8 | 18.2% |
| Subscription Failures | 10 | 22.7% |
| Parent Manager Status (NEW) | 7 | 15.9% |
| Standard Auth Failures | 5 | 11.4% |
| UNVERIFIED Status Handling | 8 | 18.2% |
| JWT Token Generation | 2 | 4.5% |
| Integration Flow | 3 | 6.8% |

---

## Quy Tắc Liên Quan

| Rule ID | Mô Tả | Test Case |
|:--------|:------|:----------|
| BR-01 | Chỉ BAN và DELETED chặn login (UPDATED) | TC-29, TC-30, TC-31 |
| BR-02 | Account Status check trước Parent Manager check | TC-29 |
| BR-03 | UNVERIFIED cho phép login với warning message (NEW) | TC-32-39 |
| BR-04 | Message Logic: ACTIVE vs UNVERIFIED (NEW) | TC-33, TC-34 |
| BR-05 | Allowed Subscription: ACTIVE, NON_RENEWING | TC-02-05 |
| BR-06 | Blocked Subscription: EXPIRED, PENDING_* | TC-10-16 |
| BR-07 | Parent Account Required (Manager/Staff) | TC-19 |
| BR-08 | Valid Hierarchy Required (Level 2) | TC-18 |
| BR-09 | Subscription Must Exist | TC-17 |
| BR-10 | Token Generation After Validation (UNVERIFIED included) | TC-32, TC-37, TC-40, TC-41 |
| BR-11 | Mark User Online After JWT | TC-09, TC-36 |
| BR-12 | Early Exit on Password Fail | TC-43 |
| BR-13 | Early Exit on Account Status Fail (BAN/DELETED only) | TC-29 |
| BR-14 | Early Exit on Parent Manager Status Fail (NEW) | TC-20-23 |
| BR-15 | Early Exit on Subscription Fail | TC-44 |
| BR-16 | NON_RENEWING Allows Login | TC-03 |
| BR-17 | ADMIN Bypasses Subscription | TC-07 |
| BR-18 | PATIENT Bypasses Subscription | TC-06 |
| BR-19 | MANAGER_DISABLED Blocks Child Login (NEW) | TC-20, TC-21 |
| BR-20 | PENDING_APPROVAL Blocks Child Login (NEW) | TC-22, TC-23 |
| BR-21 | ACTIVE Manager Allows Child Login (NEW) | TC-24 |
| BR-22 | UNVERIFIED Allows Login (NEW) | TC-32-39 |
| BR-23 | Lazy Loading (Optimization) | TC-42 |

---

## Exception Type Matrix

| Exception Type | Status Code | Test Cases | Count |
|:---------------|:------------|:-----------|:------|
| `UnauthorizedException` | 401 | TC-27, TC-28, TC-31 | 3 |
| `ForbiddenException` | 403 | TC-10-23, TC-30 | 15 |

**Note:** UNVERIFIED status is NOT an exception - it returns 200 with a conditional message.

---

## Coverage Analysis

### ✅ Covered Scenarios
- [x] All clinic roles with valid subscriptions
- [x] All 7 blocked subscription statuses
- [x] Account status blocks (BAN, DELETED)
- [x] Parent Manager status validation (NEW)
  - [x] MANAGER_DISABLED blocks STAFF/DOCTOR
  - [x] PENDING_APPROVAL blocks STAFF/DOCTOR
  - [x] ACTIVE Manager allows login
  - [x] Bypass check for non-child roles
- [x] UNVERIFIED status handling (NEW)
  - [x] Login with token generation
  - [x] Conditional message logic
  - [x] Full integration flow
  - [x] Clinic subscription validation
- [x] Password validation
- [x] User not found
- [x] Hierarchy validation (2 levels)
- [x] JWT token generation
- [x] Online status management
- [x] Integration flow sequence (with parent check)
- [x] Short-circuit behaviors
- [x] Bypass roles (PATIENT, ADMIN)

### 🔄 Future Enhancements
- [ ] Rate limiting on failed login attempts
- [ ] Password strength validation
- [ ] Multi-factor authentication (MFA)
- [ ] Session management
- [ ] Login history tracking
- [ ] Account lockout after N failures
- [ ] IP-based blocking

---

## Performance Metrics

| Operation | Database Queries | Expected Time |
|:----------|:-----------------|:--------------|
| PATIENT Login | 2 (findByEmail + GeneralAccount) | < 50ms |
| ADMIN Login | 2 (findByEmail + GeneralAccount) | < 50ms |
| CLINIC_ADMIN Login | 3 (+ Subscription) | < 100ms |
| CLINIC_MANAGER Login | 3 (+ Subscription) | < 100ms |
| CLINIC_STAFF/DOCTOR Login | 4 (+ Parent Manager + Subscription) | < 150ms |

---

## Related Documentation
- [Business Rules](./business_rules.md) - Quy tắc nghiệp vụ chi tiết
- [Auth Service](../../../src/modules/auth/auth.service.ts) - Source code
- [Accounts Service](../../../src/modules/accounts/accounts.service.ts) - Subscription validation logic
- [Subscription Status Enum](../../../src/modules/subscriptions/enums/subscription-status.enum.ts) - Status definitions
