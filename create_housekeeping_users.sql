-- Create housekeeping users for staff availability mapping
-- This script creates users that match the "Pracownik" names in the CSV import

-- Function to create a user with proper role assignment
CREATE OR REPLACE FUNCTION create_housekeeping_user(
  user_name text,
  first_name text,
  last_name text,
  email text,
  password text DEFAULT 'housekeeping123'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_user_id uuid;
  user_id uuid;
BEGIN
  -- Create auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    email,
    crypt(password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO auth_user_id;

  -- Create user in public.users table
  INSERT INTO public.users (
    auth_id,
    name,
    first_name,
    last_name,
    role,
    active
  ) VALUES (
    auth_user_id,
    user_name,
    first_name,
    last_name,
    'housekeeping',
    true
  ) RETURNING id INTO user_id;

  -- Create role in user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth_user_id, 'housekeeping');

  RAISE NOTICE 'Created user: % (%)', user_name, email;
END;
$$;

-- Create all the housekeeping users
SELECT create_housekeeping_user('Agata Dec', 'Agata', 'Dec', 'agata.dec@sleepwalker.com');
SELECT create_housekeeping_user('Aleksandra Bednarz', 'Aleksandra', 'Bednarz', 'aleksandra.bednarz@sleepwalker.com');
SELECT create_housekeeping_user('Alina Yarmolchuk', 'Alina', 'Yarmolchuk', 'alina.yarmolchuk@sleepwalker.com');
SELECT create_housekeeping_user('Ewelina Szczudlek', 'Ewelina', 'Szczudlek', 'ewelina.szczudlek@sleepwalker.com');
SELECT create_housekeeping_user('Maja Adamczyk', 'Maja', 'Adamczyk', 'maja.adamczyk@sleepwalker.com');
SELECT create_housekeeping_user('Natalia Bolharenkova', 'Natalia', 'Bolharenkova', 'natalia.bolharenkova@sleepwalker.com');
SELECT create_housekeeping_user('Olha Kryvosheieva', 'Olha', 'Kryvosheieva', 'olha.kryvosheieva@sleepwalker.com');
SELECT create_housekeeping_user('Szymon Sworczak', 'Szymon', 'Sworczak', 'szymon.sworczak@sleepwalker.com');

-- Clean up the function
DROP FUNCTION create_housekeeping_user(text, text, text, text, text);

-- Verify the users were created
SELECT 
  u.name,
  u.first_name,
  u.last_name,
  u.role,
  u.active,
  au.email
FROM public.users u
JOIN auth.users au ON u.auth_id = au.id
WHERE u.role = 'housekeeping'
ORDER BY u.name;
