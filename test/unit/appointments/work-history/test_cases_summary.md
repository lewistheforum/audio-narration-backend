# Tóm Tắt Các Test Cases - Work History (Lịch Sử Công Việc Bác Sĩ)

## Tổng Quan

Tài liệu này tóm tắt tất cả unit test cases cho **API `getDoctorWorkHistory`** và **`exportDoctorWorkHistoryCSV`** trong `AppointmentsService`.

**File Test**: `test/unit/appointments/work-history/work-history.service.spec.ts`  
**Framework**: Jest + NestJS Testing  
**Coverage Target**: 100% cho critical paths  
**Phiên Bản**: 1.0  
**Cập Nhật Lần Cuối**: 03/03/2026

---

## Tổng Quan Test Suites

```
AppointmentsService - getDoctorWorkHistory
├── 1. Phân Quyền & clinicId Resolution - 4 tests
├── 2. Filter & Query Logic - 4 tests
├── 3. Dữ Liệu Trả Về (services + clinicRooms) - 3 tests
├── 4. Phân Trang - 2 tests
└── 5. Edge Cases - 2 tests

Tổng: 15 test cases
```

---

## 1. Test Suite: Phân Quyền & Xác Định clinicId

### Mục Đích
Kiểm tra logic xác định `clinicId` dựa trên role của user gọi API.

| # | Test Case | Đầu Vào | Kết Quả Mong Đợi | Quy Tắc |
|---|-----------|---------|------------------|---------|
| **1.1** | **CLINIC_ADMIN lấy được work history** | • JWT của CLINIC_ADMIN<br>• `role = CLINIC_ADMIN`<br>• `_id = 'admin-uuid'`<br>• Doctor có appointments với `clinic_id = 'admin-uuid'` | ✅ Trả về appointments đúng<br>✅ `clinicId = userAccount._id`<br>✅ `total > 0` | CLINIC_ADMIN dùng `_id` của mình làm `clinicId` |
| **1.2** | **CLINIC_MANAGER lấy được work history qua parentId** | • JWT của CLINIC_MANAGER<br>• `role = CLINIC_MANAGER`<br>• `parentId = 'admin-uuid'`<br>• Doctor có appointments với `clinic_id = 'admin-uuid'` | ✅ Trả về appointments đúng<br>✅ `clinicId = userAccount.parentId`<br>✅ `total > 0` | CLINIC_MANAGER dùng `parentId` (= Admin ID) làm `clinicId` |
| **1.3** | **CLINIC_MANAGER không có parentId** | • CLINIC_MANAGER<br>• `parentId = null` | ✅ `clinicId = undefined`<br>✅ Không filter theo clinic<br>✅ Trả về tất cả appointments của doctor | Fallback: không filter nếu không có parentId |
| **1.4** | **User không tồn tại** | • `userAccountId` không có trong DB | ❌ `NotFoundException`<br>❌ HTTP 404 | Phải xác thực user tồn tại |

**Mocks:**
- `AccountRepository.findAccountById()` → Mock user account với các roles khác nhau
- `AppointmentRepository.createQueryBuilder()` → Mock query builder

---

## 2. Test Suite: Filter & Query Logic

### Mục Đích
Kiểm tra các filter params được áp dụng đúng vào câu query.

| # | Test Case | Đầu Vào | Kết Quả Mong Đợi | Quy Tắc |
|---|-----------|---------|------------------|---------|
| **2.1** | **Filter theo doctorId** | • `doctorId = 'doctor-uuid'`<br>• CLINIC_ADMIN | ✅ Query có `WHERE doctor_id = 'doctor-uuid'`<br>✅ Chỉ lấy appointments của đúng bác sĩ | Filter bắt buộc theo doctorId |
| **2.2** | **Filter theo fromDate và toDate** | • `fromDate = '2026-02-01'`<br>• `toDate = '2026-02-28'` | ✅ Query có `AND appointment_date >= '2026-02-01'`<br>✅ Query có `AND appointment_date <= '2026-02-28'` | Filter theo ngày khoảng |
| **2.3** | **Filter theo status** | • `status = 'COMPLETED'` | ✅ Query có `AND status = 'COMPLETED'`<br>✅ Chỉ trả về appointments đã hoàn thành | Filter theo trạng thái cụ thể |
| **2.4** | **Không truyền filter** | • Không có `fromDate`, `toDate`, `status` | ✅ Query KHÔNG có clause `appointment_date` hoặc `status`<br>✅ Lấy tất cả appointments của doctor | Tất cả filter là optional |

