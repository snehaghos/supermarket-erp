PRAGMA journal_mode = WAL;
-- NOTE: PRAGMA foreign_keys = ON is set at the application level (db/index.ts)
-- and is intentionally omitted here to allow migration scripts to safely
-- execute seed data INSERTs across FK-referenced tables.
-- The FK constraints are still defined on table creation and will be enforced
-- once the application connection sets the pragma.

-- ============================================================
-- MEASUREMENT TYPES
-- ============================================================
CREATE TABLE IF NOT EXISTS measurement_types (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- UNITS
-- ============================================================
-- Each unit belongs to exactly one measurement type.
-- The is_packaging flag marks units that require product-specific conversions
-- (e.g., Box, Carton, Case, Strip, Pack, Pallet, Bundle, Crate).
-- Only units with the same measurement_type_id can be converted between each other
-- (unless a valid product-specific packaging conversion exists).
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  symbol VARCHAR(50) NOT NULL,
  measurement_type_id TEXT NOT NULL REFERENCES measurement_types(id),
  type VARCHAR(50) NOT NULL DEFAULT '',
  is_packaging INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_units_measurement_type ON units(measurement_type_id);
CREATE INDEX IF NOT EXISTS idx_units_type ON units(type);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);

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

-- ============================================================
-- SEED MEASUREMENT TYPES
-- ============================================================
INSERT OR IGNORE INTO measurement_types (id, name, description, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000101', 'Weight',      'Mass and weight measurements', 1),
  ('00000000-0000-0000-0000-000000000102', 'Length',      'Distance and length measurements', 2),
  ('00000000-0000-0000-0000-000000000103', 'Volume',      'Volume and capacity measurements', 3),
  ('00000000-0000-0000-0000-000000000104', 'Count',       'Piece count and quantity measurements', 4),
  ('00000000-0000-0000-0000-000000000105', 'Area',        'Area and surface measurements', 5),
  ('00000000-0000-0000-0000-000000000106', 'Time',        'Time duration measurements', 6),
  ('00000000-0000-0000-0000-000000000107', 'Temperature', 'Temperature measurements', 7),
  ('00000000-0000-0000-0000-000000000108', 'Energy',      'Energy and calorie measurements', 8),
  ('00000000-0000-0000-0000-000000000109', 'Digital',     'Digital storage measurements', 9),
  ('00000000-0000-0000-0000-00000000010a', 'Packaging',   'Packaging units (require product-specific conversions)', 10);

-- ============================================================
-- SEED UNITS
-- ============================================================
-- Weight units
INSERT OR IGNORE INTO units (id, name, symbol, measurement_type_id, type, is_packaging, status) VALUES
  ('00000000-0000-0000-0000-000000000015', 'Milligram', 'mg',  '00000000-0000-0000-0000-000000000101', 'Weight', 0, 'active'),
  ('00000000-0000-0000-0000-000000000005', 'Gram',      'g',   '00000000-0000-0000-0000-000000000101', 'Weight', 0, 'active'),
  ('00000000-0000-0000-0000-000000000004', 'Kilogram',  'kg',  '00000000-0000-0000-0000-000000000101', 'Weight', 0, 'active'),
  ('00000000-0000-0000-0000-00000000000e', 'Tonne',     't',   '00000000-0000-0000-0000-000000000101', 'Weight', 0, 'active'),
  ('00000000-0000-0000-0000-000000000201', 'Quintal',   'ql',  '00000000-0000-0000-0000-000000000101', 'Weight', 0, 'active'),
  ('00000000-0000-0000-0000-000000000202', 'Ounce',     'oz',  '00000000-0000-0000-0000-000000000101', 'Weight', 0, 'active'),
  ('00000000-0000-0000-0000-000000000203', 'Pound',     'lb',  '00000000-0000-0000-0000-000000000101', 'Weight', 0, 'active'),
  ('00000000-0000-0000-0000-000000000204', 'Stone',     'st',  '00000000-0000-0000-0000-000000000101', 'Weight', 0, 'active');

-- Length units
INSERT OR IGNORE INTO units (id, name, symbol, measurement_type_id, type, is_packaging, status) VALUES
  ('00000000-0000-0000-0000-000000000211', 'Millimeter', 'mm', '00000000-0000-0000-0000-000000000102', 'Length', 0, 'active'),
  ('00000000-0000-0000-0000-000000000011', 'Centimeter', 'cm', '00000000-0000-0000-0000-000000000102', 'Length', 0, 'active'),
  ('00000000-0000-0000-0000-000000000007', 'Meter',      'm',  '00000000-0000-0000-0000-000000000102', 'Length', 0, 'active'),
  ('00000000-0000-0000-0000-000000000212', 'Kilometer',  'km', '00000000-0000-0000-0000-000000000102', 'Length', 0, 'active'),
  ('00000000-0000-0000-0000-000000000213', 'Inch',       'in', '00000000-0000-0000-0000-000000000102', 'Length', 0, 'active'),
  ('00000000-0000-0000-0000-000000000214', 'Foot',       'ft', '00000000-0000-0000-0000-000000000102', 'Length', 0, 'active'),
  ('00000000-0000-0000-0000-000000000215', 'Yard',       'yd', '00000000-0000-0000-0000-000000000102', 'Length', 0, 'active'),
  ('00000000-0000-0000-0000-000000000216', 'Mile',       'mi', '00000000-0000-0000-0000-000000000102', 'Length', 0, 'active');

-- Volume units
INSERT OR IGNORE INTO units (id, name, symbol, measurement_type_id, type, is_packaging, status) VALUES
  ('00000000-0000-0000-0000-00000000000f', 'Milliliter',     'ml',  '00000000-0000-0000-0000-000000000103', 'Volume', 0, 'active'),
  ('00000000-0000-0000-0000-000000000221', 'Centiliter',     'cl',  '00000000-0000-0000-0000-000000000103', 'Volume', 0, 'active'),
  ('00000000-0000-0000-0000-000000000222', 'Deciliter',      'dl',  '00000000-0000-0000-0000-000000000103', 'Volume', 0, 'active'),
  ('00000000-0000-0000-0000-000000000006', 'Liter',          'L',   '00000000-0000-0000-0000-000000000103', 'Volume', 0, 'active'),
  ('00000000-0000-0000-0000-000000000010', 'Cubic Meter',    'm³',  '00000000-0000-0000-0000-000000000103', 'Volume', 0, 'active'),
  ('00000000-0000-0000-0000-000000000223', 'Teaspoon',       'tsp', '00000000-0000-0000-0000-000000000103', 'Volume', 0, 'active'),
  ('00000000-0000-0000-0000-000000000224', 'Tablespoon',     'tbsp','00000000-0000-0000-0000-000000000103', 'Volume', 0, 'active'),
  ('00000000-0000-0000-0000-000000000225', 'Cup',            'cup', '00000000-0000-0000-0000-000000000103', 'Volume', 0, 'active'),
  ('00000000-0000-0000-0000-000000000226', 'Pint',           'pt',  '00000000-0000-0000-0000-000000000103', 'Volume', 0, 'active'),
  ('00000000-0000-0000-0000-000000000227', 'Quart',          'qt',  '00000000-0000-0000-0000-000000000103', 'Volume', 0, 'active'),
  ('00000000-0000-0000-0000-000000000228', 'Gallon',         'gal', '00000000-0000-0000-0000-000000000103', 'Volume', 0, 'active');

-- Count units
INSERT OR IGNORE INTO units (id, name, symbol, measurement_type_id, type, is_packaging, status) VALUES
  ('00000000-0000-0000-0000-000000000017', 'Piece',  'pce', '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active'),
  ('00000000-0000-0000-0000-00000000000b', 'Pieces', 'pcs', '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active'),
  ('00000000-0000-0000-0000-00000000000c', 'Dozen',  'doz', '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active'),
  ('00000000-0000-0000-0000-000000000003', 'Tablet', 'tab', '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active'),
  ('00000000-0000-0000-0000-00000000000d', 'Set',    'set', '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active'),
  ('00000000-0000-0000-0000-000000000231', 'Pair',   'pr',  '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active'),
  ('00000000-0000-0000-0000-000000000232', 'Gross',  'gr',  '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active'),
  ('00000000-0000-0000-0000-000000000233', 'Roll',   'rl',  '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active'),
  ('00000000-0000-0000-0000-000000000234', 'Can',    'can', '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active'),
  ('00000000-0000-0000-0000-000000000235', 'Tube',   'tbe', '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active'),
  ('00000000-0000-0000-0000-000000000236', 'Jar',    'jar', '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active'),
  ('00000000-0000-0000-0000-000000000237', 'Pouch',  'pch', '00000000-0000-0000-0000-000000000104', 'Count', 0, 'active');

-- Area units
INSERT OR IGNORE INTO units (id, name, symbol, measurement_type_id, type, is_packaging, status) VALUES
  ('00000000-0000-0000-0000-000000000241', 'Square Millimeter', 'mm²', '00000000-0000-0000-0000-000000000105', 'Area', 0, 'active'),
  ('00000000-0000-0000-0000-000000000242', 'Square Centimeter', 'cm²', '00000000-0000-0000-0000-000000000105', 'Area', 0, 'active'),
  ('00000000-0000-0000-0000-000000000012', 'Square Meter',      'm²',  '00000000-0000-0000-0000-000000000105', 'Area', 0, 'active'),
  ('00000000-0000-0000-0000-000000000243', 'Hectare',           'ha',  '00000000-0000-0000-0000-000000000105', 'Area', 0, 'active'),
  ('00000000-0000-0000-0000-000000000244', 'Acre',              'ac',  '00000000-0000-0000-0000-000000000105', 'Area', 0, 'active'),
  ('00000000-0000-0000-0000-000000000245', 'Square Foot',       'ft²', '00000000-0000-0000-0000-000000000105', 'Area', 0, 'active'),
  ('00000000-0000-0000-0000-000000000246', 'Square Yard',       'yd²', '00000000-0000-0000-0000-000000000105', 'Area', 0, 'active');

-- Time units
INSERT OR IGNORE INTO units (id, name, symbol, measurement_type_id, type, is_packaging, status) VALUES
  ('00000000-0000-0000-0000-000000000251', 'Second', 's',   '00000000-0000-0000-0000-000000000106', 'Time', 0, 'active'),
  ('00000000-0000-0000-0000-000000000252', 'Minute', 'min', '00000000-0000-0000-0000-000000000106', 'Time', 0, 'active'),
  ('00000000-0000-0000-0000-000000000253', 'Hour',   'h',   '00000000-0000-0000-0000-000000000106', 'Time', 0, 'active'),
  ('00000000-0000-0000-0000-000000000254', 'Day',    'd',   '00000000-0000-0000-0000-000000000106', 'Time', 0, 'active'),
  ('00000000-0000-0000-0000-000000000255', 'Week',   'wk',  '00000000-0000-0000-0000-000000000106', 'Time', 0, 'active'),
  ('00000000-0000-0000-0000-000000000256', 'Month',  'mo',  '00000000-0000-0000-0000-000000000106', 'Time', 0, 'active'),
  ('00000000-0000-0000-0000-000000000257', 'Year',   'yr',  '00000000-0000-0000-0000-000000000106', 'Time', 0, 'active');

-- Temperature units
INSERT OR IGNORE INTO units (id, name, symbol, measurement_type_id, type, is_packaging, status) VALUES
  ('00000000-0000-0000-0000-000000000261', 'Celsius',    '°C', '00000000-0000-0000-0000-000000000107', 'Temperature', 0, 'active'),
  ('00000000-0000-0000-0000-000000000262', 'Fahrenheit', '°F', '00000000-0000-0000-0000-000000000107', 'Temperature', 0, 'active'),
  ('00000000-0000-0000-0000-000000000263', 'Kelvin',     'K',  '00000000-0000-0000-0000-000000000107', 'Temperature', 0, 'active');

-- Energy units
INSERT OR IGNORE INTO units (id, name, symbol, measurement_type_id, type, is_packaging, status) VALUES
  ('00000000-0000-0000-0000-000000000271', 'Joule',        'J',   '00000000-0000-0000-0000-000000000108', 'Energy', 0, 'active'),
  ('00000000-0000-0000-0000-000000000272', 'Kilojoule',    'kJ',  '00000000-0000-0000-0000-000000000108', 'Energy', 0, 'active'),
  ('00000000-0000-0000-0000-000000000273', 'Megajoule',    'MJ',  '00000000-0000-0000-0000-000000000108', 'Energy', 0, 'active'),
  ('00000000-0000-0000-0000-000000000274', 'Watt-hour',    'Wh',  '00000000-0000-0000-0000-000000000108', 'Energy', 0, 'active'),
  ('00000000-0000-0000-0000-000000000275', 'Kilowatt-hour','kWh', '00000000-0000-0000-0000-000000000108', 'Energy', 0, 'active'),
  ('00000000-0000-0000-0000-000000000276', 'Kilocalorie',  'kcal','00000000-0000-0000-0000-000000000108', 'Energy', 0, 'active');

-- Digital units
INSERT OR IGNORE INTO units (id, name, symbol, measurement_type_id, type, is_packaging, status) VALUES
  ('00000000-0000-0000-0000-000000000281', 'Byte', 'B',  '00000000-0000-0000-0000-000000000109', 'Digital', 0, 'active'),
  ('00000000-0000-0000-0000-000000000282', 'KB',   'KB', '00000000-0000-0000-0000-000000000109', 'Digital', 0, 'active'),
  ('00000000-0000-0000-0000-000000000283', 'MB',   'MB', '00000000-0000-0000-0000-000000000109', 'Digital', 0, 'active'),
  ('00000000-0000-0000-0000-000000000284', 'GB',   'GB', '00000000-0000-0000-0000-000000000109', 'Digital', 0, 'active'),
  ('00000000-0000-0000-0000-000000000285', 'TB',   'TB', '00000000-0000-0000-0000-000000000109', 'Digital', 0, 'active');

-- Packaging units (require product-specific conversions)
INSERT OR IGNORE INTO units (id, name, symbol, measurement_type_id, type, is_packaging, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Box',    'box', '00000000-0000-0000-0000-00000000010a', 'Packaging', 1, 'active'),
  ('00000000-0000-0000-0000-000000000002', 'Strip',  'st',  '00000000-0000-0000-0000-00000000010a', 'Packaging', 1, 'active'),
  ('00000000-0000-0000-0000-000000000016', 'Carton', 'ctn', '00000000-0000-0000-0000-00000000010a', 'Packaging', 1, 'active'),
  ('00000000-0000-0000-0000-000000000013', 'Bag',    'bag', '00000000-0000-0000-0000-00000000010a', 'Packaging', 1, 'active'),
  ('00000000-0000-0000-0000-000000000014', 'Bottle', 'btl', '00000000-0000-0000-0000-00000000010a', 'Packaging', 1, 'active'),
  ('00000000-0000-0000-0000-000000000291', 'Pack',   'pk',  '00000000-0000-0000-0000-00000000010a', 'Packaging', 1, 'active'),
  ('00000000-0000-0000-0000-000000000292', 'Case',   'cse', '00000000-0000-0000-0000-00000000010a', 'Packaging', 1, 'active'),
  ('00000000-0000-0000-0000-000000000293', 'Pallet', 'plt', '00000000-0000-0000-0000-00000000010a', 'Packaging', 1, 'active'),
  ('00000000-0000-0000-0000-000000000294', 'Crate',  'crt', '00000000-0000-0000-0000-00000000010a', 'Packaging', 1, 'active'),
  ('00000000-0000-0000-0000-000000000295', 'Bundle', 'bdl', '00000000-0000-0000-0000-00000000010a', 'Packaging', 1, 'active'),
  ('00000000-0000-0000-0000-000000000296', 'Sack',   'sck', '00000000-0000-0000-0000-00000000010a', 'Packaging', 1, 'active');

-- ============================================================
-- SEED STANDARD SI CONVERSIONS ONLY (No packaging conversions)
-- ============================================================
-- Weight chain: Tonne → Kilogram → Gram → Milligram
-- Also: Tonne ↔ Quintal, Ounce → Gram, Pound → Ounce, Stone → Pound
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000001', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 1000),
  ('00000000-0000-0000-0000-00000a000002', '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000004', 1000),
  ('00000000-0000-0000-0000-00000a000003', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000015', 1000),
  ('00000000-0000-0000-0000-00000a000010', '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000201', 10),
  ('00000000-0000-0000-0000-00000a000011', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000004', 100),
  ('00000000-0000-0000-0000-00000a000012', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000202', 16),
  ('00000000-0000-0000-0000-00000a000013', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000203', 14),
  ('00000000-0000-0000-0000-00000a000014', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000005', 28.3495);

-- Volume chain: Cubic Meter → Liter → Milliliter
-- Also: Gallon → Quart → Pint → Cup → Fluid Ounce (US)
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000004', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000006', 1000),
  ('00000000-0000-0000-0000-00000a000005', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000f', 1000),
  ('00000000-0000-0000-0000-00000a000015', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000221', 100),
  ('00000000-0000-0000-0000-00000a000016', '00000000-0000-0000-0000-000000000221', '00000000-0000-0000-0000-000000000222', 10),
  ('00000000-0000-0000-0000-00000a000017', '00000000-0000-0000-0000-000000000228', '00000000-0000-0000-0000-000000000227', 4),
  ('00000000-0000-0000-0000-00000a000018', '00000000-0000-0000-0000-000000000227', '00000000-0000-0000-0000-000000000226', 2),
  ('00000000-0000-0000-0000-00000a000019', '00000000-0000-0000-0000-000000000226', '00000000-0000-0000-0000-000000000225', 2),
  ('00000000-0000-0000-0000-00000a00001a', '00000000-0000-0000-0000-000000000225', '00000000-0000-0000-0000-000000000224', 16),
  ('00000000-0000-0000-0000-00000a00001b', '00000000-0000-0000-0000-000000000224', '00000000-0000-0000-0000-000000000223', 3);

-- Length chain: Kilometer → Meter → Centimeter → Millimeter
-- Also: Mile → Yard → Foot → Inch
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000006', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000011', 100),
  ('00000000-0000-0000-0000-00000a000020', '00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000007', 1000),
  ('00000000-0000-0000-0000-00000a000021', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000211', 10),
  ('00000000-0000-0000-0000-00000a000022', '00000000-0000-0000-0000-000000000216', '00000000-0000-0000-0000-000000000215', 1760),
  ('00000000-0000-0000-0000-00000a000023', '00000000-0000-0000-0000-000000000215', '00000000-0000-0000-0000-000000000214', 3),
  ('00000000-0000-0000-0000-00000a000024', '00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000213', 12);

-- Count chain: Dozen → Piece, Set → Piece, Gross → Dozen
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000007', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000017', 12),
  ('00000000-0000-0000-0000-00000a000008', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000017', 1),
  ('00000000-0000-0000-0000-00000a000030', '00000000-0000-0000-0000-000000000232', '00000000-0000-0000-0000-00000000000c', 12),
  ('00000000-0000-0000-0000-00000a000031', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000231', 6);

-- Area chain: Square Meter → Square Centimeter → Square Millimeter
-- Hectare → Square Meter, Acre → Square Foot
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000040', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000242', 10000),
  ('00000000-0000-0000-0000-00000a000041', '00000000-0000-0000-0000-000000000242', '00000000-0000-0000-0000-000000000241', 100),
  ('00000000-0000-0000-0000-00000a000042', '00000000-0000-0000-0000-000000000243', '00000000-0000-0000-0000-000000000012', 10000),
  ('00000000-0000-0000-0000-00000a000043', '00000000-0000-0000-0000-000000000244', '00000000-0000-0000-0000-000000000245', 43560),
  ('00000000-0000-0000-0000-00000a000044', '00000000-0000-0000-0000-000000000246', '00000000-0000-0000-0000-000000000245', 9);

-- Time chain: Year → Month → Week → Day → Hour → Minute → Second
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000050', '00000000-0000-0000-0000-000000000257', '00000000-0000-0000-0000-000000000256', 12),
  ('00000000-0000-0000-0000-00000a000051', '00000000-0000-0000-0000-000000000256', '00000000-0000-0000-0000-000000000255', 4),
  ('00000000-0000-0000-0000-00000a000052', '00000000-0000-0000-0000-000000000255', '00000000-0000-0000-0000-000000000254', 7),
  ('00000000-0000-0000-0000-00000a000053', '00000000-0000-0000-0000-000000000254', '00000000-0000-0000-0000-000000000253', 24),
  ('00000000-0000-0000-0000-00000a000054', '00000000-0000-0000-0000-000000000253', '00000000-0000-0000-0000-000000000252', 60),
  ('00000000-0000-0000-0000-00000a000055', '00000000-0000-0000-0000-000000000252', '00000000-0000-0000-0000-000000000251', 60);

-- Energy chain: Megajoule → Kilojoule → Joule, Kilowatt-hour → Watt-hour
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000060', '00000000-0000-0000-0000-000000000273', '00000000-0000-0000-0000-000000000272', 1000),
  ('00000000-0000-0000-0000-00000a000061', '00000000-0000-0000-0000-000000000272', '00000000-0000-0000-0000-000000000271', 1000),
  ('00000000-0000-0000-0000-00000a000062', '00000000-0000-0000-0000-000000000275', '00000000-0000-0000-0000-000000000274', 1000);

-- Digital chain: TB → GB → MB → KB → Byte
INSERT OR IGNORE INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES
  ('00000000-0000-0000-0000-00000a000070', '00000000-0000-0000-0000-000000000285', '00000000-0000-0000-0000-000000000284', 1024),
  ('00000000-0000-0000-0000-00000a000071', '00000000-0000-0000-0000-000000000284', '00000000-0000-0000-0000-000000000283', 1024),
  ('00000000-0000-0000-0000-00000a000072', '00000000-0000-0000-0000-000000000283', '00000000-0000-0000-0000-000000000282', 1024),
  ('00000000-0000-0000-0000-00000a000073', '00000000-0000-0000-0000-000000000282', '00000000-0000-0000-0000-000000000281', 1024);
