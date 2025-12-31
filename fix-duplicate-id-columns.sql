-- Migration: Fix duplicate id columns in code_verification and other tables
-- Run this ONLY if you have both 'id' and '_id' columns

BEGIN;

-- 1. Code Verification table
-- If you have data in 'id' column, copy it to '_id' first
-- UPDATE code_verification SET "_id" = id WHERE "_id" IS NULL;

-- Drop the 'id' column if it exists
ALTER TABLE code_verification DROP COLUMN IF EXISTS id;

-- Ensure _id is the primary key
-- ALTER TABLE code_verification DROP CONSTRAINT IF EXISTS code_verification_pkey;
-- ALTER TABLE code_verification ADD PRIMARY KEY (_id);

-- 2. Repeat for other affected tables if needed
-- Check with the SELECT query first to see which tables are affected

COMMIT;

-- To rollback if something goes wrong:
-- ROLLBACK;
