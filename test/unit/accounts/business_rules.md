# QUY TẮC NGHIỆP VỤ - LƯU TRÌNH ĐĂNG KÝ ADMIN PHÒNG KHÁM

## TỔNG QUAN

Tài liệu này mô tả các quy tắc nghiệp vụ được kiểm tra trong các unit test cho luồng đăng ký admin phòng khám. Các quy tắc này đảm bảo tính toàn vẹn dữ liệu, bảo mật, và tuân thủ các yêu cầu nghiệp vụ.

---

## BƯỚC 2: KHỞI TẠO TÀI KHOẢN VỚI DỮ LIỆU THANH TOÁN

### Quy Tắc Email (Email Uniqueness)

**Ràng Buộc Chính**: Một email chỉ được sử dụng tối đa 2 lần:
- 1 lần cho tài khoản CLINIC_ADMIN
- 1 lần cho tài khoản CLINIC_MANAGER

**Các Trường Hợp Kiểm Tra**:

1. ✅ **Email chưa tồn tại**: Cho phép đăng ký
2. ❌ **Email đã được sử dụng bởi CLINIC_ADMIN**: Từ chối với `ConflictException`
3. ❌ **Email đã được sử dụng bởi CLINIC_MANAGER**: Từ chối với `ConflictException`
4. ✅ **Email đã được sử dụng bởi PATIENT**: Cho phép đăng ký (vai trò khác nhau)

### Quy Tắc Tạo Tài Khoản

**Yêu Cầu Bắt Buộc**:
- Mật khẩu phải được băm (hash) trước khi lưu trữ bằng bcrypt
- Vai trò (role) phải được đặt là `CLINIC_ADMIN`
- Trạng thái (status) phải được đặt là `ACTIVE`
- Tất cả dữ liệu phải được lưu trong một transaction duy nhất

### Quy Tắc Thông Tin Ngân Hàng

**Dữ Liệu Bắt Buộc**:
- `bankName`: Tên ngân hàng
- `bankNumber`: Số tài khoản ngân hàng (được mã hóa)
- `bankBranch`: Chi nhánh ngân hàng
- `sepayVa`: Số tài khoản ảo SePay (để nhận thanh toán)

**Lưu Ý Bảo Mật**:
- Các trường nhạy cảm sử dụng `encryptionTransformer` để mã hóa tự động
- Dữ liệu ngân hàng được lưu trữ trong bảng `ClinicAdminInformation`

### Quy Tắc Subscription (Gói Đăng Ký)

**Trạng Thái Ban Đầu**:
- Subscription phải được tạo với trạng thái `PENDING_SEPAY_SETUP`
- Liên kết với `serviceId` được chọn bởi người dùng
- `subscriptionDate` được đặt là thời điểm hiện tại

### Quy Tắc Email Chào Mừng

**Điều Kiện Gửi**:
- Email chào mừng được gửi sau khi transaction commit thành công
- Sử dụng cơ chế "fire-and-forget" (không chặn luồng chính nếu thất bại)
- Chứa tên phòng khám và hướng dẫn bước tiếp theo

### Quy Tắc Transaction (Giao Dịch Cơ Sở Dữ Liệu)

**Nguyên Tắc ACID**:
- Tất cả các bước phải hoàn thành thành công hoặc không có bước nào được thực hiện
- Rollback tự động khi có lỗi xảy ra
- Release connection trong khối `finally` để tránh rò rỉ tài nguyên

---

## BƯỚC 4A: THIẾT LẬP CLINIC MANAGER

### Quy Tắc Quyền Hạn (Authorization)

**Actor Hợp Lệ**:
- Chỉ tài khoản có vai trò `CLINIC_ADMIN` mới được tạo manager
- Người dùng khác sẽ nhận được `ForbiddenException`

### Quy Tắc Trạng Thái (Status Transition)

**Trạng Thái Yêu Cầu**:
- Subscription status phải là `PENDING_MANAGER_SETUP`
- Bất kỳ trạng thái nào khác sẽ bị từ chối với `ForbiddenException`

### Quy Tắc Số Lượng Manager

