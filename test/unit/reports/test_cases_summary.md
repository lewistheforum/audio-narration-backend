# Test Cases Summary - Reports Service (Unit Tests)

## 📌 Tổng Quan
**File test:** `reports.service.spec.ts`

**Phương pháp:** Unit Testing với Jest & NestJS Testing Module

**Module being tested:** `ReportService` - Chức năng `createReport()`

**Mocks:**
- `ReportRepository` - Mock repository để test logic mà không cần database thật
- `MailerService` - Mock email service (không gửi email thật trong unit test)

**Test Coverage:** 100% các business logic paths cho chức năng tạo report

---

## 🧪 Test Suite Structure

### 1. ✅ SUCCESS Cases - Các Trường Hợp Thành Công

#### TC-01: ✅ Should create report successfully with all fields
**Mục đích:** Kiểm tra tạo report thành công với đầy đủ tất cả các trường dữ liệu.

**Setup:**
- `accountId` = `"patient-123"`
- DTO với đầy đủ: `reportType`, `description`, `reportImages` (array có 2 URLs)

**Expected:**
- Repository `createReport()` được gọi với đúng params (bao gồm defaults)
- Repository `saveReport()` được gọi để persist data
- Response trả về report đã được lưu
- Verify các field:
  - `accountId` = `"patient-123"`
  - `reportType` = `ReportType.BUG`
  - `description` = mô tả chi tiết
  - `reportImages` = array có 2 URLs
  - `isResponse` = `false` (default)
  - `responseDescription` = `null` (default)

**Verify:**
- `reportRepository.createReport()` called with correct params
- `reportRepository.saveReport()` called with created entity

---

#### TC-02: ✅ Should create report successfully without reportImages (optional field)
**Mục đích:** Kiểm tra tạo report thành công khi không có `reportImages` (field optional).

**Setup:**
- DTO không có `reportImages` (undefined)

**Expected:**
- Report được tạo với `reportImages = []` (empty array)
- Service map `undefined` → `[]` để đảm bảo database consistency

**Verify:**
- `reportRepository.createReport()` được gọi với `reportImages: []`
- Response có `reportImages: []`

---

#### TC-03: ✅ Should create report with different report types
**Mục đích:** Kiểm tra tạo report với tất cả các loại `reportType` trong enum.

**Setup:**
- Loop qua tất cả enum values: `BUG`, `ABUSE`, `SPAM`, `INAPPROPRIATE_CONTENT`, `FRAUD`, `OTHER`
- Tạo report cho mỗi loại

**Expected:**
- Mỗi report được tạo thành công
- `reportType` trong response khớp với value đã gửi

**Verify:**
- Service xử lý đúng cho tất cả các enum values
- Không có enum nào bị reject

---

#### TC-04: ✅ Should always set isResponse to false and responseDescription to null on creation
**Mục đích:** Đảm bảo default values luôn được set đúng khi tạo report mới.

**Setup:**
- DTO cơ bản với `reportType` và `description`

**Expected:**
- `isResponse` luôn = `false` (chưa được phản hồi)
- `responseDescription` luôn = `null` (chưa có nội dung phản hồi)

**Verify:**
- Repository `createReport()` được gọi với `isResponse: false` và `responseDescription: null`
- Response confirm các giá trị này

**Business Rule:**
- Report mới tạo luôn chưa được phản hồi
- Chỉ Admin mới có thể set `isResponse = true` qua endpoint khác

---

#### TC-05: ✅ Should get accountId from authenticated user, not from request body
**Mục đích:** Đảm bảo `accountId` được lấy từ user đăng nhập, không từ request body.

**Setup:**
- `accountId` = `"patient-authenticated-user-id"` (từ JWT token)
- DTO không chứa field `accountId`

**Expected:**
- Service method nhận `accountId` từ tham số (lấy từ `user.id` ở controller)
- DTO không có property `accountId`

**Verify:**
- Repository `createReport()` được gọi với `accountId` từ tham số method
- Verify DTO không có `accountId` field (security measure)

**Security Note:**
- Ngăn chặn user tự gửi `accountId` của người khác
- `accountId` luôn được extract từ JWT token hợp lệ

---

### 2. ❌ FAILURE Cases - Validation

