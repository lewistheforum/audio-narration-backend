# QUY TAC NGHIEP VU - ACCOUNTS SERVICE (DANG KY PHONG KHAM)

## TONG QUAN

Tai lieu nay tong hop cac quy tac nghiep vu duoc kiem tra trong unit test cho `AccountsService` lien quan den luong dang ky phong kham (CLINIC_ADMIN) va thiet lap chi nhanh (CLINIC_MANAGER).

---

## BUOC 2: DANG KY CLINIC ADMIN (registerClinicAdmin)

### BR-ACC-01: Email uniqueness theo role

Chinh sach:
- Khong cho phep email da duoc su dung boi `CLINIC_ADMIN`.
- Khong cho phep email da duoc su dung boi `CLINIC_MANAGER`.
- (Theo hanh vi hien tai trong test) Email da ton tai o role khac (vd: PATIENT) khong duoc tai su dung cho dang ky CLINIC_ADMIN.

Ket qua:
- Vi pham -> `ConflictException`.

### BR-ACC-02: Sepay VA phai duy nhat

Chinh sach:
- `sepayVa` (tai khoan ao nhan thanh toan) khong duoc trung voi bat ky dang ky/clinic admin information nao khac.

Ket qua:
- Vi pham -> `ConflictException`.

### BR-ACC-03: Bat buoc hash password

Chinh sach:
- Mat khau phai duoc hash bang bcrypt truoc khi luu.

### BR-ACC-04: Transaction bat buoc (atomic)

Chinh sach:
- Toan bo viec tao Account + ClinicAdminInformation + ClinicSubscription nam trong 1 transaction.
- Co loi -> rollback; luon release connection.

---

## BUOC 4A: TAO CLINIC MANAGER (createClinicManagerForRegistration)

### BR-ACC-05: Actor bat buoc la CLINIC_ADMIN

Ket qua:
- Sai role -> `ForbiddenException`.

### BR-ACC-06: Subscription status bat buoc dung buoc

Chinh sach:
- Chi cho phep tao manager khi subscription status la `PENDING_MANAGER_SETUP`.

Ket qua:
- Khac trang thai -> `ForbiddenException`.

### BR-ACC-07: Moi admin chi duoc tao 1 manager

Ket qua:
- Neu da ton tai manager -> `ConflictException`.

### BR-ACC-08: Email manager phai unique

Ket qua:
- Trung email voi tai khoan khac -> `ConflictException`.

### BR-ACC-09: Manager khoi tao o trang thai PENDING_APPROVAL

Chinh sach:
- Manager duoc tao voi `status = PENDING_APPROVAL` de cho duyet (khong ACTIVE ngay).

### BR-ACC-10: Co rang buoc quan he parent-child

Chinh sach:
- Manager phai co `parentId = adminId`.

### BR-ACC-11: Transaction va rollback khi loi

Chinh sach:
- Tao manager + info + address + cap nhat subscription trong transaction.
- Co loi -> rollback.

---

## BUOC 4B: TAI LEN TAI LIEU PHAP LY (uploadLegalDocumentsForManager)

### BR-ACC-12: Chi CLINIC_ADMIN duoc upload

Ket qua:
- Sai role -> `ForbiddenException`.

### BR-ACC-13: Manager dung role va thuoc quyen admin

Chinh sach:
- Target phai la `CLINIC_MANAGER`.
- `manager.parentId` phai trung `clinicAdminId`.

Ket qua:
- Sai role -> `NotFoundException`.
- Sai owner -> `ForbiddenException`.

### BR-ACC-14: Subscription status bat buoc `PENDING_LEGAL_SETUP`

Ket qua:
- Khac trang thai -> `ForbiddenException`.

### BR-ACC-15: Legal documents luon ve PENDING_REVIEW va subscription ve PENDING_APPROVAL

Chinh sach:
- Sau khi upload: `verificationStatus = PENDING_REVIEW`.
- Subscription status chuyen sang `PENDING_APPROVAL`.
- Neu da ton tai legal docs: update va dat lai `PENDING_REVIEW`.

### BR-ACC-16: Transaction va rollback khi loi

---

## BUOC 8.1: HUY DANG KY (cancelPendingRegistration)

### BR-ACC-17: Chi cho phep huy o cac trang thai pending

