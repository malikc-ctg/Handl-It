-- ============================================
-- Add updated_at column to quote_revisions table
-- ============================================

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_revisions' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE quote_revisions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create trigger to update updated_at automatically
DROP TRIGGER IF EXISTS update_quote_revisions_updated_at ON quote_revisions;
CREATE TRIGGER update_quote_revisions_updated_at 
  BEFORE UPDATE ON quote_revisions
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

SELECT '✅ quote_revisions updated_at column added!' as result;
