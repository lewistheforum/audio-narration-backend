# TÓM TẮT CÁC TEST CASE - QUẢN LÝ TÀI KHOẢN THUỘC QUYỀN CLINIC MANAGER

## TỔNG QUAN

Tài liệu này tóm tắt các test case đã được implement cho ManagedAccountsService.

**File**: `test/unit/accounts/api-clinic-manager/managed-accounts.service.spec.ts`

**Tổng Số Test Cases**: 6

---

## FLOW 1: banAccount

### ✅ Test Cases Positive (Thành Công)

1. **✅ Đạt 3 lần vi phạm thì chuyển sang BAN và gửi thông báo bị cấm**
   - Điều kiện: banCounts ban đầu = 2
   - Kết quả mong đợi: status = BAN

2. **✅ Dưới 3 lần vi phạm thì chỉ cảnh cáo và gửi thông báo cảnh cáo**
   - Điều kiện: banCounts ban đầu < 2
   - Kết quả mong đợi: status không chuyển sang BAN

### ❌ Test Cases Negative (Lỗi)

3. **❌ Từ chối khi tài khoản không tồn tại**

4. **❌ Từ chối khi tài khoản không thuộc quyền quản lý của manager**

---

## FLOW 2: unbanAccount

### ✅ Test Cases Positive (Thành Công)

5. **✅ Chỉ gỡ cấm khi tài khoản đang BAN và reset bộ đếm vi phạm**

---

## FLOW 3: getBanHistory

### ✅ Test Cases Positive (Thành Công)

6. **✅ Trả về lịch sử xử lý vi phạm theo thứ tự mới nhất trước sau khi xác thực quyền sở hữu**

---

## TÓM TẮT COVERAGE

- **Coverage mục tiêu**: >85% cho business logic chính
- **Trạng thái**: ✅ Passed

---

## BỔ SUNG SCENARIO TODO (BUSINESS-FOCUSED)

7. 📝 TODO nghiệp vụ: xác thực quyền sở hữu trước mọi thao tác quản lý doctor/staff.
8. 📝 TODO nghiệp vụ: cảnh cáo dưới ngưỡng BAN vẫn phải lưu lịch sử xử lý.
9. 📝 TODO nghiệp vụ: đạt 3 strike thì chuyển BAN và gửi email khóa tài khoản.
10. 📝 TODO nghiệp vụ: unban ngoài trạng thái BAN không gửi email nhưng vẫn ghi lịch sử UNBANNED.
11. 📝 TODO nghiệp vụ: email xử lý vi phạm dùng fallback tên fullName -> username -> `Account Holder`.
12. 📝 TODO nghiệp vụ: lịch sử vi phạm luôn trả theo thứ tự mới nhất trước.
