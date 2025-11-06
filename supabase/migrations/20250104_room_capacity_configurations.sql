-- Add room_capacity_configurations JSONB column to store room-specific capacity configurations
-- This allows each room to define multiple capacity options with their cleaning types and time limits

ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS capacity_configurations JSONB DEFAULT '[]'::jsonb;

-- Structure for capacity_configurations:
-- [
--   {
--     "capacity": 2,
--     "capacity_label": "2",
--     "cleaning_types": [
--       { "type": "W", "time_limit": 40 },
--       { "type": "P", "time_limit": 25 }
--     ]
--   },
--   {
--     "capacity": 2,
--     "capacity_label": "1+1",
--     "cleaning_types": [
--       { "type": "W", "time_limit": 35 },
--       { "type": "P", "time_limit": 20 }
--     ]
--   }
-- ]

-- Add comment to document the structure
COMMENT ON COLUMN public.rooms.capacity_configurations IS 'JSONB array of capacity configurations. Each configuration contains capacity, capacity_label, and cleaning_types with time limits.';

