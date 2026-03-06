# Quy Tắc Nghiệp Vụ - Prescriptions Module (Patient View)

## Tổng Quan

Tài liệu này mô tả các quy tắc nghiệp vụ được triển khai cho **Prescriptions Module - Patient View Flow** trong hệ thống Medicare. Module này xử lý việc xem đơn thuốc điện tử (E-Prescription), xuất PDF, và xem chi tiết hồ sơ bệnh án đa hình (Polymorphic ERM).

**Phiên Bản**: 1.0  
**Ngày Cập Nhật**: 03/03/2026  
**Trạng Thái**: Production Ready

---

## Kiến Trúc Hệ Thống

### Các API Endpoints

1. **GET /patients/me/appointments/:appointmentId/e-prescription** - Xem chi tiết đơn thuốc
2. **GET /patients/me/appointments/:appointmentId/e-prescription/export/pdf** - Xuất đơn thuốc PDF
3. **GET /patients/me/appointments/:appointmentId/erms/:ermId** - Xem chi tiết hồ sơ bệnh án

### Mối Quan Hệ Entity

```
Appointment (1) ──→ (1) E-Prescription
E-Prescription (1) ──→ (N) DetailEPrescription
DetailEPrescription (N) ──→ (1) Medicine

Appointment (1) ──→ (N) ERM (base table)
ERM (1) ──→ (1) ERMXray | ERMLab | ERMConsultation | ... (polymorphic)
```

---

## Quy Tắc Xác Thực Business Logic

### 1. Quy Tắc E-Prescription Visibility

**Điều Kiện Bắt Buộc:**
- ✅ Appointment phải thuộc về patient (ownership verification)
- ✅ Appointment status phải là `COMPLETED`
- ✅ E-Prescription phải tồn tại cho appointment đó
- ✅ DetailEPrescription items phải filter soft-deleted records

**Multi-Layer Validation:**

```typescript
// Layer 1: Verify appointment ownership
const appointment = await appointmentRepository.findOne({
  where: {
    _id: appointmentId,
    patientId: patientId,
    deletedAt: IsNull()
  }
});

if (!appointment) {
  throw new NotFoundException('Appointment not found');
}

// Layer 2: Verify status rule
if (appointment.status !== AppointmentStatus.COMPLETED) {
  throw new ForbiddenException(
    'E-Prescription is only available for completed appointments'
  );
}

// Layer 3: Load E-Prescription
const ePrescription = await ePrescriptionRepository.findOne({
  where: { appointmentId, deletedAt: IsNull() },
  relations: ['detailEPrescriptions', 'detailEPrescriptions.medicine']
});

// Layer 4: Filter soft-deleted details
const activeDetails = ePrescription.detailEPrescriptions?.filter(
  d => !d.deletedAt
) || [];
```

**Mục Đích:**
- Ngăn bệnh nhân xem đơn thuốc của cuộc hẹn chưa hoàn thành
- Bảo vệ dữ liệu y tế chưa được bác sĩ xác nhận
- Tuân thủ quy trình y tế (chỉ hiển thị sau khi appointment COMPLETED)

**Thông Báo Lỗi:**
- `NotFoundException`: "Appointment not found" (404)
- `ForbiddenException`: "E-Prescription is only available for completed appointments" (403)
- `NotFoundException`: "E-Prescription not found" (404)

---

### 2. Quy Tắc PDF Generation

**Điều Kiện Bắt Buộc:**
- ✅ Reuse tất cả validation từ getPatientEPrescription()
- ✅ Load thêm aggregated data: clinic, doctor, patient info
- ✅ Generate PDF on-demand (không cache)
- ✅ Support Unicode UTF-8 (tiếng Việt)
- ✅ Set proper HTTP headers (Content-Type, Content-Disposition)

