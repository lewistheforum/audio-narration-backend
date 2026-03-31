# QUY TẮC NGHIỆP VỤ - TẠO TÀI KHOẢN PATIENT CHO KHÁCH WALK-IN (CLINIC STAFF)

## TỔNG QUAN

Tài liệu này mô tả các quy tắc nghiệp vụ được kiểm tra trong unit test cho chức năng nhân viên phòng khám tạo nhanh tài khoản PATIENT phục vụ khách walk-in. Quy tắc tập trung vào ràng buộc duy nhất của thông tin định danh, chính sách mật khẩu tạm thời và hành vi gửi thông báo.

---

## FLOW 1: TẠO PATIENT CÓ EMAIL (createPatientByStaff)

### Quy Tắc BR-SP-01: Email Phải Duy Nhất

**Điều kiện**:
- Email dùng để tạo PATIENT không được trùng với bất kỳ tài khoản nào đã tồn tại.

**Mục đích**:
- Tránh xung đột định danh đăng nhập.

### Quy Tắc BR-SP-02: Tự Động Tạo Mật Khẩu Tạm Thời An Toàn

**Chính sách**:
- Mật khẩu được tạo tự động và có tính ngẫu nhiên.

**Mục đích**:
- Đảm bảo tài khoản có thể đăng nhập ngay nhưng vẫn an toàn.

### Quy Tắc BR-SP-03: PATIENT Walk-in Được Kích Hoạt Ngay

**Chính sách**:
- Tài khoản PATIENT cho walk-in được đặt trạng thái hoạt động ngay (không yêu cầu quy trình kích hoạt bổ sung).

**Mục đích**:
- Đảm bảo phục vụ nhanh tại quầy.

### Quy Tắc BR-SP-04: Gửi Thông Tin Đăng Nhập Qua Email (Nếu Có Thể)

**Chính sách**:
- Hệ thống cố gắng gửi email chứa thông tin đăng nhập cho khách.
- Nếu gửi email thất bại: tài khoản vẫn được tạo thành công và nhân viên cung cấp mật khẩu thủ công.

**Mục đích**:
- Ưu tiên tự động hóa nhưng không được làm gián đoạn nghiệp vụ tạo tài khoản.

---

## FLOW 2: TẠO PATIENT KHÔNG CÓ EMAIL THẬT (createPatientNoEmail)

### Quy Tắc BR-SP-05: Số Điện Thoại Phải Duy Nhất

**Chính sách**:
- Khi không có email thật, số điện thoại được dùng làm ràng buộc duy nhất (không được trùng).

**Mục đích**:
- Tránh tạo trùng tài khoản trong bối cảnh thiếu email.

### Quy Tắc BR-SP-06: Hệ Thống Sinh Email Tạm Từ Họ Tên + Ngày Sinh

**Chính sách**:
- Hệ thống sinh email tạm theo mẫu dựa trên họ tên và ngày sinh, đảm bảo không trùng.

**Mục đích**:
- Cung cấp một username hợp lệ cho đăng nhập trong trường hợp khách không có email.

### Quy Tắc BR-SP-07: Cung Cấp Thông Tin Đăng Nhập Thủ Công

**Chính sách**:
- Hệ thống trả về username/password tạm để nhân viên cung cấp trực tiếp cho khách.

**Mục đích**:
- Đảm bảo khách có thể sử dụng tài khoản ngay tại thời điểm khám.

### Quy Tắc BR-SP-08: Thông Báo Email (Nếu Có) Không Ảnh Hưởng Kết Quả Tạo Tài Khoản

**Chính sách**:
- Nếu việc gửi thông báo tới email tạm thất bại: vẫn coi như tạo tài khoản thành công.

**Mục đích**:
- Không phụ thuộc vào kênh email trong trường hợp email chỉ là tạm thời.

---

## FLOW 3: XEM DANH SÁCH PATIENT (getAllPatientAccounts)

### Quy Tắc BR-SP-09: Trả Về Danh Sách PATIENT Và Định Dạng Ngày Sinh

**Chính sách**:
- Danh sách bao gồm các PATIENT hợp lệ.
- Ngày sinh (nếu có) được hiển thị theo định dạng 'YYYY-MM-DD'.

**Mục đích**:
- Đồng nhất dữ liệu hiển thị và phục vụ tra cứu nhanh.

---

## TÓM TẮT QUY TẮC QUAN TRỌNG NHẤT

1. Tạo PATIENT có email: email phải duy nhất; gửi email thất bại không làm hỏng việc tạo.
2. Tạo PATIENT không email thật: số điện thoại phải duy nhất; hệ thống sinh email tạm và cung cấp thông tin đăng nhập để nhân viên giao trực tiếp.
3. Danh sách PATIENT chuẩn hóa định dạng ngày sinh khi hiển thị.

---

## CAP NHAT SNIPER

### Quy Tắc BR-SP-10: Sinh email tạm có cơ chế chống trùng lặp
- Nếu email tạm gốc đã tồn tại, hệ thống tự tăng hậu tố `_01`, `_02`... để tạo email mới.

### Quy Tắc BR-SP-11: Lỗi lưu dữ liệu phải rollback transaction
- Với cả luồng có email và không email, nếu lỗi phát sinh khi lưu DB thì transaction rollback toàn bộ.

### Quy Tắc BR-SP-12: Luồng tạo tài khoản walk-in luôn trả credentials cho nhân viên
- Dù email thông báo thành công hay thất bại, hệ thống vẫn trả `temporaryPassword` để nhân viên chủ động cấp cho khách.

### Quy Tắc BR-SP-13: Mã hóa mật khẩu là bắt buộc trước khi lưu
- Password tạm luôn được hash bằng bcrypt trước khi tạo Account để đảm bảo an toàn dữ liệu.

### Quy Tắc BR-SP-14: Cờ trạng thái email tạm phục vụ nghiệp vụ hậu kiểm
- Khi tạo không có email thật, response phải phản ánh `isTempEmail=true` để hỗ trợ các luồng cập nhật email thật về sau.

### Quy Tắc BR-SP-15: Dữ liệu danh sách PATIENT ưu tiên khả năng vận hành
- Danh sách bệnh nhân cần map rõ `isActive`, `isTempEmail` và chuẩn hóa DOB để nhân viên dễ thao tác tiếp nhận.
