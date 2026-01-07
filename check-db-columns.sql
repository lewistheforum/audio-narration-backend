-- Kiểm tra cấu trúc bảng code_verification
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'code_verification'
ORDER BY 
    ordinal_position;

-- Kiểm tra tất cả các bảng có cột id hoặc _id
SELECT 
    table_name,
    column_name
FROM 
    information_schema.columns
WHERE 
    column_name IN ('id', '_id')
    AND table_schema = 'public'
ORDER BY 
    table_name, column_name;