Chinh sach:
- Cho phep huy o cac trang thai pending (vd: `PENDING_SEPAY_SETUP`, `PENDING_MANAGER_SETUP`, `PENDING_LEGAL_SETUP`, `PENDING_PAYMENT`).
- Khong cho phep huy neu dang o cac trang thai khong con pending (vd: `PENDING_APPROVAL`, `ACTIVE`, `NON_RENEWING`, `EXPIRED`).

### BR-ACC-18: Khong cho phep huy neu da co giao dich SUCCESS

Chinh sach:
- Neu ton tai transaction SUCCESS lien quan -> tu choi.

### BR-ACC-19: Hard delete theo thu tu nguoc FK

Chinh sach:
- Xoa cac entity lien quan theo thu tu an toan (nguoc quan he phu thuoc) trong transaction.
- Co loi -> rollback.

---

## VALIDATION: validateManagerStatus

### BR-ACC-20: Rang buoc trang thai theo operation

Chinh sach:
- CREATE_STAFF: manager phai ton tai va `ACTIVE`; neu `PENDING_APPROVAL`/`MANAGER_DISABLED`/khac `ACTIVE` -> tu choi.
- DISABLE: chi hop le neu manager `ACTIVE`.
- ENABLE: chi hop le neu manager `MANAGER_DISABLED`.

---

## BO SUNG NGHIEP VU - CHUNK 1-900 (ACCOUNTS CORE)

### BR-ACC-21: Tim benh nhan bat buoc co it nhat 1 tieu chi tim kiem

Dieu kien:
- Nguoi dung phai nhap it nhat mot trong cac truong: `phone`, `email`, `fullName`.

Ket qua:
- Neu khong co tieu chi nao, he thong tu choi yeu cau voi thong bao nghiep vu ro rang.

### BR-ACC-22: Chi tai khoan PATIENT moi hop le cho luong dat lich benh nhan

Chinh sach:
- Ket qua tim kiem trung tai khoan khac role `PATIENT` (vi du CLINIC_MANAGER/ADMIN/...) khong duoc xem la benh nhan hop le.

Ket qua:
- He thong tra `found=false` va thong diep huong dan nhap thong tin khac.

### BR-ACC-23: Tim kiem benh nhan theo uu tien Phone -> Email -> Ho ten gan dung

Chinh sach:
- Uu tien tim theo `phone` truoc.
- Neu khong co ket qua, tim tiep theo `email`.
- Neu van khong co ket qua, tim theo `fullName` gan dung qua bang profile.

Muc dich:
- Tang ty le tim dung benh nhan da ton tai truoc khi tao tai khoan moi.

### BR-ACC-24: Khong tim thay benh nhan thi de xuat tao tai khoan moi

Chinh sach:
- Neu da tim theo cac tieu chi ma khong co ket qua PATIENT hop le, he thong tra goi y nghiep vu `CREATE_NEW_ACCOUNT`.

### BR-ACC-25: Loi parse ngay sinh khong duoc lam vo luong tim kiem

Chinh sach:
- Neu `dob` profile bi loi dinh dang khi map response, he thong bo qua truong ngay sinh nhung van tra ket qua benh nhan.

### BR-ACC-26: Tao PATIENT thuong bat buoc unique email va hash mat khau

Chinh sach:
- Email trung -> tu choi tao tai khoan.
- Mat khau phai duoc hash truoc khi luu.
- Luu Account va profile trong transaction; co loi thi rollback.

### BR-ACC-27: Tao PATIENT OAuth duoc kich hoat ngay

Chinh sach:
- Tai khoan OAuth duoc tao voi `isOAuthUser=true`, `isEmailVerified=true`, `status=ACTIVE`.
- Username co the lay mac dinh tu tien to email neu khong truyen vao.

### BR-ACC-28: Cap nhat email phai reset xac minh email

Chinh sach:
- Khi doi email, he thong reset `isEmailVerified=false`.
- Tai khoan van giu duoc trang thai hoat dong de khong gian doan truy cap.

### BR-ACC-29: Cap nhat thong tin theo role phai dung nhom du lieu chuyen biet

Chinh sach:
- ADMIN/PATIENT -> cap nhat profile chung.
- CLINIC_ADMIN -> cap nhat thong tin phong kham va ngan hang.
- CLINIC_MANAGER/CLINIC_STAFF/DOCTOR -> cap nhat bo ho so chuyen biet tuong ung.

### BR-ACC-30: Role khong hop le khi lay profile phai bi chan

Ket qua:
- He thong tra loi khong tim thay nguoi dung de tranh lo thong tin noi bo.
