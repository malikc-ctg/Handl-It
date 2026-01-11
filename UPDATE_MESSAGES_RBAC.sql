-- ============================================
-- Update Messages RLS Policies with RBAC
-- ============================================
-- Extends existing message policies with role-based access
-- Reps see their own messages and assigned deal messages
-- Managers see team messages
-- Admins see all
-- ============================================

-- Helper function to check if user can access message based on role
CREATE OR REPLACE FUNCTION can_access_message(user_id_param UUID, message_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  message_record RECORD;
  user_role TEXT;
BEGIN
  -- Get message and conversation info
  SELECT 
    m.*,
    c.type as conversation_type,
    c.job_id,
    get_user_role(user_id_param) as requester_role
  INTO message_record
  FROM messages m
  INNER JOIN conversations c ON c.id = m.conversation_id
  WHERE m.id = message_id_param;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  user_role := message_record.requester_role;
  
  -- Admins can see all
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is participant (existing logic)
  IF EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = message_record.conversation_id
    AND cp.user_id = user_id_param
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- For job conversations, check if user has access to the job
  IF message_record.conversation_type = 'job' AND message_record.job_id IS NOT NULL THEN
    -- Check if user is assigned to the job or created it
    IF EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = message_record.job_id
      AND (j.user_id = user_id_param OR j.assigned_worker_id = user_id_param)
    ) THEN
      RETURN TRUE;
    END IF;
    
    -- Managers can see messages for jobs assigned to their team
    IF user_role = 'manager' THEN
      IF EXISTS (
        SELECT 1 FROM jobs j
        INNER JOIN user_profiles up ON up.id = j.assigned_worker_id
        WHERE j.id = message_record.job_id
        AND is_team_member(user_id_param, j.assigned_worker_id)
      ) THEN
        RETURN TRUE;
      END IF;
    END IF;
  END IF;
  
  -- For direct messages, only participants can see (already checked above)
  -- For group messages, check participants (already checked above)
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION can_access_message(UUID, UUID) TO authenticated;

-- Update messages SELECT policy to include RBAC checks
-- Note: This enhances but doesn't replace the existing participant check
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    user_is_participant(conversation_id, auth.uid())
    OR can_access_message(auth.uid(), id)
  )
  AND deleted_at IS NULL;

-- Audit log trigger for message access (when important messages are viewed)
-- This is optional - can be used to track access to sensitive messages
CREATE OR REPLACE FUNCTION audit_sensitive_message_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log access to messages in job conversations or group conversations
  -- Direct messages are already private by default
  IF EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = NEW.conversation_id
    AND c.type IN ('job', 'group')
  ) THEN
    -- This would be called when message is accessed
    -- For now, we'll log on message creation/update of sensitive content
    -- Actual access logging would require a separate mechanism (function call or view)
    NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Message access audit logging is better handled at application level
-- as it would require significant overhead to log every SELECT

COMMENT ON FUNCTION can_access_message IS 'Checks if user can access a message based on role and assignment';
