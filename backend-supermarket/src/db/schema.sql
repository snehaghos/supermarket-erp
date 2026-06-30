-- Supermarket Inventory - Schema Migration
-- Run this script to create the required tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Units table
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  symbol VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Packaging', 'Quantity', 'Weight', 'Volume', 'Length')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversions table
CREATE TABLE IF NOT EXISTS conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  child_unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  factor NUMERIC(15, 6) NOT NULL CHECK (factor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_conversion_pair UNIQUE (parent_unit_id, child_unit_id),
  CONSTRAINT ck_different_units CHECK (parent_unit_id != child_unit_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversions_parent ON conversions(parent_unit_id);
CREATE INDEX IF NOT EXISTS idx_conversions_child ON conversions(child_unit_id);
CREATE INDEX IF NOT EXISTS idx_units_type ON units(type);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);

-- Seed data: Units
INSERT INTO units (id, name, symbol, type, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Box', 'bx', 'Packaging', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'Strip', 'st', 'Packaging', 'active'),
  ('00000000-0000-0000-0000-000000000003', 'Tablet', 'tab', 'Quantity', 'active'),
  ('00000000-0000-0000-0000-000000000004', 'Kilogram', 'kg', 'Weight', 'active'),
  ('00000000-0000-0000-0000-000000000005', 'Gram', 'g', 'Weight', 'active'),
  ('00000000-0000-0000-0000-000000000006', 'Liter', 'L', 'Volume', 'active'),
  ('00000000-0000-0000-0000-000000000007', 'Meter', 'm', 'Length', 'inactive')
ON CONFLICT (id) DO NOTHING;

-- Seed data: Conversions
INSERT INTO conversions (parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 10),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 10),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 1000)
ON CONFLICT (parent_unit_id, child_unit_id) DO NOTHING;