**Ràng Buộc 1-1**:
- Mỗi CLINIC_ADMIN chỉ được tạo **DUY NHẤT 1** CLINIC_MANAGER
- Nếu đã tồn tại manager, từ chối với `ConflictException`

### Quy Tắc Email Manager

**Độc Lập hoặc Trùng Lặp**:
- Email manager có thể trùng với email admin (được phép)
- Email không được trùng với bất kỳ tài khoản nào khác

### Quy Tắc Liên Kết Quan Hệ (Relationship)

**Parent-Child Linkage**:
- Manager được liên kết với Admin thông qua trường `parentId`
- `parentId` của Manager phải bằng `_id` của Admin
- Đây là mối quan hệ chủ-chi nhánh (master-branch relationship)

### Quy Tắc Địa Chỉ (Address Mapping)

**Lưu Trữ Đầy Đủ**:
- DTO chứa cả mã (code) và tên (name):
  - `provinceCode` → `province`
  - `provinceName` → `provinceName`
  - `districtCode` → `district`
  - `districtName` → `districtName`
  - `wardCode` → `ward`
  - `wardName` → `wardName`
  - `addressDetail` → `address`

**Mục Đích**:
- Lưu cả mã và tên để tránh phụ thuộc vào dịch vụ API bên ngoài
- Đảm bảo hiển thị đúng ngay cả khi dữ liệu địa giới hành chính thay đổi

### Quy Tắc Chuyển Trạng Thái

**Chuyển Đổi Tự Động**:
- Sau khi tạo manager thành công: `PENDING_MANAGER_SETUP` → `PENDING_LEGAL_SETUP`

### Quy Tắc Email Thông Tin Đăng Nhập

**Gửi Thông Tin Tự Động**:
- Email chứa username và mật khẩu tạm thời
- Gửi đến địa chỉ email của manager
- Chứa tên phòng khám để làm context

---

## BƯỚC 4B: TẢI LÊN TÀI LIỆU PHÁP LÝ

### Quy Tắc Quyền Hạn (Ownership Validation)

**Xác Thực Chủ Sở Hữu**:
- Chỉ Admin sở hữu manager mới được tải tài liệu cho manager đó
- Kiểm tra: `manager.parentId === clinicAdminId`
- Vi phạm dẫn đến `ForbiddenException`

### Quy Tắc Vai Trò (Role Validation)

**Kiểm Tra Kép**:
1. Actor phải là `CLINIC_ADMIN`
2. Manager phải là `CLINIC_MANAGER`

### Quy Tắc Trạng Thái

**Trạng Thái Cho Phép Tải Lên**:
- `PENDING_LEGAL_SETUP`: Lần đầu tải lên
- `REJECTED`: Tải lại sau khi bị từ chối

### Quy Tắc Tài Liệu

**Tài Liệu Bắt Buộc**:
- `operatingLicense`: Giấy phép hoạt động
- `businessLicense`: Giấy phép kinh doanh
- `taxIdUrl` (tùy chọn): Mã số thuế
- `otherDocs` (tùy chọn): Tài liệu khác

### Quy Tắc Trạng Thái Xác Minh

**Luồng Xác Minh**:
- Sau khi tải lên: `verificationStatus` = `PENDING_REVIEW`
- Subscription status chuyển sang: `PENDING_APPROVAL`

### Quy Tắc Cập Nhật

**Xử Lý Tài Liệu Đã Tồn Tại**:
- Nếu tài liệu đã tồn tại: Cập nhật (update)
- Nếu tài liệu chưa tồn tại: Tạo mới (create)
- Luôn đặt lại `verificationStatus` thành `PENDING_REVIEW`

---

## BƯỚC 8.1: HỦY ĐĂNG KÝ (HARD DELETE)

### Quy Tắc Trạng Thái Bị Cấm (Forbidden Statuses)

**Không Được Phép Hủy Khi**:

1. ❌ **PENDING_APPROVAL**: 
   - Lý do: Admin hệ thống đang xem xét tài liệu
   - Người dùng phải chờ quyết định (Approved hoặc Rejected)
   - Exception: `BadRequestException` with message về việc chờ xét duyệt

