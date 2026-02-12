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
2. Check Account Status (BAN, PENDING, INACTIVE, DELETED, EXPIRED, REFILL)
3. Check Clinic Subscription Status (For clinic roles only)
4. Generate JWT Token
5. Mark User Online
6. Return User Data
```

### 2.2. Thứ Tự Ưu Tiên Validation
| Bước | Validator | Exception Type | Khi Nào Dừng? |
|:-----|:----------|:---------------|:--------------|
| 1 | Email/Password Match | `UnauthorizedException` | Ngay lập tức |
| 2 | Account Status | `ForbiddenException` / `UnauthorizedException` | Ngay lập tức |
| 3 | Clinic Subscription | `ForbiddenException` | Ngay lập tức |
| 4 | JWT Generation | - | Thành công |

---

## 3. Account Status Validation

### 3.1. Account Status Enum
| Status | Description | Exception | Message |
|:-------|:------------|:----------|:--------|
| `ACTIVE` | ✅ Hoạt động bình thường | - | - |
| `BAN` | ❌ Tài khoản bị cấm | `ForbiddenException` | "Your account has been banned." |
| `PENDING` | ❌ Chờ xác thực email | `UnauthorizedException` | "Email verification required." |
| `INACTIVE` | ❌ Tài khoản bị vô hiệu hóa | `UnauthorizedException` | "Your account is inactive." |
| `DELETED` | ❌ Tài khoản đã xóa | `UnauthorizedException` | "Your account has been deleted." |
| `EXPIRED` | ❌ Thuê bao hết hạn | `ForbiddenException` | "Your subscription has expired." |
| `REFILL` | ❌ Cần nạp tiền | `ForbiddenException` | "Your account needs a refill." |

### 3.2. Quy Tắc Ngắt Luồng
-   **BR-01**: Nếu Account Status ≠ `ACTIVE` → Dừng ngay, không check Subscription.
-   **BR-02**: Account Status check được gọi **trước** Subscription check.

---

## 4. Clinic Subscription Guard

### 4.1. Vai Trò Áp Dụng (Clinic Roles)
| Role | Hierarchy Level | Admin Lookup |
|:-----|:----------------|:-------------|
| `CLINIC_ADMIN` | Root | Self (_id) |
| `CLINIC_MANAGER` | Level 1 | parentId |
| `CLINIC_STAFF` | Level 2 | parent.parentId |
| `DOCTOR` | Level 2 | parent.parentId |

### 4.2. Vai Trò Bỏ Qua (Bypass Roles)
| Role | Reason |
|:-----|:-------|
| `PATIENT` | Không liên quan đến phòng khám |
| `ADMIN` | System Admin, không phụ thuộc subscription |

### 4.3. Hierarchy Resolution Logic

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

## 5. Hierarchy Validation Rules

### 5.1. BR-05: Parent Account Required
-   **Áp dụng cho**: `CLINIC_MANAGER`, `CLINIC_STAFF`, `DOCTOR`.
-   **Nếu `parentId` = null** → Throw `ForbiddenException`:
    ```
    "Clinic subscription validation failed: No parent account found."
    ```

### 5.2. BR-06: Valid Hierarchy Required
-   **Áp dụng cho**: `CLINIC_STAFF`, `DOCTOR` (Level 2).
-   **Nếu parent không tồn tại hoặc parent.parentId = null** → Throw `ForbiddenException`:
    ```
    "Clinic subscription validation failed: Invalid account hierarchy."
    ```

### 5.3. BR-07: Subscription Must Exist
-   **Áp dụng cho**: Tất cả clinic roles.
-   **Nếu không tìm thấy subscription cho clinicAdminId** → Throw `ForbiddenException`:
    ```
    "Clinic subscription not found. Please contact support."
    ```

---

## 6. JWT Token Generation

### 6.1. Token Payload Structure
```typescript
{
  sub: string,      // User ID
  email: string,    // User Email
  role: AccountRole // User Role
}
```

### 6.2. BR-08: Token Generation Timing
-   Token chỉ được generate **sau khi** tất cả validation passed.
-   Token **không** được generate nếu:
    -   Password sai
    -   Account Status blocked
    -   Subscription blocked

---

## 7. User Online Status

### 7.1. BR-09: Mark User Online
-   Gọi `socketGatewayService.markUserOnline(userId)` sau khi JWT generated.
-   **Không** mark online nếu validation fails.

### 7.2. Timing
```
JWT Token Generated → Mark Online → Return Response
```

---

## 8. Error Handling Matrix

| Scenario | Exception | HTTP Status | Message Pattern |
|:---------|:----------|:------------|:----------------|
| Wrong Password | `UnauthorizedException` | 401 | "Invalid credentials" |
| User Not Found | `UnauthorizedException` | 401 | "Invalid credentials" |
| Account BAN | `ForbiddenException` | 403 | "banned" |
| Account PENDING | `UnauthorizedException` | 401 | "verification required" |
| Account INACTIVE | `UnauthorizedException` | 401 | "inactive" |
| Account DELETED | `UnauthorizedException` | 401 | "deleted" |
| Account EXPIRED | `ForbiddenException` | 403 | "expired" |
| Account REFILL | `ForbiddenException` | 403 | "refill" |
| Subscription EXPIRED | `ForbiddenException` | 403 | "not active or has expired" |
| Subscription PENDING_* | `ForbiddenException` | 403 | "not active or has expired" |
| No Parent | `ForbiddenException` | 403 | "No parent account found" |
| Invalid Hierarchy | `ForbiddenException` | 403 | "Invalid account hierarchy" |
| No Subscription | `ForbiddenException` | 403 | "subscription not found" |

---

## 9. Integration Flow Sequence

### 9.1. Complete Success Flow
```
1. findByEmail(email)
2. bcrypt.compare(password, hash)
3. validateAccountAccess(account)        // Account status check
4. validateClinicSubscription(account)   // Subscription check (clinic roles)
5. jwtService.sign(payload)              // Generate token
6. socketGatewayService.markUserOnline() // Mark online
7. findGeneralAccountByUserId()          // Get profile data
8. Return { accessToken, userId, user }
```

### 9.2. Short-Circuit Behaviors

#### **BR-10: Early Exit on Password Fail**
```
If password invalid → Throw immediately
  → Skip account status check
  → Skip subscription check
  → Skip token generation
