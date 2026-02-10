# Tổng Hợp Các Trường Hợp Unit Test - Module Transactions

Dưới đây là danh sách các trường hợp kiểm thử (test cases) đã được thực hiện cho module Transactions.

## 1. Thanh Toán Đơn Thuốc (`createDynamicQr`)
Kiểm thử chức năng tạo mã QR thanh toán đơn thuốc.

### Source of Truth
- **TC-01**: `should use Appointment.total as source of truth for amount`
  - Kiểm tra việc sử dụng số tiền từ DB (Appointment.total).
  - Đảm bảo bỏ qua mọi số tiền client gửi lên, chống gian lận.

### Account Routing
- **TC-02**: `should use Clinic account for QR (not Company account)`
  - Kiểm tra QR thanh toán đơn thuốc sử dụng tài khoản Phòng khám.
  - Đảm bảo tiền vào đúng tài khoản của Phòng khám (sepayVa, bankName).

### Transaction Creation
- **TC-03**: `should NOT create Transaction record immediately`
  - Kiểm tra không tạo Transaction record ngay khi tạo QR.
  - Transaction chỉ được tạo khi callback thanh toán thành công.

### Validation
- **TC-04**: `should throw NotFoundException if Appointment not found`
  - Kiểm tra ném lỗi khi không tìm thấy Appointment.

---

## 2. Xác Minh Phòng Khám (`createVerificationQr`)
Kiểm thử chức năng tạo mã QR xác minh tài khoản phòng khám.

### Fixed Amount
- **TC-05**: `should always use fixed amount of 10,000 VND`
  - Kiểm tra số tiền xác minh luôn cố định là 10,000 VND.

### Transaction Creation
- **TC-06**: `should create Transaction record immediately with PENDING status`
  - Kiểm tra tạo Transaction record ngay với status PENDING.
  - Đảm bảo Transaction ID được dùng làm nội dung QR.

### Account Routing
- **TC-07**: `should use Clinic account for QR (not Company account)`
  - Kiểm tra QR xác minh sử dụng tài khoản Phòng khám.

---

## 3. Gói Dịch Vụ - Mua Mới (`createNewSubscriptionQr`)
Kiểm thử chức năng tạo mã QR mua gói dịch vụ mới.

### Create Flow
- **TC-08**: `should create new subscription if none exists`
  - Kiểm tra tạo subscription record mới nếu phòng khám chưa có.
  - Đảm bảo subscription được tạo với status PENDING_SEPAY_SETUP.

### Validation
- **TC-09**: `should throw BadRequest if subscription is ACTIVE and not expired`
  - Kiểm tra ném lỗi nếu phòng khám đang có gói ACTIVE chưa hết hạn.
  - Hướng dẫn user dùng "Gia hạn" hoặc "Đổi gói" thay thế.

### Account Routing (BR-06)
- **TC-10**: `should use Company account (ENV) for QR generation`
  - **Quan trọng**: Kiểm tra QR thanh toán gói sử dụng tài khoản **Công ty**.
  - Tiền vào tài khoản từ ENV: `SEEPAY_ACC`, `SEEPAY_BANK`.

---

## 4. Gói Dịch Vụ - Gia Hạn (`createRenewalQr`)
Kiểm thử chức năng tạo mã QR gia hạn gói dịch vụ.

### Validation
- **TC-11**: `should throw BadRequest if subscription is ACTIVE and not expired`
  - Kiểm tra không cho phép gia hạn khi gói đang ACTIVE chưa hết hạn.

### Allow Renewal Cases
- **TC-12**: `should allow renewal if subscription is EXPIRED`
  - Kiểm tra cho phép gia hạn nếu gói đã hết hạn.
- **TC-13**: `should allow renewal if subscription is NON_RENEWING`
  - Kiểm tra cho phép gia hạn nếu gói đang ở trạng thái hủy gia hạn.

---

