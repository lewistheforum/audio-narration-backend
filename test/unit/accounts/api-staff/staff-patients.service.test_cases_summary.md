# TÓM TẮT CÁC TEST CASE - TẠO TÀI KHOẢN PATIENT WALK-IN (CLINIC STAFF)

## TỔNG QUAN

Tài liệu này tóm tắt các test case đã được implement cho StaffPatientsService.

**File**: `test/unit/accounts/api-staff/staff-patients.service.spec.ts`

**Tổng Số Test Cases**: 7

---

## FLOW 1: createPatientByStaff

### ✅ Test Cases Positive (Thành Công)

1. **✅ Tạo PATIENT thành công và trả về mật khẩu tạm khi gửi email thành công**
   - Kết quả mong đợi: Tài khoản được kích hoạt; emailSent = true

2. **✅ Vẫn tạo PATIENT thành công khi gửi email thất bại**
   - Kết quả mong đợi: emailSent = false; không làm hỏng luồng tạo tài khoản

### ❌ Test Cases Negative (Lỗi)

3. **❌ Từ chối khi email đã tồn tại**

---

## FLOW 2: createPatientNoEmail

### ✅ Test Cases Positive (Thành Công)

4. **✅ Tạo PATIENT với email tạm và trả về thông tin đăng nhập thủ công**

5. **✅ Vẫn tạo PATIENT thành công khi gửi thông báo email tạm thất bại**

### ❌ Test Cases Negative (Lỗi)

6. **❌ Từ chối khi số điện thoại đã tồn tại**

---

## FLOW 3: getAllPatientAccounts

### ✅ Test Cases Positive (Thành Công)

7. **✅ Mapping danh sách PATIENT và chuẩn hóa định dạng ngày sinh**

---

## TÓM TẮT COVERAGE

- **Coverage mục tiêu**: >85% cho business logic chính
- **Trạng thái**: ✅ Passed

---

## CAP NHAT SNIPER

8. ✅ createPatientByStaff: rollback khi lỗi save.
9. ✅ createPatientNoEmail: rollback khi lỗi save.
10. ✅ generateTempEmail: sinh hậu tố `_01` khi email gốc bị trùng.
11. ✅ generateRandomPassword: đảm bảo đủ 4 nhóm ký tự và độ dài 12.

---

## BỔ SUNG SCENARIO TODO (BUSINESS-FOCUSED)

12. 📝 TODO nghiệp vụ: bắt buộc hash password trước khi lưu account walk-in.
13. 📝 TODO nghiệp vụ: response luôn trả credentials cho staff kể cả khi gửi mail thất bại.
14. 📝 TODO nghiệp vụ: luồng không email phải gắn cờ `isTempEmail=true` để theo dõi hậu kiểm.
15. 📝 TODO nghiệp vụ: sinh email tạm có chiến lược chống trùng nhiều lớp (counter -> phone -> uuid).
16. 📝 TODO nghiệp vụ: danh sách bệnh nhân phải chuẩn hóa DOB và cờ vận hành (`isActive`, `isTempEmail`).
17. 📝 TODO nghiệp vụ: transaction rollback toàn phần cho cả 2 luồng tạo account khi lỗi lưu dữ liệu.
