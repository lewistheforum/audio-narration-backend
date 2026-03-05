# Quy Tắc Nghiệp Vụ (Business Rules): Module Auth - Login Feature

Tài liệu này mô tả các quy tắc nghiệp vụ (BR) và logic xác thực đăng nhập trong `AuthModule`.

## 1. Tổng Quan
`AuthModule` chịu trách nhiệm quản lý:
-   Xác thực email/password (Standard Login).
-   Xác thực Google OAuth.
-   Kiểm tra trạng thái tài khoản (Account Status).
-   Kiểm tra trạng thái thuê bao phòng khám (Clinic Subscription Guard).
-   Tạo JWT Token.
-   Quản lý trạng thái online của user.

---

## 2. Luồng Đăng Nhập (Login Flow)

### 2.1. Quy Trình Xác Thực
```
1. Validate Email & Password
2. Check Account Status (BAN, DELETED only - UNVERIFIED allowed)
3. Check Parent Manager Status (For CLINIC_STAFF/DOCTOR only) - NEW
4. Check Clinic Subscription Status (For clinic roles only)
5. Generate JWT Token
6. Mark User Online
7. Return User Data with Conditional Message
```

### 2.2. Thứ Tự Ưu Tiên Validation
| Bước | Validator | Exception Type | Khi Nào Dừng? |
|:-----|:----------|:---------------|:--------------|
| 1 | Email/Password Match | `UnauthorizedException` | Ngay lập tức |
| 2 | Account Status | `ForbiddenException` / `UnauthorizedException` | Ngay lập tức |
| 3 | Parent Manager Status | `ForbiddenException` | Ngay lập tức |
| 4 | Clinic Subscription | `ForbiddenException` | Ngay lập tức |
| 5 | JWT Generation | - | Thành công |

---

## 3. Account Status Validation

### 3.1. Account Status Enum
| Status | Description | Exception | Message |
|:-------|:------------|:----------|:--------|
| `ACTIVE` | ✅ Hoạt động bình thường | - | "User logged in successfully" |
| `UNVERIFIED` | ⚠️ Chưa xác thực email (Cho phép đăng nhập) | - | "Login successful. Please verify your email address to access full features." |
| `BAN` | ❌ Tài khoản bị cấm | `ForbiddenException` | "Your account has been banned." |
| `DELETED` | ❌ Tài khoản đã xóa | `UnauthorizedException` | "Your account has been deleted." |
| `PENDING_APPROVAL` | ⏳ Manager chờ duyệt giấy phép (NEW) | - | Chặn tạo staff/doctor, chặn login cấp dưới |
| `MANAGER_DISABLED` | 🚫 Manager bị vô hiệu hóa (NEW) | - | Chặn tạo staff/doctor, chặn login cấp dưới |

### 3.2. Quy Tắc Ngắt Luồng
-   **BR-01**: Chỉ `BAN` và `DELETED` status sẽ chặn đăng nhập. `UNVERIFIED` và `ACTIVE` được phép.
-   **BR-02**: Account Status check được gọi **trước** Subscription check.
-   **BR-03**: `UNVERIFIED` status cho phép đăng nhập nhưng trả về message cảnh báo.

### 3.3. Message Logic (NEW)
-   **BR-04**: Response message phụ thuộc vào Account Status:
    -   `ACTIVE` → "User logged in successfully"
    -   `UNVERIFIED` → "Login successful. Please verify your email address to access full features."

---

## 4. Parent Manager Status Validation (NEW - Cascading Login Block)

### 4.1. Mục Đích
Ngăn chặn `CLINIC_STAFF` và `DOCTOR` đăng nhập khi Manager cha (parent) của họ bị vô hiệu hóa hoặc đang chờ phê duyệt.
Đây là cơ chế **cascading block** - chặn truy cập theo tầng cấp (hierarchy-based blocking).

### 4.2. Vai Trò Áp Dụng
| Role | Parent Check Required? | Reason |
|:-----|:----------------------:|:-------|
| `CLINIC_STAFF` | ✅ Yes | Nhân viên thuộc về Manager |
| `DOCTOR` | ✅ Yes | Bác sĩ thuộc về Manager |
| `CLINIC_MANAGER` | ❌ No | Manager không có parent manager |
| `CLINIC_ADMIN` | ❌ No | Admin là root level |
| `PATIENT` | ❌ No | Không thuộc phòng khám |
| `ADMIN` | ❌ No | System admin |

