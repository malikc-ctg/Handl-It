-- ============================================
-- Add activity_date to sales_activities
-- Run in Supabase SQL Editor if you get:
--   "Could not find the 'activity_date' column of 'sales_activities' in the schema cache"
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_activities'
      AND column_name = 'activity_date'
  ) THEN
    ALTER TABLE sales_activities
    ADD COLUMN activity_date TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added column sales_activities.activity_date';
  ELSE
    RAISE NOTICE 'Column sales_activities.activity_date already exists';
  END IF;
END $$;

-- Optional: backfill existing rows so activity_date = created_at where null
UPDATE sales_activities
SET activity_date = COALESCE(activity_date, created_at)
WHERE activity_date IS NULL;

SELECT 'sales_activities.activity_date ready' AS status;
