-- ============================================
-- Add revision_number and display_order columns to quote_line_items table if missing
-- ============================================

DO $$
BEGIN
  -- Add revision_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_line_items' 
    AND column_name = 'revision_number'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN revision_number INTEGER NOT NULL DEFAULT 1;
    RAISE NOTICE 'Added revision_number column to quote_line_items';
  END IF;
  
  -- Add display_order column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_line_items' 
    AND column_name = 'display_order'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN display_order INTEGER DEFAULT 0;
    -- Update existing rows to have display_order based on created_at or id
    UPDATE quote_line_items SET display_order = 0 WHERE display_order IS NULL;
    RAISE NOTICE 'Added display_order column to quote_line_items';
  END IF;
END $$;

-- Recreate unique constraint if needed (only after columns exist)
DO $$
BEGIN
  -- Drop old constraint if it exists (with any name variations)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quote_line_items_quote_id_revision_number_display_order_key'
  ) THEN
    ALTER TABLE quote_line_items DROP CONSTRAINT quote_line_items_quote_id_revision_number_display_order_key;
  END IF;
  
  -- Drop constraint if it exists without display_order (old version)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname LIKE 'quote_line_items_quote_id%key'
    AND conname != 'quote_line_items_quote_id_revision_number_display_order_key'
  ) THEN
    -- Get the constraint name
    DECLARE
      constraint_name TEXT;
    BEGIN
      SELECT conname INTO constraint_name
      FROM pg_constraint 
      WHERE conrelid = 'quote_line_items'::regclass
      AND contype = 'u'
      AND conname LIKE 'quote_line_items_quote_id%key'
      AND conname != 'quote_line_items_quote_id_revision_number_display_order_key'
      LIMIT 1;
      
      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE quote_line_items DROP CONSTRAINT %I', constraint_name);
      END IF;
    END;
  END IF;
  
  -- Add new constraint (only if both columns exist now)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_line_items' 
    AND column_name = 'revision_number'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_line_items' 
    AND column_name = 'display_order'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'quote_line_items_quote_id_revision_number_display_order_key'
    ) THEN
      ALTER TABLE quote_line_items ADD CONSTRAINT quote_line_items_quote_id_revision_number_display_order_key 
        UNIQUE(quote_id, revision_number, display_order);
      RAISE NOTICE 'Added unique constraint to quote_line_items';
    END IF;
  END IF;
END $$;

SELECT '✅ quote_line_items revision_number and display_order columns added!' as result;
