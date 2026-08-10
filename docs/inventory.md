# Inventory System — How It Works

## Welcome!

This guide explains how the supermarket inventory system manages **stock levels**.
It covers the whole journey: how a product's stock is created, how purchases and
sales change it, how it's audited, and how the frontend shows it to the user.

If you're new to the codebase, read [unit-conversion.md](./unit-conversion.md)
first — this document builds on top of those concepts.

---

## 🛒 Real-World Example

You run a grocery store. You sell **Sugar** by the **Kilogram** (kg), but you buy
it from your supplier in **5 kg bags**. You also track stock at a finer level in
**Grams** for kitchen-scale accuracy.

- **Base unit:** Gram
- **Purchase unit:** Bag (1 Bag = 5000 Grams for this product)
- **Selling unit:** Kilogram (1 kg = 1000 Grams)

If a customer buys **2 kg of sugar**, the system must know exactly how many Grams
to subtract from stock — **2000**. If you purchase **3 Bags**, it must add
**15000 Grams**.

That's the whole challenge of the inventory system:

> **The user thinks in many units. The database thinks in one — the base unit.**

---

## ⭐ The One Rule That Matters

> **`current_stock` is ALWAYS stored in the base unit.**

Every product has exactly one **base unit** (e.g. `Gram`). All stock math happens
in that unit. Every other unit linked to the product carries a
`factor_to_base` — "how many base units equal 1 of this unit".

| Unit      | `factor_to_base` | Meaning                          |
|-----------|------------------|----------------------------------|
| Gram      | 1                | Base unit (factor is always 1)   |
| Kilogram  | 1000             | 1 kg = 1000 g                    |
| Bag       | 5000             | 1 Bag = 5000 g (for this product)|

**Stock operations never touch the global conversion table.**
They always use the product's **own** `product_units.factor_to_base` value.

---

## How the Database Stores Inventory

The inventory lives in `backend-supermarket/src/db/schema.sql` (SQLite).

### `products` — the master table

Every row is one product. The stock-related columns are:

| Column              | Meaning                                                        |
|---------------------|----------------------------------------------------------------|
| `base_unit_id`      | The unit ALL stock is stored in (FK → `units`)                 |
| `purchase_unit_id`  | Default unit you buy this product in (nullable)                |
| `selling_unit_id`   | Default unit you sell this product in (nullable)               |
| `opening_stock`     | Stock set once at creation (converted to base unit)            |
| `current_stock`     | **Live stock — always in base unit**                           |
| `min_stock`         | Low-stock threshold (base unit) — triggers reorder alerts      |
| `max_stock`         | Overstock threshold (base unit) — overstock warning            |
| `reorder_level`     | When to reorder (base unit)                                    |

### `product_units` — every unit a product can use

Links extra units to a product and stores that product's own conversion factor.

```sql
product_units (
  id, product_id, unit_id,
  factor_to_base,          -- 1 of this unit = factor_to_base base units
  is_purchase_unit,        -- is this the default purchase unit?
  is_selling_unit,         -- is this the default selling unit?
  is_active, ...
)
```

Notes:

- The **base unit is always inserted** with `factor_to_base = 1`.
- `factor_to_base` is **per product**, so the same unit can mean different
  things for different products (e.g. a "Bag" is 5000 g of Sugar but 1000 g
  of Rice). This value is what purchases/sales use for math.
- A unit that is neither purchase nor selling unit (an "additional unit") is
  perfectly fine — it's just an extra unit you can use when buying/selling.

### `product_conversions` — product-scoped conversion graph

Edges of the form **1 `from_unit` = `conversion_factor` × `to_unit`**, scoped to
one product. Together with the purchase/selling factors these edges form a
**graph** the system walks to figure out a factor when the user didn't type one.

When you save a product, the system validates the graph:

- **No duplicate units** — the same unit can't be selected twice.
- **No circular chains** (e.g. `A → B → A`).
- **No inconsistent chains** — two paths between the same units must agree.
- Every linked unit must have a resolvable factor; otherwise saving fails with
  a *"Define the conversion"* error.

### `inventory_transactions` — the audit log

Every single stock movement is recorded here (never deleted, never edited).

| Column            | Meaning                                      |
|-------------------|----------------------------------------------|
| `transaction_type`| `purchase` \| `sale` \| `adjustment` \| `opening_stock` \| `return` |
| `unit_id`         | The unit the user actually used              |
| `unit_quantity`   | Quantity in that human-readable unit         |
| `base_quantity`   | Quantity converted to base unit (what changes stock) |
| `previous_stock`  | Stock before this transaction (base unit)    |
| `remaining_stock` | Stock after this transaction (base unit)     |
| `reference_id`    | Link to the purchase/sale record             |
| `notes`           | Human-readable description                   |

