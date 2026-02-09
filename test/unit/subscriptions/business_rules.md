# Quy Tắc Nghiệp Vụ (Business Rules): Module Subscriptions

Tài liệu này mô tả các quy tắc nghiệp vụ (BR) và logic quản lý vòng đời thuê bao trong `SubscriptionsModule`.

## 1. Tổng Quan
`SubscriptionsModule` chịu trách nhiệm quản lý:
-   Danh sách các Gói dịch vụ (Service Packages).
-   Trạng thái đăng ký của Phòng khám (`ClinicSubscription`).
-   Lịch sử thay đổi gói (`ClinicSubscriptionHistory`).
-   Hàng đợi gia hạn (`ClinicSubscriptionRenewalQueue`) cho các gói đang hoạt động.

---

## 2. Trạng Thái Đăng Ký (Registration Status)
Enum `RegistrationStatus` định nghĩa vòng đời của một tài khoản phòng khám:

| Trạng Thái | Mô Tả | Hành Động |
| :--- | :--- | :--- |
| `PENDING_SEPAY_SETUP` | Đã tạo tài khoản, chưa cấu hình thanh toán. | Cần cấu hình SePay. |
| `PENDING_MANAGER_SETUP` | Đã cấu hình thanh toán, chưa tạo tài khoản Manager. | Cần tạo Manager. |
| `PENDING_LEGAL_SETUP` | Manager đã có, chưa up giấy phép. | Cần upload giấy phép KD. |
| `PENDING_APPROVAL` | Đã nộp giấy tờ, chờ Admin duyệt. | Chờ duyệt. |
| `REJECTED` | Giấy tờ bị từ chối. | Cần cập nhật & nộp lại. |
| `PENDING_PAYMENT` | Đã duyệt giấy tờ, chưa thanh toán gói. | Cần thanh toán lần đầu. |
| `ACTIVE` | **Đang hoạt động**. Đã thanh toán và còn hạn. | Được sử dụng hệ thống. |
| `NON_RENEWING` | Đang hoạt động nhưng đã hủy gia hạn. | Dùng đến hết hạn rồi tự cắt. |
| `EXPIRED` | Gói đã hết hạn. | Bị khóa chức năng, cần gia hạn. |

---

## 3. Duration-Based Pricing (Tính Giá Theo Thời Lượng)

### 3.1. Công Thức Tính Giá
```
amount = service.price × duration
```

| Parameter | Mô Tả | Giới Hạn |
|:----------|:------|:---------|
| `duration` | Số tháng đăng ký | 1 - 12 (mặc định: 1) |
| `price` | Giá gói/tháng | Từ `subscription_services` |

### 3.2. Lưu Trữ Duration
Duration được lưu trong `transaction.content` dưới dạng JSON:
```json
{ "duration": 2, "targetServiceId": "uuid" }
```

### 3.3. API Endpoints

| Endpoint | Duration Required | Mặc Định |
|:---------|:------------------|:---------|
| `POST /subscription/new` | Optional | 1 tháng |
| `POST /subscription/renew` | **Không có** | 1 tháng (fixed) |
| `POST /subscription/change-package` | Optional | 1 tháng |

---

## 4. Quy Tắc Xử Lý Thanh Toán Thành Công
*Method: `handleSubscriptionPaymentSuccess(subscriptionId, targetServiceId, transactionId, duration)`*

### 4.1. Ngày Giờ & Múi Giờ (QUAN TRỌNG)
-   Hệ thống lưu trữ thời gian dưới dạng UTC (`timestamptz`).
-   **Start Date**: `00:00:00 Z` (UTC) - Đầu ngày.
-   **End Date**: `23:59:59.999 Z` (UTC) - Cuối ngày.

### 4.2. Luồng Kích Hoạt Ngay (Immediate Activation)
*Áp dụng khi: Subscription đang Mới, `EXPIRED` hoặc `NON_RENEWING`.*

```
startDate = TODAY (00:00:00 UTC)
endDate = startDate + duration months - 1 day (23:59:59 UTC)
```

**Ví dụ với duration = 2:**
| Start Date | End Date |
|:-----------|:---------|
| 2025-02-10 00:00:00Z | 2025-04-09 23:59:59Z |

### 4.3. Luồng Hàng Đợi (Queue) - Dùng khi đang ACTIVE
*Áp dụng khi: Subscription đang `ACTIVE` và User gia hạn/đổi gói trước hạn.*

```
targetStartDate = currentExpirationDate + 1 day (00:00:00 UTC)
targetEndDate = targetStartDate + duration months - 1 day (23:59:59 UTC)
```

**Ví dụ với duration = 2, current expiry = June 30:**
| targetStartDate | targetEndDate |
|:----------------|:--------------|
| 2025-07-01 00:00:00Z | 2025-08-31 23:59:59Z |

**Queue Record:**
- Mỗi clinic chỉ có **1 queue record** (UNIQUE constraint).
- Nếu đã có → **Update** thay vì create mới.

---

## 5. Bảng Tham Chiếu

### ClinicSubscriptionRenewalQueue

| Column | Type | Description |
|:-------|:-----|:------------|
| `_id` | UUID | Primary key |
| `clinic_id` | UUID | UNIQUE - 1 clinic = 1 queue |
| `next_service_id` | UUID | Gói sẽ kích hoạt |
| `target_start_date` | timestamptz | Ngày bắt đầu gói mới |
| `target_end_date` | timestamptz | Ngày kết thúc gói mới |

---

## 6. Xử Lý Hết Hạn (Expiration Logic)
*(Cần Cron Job)*

Khi `expirationDate < NOW` và trạng thái đang `ACTIVE`:
1. Kiểm tra Queue có record không → Apply nếu có.
2. Chuyển trạng thái sang `EXPIRED`.
3. Ghi log vào lịch sử.