> **Lưu ý:** Validation được handle bởi class-validator ở DTO layer (Controller level).  
> Service không validate input, nó assume DTO đã được validate đúng.  
> Các test cases dưới đây document behavior nếu invalid data somehow bypass validators.

#### TC-06: ❌ Should fail when description is missing
**Mục đích:** Document rằng validation xảy ra ở DTO level, không phải Service level.

**Setup:**
- DTO với `description = ""` (empty string)

**Expected:**
- Service vẫn xử lý (không reject)
- Trong thực tế, DTO validator sẽ reject request trước khi đến service

**Note:**
- Test này document rằng service rely on DTO validators
- Trong production, request không bao giờ đến service nếu validation fail

---

#### TC-07: ❌ Should fail when reportType is missing
**Mục đích:** Document validation behavior.

**Setup:**
- DTO với `reportType = null`

**Expected:**
- Service không validate, sẽ tạo entity với `reportType = null`
- DTO validator sẽ reject trước khi đến đây

---

#### TC-08: ❌ Should fail when reportType is invalid enum value
**Mục đích:** Document invalid enum handling.

**Setup:**
- DTO với `reportType = "INVALID_TYPE"` (không thuộc enum)

**Expected:**
- Service không validate enum, rely on DTO validators
- In production, DTO validator reject trước

---

### 3. 🔒 AUTHORIZATION Cases (Guard-level)

#### TC-09: ✅ Should accept report creation from PATIENT role
**Mục đích:** Verify service hoạt động đúng khi được gọi bởi PATIENT.

**Setup:**
- `accountId = "patient-role-user-123"` (giả định user là PATIENT)

**Expected:**
- Service tạo report thành công
- Response có `accountId` khớp với user

**Note:**
- Authorization được check ở Controller level bởi Guards
- Service assume caller đã được authorize

---

#### TC-10: 🔒 Authorization for non-PATIENT roles is handled by Guards
**Mục đích:** Document rằng authorization không phải trách nhiệm của Service.

**Documentation Test:**
- Controller có `@UseGuards(JwtAuthGuard, RolesGuard)`
- Controller có `@Roles(AccountRole.PATIENT)`
- Nếu user không phải PATIENT → Guards reject với 403 Forbidden
- Service không bao giờ được gọi nếu authorization fail

**Best Practice:**
- Luôn đi qua Controller endpoints có guards
- Không gọi service trực tiếp mà bypass guards

---

### 4. 🔍 EDGE Cases - Các Trường Hợp Biên

#### TC-11: ✅ Should handle empty reportImages array
**Mục đích:** Kiểm tra xử lý array rỗng.

**Setup:**
- DTO với `reportImages = []`

**Expected:**
- Report được tạo với `reportImages = []`
- Không có lỗi hoặc exception

---

#### TC-12: ✅ Should handle very long description text
**Mục đích:** Kiểm tra xử lý mô tả dài (5000 ký tự).

**Setup:**
- `description` = string 5000 ký tự (lặp lại 'A')

**Expected:**
- Service xử lý thành công
- Response có `description` đầy đủ 5000 ký tự

**Note:**
- Database column type `text` hỗ trợ chuỗi dài
- Không có giới hạn length ở service layer

---

#### TC-13: ✅ Should handle multiple image URLs
**Mục đích:** Kiểm tra xử lý nhiều URLs trong `reportImages`.

**Setup:**
- `reportImages` = array có 5 URLs

**Expected:**
- Report được tạo với đầy đủ 5 URLs
- No truncation hoặc data loss

**Verify:**
- `result.reportImages.length === 5`
- Array order được preserve

---

### 5. 🗄️ DATABASE Integration

#### TC-14: ✅ Should call repository.createReport with correct parameters
**Mục đích:** Verify repository method được gọi đúng params.

**Expected:**
- `reportRepository.createReport()` called exactly 1 time
- Called with object:
  ```javascript
  {
    accountId: "patient-123",
    reportType: dto.reportType,
    description: dto.description,
    reportImages: dto.reportImages,
    isResponse: false,
    responseDescription: null
  }
  ```

---

#### TC-15: ✅ Should call repository.saveReport to persist data
**Mục đích:** Verify entity được persist vào database.

**Expected:**
- `reportRepository.saveReport()` called exactly 1 time
- Called with created entity object

---