### 4.3. Parent Manager Status Blocking Rules

#### **BR-19: MANAGER_DISABLED Blocks Child Login**
-   **Khi nào**: Parent Manager có status = `MANAGER_DISABLED`
-   **Exception**: `ForbiddenException`
-   **Message**: 
    ```
    "Your clinic branch has been temporarily disabled. 
     Please contact your clinic administrator for assistance."
    ```
-   **Ý nghĩa**: Clinic Admin đã vô hiệu hóa Manager → tất cả Staff/Doctor thuộc Manager đó không thể đăng nhập.

#### **BR-20: PENDING_APPROVAL Blocks Child Login**
-   **Khi nào**: Parent Manager có status = `PENDING_APPROVAL`
-   **Exception**: `ForbiddenException`
-   **Message**: 
    ```
    "Your clinic branch is pending legal document approval. 
     You will be able to login once verification is complete."
    ```
-   **Ý nghĩa**: Manager chưa hoàn tất phê duyệt giấy phép → Staff/Doctor chưa thể hoạt động.

#### **BR-21: ACTIVE Manager Allows Child Login**
-   **Khi nào**: Parent Manager có status = `ACTIVE`
-   **Kết quả**: Cho phép đăng nhập (tiếp tục kiểm tra subscription)
-   **Ý nghĩa**: Manager hoạt động bình thường → Staff/Doctor được phép đăng nhập.

### 4.4. Validation Logic Flow
```typescript
async validateParentManagerStatus(account: Account): Promise<void> {
  // 1. Chỉ áp dụng cho CLINIC_STAFF và DOCTOR
  if (account.role !== CLINIC_STAFF && account.role !== DOCTOR) {
    return; // Bypass cho các role khác
  }

  // 2. Kiểm tra parentId tồn tại
  if (!account.parentId) {
    throw ForbiddenException("Account hierarchy error. No parent manager found.");
  }

  // 3. Lấy thông tin Parent Manager
  const parentManager = await findAccountById(account.parentId);

  if (!parentManager) {
    throw ForbiddenException("Parent manager not found. Please contact support.");
  }

  // 4. Kiểm tra Parent Manager status
  if (parentManager.status === MANAGER_DISABLED) {
    throw ForbiddenException("Your clinic branch has been temporarily disabled...");
  }

  if (parentManager.status === PENDING_APPROVAL) {
    throw ForbiddenException("Your clinic branch is pending legal document approval...");
  }

  // 5. Parent ACTIVE → Cho phép đăng nhập
}
```

### 4.5. Edge Cases

#### **Case 1: Missing Parent Manager**
-   **Tình huống**: `account.parentId` tồn tại nhưng Manager account không tìm thấy trong DB
-   **Exception**: `ForbiddenException`
-   **Message**: "Parent manager not found. Please contact support."
-   **Nguyên nhân**: Dữ liệu không nhất quán (Manager đã bị xóa hoặc corrupt data)

#### **Case 2: No ParentId**
-   **Tình huống**: `CLINIC_STAFF` hoặc `DOCTOR` có `parentId = null`
-   **Exception**: `ForbiddenException`
-   **Message**: "Account hierarchy error. No parent manager found."
-   **Nguyên nhân**: Dữ liệu không hợp lệ (Staff/Doctor phải có Manager)

### 4.6. Thứ Tự Validation trong Login Flow
```
1. validateAccountAccess(account)            // Kiểm tra BAN/DELETED
2. validateParentManagerStatus(account)      // Kiểm tra Parent Manager (NEW)
3. validateClinicSubscription(account)       // Kiểm tra Subscription
```

**Lý do thứ tự này**:
-   Parent Manager status check **trước** Subscription check vì:
    -   Nhanh hơn (chỉ 1 database query, không cần hierarchy lookup)
    -   Specific hơn (lỗi cụ thể về Manager, không phải Subscription chung chung)
    -   Rõ ràng hơn (user biết vấn đề từ Manager, không phải từ Admin subscription)

### 4.7. Database Query Impact
| Role | Parent Check? | Query Count | Note |
|:-----|:-------------|:------------|:-----|
| `CLINIC_STAFF` | ✅ | +1 query | Fetch parent Manager |
| `DOCTOR` | ✅ | +1 query | Fetch parent Manager |
| `CLINIC_MANAGER` | ❌ | 0 | Bypass (early return) |
| `CLINIC_ADMIN` | ❌ | 0 | Bypass (early return) |
| `PATIENT` | ❌ | 0 | Bypass (early return) |
| `ADMIN` | ❌ | 0 | Bypass (early return) |

