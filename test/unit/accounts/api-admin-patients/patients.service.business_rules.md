# QUY TẮC NGHIỆP VỤ - QUẢN LÝ PATIENT (GÓC NHÌN SYSTEM ADMIN)

## TỔNG QUAN

Tài liệu này mô tả các quy tắc nghiệp vụ được kiểm tra trong unit test cho các chức năng SYSTEM ADMIN quản lý tài khoản PATIENT: xem thống kê lịch sử đặt lịch theo phòng khám/chi nhánh, cảnh cáo/cấm tài khoản theo số lần vi phạm và xem lịch sử xử lý.

---

## FLOW 1: THỐNG KÊ LỊCH SỬ ĐẶT LỊCH CỦA PATIENT (getAppointmentStatistics)

### Quy Tắc BR-PAT-01: PATIENT Phải Tồn Tại

**Điều kiện**:
- PATIENT cần tra cứu thống kê phải tồn tại.

**Mục đích**:
- Tránh trả về dữ liệu cho định danh không hợp lệ.

### Quy Tắc BR-PAT-02: Tổng Hợp Theo Phòng Khám/Chi Nhánh

**Chính sách tổng hợp**:
- Thống kê được nhóm theo từng phòng khám/chi nhánh mà PATIENT đã đặt lịch.
- Mỗi nhóm thể hiện số lượt đặt lịch và thời điểm đặt lịch gần nhất.

**Mục đích**:
- Cho phép SYSTEM ADMIN nắm hành vi sử dụng dịch vụ của PATIENT theo từng đơn vị cung cấp.

### Quy Tắc BR-PAT-03: Fallback Tên Hiển Thị Khi Thiếu Dữ Liệu

**Chính sách**:
- Nếu thiếu tên chi nhánh: hiển thị 'Unknown Branch'.
- Nếu thiếu tên thương hiệu phòng khám: hiển thị 'Unknown Brand'.

**Mục đích**:
- Đảm bảo báo cáo/hiển thị không bị rỗng và có thể đọc được khi dữ liệu phụ trợ chưa đầy đủ.

---

## FLOW 2: CẢNH CÁO / CẤM PATIENT (banPatient)

### Quy Tắc BR-PAT-04: Tăng Số Lần Vi Phạm Khi Bị Xử Lý

**Chính sách**:
- Mỗi lần SYSTEM ADMIN xử lý vi phạm, số lần vi phạm (`banCounts`) tăng thêm 1.

**Mục đích**:
- Ghi nhận lịch sử và dùng làm ngưỡng quyết định trạng thái tài khoản.

### Quy Tắc BR-PAT-05: Ngưỡng 3 Lần Vi Phạm Sẽ Bị CẤM (BAN)

**Chính sách**:
- Khi `banCounts` đạt từ 3 trở lên: PATIENT bị chuyển sang trạng thái `BAN`.
- Khi `banCounts` dưới 3: PATIENT chỉ nhận cảnh cáo.

**Mục đích**:
- Áp dụng cơ chế kỷ luật theo mức độ tái phạm.

---

## FLOW 3: GỠ CẤM PATIENT (unbanPatient)

### Quy Tắc BR-PAT-06: Chỉ Gỡ Cấm Khi Tài Khoản Đang Ở Trạng Thái BAN

**Chính sách**:
- Chỉ khi PATIENT đang bị cấm (`BAN`) thì mới thực hiện khôi phục:
  - Trạng thái về `ACTIVE`
  - Reset số lần vi phạm về 0
  - Xóa mô tả vi phạm

**Mục đích**:
- Tránh thay đổi trạng thái không cần thiết đối với tài khoản đang hoạt động.

---

## FLOW 4: XEM LỊCH SỬ XỬ LÝ VI PHẠM (getBanHistory)

### Quy Tắc BR-PAT-07: Chỉ Trả Về Lịch Sử Khi PATIENT Tồn Tại

**Điều kiện**:
- PATIENT cần xem lịch sử phải tồn tại.

**Mục đích**:
- Tránh truy xuất lịch sử cho tài khoản không hợp lệ.

### Quy Tắc BR-PAT-08: Lịch Sử Được Sắp Xếp Mới Nhất Trước

**Chính sách**:
- Lịch sử xử lý vi phạm được sắp xếp theo thời gian giảm dần.

**Mục đích**:
- Ưu tiên hiển thị sự kiện gần nhất để hỗ trợ nghiệp vụ.

---

## TÓM TẮT QUY TẮC QUAN TRỌNG NHẤT

1. PATIENT bị cấm khi đạt ngưỡng 3 lần vi phạm; dưới ngưỡng chỉ cảnh cáo.
2. Chỉ gỡ cấm khi tài khoản đang BAN, đồng thời reset bộ đếm vi phạm.
3. Thống kê đặt lịch có fallback tên hiển thị khi thiếu dữ liệu.
4. Lịch sử xử lý vi phạm hiển thị theo thứ tự mới nhất trước.

---

## BỔ SUNG NGHIỆP VỤ QUÉT TOÀN DIỆN

### Quy Tắc BR-PAT-09: Ban/Unban phải đi qua transaction để đảm bảo toàn vẹn dữ liệu

**Chính sách**:
- Các thao tác thay đổi trạng thái PATIENT (`banPatient`, `unbanPatient`) đều xử lý trong transaction.
- Khi phát sinh lỗi giữa chừng, hệ thống rollback và không để trạng thái nửa chừng.

### Quy Tắc BR-PAT-10: Luôn ghi nhận lịch sử xử lý khi có quyết định kỷ luật hoặc gỡ kỷ luật

**Chính sách**:
- Ban cảnh cáo/ban hẳn/gỡ ban đều phải có bản ghi lịch sử phục vụ audit.

### Quy Tắc BR-PAT-11: Thông báo email phụ thuộc trạng thái xử lý thực tế

**Chính sách**:
- Dưới ngưỡng BAN: gửi email cảnh cáo.
- Đạt ngưỡng BAN: gửi email thông báo bị khóa.
- Gỡ BAN thành công: gửi email mở khóa.

### Quy Tắc BR-PAT-12: Gỡ BAN không hợp lệ thì không phát sinh email mở khóa

**Chính sách**:
- Nếu tài khoản không ở trạng thái `BAN`, hệ thống không gửi email unban.

### Quy Tắc BR-PAT-13: Tên hiển thị trong email có cơ chế fallback

**Chính sách**:
- Ưu tiên `generalAccount.fullName`, sau đó `username`, cuối cùng fallback `'Patient'` để đảm bảo nội dung thông báo luôn đầy đủ.
