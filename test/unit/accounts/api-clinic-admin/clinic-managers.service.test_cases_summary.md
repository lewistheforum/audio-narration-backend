# TÓM TẮT CÁC TEST CASE - QUẢN LÝ CLINIC MANAGER (CLINIC ADMIN)

## TỔNG QUAN

Tài liệu này tóm tắt các test case đã được implement cho ClinicManagersService.

**File**: `test/unit/accounts/api-clinic-admin/clinic-managers.service.spec.ts`

**Tổng Số Test Cases**: 6

---

## FLOW 1: banClinicManager

### ✅ Test Cases Positive (Thành Công)

1. **✅ Đạt 3 lần vi phạm thì chuyển chi nhánh sang BAN và áp dụng BAN cho nhân sự thuộc chi nhánh**
   - Điều kiện: banCounts ban đầu = 2 và chi nhánh có danh sách nhân sự
   - Kết quả mong đợi: manager status = BAN; nhân sự bị cập nhật BAN

2. **✅ Dưới 3 lần vi phạm thì chỉ cảnh cáo và không áp dụng BAN cho nhân sự**
   - Điều kiện: banCounts ban đầu < 2
   - Kết quả mong đợi: status không chuyển BAN; không cập nhật nhân sự

### ❌ Test Cases Negative (Lỗi)

3. **❌ Từ chối khi CLINIC_MANAGER không tồn tại**

4. **❌ Từ chối khi CLINIC_MANAGER không thuộc quyền quản lý của admin**

---

## FLOW 2: unbanClinicManager

### ✅ Test Cases Positive (Thành Công)

5. **✅ Gỡ BAN chi nhánh và khôi phục ACTIVE cho nhân sự thuộc chi nhánh**

---

## FLOW 3: getBanHistory

### ✅ Test Cases Positive (Thành Công)

6. **✅ Trả về lịch sử xử lý theo thứ tự mới nhất trước sau khi xác thực quyền quản lý**

---

## TÓM TẮT COVERAGE

- **Coverage mục tiêu**: >85% cho business logic chính
- **Trạng thái**: ✅ Passed

---

## BỔ SUNG SCENARIO TODO (BUSINESS-FOCUSED)

7. 📝 TODO nghiệp vụ: xác thực ownership manager trước mọi thao tác ban/unban/history.
8. 📝 TODO nghiệp vụ: cảnh cáo dưới ngưỡng BAN vẫn bắt buộc ghi lịch sử xử lý.
9. 📝 TODO nghiệp vụ: ban manager ở ngưỡng 3 strike phải cascade xuống doctor/staff trực thuộc.
10. 📝 TODO nghiệp vụ: unban manager không ở trạng thái BAN thì không đổi status nhưng vẫn ghi lịch sử UNBANNED.
11. 📝 TODO nghiệp vụ: tên hiển thị trong email áp dụng fallback branchName -> username -> `Clinic Manager`.
12. 📝 TODO nghiệp vụ: lịch sử ban manager luôn sắp xếp giảm dần theo thời gian.
