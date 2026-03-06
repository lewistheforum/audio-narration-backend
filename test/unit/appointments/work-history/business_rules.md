# Quy Tắc Nghiệp Vụ - Work History (Lịch Sử Công Việc Bác Sĩ)

## Tổng Quan

Tài liệu này mô tả các quy tắc nghiệp vụ cho **API Lịch Sử Công Việc Bác Sĩ** trong hệ thống Bonix.

**Endpoint**: `GET /api/appointments/doctors/{doctorId}/work-history`  
**Phiên Bản**: 1.0  
**Ngày Cập Nhật**: 03/03/2026  
**Trạng Thái**: Production

---

## Luồng Hoạt Động

```
Client gọi API với JWT Token
    ↓
Hệ thống đọc Token → lấy userAccountId
    ↓
Xác định cRole (CLINIC_ADMIN / CLINIC_MANAGER)
    ↓
Tính toán clinicId để filter
    ↓
Query appointments WHERE doctorId = :id AND clinicId = :clinicId
    ↓
Fetch services + clinicRooms cho từng appointment
    ↓
Trả về PaginatedAppointmentResponseDto
```

---

## Quy Tắc Phân Quyền & Xác Định clinicId

### Quy Tắc 1: CLINIC_ADMIN

- **clinicId** = `userAccount._id` (chính là ID của Admin)
- Bảng `appointments.clinic_id` lưu ID của CLINIC_ADMIN
- Admin (CLINIC_ADMIN) có thể xem lịch sử của bất kỳ bác sĩ nào thuộc phòng khám mình

**Ví Dụ:**
```
CLINIC_ADMIN._id = 'admin-uuid-123'
appointments.clinic_id = 'admin-uuid-123'  ← khớp
→ clinicId = userAccount._id = 'admin-uuid-123'
```

### Quy Tắc 2: CLINIC_MANAGER

- **clinicId** = `userAccount.parentId` (trỏ về CLINIC_ADMIN)
- Manager là cấp dưới của Admin, `parentId` chứa ID của Admin
- Manager được phép xem lịch sử công việc thay mặt Admin

**Ví Dụ:**
```
CLINIC_MANAGER._id     = 'manager-uuid-456'
CLINIC_MANAGER.parentId = 'admin-uuid-123'  ← ID của Admin
appointments.clinic_id  = 'admin-uuid-123'  ← khớp
→ clinicId = userAccount.parentId = 'admin-uuid-123'
```

### Quy Tắc 3: Role Không Hợp Lệ

- Nếu `userAccount` không tồn tại → `NotFoundException`
- Các role khác (DOCTOR, CLINIC_STAFF, PATIENT) → `clinicId = undefined` → không filter theo clinic, lấy toàn bộ (hoặc tuỳ business rule mở rộng)

---

## Quy Tắc Filter

### Filter Theo Ngày

| Tham số | Điều Kiện SQL | Mô Tả |
|---------|--------------|-------|
| `fromDate` | `appointment_date >= :fromDate` | Ngày bắt đầu (bao gồm) |
| `toDate` | `appointment_date <= :toDate` | Ngày kết thúc (bao gồm) |

- Nếu không truyền → không filter ngày, lấy toàn bộ
- Định dạng: `YYYY-MM-DD`

### Filter Theo Trạng Thái

| Giá Trị | Ý Nghĩa |
|---------|---------|
| `PENDING` | Chờ xác nhận |
| `CONFIRMED` | Đã xác nhận |
| `CHECKED_IN` | Bệnh nhân đã check-in |
| `IN_PROGRESS` | Đang khám |
| `COMPLETED` | Hoàn thành |
| `CANCELLED` | Đã hủy |
| `ABSENT` | Bệnh nhân vắng |

- Nếu không truyền → lấy tất cả status

### Sắp Xếp

- Mặc định: `appointmentDate DESC`, `appointmentHour DESC`
- Appointment mới nhất hiển thị đầu tiên

---

## Quy Tắc Phân Trang

| Tham số | Default | Mô Tả |
|---------|---------|-------|
| `page` | 1 | Trang hiện tại (1-indexed) |
| `limit` | 10 | Số records mỗi trang |
| `totalPages` | calculated | `Math.ceil(total / limit)` |

---

## Quy Tắc Dữ Liệu Trả Về

### clinicRooms

- Fetch từ `employeeScheduleRepository.findClinicRoomsForMultipleAppointments()`
- Input: Danh sách `{ appointmentId, doctorShiftHourId, doctorId, appointmentDate }`
- Nếu không có data → trả về `[]`

### services

- Fetch từ `appointmentPackageRepository.findServicesByAppointmentIds()`
- Trả về Map: `appointmentId → service[]`
- Nếu không có package → trả về `[]`

### Tối Ưu Performance

- Fetch `services` và `clinicRooms` theo **batch** (một lần cho tất cả appointments)
- **Không** fetch từng appointment riêng lẻ (N+1 query problem)
- Chỉ fetch nếu `appointmentIds.length > 0` (tránh query DB khi rỗng)

---

## Xử Lý Lỗi

| Mã HTTP | Tình Huống | Exception |
|---------|------------|-----------|
| **404** | userAccount không tồn tại | `NotFoundException` |
| **200** | Doctor không có appointment nào | Trả về `data: [], total: 0` |

---

## Response Format

```typescript
{
  data: AppointmentResponseDto[],  // Danh sách appointments
  total: number,                   // Tổng số records
  page: number,                    // Trang hiện tại
  limit: number,                   // Records mỗi trang
  totalPages: number               // Tổng số trang
}
```

Mỗi `AppointmentResponseDto`:

```typescript
{
  id: string,
  patientId: string,
  patientFullName: string,
  patientEmail: string,
  patientPhone: string,
  clinicId: string,
  clinicName: string,
  doctorId: string,
  doctorFullName: string | null,
  clinicRooms: ClinicRoom[],     // ← phải có dữ liệu nếu tồn tại
  services: Service[],           // ← phải có dữ liệu nếu tồn tại
  appointmentDate: Date,
  appointmentHour: Date,
  extraHour: Date | null,
  total: number,
  status: AppointmentStatus,
  patientNote: string | null,
  rejectReason: string | null,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Điều Kiện Query

```sql
SELECT * FROM appointments
WHERE doctor_id = :doctorId
  AND deleted_at IS NULL
  [AND clinic_id = :clinicId]     -- Nếu clinicId được xác định
  [AND appointment_date >= :from] -- Nếu fromDate được truyền
  [AND appointment_date <= :to]   -- Nếu toDate được truyền
  [AND status = :status]          -- Nếu status được truyền
ORDER BY appointment_date DESC, appointment_hour DESC
LIMIT :limit OFFSET :skip
```

---

## Quan Hệ Tài Khoản

```
CLINIC_ADMIN (clinic_id trong appointments = Admin._id)
    └── CLINIC_MANAGER (parentId = Admin._id)
            └── DOCTOR (được assign lịch làm việc)
                    └── appointments (clinic_id = Admin._id)
```
