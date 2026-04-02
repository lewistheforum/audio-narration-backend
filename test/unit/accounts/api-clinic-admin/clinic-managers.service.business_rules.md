# QUY TẮC NGHIỆP VỤ - QUẢN LÝ CLINIC MANAGER (GÓC NHÌN CLINIC ADMIN)

## TỔNG QUAN

Tài liệu này mô tả các quy tắc nghiệp vụ được kiểm tra trong unit test cho các chức năng CLINIC_ADMIN quản lý CLINIC_MANAGER trực thuộc: cảnh cáo/cấm theo số lần vi phạm, gỡ cấm, áp dụng ảnh hưởng đến tài khoản nhân sự thuộc chi nhánh và xem lịch sử xử lý.

---

## FLOW 1: XÁC THỰC QUYỀN QUẢN LÝ CHI NHÁNH (findAndVerifyManager)

### Quy Tắc BR-CM-01: CLINIC_MANAGER Phải Tồn Tại Và Đúng Vai Trò

**Chính sách**:
- Chi nhánh cần quản lý phải tồn tại và có vai trò `CLINIC_MANAGER`.

**Mục đích**:
- Tránh thao tác nhầm lên đối tượng không phải chi nhánh.

### Quy Tắc BR-CM-02: CLINIC_ADMIN Chỉ Quản Lý Chi Nhánh Thuộc Quyền

**Chính sách**:
- CLINIC_ADMIN chỉ được quản lý CLINIC_MANAGER có `parentId` trùng với `adminId`.

**Mục đích**:
- Ngăn truy cập chéo giữa các phòng khám.

---

## FLOW 2: CẢNH CÁO / CẤM CLINIC MANAGER (banClinicManager)

### Quy Tắc BR-CM-03: Tăng Số Lần Vi Phạm Khi Bị Xử Lý

**Chính sách**:
- Mỗi lần xử lý, số lần vi phạm (`banCounts`) tăng thêm 1 và có thể kèm mô tả.

**Mục đích**:
- Theo dõi tái phạm để áp dụng chế tài.

### Quy Tắc BR-CM-04: Ngưỡng 3 Lần Vi Phạm Sẽ Bị CẤM (BAN)

**Chính sách**:
- Khi `banCounts` đạt từ 3 trở lên: CLINIC_MANAGER bị chuyển sang trạng thái `BAN`.
- Khi `banCounts` dưới 3: CLINIC_MANAGER chỉ nhận cảnh cáo.

**Mục đích**:
- Kỷ luật theo mức độ tái phạm.

### Quy Tắc BR-CM-05: Khi Chi Nhánh Bị BAN, Nhân Sự Thuộc Chi Nhánh Bị BAN Theo

**Chính sách**:
- Khi CLINIC_MANAGER bị BAN, các tài khoản DOCTOR và CLINIC_STAFF thuộc chi nhánh đó cũng bị chuyển sang BAN.

**Mục đích**:
- Bảo đảm việc kỷ luật chi nhánh có hiệu lực đồng bộ lên các tài khoản vận hành dưới quyền.

---

## FLOW 3: GỠ CẤM CLINIC MANAGER (unbanClinicManager)

### Quy Tắc BR-CM-06: Chỉ Gỡ Cấm Khi Chi Nhánh Đang BAN

**Chính sách**:
- Chỉ khi CLINIC_MANAGER đang BAN mới thực hiện khôi phục về ACTIVE và reset bộ đếm vi phạm.

**Mục đích**:
- Tránh thay đổi trạng thái không cần thiết đối với chi nhánh đang hoạt động.

### Quy Tắc BR-CM-07: Khi Gỡ BAN Chi Nhánh, Nhân Sự Thuộc Chi Nhánh Được Khôi Phục Theo

**Chính sách**:
- Khi CLINIC_MANAGER được khôi phục về ACTIVE, các DOCTOR/CLINIC_STAFF thuộc chi nhánh cũng được khôi phục về ACTIVE.

**Mục đích**:
- Khôi phục hoạt động đồng bộ cho chi nhánh.

---

## FLOW 4: XEM LỊCH SỬ XỬ LÝ (getBanHistory)

### Quy Tắc BR-CM-08: Lịch Sử Chỉ Truy Xuất Sau Khi Đã Xác Thực Quyền Quản Lý

**Mục đích**:
- Đảm bảo dữ liệu lịch sử chỉ hiển thị cho CLINIC_ADMIN hợp lệ.

### Quy Tắc BR-CM-09: Lịch Sử Được Sắp Xếp Mới Nhất Trước

**Chính sách**:
- Lịch sử xử lý vi phạm được sắp xếp theo thời gian giảm dần.

---

## TÓM TẮT QUY TẮC QUAN TRỌNG NHẤT

1. CLINIC_ADMIN chỉ quản lý chi nhánh thuộc quyền (đúng parentId).
2. Ngưỡng 3 lần vi phạm chuyển chi nhánh sang BAN; dưới ngưỡng chỉ cảnh cáo.
3. BAN/Gỡ BAN chi nhánh áp dụng đồng bộ lên DOCTOR/CLINIC_STAFF thuộc chi nhánh.
4. Lịch sử xử lý hiển thị mới nhất trước.

---

## BỔ SUNG NGHIỆP VỤ QUÉT TOÀN DIỆN

### Quy Tắc BR-CM-10: Luôn lưu lịch sử xử lý sau mỗi quyết định ban/unban manager

**Chính sách**:
- Mỗi hành động cảnh cáo, ban hẳn hoặc gỡ ban đều phải tạo một bản ghi `BanHistory` để audit.

### Quy Tắc BR-CM-11: Tên hiển thị email cho manager có fallback

**Chính sách**:
- Khi gửi email xử lý vi phạm cho manager, ưu tiên `clinicBranchName`, sau đó `username`, cuối cùng fallback `'Clinic Manager'`.

### Quy Tắc BR-CM-12: Cascade trạng thái chỉ áp dụng cho DOCTOR và CLINIC_STAFF thuộc manager

**Chính sách**:
- Khi ban/unban manager, hệ thống chỉ cập nhật trạng thái các role vận hành trực thuộc (`DOCTOR`, `CLINIC_STAFF`) theo quan hệ parent.

### Quy Tắc BR-CM-13: Nếu manager không ở trạng thái BAN vẫn cho phép ghi nhận hành động unban

**Chính sách**:
- Trường hợp manager chưa BAN, hệ thống không đổi trạng thái nhưng vẫn ghi nhận lịch sử `UNBANNED` để theo dõi thao tác quản trị.
