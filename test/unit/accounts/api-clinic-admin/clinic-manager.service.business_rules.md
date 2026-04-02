# QUY TAC NGHIEP VU - QUAN LY CHI NHANH (CLINIC MANAGER) (CLINIC ADMIN)

## TONG QUAN

Tai lieu nay mo ta cac quy tac nghiep vu duoc kiem tra trong unit test cho `ClinicManagerService` (goc nhin CLINIC_ADMIN quan ly tai khoan CLINIC_MANAGER truc thuoc).

Pham vi bao gom:
- Xem danh sach chi nhanh (co loc / phan trang)
- Xem chi tiet chi nhanh (bao gom dia chi, tai lieu phap ly, nhan su)
- Tao chi nhanh moi (transaction)
- Cap nhat tai lieu phap ly (transaction, kich hoat luong tai tham dinh)
- Vo hieu hoa / kich hoat lai chi nhanh
- Xoa mem chi nhanh (soft delete) theo rang buoc trang thai

---

## FLOW 1: XEM DANH SACH CHI NHANH (getManagerList)

### BR-CMGR-01: Chi CLINIC_ADMIN moi duoc xem danh sach

Chinh sach:
- Neu tai khoan requester khong ton tai hoac role khong phai `CLINIC_ADMIN` thi tu choi.

Ket qua:
- Nem `ForbiddenException` voi thong bao "Only clinic admins can view manager list".

### BR-CMGR-02: Tra ve du lieu phan trang va mapping thong tin

Chinh sach:
- Danh sach tra ve gom cac chi nhanh truc thuoc CLINIC_ADMIN, kem `meta` (page/limit/totalItems/totalPages).
- Truong `legalDocStatus`:
  - Neu co legal documents -> lay `verificationStatus`
  - Neu khong co -> mac dinh `NOT_SUBMITTED`
- Truong `province`:
  - Neu co address -> lay `provinceName`
  - Neu khong co -> mac dinh `N/A`

---

## FLOW 2: XEM CHI TIET CHI NHANH (getManagerDetail)

### BR-CMGR-03: Chi nhanh phai ton tai

Ket qua:
- Neu khong tim thay -> nem `NotFoundException` ("Manager not found").

### BR-CMGR-04: Xac thuc quyen truy cap (owner hoac self)

Chinh sach:
- CLINIC_ADMIN chi duoc xem chi nhanh co `parentId` trung `requesterId`.
- CLINIC_MANAGER duoc xem chinh minh.

Ket qua:
- Vi pham -> nem `ForbiddenException` ("You do not have access to this manager").

### BR-CMGR-05: Nhan su bi an khi chi nhanh dang PENDING_APPROVAL

Chinh sach:
- Neu `manager.status = PENDING_APPROVAL` thi `personnel = []` (khong hien thi nhan su).

### BR-CMGR-06: Loc nhan su da bi soft delete

Chinh sach:
- Nhan su co `deletedAt` khong null se bi loai khoi `personnel`.

### BR-CMGR-07: Du lieu thieu duoc tra ve theo gia tri mac dinh

Chinh sach:
- Neu khong co address -> cac truong dia chi tra ve chuoi rong va `googleMapIframe = null`.
- Neu khong co legal documents -> `verificationStatus = NOT_SUBMITTED`, cac URL co the `undefined`.

---

## FLOW 3: TAO CHI NHANH (createManager)

### BR-CMGR-08: Chi CLINIC_ADMIN moi duoc tao chi nhanh

Ket qua:
- Neu requester khong phai `CLINIC_ADMIN` hoac khong ton tai -> nem `ForbiddenException` ("Only clinic admins can create managers").

### BR-CMGR-09: Email chi nhanh phai duy nhat

Ket qua:
- Neu email da ton tai -> nem `ConflictException` (`MESSAGES.failMessage.userEmailAlreadyExists`).

### BR-CMGR-10: Tao chi nhanh bang transaction (tinh nguyen tu)

Chinh sach:
- Tao moi gom nhieu entity trong 1 transaction:
  - Account (role `CLINIC_MANAGER`, `parentId = clinicAdminId`)
  - ClinicManagerInformation
  - Address
  - GoogleIframe (neu co)
- Neu co loi bat ky -> rollback.

### BR-CMGR-11: Trang thai khoi tao cua chi nhanh

Chinh sach:
- Manager Account duoc tao voi `status = PENDING_APPROVAL`.

---

## FLOW 4: CAP NHAT TAI LIEU PHAP LY (updateLegalDocuments)

### BR-CMGR-12: Xac thuc dung doi tuong va quyen so huu