2. ❌ **ACTIVE**:
   - Lý do: Subscription đang hoạt động, đã thanh toán
   - Phải sử dụng soft cancel (Hủy gói) thay vì hard delete
   - Exception: `BadRequestException`

3. ❌ **NON_RENEWING**:
   - Lý do: Gói đã bị hủy, đang chờ hết hạn tự nhiên
   - Exception: `BadRequestException`

4. ❌ **EXPIRED**:
   - Lý do: Subscription đã hết hạn
   - Exception: `BadRequestException`

### Quy Tắc Kiểm Tra Transaction

**Cấm Hard Delete Sau Thanh Toán**:
- Kiểm tra xem có transaction `SUCCESS` không
- Nếu có: Từ chối với `BadRequestException`
- Ngăn xóa dữ liệu sau khi đã nhận tiền

### Quy Tắc Trạng Thái Cho Phép (Allowed Statuses)

**Được Phép Hủy Khi**:
- ✅ `PENDING_SEPAY_SETUP`: Đăng ký mới, chưa xác nhận thanh toán
- ✅ `PENDING_MANAGER_SETUP`: Đã xác nhận thanh toán, chưa tạo manager
- ✅ `PENDING_LEGAL_SETUP`: Đã tạo manager, chưa tải tài liệu
- ✅ `REJECTED`: Tài liệu bị từ chối
- ✅ `PENDING_PAYMENT`: Đã được duyệt, chưa thanh toán

### Quy Tắc Thứ Tự Xóa (Deletion Order)

**Thứ Tự Nghiêm Ngặt (Reverse FK Order)**:

1. `ClinicsLegalDocuments` (FK → Manager Account)
2. `ClinicManagerInformation` (FK → Manager Account)
3. `Account` (Manager với `parentId` = Admin ID)
4. `Transaction` (PENDING transactions cho clinic)
5. `ClinicSubscription` (FK → Admin Account)
6. `ClinicAdminInformation` (FK → Admin Account)
7. `Account` (Admin)

**Lý Do**:
- Xóa theo thứ tự ngược lại với foreign key constraints
- Tránh lỗi vi phạm ràng buộc tham chiếu (referential integrity)

### Quy Tắc Atomicity

**Transaction An Toàn**:
- Tất cả các bước xóa phải thành công hoặc không có bước nào được thực hiện
- Rollback nếu bất kỳ bước nào thất bại
- Release connection trong mọi trường hợp

---

## BƯỚC 8.2 & 8.3: HỦY GÓI VÀ HẾT HẠN TỰ NHIÊN

### Quy Tắc Soft Cancel (NON_RENEWING)

**Hủy Mềm**:
- Chuyển trạng thái: `ACTIVE` → `NON_RENEWING`
- Người dùng giữ quyền truy cập đầy đủ cho đến `expirationDate`
- KHÔNG xóa bất kỳ dữ liệu nào
- Ghi lại trong lịch sử (`ClinicSubscriptionHistory`)

### Quy Tắc Hết Hạn Tự Nhiên

**Expiration Logic**:
- Áp dụng cho cả `ACTIVE` và `NON_RENEWING`
- Điều kiện: `expirationDate < NOW()`
- Chuyển sang: `EXPIRED`
- Revoke quyền truy cập ngay lập tức

---

## BƯỚC 13: CÀ TÍCH DAILY SWEEPER (CRON JOB)

### Quy Tắc Phase 1: Notification Engine

**Điều Kiện Gửi Email Nhắc Nhở**:
- Chỉ gửi cho subscription có status `ACTIVE`
- **Chính Sách Im Lặng**: KHÔNG gửi cho `NON_RENEWING` (người dùng đã quyết định hủy)

**Logic Email 7 Ngày**:
- **Có Queue**: Gửi email REASSURANCE (yên tâm, gia hạn đã được lên lịch)
- **Không Có Queue**: Gửi email WARNING (cảnh báo, cần gia hạn)

**Logic Email 1 Ngày**:
- **Có Queue**: Gửi email REASSURANCE (gia hạn diễn ra vào ngày mai)
- **Không Có Queue**: Gửi email WARNING URGENT (khẩn cấp, hết hạn ngày mai)

### Quy Tắc Phase 2: State Transition Engine