#### TC-16: ✅ Should return the saved report entity from database
**Mục đích:** Verify service trả về entity đã được lưu (có `_id` generated).

**Setup:**
- Mock `createReport()` trả về entity chưa có `_id`
- Mock `saveReport()` trả về entity có `_id = "generated-uuid-123"`

**Expected:**
- Response có `_id = "generated-uuid-123"`
- Confirm entity từ database được return

---

## 📊 Test Coverage Summary

| Category | Test Cases | Coverage |
|----------|-----------|----------|
| ✅ Success Cases | TC-01 đến TC-05 | 5 tests |
| ❌ Validation Cases | TC-06 đến TC-08 | 3 tests |
| 🔒 Authorization | TC-09 đến TC-10 | 2 tests |
| 🔍 Edge Cases | TC-11 đến TC-13 | 3 tests |
| 🗄️ Database Integration | TC-14 đến TC-16 | 3 tests |
| **TOTAL** | | **16 test cases** |

---

## 🎯 Test Coverage Goals

- ✅ **Happy Path:** Tạo report thành công với đầy đủ data
- ✅ **Optional Fields:** Xử lý fields tùy chọn (`reportImages`)
- ✅ **Default Values:** Verify `isResponse` và `responseDescription` defaults
- ✅ **Security:** `accountId` từ JWT token, không từ body
- ✅ **Enum Handling:** Tất cả enum values của `ReportType`
- ✅ **Edge Cases:** Empty arrays, long text, multiple images
- ✅ **Repository Calls:** Verify correct params và call counts
- ✅ **Authorization Documentation:** Document Guard-level security

---

## 🔧 Running Tests

```bash
# Run all reports tests
npm test -- reports.service.spec.ts

# Run with coverage
npm test -- --coverage reports.service.spec.ts

# Run in watch mode
npm test -- --watch reports.service.spec.ts
```

---

## 📝 Notes

1. **DTO Validation:**
   - Handled by class-validator decorators in `CreateReportDto`
   - Service assumes DTO is already validated
   - Tests document this separation of concerns

2. **Authorization:**
   - Handled by Guards at Controller level
   - Service does not check user role
   - Tests document this design pattern

3. **Mocking Strategy:**
   - Mock `ReportRepository` to isolate service logic
   - Mock `MailerService` (không dùng trong create, chỉ trong respond)
   - No database connection required for unit tests

4. **Best Practices:**
   - Mock data factories để reuse test data
   - Clear, descriptive test names following AAA pattern (Arrange-Act-Assert)
   - Each test case isolated và independent
   - `afterEach()` clear all mocks để avoid side effects
---

## 🧪 Test Suite Structure: BranchReportService

### 1. ✅ SUCCESS Cases

#### TC-17: ✅ Should get customer stats for different periods
**Mục đích:** Kiểm tra thống kê khách hàng theo Ngày/Tháng/Năm.
**Setup:** Gọi `getCustomerStats` với `DAY`, `MONTH`, `YEAR`.
**Expected:** QueryBuilder gọi đúng hàm SQL `TO_CHAR` tương ứng với định dạng ngày.

#### TC-18: ✅ Should return combined doctor feedback data
**Mục đích:** Kiểm tra việc tổng hợp dữ liệu bác sĩ, điểm đánh giá và nội dung feedback.
**Expected:** Kết quả trả về mảng object chứa đầy đủ: `doctorId`, `fullName`, `avgRating`, `totalFeedback`, `recentFeedbacks`.

#### TC-19: ✅ Should calculate service statistics correctly
**Mục đích:** Kiểm tra tính toán số lượt đăng ký và doanh thu dịch vụ.
**Expected:** Các giá trị chuỗi từ SQL phải được convert sang `number` chính xác.

### 2. ❌ FAILURE & EDGE Cases

#### TC-20: ❌ Should throw error when date is missing for doctor report
**Mục đích:** Đảm bảo hệ thống báo lỗi nếu thiếu ngày.
**Expected:** Trả về `BadRequestException` với message "Date is required for this report".

#### TC-21: ✅ Should filter out CANCELLED/ABSENT appointments
**Mục đích:** Bảo vệ tính chính xác của dữ liệu.
**Expected:** Query phải có điều kiện `NOT IN ('CANCELLED', 'ABSENT')`.
