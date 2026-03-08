# Test Cases Summary - Admin Service (Unit Tests)

## 📌 Tổng Quan
File test: `admin.service.spec.ts`

**Phương pháp:** Unit Testing với Jest & NestJS Testing Module

**Mocks:**
- `AdminRegistrationRepository`
- `ClinicsLegalDocumentsRepository`
- `ClinicSubscriptionRepository`
- `ClinicAdminInformationRepository`
- `MailerService`
- `DataSource` (Transaction mock với QueryRunner)
- `Repository<Account>`

**Test Coverage:** 100% các business logic paths

---

## 🧪 Test Suite Structure

### 1. GET LISTS - Lấy Danh Sách Giấy Tờ

#### 1.1. `getPendingLegalDocuments()`

**TC-01: ✅ SUCCESS - Lấy danh sách chờ duyệt với pagination**
- **Setup:** Mock repository trả về 5 records với `PENDING_REVIEW` status
- **Input:** `page = 1`, `limit = 10`
- **Expected:**
  - Response có đúng 5 items
  - Mỗi item có đầy đủ thông tin: `clinicName`, `managerEmail`, `verificationStatus`
  - Meta pagination: `{ page: 1, limit: 10, totalItems: 5, totalPages: 1 }`
- **Verify:** `adminRegistrationRepository.findPendingLegalDocuments()` được gọi đúng params

**TC-02: ✅ SUCCESS - Pagination hoạt động đúng**
- **Setup:** Mock trả về 25 records
- **Input:** `page = 2`, `limit = 10`
- **Expected:**
  - Meta: `{ totalItems: 25, totalPages: 3 }`
  - Chỉ trả về 10 items (page 2)

**TC-03: ✅ EDGE - Không có data**
- **Setup:** Mock trả về empty array
- **Expected:** `{ data: [], meta: { totalItems: 0, totalPages: 0 } }`

---

#### 1.2. `getApprovedLegalDocuments()`

**TC-04: ✅ SUCCESS - Lấy danh sách đã phê duyệt**
- **Setup:** Mock repository với `APPROVED` status
- **Expected:** Chỉ trả về các document có `verificationStatus = APPROVED`

---

#### 1.3. `getRejectedLegalDocuments()`

**TC-05: ✅ SUCCESS - Lấy danh sách bị từ chối**
- **Setup:** Mock repository với `REJECTED` status
- **Expected:**
  - Trả về documents có `verificationStatus = REJECTED`
  - Mỗi item có `rejectionReason` không null

---

#### 1.4. `getNotSubmittedRegistrations()`

**TC-06: ✅ SUCCESS - Lấy danh sách chưa nộp**
- **Setup:** Mock repository với `NOT_SUBMITTED` status
- **Expected:** Trả về các clinic chưa upload giấy tờ

---

### 2. GET DETAIL - Xem Chi Tiết

#### 2.1. `getRegistrationById()`

**TC-07: ✅ SUCCESS - Lấy chi tiết registration**
- **Setup:** Mock repository trả về full registration detail
- **Input:** `clinicAdminId = "admin-123"`
- **Expected:**
  - Response có đầy đủ thông tin Admin, Manager, Legal Docs, Subscription
  - Relations được load đầy đủ

**TC-08: ❌ FAIL - Không tìm thấy registration**
- **Setup:** Mock repository trả về `null`
- **Expected:** Throw `NotFoundException("Registration not found")`

---

### 3. APPROVE - Phê Duyệt Đăng Ký

#### 3.1. `approveRegistration()` - Happy Path

**TC-09: ✅ SUCCESS - Phê duyệt thành công và kích hoạt Manager Account**
- **Setup:**
  - Mock Clinic Admin tồn tại
  - Mock Clinic Manager tồn tại (child account, status = `PENDING_APPROVAL`)
  - Mock Legal Docs: `verificationStatus = PENDING_REVIEW`
  - Mock Subscription: `subscriptionStatus = PENDING_APPROVAL`
  - Mock transaction commit thành công
  - Mock email service
