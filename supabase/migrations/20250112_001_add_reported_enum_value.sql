-- Step 1: Add 'reported' status to issue_status enum
-- This must be in a separate migration because PostgreSQL requires
-- enum values to be committed before they can be used
-- Note: 'reported' is the database value, displayed as 'Zgłoszone' in Polish UI

-- Add the new enum value
ALTER TYPE issue_status ADD VALUE IF NOT EXISTS 'reported';

