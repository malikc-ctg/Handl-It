-- Fix the dm_contact_id foreign key constraint
-- The constraint currently references account_contacts, but we use contacts table

-- Drop the old constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_dm_contact_id_fkey;

-- Add the new constraint referencing contacts table
ALTER TABLE accounts 
ADD CONSTRAINT accounts_dm_contact_id_fkey 
FOREIGN KEY (dm_contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

-- Verify the constraint
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'accounts' 
    AND tc.constraint_type = 'FOREIGN KEY';
