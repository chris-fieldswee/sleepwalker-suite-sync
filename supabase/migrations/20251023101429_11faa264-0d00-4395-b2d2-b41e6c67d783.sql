-- Create enum types
CREATE TYPE public.user_role AS ENUM ('admin', 'reception', 'housekeeping');
CREATE TYPE public.room_group AS ENUM ('P1', 'P2', 'A1S', 'A2S', 'OTHER');
CREATE TYPE public.cleaning_type AS ENUM ('W', 'P', 'T', 'O', 'G', 'S');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'paused', 'done', 'repair_needed');

-- Users table (extends auth.users with role info)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'housekeeping',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  group_type room_group NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  cleaning_types JSONB DEFAULT '["W","P"]'::jsonb,
  color TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Time limits configuration
CREATE TABLE public.limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_type room_group NOT NULL,
  cleaning_type cleaning_type NOT NULL,
  guest_count INTEGER NOT NULL,
  time_limit INTEGER NOT NULL, -- in minutes
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_type, cleaning_type, guest_count)
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cleaning_type cleaning_type NOT NULL,
  guest_count INTEGER NOT NULL DEFAULT 2,
  time_limit INTEGER, -- in minutes
  start_time TIMESTAMPTZ,
  pause_start TIMESTAMPTZ,
  pause_stop TIMESTAMPTZ,
  total_pause INTEGER DEFAULT 0, -- in minutes
  stop_time TIMESTAMPTZ,
  actual_time INTEGER, -- in minutes
  difference INTEGER, -- in minutes
  status task_status DEFAULT 'todo',
  housekeeping_notes TEXT,
  reception_notes TEXT,
  issue_flag BOOLEAN DEFAULT false,
  issue_description TEXT,
  issue_photo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Work logs table
CREATE TABLE public.work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_in TIMESTAMPTZ,
  time_out TIMESTAMPTZ,
  total_minutes INTEGER,
  break_minutes INTEGER DEFAULT 0,
  breakfast_minutes INTEGER DEFAULT 0,
  laundry_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Only admins can insert users" ON public.users FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Only admins can update users" ON public.users FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
);

-- RLS Policies for rooms table
CREATE POLICY "Everyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Only reception and admin can manage rooms" ON public.rooms FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role IN ('admin', 'reception'))
);

-- RLS Policies for limits table
CREATE POLICY "Everyone can view limits" ON public.limits FOR SELECT USING (true);
CREATE POLICY "Only admins can manage limits" ON public.limits FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
);

-- RLS Policies for tasks table
CREATE POLICY "Housekeeping can view their own tasks" ON public.tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND (
    role IN ('admin', 'reception') OR 
    (role = 'housekeeping' AND id = tasks.user_id)
  ))
);

CREATE POLICY "Reception and admin can insert tasks" ON public.tasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role IN ('admin', 'reception'))
);

CREATE POLICY "Housekeeping can update their own tasks" ON public.tasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND (
    role IN ('admin', 'reception') OR 
    (role = 'housekeeping' AND id = tasks.user_id)
  ))
);

CREATE POLICY "Only admin and reception can delete tasks" ON public.tasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role IN ('admin', 'reception'))
);

-- RLS Policies for work_logs table
CREATE POLICY "Users can view their own work logs" ON public.work_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND (
    role IN ('admin', 'reception') OR 
    (role = 'housekeeping' AND id = work_logs.user_id)
  ))
);

CREATE POLICY "Reception and admin can manage work logs" ON public.work_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role IN ('admin', 'reception'))
);

-- Triggers for auto-calculating task times
CREATE OR REPLACE FUNCTION calculate_task_times()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate actual time when task is stopped
  IF NEW.stop_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.actual_time := EXTRACT(EPOCH FROM (NEW.stop_time - NEW.start_time))::INTEGER / 60 - COALESCE(NEW.total_pause, 0);
    
    -- Calculate difference from time limit
    IF NEW.time_limit IS NOT NULL THEN
      NEW.difference := NEW.actual_time - NEW.time_limit;
    END IF;
  END IF;
  
  -- Update timestamp
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_times_trigger
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION calculate_task_times();

-- Function to auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'housekeeping')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_logs;

-- Insert some default data
-- Default time limits
INSERT INTO public.limits (group_type, cleaning_type, guest_count, time_limit) VALUES
  ('P1', 'W', 1, 30),
  ('P1', 'W', 2, 35),
  ('P1', 'P', 2, 20),
  ('P2', 'W', 1, 35),
  ('P2', 'W', 2, 40),
  ('P2', 'P', 2, 25),
  ('A1S', 'W', 1, 25),
  ('A1S', 'W', 2, 30),
  ('A1S', 'P', 2, 15),
  ('A2S', 'W', 1, 30),
  ('A2S', 'W', 2, 35),
  ('A2S', 'P', 2, 20),
  ('OTHER', 'W', 1, 40),
  ('OTHER', 'W', 2, 50),
  ('OTHER', 'T', 1, 30),
  ('OTHER', 'O', 1, 25),
  ('OTHER', 'G', 1, 20),
  ('OTHER', 'S', 1, 15);

-- Sample rooms
INSERT INTO public.rooms (name, group_type, capacity, color) VALUES
  ('P101', 'P1', 2, '#E5E7EB'),
  ('P102', 'P1', 2, '#E5E7EB'),
  ('P201', 'P2', 2, '#FED7AA'),
  ('P202', 'P2', 2, '#FED7AA'),
  ('A101', 'A1S', 2, '#BBF7D0'),
  ('A102', 'A1S', 2, '#BBF7D0'),
  ('A201', 'A2S', 2, '#BFDBFE'),
  ('A202', 'A2S', 2, '#BFDBFE'),
  ('Lobby', 'OTHER', 0, '#E9D5FF'),
  ('Gym', 'OTHER', 0, '#E9D5FF');