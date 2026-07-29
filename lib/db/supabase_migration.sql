-- 1. Create vehicle_locations table if it does not exist
CREATE TABLE IF NOT EXISTS vehicle_locations (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed REAL,
  heading REAL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_id ON vehicle_locations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_plate_number ON vehicle_locations(plate_number);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE vehicle_locations ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Allow public read access to vehicle locations" ON vehicle_locations;
DROP POLICY IF EXISTS "Allow insert/update for authenticated users" ON vehicle_locations;

-- 5. Create RLS Policies
-- Allow anyone (public/anonymous) to read vehicle locations so maps can display them
CREATE POLICY "Allow public read access to vehicle locations" 
ON vehicle_locations 
FOR SELECT 
USING (true);

-- Allow authenticated users (e.g. driver apps, devices, or APIs using service role keys)
-- to perform CRUD operations on vehicle locations
CREATE POLICY "Allow insert/update for authenticated users" 
ON vehicle_locations 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 6. Enable Supabase Realtime (WebSocket pub/sub) for this table
BEGIN;
  -- Remove the table from the realtime publication first if it's already there to prevent duplicates
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS vehicle_locations;
  -- Add the table to the supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_locations;
COMMIT;

-- 7. Trigger to automatically update updated_at timestamp on updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_vehicle_locations_updated_at ON vehicle_locations;

CREATE TRIGGER trg_update_vehicle_locations_updated_at
BEFORE UPDATE ON vehicle_locations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 8. Add unfrozen_at column to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS unfrozen_at TIMESTAMP WITH TIME ZONE;

-- 9. Create gps_logs table if it does not exist
CREATE TABLE IF NOT EXISTS gps_logs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  trip_id INTEGER REFERENCES trip_logs(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed REAL,
  heading REAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for fast retrieval of coordinates per trip
CREATE INDEX IF NOT EXISTS idx_gps_logs_trip_id ON gps_logs(trip_id);

-- Enable Row Level Security (RLS)
ALTER TABLE gps_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DROP POLICY IF EXISTS "Allow authenticated read for gps logs" ON gps_logs;
CREATE POLICY "Allow authenticated read for gps logs" 
ON gps_logs 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Allow authenticated inserts for gps logs" ON gps_logs;
CREATE POLICY "Allow authenticated inserts for gps logs" 
ON gps_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 10. Add current_stop_index column to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_stop_index INTEGER DEFAULT 0;

