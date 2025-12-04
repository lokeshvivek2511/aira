/*
  # Add Profit Per Packet Pickup to Company Settings

  1. New Column in `company_settings`
    - `profit_per_packet_pickup` (numeric, default: 0)
  
  2. Purpose
    - Global default for profit margin on picked-up packets
    - Can be overridden per delivery entry if needed
    - Allows different profit strategy for pickups vs deliveries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'profit_per_packet_pickup'
  ) THEN
    ALTER TABLE company_settings
      ADD COLUMN profit_per_packet_pickup numeric(10,2) DEFAULT 0;
  END IF;
END $$;