# TÓM TẮT CÁC TEST CASE - CẬP NHẬT HỒ SƠ CLINIC ADMIN (TỰ QUẢN)

## TỔNG QUAN

Tài liệu này tóm tắt các test case đã được implement cho chức năng CLINIC_ADMIN tự cập nhật và xem hồ sơ.

**File**: `test/unit/accounts/api-clinic-admin/clinic-admin-profile.service.spec.ts`

**Tổng Số Test Cases**: 7

---

## FLOW 1: updateOwnProfile

### ✅ Test Cases Positive (Thành Công)

1. **✅ Cập nhật thành công các trường được cung cấp và giữ nguyên các trường còn lại**
   - Đầu vào: DTO chỉ có một phần trường (ví dụ email/clinicName/dob)
   - Kết quả mong đợi: Dữ liệu được cập nhật theo đúng các trường đã gửi

### ❌ Test Cases Negative (Lỗi)

2. **❌ Từ chối khi tài khoản không tồn tại**
   - Kết quả mong đợi: Không cho phép cập nhật

3. **❌ Từ chối khi hồ sơ clinic admin không tồn tại**
   - Kết quả mong đợi: Không cho phép cập nhật

4. **❌ Từ chối khi đổi email trùng với tài khoản khác**
   - Kết quả mong đợi: Không cho phép cập nhật

5. **❌ Từ chối khi đổi số điện thoại trùng với tài khoản khác**
   - Kết quả mong đợi: Không cho phép cập nhật

6. **❌ Từ chối khi đổi SePay VA đã được gán cho phòng khám khác**
   - Kết quả mong đợi: Không cho phép cập nhật

7. **❌ Từ chối khi đổi SePay API Key đã được sử dụng**
   - Kết quả mong đợi: Không cho phép cập nhật

---

## FLOW 2: getOwnProfile

### ✅ Test Cases Positive (Thành Công)

8. **✅ Trả về hồ sơ theo vai trò của người dùng**
   - Kết quả mong đợi: Nhận đúng dữ liệu hồ sơ CLINIC_ADMIN

---

## TÓM TẮT COVERAGE

- **Coverage mục tiêu**: >85% cho business logic chính
- **Trạng thái**: ✅ Passed

---

## BỔ SUNG SCENARIO TODO (BUSINESS-FOCUSED)

9. 📝 TODO nghiệp vụ: dừng toàn bộ lưu dữ liệu nếu bất kỳ kiểm tra uniqueness nào thất bại.
10. 📝 TODO nghiệp vụ: đảm bảo tính nhất quán giữa cập nhật `Account` và `ClinicAdminInformation`.
11. 📝 TODO nghiệp vụ: chuẩn hóa `dob` về kiểu ngày trước khi lưu.
12. 📝 TODO nghiệp vụ: luồng `getOwnProfile` là read-only, không làm thay đổi dữ liệu.
13. 📝 TODO nghiệp vụ: chuẩn hóa response cập nhật bằng service lấy thông tin theo role.
