# QUY TẮC NGHIỆP VỤ - QUẢN LÝ CLINIC ADMIN (GÓC NHÌN SYSTEM ADMIN)

## TỔNG QUAN

Tài liệu này mô tả các quy tắc nghiệp vụ được kiểm tra trong unit test cho các chức năng SYSTEM ADMIN quản lý tài khoản CLINIC_ADMIN: xem danh sách và xem chi tiết kèm thống kê liên quan.

---

## FLOW 1: XEM DANH SÁCH CLINIC ADMIN (findAll)

### Quy Tắc BR-CA-01: Chỉ Bao Gồm Tài Khoản Có Vai Trò CLINIC_ADMIN

**Điều kiện**:
- Danh sách chỉ hiển thị các tài khoản có vai trò `CLINIC_ADMIN`.

**Mục đích**:
- Đảm bảo dữ liệu hiển thị đúng nhóm đối tượng quản trị.

### Quy Tắc BR-CA-02: Hỗ Trợ Tìm Kiếm Theo Thông Tin Nhận Diện

**Điều kiện**:
- Khi có từ khóa tìm kiếm, hệ thống cho phép lọc danh sách theo các thông tin nhận diện cơ bản của CLINIC_ADMIN và tên phòng khám.

**Mục đích**:
- Tăng hiệu quả tra cứu và vận hành.

---

## FLOW 2: XEM CHI TIẾT CLINIC ADMIN (findOne)

### Quy Tắc BR-CA-03: CLINIC_ADMIN Phải Tồn Tại

**Điều kiện**:
- Tài khoản cần xem chi tiết phải tồn tại và đúng vai trò `CLINIC_ADMIN`.

**Mục đích**:
- Tránh trả về dữ liệu sai đối tượng.

### Quy Tắc BR-CA-04: Thống Kê Nhân Sự Theo Cây Quan Hệ

**Chính sách thống kê**:
- Số lượng chi nhánh = số tài khoản `CLINIC_MANAGER` trực thuộc CLINIC_ADMIN.
- Số lượng bác sĩ và nhân viên = tổng tài khoản `DOCTOR` và `CLINIC_STAFF` trực thuộc các chi nhánh.

**Mục đích**:
- Cung cấp bức tranh vận hành tổng quan theo cấu trúc tổ chức của phòng khám.

### Quy Tắc BR-CA-05: Hiển Thị Thông Tin Gói Dịch Vụ Hiện Tại Nếu Có

**Chính sách**:
- Nếu CLINIC_ADMIN có gói dịch vụ hiện tại, hệ thống hiển thị thông tin cơ bản của gói.

**Mục đích**:
- Hỗ trợ SYSTEM ADMIN kiểm tra trạng thái dịch vụ và hỗ trợ khách hàng.

---

## TÓM TẮT QUY TẮC QUAN TRỌNG NHẤT

1. Danh sách chỉ bao gồm CLINIC_ADMIN.
2. Chi tiết hiển thị kèm thống kê theo quan hệ Admin → Manager → (Doctor/Staff).
3. Thông tin gói dịch vụ hiện tại được hiển thị nếu tồn tại.

---

## CAP NHAT SNIPER

### Quy Tắc BR-CA-06: Lịch sử gói dịch vụ fallback tên "Unknown"
- Nếu bản ghi lịch sử không còn liên kết service, hệ thống vẫn trả lịch sử với tên dịch vụ mặc định "Unknown".

### Quy Tắc BR-CA-07: Không có chi nhánh thì trả danh sách dịch vụ rỗng
- Khi CLINIC_ADMIN chưa có CLINIC_MANAGER, API dịch vụ trả `data=[]` và `total=0` thay vì lỗi.

### Quy Tắc BR-CA-08: Phản hồi feedback tách theo loại đối tượng
- Feedback được tách thành 2 nhóm nghiệp vụ: `clinics` và `doctors`.

### Quy Tắc BR-CA-09: Cơ chế cảnh báo trước khi khóa hoàn toàn
- Khi `banCounts` của CLINIC_ADMIN chưa đạt ngưỡng khóa, hệ thống chỉ tăng số lần vi phạm, commit giao dịch và gửi email cảnh báo thay vì khóa toàn bộ mạng lưới.

### Quy Tắc BR-CA-10: Unban chỉ áp dụng đầy đủ cho tài khoản đang bị BAN
- Nếu CLINIC_ADMIN chưa ở trạng thái `BAN`, flow unban không kích hoạt cascade mở khóa và email mở khóa; hệ thống ghi nhận lịch sử và trả kết quả theo trạng thái hiện tại.

### Quy Tắc BR-CA-11: Cơ chế 3 lần vi phạm khóa dây chuyền
- Khi `banCounts` đạt ngưỡng (>=3), hệ thống khóa CLINIC_ADMIN và đồng thời cascade khóa toàn bộ manager + doctor + staff trực thuộc.

### Quy Tắc BR-CA-12: Lưu lịch sử xử lý vi phạm cho mọi hành động ban/unban
- Dù là cảnh báo, khóa hẳn, hay mở khóa, hệ thống đều tạo bản ghi `BanHistory` để phục vụ audit.

### Quy Tắc BR-CA-13: Chi tiết phản hồi chỉ hợp lệ khi feedback thuộc đúng clinic scope
- Khi truy xuất chi tiết feedback, hệ thống kiểm tra feedback theo `feedbackId` và `clinicId`; không khớp thì từ chối.

### Quy Tắc BR-CA-14: Lịch sử ban chỉ truy xuất được cho CLINIC_ADMIN hợp lệ
- Nếu tài khoản không tồn tại hoặc sai role, API lịch sử ban phải trả lỗi không tìm thấy.
