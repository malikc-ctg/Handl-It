-- Complete Sites Table Setup for Supabase
-- Run this entire script in Supabase SQL Editor

-- Drop existing table if needed (CAREFUL - this deletes data!)
DROP TABLE IF EXISTS sites CASCADE;

-- Create sites table
CREATE TABLE sites (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'In Setup', 'Paused', 'Inactive')),
  square_footage INTEGER,
  contact_phone TEXT,
  contact_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (allows all access)
ALTER TABLE sites DISABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated and anon users
GRANT ALL ON sites TO authenticated;
GRANT ALL ON sites TO anon;
GRANT USAGE, SELECT ON SEQUENCE sites_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE sites_id_seq TO anon;

-- Insert a test site to verify it works
INSERT INTO sites (name, address, status, square_footage, contact_phone, contact_email, notes)
VALUES (
  'Test Site',
  '123 Test Street, Toronto, ON',
  'Active',
  5000,
  '416-555-0100',
  'test@northernfacilitiesgroup.ca',
  'This is a test site created during setup'
);

-- Verify the table was created and data was inserted
SELECT * FROM sites;

-- Show table info
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sites'
ORDER BY ordinal_position;

















