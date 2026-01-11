-- ============================================
-- Add Cleaning-Specific Fields to Quote System
-- ============================================

-- Add cleaning metrics to quote_revisions (using JSONB for flexibility)
DO $$
BEGIN
  -- Check if cleaning_metrics column already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_revisions' 
    AND column_name = 'cleaning_metrics'
  ) THEN
    ALTER TABLE quote_revisions ADD COLUMN cleaning_metrics JSONB;
  END IF;
END $$;

-- Add cleaning metrics to quotes table as well (for quick reference)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' 
    AND column_name = 'cleaning_metrics'
  ) THEN
    ALTER TABLE quotes ADD COLUMN cleaning_metrics JSONB;
  END IF;
END $$;

-- cleaning_metrics JSONB structure will store:
-- {
--   "square_footage": 5000,
--   "restrooms": 3,
--   "kitchens": 1,
--   "floors": 2,
--   "frequency": "weekly",
--   "services": ["service-id-1", "service-id-2"],
--   "per_sqft_rate": 0.15,
--   "per_restroom_rate": 50,
--   "per_kitchen_rate": 75
-- }

SELECT '✅ Cleaning metrics fields added to quotes and quote_revisions!' as result;