- **Expected:**
  - Legal Docs: `verificationStatus` → `APPROVED`
  - **Manager Account: `status` → `ACTIVE` (Manager có thể đăng nhập)**
  - Subscription: `subscriptionStatus` → `PENDING_PAYMENT`
  - `rejectionReason` → `null`
  - Transaction được commit
  - `mailerService.sendRegistrationApprovedEmail()` được gọi với đúng params
  - Response: `{ success: true, newStatus: "PENDING_PAYMENT" }`
- **Assertion Quan Trọng:** Verify `queryRunner.manager.save()` được gọi với Manager Account có `status = ACTIVE`

**TC-10: ✅ SUCCESS - Email thất bại không ảnh hưởng approve**
- **Setup:** Mock email service throw error
- **Expected:**
  - Transaction vẫn commit thành công
  - Log error ra console
  - Response: `emailSent = false`

---

#### 3.2. `approveRegistration()` - Error Cases

**TC-11: ❌ FAIL - Clinic Admin không tồn tại**
- **Setup:** Mock repository trả về `null`
- **Expected:**
  - Throw `NotFoundException("Clinic admin account not found")`
  - Transaction được rollback
  - Email không được gửi

**TC-12: ❌ FAIL - Clinic Manager không tồn tại**
- **Setup:** Mock Admin không có children hoặc children không có role `CLINIC_MANAGER`
- **Expected:** Throw `NotFoundException("Clinic manager account not found")`

**TC-13: ❌ FAIL - Legal Docs không tồn tại**
- **Setup:** Mock repository trả về `null`
- **Expected:** Throw `NotFoundException("Legal documents not found")`

**TC-14: ❌ FAIL - Legal Docs không ở trạng thái PENDING_REVIEW**
- **Setup:** Mock Legal Docs: `verificationStatus = APPROVED` (đã duyệt rồi)
- **Expected:**
  - Throw `BadRequestException("Legal documents are not in PENDING_REVIEW status")`
  - Transaction rollback

**TC-15: ❌ FAIL - Subscription không tồn tại**
- **Setup:** Mock subscription = `null`
- **Expected:** Throw `NotFoundException("Subscription not found")`

**TC-16: ❌ FAIL - Subscription không ở trạng thái PENDING_APPROVAL**
- **Setup:** Mock Subscription: `subscriptionStatus = ACTIVE`
- **Expected:**
  - Throw `BadRequestException("Subscription is not in PENDING_APPROVAL status")`
  - Transaction rollback

**TC-17: ❌ FAIL - Transaction thất bại**
- **Setup:** Mock QueryRunner.commitTransaction() throw error
- **Expected:**
  - Transaction được rollback
  - Error được propagate
  - Email không được gửi

---

### 4. REJECT - Từ Chối Đăng Ký

#### 4.1. `rejectRegistration()` - Happy Path

**TC-18: ✅ SUCCESS - Từ chối thành công**
- **Setup:**
  - Mock đầy đủ như TC-09
  - Input: `reason = "Giấy tờ không rõ ràng"`
- **Expected:**
  - Legal Docs:
    - `verificationStatus` → `REJECTED`
    - `rejectionReason` → "Giấy tờ không rõ ràng"
  - **Manager Account: `status` → `PENDING_APPROVAL` (Manager vẫn chưa thể đăng nhập)**
  - **⚠️ QUAN TRỌNG:** Subscription: `subscriptionStatus` → `PENDING_LEGAL_SETUP` (KHÔNG PHẢI `REJECTED`)
  - Transaction commit
  - `mailerService.sendRegistrationRejectedEmail()` được gọi với reason
  - Response: `{ success: true, newStatus: "PENDING_LEGAL_SETUP", nextStep: "RESUBMIT_DOCUMENTS" }`
- **Assertion Quan Trọng:** Verify `queryRunner.manager.save()` được gọi với Manager Account có `status = PENDING_APPROVAL`

**TC-19: ✅ SUCCESS - Email thất bại không ảnh hưởng reject**
- **Setup:** Mock email throw error
- **Expected:**
  - Transaction vẫn commit
  - Log error
  - Response: `emailSent = false`

---

#### 4.2. `rejectRegistration()` - Error Cases

**TC-20: ❌ FAIL - Reason bị thiếu hoặc empty**
- **Setup:** Input `reason = ""`
- **Expected:** Throw `BadRequestException("Rejection reason is required")`

