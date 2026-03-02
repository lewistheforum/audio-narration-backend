# Quy Tắc Nghiệp Vụ (Business Rules): Module Transactions

Tài liệu này mô tả các quy tắc nghiệp vụ (BR) và luồng logic được triển khai trong `TransactionsModule`. Đây là tài liệu tham khảo cho việc kiểm thử unit test và xác minh hệ thống.

## 1. Tổng Quan
`TransactionsModule` xử lý tất cả các hoạt động liên quan đến thanh toán, bao gồm:
- Tạo mã QR thanh toán (VietQR qua SePay).
- Xử lý Webhook (Callback) thanh toán từ SePay.
- Quản lý lịch sử và trạng thái giao dịch.
- Kích hoạt các hành động sau thanh toán (Kích hoạt gói, Xác minh phòng khám).

---

## 2. Các Loại Giao Dịch & Tạo Mã QR

### 2.1. Thanh Toán Đơn Thuốc (Dynamic QR)
*Dành cho Bệnh nhân thanh toán đơn thuốc.*

*   **Endpoint**: `POST /transactions/:prescriptionId/qr`
*   **Logic**:
    1.  **Nguồn dữ liệu (Source of Truth)**: Entity `Appointment` (dựa trên `prescriptionId`).
    2.  **Số tiền**: Sử dụng chính xác `Appointment.total`. Bỏ qua mọi số tiền gửi lên từ request body.
    3.  **Thông tin Ngân hàng**: Truy vấn `ClinicAdmin` liên kết với đơn thuốc để lấy cấu hình SePay (`sepayVa`, `bankName`).
    4.  **Bản ghi Giao dịch**: **KHÔNG** tạo bản ghi Transaction ngay lập tức trong DB.
    5.  **Nội dung QR**: Sử dụng `prescriptionId` (ID Đơn thuốc) làm nội dung chuyển khoản.
    6.  **Phản hồi**: Trả về URL/Payload QR với `id: null` (vì chưa có record trong DB).

### 2.2. Xác Minh Phòng Khám (Verification QR)
*Dành cho Phòng khám xác minh tài khoản ngân hàng (Chống spam/Xác thực danh tính).*

*   **Endpoint**: `POST /transactions/clinic/verification-qr`
*   **Logic**:
    1.  **Số tiền cố định**: Luôn là **10,000 VND**.
    2.  **Bản ghi Giao dịch**: Tạo ngay lập tức một Transaction trạng thái `PENDING` trong DB.
        -   Loại: `VERIFICATION`
    3.  **Nội dung QR**: Sử dụng **Transaction ID** (UUID) làm nội dung chuyển khoản.
    4.  **Phản hồi**: Trả về URL/Payload QR kèm theo Transaction ID vừa tạo.

### 2.3. Thanh Toán Gói Dịch Vụ (Subscription)
*Dành cho Phòng khám thanh toán các Gói dịch vụ (Mua mới, Gia hạn, Đổi gói).*

#### A. Mua Mới (`POST /transactions/subscription/new`)
*   **Logic**:
    -   Nếu đã có gói đang `ACTIVE` và chưa hết hạn -> **Từ chối** (Báo lỗi BadRequest).
    -   Nếu chưa có gói hoặc gói đã hết hạn/chờ -> Tạo/Cập nhật Subscription với trạng thái `PENDING_SEPAY_SETUP`.
    -   Tạo/Cập nhật một bản ghi Transaction `PENDING`.
    -   **Metadata Nội dung**: Lưu `{"targetServiceId": "..."}` vào cột `content` của transaction.

#### B. Gia Hạn (`POST /transactions/subscription/renew`)
*   **Logic**:
    -   Cho phép gia hạn nếu gói đó vẫn còn hạn, đã hết hạn, hoặc Non-renewing.
    -   Tạo Transaction ở trạng thái `PENDING`.
    -   **Metadata Nội dung**: Lưu `{"duration": ...}` để xử lý sau khi thanh toán.
- **Quy tắc Gia hạn Cộng dồn (Additive Stacking Queue):**
    - Hệ thống cho phép gọi API `/renew` hoặc `/change-package` bất cứ lúc nào kể cả khi gói đang `ACTIVE` hoặc đã có gói chờ gia hạn trong hàng đợi (`ClinicSubscriptionRenewalQueue`).
    - **Logic Xử lý (1-to-1 Queue Record):**
        - Do DB giới hạn 1 phòng khám chỉ có 1 record trong hàng đợi chờ (`unique clinicId`), khi mua thêm nhiều gói, hệ thống sẽ **cộng dồn thời gian (Stacking)** chứ không tạo nhiều records chờ.
        - **Cơ sở tính toán (Base Expiration):** Nếu chưa có Queue -> Lấy ngày hết hạn của gói Active hiện tại. Nếu ĐÃ CÓ Queue -> Lấy ngày `targetEndDate` của Queue hiện tại.
        - **Cập nhật CSDL:**
             - `targetEndDate` của record Queue duy nhất sẽ được kéo giãn thêm `Duration` của lần mua mới.
             - `targetStartDate` của record Queue giữ nguyên (vẫn nối tiếp vào đuôi gói Active).
        - **Lịch sử (History):** Hệ thống ghi nhận các Records History rời rạc, đảm bảo mỗi giao dịch được gán chính xác `StartDate` và `EndDate` độc lập tương ứng với phần tiền vừa bỏ ra.
    - **Lợi ích:** Phòng khám có thể gia hạn trước 2-3 năm liên tục, chống gián đoạn. Logic tối ưu hóa truy vấn khi CronJob chỉ cần đọc đúng 1 targetEndDate cao nhất.