---

## 5. Clinic Subscription Guard

### 5.1. Vai Trò Áp Dụng (Clinic Roles)
| Role | Hierarchy Level | Admin Lookup |
|:-----|:----------------|:-------------|
| `CLINIC_ADMIN` | Root | Self (_id) |
| `CLINIC_MANAGER` | Level 1 | parentId |
| `CLINIC_STAFF` | Level 2 | parent.parentId |
| `DOCTOR` | Level 2 | parent.parentId |

### 5.2. Vai Trò Bỏ Qua (Bypass Roles)
| Role | Reason |
|:-----|:-------|
| `PATIENT` | Không liên quan đến phòng khám |
| `ADMIN` | System Admin, không phụ thuộc subscription |

### 5.3. Hierarchy Resolution Logic

#### **Case 1: CLINIC_ADMIN**
```
clinicAdminId = account._id (Direct)
```

#### **Case 2: CLINIC_MANAGER**
```
clinicAdminId = account.parentId (1 level up)
```

#### **Case 3: CLINIC_STAFF / DOCTOR**
```
parentAccount = findAccountById(account.parentId)  // Manager
clinicAdminId = parentAccount.parentId              // Admin (2 levels up)
```

### 4.4. Subscription Status Validation

#### **BR-03: Allowed Statuses (Login Success)**
```typescript
allowedStatuses = [
  RegistrationStatus.ACTIVE,
  RegistrationStatus.NON_RENEWING
]
```

| Status | Description | Login Allowed? |
|:-------|:------------|:---------------|
| `ACTIVE` | ✅ Thuê bao đang hoạt động | Yes |
| `NON_RENEWING` | ✅ Đã hủy nhưng còn hạn | Yes |

#### **BR-04: Blocked Statuses (Login Fail)**
```typescript
blockedStatuses = [
  RegistrationStatus.EXPIRED,
  RegistrationStatus.PENDING_SEPAY_SETUP,
  RegistrationStatus.PENDING_MANAGER_SETUP,
  RegistrationStatus.PENDING_LEGAL_SETUP,
  RegistrationStatus.PENDING_APPROVAL,
  RegistrationStatus.REJECTED,
  RegistrationStatus.PENDING_PAYMENT
]
```

| Status | Description | Exception |
|:-------|:------------|:----------|
| `EXPIRED` | ❌ Thuê bao hết hạn | `ForbiddenException` |
| `PENDING_SEPAY_SETUP` | ❌ Chưa cấu hình thanh toán | `ForbiddenException` |
| `PENDING_MANAGER_SETUP` | ❌ Chưa tạo Manager | `ForbiddenException` |
| `PENDING_LEGAL_SETUP` | ❌ Chưa upload giấy phép | `ForbiddenException` |
| `PENDING_APPROVAL` | ❌ Chờ duyệt | `ForbiddenException` |
| `REJECTED` | ❌ Bị từ chối | `ForbiddenException` |
| `PENDING_PAYMENT` | ❌ Chưa thanh toán | `ForbiddenException` |

---

## 6. Hierarchy Validation Rules

### 6.1. BR-05: Parent Account Required
-   **Áp dụng cho**: `CLINIC_MANAGER`, `CLINIC_STAFF`, `DOCTOR`.
-   **Nếu `parentId` = null** → Throw `ForbiddenException`:
    ```
    "Clinic subscription validation failed: No parent account found."
    ```

### 6.2. BR-06: Valid Hierarchy Required
-   **Áp dụng cho**: `CLINIC_STAFF`, `DOCTOR` (Level 2).
-   **Nếu parent không tồn tại hoặc parent.parentId = null** → Throw `ForbiddenException`:
    ```
    "Clinic subscription validation failed: Invalid account hierarchy."
    ```

### 6.3. BR-07: Subscription Must Exist
-   **Áp dụng cho**: Tất cả clinic roles.
-   **Nếu không tìm thấy subscription cho clinicAdminId** → Throw `ForbiddenException`:
    ```
    "Clinic subscription not found. Please contact support."
    ```

---

## 7. JWT Token Generation

