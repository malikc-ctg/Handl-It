-- ==========================================
-- Fix Notifications Table Schema
-- ==========================================

-- Add link column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'link'
  ) THEN
    ALTER TABLE notifications ADD COLUMN link VARCHAR(500);
    RAISE NOTICE '✅ Added link column to notifications table';
  ELSE
    RAISE NOTICE '✅ link column already exists';
  END IF;
END $$;

-- Verify all columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;