#### C. Đổi Gói (`POST /transactions/subscription/change-package`)
*   **Logic**:
    -   Cho phép chuyển đổi sang gói dịch vụ khác.
    -   Tính toán số tiền dựa trên giá gói mới.
    -   Tạo/Cập nhật Transaction `PENDING`.
    -   **Metadata Nội dung**: Lưu `{"targetServiceId": "new-service-uuid"}`.

---

## 3. Xử Lý Callback Thanh Toán (Webhook)
*Endpoint: `POST /transactions/seepay/callback`*

Hệ thống xử lý callback theo 2 chiến lược dựa trên việc có tìm thấy Giao dịch Pending hay không.

### Chiến Lược A: Giao Dịch Đã Tồn Tại (Ưu Tiên)
*Dùng cho: Xác minh, Subscription.*

1.  **Khớp lệnh**: Tìm `Transaction` theo ID (được trích xuất từ nội dung chuyển khoản).
2.  **Cập nhật**: Cập nhật trạng thái (`SUCCESS`/`FAILED`), cổng thanh toán, thời gian, thông tin ngân hàng.
3.  **Bảo toàn Metadata**: **QUAN TRỌNG**. KHÔNG ĐƯỢC ghi đè cột `content` bằng tin nhắn ngân hàng thô. Cột `content` chứa JSON metadata (`targetServiceId`) cần cho xử lý sau thanh toán.
4.  **Hậu xử lý (Post-Processing)**:
    *   **NẾU là Xác minh (`SUCCESS`)**:
        -   Set `ClinicAdmin.isVerify = true`.
    *   **NẾU là Subscription (`SUCCESS`)**:
        -   Parse `targetServiceId` từ `content` (nếu có).
        -   Gọi `SubscriptionServicesService.handleSubscriptionPaymentSuccess`.
        -   Truyền `transaction.id` để liên kết vào lịch sử.

### Chiến Lược B: Giao Dịch Mới (Dự phòng/Chuẩn)
*Dùng cho: Thanh toán Đơn thuốc.*

1.  **Khớp lệnh**: Tìm `Appointment` theo ID (được trích xuất từ nội dung chuyển khoản).
2.  **Khởi tạo**: Tạo một bản ghi `Transaction` **MỚI**.
    -   Loại: `ONLINE` (Mặc định).
    -   Liên kết: Phòng khám, Người gửi (Bệnh nhân).
3.  **Kết quả**: Chỉ lưu lịch sử giao dịch. Không có hook xử lý đặc biệt nào kích hoạt tại đây (Việc cập nhật trạng thái Appointment được xử lý riêng hoặc ngầm định).

---

## 4. Quy Tắc Kích Hoạt Gói (Subscription Activation)
*Quản lý bởi `SubscriptionServicesService.handleSubscriptionPaymentSuccess`*

### 4.1. Logic Ngày & Múi Giờ
*   **Mục tiêu**: Đảm bảo DB lưu mốc thời gian `00:00:00` và `23:59:59` tương ứng với Giờ Việt Nam (UTC+7).
*   **Ngày Bắt Đầu (Start Date)**:
    -   Tính là `00:00:00` của ngày hiện tại (theo giờ VN).
    -   Lưu là `00:00:00 Z` (UTC) trong DB để giữ nguyên con số hiển thị.
*   **Ngày Hết Hạn (End Date)**:
    -   Tính là `23:59:59` của ngày hết hạn (theo giờ VN).
    -   Lưu là `23:59:59.999 Z` (UTC).

### 4.2. Luồng Kích Hoạt
1.  **Kích Hoạt Ngay (Immediate)** (Mua mới / Hết hạn / Đã hủy):
    -   Kích hoạt ngay lập tức.
    -   Set `subscriptionStatus = ACTIVE`.
    -   Cập nhật `startDate` và `expirationDate` dựa trên thời hạn gói (duration).
    -   Tạo Lịch sử đăng ký (History Record) có liên kết `transactionId`.

2.  **Kích Hoạt Hàng Đợi (Queue)**:
    -   Nếu User gia hạn khi đang Active (trường hợp admin can thiệp thủ công):
    -   Tạo record trong `ClinicSubscriptionRenewalQueue`.
    -   Tính `targetStartDate` là ngày *liền sau* ngày hết hạn hiện tại (00:00:00).
    -   **Lưu ý**: Cần có Cron Job (hiện chưa implement) để quét và xử lý hàng đợi này.

---

## 5. Bảo Mật & Kiểm Soát
*   **Validate Đầu Vào**: Số tiền cho đơn thuốc lấy từ DB, không tin tưởng client input.
*   **Quyền Manager**: `CLINIC_MANAGER` khi dùng các API subscription sẽ tự động resolve ra ID của `CLINIC_ADMIN` cha để đảm bảo gói được áp dụng đúng tài khoản phòng khám.
*   **Chữ Ký**: SePay callbacks được bảo vệ bởi `SeepayAuthGuard` (Kiểm tra Authorization header).

---

## 6. Quy Tắc Điều Hướng Tài Khoản Nhận Tiền

| Loại Giao Dịch | Tài Khoản Nhận | Nguồn Cấu Hình |
| :--- | :--- | :--- |
| **Thanh toán Đơn thuốc** | Phòng Khám | `ClinicAdminInformation.sepayVa` |
| **Xác minh Phòng khám** | Phòng Khám | `ClinicAdminInformation.sepayVa` |
| **Mua/Gia hạn/Đổi Gói (Subscription)** | **Công ty** | `process.env.SEEPAY_ACC`, `process.env.SEEPAY_BANK` |

> [!IMPORTANT]
> Nếu thiếu cấu hình ENV (`SEEPAY_ACC`, `SEEPAY_BANK`), các API Subscription sẽ trả về lỗi `400 BadRequest`.

