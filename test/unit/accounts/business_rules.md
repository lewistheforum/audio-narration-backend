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

### Quy Tắc Trạng Thái Tài Khoản Manager (Account Status)

**Trạng Thái Ban Đầu Khi Tạo**:
- Manager Account được tạo với `status = PENDING_APPROVAL`
- Manager **KHÔNG THỂ đăng nhập** khi status = `PENDING_APPROVAL`
- Manager chỉ có thể truy cập hệ thống sau khi status = `ACTIVE`

**Luồng Chuyển Trạng Thái**:
```
PENDING_APPROVAL (Tạo mới)
      │
      ├─── System Admin Phê Duyệt ──→ ACTIVE (Manager có thể đăng nhập)
      │
      └─── System Admin Từ Chối ──→ PENDING_APPROVAL (Vẫn giữ nguyên, chờ nộp lại)
```

**Lý Do Áp Dụng**:
- Đảm bảo Manager chỉ hoạt động sau khi giấy tờ pháp lý được phê duyệt
- Ngăn chặn Manager truy cập hệ thống trước khi hoàn tất quy trình đăng ký
- Tuân thủ quy định pháp lý về hoạt động phòng khám

**Xác Thực Đăng Nhập**:
- Hệ thống phải kiểm tra `status = ACTIVE` trước khi cho phép Manager đăng nhập
- Nếu status ≠ ACTIVE → Reject login với thông báo rõ ràng

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

## CLINIC ADMIN FEATURE SET - QUY TẮC NGHIỆP VỤ QUẢN LÝ MANAGER

### SECTION 2: XÁC THỰC TRẠNG THÁI MANAGER (validateManagerStatus)

#### Mục Đích
Kiểm tra trạng thái của tài khoản CLINIC_MANAGER trước khi cho phép các thao tác quan trọng như:
- Tạo Staff/Doctor (CREATE_STAFF operation)
- Vô hiệu hóa Manager (DISABLE operation)
- Kích hoạt lại Manager (ENABLE operation)

#### Quy Tắc BR-01: Kiểm Tra Tồn Tại Manager
**Điều Kiện**: Manager account phải tồn tại trong database
**Exception**: `NotFoundException`
**Message**: "Manager account not found"
**Áp Dụng**: Tất cả operations (CREATE_STAFF, ENABLE, DISABLE)

#### Quy Tắc BR-02: Xác Thực Role
**Điều Kiện**: Account phải có role = CLINIC_MANAGER
**Exception**: `ForbiddenException`
**Message**: "Account is not a clinic manager"
**Lý Do**: Đảm bảo operation chỉ áp dụng cho Manager, không phải Staff/Doctor/Admin

#### Quy Tắc BR-03: Chặn Tạo Staff Khi Manager PENDING_APPROVAL
**Operation**: CREATE_STAFF
**Điều Kiện**: Manager status = PENDING_APPROVAL
**Exception**: `ForbiddenException`
**Message**: "Cannot create staff. Manager legal documents pending approval. Please complete document verification first."
**Lý Do**: Manager chưa được phê duyệt giấy phép → không thể tạo nhân sự

#### Quy Tắc BR-04: Chặn Tạo Staff Khi Manager MANAGER_DISABLED
**Operation**: CREATE_STAFF
**Điều Kiện**: Manager status = MANAGER_DISABLED
**Exception**: `ForbiddenException`
**Message**: "Cannot create staff. Manager account is disabled. Please contact your clinic administrator."
**Lý Do**: Manager đã bị vô hiệu hóa → chi nhánh không hoạt động

#### Quy Tắc BR-05: Chỉ Manager ACTIVE Mới Tạo Được Staff
**Operation**: CREATE_STAFF
**Điều Kiện**: Manager status không phải ACTIVE (BAN, DELETED, UNVERIFIED, etc.)
**Exception**: `ForbiddenException`
**Message**: "Manager account must be ACTIVE to create staff members."
**Lý Do**: Chỉ Manager hoạt động bình thường mới có quyền tạo nhân sự

#### Quy Tắc BR-06: Chỉ MANAGER_DISABLED Mới Có Thể ENABLE
**Operation**: ENABLE
**Điều Kiện**: Manager status khác MANAGER_DISABLED
**Exception**: `BadRequestException`
**Message**: "Can only enable managers with MANAGER_DISABLED status"
**Lý Do**: Không thể enable Manager đang ở trạng thái khác (ACTIVE, PENDING_APPROVAL, etc.)

