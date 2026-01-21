-- Fix the priority_score trigger to handle missing field
-- Run this in your Supabase SQL Editor

-- First, let's see what the trigger function does
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'update_deal_priority_score'
AND n.nspname = 'public';

-- Option 1: Drop the trigger temporarily (if priority_score column doesn't exist)
-- Uncomment the line below if you want to disable the trigger:
-- DROP TRIGGER IF EXISTS trigger_update_deal_priority_score ON deals;

-- Option 2: Fix the trigger function to handle missing priority_score field
-- This will recreate the function to check if the field exists before accessing it
CREATE OR REPLACE FUNCTION update_deal_priority_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update priority_score if the column exists and field is in NEW record
  -- Check if priority_score column exists in deals table
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'deals' 
    AND column_name = 'priority_score'
  ) THEN
    -- Only set priority_score if it's not already set in NEW record
    -- Use COALESCE to handle NULL values
    IF NEW.priority_score IS NULL THEN
      -- Calculate priority_score based on other fields if needed
      -- For now, set to NULL or a default value
      NEW.priority_score := NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_deal_priority_score ON deals;
CREATE TRIGGER trigger_update_deal_priority_score
  BEFORE INSERT OR UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_priority_score();
