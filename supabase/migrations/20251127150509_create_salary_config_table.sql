/*
  # Create Salary Configuration Table

  1. New Tables
    - `salary_configurations`
      - `id` (uuid, primary key)
      - `base_salary` (numeric, required)
      - `allowances` (jsonb, array of {name, amount})
      - `commission_per_packet` (numeric, required)
      - `target_levels` (jsonb, array of {level_name, target_packets, incentive_amount})
      - `effective_from` (date)
      - `effective_to` (date, nullable)
      - `is_active` (boolean, default: true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `salary_configurations` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS salary_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_salary numeric NOT NULL DEFAULT 15000,
  allowances jsonb DEFAULT '[]'::jsonb,
  commission_per_packet numeric NOT NULL DEFAULT 10,
  target_levels jsonb DEFAULT '[]'::jsonb,
  effective_from date DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE salary_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view salary configurations"
  ON salary_configurations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert salary configurations"
  ON salary_configurations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update salary configurations"
  ON salary_configurations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete salary configurations"
  ON salary_configurations FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_salary_config_active ON salary_configurations(is_active) WHERE is_active = true;