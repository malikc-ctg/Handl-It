-- ============================================
-- Quote Engine v2 Schema Updates
-- ============================================
-- Adds fields to support Quote Calculation Engine v2
-- Run this in Supabase SQL Editor
-- ============================================

BEGIN;

-- Add quote engine version field
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS quote_engine_version TEXT DEFAULT NULL;

-- Add quote calculation inputs (JSONB to store all input parameters)
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS quote_calculation_inputs JSONB DEFAULT NULL;

-- Add quote calculation outputs (JSONB to store calculation results)
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS quote_calculation_outputs JSONB DEFAULT NULL;

-- Add quote breakdown (line items, assumptions, etc.)
ALTER TABLE quote_revisions
ADD COLUMN IF NOT EXISTS quote_breakdown JSONB DEFAULT NULL;

-- Update quote_type check constraint to remove 'ballpark'
-- First, check if constraint exists and what it contains
DO $$
BEGIN
  -- Remove ballpark from existing quotes (convert to standard)
  UPDATE quotes 
  SET quote_type = 'standard' 
  WHERE quote_type = 'ballpark';
  
  -- Note: If you have a CHECK constraint on quote_type, you may need to:
  -- ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_quote_type_check;
  -- ALTER TABLE quotes ADD CONSTRAINT quotes_quote_type_check 
  --   CHECK (quote_type IN ('standard', 'walkthrough_required'));
END $$;

-- Add index for quote engine version queries
CREATE INDEX IF NOT EXISTS idx_quotes_engine_version ON quotes(quote_engine_version) 
WHERE quote_engine_version IS NOT NULL;

-- Add index for quote calculation queries
CREATE INDEX IF NOT EXISTS idx_quotes_calculation_inputs ON quotes USING GIN(quote_calculation_inputs) 
WHERE quote_calculation_inputs IS NOT NULL;

COMMENT ON COLUMN quotes.quote_engine_version IS 'Version of quote calculation engine used (e.g., "v2")';
COMMENT ON COLUMN quotes.quote_calculation_inputs IS 'JSONB object containing all inputs to quote calculation engine';
COMMENT ON COLUMN quotes.quote_calculation_outputs IS 'JSONB object containing calculation results (monthly_price_ex_hst, hst_amount, assumptions, line_items, etc.)';
COMMENT ON COLUMN quote_revisions.quote_breakdown IS 'JSONB object containing detailed breakdown of quote (line items, multipliers, etc.)';

COMMIT;

SELECT '✅ Quote Engine v2 schema updates applied!' as result;
