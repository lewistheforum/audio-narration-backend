# Business Rules - Admin Module (Phê Duyệt Đăng Ký Phòng Khám)

## 🎯 Tổng Quan
Module Admin chịu trách nhiệm quản lý quy trình phê duyệt đăng ký cho các Phòng Khám.

**Điều kiện tiên quyết:**
- Chỉ tài khoản có vai trò `ADMIN` (System Admin) mới có thể truy cập các endpoint này.
- Sử dụng RBAC Guard để kiểm tra quyền trước khi thực hiện bất kỳ action nào.

---

## 📋 Chức Năng 1: Lấy Danh Sách Giấy Tờ Pháp Lý

### A. Danh Sách Chờ Duyệt (`getPendingLegalDocuments`)
**Filter:** `verificationStatus = PENDING_REVIEW`

**Logic:**
1. Query database với JOIN relations:
   - `clinics_legal_documents` (bảng chính)
   - `accounts` (Manager)
   - `accounts` (Clinic Admin qua `parentId`)
   - `clinic_admin_information` (Tên phòng khám)
2. Trả về danh sách có pagination (page, limit, totalItems, totalPages).
3. Sắp xếp mặc định: `createdAt DESC` (mới nhất trước).

**Response bao gồm:**
- `clinicName` (Tên phòng khám)
- `managerFullName` (Họ tên Manager)
- `managerEmail` (Email Manager)
- `businessLicense`, `taxIdUrl`, `operatingLicense` (URLs giấy tờ)
- `createdAt`, `updatedAt`, `verificationStatus`

---

### B. Danh Sách Đã Phê Duyệt (`getApprovedLegalDocuments`)
**Filter:** `verificationStatus = APPROVED`

**Logic:** Tương tự như Pending, nhưng chỉ lấy các document đã được approve.

---

### C. Danh Sách Bị Từ Chối (`getRejectedLegalDocuments`)
**Filter:** `verificationStatus = REJECTED`

**Logic:**
- Tương tự như trên.
- Response bổ sung thêm field `rejectionReason` (Lý do từ chối).

---

### D. Danh Sách Chưa Nộp (`getNotSubmittedRegistrations`)
**Filter:** `verificationStatus = NOT_SUBMITTED` HOẶC không có bản ghi Legal Documents

**Logic:**
- Query các Clinic Admin có `subscriptionStatus` = `PENDING_LEGAL_SETUP` nhưng chưa upload documents.
- Trả về danh sách phòng khám chưa nộp giấy tờ.

---

## ✅ Chức Năng 2: Phê Duyệt Đăng Ký (`approveRegistration`)

**Input:**
- `clinicAdminId` (UUID của Clinic Admin)

**Điều kiện cần:**
1. Clinic Admin phải tồn tại.
2. Phải có Clinic Manager (account con).
3. Legal Documents phải tồn tại và có status = `PENDING_REVIEW`.
4. Subscription phải có status = `PENDING_APPROVAL`.

**Quy trình (Transaction):**
1. **Tìm kiếm:**
   - Clinic Admin account
   - Clinic Manager (child account, role = `CLINIC_MANAGER`)
   - Legal Documents của Manager
   - Subscription của Admin
2. **Validate Status:**
   - Legal Docs: `PENDING_REVIEW` ✅
   - Subscription: `PENDING_APPROVAL` ✅
3. **Update Database:**
   - Legal Documents: `verificationStatus` → `APPROVED`
   - Subscription: `subscriptionStatus` → `PENDING_PAYMENT`
   - `rejectionReason` → `null` (xóa lý do từ chối cũ nếu có)
4. **Commit Transaction.**
5. **Gửi Email:** (Fire-and-forget)
   - Method: `mailerService.sendRegistrationApprovedEmail()`
   - To: Clinic Admin Email
   - Content: Thông báo phê duyệt thành công.

**Response:**
```json
{
  "success": true,
  "message": "Registration approved successfully",
  "data": {
    "subscriptionId": "...",
    "clinicName": "...",
    "newStatus": "PENDING_PAYMENT",
    "emailSent": true,
    "nextStep": "PAYMENT"
  }
}
```