Chinh sach:
- Manager phai ton tai.
- Manager phai co role `CLINIC_MANAGER`.
- Manager phai thuoc CLINIC_ADMIN (parentId trung).

Ket qua:
- Khong ton tai -> `NotFoundException`.
- Sai owner -> `ForbiddenException`.
- Sai role -> `BadRequestException`.

### BR-CMGR-13: Cap nhat tai lieu luon kich hoat luong tai tham dinh

Chinh sach:
- Neu legal docs da ton tai: update truong duoc cung cap va giu truong khong cung cap.
- Neu chua ton tai: create moi.
- Luon dat `verificationStatus = PENDING_REVIEW` va xoa `rejectionReason`.

### BR-CMGR-14: Cap nhat tai lieu se ep chi nhanh ve PENDING_APPROVAL

Chinh sach:
- Neu manager status khac `PENDING_APPROVAL` thi set ve `PENDING_APPROVAL`.
- Muc dich: khoa cac thao tac van hanh cho den khi duoc phe duyet.

### BR-CMGR-15: Atomicity

Chinh sach:
- Toan bo cap nhat duoc thuc hien trong transaction; co loi -> rollback; luon release.

---

## FLOW 7-8: VO HIEU HOA / KICH HOAT LAI (disableManager, enableManager)

### BR-CMGR-16: Xac thuc so huu va dung vai tro

Chinh sach:
- Manager phai ton tai, dung role `CLINIC_MANAGER`, va thuoc admin.

### BR-CMGR-17: Disable chi khi dang ACTIVE

Ket qua:
- Neu status khac `ACTIVE` -> `BadRequestException`.
- Neu hop le: set `MANAGER_DISABLED` va tra ve thong diep kem so luong nhan su bi anh huong.

### BR-CMGR-18: Enable chi khi dang MANAGER_DISABLED

Ket qua:
- Neu status khac `MANAGER_DISABLED` -> `BadRequestException`.
- Neu hop le: set `ACTIVE` va tra ve thong diep kem so luong nhan su.

---

## FLOW 5: XOA MEM CHI NHANH (softDeleteManager)

### BR-CMGR-19: Cam xoa khi legal documents dang PENDING_REVIEW

Ket qua:
- Neu `legalDocs.verificationStatus = PENDING_REVIEW` -> `BadRequestException`.

### BR-CMGR-20: Cam xoa khi manager dang ACTIVE

Ket qua:
- Neu status `ACTIVE` -> `BadRequestException` (yeu cau disable truoc).

### BR-CMGR-21: Cho phep xoa voi cac trang thai con lai hop le

Chinh sach:
- Cho phep xoa neu status la `PENDING_APPROVAL`, `MANAGER_DISABLED`, hoac `BAN`.
- Thuc hien bang cach set `deletedAt = current time` (soft delete) va luu.

---

## CAP NHAT SNIPER

### BR-CMGR-22: Sinh lại khóa số cho manager phải qua kiểm tra quyền sở hữu
- Chỉ CLINIC_ADMIN hợp lệ mới được sinh khóa cho manager.
- Manager phải thuộc đúng CLINIC_ADMIN; sai quan hệ thì từ chối.

### BR-CMGR-23: Cập nhật location phải rollback nếu thiếu address
- Nếu không tìm thấy địa chỉ manager, toàn bộ transaction location bị rollback.

### BR-CMGR-24: Truy cập chi tiết manager theo mô hình owner/self
- CLINIC_ADMIN chỉ xem được manager thuộc quyền quản lý.
- CLINIC_MANAGER có thể xem chính hồ sơ của mình.
- Các trường hợp khác bị từ chối truy cập.

### BR-CMGR-25: Trạng thái PENDING_APPROVAL khóa hiển thị nhân sự chi nhánh
- Khi manager đang chờ duyệt, danh sách personnel phải trả rỗng để phản ánh chi nhánh chưa vận hành.

### BR-CMGR-26: Cập nhật profile bị chặn khi manager bị BAN hoặc DELETED
- Dù có quyền owner/self, hồ sơ manager ở trạng thái cấm/xóa không được chỉnh sửa.

### BR-CMGR-27: Cập nhật location phải đảm bảo atomicity cho Address + Iframe
- Địa chỉ và iframe được cập nhật trong cùng transaction; lỗi bất kỳ bước nào phải rollback toàn bộ.

### BR-CMGR-28: Soft delete manager là xóa mềm có điều kiện
- Chỉ cho phép khi manager không ACTIVE và legal docs không ở PENDING_REVIEW.
- Hành động xóa thực hiện bằng cập nhật `deletedAt`, không hard delete.
