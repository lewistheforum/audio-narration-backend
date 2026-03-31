# QUY TẮC NGHIỆP VỤ - QUẢN LÝ TÀI KHOẢN THUỘC QUYỀN CLINIC MANAGER

## TỔNG QUAN

Tài liệu này mô tả các quy tắc nghiệp vụ được kiểm tra trong unit test cho chức năng CLINIC_MANAGER quản lý các tài khoản thuộc quyền (DOCTOR/CLINIC_STAFF): cảnh cáo/cấm theo số lần vi phạm, gỡ cấm và truy xuất lịch sử xử lý.

---

## FLOW 1: XÁC THỰC QUYỀN SỞ HỮU TÀI KHOẢN (findAndVerifyAccount)

### Quy Tắc BR-MA-01: Chỉ Quản Lý DOCTOR / CLINIC_STAFF

**Chính sách**:
- Chỉ các tài khoản có vai trò DOCTOR hoặc CLINIC_STAFF mới nằm trong phạm vi quản lý.

**Mục đích**:
- Đảm bảo CLINIC_MANAGER không thao tác nhầm lên các vai trò khác.

### Quy Tắc BR-MA-02: Tài Khoản Phải Thuộc Về CLINIC_MANAGER

**Chính sách**:
- CLINIC_MANAGER chỉ được quản lý tài khoản có `parentId` trùng với `managerId`.

**Mục đích**:
- Ngăn truy cập chéo giữa các chi nhánh.

---

## FLOW 2: CẢNH CÁO / CẤM TÀI KHOẢN (banAccount)

### Quy Tắc BR-MA-03: Tăng Số Lần Vi Phạm Khi Bị Xử Lý

**Chính sách**:
- Mỗi lần xử lý, số lần vi phạm (`banCounts`) tăng thêm 1 và có thể kèm mô tả.

**Mục đích**:
- Theo dõi mức độ tái phạm để áp dụng chế tài.

### Quy Tắc BR-MA-04: Ngưỡng 3 Lần Vi Phạm Sẽ Bị CẤM (BAN)

**Chính sách**:
- Khi `banCounts` đạt từ 3 trở lên: tài khoản bị chuyển sang trạng thái `BAN`.
- Khi `banCounts` dưới 3: tài khoản chỉ nhận cảnh cáo.

**Mục đích**:
- Áp dụng cơ chế kỷ luật theo mức độ vi phạm.

---

## FLOW 3: GỠ CẤM TÀI KHOẢN (unbanAccount)

### Quy Tắc BR-MA-05: Chỉ Gỡ Cấm Khi Tài Khoản Đang BAN

**Chính sách**:
- Chỉ khi tài khoản đang BAN mới thực hiện khôi phục:
  - Trạng thái về `ACTIVE`
  - Reset `banCounts` về 0
  - Xóa `banDescription`

**Mục đích**:
- Tránh thay đổi trạng thái không cần thiết đối với tài khoản đang hoạt động.

---

## FLOW 4: XEM LỊCH SỬ XỬ LÝ VI PHẠM (getBanHistory)

### Quy Tắc BR-MA-06: Lịch Sử Chỉ Truy Xuất Sau Khi Đã Xác Thực Quyền Sở Hữu

**Chính sách**:
- Chỉ truy xuất lịch sử khi tài khoản thuộc quyền quản lý của CLINIC_MANAGER.

**Mục đích**:
- Bảo vệ dữ liệu xử lý vi phạm theo từng chi nhánh.

### Quy Tắc BR-MA-07: Lịch Sử Được Sắp Xếp Mới Nhất Trước

**Chính sách**:
- Lịch sử được sắp xếp theo thời gian giảm dần.

**Mục đích**:
- Hỗ trợ thao tác nghiệp vụ dựa trên sự kiện gần nhất.

---

## TÓM TẮT QUY TẮC QUAN TRỌNG NHẤT

1. Chỉ quản lý DOCTOR/CLINIC_STAFF thuộc quyền (đúng parentId).
2. Ngưỡng 3 lần vi phạm chuyển trạng thái sang BAN; dưới ngưỡng chỉ cảnh cáo.
3. Chỉ gỡ cấm khi tài khoản đang BAN, đồng thời reset bộ đếm.
4. Lịch sử xử lý vi phạm hiển thị mới nhất trước.

---

## BỔ SUNG NGHIỆP VỤ QUÉT TOÀN DIỆN

### Quy Tắc BR-MA-08: Luôn ghi lịch sử xử lý cho cả cảnh cáo, ban, và gỡ ban

**Chính sách**:
- Mọi hành động xử lý vi phạm đều phải phát sinh bản ghi `BanHistory` để audit.

### Quy Tắc BR-MA-09: Nội dung email xử lý vi phạm có fallback tên người nhận

**Chính sách**:
- Tên hiển thị ưu tiên `generalAccount.fullName`, sau đó `username`, cuối cùng fallback `'Account Holder'`.

### Quy Tắc BR-MA-10: Hành động unban vẫn được ghi nhận ngay cả khi trạng thái chưa phải BAN

**Chính sách**:
- Trường hợp tài khoản không ở trạng thái BAN, hệ thống vẫn lưu lịch sử `UNBANNED` để theo dõi thao tác quản trị.