### 7.1. Token Payload Structure
```typescript
{
  sub: string,      // User ID
  email: string,    // User Email
  role: AccountRole // User Role
}
```

### 7.2. BR-08: Token Generation Timing
-   Token chỉ được generate **sau khi** tất cả validation passed.
-   Token **vẫn được** generate cho `UNVERIFIED` users (với message khác).
-   Token **không** được generate nếu:
    -   Password sai
    -   Account Status = `BAN` hoặc `DELETED`
    -   Subscription blocked

---

## 8. User Online Status

### 8.1. BR-09: Mark User Online
-   Gọi `socketGatewayService.markUserOnline(userId)` sau khi JWT generated.
-   **Không** mark online nếu validation fails.

### 8.2. Timing
```
JWT Token Generated → Mark Online → Return Response
```

---

## 9. Error Handling Matrix

### 9.1. Error Scenarios
| Scenario | Exception | HTTP Status | Message Pattern |
|:---------|:----------|:------------|:----------------|
| Wrong Password | `UnauthorizedException` | 401 | "Invalid credentials" |
| User Not Found | `UnauthorizedException` | 401 | "Invalid credentials" |
| Account BAN | `ForbiddenException` | 403 | "banned" |
| Account DELETED | `UnauthorizedException` | 401 | "deleted" |
| Parent Manager DISABLED (NEW) | `ForbiddenException` | 403 | "temporarily disabled" |
| Parent Manager PENDING_APPROVAL (NEW) | `ForbiddenException` | 403 | "pending legal document approval" |
| Subscription EXPIRED | `ForbiddenException` | 403 | "not active or has expired" |
| Subscription PENDING_* | `ForbiddenException` | 403 | "not active or has expired" |
| No Parent | `ForbiddenException` | 403 | "No parent account found" |
| Invalid Hierarchy | `ForbiddenException` | 403 | "Invalid account hierarchy" |
| No Subscription | `ForbiddenException` | 403 | "subscription not found" |

### 9.2. Success Scenarios with Conditional Messages
| Scenario | Exception | HTTP Status | Message |
|:---------|:----------|:------------|:--------|
| Account ACTIVE | - | 200 | "User logged in successfully" |
| Account UNVERIFIED | - | 200 | "Login successful. Please verify your email address to access full features." |

---

## 10. Integration Flow Sequence

### 10.1. Complete Success Flow
```
1. findByEmail(email)
2. bcrypt.compare(password, hash)
3. validateAccountAccess(account)           // Account status check (BAN/DELETED only)
4. validateParentManagerStatus(account)     // Parent Manager check (NEW - STAFF/DOCTOR only)
5. validateClinicSubscription(account)      // Subscription check (clinic roles)
6. Determine message (ACTIVE vs UNVERIFIED) // Message logic
7. jwtService.sign(payload)                 // Generate token
8. socketGatewayService.markUserOnline()    // Mark online
9. findGeneralAccountByUserId()             // Get profile data
10. Return { data: { accessToken, userId, user }, message }
```

### 10.2. Short-Circuit Behaviors

#### **BR-10: Early Exit on Password Fail**
```
If password invalid → Throw immediately
  → Skip account status check
  → Skip subscription check
  → Skip token generation
```

#### **BR-11: Early Exit on Account Status Fail**
```
If account status = BAN or DELETED → Throw immediately
  → Skip parent manager check
  → Skip subscription check
  → Skip token generation
  → Skip mark online

Note: UNVERIFIED status does NOT trigger early exit
```

#### **BR-12: Early Exit on Parent Manager Status Fail (NEW)**
```
If parent manager status = MANAGER_DISABLED or PENDING_APPROVAL → Throw immediately
  → Skip subscription check
  → Skip token generation
  → Skip mark online

Note: Only applies to CLINIC_STAFF and DOCTOR roles
```

#### **BR-13: Early Exit on Subscription Fail**
```
If subscription blocked → Throw immediately
  → Skip token generation
  → Skip mark online
```

---

## 11. Edge Cases & Special Scenarios

### 11.1. Multiple Parent Levels
| User Role | Parent Role | Grandparent Role | Subscription Owner |
|:----------|:------------|:-----------------|:-------------------|
| DOCTOR | CLINIC_MANAGER | CLINIC_ADMIN | CLINIC_ADMIN |
| CLINIC_STAFF | CLINIC_MANAGER | CLINIC_ADMIN | CLINIC_ADMIN |
| CLINIC_MANAGER | CLINIC_ADMIN | - | CLINIC_ADMIN |
| CLINIC_ADMIN | - | - | Self |

