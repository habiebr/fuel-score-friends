-- Complete migration for goals and training plan functionality
-- This migration adds all necessary columns and updates for the two-step goals flow

-- Add missing goal-related fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_date DATE,
ADD COLUMN IF NOT EXISTS fitness_level TEXT;

-- Create marathon_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.marathon_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT NOT NULL,
  country TEXT NOT NULL,
  distance TEXT NOT NULL,
  event_url TEXT,
  description TEXT,
  registration_deadline DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on marathon_events
ALTER TABLE public.marathon_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for marathon_events (public read access)
CREATE POLICY "Anyone can view marathon events" 
ON public.marathon_events FOR SELECT 
USING (true);

-- Insert some sample marathon events
INSERT INTO public.marathon_events (event_name, event_date, location, country, distance, event_url, description) VALUES
('Jakarta Marathon', '2024-12-15', 'Jakarta', 'Indonesia', '42.2K', 'https://jakartamarathon.com', 'Annual marathon in the heart of Jakarta'),
('Bali Marathon', '2024-11-10', 'Bali', 'Indonesia', '42.2K', 'https://balimarathon.com', 'Scenic marathon through Bali landscapes'),
('Singapore Marathon', '2024-12-01', 'Singapore', 'Singapore', '42.2K', 'https://singaporemarathon.com', 'International marathon in Singapore'),
('Tokyo Marathon', '2025-03-02', 'Tokyo', 'Japan', '42.2K', 'https://tokyomarathon.com', 'One of the World Marathon Majors'),
('Boston Marathon', '2025-04-21', 'Boston', 'USA', '42.2K', 'https://bostonmarathon.com', 'Historic marathon in Boston'),
('London Marathon', '2025-04-27', 'London', 'UK', '42.2K', 'https://londonmarathon.com', 'Another World Marathon Major'),
('Berlin Marathon', '2025-09-28', 'Berlin', 'Germany', '42.2K', 'https://berlinmarathon.com', 'Fast course in Berlin'),
('New York Marathon', '2025-11-02', 'New York', 'USA', '42.2K', 'https://nycmarathon.com', 'The biggest marathon in the world')
ON CONFLICT DO NOTHING;

-- Add trigger for marathon_events updated_at
CREATE TRIGGER update_marathon_events_updated_at
BEFORE UPDATE ON public.marathon_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Verify the migration
SELECT 'Migration completed successfully' as status;