**TC-21: ❌ FAIL - Legal Docs không ở trạng thái PENDING_REVIEW**
- **Setup:** Mock Legal Docs: `verificationStatus = REJECTED`
- **Expected:** Throw `BadRequestException("Legal documents are not in PENDING_REVIEW status")`

**TC-22: ❌ FAIL - Subscription status không đúng**
- **Setup:** Mock Subscription: `subscriptionStatus = EXPIRED`
- **Expected:** Throw `BadRequestException("Subscription is not in PENDING_APPROVAL status")`

**TC-23: ❌ FAIL - Transaction rollback khi có lỗi**
- **Setup:** Mock save() throw error
- **Expected:**
  - `queryRunner.rollbackTransaction()` được gọi
  - Error được propagate
  - Email không được gửi

---

### 5. INTEGRATION TESTS - Kiểm Tra Luồng

**TC-24: ✅ INTEGRATION - Approve → Reject flow**
- **Scenario:** Admin phê duyệt nhầm, sau đó muốn reject
- **Expected:**
  - Approve thành công → Status = `PENDING_PAYMENT`
  - Không thể reject được nữa vì status không còn là `PENDING_REVIEW`

**TC-25: ✅ INTEGRATION - Reject → Resubmit → Approve**
- **Scenario:** User upload lại sau khi bị reject
- **Expected:**
  - Reject → Status = `PENDING_LEGAL_SETUP`
  - User upload lại → Status = `PENDING_REVIEW`
  - Approve lại được

---

### 6. TRANSACTION TESTS - Kiểm Tra Transaction

**TC-26: ✅ Rollback khi update Legal Docs thất bại**
- **Expected:** Subscription không bị update

**TC-27: ✅ Rollback khi update Subscription thất bại**
- **Expected:** Legal Docs không bị update

**TC-28: ✅ Commit chỉ khi TẤT CẢ updates thành công**
- **Expected:** Cả Legal Docs và Subscription đều được update

---

## 📊 Coverage Summary

| Category | Test Cases | Success | Fail | Edge |
|----------|-----------|---------|------|------|
| **Get Lists** | 6 | 5 | 0 | 1 |
| **Get Detail** | 2 | 1 | 1 | 0 |
| **Approve** | 9 | 2 | 7 | 0 |
| **Reject** | 6 | 2 | 4 | 0 |
| **Integration** | 2 | 2 | 0 | 0 |
| **Transaction** | 3 | 3 | 0 | 0 |
| **TOTAL** | **28** | **15** | **12** | **1** |

---

## 🔍 Mock Strategy

### Repository Mocks
```typescript
mockAdminRegistrationRepository = {
  findPendingLegalDocuments: jest.fn(),
  findApprovedLegalDocuments: jest.fn(),
  findRejectedLegalDocuments: jest.fn(),
  findClinicAdminById: jest.fn(),
  findLegalDocumentsByManagerId: jest.fn(),
  findSubscriptionByClinicId: jest.fn(),
};
```

### Transaction Mock
```typescript
mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    save: jest.fn(),
  },
};

mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};
```

### Mailer Mock
```typescript
mockMailerService = {
  sendRegistrationApprovedEmail: jest.fn().mockResolvedValue(undefined),
  sendRegistrationRejectedEmail: jest.fn().mockResolvedValue(undefined),
};
```

---

## ✅ Test Execution

**Run:**
```bash
pnpm test test/unit/admin/admin.service.spec.ts
```

**Coverage:**
```bash
pnpm test:cov -- test/unit/admin/admin.service.spec.ts
```

**Expected Coverage:**
- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

---

## 📝 Notes

1. **Transaction Testing:** Đảm bảo `rollbackTransaction()` luôn được gọi khi có error.
2. **Email Testing:** Email failure không được làm fail business logic.
3. **Status Validation:** Luôn kiểm tra status trước khi update.
4. **Null Checks:** Kiểm tra tất cả dependencies tồn tại trước khi xử lý.
5. **Error Propagation:** Error từ repository phải được propagate đúng cách.

---

## 🚀 Next Steps

- [ ] Implement E2E tests cho Admin API endpoints
- [ ] Add load testing cho pagination
- [ ] Test concurrency (2 Admin approve cùng lúc)
- [ ] Add integration tests với real database (TestContainers)