**Scenario A - Renewal (Có Queue)**:
1. Cập nhật subscription với dữ liệu từ queue:
   - `serviceId` → `queue.nextServiceId`
   - `subscriptionDate` → `queue.targetStartDate`
   - `expirationDate` → `queue.targetEndDate`
   - `subscriptionStatus` → `ACTIVE` (giữ nguyên trạng thái hoạt động)
2. Xóa queue record (cleanup, single-use)
3. Gửi email thông báo gia hạn thành công

**Scenario B - Expiration (Không Queue)**:
1. Cập nhật subscription:
   - `subscriptionStatus` → `EXPIRED`
   - Giữ nguyên tất cả các trường khác
2. Revoke quyền truy cập
3. Gửi email thông báo hết hạn

### Quy Tắc Xử Lý NON_RENEWING

**Tự Động Hết Hạn**:
- NON_RENEWING subscriptions không bao giờ có renewal queue
- Khi hết hạn: Luôn chuyển sang `EXPIRED` (Scenario B)
- KHÔNG kiểm tra queue (tối ưu hóa)

### Quy Tắc Transaction Per Subscription

**Độc Lập**:
- Mỗi subscription được xử lý trong transaction riêng biệt
- Lỗi của một subscription không ảnh hưởng đến các subscription khác
- Đảm bảo tính cô lập (isolation)

### Quy Tắc Idempotency

**Không Xử Lý Lại**:
- Loại trừ status `EXPIRED` khỏi query
- Đảm bảo mỗi subscription chỉ được xử lý một lần
- Tránh xử lý trùng lặp

---

## TÓM TẮT CÁC QUY TẮC QUAN TRỌNG NHẤT

### 1. Email Uniqueness
- Max 2 lần sử dụng: 1 CLINIC_ADMIN + 1 CLINIC_MANAGER

### 2. Transaction Atomicity
- Tất cả hoặc không có gì (All or Nothing)
- Rollback tự động khi lỗi
- Release connection trong `finally` block

### 3. Status Transition Flow
```
PENDING_SEPAY_SETUP 
  → PENDING_MANAGER_SETUP 
  → PENDING_LEGAL_SETUP 
  → PENDING_APPROVAL 
  → PENDING_PAYMENT 
  → ACTIVE 
  → [NON_RENEWING] (optional)
  → EXPIRED
```

### 4. Ownership Validation
- Manager.parentId === Admin._id
- Chỉ admin sở hữu mới có quyền quản lý

### 5. Address Field Mapping
- Lưu cả code và name để độc lập với API bên ngoài

### 6. Hard Delete Order
- Xóa theo thứ tự ngược với foreign key dependency

### 7. PENDING_APPROVAL Protection
- Không được phép hủy khi đang chờ xét duyệt
- Bảo vệ quá trình review của admin

### 8. NON_RENEWING Silence Policy
- Không gửi email nhắc nhở cho subscription đã bị hủy
- Tôn trọng quyết định của người dùng

### 9. Transaction Isolation
- Mỗi subscription trong cron job xử lý độc lập
- Lỗi của một subscription không ảnh hưởng subscription khác

### 10. Idempotency Guarantee
- Mỗi subscription chỉ được xử lý một lần
- Loại trừ EXPIRED khỏi query để tránh xử lý lại

---

## PHỤ LỤC: CÁC EXCEPTION VÀ THÔNG ĐIỆP

### ConflictException
- Email đã tồn tại cho CLINIC_ADMIN/CLINIC_MANAGER
- Manager đã tồn tại cho admin này

### ForbiddenException
- Vai trò không hợp lệ
- Không phải chủ sở hữu
- Trạng thái subscription không đúng

### BadRequestException
- Trạng thái không hợp lệ cho thao tác
- Có transaction SUCCESS (không được hard delete)
- PENDING_APPROVAL (không được hủy)

### NotFoundException
- Account không tồn tại
- Subscription không tồn tại
- Manager không tồn tại

---

**LƯU Ý**: Tất cả các quy tắc này được kiểm tra và xác minh thông qua unit tests để đảm bảo tính đúng đắn và nhất quán của hệ thống.
