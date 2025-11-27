/*
  # Create Daily Deliveries Table

  1. New Tables
    - `daily_deliveries`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `delivery_date` (date, required, indexed)
      - `packets_delivered` (integer, required, default: 0, min: 0)
      - `status` (text, enum: pending/completed/verified, default: pending)
      - `notes` (text, optional)
      - `edited_by` (text)
      - `edited_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `daily_deliveries` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS daily_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  delivery_date date NOT NULL,
  packets_delivered integer NOT NULL DEFAULT 0 CHECK (packets_delivered >= 0),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'verified')),
  notes text,
  edited_by text,
  edited_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE daily_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view daily deliveries"
  ON daily_deliveries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert daily deliveries"
  ON daily_deliveries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update daily deliveries"
  ON daily_deliveries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete daily deliveries"
  ON daily_deliveries FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_daily_deliveries_date ON daily_deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_daily_deliveries_employee ON daily_deliveries(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_deliveries_date_employee ON daily_deliveries(delivery_date, employee_id);