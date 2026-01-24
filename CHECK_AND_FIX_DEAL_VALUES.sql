-- ============================================
-- CHECK AND FIX DEAL VALUES
-- ============================================
-- This script helps diagnose and fix deal value issues
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Check what columns exist in deals table
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'deals'
    AND column_name IN ('deal_value', 'value_estimate', 'estimated_value')
ORDER BY column_name;

-- Step 2: Check current deal values
-- Run this query only if the columns exist (check Step 1 results first)
-- If deal_value exists:
SELECT 
    id,
    title,
    stage,
    deal_value
FROM deals
WHERE deal_value IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- If value_estimate exists (run separately if needed):
-- SELECT 
--     id,
--     title,
--     stage,
--     value_estimate
-- FROM deals
-- WHERE value_estimate IS NOT NULL
-- ORDER BY created_at DESC
-- LIMIT 20;

-- Step 3: Show which deals have values and which don't
-- This will work if at least one value column exists
-- Adjust based on Step 1 results
SELECT 
    id,
    title,
    stage,
    COALESCE(
        CASE WHEN deal_value IS NOT NULL AND deal_value > 0 THEN 'deal_value: $' || deal_value::text END,
        CASE WHEN value_estimate IS NOT NULL AND value_estimate > 0 THEN 'value_estimate: $' || value_estimate::text END,
        'NO_VALUE'
    ) as value_info
FROM deals
ORDER BY created_at DESC
LIMIT 20;

-- Step 4: Count deals with and without values
-- Adjust this query based on which columns exist (from Step 1)
SELECT 
    COUNT(*) as total_deals,
    COUNT(CASE WHEN deal_value IS NOT NULL AND deal_value > 0 THEN 1 END) as has_deal_value,
    COUNT(CASE WHEN value_estimate IS NOT NULL AND value_estimate > 0 THEN 1 END) as has_value_estimate,
    COUNT(CASE WHEN 
        COALESCE(deal_value, 0) = 0 
        AND COALESCE(value_estimate, 0) = 0
    THEN 1 END) as no_value
FROM deals;

-- Step 5: If you have value_estimate but need deal_value, run this:
-- UPDATE deals 
-- SET deal_value = value_estimate 
-- WHERE (deal_value IS NULL OR deal_value = 0) 
--   AND value_estimate IS NOT NULL 
--   AND value_estimate > 0;

-- Step 6: If you have deal_value but need value_estimate, run this:
-- UPDATE deals 
-- SET value_estimate = deal_value 
-- WHERE (value_estimate IS NULL OR value_estimate = 0) 
--   AND deal_value IS NOT NULL 
--   AND deal_value > 0;

-- Step 7: Check if values are stored in metadata JSONB
SELECT 
    id,
    title,
    metadata->>'deal_value' as metadata_deal_value,
    metadata->>'value' as metadata_value,
    metadata->>'estimated_value' as metadata_estimated_value
FROM deals
WHERE metadata IS NOT NULL 
  AND (
    metadata ? 'deal_value' 
    OR metadata ? 'value' 
    OR metadata ? 'estimated_value'
  )
LIMIT 10;