**Mocks:**
- `AppointmentRepository.createQueryBuilder()` → Mock với chain methods
- `AppointmentRepository.getMany()` → Mock danh sách appointments
- `AppointmentRepository.getCount()` → Mock total count

---

## 3. Test Suite: Dữ Liệu Trả Về (services + clinicRooms)

### Mục Đích
Kiểm tra `services` và `clinicRooms` được fetch đầy đủ cho mỗi appointment.

| # | Test Case | Đầu Vào | Kết Quả Mong Đợi | Quy Tắc |
|---|-----------|---------|------------------|---------|
| **3.1** | **Services được populate đúng** | • 2 appointments có `appointment_package`<br>• Mỗi package có services | ✅ `data[0].services` không rỗng<br>✅ `appointmentPackageRepository.findServicesByAppointmentIds()` được gọi với đúng IDs<br>✅ Services được map đúng theo appointmentId | Fetch services theo batch, không N+1 |
| **3.2** | **clinicRooms được populate đúng** | • 2 appointments có `doctorShiftHourId`<br>• Có clinic room data | ✅ `data[0].clinicRooms` không rỗng<br>✅ `employeeScheduleRepository.findClinicRoomsForMultipleAppointments()` được gọi<br>✅ Clinic rooms được map đúng theo appointmentId | Fetch clinic rooms theo batch |
| **3.3** | **Trả về [] khi không có services/clinicRooms** | • Appointments không có package hoặc shift | ✅ `data[0].services = []`<br>✅ `data[0].clinicRooms = []`<br>✅ Không throw exception | Graceful fallback về array rỗng |

**Mocks:**
```typescript
appointmentPackageRepository = {
  findServicesByAppointmentIds: jest.fn().mockResolvedValue(new Map([
    ['apt-1', [{ serviceName: 'Khám tổng quát', price: 200000 }]]
  ]))
};

employeeScheduleRepository = {
  findClinicRoomsForMultipleAppointments: jest.fn().mockResolvedValue(new Map([
    ['apt-1', [{ roomName: 'Phòng 101' }]]
  ]))
};
```

---

## 4. Test Suite: Phân Trang

### Mục Đích
Kiểm tra pagination hoạt động đúng.

| # | Test Case | Đầu Vào | Kết Quả Mong Đợi | Quy Tắc |
|---|-----------|---------|------------------|---------|
| **4.1** | **Phân trang cơ bản** | • `page = 2`<br>• `limit = 5`<br>• `total = 12` | ✅ `skip = (2-1) * 5 = 5`<br>✅ `data.length <= 5`<br>✅ `totalPages = Math.ceil(12/5) = 3`<br>✅ Response: `{ page: 2, limit: 5, total: 12, totalPages: 3 }` | Pagination đúng với OFFSET và LIMIT |
| **4.2** | **Dùng default khi không truyền page/limit** | • Không truyền `page`, `limit` | ✅ `page = 1` (default)<br>✅ `limit = 10` (default)<br>✅ `skip = 0` | Default values: page=1, limit=10 |

---

## 5. Test Suite: Edge Cases

| # | Test Case | Đầu Vào | Kết Quả Mong Đợi | Quy Tắc |
|---|-----------|---------|------------------|---------|
| **5.1** | **Doctor không có appointment nào** | • `doctorId` hợp lệ<br>• Doctor chưa có ca nào | ✅ Trả về `{ data: [], total: 0, totalPages: 0 }`<br>✅ Không throw exception<br>✅ `findServicesByAppointmentIds` KHÔNG được gọi (appointmentIds rỗng) | Kết quả rỗng hợp lệ, tránh query không cần thiết |
| **5.2** | **Doctor có appointment nhưng không thuộc clinic của Manager** | • CLINIC_MANAGER với `parentId = 'clinic-A'`<br>• Doctor có appointments với `clinic_id = 'clinic-B'` (khác) | ✅ Trả về `{ data: [], total: 0 }` (không có data)<br>✅ Không throw exception | Filter clinicId ngăn Manager xem dữ liệu của clinic khác |

---

## Chiến Lược Mocking

