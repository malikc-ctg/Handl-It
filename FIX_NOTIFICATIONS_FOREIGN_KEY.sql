-- ==========================================
-- Fix Notifications Foreign Key Constraint
-- ==========================================
-- The foreign key is pointing to wrong table, need to fix it

-- Step 1: Check current foreign key
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'notifications' 
AND tc.constraint_type = 'FOREIGN KEY'
AND kcu.column_name = 'user_id';

-- Step 2: Drop the incorrect foreign key
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- Step 3: Add correct foreign key to auth.users
ALTER TABLE notifications 
ADD CONSTRAINT notifications_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Step 4: Verify it's fixed
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'notifications' 
AND tc.constraint_type = 'FOREIGN KEY'
AND kcu.column_name = 'user_id';

-- Should now show: foreign_table_name = 'users' (from auth schema)

SELECT '✅ Foreign key fixed! Notifications now reference auth.users correctly.' AS status;









