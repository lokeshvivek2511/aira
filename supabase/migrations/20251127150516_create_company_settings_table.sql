/*
  # Create Company Settings Table

  1. New Tables
    - `company_settings`
      - `id` (uuid, primary key)
      - `company_name` (text, default: "AIRA Logistics")
      - `profit_per_packet` (numeric, required, default: 50)
      - `currency` (text, default: "₹")
      - `financial_year_start_month` (integer)
      - `financial_year_start_date` (integer)
      - `updated_at` (timestamptz)
      - `updated_by` (text)
  
  2. Security
    - Enable RLS on `company_settings` table
    - Add policies for authenticated users
  
  3. Initial Data
    - Insert default company settings
*/

CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text DEFAULT 'AIRA Logistics',
  profit_per_packet numeric NOT NULL DEFAULT 50,
  currency text DEFAULT '₹',
  financial_year_start_month integer DEFAULT 4,
  financial_year_start_date integer DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  updated_by text
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO company_settings (company_name, profit_per_packet, currency, financial_year_start_month, financial_year_start_date)
VALUES ('AIRA Logistics', 50, '₹', 4, 1)
ON CONFLICT DO NOTHING;