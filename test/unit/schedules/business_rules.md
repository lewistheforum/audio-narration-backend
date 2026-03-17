# Quy Tắc Nghiệp Vụ (Business Rules): Module Schedules

Tài liệu này mô tả các quy tắc nghiệp vụ (BR) và logic quản lý lịch trình, ca làm việc trong `SchedulesModule`.

## 1. Tổng Quan
`SchedulesModule` chịu trách nhiệm quản lý:
-   Danh sách **Ca làm việc** của phòng khám (`ClinicShift`).
-   Cấu hình **Giờ làm việc** chi tiết (`ClinicShiftHour`).
-   Phân công **Lịch làm việc** cho nhân viên (`EmployeeSchedule`).
-   Lịch sử thay đổi cấu hình ca làm việc.

---

## 2. Quản Lý Ca Làm Việc (Clinic Shift Management)
*Entity: `ClinicShift`*

### 2.1. Định Nghĩa Ca
Một ca làm việc được định nghĩa bởi `ShiftType`:
| ShiftType | Mô Tả |
| :--- | :--- |
| `MORNING` | Ca Sáng |
| `AFTERNOON` | Ca Chiều |
| `EVENING` | Ca Tối |
| `NIGHT` | Ca Đêm |

### 2.2. Quy Tắc Quản Lý
-   **Quyền hạn**: Chỉ **Clinic Managers** mới có quyền tạo, cập nhật, xóa.
-   **Đa dạng**: Một phòng khám có thể có nhiều ca cùng loại (ví dụ: 2 ca Sáng khác nhau), phân biệt bằng ID.
-   **Xóa bỏ**: Áp dụng **Soft Delete** (Xóa mềm) để bảo toàn dữ liệu lịch sử.

---

## 3. Cấu Hình Giờ Ca Làm Việc (Shift Configuration)
*Method: `applyConfiguration(user, configDto)`*

### 3.1. Các Tham Số Cấu Hình
| Tham Số | Ý Nghĩa | Ví Dụ |
| :--- | :--- | :--- |
| `startHour` | Giờ bắt đầu của ca làm việc (định dạng `HH:MM`). | `08:00` |
| `endHour` | Giờ kết thúc của ca làm việc (định dạng `HH:MM`). | `12:00` |
| `step` | Thời lượng của mỗi slot (tính bằng giờ). | `0.5` (= 30 phút) |
| `limit` | Giới hạn số lượng (sức chứa) tối đa cho mỗi slot. | `5` (Mỗi slot nhận tối đa 5 người) |

### 3.2. Quy Tắc Validate
Hệ thống bắt buộc kiểm tra các điều kiện sau trước khi lưu:
-   `startHour` < `endHour` (Giờ bắt đầu phải nhỏ hơn giờ kết thúc).
-   `step` > 0 (Khoảng chia thời gian phải là số dương).
-   `limit` >= 1 (Sức chứa phải ít nhất là 1).

### 3.3. Cơ Chế Sinh Slot (Slot Generation Logic)
Khi áp dụng cấu hình, hệ thống sẽ tự động sinh ra các slots (`ClinicShiftHour`) theo công thức:

1.  **Slot 1**: Bắt đầu từ `startHour`.
2.  **Slot tiếp theo**: `Start Time` của slot trước + `step`.
3.  **Kết thúc**: Khi `End Time` của slot chạm đến hoặc vượt quá `endHour`.
4.  **Sức chứa**: Mỗi slot được sinh ra sẽ mang giá trị `limit` đã cấu hình.

**Ví dụ Minh Họa**:
-   Input: `start=08:00`, `end=09:00`, `step=0.5`, `limit=3`.
-   Output (2 slots):
    -   Slot A: 08:00 - 08:30 (Limit: 3)
    -   Slot B: 08:30 - 09:00 (Limit: 3)

### 3.4. Cơ Chế Tái Cấu Hình (Re-configuration)
Khi áp dụng một cấu hình mới cho ca làm việc:
1.  **Xóa mềm (Soft Delete)** toàn bộ các slots (`ClinicShiftHour`) hiện tại của ca đó.
2.  **Tạo mới (Generate)** lại toàn bộ danh sách slots theo tham số mới.
3.  **Lưu lịch sử**: Dữ liệu cũ vẫn được giữ lại (nhờ soft delete) để phục vụ tra cứu lịch sử.