This table is how you can replay the whole history of a product — the previous
and remaining stock of each row should chain together perfectly.

### `purchases` / `purchase_items` and `sales` / `sale_items`

Order records. Each line item stores the quantity in the unit used **and** the
computed `base_quantity`, so orders can be re-verified against the audit log.

---

## How a Product's Stock Is Created

**File:** `backend-supermarket/src/services/product.service.ts` → `create()`

When you create a product, the flow is:

1. **Base unit is validated** to exist.
2. **Duplicate unit selections are rejected** (base + purchase + selling +
   additional units must all be different).
3. **Conversion data is built** (`buildProductConversionData`):
   - Purchase/selling/additional unit factors are resolved — either from a
     user-entered factor, or by walking the product's conversion graph.
   - `product_conversions` entries and `product_units.factor_to_base` values
     are produced together.
4. **Opening stock is converted to the base unit** if it was entered in the
   purchase unit (e.g. 3 Bags × 5000 = 15000 Grams), then saved to
   `opening_stock` **and** `current_stock`.
5. **The product is inserted**, along with its `product_units`,
   `product_conversions`, and images.
6. **If opening stock > 0, an `opening_stock` transaction is recorded** with
   `previous_stock = 0` and `remaining_stock = opening_stock`.

So the very first row in a product's audit trail is always its opening stock.

---

## Stock Movements — The Three Operations

All three live in `product.service.ts` and are wired up in
`product.routes.ts`:

```
POST /api/products/stock/purchase
POST /api/products/stock/sell
POST /api/products/stock/adjust
```

### 1️⃣ Purchase Stock — `purchaseStock(input)`

1. Load the product; look up the unit in `product_units`.
   - **Not linked to this product?** → `UNIT_NOT_AVAILABLE` error.
2. Convert to base: `baseQuantity = quantity × productUnit.factorToBase`.
3. `previousStock = product.currentStock`
   `remainingStock = previousStock + baseQuantity`
4. Create a `purchases` header (auto number like `PUR-<timestamp>-XXXX`) and a
   `purchase_items` line with both `quantity` and `base_quantity`.
5. `UPDATE products SET current_stock = remainingStock`.
6. Record a `purchase` transaction linking back to the purchase.

**Result:** `{ purchaseId, item, remainingStock }`

### 2️⃣ Sell Stock — `sellStock(input)`

Identical to purchase, but:

1. `baseQuantity = quantity × factorToBase`.
2. **Insufficient stock check:** if `baseQuantity > currentStock`, fail with
   `INSUFFICIENT_STOCK` and a message showing what's available vs. requested
   (in base units) and what was requested in the user's unit.
3. `remainingStock = previousStock - baseQuantity`.
4. Creates a `sales` header (`SAL-<timestamp>-XXXX`) and `sale_items` line.
5. Updates `current_stock` and records a `sale` transaction.

**Result:** `{ saleId, item, remainingStock }`

### 3️⃣ Adjust Stock — `adjustStock(input)`

A manual correction. `newQuantity` is **in base units** — no conversion happens.

- `difference = newQuantity - currentStock` (can be negative)
- `current_stock` is set directly to `newQuantity`.
- An `adjustment` transaction records `unit_quantity = |difference|` and
  `base_quantity = difference`, with your notes.

**Result:** `{ previousStock, newStock, difference }`

> **Why is adjustment in base units?** An adjustment is a physical count — you
> count what's on the shelf in your base unit. Purchase/sell use the
> human-friendly unit because they're real-world business documents.

---

## Stock Validation & Display

### `validateStockAvailability(productId, unitId, quantity)`

A dry-run check used before completing a sale in the UI. Returns:

- `available` — can we fulfill this in the requested unit?
- `availableInBase` / `requestedInBase`
- `displayAvailable` — the current stock rendered as human text
  (e.g. `"2 kg, 500 g"`).

### `getDisplayStock(productId)`

The frontend calls this once per product to render stock. It decomposes the
base-unit number into the product's own units using the conversion service:

```
currentStock = 2500 (Grams)
→ display: [ { Kilogram: 2 }, { Gram: 500 } ]
→ displayText: "2 kg, 500 g"
→ isLowStock: currentStock <= minStock
```

### The display algorithm (`conversionService.getDisplayQuantity`)

1. Sort the product's units by `factor_to_base` descending (largest first).
2. Greedily divide the remainder: `wholePart = floor(remainder / factor)`.
3. The leftover lands in the smallest unit.

---

## The Frontend — Stock Overview

