# Tổng Hợp Các Trường Hợp Unit Test - Module Subscriptions

Dưới đây là danh sách các trường hợp kiểm thử (test cases) đã được thực hiện cho module Subscriptions.

## 1. Service Definition
- **TC-01**: `should be defined`
  - Kiểm tra service được khởi tạo thành công.

---

## 2. Expired Subscription → Activate Immediately
Kiểm thử luồng kích hoạt ngay khi gói đã hết hạn.

### Activation Logic
- **TC-02**: `should activate subscription immediately if expired`
  - Kiểm tra chuyển status sang `ACTIVE` ngay.
  - Verify serviceId được cập nhật.
  - Verify KHÔNG tạo queue record.

### Date Calculation
- **TC-03**: `should calculate correct end date based on duration (2 months)`
  - Kiểm tra tính đúng ngày kết thúc dựa trên duration.
  - Start Date: `00:00:00 UTC`.
  - End Date: `23:59:59 UTC`.

---

## 3. Active Subscription → Create Queue
Kiểm thử luồng tạo queue khi gói còn hạn.

### Queue Creation
- **TC-04**: `should create queue record when subscription is still active`
  - Kiểm tra tạo queue record thay vì activate ngay.
  - Verify KHÔNG update subscription trực tiếp.
  - Verify vẫn tạo history record.

### Queue Date Calculation
- **TC-05**: `should calculate targetStartDate = expirationDate + 1 day`
  - Kiểm tra ngày bắt đầu queue = ngày hết hạn + 1.
  - Verify format: `00:00:00 UTC`.

- **TC-06**: `should calculate targetEndDate based on duration`
  - Kiểm tra ngày kết thúc queue dựa trên duration.
  - Verify format: `23:59:59 UTC`.

### Queue Update Logic
- **TC-07**: `should update existing queue record instead of creating new`
  - Kiểm tra update queue nếu đã tồn tại.
  - Verify KHÔNG gọi `createQueueRecord`.
  - Verify gọi `save` để update.

---

## 4. Duration Parameter
Kiểm thử tham số duration.

### Default Duration
- **TC-08**: `should default to 1 month if duration not provided`
  - Kiểm tra mặc định duration = 1 nếu không truyền.
  - End date cách start ~1 tháng.

### 12 Month Duration
- **TC-09**: `should correctly calculate 12 month duration`
  - Kiểm tra tính toán đúng với duration = 12 tháng.
  - MonthDiff khoảng 11-12.

---

## Tổng Kết

| Metric | Giá trị |
|:-------|:--------|
| **Tổng số Test Cases** | 9 |
| **Passed** | 9 |
| **Skipped** | 0 |
| **File Test** | `subscription-services.service.spec.ts` |
| **Command** | `npx jest test/unit/subscriptions` |

---

## Quy Tắc Liên Quan

| Rule ID | Mô Tả | Test Case |
|:--------|:------|:----------|
| BR-01 | Duration default = 1 | TC-08 |
| BR-02 | Queue khi ACTIVE | TC-04, TC-05, TC-06 |
| BR-03 | Activate ngay khi EXPIRED | TC-02, TC-03 |
| BR-04 | 1 clinic = 1 queue (UNIQUE) | TC-07 |
| BR-05 | Start 00:00:00, End 23:59:59 | TC-03, TC-05, TC-06 |