**Query Strategy:**
```sql
-- Aggregated data cho PDF header
SELECT 
  clinic._id AS clinic_id,
  clinic.business_name AS clinic_name,
  clinic.address AS clinic_address,
  clinic.phone AS clinic_phone,
  clinic.profile_picture AS clinic_logo,
  doctor._id AS doctor_id,
  doctor.full_name AS doctor_name,
  doctor_info.academic_degree AS doctor_degree,
  doctor_info.position AS doctor_position,
  patient.full_name AS patient_name,
  patient.dob AS patient_dob,
  patient.gender AS patient_gender,
  patient.phone AS patient_phone
FROM appointments a
INNER JOIN accounts clinic ON clinic._id = a.clinic_id
INNER JOIN accounts doctor ON doctor._id = a.doctor_id
INNER JOIN accounts patient ON patient._id = a.patient_id
LEFT JOIN doctor_information doctor_info ON doctor_info.account_id = doctor._id
WHERE a._id = :appointmentId;
```

**PDF Content Structure:**
1. **Header Section**:
   - Clinic logo (nếu có)
   - Clinic name, address, phone
   - Tiêu đề: "ĐƠN THUỐC ĐIỆN TỬ"

2. **Patient Info Section**:
   - Họ tên bệnh nhân
   - Ngày sinh, giới tính, số điện thoại
   - Mã cuộc hẹn (reference_id)

3. **Medicine Table**:
   ```
   | STT | Tên Thuốc | Liều Lượng | Số Lượng | Cách Dùng | Ghi Chú |
   |-----|-----------|------------|----------|-----------|---------|
   | 1   | Paracetamol 500mg | 500mg | 20 viên | Uống sau ăn | - |
   | 2   | Amoxicillin | 250mg | 30 viên | 3 lần/ngày | Uống đủ liệu trình |
   ```

4. **Doctor Note Section**:
   - Lời dặn của bác sĩ (nếu có)

5. **Doctor Signature Section**:
   - Bác sĩ kê đơn: [Tên] - [Học vị]
   - Ngày cấp đơn: [Date]

6. **Footer Section**:
   - Legal disclaimer: "Đơn thuốc này chỉ có giá trị trong 30 ngày kể từ ngày cấp"

**Security & Performance:**
- ✅ Không lưu PDF trên server (generate real-time)
- ✅ Set headers: `Content-Disposition: attachment` (force download)
- ✅ Không cache response (chứa thông tin bệnh nhân)
- ✅ Verify ownership trước khi generate (reuse validation)

**Mục Đích:**
- Cung cấp bản PDF chính thức cho bệnh nhân
- Hỗ trợ in ấn tại nhà thuốc
- Tuân thủ quy định về đơn thuốc điện tử

---

### 3. Quy Tắc ERM Polymorphic Retrieval

**6 Loại ERM Được Hỗ Trợ:**

| Record Type | Child Table | Primary Fields |
|-------------|-------------|----------------|
| **CONSULTATION** | erm_consultations | visit_type, chief_complaint, diagnosis, treatment_plan |
| **XRAY** | erm_xrays | region, projection, findings, conclusion, image_urls |
| **LAB** | erm_labs | panel_name, specimen_type, results (JSONB), conclusion |
| **ULTRASOUND** | erm_ultrasounds | body_site, technique, findings, measurements (JSONB) |
| **BONE_DENSITY** | erm_bone_densities | site, bmd_value, t_score, z_score, who_category |
| **PROCEDURE** | erm_procedures | procedure_code, description, outcome, complications |

**Multi-Layer Validation:**

```typescript
// Layer 1: Verify appointment ownership
const appointment = await appointmentRepository.findOne({
  where: { _id: appointmentId, patientId, deletedAt: IsNull() }
});

// Layer 2: Verify ERM belongs to appointment
const erm = await ermRepository.findOne({
  where: { _id: ermId, appointmentId, deletedAt: IsNull() }
});

// Layer 3: Verify ERM status (must be COMPLETED or SIGNED)
if (erm.status !== ERMStatus.COMPLETED && erm.status !== ERMStatus.SIGNED) {
  throw new ForbiddenException(
    'ERM record is not available (status must be COMPLETED)'
  );
}

// Layer 4: Polymorphic retrieval based on record_type
let ermDetails = null;

switch (erm.recordType) {
  case ERMRecordType.XRAY:
    ermDetails = await ermXrayRepository.findOne({
      where: { ermId: erm._id, deletedAt: IsNull() }
    });
    break;
  
  case ERMRecordType.LAB:
    ermDetails = await ermLabRepository.findOne({
      where: { ermId: erm._id, deletedAt: IsNull() }
    });
    break;
  
  // ... (6 cases total)
}
```

