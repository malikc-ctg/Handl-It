-- Add archived_at column to sites table
-- Run this in Supabase SQL Editor

ALTER TABLE sites ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sites_archived_at ON sites(archived_at) WHERE archived_at IS NOT NULL;

SELECT 'Sites archived_at column added successfully!' AS result;
