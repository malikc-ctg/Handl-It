-- Add new fields to accounts table for enhanced account management
-- Run this in Supabase SQL Editor

-- Add phone column if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'phone') THEN
    ALTER TABLE accounts ADD COLUMN phone TEXT;
  END IF;
END $$;

-- Add email column if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'email') THEN
    ALTER TABLE accounts ADD COLUMN email TEXT;
  END IF;
END $$;

-- Add website column if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'website') THEN
    ALTER TABLE accounts ADD COLUMN website TEXT;
  END IF;
END $$;

-- Add industry column if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'industry') THEN
    ALTER TABLE accounts ADD COLUMN industry TEXT;
  END IF;
END $$;

-- Add notes column if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'notes') THEN
    ALTER TABLE accounts ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
ORDER BY ordinal_position;