**Polymorphic Mapping Strategy:**

```typescript
// Single Table Inheritance pattern với discriminator column
// Base table: erms (với record_type discriminator)
// Child tables: erm_xrays, erm_labs, etc. (1-1 relationship)

private mapERMDetailsToDto(recordType: ERMRecordType, details: any) {
  switch (recordType) {
    case ERMRecordType.XRAY:
      return {
        region: details.region,
        projection: details.projection,
        indication: details.indication,
        technique: details.technique,
        findings: details.findings,
        osteoarthritis_grade: details.osteoarthritisGrade,
        conclusion: details.conclusion,
        recommendations: details.recommendations,
        image_urls: details.imageUrls
      };
    
    case ERMRecordType.LAB:
      return {
        panel_name: details.panelName,
        specimen_type: details.specimenType,
        collected_at: details.collectedAt,
        received_at: details.receivedAt,
        reported_at: details.reportedAt,
        results: details.results, // JSONB
        abnormal_summary: details.abnormalSummary,
        conclusion: details.conclusion,
        recommendations: details.recommendations
      };
    
    // ... (6 cases total)
  }
}
```

**Điều Kiện Bắt Buộc:**
- ✅ Base ERM record phải tồn tại trong `erms` table
- ✅ ERM status phải là `COMPLETED` hoặc `SIGNED`
- ✅ Child ERM record phải tồn tại trong bảng tương ứng
- ✅ `record_type` xác định bảng child nào sẽ được query
- ✅ Relationship: `erms._id (PK) === erm_xrays.erm_id (FK)` (1-1)

**Mục Đích:**
- Hỗ trợ nhiều loại hồ sơ y tế với cấu trúc dữ liệu khác nhau
- Dễ dàng mở rộng thêm loại ERM mới (e.g., MRI, CT_SCAN)
- Type-safe DTO responses với discriminated unions

**Thông Báo Lỗi:**
- `NotFoundException`: "Appointment not found" (404)
- `NotFoundException`: "ERM record not found" (404)
- `ForbiddenException`: "ERM record is not available (status must be COMPLETED)" (403)
- `NotFoundException`: "XRAY details not found" (404) - Child record không tồn tại

---

### 4. Quy Tắc Soft Delete Filtering

**Điều Kiện Bắt Buộc:**
```typescript
// Tất cả queries phải filter soft-deleted records
WHERE deleted_at IS NULL

// Cho base entities
appointment.deletedAt = null
e_prescription.deletedAt = null
erm.deletedAt = null

// Cho child entities
detail_e_prescription.deletedAt = null
erm_xray.deletedAt = null

// Application-level filtering
const activeDetails = ePrescription.detailEPrescriptions?.filter(
  d => !d.deletedAt
) || [];
```

**Mục Đích:**
- Compliance với audit trail requirements
- Không hiển thị dữ liệu đã xóa cho bệnh nhân
- Giữ lại dữ liệu trong database cho báo cáo/phân tích

---

### 5. Quy Tắc Security & Authorization

**JWT Authentication:**
- ✅ Tất cả APIs yêu cầu valid JWT token
- ✅ Token phải chứa `user._id` (patient ID)
- ✅ Token phải chứa `user.role = 'patient'`

**Role-Based Access Control (RBAC):**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AccountRole.PATIENT)
async getMyEPrescription(@Request() req, @Param('appointmentId') appointmentId: string) {
  const patientId = req.user._id; // Extract từ JWT
  return this.prescriptionsService.getPatientEPrescription(patientId, appointmentId);
}
```

**Data Ownership Verification:**
```typescript
// CRITICAL: Verify appointment.patient_id === req.user._id
// Ngăn Patient A access data của Patient B

