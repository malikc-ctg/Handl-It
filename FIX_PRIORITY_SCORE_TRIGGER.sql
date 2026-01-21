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

-- Option 1: RECOMMENDED - Disable triggers that reference missing columns/tables
-- The priority_score trigger tries to set NEW.priority_score but the column doesn't exist
DROP TRIGGER IF EXISTS trigger_update_deal_priority_score ON deals;

-- The create_deal_event trigger tries to insert into deal_events table which doesn't exist
DROP TRIGGER IF EXISTS trigger_create_deal_event ON deals;

-- Option 2: Fix the trigger function to handle missing priority_score field
-- This recreates the function to check if the column exists first
-- Uncomment below if you want to keep the trigger but make it handle missing column:

/*
CREATE OR REPLACE FUNCTION update_deal_priority_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if priority_score column exists before trying to set it
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'deals' 
    AND column_name = 'priority_score'
  ) THEN
    -- Column exists, calculate and set priority_score
    BEGIN
      NEW.priority_score := calculate_deal_priority_score(NEW);
    EXCEPTION WHEN OTHERS THEN
      -- If calculation fails, just continue without setting it
      NULL;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger with the fixed function
DROP TRIGGER IF EXISTS trigger_update_deal_priority_score ON deals;
CREATE TRIGGER trigger_update_deal_priority_score
  BEFORE INSERT OR UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_priority_score();
*/