/*
  # Create Company Common Expenses Table

  1. New Table
    - `company_common_expenses`
      - `id` (uuid, primary key)
      - `expense_date` (date, required, indexed)
      - `category` (text, required)
      - `amount` (numeric, required, >= 0)
      - `description` (text, optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Purpose
    - Track company-level daily expenses
    - Not tied to individual employees
    - Subtracted from company profit
  
  3. Security
    - Enable RLS on `company_common_expenses` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS company_common_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL,
  category text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_common_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view company expenses"
  ON company_common_expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert company expenses"
  ON company_common_expenses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update company expenses"
  ON company_common_expenses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete company expenses"
  ON company_common_expenses FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_company_common_expenses_date ON company_common_expenses(expense_date);