### 3.5. Tra Cứu Lịch Sử (`getHistory`)
-   Cho phép xem lại các lần cấu hình trước đó.
-   Dữ liệu được nhóm theo `ShiftType`.

---

## 4. Quản Lý Lịch Làm Việc (Employee Scheduling)
*Entity: `EmployeeSchedule`*

### 4.1. Tạo Lịch Mới (`create`)
-   **Quyền hạn**: Chỉ **Clinic Managers**.
-   **Validate**:
    -   `employeeId`, `clinicShiftId`, `roomId` phải tồn tại và thuộc về phòng khám hiện tại.
-   **Chặn Xung Đột (Conflict Rule)**:
    -   **Nhân viên**: Một nhân viên **không thể** có 2 lịch làm việc cho **cùng một ca** vào **cùng một ngày** (không thể ở 2 phòng khác nhau trong cùng 1 ca).
    -   **Phòng khám**: Một phòng khám (`roomId`) **không thể** được gán cho 2 bác sĩ khác nhau trong **cùng một ca** vào **cùng một ngày**.

### 4.2. Cập Nhật Lịch (`update`)
-   Khi thay đổi `workDate`, `employeeId`, `clinicShiftId` hoặc `roomId`:
    -   Hệ thống tự động kích hoạt **Kiểm tra xung đột** cho cả nhân viên và phòng khám.
    -   Nếu phát hiện trùng lịch hoặc phòng đã có người trực -> Ném lỗi `ConflictException`.
    -   **Lưu ý quan trọng:** Không thể thay đổi lịch làm việc (do khác ca trực / ngày / bác sĩ) nếu lịch này đã có bệnh nhân đặt hẹn (trạng thái hợp lệ, trừ `CANCELLED`, `REJECTED`, `NO_SHOW`). Nếu có bệnh nhân đặt, sẽ báo lỗi `ConflictException`.

### 4.3. Sao Chép Lịch (`copySchedule`)
Chức năng hỗ trợ quản lý sao chép nhanh lịch làm việc:
-   **Cơ chế**: Sao chép từ danh sách ngày nguồn (`fromDates`) sang ngày đích (`targetDate`).
-   **Xử lý xung đột**:
    -   Nếu lịch sao chép bị trùng -> **Bỏ qua (Skip)**, không ghi đè.
    -   Chỉ sao chép các lịch hợp lệ.

### 4.4. Xóa Lịch (`remove`)
-   **Quy tắc an toàn:** Không thể xóa một lịch làm việc (`EmployeeSchedule`) nếu lịch đó đã có bệnh nhân đặt hẹn (với trạng thái hợp lệ). Việc xóa chỉ khả thi khi không có ca khám nào phụ thuộc vào tài nguyên này.

---

## 5. Quy Tắc Truy Vấn & Bảo Mật

### 5.1. Quyền Xem Danh Sách (`findAll`)
| Vai Trò | Phạm Vi Dữ Liệu |
| :--- | :--- |
| `CLINIC_MANAGER` | Xem **tất cả** lịch của phòng khám. |
| `DOCTOR` | Chỉ xem lịch của **chính mình**. |
| `NURSE / STAFF` | Xem **chính mình** lịch của phòng khám. |

### 5.2. Bộ Lọc (Filters)
Hỗ trợ lọc dữ liệu theo:
-   `date`: Xem theo ngày cụ thể.
-   `range`: Xem trong khoảng thời gian (Từ ngày... Đến ngày...).
-   `employeeId`: Xem lịch của nhân viên cụ thể.
-   `roomId`: Xem lịch của phòng cụ thể.
-   `shiftId`: Xem lịch theo ca.

### 5.3. Bảo Mật Đa Chi Nhánh (Security)
-   **BS-14**: Mọi thao tác đều phải `resolve` (giải quyết) `clinicId` từ Token người dùng.
-   **BS-15**: Nghiêm cấm truy cập chéo dữ liệu giữa các phòng khám khác nhau (`Forbidden`).
