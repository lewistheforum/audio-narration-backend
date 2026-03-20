# Kế hoạch & Thay đổi Hệ thống Medicare (Medicare System Changes & Plan)

Tài liệu này tóm tắt các thay đổi quan trọng đã được thực hiện đối với hệ thống quản lý phòng khám (Clinic Management System).

## 1. Báo cáo Doanh thu (Revenue Reports)
- **Nguồn dữ liệu**: Thay đổi từ việc lấy dữ liệu trực tiếp từ bảng `transactions` sang kết hợp dữ liệu từ `appointments` và `appointment_packages`.
- **Logic lọc**:
  - Chỉ tính các cuộc hẹn (`appointments`) có trạng thái `COMPLETED`.
  - Chỉ tính các gói cuộc hẹn (`appointment_packages`) có trạng thái `PAID`.
- **Phân loại**: Doanh thu hiện được phân loại rõ ràng theo hai hình thức:
  - **Online**: Thanh toán qua cổng thanh toán trực tuyến.
  - **COD**: Thanh toán tại phòng khám.
- **Xuất dữ liệu**: Báo cáo Excel đã được cập nhật để bao gồm cột "Loại thanh toán" và "Mã gói".

## 2. Quản lý Hồ sơ Quản lý (Manager Profile Management)
- **API Lấy thông tin**: Cập nhật endpoint `GET /clinic-admin/clinic-managers/:id` để hỗ trợ cả Admin và chính Quản lý đó có thể xem hồ sơ đầy đủ.
- **API Cập nhật**: Endpoint `PATCH /clinic-admin/clinic-managers/:id/profile` hiện trả về toàn bộ thông tin hồ sơ sau khi cập nhật thành công, giúp hiển thị lại các thông tin đã lưu.
- **Các trường thông tin**: Bao gồm họ tên, giới tính, ngày sinh, ảnh đại diện, tên chi nhánh, địa chỉ và thông tin pháp lý.

## 3. Quy trình Tạo tài khoản (Account Creation Workflow)
- **Trạng thái mặc định**: Khi Quản lý phòng khám tạo tài khoản cho **Bác sĩ (Doctor)** hoặc **Nhân viên (Staff)**, trạng thái ban đầu của tài khoản sẽ là `PENDING_APPROVAL` (Thay vì `ACTIVE` như trước đây).
- **Phê duyệt**: Các tài khoản này cần được kiểm tra hoặc kích hoạt bởi cấp có thẩm quyền trước khi có thể hoạt động chính thức.

---
*Tài liệu này được soạn thảo để phục vụ việc theo dõi và triển khai các tính năng mới.*