**File:** `frontend-supermarket/src/features/stock-overview/components/stock-overview.tsx`

The Stock Overview tab does this on load:

1. Fetches **all products** (`GET /api/products`).
2. For each product, fetches **display stock**
   (`GET /api/products/:id/stock/display`) in parallel and maps them by id.
3. Renders:

**Summary cards**

| Card          | Formula                                    |
|---------------|--------------------------------------------|
| Total Products| `products.length`                          |
| Stock Value   | Σ `currentStock × purchasePrice`           |
| Low Stock     | count where `currentStock <= minStock && currentStock > 0` |
| Total Units   | Σ `currentStock`                          |

**Filters**

- **All Items** — everything
- **Low Stock** — `currentStock <= minStock && currentStock > 0`
- **Out of Stock** — `currentStock === 0`
- *(overstock — `currentStock >= maxStock` — is computed for row styling)*

**Table rows**

- **Current Stock** shown as `displayText` (e.g. `2 kg, 500 g`).
- **Stock Level** progress bar = `currentStock / maxStock × 100%`.
- **Status** pill (active / inactive / discontinued).
- **Value** = `currentStock × purchasePrice`.
- Row tinting: 🔴 out of stock, 🟡 low stock, 🔵 overstock.

---

## Code Organization

The usual 3-layer pattern (same as the rest of the backend):

```
Controller (HTTP) ──► Service (Business Logic) ──► Repository (SQL)
```

| Layer      | File(s)                                                        | Job |
|------------|----------------------------------------------------------------|-----|
| Controller | `controllers/product.controller.ts`                            | Thin HTTP handlers |
| Service    | `services/product.service.ts`                                  | All stock math, rules, validation |
| Service    | `services/conversion.service.ts`                               | Factor resolution & display helpers |
| Repository | `repositories/product.repository.ts`                           | All inventory SQL |
| Schema     | `db/schema.sql`, `db/migrate.ts`                               | Tables + startup auto-migration |

---

## API Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/products` | List all products (with units, conversions, stock) |
| `POST` | `/api/products` | Create product (+ opening stock transaction) |
| `PATCH`| `/api/products/:id` | Update product |
| `DELETE`| `/api/products/:id` | Delete product |
| `POST` | `/api/products/stock/purchase` | Receive stock (in a product unit) |
| `POST` | `/api/products/stock/sell` | Sell stock (in a product unit) |
| `POST` | `/api/products/stock/adjust` | Set stock to an absolute base-unit count |
| `POST` | `/api/products/stock/validate` | Dry-run stock availability check |
| `GET`  | `/api/products/:id/stock/display` | Human-readable stock breakdown |
| `GET`  | `/api/products/transactions/all?productId=` | Audit log (all or one product) |
| `GET`  | `/api/products/purchases/list`, `/api/products/purchases/:id` | Purchase orders |
| `GET`  | `/api/products/sales/list`, `/api/products/sales/:id` | Sales orders |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/products/:productId/conversions`, `/api/products/conversions/:id` | Product-specific conversions |

---

## Key Rules to Remember

1. **`current_stock` is always in the base unit.** Never store or display it as anything else in the database.
2. **Stock math always uses the product's own `factor_to_base`** — never the global conversion table.
3. **Every movement writes an `inventory_transactions` row** — it's the source of truth for history.
4. **Purchases and sales work in the user's unit**; adjustments work in base units.
5. **Sales can't go below zero** — `INSUFFICIENT_STOCK` is returned with a helpful message.
6. **A unit must be linked to the product** before you can buy/sell in it (`UNIT_NOT_AVAILABLE` otherwise).
7. **Conversions are validated on save**: duplicate units, circular chains, and inconsistent chains are rejected.
8. **Opening stock seeds both `opening_stock` and `current_stock`**, and creates the first audit entry.

## Common Confusions

**Q: Why does the same unit have different factors for different products?**
A: `product_units.factor_to_base` is per-product. A "Bag" of rice isn't the same
   weight as a "Bag" of flour. Stock math therefore always asks *this product's*
   row, not a global table.

**Q: What happens if I sell in a unit that isn't linked to the product?**
A: The sale is rejected with `UNIT_NOT_AVAILABLE`. Add the unit to the product
   (with a conversion factor) first.

**Q: If I change a product's factor, does old history change?**
A: No. Every transaction snapshots its own `unit_quantity` and `base_quantity`.
   Historical rows are never rewritten, so the audit log stays accurate.

**Q: What does an adjustment with a negative difference mean?**
A: Stock shrinkage (damage, theft, expiry). The transaction's `base_quantity`
   is negative and `current_stock` goes down.
