PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- UNITS
-- ============================================================
-- type field also serves as the unit category.
-- Only units with the same type can be converted between each other.
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  symbol VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Count', 'Weight', 'Volume', 'Length', 'Area', 'Packaging')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- CONVERSIONS
-- ============================================================
-- A conversion defines: 1 parent_unit = factor × child_unit
-- e.g. 1 Kilogram = 1000 Gram  =>  parent=Kilogram, child=Gram, factor=1000
-- Chain resolution: Box → Strip → Tablet  is achieved by walking parent → child links
CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY,
  parent_unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  child_unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  factor REAL NOT NULL CHECK (factor > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT uq_conversion_pair UNIQUE (parent_unit_id, child_unit_id),
  CONSTRAINT ck_different_units CHECK (parent_unit_id != child_unit_id)
);

-- ============================================================
-- PRODUCTS
-- ============================================================
-- Master product table.
-- inventory_quantity is ALWAYS stored in the base unit.
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  sku VARCHAR(100) NOT NULL UNIQUE,
  barcode VARCHAR(100) DEFAULT '',
  brand VARCHAR(255) DEFAULT '',
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  
  -- The base unit: ALL inventory is stored in this unit
  base_unit_id TEXT NOT NULL REFERENCES units(id),
  
  -- Default purchase unit (must be convertible to base unit for this product)
  purchase_unit_id TEXT REFERENCES units(id),
  
  -- Default selling unit (must be convertible to base unit for this product)
  selling_unit_id TEXT REFERENCES units(id),
  
  -- Pricing (stored in the purchase/selling units respectively)
  purchase_price REAL NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  selling_price REAL NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  mrp REAL NOT NULL DEFAULT 0,
  tax_class TEXT NOT NULL DEFAULT '',
  
  -- Minimum stock level (in base unit) - triggers reorder alerts
  min_stock REAL NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  
  -- Maximum stock level (in base unit) - overstock warning
  max_stock REAL NOT NULL DEFAULT 0 CHECK (max_stock >= 0),

  -- Reorder level (in base unit) - when to reorder
  reorder_level REAL NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  
  -- Opening stock (in base unit) - set once at product creation
  opening_stock REAL NOT NULL DEFAULT 0 CHECK (opening_stock >= 0),
  
  -- Current stock is ALWAYS in base unit
  current_stock REAL NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  
  -- Batch/Expiry/Serial tracking flags
  track_batch INTEGER NOT NULL DEFAULT 0,
  track_expiry INTEGER NOT NULL DEFAULT 0,
  track_serial INTEGER NOT NULL DEFAULT 0,

  -- Default batch number format/prefix
  batch_number_format TEXT DEFAULT '',

  -- Manufacturing date field label
  manufacturing_date_field TEXT DEFAULT '',

  -- Expiry date field label
  expiry_date_field TEXT DEFAULT '',

  -- Serial number format description and validation pattern
  serial_format TEXT DEFAULT '',
  serial_validation TEXT DEFAULT '',

  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_base_unit ON products(base_unit_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ============================================================
-- PRODUCT UNITS
-- ============================================================
-- Links multiple units to a product for purchasing/selling.
-- Each product-unit link stores the conversion factor to the base unit.
-- factor_to_base = how many base units equal 1 of this unit
-- e.g. for Sugar: base=Gram, unit=Kilogram => factor_to_base=1000
CREATE TABLE IF NOT EXISTS product_units (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id),
  
  -- Conversion factor: 1 of this unit = factor_to_base base units
  -- For example: 1 Kilogram = 1000 Grams  => factor_to_base = 1000
  factor_to_base REAL NOT NULL CHECK (factor_to_base > 0),
  
  -- Is this the default purchase unit for this product?
  is_purchase_unit INTEGER NOT NULL DEFAULT 0,
  
  -- Is this the default selling unit for this product?
  is_selling_unit INTEGER NOT NULL DEFAULT 0,
  
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  CONSTRAINT uq_product_unit UNIQUE (product_id, unit_id),
  CONSTRAINT ck_at_least_one_role CHECK (is_purchase_unit = 1 OR is_selling_unit = 1)
);

CREATE INDEX IF NOT EXISTS idx_product_units_product ON product_units(product_id);
CREATE INDEX IF NOT EXISTS idx_product_units_unit ON product_units(unit_id);



-- ============================================================
-- INVENTORY TRANSACTIONS (Audit log)
-- ============================================================
-- Every stock movement is recorded here.
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'sale', 'adjustment', 'opening_stock', 'return')),
  
  -- The unit used in this transaction (might be purchase unit, selling unit, or base unit)
  unit_id TEXT NOT NULL REFERENCES units(id),
  
  -- Quantity in the unit used (the human-readable unit)
  unit_quantity REAL NOT NULL,
  
  -- Quantity converted to base unit (what actually affects stock)
  base_quantity REAL NOT NULL,
  
  -- Stock before this transaction (in base unit)
  previous_stock REAL NOT NULL,
  
  -- Stock after this transaction (in base unit)
  remaining_stock REAL NOT NULL,
  
  -- Reference to purchase/sale/adjustment record
  reference_type VARCHAR(50),
  reference_id VARCHAR(255),
  
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON inventory_transactions(created_at);

-- ============================================================
-- PURCHASES
-- ============================================================
-- Purchase order records
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  purchase_number VARCHAR(100) NOT NULL UNIQUE,
  supplier_name VARCHAR(255) DEFAULT '',
  notes TEXT DEFAULT '',
  total_items INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- PURCHASE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  quantity REAL NOT NULL CHECK (quantity > 0),
  base_quantity REAL NOT NULL CHECK (base_quantity > 0),
  unit_price REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);