const appointment = await appointmentRepository.findOne({
  where: {
    _id: appointmentId,
    patientId: req.user._id, // OWNERSHIP CHECK
    deletedAt: IsNull()
  }
});

if (!appointment) {
  throw new NotFoundException('Appointment not found'); // Generic message, không leak info
}
```

**Audit Logging:**
- ✅ Log tất cả ERM accesses (medical record access trail)
- ✅ Log PDF exports (compliance requirement)
- ✅ Log failed authorization attempts

**Mục Đích:**
- HIPAA/GDPR compliance
- Ngăn unauthorized access to medical records
- Tạo audit trail cho regulatory requirements

---

### 6. Quy Tắc Query Optimization

**Eager Loading Strategy:**
```typescript
// Load E-Prescription với nested relations
const ePrescription = await ePrescriptionRepository
  .createQueryBuilder('ep')
  .leftJoinAndSelect('ep.detailEPrescriptions', 'dep')
  .leftJoinAndSelect('dep.medicine', 'm')
  .where('ep.appointment_id = :appointmentId', { appointmentId })
  .andWhere('ep.deleted_at IS NULL')
  .getOne();

// Tránh N+1 queries: Load tất cả relations trong 1 query
```

**Query Count Targets:**
- API 3 (E-Prescription Detail): 2 queries
  - Query 1: Verify appointment ownership
  - Query 2: Load e-prescription + details + medicines (eager loading)
  
- API 4 (PDF Export): 3 queries
  - Reuse API 3 validation (2 queries)
  - Query 3: Load aggregated data (clinic, doctor, patient)
  
- API 5 (ERM Detail): 3 queries
  - Query 1: Verify appointment ownership
  - Query 2: Verify ERM + status check
  - Query 3: Load polymorphic child record

**Index Requirements:**
```sql
-- E-Prescription indexes
CREATE INDEX idx_e_prescriptions_appointment 
  ON e_prescriptions(appointment_id, deleted_at);

CREATE INDEX idx_detail_e_prescriptions_prescription 
  ON detail_e_prescriptions(e_prescription_id, deleted_at);

-- ERM indexes
CREATE INDEX idx_erms_appointment_status 
  ON erms(appointment_id, status, deleted_at);

CREATE INDEX idx_erm_xrays_erm_id 
  ON erm_xrays(erm_id, deleted_at);

-- Tương tự cho 5 bảng ERM còn lại
```

**Performance Targets:**
- ✅ API response time: < 200ms (p95)
- ✅ Total queries per request: ≤ 3 queries
- ✅ No N+1 query patterns
- ✅ PDF generation: < 1 second

---

## Kết Luận

Prescriptions Module - Patient View Flow đã được thiết kế với:

✅ **Bảo Mật Cao**: Multi-layer validation, ownership verification, RBAC  
✅ **Tính Đa Hình**: Hỗ trợ 6 loại ERM với polymorphic retrieval  
✅ **Hiệu Năng Tốt**: Query optimization, eager loading, indexing  
✅ **Tuân Thủ Y Tế**: Status-based visibility, audit logging, medical record compliance  
✅ **Linh Hoạt**: Dễ dàng mở rộng thêm loại ERM mới  
✅ **PDF Export**: Real-time generation với tiếng Việt support

**Trạng Thái Hiện Tại**: Production Ready  
**Coverage**: Unit tests đạt 100% cho critical paths  
**Documentation**: Đầy đủ business rules, technical specs, và troubleshooting guides

---

## Tài Liệu Tham Khảo

- Kế Hoạch Triển Khai: `document/view_appointment_implementation.txt`
- Schemas Entity: `src/modules/prescriptions/entities/`
- Unit Tests: `test/unit/prescriptions/prescriptions.service.spec.ts`
- Business Rules Appointments: `test/unit/appointments/business_rules.md`
- Tài Liệu API: Swagger UI tại `/api`
