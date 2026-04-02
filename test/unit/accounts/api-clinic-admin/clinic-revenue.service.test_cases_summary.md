# TOM TAT CAC TEST CASE - BAO CAO DOANH THU (CLINIC ADMIN)

## TONG QUAN

Tai lieu nay tom tat cac test case da duoc implement cho `ClinicRevenueService`.

- File test: `test/unit/accounts/api-clinic-admin/clinic-revenue.service.spec.ts`
- Trang thai: Passed

---

## FLOW 1: getOverallRevenueReport

1) Thanh cong voi CLINIC_ADMIN hop le (tra ve day du summary/breakdowns)
2) NotFound neu admin khong co chi nhanh
3) NotFound neu admin account khong ton tai
4) Forbidden neu user khong phai CLINIC_ADMIN
5) (Regression) Khong loc theo managerId trong overall report (chi lay toan bo chi nhanh)
6) Bao cao van tinh ca chi nhanh bi disable (khong loc theo status)

---

## FLOW 2: getBranchRevenueReport

1) Thanh cong: tra ve bao cao chi nhanh + top services
2) Forbidden neu managerId khong thuoc admin
3) NotFound neu managerId khong ton tai
4) BadRequest neu account duoc chi dinh khong phai CLINIC_MANAGER

---

## VALIDATION: validateDateRange

1) BadRequest neu startDate > endDate
2) BadRequest neu startDate = endDate
3) BadRequest neu khoang thoi gian > 365 ngay
4) Chap nhan khoang thoi gian dung 365 ngay

---

## BUSINESS GUARANTEE: Status Filter

1) Revenue summary chi dem giao dich SUCCESS
2) Payment method breakdown chi dem giao dich SUCCESS
3) Service category breakdown chi dem giao dich SUCCESS
4) Status breakdown bao gom ca SUCCESS/PENDING/FAILED

---

## QUERY SHAPE

1) Xac nhan join chain dung cho cac truy van doanh thu

---

## BO SUNG SCENARIO TODO (BUSINESS-FOCUSED)

2) 📝 TODO nghiep vu: fallback ten branch/manager khi du lieu tham chieu khong day du.
3) 📝 TODO nghiep vu: branch breakdown phai co ty trong doanh thu tren tong he thong.
4) 📝 TODO nghiep vu: revenue trend ho tro DAY/WEEK/MONTH va fallback an toan.
5) 📝 TODO nghiep vu: tong hop breakdown chay song song de toi uu SLA tra bao cao.
6) 📝 TODO nghiep vu: branch report chi hop le khi manager dung role va dung ownership.
7) 📝 TODO nghiep vu: status breakdown phai bao gom du ca SUCCESS/PENDING/FAILED.
