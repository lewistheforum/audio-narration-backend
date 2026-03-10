# Tóm Tắt Kiểm Thử (Test Summary) - Module Hợp Đồng

## 1. Phạm Vi Kiểm Thử (Scope)
Kiểm thử Unit Test cho `ContractsService`, tập trung vào các chức năng nghiệp vụ chính:
-   Tạo thông tin hợp đồng (`createContractInfo`).
-   Tính bất biến và khóa hợp đồng (Locking logic).
-   Quy trình ký hợp đồng (`signContract`).
-   Gửi thông báo email (Email notifications).

## 2. Kịch Bản Kiểm Thử (Test Cases)

### 2.1 Tạo/Cập Nhật Hợp Đồng (`createContractInfo`)
| ID | Tên Case | Mô Tả | Trạng Thái |
| :--- | :--- | :--- | :--- |
| TC-01 | **Create/Update Success** | Tạo mới hoặc cập nhật thông tin khi hợp đồng ở trạng thái `DRAFT`. | **Passed** |
| TC-02 | **Reset on Edit** | Cập nhật khi trạng thái là `PENDING_SIGNATURE` -> Hệ thống phải reset về `DRAFT` và xóa file. | **Passed** |
| TC-03 | **Locking Mechanism** | Cố gắng cập nhật khi trạng thái là `PENDING_MANAGER_SIGNATURE` hoặc `CURRENT` -> Phải báo lỗi `BadRequestException`. | **Passed** |

### 2.2 Ký Hợp Đồng (`signContract`)
| ID | Tên Case | Mô Tả | Trạng Thái |
| :--- | :--- | :--- | :--- |
| TC-04 | **Employee Sign Success** | Nhân viên ký đúng lượt -> Cập nhật trạng thái `PENDING_MANAGER_SIGNATURE`, gửi email cho Manager. | **Passed** |
| TC-05 | **Manager Sign Success** | Quản lý ký đúng lượt -> Cập nhật trạng thái `CURRENT`, gửi email hoàn tất cho Employee. | **Passed** |
| TC-06 | **Invalid Turn** | Nhân viên ký khi chưa đến lượt hoặc sai trạng thái -> Báo lỗi. | **Passed** |
| TC-07 | **Invalid OTP** | Nhập sai OTP -> Báo lỗi `BadRequestException`. | **Passed** |

### 2.3 Gửi OTP (`sendSigningOtp`)
| ID | Tên Case | Mô Tả | Trạng Thái |
| :--- | :--- | :--- | :--- |
| TC-08 | **Send OTP Success** | Gửi OTP thành công cho người dùng hợp lệ đúng lượt ký. | **Passed** |
| TC-09 | **Unauthorized User** | Người dùng không thuộc hợp đồng yêu cầu OTP -> `UnauthorizedException`. | **Passed** |
| TC-10 | **Flow Violation** | Yêu cầu OTP khi chưa đến lượt (VD: Manager yêu cầu khi Employee chưa ký) -> `BadRequestException`. | **Passed** |

### 2.4 Tạo Gói Hợp Đồng (`createPackage`)
| ID | Tên Case | Mô Tả | Trạng Thái |
| :--- | :--- | :--- | :--- |
| TC-11 | **Create Success** | Tạo gói hợp đồng thành công với thông tin hợp lệ. | **Passed** |
| TC-12 | **Employee Not Found** | Tạo hợp đồng với ID nhân viên không tồn tại -> `NotFoundException`. | **Passed** |
| TC-13 | **Role Mismatch** | Tạo hợp đồng Doctor cho tài khoản Staff -> `BadRequestException`. | **Passed** |

### 2.5 Xác Thực Hợp Đồng (`verifyContract`)
| ID | Tên Case | Mô Tả | Trạng Thái |
| :--- | :--- | :--- | :--- |
| TC-14 | **Verify Success** | Kiểm tra chữ ký và tính toàn vẹn file thành công. | **Passed** |

### 2.6 Các Trường Hợp Lỗi Chữ Ký (Signature Error Cases)
| ID | Tên Case | Mô Tả | Trạng Thái |
| :--- | :--- | :--- | :--- |
| TC-15 | **Missing Keys** | Người dùng ký nhưng chưa tạo cặp khóa (encryptedPrivateKey = null) -> `BadRequestException`. | **Passed** |
| TC-16 | **Integrity Fail - Hash Mismatch** | File bị thay đổi (Hash không khớp với lúc nhân viên ký) -> `BadRequestException`. | **Passed** |
| TC-17 | **Integrity Fail - Bad Employee Sig** | Chữ ký nhân viên không hợp lệ khi verify -> `BadRequestException`. | **Passed** |
| TC-18 | **Missing Public Key** | Nhân viên không có public key để verify -> `BadRequestException`. | **Passed** |
| TC-19 | **Invalid Public Key** | Public key bị lỗi format -> `BadRequestException` (Code xử lý sanitize). | **Passed** |

### 2.7 Cập Nhật Trạng Thái Tự Động (Cron Job)
| ID | Tên Case | Mô Tả | Trạng Thái |
| :--- | :--- | :--- | :--- |
| TC-20 | **No Expired Contracts** | Không có hợp đồng nào hết hạn -> Cron job không gọi hàm update DB và trả về 0. | **Passed** |
| TC-21 | **Update Expired Contracts** | Phát hiện hợp đồng hết hạn -> Cron job gửi danh sách ID xuống DB để bulk update trạng thái thành `OLD` và trả về số lượng thành công. | **Passed** |

### 2.8 Các Trường Hợp Lỗi Ký - Manager (Manager Sign Error Cases)
| ID | Tên Case | Mô Tả | Trạng Thái |
| :--- | :--- | :--- | :--- |
| TC-22 | **Manager Missing Keys** | Manager ký nhưng chưa tạo cặp khóa (encryptedPrivateKey = null) -> `BadRequestException`. | **Passed** |

## 3. Kết Quả Thực Thi (Execution Results)
*(Cập nhật ngày 2026-03-09)*

-   **Tổng số test:** 22
-   **Pass:** 22
-   **Fail:** 0
