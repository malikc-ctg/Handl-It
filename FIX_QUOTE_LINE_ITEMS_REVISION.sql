-- ============================================
-- Add revision_number column to quote_line_items table if missing
-- ============================================

DO $$
BEGIN
  -- Check if revision_number column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_line_items' 
    AND column_name = 'revision_number'
  ) THEN
    -- Add revision_number column
    ALTER TABLE quote_line_items ADD COLUMN revision_number INTEGER NOT NULL DEFAULT 1;
    
    -- If table already has data, update existing rows to revision 1
    UPDATE quote_line_items SET revision_number = 1 WHERE revision_number IS NULL;
    
    RAISE NOTICE 'Added revision_number column to quote_line_items';
  END IF;
END $$;

-- Recreate unique constraint if needed
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quote_line_items_quote_id_revision_number_display_order_key'
  ) THEN
    ALTER TABLE quote_line_items DROP CONSTRAINT quote_line_items_quote_id_revision_number_display_order_key;
  END IF;
  
  -- Add new constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quote_line_items_quote_id_revision_number_display_order_key'
  ) THEN
    ALTER TABLE quote_line_items ADD CONSTRAINT quote_line_items_quote_id_revision_number_display_order_key 
      UNIQUE(quote_id, revision_number, display_order);
  END IF;
END $$;

SELECT '✅ quote_line_items revision_number column added!' as result;
