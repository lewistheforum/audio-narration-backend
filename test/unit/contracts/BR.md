# Tài Liệu Yêu Cầu Nghiệp Vụ (BR) - Module Hợp Động

## 1. Giới Thiệu
Module Hợp đồng quản lý quy trình ký kết hợp đồng điện tử giữa Phòng khám (Clinic) và Nhân viên (Employee/Doctor). Quy trình đảm bảo tính pháp lý, bảo mật và minh bạch thông qua chữ ký số và xác thực OTP.

## 2. Quy Trình Ký Kết (Workflow)

### 2.1 Tạo Hợp Đồng (Manager)
-   **Actor:** Quản lý phòng khám (Clinic Manager) hoặc Nhân viên được ủy quyền.
-   **Hành động:** Tạo gói hợp đồng (`ContractPackage`) và nhập thông tin chi tiết (`ClinicContractInformation`).
-   **Yêu cầu:**
    -   Hệ thống tự động xác định `clinicId` dựa trên tài khoản người tạo.
    -   **Validate Employee:** Nhân viên phải tồn tại trong hệ thống.
    -   **Validate Role:** Vai trò của nhân viên phải khớp với loại hợp đồng (Doctor -> DOCTOR, Staff -> CLINIC_STAFF).
    -   Trạng thái ban đầu: `DRAFT`.

### 2.2 Upload Hợp Đồng (Manager)
-   **Actor:** Quản lý.
-   **Hành động:** Upload file PDF hợp đồng lên hệ thống.
-   **Yêu cầu:**
    -   Trạng thái chuyển từ `DRAFT` sang `PENDING_SIGNATURE`.
    -   **Lưu ý:** Sau khi upload, nếu muốn chỉnh sửa thông tin hợp đồng, hệ thống sẽ reset trạng thái về `DRAFT` và xóa file cũ.

### 2.3 Gửi OTP Ký (Send OTP)
-   **Yêu cầu:**
    -   Chỉ gửi OTP nếu người dùng là một bên tham gia hợp đồng.
    -   **Tuân thủ quy trình:**
        -   Nhân viên chỉ được yêu cầu OTP khi trạng thái là `PENDING_SIGNATURE`.
        -   Quản lý chỉ được yêu cầu OTP khi trạng thái là `PENDING_MANAGER_SIGNATURE`.
    -   OTP có hiệu lực 15 phút.

### 2.3 Nhân viên Ký (Employee)
-   **Actor:** Nhân viên (Employee/Doctor).
-   **Điều kiện:** Trạng thái hợp đồng là `PENDING_SIGNATURE`.
-   **Hành động:**
    1.  Xem nội dung hợp đồng.
    2.  Yêu cầu OTP xác thực qua email.
    3.  Nhập OTP để ký số (sử dụng Private Key của nhân viên).
-   **Kết quả:**
    -   Hệ thống tạo chữ ký số của nhân viên.
    -   Trạng thái chuyển sang `PENDING_MANAGER_SIGNATURE`.
    -   **Email:** Gửi thông báo cho Quản lý phòng khám để yêu cầu ký duyệt.

### 2.4 Quản lý Ký Duyệt (Manager)
-   **Actor:** Quản lý phòng khám.
-   **Điều kiện:** Trạng thái hợp đồng là `PENDING_MANAGER_SIGNATURE`.
-   **Hành động:**
    1.  Xem hợp đồng và chữ ký của nhân viên.
    2.  Yêu cầu OTP xác thực.
    3.  Nhập OTP để ký số (sử dụng Private Key của quản lý).
-   **Kiểm tra:** Hệ thống tự động kiểm tra tính toàn vẹn của file và chữ ký nhân viên trước khi cho phép quản lý ký.
-   **Kết quả:**
    -   Hệ thống tạo chữ ký số của quản lý.
    -   Trạng thái chuyển sang `CURRENT` (Hiệu lực).
    -   **Email:** Gửi thông báo hoàn tất và link xem hợp đồng cho Nhân viên.

## 3. Các Quy Tắc Nghiệp Vụ (Business Rules)

### 3.1 Tính Bất Biến (Immutability)
-   **Chặn chỉnh sửa:** Không được phép chỉnh sửa thông tin hợp đồng khi trạng thái là `PENDING_MANAGER_SIGNATURE` (Nhân viên đã ký) hoặc `CURRENT` (Đã hoàn tất).
-   **Reset khi sửa:** Nếu chỉnh sửa khi đang ở trạng thái `PENDING_SIGNATURE` (Đã upload file nhưng chưa ký), hệ thống phải cảnh báo và tự động reset trạng thái về `DRAFT`, đồng thời xóa file hợp đồng cũ.

### 3.2 Hết Hạn Hợp Đồng (Expiration)
-   Hệ thống có một **Cron Job** chạy ngầm định kỳ vào lúc 00:00:00 (nửa đêm) mỗi ngày (Theo múi giờ `Asia/Ho_Chi_Minh`).
-   Cron Job sẽ quét toàn bộ các hợp đồng có trạng thái đang là `CURRENT`.
-   Nếu `contractEndDate` của hợp đồng đã nhỏ hơn thời điểm hiện tại, hệ thống sẽ tự động cập nhật trạng thái hợp đồng thành `OLD`.
-   Nhân viên sẽ không thấy được hợp đồng `DRAFT` nhưng vẫn có thể xem lại các hợp đồng `OLD` của mình.

### 3.2 Bảo Mật & Xác Thực
-   Mọi hành động ký đều yêu cầu xác thực OTP (gửi qua email).
-   Chữ ký số sử dụng thuật toán RSA/SHA-256.
-   Private Key của người dùng được mã hóa và lưu trữ an toàn, chỉ được giải mã khi có OTP chính xác.

### 3.3 Thông Báo (Notifications)
-   **Gửi OTP:** Khi người dùng yêu cầu ký.
-   **Thông báo Ký (Cho Manager):** Ngay sau khi Nhân viên ký thành công.
-   **Thông báo Hoàn tất (Cho Employee):** Ngay sau khi Quản lý ký thành công (kèm link xem tệp).

### 3.4 Các Trường Hợp Lỗi (Exception Handling)
-   **Missing Keys:** Người dùng chưa tạo cặp khóa kỹ thuật số -> `BadRequestException`.
-   **Invalid OTP:** OTP sai hoặc hết hạn -> `BadRequestException`.
-   **Integrity Check Fail:**
    -   File hợp đồng bị thay đổi sau khi nhân viên ký.
    -   Chữ ký của nhân viên không khớp với public key.
    -   -> `BadRequestException`.
-   **Flow Violation:** Ký sai thứ tự hoặc người dùng không có quyền.
-   **System Error:** Lỗi kết nối Cloudinary hoặc lỗi thư viện Crypto.