## 5. Gói Dịch Vụ - Đổi Gói (`createPackageChangeQr`)
Kiểm thử chức năng tạo mã QR đổi gói dịch vụ.

### Account Routing (BR-06)
- **TC-14**: `should use Company account for QR generation`
  - **Quan trọng**: Kiểm tra QR đổi gói sử dụng tài khoản **Công ty**.

---

## 6. Xử Lý Callback Thanh Toán (`handleCallback`)
Kiểm thử chức năng xử lý webhook từ SePay.

### Strategy A: Transaction Đã Tồn Tại
- **TC-15**: `should update existing transaction to SUCCESS`
  - Kiểm tra cập nhật transaction từ PENDING sang SUCCESS.
- **TC-16**: `should set isVerify=true if transaction type is VERIFICATION`
  - Kiểm tra set `ClinicAdmin.isVerify = true` sau khi xác minh thành công.
- **TC-17**: `should call handleSubscriptionPaymentSuccess if type is SUBSCRIPTION`
  - Kiểm tra gọi handler kích hoạt gói dịch vụ.
  - Đảm bảo truyền đúng `subscriptionId`, `targetServiceId`, `transactionId`.

### Strategy B: Transaction Mới (Đơn Thuốc)
- **TC-18**: `should create NEW transaction if no existing and appointment exists`
  - Kiểm tra tạo transaction mới cho thanh toán đơn thuốc.
  - Áp dụng khi không tìm thấy transaction pending.

---

## 7. Utility Methods

### getAllPaymentHistory
- **TC-19**: `should return paginated items`
  - Kiểm tra phân trang danh sách lịch sử thanh toán.

### getTransactionDetail
- **TC-20**: `should return detail if found`
  - Kiểm tra trả về chi tiết transaction.
- **TC-21**: `should throw NotFoundException if not found`
  - Kiểm tra ném lỗi khi không tìm thấy transaction.

---

## 8. Subscription Payment Success (`handleSubscriptionPaymentSuccess`)
Kiểm thử chức năng xử lý kích hoạt/queue subscription sau thanh toán thành công.

**File:** `subscription-services.service.spec.ts`

### Case: Expired → Activate Immediately
- **TC-22**: `should activate subscription immediately if expired`
  - Kiểm tra kích hoạt ngay khi gói đã hết hạn.
  - Verify status = ACTIVE, serviceId được cập nhật.
- **TC-23**: `should calculate correct end date based on duration (2 months)`
  - Kiểm tra tính đúng ngày kết thúc dựa trên duration.
  - Start 00:00:00 UTC, End 23:59:59 UTC.

### Case: Active → Create Queue
- **TC-24**: `should create queue record when subscription is still active`
  - Kiểm tra tạo queue record khi gói còn hạn.
  - Không update subscription trực tiếp.
- **TC-25**: `should calculate targetStartDate = expirationDate + 1 day`
  - Kiểm tra ngày bắt đầu queue = ngày hết hạn + 1.
- **TC-26**: `should calculate targetEndDate based on duration`
  - Kiểm tra ngày kết thúc queue dựa trên duration.
- **TC-27**: `should update existing queue record instead of creating new`
  - Kiểm tra update queue nếu đã tồn tại (không tạo mới).

### Duration Parameter
- **TC-28**: `should default to 1 month if duration not provided`
  - Kiểm tra mặc định duration = 1 nếu không truyền.
- **TC-29**: `should correctly calculate 12 month duration`
  - Kiểm tra tính toán đúng với duration = 12 tháng.

---

## Tổng Kết

| Metric | Giá trị |
|:-------|:--------|
| **Tổng số Test Cases** | 32 |
| **Passed** | 32 |
| **Skipped** | 0 |
| **Files** | `transactions.service.spec.ts`, `subscription-services.service.spec.ts` |
| **Command** | `npx jest test/unit/transactions test/unit/subscriptions` |

