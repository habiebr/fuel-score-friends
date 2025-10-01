-- Create marathon events table
CREATE TABLE public.marathon_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT NOT NULL,
  country TEXT NOT NULL,
  distance TEXT NOT NULL,
  event_url TEXT,
  description TEXT,
  registration_deadline DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marathon_events ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read marathon events
CREATE POLICY "Marathon events are viewable by everyone"
  ON public.marathon_events
  FOR SELECT
  USING (true);

-- Create index for faster date queries
CREATE INDEX idx_marathon_events_date ON public.marathon_events(event_date);
CREATE INDEX idx_marathon_events_country ON public.marathon_events(country);

-- Insert sample marathon events in Indonesia
INSERT INTO public.marathon_events (event_name, event_date, location, country, distance, event_url, description, registration_deadline) VALUES
('Jakarta Marathon', '2025-10-26', 'Jakarta', 'Indonesia', 'Full Marathon, Half Marathon, 10K', 'https://jakartamarathon.com', 'The biggest marathon event in Jakarta with routes through the city''s iconic landmarks.', '2025-10-15'),
('Bali Marathon', '2025-08-17', 'Bali', 'Indonesia', 'Full Marathon, Half Marathon, 10K, 5K', 'https://balimarathon.com', 'Run through the beautiful landscapes of Bali with beach and temple views.', '2025-08-01'),
('Borobudur Marathon', '2025-11-23', 'Magelang', 'Indonesia', 'Full Marathon, Half Marathon, 10K, 5K', 'https://borobudurmarathon.com', 'Experience running around the magnificent Borobudur Temple.', '2025-11-10'),
('Surabaya Marathon', '2025-11-09', 'Surabaya', 'Indonesia', 'Full Marathon, Half Marathon, 10K', NULL, 'East Java''s premier running event through the city of heroes.', '2025-10-25'),
('Mandalika Lombok Marathon', '2025-09-14', 'Lombok', 'Indonesia', 'Full Marathon, Half Marathon, 10K', NULL, 'Run on the beautiful Mandalika circuit with stunning coastal views.', '2025-09-01');

-- Insert sample international marathon events
INSERT INTO public.marathon_events (event_name, event_date, location, country, distance, event_url, description, registration_deadline) VALUES
('Tokyo Marathon', '2026-03-01', 'Tokyo', 'Japan', 'Full Marathon', 'https://www.marathon.tokyo', 'One of the World Marathon Majors, featuring Tokyo''s modern cityscape.', '2025-08-31'),
('Berlin Marathon', '2025-09-28', 'Berlin', 'Germany', 'Full Marathon', 'https://www.bmw-berlin-marathon.com', 'Known for its fast, flat course and world record potential.', '2025-04-30'),
('London Marathon', '2026-04-26', 'London', 'United Kingdom', 'Full Marathon', 'https://www.londonmarathon.com', 'One of the most iconic marathons passing London''s famous landmarks.', '2025-10-31'),
('New York City Marathon', '2025-11-02', 'New York', 'United States', 'Full Marathon', 'https://www.tcsnycmarathon.org', 'The world''s largest marathon through all five NYC boroughs.', '2025-03-31'),
('Singapore Marathon', '2025-12-07', 'Singapore', 'Singapore', 'Full Marathon, Half Marathon, 10K', 'https://www.singaporemarathon.com', 'Southeast Asia''s premier night marathon event.', '2025-11-15'),
('Hong Kong Marathon', '2026-02-15', 'Hong Kong', 'Hong Kong', 'Full Marathon, Half Marathon, 10K', 'https://www.hkmarathon.com', 'Run through the vibrant streets and waterfronts of Hong Kong.', '2025-12-31'),
('Gold Coast Marathon', '2025-07-06', 'Gold Coast', 'Australia', 'Full Marathon, Half Marathon, 10K', 'https://goldcoastmarathon.com.au', 'IAAF Gold Label road race along Australia''s stunning coastline.', '2025-06-15');