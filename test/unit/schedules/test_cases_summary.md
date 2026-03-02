# Tổng Hợp Các Trường Hợp Unit Test - Module Lịch Trình

Dưới đây là danh sách các trường hợp kiểm thử (test cases) đã được thực hiện cho module Schedules.

## 1. ClinicShiftsService (`clinic-shifts.service.spec.ts`)
Kiểm thử các chức năng quản lý ca làm việc cơ bản.

### Create (Tạo mới)
- **TC-01**: `should create a new shift for clinic manager`
  - Kiểm tra việc tạo ca làm việc thành công cho tài khoản Quản lý phòng khám.
  - Đảm bảo `clinicId` được giải quyết đúng và dữ liệu được lưu vào repository.

### FindAll (Lấy danh sách)
- **TC-02**: `should return an array of shifts`
  - Kiểm tra việc lấy danh sách ca làm việc theo `clinicId`.
  - Đảm bảo kết quả trả về đúng danh sách mong đợi.

### Remove (Xóa)
- **TC-03**: `should soft delete a shift`
  - Kiểm tra chức năng xóa mềm (soft delete) một ca làm việc.
- **TC-04**: `should throw NotFoundException if shift not found`
  - Kiểm tra ném lỗi khi cố gắng xóa một ID không tồn tại.
- **TC-05**: `should throw ForbiddenException if shift belongs to another clinic`
  - Kiểm tra bảo mật: đảm bảo không thể xóa ca làm việc của phòng khám khác.

---

## 2. ClinicShiftHoursService (`clinic-shift-hours.service.spec.ts`)
Kiểm thử chức năng cấu hình giờ và lịch sử.

### ApplyConfiguration (Áp dụng cấu hình)
- **TC-06**: `should apply configuration successfully`
  - Kiểm tra luồng thành công: Xóa mềm slot cũ -> Tạo slot mới -> Lưu vào DB.
  - **Kiểm tra chi tiết (BS-08)**: Xác minh slot đầu tiên và slot cuối cùng được tạo đúng với giờ bắt đầu/kết thúc và limit đã cấu hình.
- **TC-07**: `should throw BadRequestException for invalid time range`
  - **Kiểm tra chi tiết (BS-07)**: Đảm bảo giờ bắt đầu phải nhỏ hơn giờ kết thúc (ví dụ: start 12:00, end 08:00 sẽ lỗi).

### GetHistory (Lấy lịch sử)
- **TC-08**: `should return history for shifted type`
  - Kiểm tra việc lấy lịch sử cấu hình theo `ShiftType`.
  - Đảm bảo truy vấn đúng các slot (bao gồm cả đã xóa mềm) và nhóm/trả về đúng định dạng lịch sử.

---

## 3. SchedulesService (`schedules.service.spec.ts`)
Kiểm thử chức năng phân công lịch làm việc cho nhân viên.

### Create (Tạo lịch)
- **TC-09**: `should create schedules successfully`
  - Kiểm tra tạo lịch thành công (transaction commit).
- **TC-10**: `should throw ConflictException if schedule exists`
  - **Kiểm tra chi tiết (BS-10)**: Đảm bảo ném lỗi `ConflictException` nếu nhân viên đã có lịch trùng khớp (transaction rollback).

### FindAll (Xem lịch)
- **TC-11**: `should return mapped schedules for manager`
  - Kiểm tra việc lấy và ánh xạ dữ liệu (map) từ entity sang DTO cho phản hồi API.
  - Đảm bảo thông tin nhân viên, phòng, ca làm việc được trả về đầy đủ.

### Update (Cập nhật)
- **TC-12**: `should update schedule successfully`
  - Kiểm tra chức năng cập nhật thông tin lịch (ví dụ: đổi phòng).

### CopySchedule (Sao chép lịch)
- **TC-13**: `should copy schedules successfully skipping conflicts`
  - **Kiểm tra chi tiết (BS-13)**:
    - Kiểm tra luồng sao chép từ ngày này sang ngày khác.
    - Đảm bảo các lịch bị trùng (conflict) sẽ được bỏ qua (skipped) và không gây lỗi, các lịch hợp lệ được sao chép (copied).

### Validation (Kiểm tra hợp lệ chung)
- **TC-14**: `should throw NotFoundException if employee not found during create`
  - Kiểm tra validation: Nếu `employeeId` không tồn tại trong hệ thống thì không được tạo lịch.
- **TC-14a**: `should throw BadRequestException if clinicId is missing`
  - Kiểm tra validation: Nếu không truyền `clinicId` khi tạo lịch.
- **TC-14b**: `should throw NotFoundException if clinic not found`
  - Kiểm tra validation: Nếu `clinicId` không tồn tại trong hệ thống.

### GetEmployees (Lấy danh sách nhân viên)
- **TC-15**: `should return list of employees for manager`
  - Kiểm tra tính năng lấy danh sách nhân viên (Bác sĩ, Y tá) của phòng khám.
  - Đảm bảo mapping thông tin nhân viên (Tên, Ảnh) chính xác.

### Helpers (Các hàm hỗ trợ)
- **TC-16**: `getShifts & getRooms`
  - Kiểm tra các hàm lấy danh sách Ca làm việc (`getShifts`) và Phòng khám (`getRooms`) trả về đúng dữ liệu.

---

## 4. Các Test Case Bổ Sung (Logic & Validation)

### ClinicShiftsService
- **TC-17**: `should resolve clinicId for DOCTOR/STAFF via manager parent`
  - Kiểm tra logic phân giải `clinicId` phức tạp: Nhân viên -> Manager -> Clinic.
- **TC-18**: `should return empty array in findAll if clinicId cannot be resolved`
  - Đảm bảo tính an toàn: Nếu không tìm thấy clinicId, không trả về dữ liệu rác.

### ClinicShiftHoursService
- **TC-19**: `should throw BadRequestException if start hour equals end hour`
  - Kiểm tra validation: Giờ bắt đầu không được trùng giờ kết thúc.
- **TC-20**: `should throw BadRequestException if step is zero or negative`
  - Kiểm tra validation: Bước nhảy thời gian (`step`) phải lớn hơn 0.
