---
name: smart-seed
description: Recursively seeds data for any entity, automatically resolving dependencies by creating new records or finding existing ones.
---

# Smart Seed Skill

Skill này giúp bạn tạo dữ liệu mẫu cho bất kỳ bảng nào trong database. Nó tự động phân tích quan hệ khóa ngoại (Foreign Keys) để tìm hoặc tạo dữ liệu phụ thuộc.

## Cách sử dụng

**Trong Chat:**
> "Seed 5 dòng cho bảng Transaction"
> "Tạo dữ liệu mẫu cho Prescription"

**Lệnh chạy ngầm:**
```bash
npx ts-node -r tsconfig-paths/register .agent/skills/smart-seed/scripts/seed.ts --entity [EntityName] --count [Number]
```

## Logic hoạt động

1.  **Phân tích Metadata:** Đọc Entity để biết cần điền các cột nào.
2.  **Resolve Dependency:**
    *   Nếu gặp `@ManyToOne` (ví dụ: `clinic_id`):
        *   Tìm 1 dòng ngẫu nhiên trong bảng `clinics`.
        *   Nếu bảng rỗng -> Đệ quy gọi `seed('Clinic')` để tạo mới.
3.  **Generate Data:** Dùng `faker` để điền các cột còn lại (tên, ngày tháng, tiền...).
