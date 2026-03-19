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
- **Quy tắc chặn:** Hệ thống không cho phép tạo thêm giao dịch gia hạn/đổi gói nếu đã có bản ghi trong hàng đợi. Người dùng phải chờ gói chờ kích hoạt xong hoặc yêu cầu admin hủy gói chờ nếu muốn thay đổi.

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


---

## 6. Quy Tắc Cập Nhật Gói Phổ Biến (Popular Service)
*Method: `updatePopularServices()`*

### 6.1. Mục Đích
-   Tự động xác định gói dịch vụ phổ biến nhất dựa trên số lượng đăng ký đang hoạt động.
-   Giúp người dùng dễ dàng nhận biết gói được chọn nhiều nhất trên hệ thống.

### 6.2. Quy Tắc Nghiệp Vụ

#### **BR-01: Chỉ một gói được đánh dấu phổ biến**
-   Tại bất kỳ thời điểm nào, **chỉ có duy nhất 1 service** có `is_popular = true`.
-   Tất cả các service còn lại phải có `is_popular = false`.

#### **BR-02: Tiêu chí xác định gói phổ biến**
-   Đếm số lượng `ClinicSubscription` có `subscriptionStatus = ACTIVE` nhóm theo `serviceId`.
-   Service có **số lượng đăng ký ACTIVE cao nhất** sẽ được set `is_popular = true`.
-   Nếu có nhiều service có cùng số lượng cao nhất → Chọn service được trả về đầu tiên (theo thứ tự query).

#### **BR-03: Xử lý khi không có subscription ACTIVE**
-   Nếu không có subscription nào đang ACTIVE → Reset tất cả service về `is_popular = false`.
-   Không có service nào được đánh dấu phổ biến.

#### **BR-04: Thời điểm trigger**
-   **Tự động kích hoạt** sau khi một subscription chuyển sang trạng thái `ACTIVE` (thanh toán thành công).
-   Được gọi trong method `handleSubscriptionPaymentSuccess()` sau khi:
    -   Cập nhật subscription status → ACTIVE
    -   Tạo history record

### 6.3. Logic Implementation

```typescript
1. Query: COUNT(ClinicSubscription) WHERE status = ACTIVE GROUP BY serviceId ORDER BY COUNT DESC
2. IF result is empty:
     → Reset all services: is_popular = false
3. ELSE:
     → Get first record (highest count)
     → Reset all services: is_popular = false
     → Set target service: is_popular = true
```

### 6.4. Edge Cases

| Tình Huống | Xử Lý | Kết Quả |
| :--- | :--- | :--- |
| Không có subscription ACTIVE nào | Reset all `is_popular = false` | Không có service nào popular |
| Chỉ có 1 service có ACTIVE subscription | Set service đó `is_popular = true` | Service đó là popular |
| Nhiều services, 1 service có count cao nhất | Set service đó `is_popular = true` | Service có count cao nhất là popular |
| 2 services có cùng count cao nhất | Chọn service đầu tiên trong query result | Service đầu tiên là popular |
| Service đang popular bị giảm count | Tính toán lại, có thể chuyển sang service khác | Popular flag được cập nhật động |

### 6.5. Performance Considerations
-   Sử dụng `QueryBuilder` với aggregate function (COUNT) để tối ưu.
-   Không load toàn bộ data vào memory.
-   Update bằng bulk operations (reset all, then set one).

### 6.6. Testing Requirements
-   ✅ Test case: Không có ACTIVE subscription
-   ✅ Test case: 1 service có ACTIVE subscription
-   ✅ Test case: Nhiều services, verify chỉ 1 service popular
-   ✅ Test case: Verify service có count cao nhất được chọn
