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
