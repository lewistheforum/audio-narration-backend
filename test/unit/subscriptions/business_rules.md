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

## 3. Quy Tắc Xử Lý Thanh Toán Thành Công
*Method: `handleSubscriptionPaymentSuccess(subscriptionId, targetServiceId, transactionId)`*

Hệ thống xử lý dựa trên trạng thái hiện tại của gói đăng ký.

### 3.1. Ngày Giờ & Múi Giờ (QUAN TRỌNG)
-   Hệ thống lưu trữ thời gian dưới dạng UTC (`timestamptz`).
-   **Yêu cầu nghiệp vụ**: Thời gian `00:00:00` và `23:59:59` phải khớp với **Giờ Việt Nam (UTC+7)**.
    -   **Start Date**: Được tính là đầu ngày (`00:00:00`) theo giờ VN. Lưu vào DB dưới dạng `00:00:00 Z` (UTC) để giữ nguyên con số hiển thị.
    -   **End Date**: Được tính là cuối ngày (`23:59:59.999`) theo giờ VN. Lưu vào DB dưới dạng `23:59:59.999 Z`.

### 3.2. Luồng Kích Hoạt Ngay (Immediate Activation)
*Áp dụng khi Subscription đang là: Mới, Hết hạn (`EXPIRED`) hoặc Đã hủy (`NON_RENEWING`).*

1.  **Cập nhật Trạng thái**: Chuyển ngay sang `ACTIVE`.
2.  **Cập nhật Dịch vụ**: Set `serviceId` thành gói mới (nếu có `targetServiceId`).
3.  **Tính Ngày**:
    -   `startDate` = Ngày hiện tại (00:00:00 VN).
    -   `expirationDate` = `startDate` + Duration (12 tháng) - 1 giây (để về 23:59:59).
4.  **Lưu Lịch Sử**: Tạo record trong `ClinicSubscriptionHistory` với trạng thái `ACTIVE` và liên kết `transactionId`.

### 3.3. Luồng Hàng Đợi (Queue) - Dùng khi đang ACTIVE
*Áp dụng khi Subscription đang `ACTIVE` và User muốn gia hạn/đổi gói trước hạn.*

1.  **Không kích hoạt ngay**: Giữ nguyên trạng thái `ACTIVE` của gói hiện tại.
2.  **Tính Ngày Chuyển Đổi**:
    -   `targetStartDate`: Là ngày liền sau ngày hết hạn hiện tại (`Current Expiration + 1s` -> 00:00:00 hôm sau).
    -   `targetEndDate`: `targetStartDate` + Duration.
3.  **Lưu Hàng Đợi**: Tạo/Cập nhật record trong `ClinicSubscriptionRenewalQueue`.
4.  **Lưu Lịch Sử**: Tạo ngay record `ClinicSubscriptionHistory` (Future Active) để ghi nhận giao dịch đã thành công.
5.  **Cơ chế kích hoạt**: Cần một **Cron Job** (Chạy hàng ngày) quét bảng Queue để apply gói mới khi đến ngày `targetStartDate`.

---

## 4. Quy Tắc Truy Vấn & Bảo Mật

### 4.1. Lấy Thông Tin Gói (`getCurrentSubscription`)
-   Luôn lọc theo `clinicId` (lấy từ Token người dùng).
-   Chỉ trả về gói chưa bị soft-delete.
-   Join với bảng `subscription_services` để trả về chi tiết tên gói, giá, v.v.

### 4.2. Lấy Lịch Sử (`getSubscriptionHistory`)
-   Phân trang (Default: page 1, limit 10).
-   Sắp xếp: Mới nhất trước (`createdAt DESC`).
-   Chỉ xem được lịch sử của chính phòng khám đó.

---

## 5. Xử Lý Hết Hạn (Expiration Logic)
*(Hiện tại chưa có Cron Job tự động, logic dự kiến)*

-   Khi `expirationDate < NOW` và trạng thái đang `ACTIVE`:
    -   Hệ thống cần chuyển trạng thái sang `EXPIRED`.
    -   Ghi log vào lịch sử.
    -   Chặn quyền truy cập của User.

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
