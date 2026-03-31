# QUY TAC NGHIEP VU - BAO CAO DOANH THU PHONG KHAM (CLINIC ADMIN)

## TONG QUAN

Tai lieu nay mo ta cac quy tac nghiep vu duoc kiem tra trong unit test cho `ClinicRevenueService` (bao cao doanh thu danh cho CLINIC_ADMIN).

Hai bao cao chinh:
- Bao cao tong quan tat ca chi nhanh duoi mot CLINIC_ADMIN
- Bao cao chi tiet cho mot chi nhanh (CLINIC_MANAGER) cu the

Moc thoi gian:
- Bao cao luon yeu cau `startDate` va `endDate` va phai hop le.

---

## RULES CHUNG

### BR-REV-01: Chi CLINIC_ADMIN moi duoc truy cap bao cao

Chinh sach:
- He thong chi cho phep tai khoan co role `CLINIC_ADMIN` truy cap bao cao doanh thu.

Ket qua:
- Neu admin khong ton tai -> `NotFoundException` ("Admin account not found").
- Neu role khong phai `CLINIC_ADMIN` -> `ForbiddenException` ("Only CLINIC_ADMIN can access revenue reports").

### BR-REV-02: Rang buoc khoang thoi gian

Chinh sach:
- `startDate` phai nho hon `endDate` (khong duoc bang / lon hon).
- Khoang thoi gian khong vuot qua 365 ngay.

Ket qua:
- Vi pham -> `BadRequestException`:
  - "startDate must be before endDate"
  - "Date range cannot exceed 365 days"

---

## FLOW 1: BAO CAO TONG QUAN (getOverallRevenueReport)

### BR-REV-03: Tong quan se tinh tren TAT CA chi nhanh duoi admin

Chinh sach:
- Lay danh sach tat ca `CLINIC_MANAGER` co `parentId = adminId`.
- Khong loc theo trang thai hoat dong (de bao toan du lieu lich su), chi loai bo tai khoan da soft delete.

Ket qua:
- Neu khong co chi nhanh nao -> `NotFoundException` ("No branches found under this admin").

### BR-REV-04: Doanh thu chi tinh tu giao dich SUCCESS

Chinh sach:
- Cac tong hop doanh thu (summary / payment method / category / trend / branch breakdown) chi tinh `PaymentStatus.SUCCESS`.

Ngoai le:
- `statusBreakdown` la bao cao dem theo tung trang thai (SUCCESS/PENDING/FAILED), khong chi gioi han SUCCESS.

---

## FLOW 2: BAO CAO CHI NHANH (getBranchRevenueReport)

### BR-REV-05: Chi duoc xem chi nhanh thuoc quyen CLINIC_ADMIN

Chinh sach:
- Manager phai ton tai.
- Manager phai co role `CLINIC_MANAGER`.
- Manager phai co `parentId = adminId`.

Ket qua:
- Khong ton tai -> `NotFoundException` ("Manager account not found").
- Sai role -> `BadRequestException` ("Specified account is not a CLINIC_MANAGER").
- Sai owner -> `ForbiddenException` ("You do not have access to this branch").

### BR-REV-06: Bao cao chi nhanh co them top services

Chinh sach:
- Ngoai cac breakdown tuong tu tong quan, bao cao chi nhanh tra ve `topServices` (top N) theo doanh thu.
- Mac dinh lay top 10.

### BR-REV-07: Ten chi nhanh va ten quan ly co fallback hien thi

Chinh sach:
- Neu thieu thong tin branch/manager, he thong fallback gia tri mac dinh (`Unknown Branch`, `Unknown Manager`) de bao cao khong bi dut.

### BR-REV-08: Tong doanh thu theo branch phai co ty trong doanh thu

Chinh sach:
- Moi chi nhanh trong branch breakdown phai co `revenuePercentage` so voi tong doanh thu toan he thong trong ky.

### BR-REV-09: Revenue trend phai ho tro nhom theo ngay/tuan/thang

Chinh sach:
- `groupBy` hop le: DAY/WEEK/MONTH.
- Gia tri khong hop le fallback ve DAY de dam bao bao cao khong fail.

### BR-REV-10: Bao cao tong quan su dung xu ly song song de toi uu thoi gian tra ket qua

Chinh sach:
- Cac breakdown doc lap (summary/payment/category/trend/status) duoc tinh song song.
- Branch breakdown tinh sau khi co tong doanh thu de dam bao tinh dung ty trong.