```

#### **BR-11: Early Exit on Account Status Fail**
```
If account status blocked → Throw immediately
  → Skip subscription check
  → Skip token generation
  → Skip mark online
```

#### **BR-12: Early Exit on Subscription Fail**
```
If subscription blocked → Throw immediately
  → Skip token generation
  → Skip mark online
```

---

## 10. Edge Cases & Special Scenarios

### 10.1. Multiple Parent Levels
| User Role | Parent Role | Grandparent Role | Subscription Owner |
|:----------|:------------|:-----------------|:-------------------|
| DOCTOR | CLINIC_MANAGER | CLINIC_ADMIN | CLINIC_ADMIN |
| CLINIC_STAFF | CLINIC_MANAGER | CLINIC_ADMIN | CLINIC_ADMIN |
| CLINIC_MANAGER | CLINIC_ADMIN | - | CLINIC_ADMIN |
| CLINIC_ADMIN | - | - | Self |

### 10.2. NON_RENEWING Status
-   **BR-13**: Users with `NON_RENEWING` subscription CAN login.
-   Reason: Subscription cancelled but still valid until `expirationDate`.
-   System will block login after expiration date passes.

### 10.3. System Admin Bypass
-   **BR-14**: `ADMIN` role bypasses subscription check entirely.
-   No `parentId` required.
-   No subscription lookup.

### 10.4. Patient Bypass
-   **BR-15**: `PATIENT` role bypasses subscription check entirely.
-   No `parentId` required.
-   No subscription lookup.

---

## 11. Testing Requirements

### 11.1. Happy Path Coverage
- ✅ All clinic roles login with ACTIVE subscription
- ✅ CLINIC_ADMIN login with NON_RENEWING subscription
- ✅ PATIENT login (bypass subscription)
- ✅ ADMIN login (bypass subscription)

### 11.2. Subscription Guard Coverage
- ✅ Block all PENDING_* statuses
- ✅ Block EXPIRED status
- ✅ Block REJECTED status
- ✅ Block when subscription not found
- ✅ Block when hierarchy invalid

### 11.3. Account Status Coverage
- ✅ Block BAN, PENDING, INACTIVE, DELETED, EXPIRED, REFILL
- ✅ Verify exception types (401 vs 403)
- ✅ Verify error messages

### 11.4. Integration Flow Coverage
- ✅ Verify execution order
- ✅ Verify short-circuit behaviors
- ✅ Verify no side effects on failure

---

## 12. Performance Considerations

### 12.1. Database Queries
| Step | Query Count | Optimization |
|:-----|:------------|:-------------|
| Find User | 1 | Indexed on email |
| Find Parent (Manager/Staff) | 0-1 | Only for Level 2 roles |
| Find Subscription | 0-1 | Only for clinic roles |
| Find GeneralAccount | 1 | Always executed |

### 12.2. BR-16: Lazy Loading
-   Subscription check chỉ thực hiện khi cần (clinic roles).
-   Parent lookup chỉ thực hiện cho CLINIC_STAFF/DOCTOR.
-   GeneralAccount lookup chỉ sau khi validation passed.