#### Quy Tắc BR-07: Chỉ ACTIVE Manager Mới Có Thể DISABLE
**Operation**: DISABLE
**Điều Kiện**: Manager status khác ACTIVE
**Exception**: `BadRequestException`
**Message**: "Can only disable managers with ACTIVE status"
**Lý Do**: Chỉ Manager đang hoạt động mới có thể bị vô hiệu hóa

#### Giá Trị Trả Về
**Success Case**: Trả về Manager Account entity (đã validated)
**Use Case**: Các method khác có thể sử dụng entity này mà không cần query lại database

---

### SECTION 5: CLINIC MANAGER SERVICE - QUẢN LÝ MANAGER

#### FLOW 1: Lấy Danh Sách Manager (getManagerList)

##### Quy Tắc BR-08: Authorization Check
**Điều Kiện**: Người gọi phải là CLINIC_ADMIN
**Exception**: `ForbiddenException`
**Message**: "Only clinic admins can view manager list"
**Validation**: 
- Kiểm tra admin account tồn tại
- Kiểm tra role = CLINIC_ADMIN

##### Quy Tắc BR-09: Pagination Handling
**Default Values**:
- `page` = 1
- `limit` = 10
- `sortBy` = 'createdAt'
- `sortOrder` = 'DESC'

**Calculation**:
- `totalPages` = Math.ceil(totalItems / limit)

##### Quy Tắc BR-10: Data Mapping
**Personnel Count**: Hiển thị số lượng Staff và Doctor thuộc mỗi Manager
**Legal Doc Status**: Hiển thị 'NOT_SUBMITTED' nếu không có legal documents
**Province**: Hiển thị 'N/A' nếu không có address

##### Quy Tắc BR-11: Hiển Thị Tất Cả Trạng Thái
**Requirement**: Danh sách bao gồm Manager ở TẤT CẢ các trạng thái:
- ACTIVE
- PENDING_APPROVAL
- MANAGER_DISABLED
- BAN
- DELETED (nếu soft delete)

---

#### FLOW 2: Xem Chi Tiết Manager (getManagerDetail)

##### Quy Tắc BR-12: Ownership Verification
**Điều Kiện**: Manager phải thuộc về CLINIC_ADMIN đang gọi
**Validation**: manager.parentId === clinicAdminId
**Exception**: `ForbiddenException`
**Message**: "You do not have access to this manager"

##### Quy Tắc BR-13: Personnel List Logic - PENDING_APPROVAL
**Điều Kiện**: Manager status = PENDING_APPROVAL
**Hành Động**: `personnel` array = [] (empty)
**Lý Do**: Manager chưa được phê duyệt → không hiển thị nhân sự để bảo mật

##### Quy Tắc BR-14: Personnel List Logic - MANAGER_DISABLED
**Điều Kiện**: Manager status = MANAGER_DISABLED
**Hành Động**: Hiển thị FULL personnel list
**Lý Do**: Manager chỉ tạm vô hiệu → Admin cần xem danh sách để quản lý

##### Quy Tắc BR-15: Personnel Filtering
**Điều Kiện**: Lọc bỏ các account đã bị soft delete
**Logic**: `child.deletedAt === null`
**Mục Đích**: Chỉ hiển thị Staff/Doctor đang hoạt động

##### Quy Tắc BR-16: Graceful Degradation
**Missing Address**: Trả về empty strings cho tất cả address fields
**Missing Legal Docs**: verificationStatus = 'NOT_SUBMITTED'
**Missing Google Iframe**: googleMapIframe = null

---

#### FLOW 3: Tạo Manager Mới (createManager)

##### Quy Tắc BR-17: Email Uniqueness
**Điều Kiện**: Email chưa được sử dụng bởi BẤT KỲ account nào
**Exception**: `ConflictException`
**Message**: "Email đã được sử dụng trong hệ thống"

##### Quy Tắc BR-18: Initial Status
**Requirement**: Manager mới luôn được tạo với status = PENDING_APPROVAL
**Lý Do**: Phải chờ upload và phê duyệt giấy phép trước khi kích hoạt

##### Quy Tắc BR-19: Transaction Atomicity
**Components Tạo Đồng Thời**:
1. Account entity (với RSA keypair)
2. ClinicManagerInformation
3. Address
4. GoogleIframe (optional)

**Rollback Trigger**: Bất kỳ lỗi nào trong quá trình tạo

