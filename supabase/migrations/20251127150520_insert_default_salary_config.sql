/*
  # Insert Default Salary Configuration

  1. Initial Data
    - Insert a default salary configuration with:
      - Base salary: 15000
      - Default allowances (Travel, Mobile)
      - Commission per packet: 10
      - Target levels (Bronze, Silver, Gold)
*/

INSERT INTO salary_configurations (
  base_salary,
  allowances,
  commission_per_packet,
  target_levels,
  is_active,
  effective_from
)
VALUES (
  15000,
  '[
    {"name": "Travel Allowance", "amount": 500},
    {"name": "Mobile Allowance", "amount": 300}
  ]'::jsonb,
  10,
  '[
    {"levelName": "Bronze", "targetPackets": 500, "incentiveAmount": 2000},
    {"levelName": "Silver", "targetPackets": 800, "incentiveAmount": 5000},
    {"levelName": "Gold", "targetPackets": 1000, "incentiveAmount": 10000}
  ]'::jsonb,
  true,
  CURRENT_DATE
)
ON CONFLICT DO NOTHING;