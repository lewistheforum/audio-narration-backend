# QUY TẮC NGHIỆP VỤ - TÍCH HỢP ZALO FRIEND REQUEST (WEBHOOK)

## TỔNG QUAN

Tài liệu này mô tả các quy tắc nghiệp vụ được kiểm tra trong unit test cho tính năng gửi yêu cầu kết bạn Zalo thông qua webhook. Mục tiêu là đảm bảo trải nghiệm người dùng nhất quán, giảm lỗi vận hành và không làm gián đoạn các luồng nghiệp vụ chính.

---

## FLOW: GỬI YÊU CẦU KẾT BẠN ZALO (sendFriendRequest)

### Quy Tắc BR-ZALO-01: Điều Kiện Bắt Buộc Về Số Điện Thoại

**Điều kiện**: Chỉ thực hiện gửi yêu cầu khi có số điện thoại hợp lệ (không rỗng/không undefined).

**Hành vi**:
- Nếu không có số điện thoại: bỏ qua thao tác gửi.

**Mục đích**:
- Tránh tạo yêu cầu rác hoặc gây nhầm lẫn khi thiếu thông tin liên hệ.

### Quy Tắc BR-ZALO-02: Chuẩn Hóa Số Điện Thoại Trước Khi Gửi

**Chính sách chuẩn hóa**:
- Loại bỏ các ký tự định dạng phổ biến: khoảng trắng, dấu gạch nối, dấu ngoặc.

**Mục đích**:
- Đảm bảo dữ liệu số điện thoại đồng nhất khi gửi sang hệ thống bên ngoài.

### Quy Tắc BR-ZALO-03: Yêu Cầu Cấu Hình Webhook

**Điều kiện**: Webhook URL phải được cấu hình trong môi trường.

**Hành vi**:
- Nếu webhook URL chưa cấu hình: bỏ qua thao tác gửi.

**Mục đích**:
- Cho phép vận hành linh hoạt theo từng môi trường (dev/staging/prod) mà không làm hỏng nghiệp vụ.

### Quy Tắc BR-ZALO-04: Cơ Chế Không Làm Gián Đoạn Luồng Chính (Non-blocking)

**Nguyên tắc**:
- Nếu gửi webhook thất bại: hệ thống ghi nhận sự cố và tiếp tục luồng nghiệp vụ chính.

**Mục đích**:
- Tăng độ bền (resilience) cho hệ thống; tránh sự phụ thuộc tuyệt đối vào dịch vụ bên thứ ba.

---

## TÓM TẮT QUY TẮC QUAN TRỌNG NHẤT

1. Chỉ gửi khi có số điện thoại.
2. Số điện thoại được chuẩn hóa để đồng nhất.
3. Không gửi nếu chưa cấu hình webhook.
4. Lỗi gửi webhook không được phép làm hỏng luồng nghiệp vụ chính.

---

## BỔ SUNG NGHIỆP VỤ QUÉT TOÀN DIỆN

### Quy Tắc BR-ZALO-05: Truy vết nghiệp vụ theo nguồn phát sinh (source)

**Chính sách**:
- Mỗi request gửi webhook phải gắn `source` trong log để phục vụ giám sát vận hành và điều tra sự cố.
- Nếu không truyền source, hệ thống tự fallback `Unknown`.

### Quy Tắc BR-ZALO-06: Chuẩn hóa dữ liệu đầu ra trước tích hợp ngoài

**Chính sách**:
- Dữ liệu phone sau chuẩn hóa là dữ liệu duy nhất được phép gửi sang webhook để tránh sai lệch do định dạng.
