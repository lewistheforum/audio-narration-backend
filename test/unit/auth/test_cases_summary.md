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

## 4. Standard Auth Failures
Kiểm thử các lỗi xác thực cơ bản (email/password, account status).

### Credential Failures
- **TC-20**: `should throw UnauthorizedException when password is incorrect`
  - Verify bcrypt.compare returns false.
  - Verify throw `UnauthorizedException`.

- **TC-21**: `should throw UnauthorizedException when user not found`
  - Verify findByEmail returns null.
  - Verify throw `UnauthorizedException`.

### Account Status Blocks
- **TC-22**: `should validate account access before subscription check`
  - Verify validateAccountAccess called first.
  - Verify subscription check NOT called if account status blocked.

- **TC-23**: `should throw UnauthorizedException when account is PENDING verification`
  - Account status = PENDING.
  - Message: "Email verification required".

- **TC-24**: `should throw ForbiddenException when account status is EXPIRED`
  - Account status = EXPIRED.
  - Message: "subscription has expired".

- **TC-25**: `should throw ForbiddenException when account status is REFILL`
  - Account status = REFILL.
  - Message: "needs a refill".

- **TC-26**: `should throw UnauthorizedException when account status is INACTIVE`
  - Account status = INACTIVE.
  - Message: "account is inactive".

- **TC-27**: `should throw UnauthorizedException when account status is DELETED`
  - Account status = DELETED.
  - Message: "account has been deleted".

---

## 5. JWT Token Generation
Kiểm thử logic tạo JWT token.

### Token Payload
- **TC-28**: `should generate JWT token with correct payload`
  - Verify payload = `{ sub: userId, email: email, role: role }`.
  - Verify jwtService.sign called with correct payload.

- **TC-29**: `should return accessToken in response`
  - Verify response.data.accessToken exists.
  - Verify token value matches jwtService.sign output.

---

## 6. Integration Flow
Kiểm thử luồng tích hợp đầy đủ và thứ tự thực thi.

### Execution Order
- **TC-30**: `should execute complete login flow in correct order`
  - Verify call order:
    1. findByEmail
    2. validateAccountAccess
    3. validateClinicSubscription
    4. jwtSign
    5. markUserOnline
    6. findGeneralAccountByUserId

### Short-Circuit Behaviors
- **TC-31**: `should not call subscription validation if password is wrong`
  - Verify early exit on password mismatch.
  - Verify validateAccountAccess NOT called.
  - Verify validateClinicSubscription NOT called.

- **TC-32**: `should not mark user online if subscription validation fails`
  - Verify exception thrown before markUserOnline.
  - Verify jwtService.sign NOT called.
  - Verify markUserOnline NOT called.

---

## Tổng Kết

| Metric | Giá trị |
|:-------|:--------|
| **Tổng số Test Cases** | 32 |
| **Passed** | 32 |
| **Skipped** | 0 |
| **File Test** | `auth.service.spec.ts` |
| **Command** | `npx jest test/unit/auth` |
| **Coverage Categories** | 6 |

---

## Phân Bố Test Cases Theo Nhóm

| Category | Test Count | Percentage |
|:---------|:-----------|:-----------|
| Service Definition | 1 | 3.1% |
| Successful Login | 8 | 25.0% |
| Subscription Failures | 10 | 31.3% |
| Standard Auth Failures | 8 | 25.0% |
| JWT Token Generation | 2 | 6.3% |
| Integration Flow | 3 | 9.4% |

---

## Quy Tắc Liên Quan

| Rule ID | Mô Tả | Test Case |
|:--------|:------|:----------|
| BR-01 | Account Status check trước Subscription | TC-22 |
| BR-02 | Account Status ≠ ACTIVE → Dừng | TC-23-27 |
| BR-03 | Allowed Statuses: ACTIVE, NON_RENEWING | TC-02-05 |
| BR-04 | Blocked Statuses: EXPIRED, PENDING_* | TC-10-16 |
| BR-05 | Parent Account Required (Manager/Staff) | TC-19 |
| BR-06 | Valid Hierarchy Required (Level 2) | TC-18 |
| BR-07 | Subscription Must Exist | TC-17 |
| BR-08 | Token Generation After Validation | TC-28, TC-29 |
| BR-09 | Mark User Online After JWT | TC-09 |
| BR-10 | Early Exit on Password Fail | TC-31 |
| BR-11 | Early Exit on Account Status Fail | TC-22 |
| BR-12 | Early Exit on Subscription Fail | TC-32 |
| BR-13 | NON_RENEWING Allows Login | TC-03 |
| BR-14 | ADMIN Bypasses Subscription | TC-07 |
| BR-15 | PATIENT Bypasses Subscription | TC-06 |
| BR-16 | Lazy Loading (Optimization) | TC-30 |

---

## Exception Type Matrix

| Exception Type | Status Code | Test Cases | Count |
|:---------------|:------------|:-----------|:------|
| `UnauthorizedException` | 401 | TC-20, TC-21, TC-23, TC-26, TC-27 | 5 |
| `ForbiddenException` | 403 | TC-10-19, TC-24, TC-25 | 12 |

---

## Coverage Analysis

### ✅ Covered Scenarios
- [x] All clinic roles with valid subscriptions
- [x] All 7 blocked subscription statuses
- [x] All 7 account status blocks
- [x] Password validation
- [x] User not found
- [x] Hierarchy validation (2 levels)
- [x] JWT token generation
- [x] Online status management
- [x] Integration flow sequence
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
| CLINIC_STAFF/DOCTOR Login | 4 (+ Parent + Subscription) | < 150ms |

---

## Related Documentation
- [Business Rules](./business_rules.md) - Quy tắc nghiệp vụ chi tiết
- [Auth Service](../../../src/modules/auth/auth.service.ts) - Source code
- [Accounts Service](../../../src/modules/accounts/accounts.service.ts) - Subscription validation logic
- [Subscription Status Enum](../../../src/modules/subscriptions/enums/subscription-status.enum.ts) - Status definitions