-- ============================================================
-- SALES
-- ============================================================
-- Sales order records
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  sale_number VARCHAR(100) NOT NULL UNIQUE,
  customer_name VARCHAR(255) DEFAULT '',
  notes TEXT DEFAULT '',
  total_items INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- SALE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  quantity REAL NOT NULL CHECK (quantity > 0),
  base_quantity REAL NOT NULL CHECK (base_quantity > 0),
  unit_price REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- ============================================================
-- PRODUCT-SPECIFIC CONVERSIONS
-- ============================================================
-- Allows overriding global conversion factors for a specific product.
-- When computing factor_to_base for a product, these are checked first.
-- Example: For a Rice product, 1 Bag = 50 Kg (product-specific),
-- while globally 1 Bag is just a packaging unit with no default weight.
CREATE TABLE IF NOT EXISTS product_conversions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_unit_id TEXT NOT NULL REFERENCES units(id),
  to_unit_id TEXT NOT NULL REFERENCES units(id),
  conversion_factor REAL NOT NULL CHECK (conversion_factor > 0),
  relationship_text TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT uq_product_conversion_pair UNIQUE (product_id, from_unit_id, to_unit_id),
  CONSTRAINT ck_product_conv_diff CHECK (from_unit_id != to_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_product_conversions_product ON product_conversions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_conversions_from ON product_conversions(from_unit_id);
CREATE INDEX IF NOT EXISTS idx_product_conversions_to ON product_conversions(to_unit_id);

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================
-- Supports multiple images per product with ordering and primary designation
CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  original_name TEXT DEFAULT '',
  mime_type TEXT DEFAULT '',
  file_size INTEGER DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_conversions_parent ON conversions(parent_unit_id);
CREATE INDEX IF NOT EXISTS idx_conversions_child ON conversions(child_unit_id);
CREATE INDEX IF NOT EXISTS idx_units_type ON units(type);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);

-- ============================================================
-- SEED UNITS
-- ============================================================
INSERT OR IGNORE INTO units (id, name, symbol, type, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Box', 'BOX', 'Packaging', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'Strip', 'ST', 'Packaging', 'active'),
  ('00000000-0000-0000-0000-000000000003', 'Tablet', 'TAB', 'Count', 'active'),
  ('00000000-0000-0000-0000-000000000004', 'Kilogram', 'KGS', 'Weight', 'active'),
  ('00000000-0000-0000-0000-000000000005', 'Gram', 'GMS', 'Weight', 'active'),
  ('00000000-0000-0000-0000-000000000006', 'Liter', 'LTR', 'Volume', 'active'),
  ('00000000-0000-0000-0000-000000000007', 'Meter', 'MTR', 'Length', 'inactive'),
  ('00000000-0000-0000-0000-00000000000b', 'Pieces', 'PCS', 'Count', 'active'),
  ('00000000-0000-0000-0000-00000000000c', 'Dozen', 'DOZ', 'Count', 'active'),
  ('00000000-0000-0000-0000-00000000000d', 'Set', 'SET', 'Count', 'active'),
  ('00000000-0000-0000-0000-00000000000e', 'Tonne', 'TNS', 'Weight', 'active'),
  ('00000000-0000-0000-0000-00000000000f', 'Milliliter', 'MLT', 'Volume', 'active'),
  ('00000000-0000-0000-0000-000000000010', 'Cubic Meter', 'CBM', 'Volume', 'active'),
  ('00000000-0000-0000-0000-000000000011', 'Centimeter', 'CMT', 'Length', 'active'),
  ('00000000-0000-0000-0000-000000000012', 'Square Meter', 'SQM', 'Area', 'active'),
  ('00000000-0000-0000-0000-000000000013', 'Bag', 'BAG', 'Packaging', 'active'),
  ('00000000-0000-0000-0000-000000000014', 'Bottle', 'BTL', 'Packaging', 'active');



-- Seed default categories for reference
INSERT OR IGNORE INTO units (id, name, symbol, type, status) VALUES
  ('00000000-0000-0000-0000-000000000015', 'Milligram', 'MG', 'Weight', 'active'),
  ('00000000-0000-0000-0000-000000000016', 'Carton', 'CTN', 'Packaging', 'active'),
  ('00000000-0000-0000-0000-000000000017', 'Piece', 'PCE', 'Count', 'active');

-- ============================================================
-- SEED STANDARD CONVERSIONS
-- ============================================================
-- Weight chain: Tonne → Kilogram → Gram → Milligram
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000001', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 1000),
  ('00000000-0000-0000-0000-00000a000002', '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000004', 1000),
  ('00000000-0000-0000-0000-00000a000003', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000015', 1000);

-- Volume chain: Cubic Meter → Liter → Milliliter
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000004', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000006', 1000),
  ('00000000-0000-0000-0000-00000a000005', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000f', 1000);

-- Length chain: Meter → Centimeter
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000006', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000011', 100);

-- Count chain: Dozen → Pieces, Set → Pieces
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000007', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b', 12),
  ('00000000-0000-0000-0000-00000a000008', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b', 1);

-- Packaging chain: Carton → Box → Strip → Tablet (for medicine)
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000009', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 20),
  ('00000000-0000-0000-0000-00000a00000a', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 10),
  ('00000000-0000-0000-0000-00000a00000b', '00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 12);


