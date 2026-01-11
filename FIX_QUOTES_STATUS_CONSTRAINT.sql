-- ============================================
-- Fix Quotes Status Constraint
-- Updates the old status constraint to match new schema
-- ============================================

-- Drop the old constraint
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;

-- Add the new constraint with all valid status values
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check 
  CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'withdrawn', 'rejected', 'negotiating'));

-- Update any existing 'rejected' statuses to 'declined' (if needed)
-- UPDATE quotes SET status = 'declined' WHERE status = 'rejected';
-- UPDATE quotes SET status = 'negotiating' WHERE status = 'negotiating';  -- Keep this one

SELECT '✅ Quotes status constraint updated!' as result;