### 11.2. NON_RENEWING Status
-   **BR-14**: Users with `NON_RENEWING` subscription CAN login.
-   Reason: Subscription cancelled but still valid until `expirationDate`.
-   System will block login after expiration date passes.

### 11.3. System Admin Bypass
-   **BR-15**: `ADMIN` role bypasses subscription check entirely.
-   No `parentId` required.
-   No subscription lookup.

### 11.4. Patient Bypass
-   **BR-16**: `PATIENT` role bypasses subscription check entirely.
-   No `parentId` required.
-   No subscription lookup.

### 11.5. UNVERIFIED Status Handling (NEW)
-   **BR-17**: Users with `UNVERIFIED` status CAN login.
-   Token is generated normally.
-   Different success message returned: "Login successful. Please verify your email address to access full features."
-   Use Cases:
    -   New user registration (email not verified yet)
    -   Existing user changed email (status reverted to UNVERIFIED)

---

## 12. Testing Requirements

### 12.1. Happy Path Coverage
- ✅ All clinic roles login with ACTIVE subscription
- ✅ CLINIC_ADMIN login with NON_RENEWING subscription
- ✅ PATIENT login (bypass subscription)
- ✅ ADMIN login (bypass subscription)
- ✅ UNVERIFIED users login with warning message (NEW)
- ✅ ACTIVE users login with standard message (NEW)

### 12.2. Subscription Guard Coverage
- ✅ Block all PENDING_* statuses
- ✅ Block EXPIRED status
- ✅ Block REJECTED status
- ✅ Block when subscription not found
- ✅ Block when hierarchy invalid

### 12.3. Account Status Coverage
- ✅ Block BAN and DELETED only (UPDATED)
- ✅ Allow UNVERIFIED users (NEW)
- ✅ Verify exception types (401 vs 403)
- ✅ Verify error messages
- ✅ Verify conditional success messages (NEW)

### 12.4. UNVERIFIED Status Coverage (NEW)
- ✅ Allow UNVERIFIED user to login and return token
- ✅ Return warning message for UNVERIFIED status
- ✅ Return standard message for ACTIVE status
- ✅ Call validateClinicSubscription for UNVERIFIED clinic users
- ✅ Mark UNVERIFIED user as online
- ✅ Generate JWT with correct payload for UNVERIFIED
- ✅ Fetch general account data for UNVERIFIED
- ✅ Validate account access (BAN/DELETED) for UNVERIFIED

### 12.5. Parent Manager Status Coverage (NEW)
- ✅ Block CLINIC_STAFF when parent is MANAGER_DISABLED
- ✅ Block CLINIC_STAFF when parent is PENDING_APPROVAL
- ✅ Block DOCTOR when parent is MANAGER_DISABLED
- ✅ Block DOCTOR when parent is PENDING_APPROVAL
- ✅ Allow CLINIC_STAFF when parent is ACTIVE
- ✅ Allow DOCTOR when parent is ACTIVE
- ✅ Bypass check for CLINIC_ADMIN, PATIENT, ADMIN roles
- ✅ Verify exception messages are user-friendly
- ✅ Verify no token generated on parent status fail
- ✅ Verify user not marked online on parent status fail

### 12.6. Integration Flow Coverage
- ✅ Verify execution order
- ✅ Verify short-circuit behaviors
- ✅ Verify no side effects on failure

---

## 13. Performance Considerations

### 13.1. Database Queries
| Step | Query Count | Optimization |
|:-----|:------------|:-------------|
| Find User | 1 | Indexed on email |
| Find Parent Manager (NEW) | 0-1 | Only for CLINIC_STAFF/DOCTOR |
| Find Parent (Manager/Staff) | 0-1 | Only for Level 2 roles (subscription) |
| Find Subscription | 0-1 | Only for clinic roles |
| Find GeneralAccount | 1 | Always executed |

### 13.2. BR-18: Lazy Loading
-   Parent Manager check chỉ thực hiện cho CLINIC_STAFF/DOCTOR (NEW).
-   Subscription check chỉ thực hiện khi cần (clinic roles).
-   Parent lookup chỉ thực hiện cho CLINIC_STAFF/DOCTOR.
-   GeneralAccount lookup chỉ sau khi validation passed.