##### Quy Tắc BR-20: Password Security
**Hashing**: Sử dụng bcrypt với salt rounds = 10
**Timing**: Hash password TRƯỚC khi lưu vào database

##### Quy Tắc BR-21: Optional GoogleMapIframe
**Điều Kiện**: Chỉ tạo GoogleIframe nếu `dto.googleMapIframe` được cung cấp
**Validation**: Không lỗi nếu không có iframe

---

#### FLOW 4: Cập Nhật Giấy Phép (updateLegalDocuments)

##### Quy Tắc BR-22: Re-Approval Workflow (CRITICAL)
**Trigger**: Bất kỳ update nào vào legal documents
**Actions**:
1. Legal doc `verificationStatus` → PENDING_REVIEW
2. Manager `status` → PENDING_APPROVAL (nếu không phải PENDING_APPROVAL)
3. Clear `rejectionReason` (nếu có)

**Mục Đích**: Đảm bảo Admin phê duyệt lại mỗi khi có thay đổi

##### Quy Tắc BR-23: Freeze Branch Operations
**Effect**: Sau khi update legal docs:
- Manager không thể tạo Staff/Doctor mới
- Staff/Doctor hiện tại không thể login (nếu Manager status = PENDING_APPROVAL)
**Duration**: Cho đến khi Admin approve lại

##### Quy Tắc BR-24: Partial Update Support
**Logic**: Chỉ update fields được cung cấp trong DTO
**Preservation**: Giữ nguyên các field không được update
**Example**: Nếu chỉ update `operatingLicense`, các field khác không thay đổi

##### Quy Tắc BR-25: Create vs Update
**Auto-Detection**: Service tự động phát hiện:
- Nếu legal docs chưa tồn tại → Create new
- Nếu đã tồn tại → Update existing

---

#### FLOW 7: Vô Hiệu Hóa Manager (disableManager)

##### Quy Tắc BR-26: State Transition Rule
**Allowed**: ACTIVE → MANAGER_DISABLED
**Blocked**: Tất cả các trạng thái khác
**Exception**: `BadRequestException` nếu không phải ACTIVE

##### Quy Tắc BR-27: Cascading Login Block
**Effect**: Staff và Doctor thuộc Manager bị chặn login
**Implementation**: Qua `validateParentManagerStatus` trong AuthService
**Database Impact**: KHÔNG thay đổi status của Staff/Doctor (read-only cascade)

##### Quy Tắc BR-28: Personnel Count Reporting
**Requirement**: Response message phải bao gồm:
- Số Staff bị ảnh hưởng
- Số Doctor bị ảnh hưởng
**Purpose**: Admin biết được impact của hành động disable

---

#### FLOW 8: Kích Hoạt Lại Manager (enableManager)

##### Quy Tắc BR-29: State Transition Rule
**Allowed**: MANAGER_DISABLED → ACTIVE
**Blocked**: Tất cả các trạng thái khác
**Exception**: `BadRequestException` nếu không phải MANAGER_DISABLED

##### Quy Tắc BR-30: Restore Access
**Effect**: Staff và Doctor được phép login trở lại
**Activation**: Ngay lập tức sau khi status chuyển sang ACTIVE
**No Additional Steps**: Không cần thao tác gì thêm từ Staff/Doctor

---

#### FLOW 5: Xóa Mềm Manager (softDeleteManager)

##### Quy Tắc BR-31: Block Delete ACTIVE Manager
**Điều Kiện**: Manager status = ACTIVE
**Exception**: `BadRequestException`
**Message**: "Cannot delete an ACTIVE manager. Please disable the manager first."
**Enforcement**: Buộc Admin phải disable trước khi delete

##### Quy Tắc BR-32: Block Delete PENDING_REVIEW Docs
**Điều Kiện**: Legal docs verificationStatus = PENDING_REVIEW
**Exception**: `BadRequestException`
**Message**: "Cannot delete manager with legal documents pending review. Please approve or reject the documents first."
**Lý Do**: Admin phải xử lý giấy phép trước khi xóa

##### Quy Tắc BR-33: Allowed Delete States
**States Cho Phép Xóa**:
- PENDING_APPROVAL (Manager chưa được kích hoạt)
- MANAGER_DISABLED (Manager đã bị vô hiệu hóa)
- BAN (Manager bị cấm)

**Implementation**: Soft delete (set `deletedAt` timestamp)

---

**LƯU Ý**: Tất cả các quy tắc này được kiểm tra và xác minh thông qua unit tests để đảm bảo tính đúng đắn và nhất quán của hệ thống.

