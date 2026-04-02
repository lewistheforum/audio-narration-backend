# TOM TAT CAC TEST CASE - QUAN LY CHI NHANH (CLINIC MANAGER) (CLINIC ADMIN)

## TONG QUAN

Tai lieu nay tom tat cac test case da duoc implement cho `ClinicManagerService`.

- File test: `test/unit/accounts/api-clinic-admin/clinic-manager.service.spec.ts`
- Trang thai: Passed

---

## Service Definition

1) should be defined

---

## FLOW 1: getManagerList

1) Tu choi neu requester khong phai CLINIC_ADMIN (Forbidden)
2) Tu choi neu admin account khong ton tai (Forbidden)
3) Tra ve danh sach rong khi khong co manager
4) Mapping dung truong du lieu (province/legalDocStatus/staffCount/doctorCount...)
5) Tinh pagination (totalPages) dung voi totalItems/limit
6) Goi repository voi default query
7) Goi repository voi custom pagination/sort
8) Truyen filter fullName vao repository
9) Truyen filter clinicBranchName vao repository
10) Truyen filter email vao repository
11) Truyen filter status vao repository
12) Truyen filter legalDocStatus vao repository
13) Truyen filter province vao repository
14) Truyen nhieu filter dong thoi vao repository

---

## FLOW 2: getManagerDetail

1) NotFound neu manager khong ton tai
2) Forbidden neu admin khong so huu manager
3) Tra ve chi tiet day du (profile + address + legal docs + personnel)
4) personnel = [] neu status la PENDING_APPROVAL
5) Van tra personnel neu status la MANAGER_DISABLED
6) Loai bo nhan su soft deleted (deletedAt != null)
7) Fallback dia chi rong / iframe null neu thieu address
8) Fallback legal docs NOT_SUBMITTED neu thieu legal docs

---

## FLOW 3: createManager

1) Forbidden neu requester khong phai CLINIC_ADMIN
2) Forbidden neu admin khong ton tai
3) Conflict neu email da ton tai
4) Tao manager thanh cong bang transaction va status PENDING_APPROVAL
5) Tao manager khong can googleMapIframe neu khong cung cap
6) Password duoc hash bang bcrypt
7) Rollback neu co loi khi save
8) Parse dob string sang Date

---

## FLOW 4: updateLegalDocuments

1) NotFound neu manager khong ton tai
2) Forbidden neu admin khong so huu manager
3) BadRequest neu account khong phai manager
4) Tao moi legal docs neu chua co va set PENDING_REVIEW
5) Update legal docs neu da co va reset PENDING_REVIEW + clear rejectionReason
6) Ep manager status ve PENDING_APPROVAL neu truoc do khac
7) Khong doi status neu da la PENDING_APPROVAL
8) Dam bao co transaction (connect/start/commit/release)
9) Rollback neu co loi
10) Giu nguyen cac truong khong duoc cung cap (partial update)

---

## FLOW 7: disableManager

1) NotFound neu manager khong ton tai
2) Forbidden neu admin khong so huu manager
3) BadRequest neu account khong phai manager
4) BadRequest neu status khong phai ACTIVE
5) Disable thanh cong: set MANAGER_DISABLED va tra ve thong diep kem so nhan su
6) Thong diep tra ve dung format voi staffCount/doctorCount

---

## FLOW 8: enableManager

1) NotFound neu manager khong ton tai
2) Forbidden neu admin khong so huu manager
3) BadRequest neu account khong phai manager
4) BadRequest neu status khong phai MANAGER_DISABLED
5) Enable thanh cong: set ACTIVE va tra ve thong diep kem so nhan su
6) Thong diep tra ve dung format voi staffCount/doctorCount

---

## FLOW 5: softDeleteManager

1) NotFound neu manager khong ton tai
2) Forbidden neu admin khong so huu manager
3) BadRequest neu legal docs dang PENDING_REVIEW
4) BadRequest neu manager dang ACTIVE (yeu cau disable truoc)
5) Xoa mem thanh cong voi status PENDING_APPROVAL
6) Xoa mem thanh cong voi status MANAGER_DISABLED
7) Xoa mem thanh cong voi status BAN
8) Cho phep xoa neu legal docs la APPROVED
9) Cho phep xoa neu legal docs la REJECTED
10) Cho phep xoa neu khong co legal docs

---

## CAP NHAT SNIPER

11) generateManagerKeys: từ chối nếu requester không phải CLINIC_ADMIN.
12) generateManagerKeys: từ chối nếu manager không thuộc quyền quản lý.
13) generateManagerKeys: sinh và lưu keypair mới thành công.
14) updateManagerLocation: rollback khi không có address.
15) updateManagerLocation: tạo mới iframe khi chưa tồn tại.

---

## BỔ SUNG SCENARIO TODO (BUSINESS-FOCUSED)

16) 📝 TODO nghiệp vụ: phân quyền truy cập chi tiết manager theo owner/self model.
17) 📝 TODO nghiệp vụ: khi manager ở PENDING_APPROVAL thì ẩn danh sách nhân sự.
18) 📝 TODO nghiệp vụ: cập nhật profile bị chặn với manager trạng thái BAN/DELETED.
19) 📝 TODO nghiệp vụ: cập nhật legal docs luôn kích hoạt lại luồng tái duyệt và đóng băng vận hành.
20) 📝 TODO nghiệp vụ: disable chỉ cho ACTIVE, enable chỉ cho MANAGER_DISABLED.
21) 📝 TODO nghiệp vụ: soft delete chỉ hợp lệ khi vượt qua kiểm tra legal docs và status.
22) 📝 TODO nghiệp vụ: mọi cập nhật location phải đảm bảo transaction atomic Address + Iframe.
