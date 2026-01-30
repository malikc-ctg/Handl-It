-- Fix Job Types Check Constraint
-- Run this in Supabase SQL Editor

-- Drop the old check constraint
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_job_type_check;

-- Create new constraint with updated job types
ALTER TABLE jobs ADD CONSTRAINT jobs_job_type_check 
CHECK (job_type IN ('basic_clean', 'deep_clean', 'snow_removal', 'cleaning', 'maintenance', 'repair', 'inspection', 'emergency'));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'jobs'::regclass AND contype = 'c';
