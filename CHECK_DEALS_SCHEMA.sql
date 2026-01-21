-- Check actual deals table schema
-- Run this in your Supabase SQL Editor to see what columns actually exist

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'deals'
ORDER BY ordinal_position;

-- Check for triggers on deals table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'deals';
