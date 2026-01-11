-- ============================================
-- Optional: Add 'rep' role support
-- ============================================
-- If you want to use 'rep' instead of or alongside 'worker'
-- Run this after ADD_RBAC_AUDIT_LOGGING.sql
-- ============================================

-- Step 1: Drop ALL existing role constraints (may have different names)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop all role check constraints on user_profiles
  FOR r IN 
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'user_profiles' 
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    RAISE NOTICE 'Dropped constraint: %', r.constraint_name;
  END LOOP;
  
  -- Drop all role check constraints on user_invitations
  FOR r IN 
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'user_invitations' 
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    RAISE NOTICE 'Dropped constraint: %', r.constraint_name;
  END LOOP;
END $$;

-- Step 2: Update any incompatible roles to valid ones
-- Map 'client' -> 'admin' (assuming client is equivalent to admin for sales)
-- Map 'staff' -> 'worker' (staff maps to worker)
-- Note: Constraints are dropped, so we can safely update any role

-- Update user_profiles: client -> admin, staff -> worker
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Only update rows that need to be changed
  UPDATE user_profiles
  SET role = CASE 
    WHEN role = 'client' THEN 'admin'
    WHEN role = 'staff' THEN 'worker'
    ELSE role
  END
  WHERE role IN ('client', 'staff');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE 'Updated % rows in user_profiles (client->admin, staff->worker)', v_count;
  END IF;
END $$;

-- Update user_invitations: client -> admin, staff -> worker
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Only update rows that need to be changed
  UPDATE user_invitations
  SET role = CASE 
    WHEN role = 'client' THEN 'admin'
    WHEN role = 'staff' THEN 'worker'
    ELSE role
  END
  WHERE role IN ('client', 'staff');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE 'Updated % rows in user_invitations (client->admin, staff->worker)', v_count;
  END IF;
END $$;

-- Step 3: Find and fix any remaining invalid roles
DO $$
DECLARE
  v_invalid_profiles INTEGER;
  v_invalid_invitations INTEGER;
  v_invalid_role TEXT;
BEGIN
  -- Check for invalid roles in user_profiles and show what they are
  SELECT COUNT(*), STRING_AGG(DISTINCT role, ', ') INTO v_invalid_profiles, v_invalid_role
  FROM user_profiles
  WHERE role IS NULL OR role NOT IN ('admin', 'manager', 'worker', 'rep');
  
  IF v_invalid_profiles > 0 THEN
    RAISE NOTICE 'Found % rows in user_profiles with invalid roles: %', v_invalid_profiles, COALESCE(v_invalid_role, 'NULL');
    
    -- Auto-fix: Set NULL or unknown roles to 'worker' (safest default)
    UPDATE user_profiles
    SET role = 'worker'
    WHERE role IS NULL OR role NOT IN ('admin', 'manager', 'worker', 'rep');
    
    RAISE NOTICE 'Updated invalid roles in user_profiles to ''worker''';
  END IF;
  
  -- Check for invalid roles in user_invitations and show what they are
  SELECT COUNT(*), STRING_AGG(DISTINCT role, ', ') INTO v_invalid_invitations, v_invalid_role
  FROM user_invitations
  WHERE role IS NULL OR role NOT IN ('admin', 'manager', 'worker', 'rep');
  
  IF v_invalid_invitations > 0 THEN
    RAISE NOTICE 'Found % rows in user_invitations with invalid roles: %', v_invalid_invitations, COALESCE(v_invalid_role, 'NULL');
    
    -- Auto-fix: Set NULL or unknown roles to 'worker' (safest default)
    UPDATE user_invitations
    SET role = 'worker'
    WHERE role IS NULL OR role NOT IN ('admin', 'manager', 'worker', 'rep');
    
    RAISE NOTICE 'Updated invalid roles in user_invitations to ''worker''';
  END IF;
  
  RAISE NOTICE 'All roles validated and fixed successfully';
END $$;

-- Step 4: Add new constraints that include 'rep' role
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('admin', 'manager', 'worker', 'rep'));

ALTER TABLE user_invitations
ADD CONSTRAINT user_invitations_role_check 
CHECK (role IN ('admin', 'manager', 'worker', 'rep'));

-- Note: The RBAC functions treat 'rep' and 'worker' as equivalent
-- This allows you to use either role name in your application

COMMENT ON CONSTRAINT user_profiles_role_check ON user_profiles IS 
  'Roles: admin (full access), manager (team access), worker/rep (assigned resources)';
