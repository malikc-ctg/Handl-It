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
-- RECOMMENDED: Simply disable the trigger if you don't need priority_score
-- Uncomment the line below to disable the trigger:
DROP TRIGGER IF EXISTS trigger_update_deal_priority_score ON deals;

-- Option 2: Fix the trigger function to handle missing priority_score field
-- The trigger tries to set NEW.priority_score but the column doesn't exist
-- This recreates the function to check if the column exists first
CREATE OR REPLACE FUNCTION update_deal_priority_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if priority_score column exists before trying to set it
  -- Use a DO block to check column existence dynamically
  -- Since we can't directly check in a trigger, we'll use exception handling
  BEGIN
    -- Try to set priority_score - will fail if column doesn't exist
    -- Use a subquery to check column existence first
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'deals' 
      AND column_name = 'priority_score'
    ) THEN
      -- Column exists, calculate and set priority_score
      NEW.priority_score := calculate_deal_priority_score(NEW);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Column doesn't exist or other error - just continue
    -- Don't set priority_score
    NULL;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Alternative: Simply disable the trigger if you don't need priority_score
-- Uncomment this if you want to disable the trigger entirely:
-- DROP TRIGGER IF EXISTS trigger_update_deal_priority_score ON deals;

-- Or recreate the trigger with the fixed function:
DROP TRIGGER IF EXISTS trigger_update_deal_priority_score ON deals;
CREATE TRIGGER trigger_update_deal_priority_score
  BEFORE INSERT OR UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_priority_score();
