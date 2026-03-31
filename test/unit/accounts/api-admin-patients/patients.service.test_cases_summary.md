# TÓM TẮT CÁC TEST CASE - QUẢN LÝ PATIENT (SYSTEM ADMIN)

## TỔNG QUAN

Tài liệu này tóm tắt các test case đã được implement cho PatientsService.

**File**: `test/unit/accounts/api-admin-patients/patients.service.spec.ts`

**Tổng Số Test Cases**: 8

---

## FLOW 1: getAppointmentStatistics

### ✅ Test Cases Positive (Thành Công)

1. **✅ Mapping thống kê với fallback khi thiếu tên chi nhánh/thương hiệu**
   - Đầu vào: Kết quả thống kê thiếu branchName hoặc clinicAdminName
   - Kết quả mong đợi: Hiển thị 'Unknown Branch' và 'Unknown Brand'

### ❌ Test Cases Negative (Lỗi)

2. **❌ Từ chối khi PATIENT không tồn tại**
   - Kết quả mong đợi: Không trả về thống kê

---

## FLOW 2: banPatient

### ✅ Test Cases Positive (Thành Công)

3. **✅ Đạt 3 lần vi phạm thì chuyển sang BAN và gửi thông báo bị cấm**
   - Đầu vào: banCounts ban đầu = 2
   - Kết quả mong đợi: banCounts = 3, trạng thái = BAN

4. **✅ Dưới 3 lần vi phạm thì chỉ cảnh cáo và gửi thông báo cảnh cáo**
   - Đầu vào: banCounts ban đầu = 0
   - Kết quả mong đợi: banCounts = 1, trạng thái không chuyển sang BAN

### ❌ Test Cases Negative (Lỗi)

5. **❌ Từ chối khi PATIENT không tồn tại**

---

## FLOW 3: unbanPatient

### ✅ Test Cases Positive (Thành Công)

6. **✅ Gỡ cấm khi tài khoản đang BAN và reset bộ đếm vi phạm**
   - Kết quả mong đợi: status = ACTIVE, banCounts = 0, banDescription = null

7. **✅ Không thay đổi trạng thái khi tài khoản không ở BAN**
   - Kết quả mong đợi: Không gửi email gỡ cấm

---

## FLOW 4: getBanHistory

### ✅ Test Cases Positive (Thành Công)

8. **✅ Trả về lịch sử xử lý vi phạm theo thứ tự mới nhất trước**

### ❌ Test Cases Negative (Lỗi)

9. **❌ Từ chối khi PATIENT không tồn tại**

---

## TÓM TẮT COVERAGE

- **Coverage mục tiêu**: >85% cho business logic chính
- **Trạng thái**: ✅ Passed

---

## BỔ SUNG SCENARIO TODO (BUSINESS-FOCUSED)

10. 📝 TODO nghiệp vụ: ban/unban PATIENT phải chạy trong transaction và rollback khi lỗi.
11. 📝 TODO nghiệp vụ: mọi quyết định kỷ luật/gỡ kỷ luật đều phải tạo lịch sử xử lý.
12. 📝 TODO nghiệp vụ: điều hướng email theo trạng thái cảnh cáo/ban/gỡ ban.
13. 📝 TODO nghiệp vụ: nếu account không ở BAN thì không gửi email unban.
14. 📝 TODO nghiệp vụ: tên hiển thị email dùng fallback fullName -> username -> `Patient`.
15. 📝 TODO nghiệp vụ: thống kê lịch hẹn nhóm theo clinic/chi nhánh để hỗ trợ phân tích hành vi.
