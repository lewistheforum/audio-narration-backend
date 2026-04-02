# TOM TAT CAC TEST CASE - ACCOUNTS SERVICE (DANG KY PHONG KHAM)

## TONG QUAN

Tai lieu nay tom tat cac test case da duoc implement cho `AccountsService`.

- File test: `test/unit/accounts/accounts.service.spec.ts`
- Trang thai: Passed

---

## BUOC 2: registerClinicAdmin

1) Tao clinic admin thanh cong (bank details + subscription + commit)
2) Tu choi neu email da duoc dung boi CLINIC_ADMIN (Conflict)
3) Tu choi neu email da duoc dung boi CLINIC_MANAGER (Conflict)
4) Tu choi neu sepayVa da duoc su dung (Conflict)
5) (Theo hanh vi hien tai) Tu choi neu email da ton tai voi role khac (PATIENT) (Conflict)
6) Hash password bang bcrypt
7) Rollback transaction khi co loi
8) Tao subscription voi status PENDING_SEPAY_SETUP

---

## BUOC 4A: createClinicManagerForRegistration

1) Tao clinic manager thanh cong + tao address
2) Tu choi neu actor khong phai CLINIC_ADMIN
3) Tu choi neu subscription status khong phai PENDING_MANAGER_SETUP
4) Tu choi neu manager da ton tai
5) Tu choi neu email da ton tai
6) Chuyen subscription status sang PENDING_LEGAL_SETUP
7) Rollback transaction khi co loi
8) Link manager voi admin qua parentId

---

## BUOC 4B: uploadLegalDocumentsForManager

1) Upload legal docs thanh cong
2) Tu choi neu actor khong phai CLINIC_ADMIN
3) Tu choi neu manager khong dung role CLINIC_MANAGER
4) Tu choi neu manager khong thuoc admin (parentId mismatch)
5) Tu choi neu subscription status khong phai PENDING_LEGAL_SETUP
6) Update legal docs neu da ton tai
7) Chuyen subscription status sang PENDING_APPROVAL
8) Set verification status PENDING_REVIEW
9) Rollback transaction khi co loi

---

## BUOC 8.1: cancelPendingRegistration

1) Hard delete thanh cong toan bo du lieu dang ky
2) Tu choi neu status la PENDING_APPROVAL
3) Tu choi neu status la ACTIVE
4) Tu choi neu status la NON_RENEWING
5) Tu choi neu status la EXPIRED
6) Tu choi neu ton tai SUCCESS transaction
7) Cho phep huy tu PENDING_SEPAY_SETUP
8) Cho phep huy tu PENDING_MANAGER_SETUP
9) Cho phep huy tu PENDING_LEGAL_SETUP
10) Cho phep huy tu PENDING_PAYMENT
11) Tu choi neu actor khong phai CLINIC_ADMIN
12) Rollback transaction khi co loi
13) Xoa theo thu tu nguoc FK dung

---

## validateManagerStatus

CREATE_STAFF operation
1) NotFound neu manager khong ton tai
2) Forbidden neu account khong phai manager
3) Forbidden neu manager la PENDING_APPROVAL
4) Forbidden neu manager la MANAGER_DISABLED
5) Forbidden neu status khong phai ACTIVE
6) Tra ve manager entity neu status ACTIVE

ENABLE operation
7) NotFound neu manager khong ton tai
8) BadRequest neu manager khong MANAGER_DISABLED
9) Tra ve manager entity neu MANAGER_DISABLED

DISABLE operation
10) NotFound neu manager khong ton tai
11) BadRequest neu manager khong ACTIVE
12) Tra ve manager entity neu ACTIVE

---

## createStaffByClinicManager (voi validateManagerStatus)

1) Goi validateManagerStatus truoc khi tao staff
2) Chan tao staff neu manager PENDING_APPROVAL
3) Chan tao staff neu manager MANAGER_DISABLED

---

## createDoctorByClinicManager (voi validateManagerStatus)

1) Goi validateManagerStatus truoc khi tao doctor
2) Chan tao doctor neu manager PENDING_APPROVAL
3) Chan tao doctor neu manager MANAGER_DISABLED

---

## findAllClinicsAdmin

1) Lay va map du lieu clinic admin bang joined relations
2) Bo qua clinics khong co clinicAdminInformation

---

## BO SUNG SCENARIO NGHIEP VU - CHUNK 1-900

1) Tim benh nhan: tu choi neu khong cung cap bat ky tieu chi tim kiem nao.
2) Tim benh nhan: tra ket qua khong hop le neu tai khoan tim thay khong phai PATIENT.
3) Tim benh nhan: ap dung thu tu uu tien tim kiem phone -> email -> fullName.
4) Tim benh nhan: khong tim thay thi tra goi y tao tai khoan moi (`CREATE_NEW_ACCOUNT`).
5) Tim benh nhan: neu loi parse DOB thi van tra ket qua benh nhan, bo qua truong ngay sinh.
6) Tao PATIENT thuong: email trung bi chan, hash password va rollback transaction khi loi.
7) Tao PATIENT OAuth: kich hoat ngay, danh dau email da xac minh, username fallback theo email.
8) Cap nhat tai khoan: doi email phai reset xac minh email.
9) Cap nhat tai khoan: cap nhat profile theo tung nhom role chuyen biet.
10) Lay thong tin theo role: role khong hop le phai bi tu choi.
11) Da chen `it.todo()` cho cac kich ban nghiep vu kho mo phong de dam bao theo doi coverage nghiep vu.