**Error Cases:**
- **404 Not Found:** Không tìm thấy Admin, Manager, Legal Docs, hoặc Subscription.
- **400 Bad Request:** Status không hợp lệ (không phải `PENDING_REVIEW` hoặc `PENDING_APPROVAL`).

---

## ❌ Chức Năng 3: Từ Chối Đăng Ký (`rejectRegistration`)

**Input:**
- `clinicAdminId` (UUID)
- `reason` (string, required) - Lý do từ chối

**Điều kiện cần:**
1. `reason` không được empty.
2. Legal Documents status = `PENDING_REVIEW`.
3. Subscription status = `PENDING_APPROVAL`.

**Quy trình (Transaction):**
1. **Tìm kiếm:** (giống như Approve)
2. **Validate Status:** (giống như Approve)
3. **Update Database:**
   - Legal Documents:
     - `verificationStatus` → `REJECTED`
     - `rejectionReason` → `reason` (lưu lý do)
   - **⚠️ QUAN TRỌNG:** Subscription:
     - `subscriptionStatus` → `PENDING_LEGAL_SETUP` (KHÔNG PHẢI `REJECTED`)
     - Cho phép user upload lại giấy tờ
4. **Commit Transaction.**
5. **Gửi Email:** (Fire-and-forget)
   - Method: `mailerService.sendRegistrationRejectedEmail()`
   - To: Clinic Admin Email
   - Content: Thông báo từ chối + lý do.

**Response:**
```json
{
  "success": true,
  "message": "Registration rejected",
  "data": {
    "subscriptionId": "...",
    "clinicName": "...",
    "newStatus": "PENDING_LEGAL_SETUP",
    "rejectionReason": "...",
    "emailSent": true,
    "nextStep": "RESUBMIT_DOCUMENTS"
  }
}
```

**Error Cases:**
- **400 Bad Request:**
  - `reason` trống
  - Status không hợp lệ
- **404 Not Found:** Không tìm thấy resource.

---

## 🔐 RBAC - Role-Based Access Control

**Endpoint Protection:**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AccountRole.ADMIN)
```

**Logic:**
- Chỉ user có `role = ADMIN` mới được phép gọi các endpoint trong module này.
- Các role khác (`CLINIC_ADMIN`, `CLINIC_MANAGER`, `PATIENT`, `DOCTOR`, etc.) sẽ bị từ chối với `403 Forbidden`.

---

## 📊 Pagination & Sorting

**Default Values:**
- `page` = 1
- `limit` = 10
- `sortBy` = `createdAt`
- `sortOrder` = `DESC`

**Response Meta:**
```json
{
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 25,
    "totalPages": 3
  }
}
```

---

## 🔄 State Transition Diagram

```
Registration Flow (Admin Side):

PENDING_APPROVAL (Subscription) + PENDING_REVIEW (Legal Docs)
        │
        ├─── APPROVE ──→ PENDING_PAYMENT (Subscription) + APPROVED (Legal Docs)
        │                     │
        │                     └──→ [User thanh toán]
        │
        └─── REJECT ──→ PENDING_LEGAL_SETUP (Subscription) + REJECTED (Legal Docs)
                             │
                             └──→ [User upload lại giấy tờ]
```

---

## 📧 Email Notifications

### Approval Email
- **Subject:** "Đăng Ký Phòng Khám Được Phê Duyệt"
- **Content:** Chúc mừng, hướng dẫn thanh toán
- **CTA:** Link đến trang thanh toán

### Rejection Email
- **Subject:** "Đăng Ký Phòng Khám Bị Từ Chối"
- **Content:** Lý do từ chối, hướng dẫn upload lại
- **CTA:** Link đến trang upload documents

**Note:** Email được gửi **sau khi transaction commit thành công** để tránh data inconsistency.

---

## ⚡ Performance Considerations

1. **Transaction:** Sử dụng `QueryRunner` để đảm bảo atomicity.
2. **Email:** Fire-and-forget (không block response).
3. **Indexing:** Đánh index trên `verificationStatus` và `subscriptionStatus` để tăng tốc query.
4. **Pagination:** Luôn sử dụng pagination để tránh load quá nhiều data.

---

## 🧪 Testing Coverage

Xem file `test_cases_summary.md` để biết chi tiết các test case được implement.
