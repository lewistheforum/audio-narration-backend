# TÓM TẮT CÁC TEST CASE - QUẢN LÝ CLINIC ADMIN (SYSTEM ADMIN)

## TỔNG QUAN

Tài liệu này tóm tắt các test case đã được implement cho các chức năng SYSTEM ADMIN quản lý CLINIC_ADMIN.

**File**: `test/unit/accounts/api-admin-clinic-admin/clinic-admins.service.spec.ts`

**Tổng Số Test Cases**: 3

---

## FLOW 1: findAll

### ✅ Test Cases Positive (Thành Công)

1. **✅ Trả về danh sách và tổng số bản ghi; áp dụng filter tìm kiếm khi có từ khóa**
   - Đầu vào: page/limit hợp lệ và có search
   - Kết quả mong đợi: Danh sách trả về đúng định dạng và có áp dụng điều kiện tìm kiếm

---

## FLOW 2: findOne

### ✅ Test Cases Positive (Thành Công)

2. **✅ Trả về chi tiết kèm thống kê số chi nhánh, bác sĩ và nhân viên**
   - Điều kiện: CLINIC_ADMIN có chi nhánh; mỗi chi nhánh có thể có doctor/staff
   - Kết quả mong đợi: Thống kê đúng theo cây quan hệ

### ❌ Test Cases Negative (Lỗi)

3. **❌ Từ chối khi CLINIC_ADMIN không tồn tại**
   - Kết quả mong đợi: Không trả về dữ liệu chi tiết

---

## TÓM TẮT COVERAGE

- **Coverage mục tiêu**: >85% cho business logic chính
- **Trạng thái**: ✅ Passed

---

## CAP NHAT SNIPER

10. ✅ getSubscriptionHistory: fallback `serviceName = "Unknown"` khi service null.
11. ✅ getClinicServices: trả rỗng khi CLINIC_ADMIN chưa có manager.
12. ✅ getFeedbacks: phân nhóm đúng `clinics` và `doctors`.
13. ✅ findOne: map đầy đủ `address` + `googleIframe` khi có dữ liệu.
14. ✅ banClinicAdmin: nhánh warning (`banCounts < 3`) commit và gửi warning email.
15. ✅ banClinicAdmin: not found -> rollback + throw NotFoundException.
16. ✅ unbanClinicAdmin: not found -> rollback + throw NotFoundException.
17. ✅ unbanClinicAdmin: account không ở trạng thái BAN -> rollback branch, không gửi unban email.

18. 📝 TODO nghiệp vụ: danh sách CLINIC_ADMIN chỉ gồm đúng role và hỗ trợ tìm kiếm đa trường.
19. 📝 TODO nghiệp vụ: chi tiết CLINIC_ADMIN phải thống kê đầy đủ manager/doctor/staff theo cây tổ chức.
20. 📝 TODO nghiệp vụ: khóa tài khoản theo cơ chế 3 strike và cascade xuống toàn bộ nhân sự liên quan.
21. 📝 TODO nghiệp vụ: mở khóa chỉ áp dụng đầy đủ cho tài khoản đang ở trạng thái BAN.
22. 📝 TODO nghiệp vụ: phân tách feedback theo nhóm CLINIC và DOCTOR trong báo cáo admin.
23. 📝 TODO nghiệp vụ: truy xuất chi tiết feedback theo đúng clinic scope, sai scope phải bị từ chối.
24. 📝 TODO nghiệp vụ: truy xuất lịch sử ban chỉ hợp lệ khi CLINIC_ADMIN tồn tại đúng role.