### Module Setup

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    AppointmentsService,
    { provide: DataSource, useValue: mockDataSource },
    { provide: 'AppointmentRepository', useValue: mockAppointmentRepository },
    { provide: 'AppointmentPackageRepository', useValue: mockAppointmentPackageRepository },
    { provide: 'ClinicStaffInformationRepository', useValue: {} },
    { provide: 'EmployeeScheduleRepository', useValue: mockEmployeeScheduleRepository },
    { provide: 'AccountRepository', useValue: mockAccountRepository },
    { provide: BookingSessionService, useValue: {} },
    { provide: REDIS_CLIENT, useValue: mockRedisClient },
  ],
}).compile();
```

### Account Mock Factory

```typescript
const createMockAdmin = (overrides = {}) => ({
  _id: 'admin-uuid',
  role: AccountRole.CLINIC_ADMIN,
  parentId: null,
  username: 'clinic_admin_1',
  ...overrides,
});

const createMockManager = (overrides = {}) => ({
  _id: 'manager-uuid',
  role: AccountRole.CLINIC_MANAGER,
  parentId: 'admin-uuid', // Trỏ về Admin
  username: 'clinic_manager_1',
  ...overrides,
});
```

### Query Builder Mock

```typescript
const mockQueryBuilder = {
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getSql: jest.fn().mockReturnValue('SELECT ...'),
  getParameters: jest.fn().mockReturnValue({}),
  getCount: jest.fn().mockResolvedValue(5),
  getMany: jest.fn().mockResolvedValue([mockAppointment]),
};
```

### Appointment Mock Factory

```typescript
const createMockAppointment = (overrides = {}) => ({
  _id: 'apt-uuid-1',
  patientId: 'patient-uuid',
  clinicId: 'admin-uuid',
  doctorId: 'doctor-uuid',
  doctorShiftHourId: 'shift-uuid',
  appointmentDate: new Date('2026-02-01'),
  appointmentHour: new Date('2026-02-01T08:00:00'),
  status: AppointmentStatus.COMPLETED,
  total: 300000,
  patient: { _id: 'patient-uuid', username: 'Nguyễn Văn A', email: 'patient@test.com', phone: '0901234567' },
  clinic: { _id: 'admin-uuid', username: 'Phòng khám XYZ' },
  ...overrides,
});
```

---

## Chạy Tests

```bash
# Chạy chỉ work-history tests
pnpm test work-history

# Chạy với watch mode
pnpm test:watch work-history

# Chạy với coverage
pnpm test:cov
```

### Output Mong Đợi

```
PASS  test/unit/appointments/work-history/work-history.service.spec.ts
  AppointmentsService - getDoctorWorkHistory
    Phân Quyền & clinicId Resolution
      ✓ CLINIC_ADMIN dùng _id của mình làm clinicId (12ms)
      ✓ CLINIC_MANAGER dùng parentId làm clinicId (8ms)
      ✓ CLINIC_MANAGER không có parentId → không filter clinic (5ms)
      ✓ User không tồn tại → NotFoundException (4ms)
    Filter & Query Logic
      ✓ Filter bắt buộc theo doctorId (6ms)
      ✓ Filter theo fromDate và toDate (5ms)
      ✓ Filter theo status (5ms)
      ✓ Không truyền filter → lấy tất cả (4ms)
    Dữ Liệu Trả Về (services + clinicRooms)
      ✓ Services được populate đúng từ appointment packages (10ms)
      ✓ clinicRooms được populate đúng từ employee schedules (9ms)
      ✓ Trả về [] khi không có services/clinicRooms (6ms)
    Phân Trang
      ✓ Phân trang cơ bản với page=2, limit=5 (5ms)
      ✓ Default page=1, limit=10 khi không truyền (4ms)
    Edge Cases
      ✓ Doctor không có appointment nào → data rỗng (5ms)
      ✓ Doctor thuộc clinic khác → Manager không xem được (6ms)

Tests: 15 passed, 15 total
```

---

## Quy Tắc Nghiệp Vụ Đã Kiểm Tra

| Quy Tắc | Tests | Status |
|---------|-------|--------|
| CLINIC_ADMIN dùng `_id` làm clinicId | 1.1 | ✅ |
| CLINIC_MANAGER dùng `parentId` làm clinicId | 1.2 | ✅ |
| Phải xác thực user tồn tại | 1.4 | ✅ |
| Filter theo doctorId | 2.1 | ✅ |
| Filter ngày khoảng | 2.2 | ✅ |
| Filter trạng thái | 2.3 | ✅ |
| Services fetch theo batch | 3.1 | ✅ |
| clinicRooms fetch theo batch | 3.2 | ✅ |
| Tránh query khi appointmentIds rỗng | 5.1 | ✅ |
| Manager không xem được clinic khác | 5.2 | ✅ |
