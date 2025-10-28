-- Simple approach: Create users directly in public.users table
-- These users will need to be activated through the admin interface

-- Insert housekeeping users directly into public.users table
-- Note: These users won't have auth accounts yet - they need to be created through the admin interface

INSERT INTO public.users (name, first_name, last_name, role, active) VALUES
('Agata Dec', 'Agata', 'Dec', 'housekeeping', true),
('Aleksandra Bednarz', 'Aleksandra', 'Bednarz', 'housekeeping', true),
('Alina Yarmolchuk', 'Alina', 'Yarmolchuk', 'housekeeping', true),
('Ewelina Szczudlek', 'Ewelina', 'Szczudlek', 'housekeeping', true),
('Maja Adamczyk', 'Maja', 'Adamczyk', 'housekeeping', true),
('Natalia Bolharenkova', 'Natalia', 'Bolharenkova', 'housekeeping', true),
('Olha Kryvosheieva', 'Olha', 'Kryvosheieva', 'housekeeping', true),
('Szymon Sworczak', 'Szymon', 'Sworczak', 'housekeeping', true)
ON CONFLICT (name) DO NOTHING;

-- Verify the users were created
SELECT 
  id,
  name,
  first_name,
  last_name,
  role,
  active,
  created_at
FROM public.users
WHERE role = 'housekeeping'
ORDER BY name;
