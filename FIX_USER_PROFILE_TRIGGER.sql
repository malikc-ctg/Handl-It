-- ==========================================
-- Fix User Profile Trigger Function
-- ==========================================
-- This fixes the trigger function to properly create user_profiles
-- when a new auth user is created, with proper error handling

-- 1. Create or replace the function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, 
    email, 
    full_name, 
    role, 
    status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'worker'),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating user profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 2. Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- Note: SECURITY DEFINER functions bypass RLS
-- ==========================================
-- The trigger function runs as SECURITY DEFINER, which means
-- it bypasses Row Level Security (RLS) policies.
-- No additional RLS policy is needed for this trigger.

-- ==========================================
-- Verification
-- ==========================================
SELECT '✅ User profile trigger function updated successfully!' as result;
