# QUY TẮC NGHIỆP VỤ - CẬP NHẬT HỒ SƠ CLINIC ADMIN (TỰ QUẢN)

## TỔNG QUAN

Tài liệu này mô tả các quy tắc nghiệp vụ được kiểm tra trong unit test cho chức năng CLINIC_ADMIN tự cập nhật thông tin hồ sơ. Các quy tắc tập trung vào ràng buộc duy nhất (uniqueness) và nguyên tắc chỉ cập nhật những dữ liệu người dùng cung cấp.

---

## FLOW 1: CẬP NHẬT HỒ SƠ CỦA CHÍNH MÌNH (updateOwnProfile)

### Quy Tắc BR-CAP-01: Tài Khoản Phải Tồn Tại

**Điều kiện**: CLINIC_ADMIN thực hiện cập nhật phải tồn tại.

**Mục đích**:
- Ngăn cập nhật dữ liệu cho một danh tính không hợp lệ.

### Quy Tắc BR-CAP-02: Hồ Sơ CLINIC ADMIN Phải Tồn Tại

**Điều kiện**: Hồ sơ thông tin phòng khám gắn với tài khoản phải tồn tại.

**Mục đích**:
- Đảm bảo chỉ cập nhật trên hồ sơ đã được khởi tạo.

### Quy Tắc BR-CAP-03: Email Phải Duy Nhất Khi Thay Đổi

**Điều kiện áp dụng**: Người dùng có yêu cầu đổi email.

**Chính sách**:
- Email mới không được trùng với email của tài khoản khác trong hệ thống.
- Không áp dụng kiểm tra nếu email không thay đổi.

**Mục đích**:
- Đảm bảo email là định danh liên hệ duy nhất giữa các tài khoản.

### Quy Tắc BR-CAP-04: Số Điện Thoại Phải Duy Nhất Khi Thay Đổi

**Điều kiện áp dụng**: Người dùng có yêu cầu đổi số điện thoại.

**Chính sách**:
- Số điện thoại mới không được trùng với số của tài khoản khác.
- Không áp dụng kiểm tra nếu số điện thoại không thay đổi.

**Mục đích**:
- Tránh xung đột dữ liệu liên hệ và nhận diện người dùng.

### Quy Tắc BR-CAP-05: SePay Virtual Account (VA) Là Duy Nhất Theo Phòng Khám

**Điều kiện áp dụng**: Người dùng có yêu cầu đổi `sepayVa`.

**Chính sách**:
- Một `sepayVa` chỉ được gán cho duy nhất 1 phòng khám.
- Không áp dụng kiểm tra nếu `sepayVa` không thay đổi.

**Mục đích**:
- Tránh nhầm lẫn trong luồng nhận tiền/đối soát thanh toán.

### Quy Tắc BR-CAP-06: SePay API Key Là Duy Nhất

**Điều kiện áp dụng**: Người dùng có yêu cầu đổi `sepayKey`.

**Chính sách**:
- Một `sepayKey` không được sử dụng đồng thời bởi nhiều phòng khám.
- Không áp dụng kiểm tra nếu `sepayKey` không thay đổi.

**Mục đích**:
- Đảm bảo tính độc lập về cấu hình thanh toán giữa các phòng khám.

### Quy Tắc BR-CAP-07: Chỉ Cập Nhật Các Trường Được Cung Cấp

**Nguyên tắc**:
- Chỉ những trường người dùng gửi lên mới được thay đổi.
- Các trường không được cung cấp giữ nguyên.

**Mục đích**:
- Tránh ghi đè dữ liệu ngoài ý muốn.

---

## FLOW 2: LẤY HỒ SƠ CỦA CHÍNH MÌNH (getOwnProfile)

### Quy Tắc BR-CAP-08: Trả Về Hồ Sơ Theo Vai Trò

**Nguyên tắc**:
- Dữ liệu trả về phản ánh đầy đủ thông tin hồ sơ của CLINIC_ADMIN theo quyền hạn.

---

## TÓM TẮT QUY TẮC QUAN TRỌNG NHẤT

1. Email và số điện thoại phải duy nhất khi thay đổi.
2. `sepayVa` và `sepayKey` phải duy nhất theo chính sách cấu hình thanh toán.
3. Cập nhật theo nguyên tắc partial update: chỉ đổi các trường được cung cấp.

---

## BỔ SUNG NGHIỆP VỤ QUÉT TOÀN DIỆN

### Quy Tắc BR-CAP-09: Chỉ lưu dữ liệu khi vượt qua toàn bộ kiểm tra uniqueness

**Chính sách**:
- Nếu bất kỳ kiểm tra uniqueness nào thất bại (email/phone/sepayVa/sepayKey), hệ thống dừng và không được ghi dữ liệu account/profile.

### Quy Tắc BR-CAP-10: Luồng cập nhật account và profile phải nhất quán

**Chính sách**:
- Cập nhật thông tin liên hệ ở `Account` và thông tin vận hành ở `ClinicAdminInformation` trong cùng một phiên xử lý nghiệp vụ.
- Sau khi lưu, bắt buộc trả về hồ sơ đã chuẩn hóa qua service dùng chung.

### Quy Tắc BR-CAP-11: DOB cập nhật theo chuẩn kiểu ngày

**Chính sách**:
- Khi có `dob`, dữ liệu phải được chuẩn hóa về kiểu Date trước khi lưu.

### Quy Tắc BR-CAP-12: Luồng xem hồ sơ không tự biến đổi dữ liệu

**Chính sách**:
- `getOwnProfile` chỉ đọc dữ liệu theo role hiện tại, không phát sinh thao tác cập nhật.
