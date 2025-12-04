/*
  # Add Packet Pickups and Revenue Tracking to Daily Deliveries

  1. New Columns in `daily_deliveries`
    - `packets_pickuped` (integer, default: 0)
    - `profit_per_packet_pickup` (numeric, optional - allows per-entry override)
    - `revenue` (numeric, optional - cached for faster reporting)
  
  2. Purpose
    - Track both delivered and picked-up packets
    - Support different profit margins for pickups vs deliveries
    - Store computed revenue for efficient reporting
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_deliveries' AND column_name = 'packets_pickuped'
  ) THEN
    ALTER TABLE daily_deliveries
      ADD COLUMN packets_pickuped integer DEFAULT 0,
      ADD COLUMN profit_per_packet_pickup numeric(10,2) NULL,
      ADD COLUMN revenue numeric(14,2) NULL;
  END IF;
END $$;