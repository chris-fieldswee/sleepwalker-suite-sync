-- Add capacity_label field to rooms table to differentiate between "2" and "1+1"
-- This field stores the label/display format while capacity stores the numeric value

-- Add capacity_label column to rooms table
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS capacity_label TEXT;

-- Update existing rooms to have default capacity_label based on their capacity
UPDATE public.rooms SET capacity_label = capacity::TEXT WHERE capacity_label IS NULL;

-- Make sure the column has a default value for future inserts
ALTER TABLE public.rooms ALTER COLUMN capacity_label SET DEFAULT '2';

