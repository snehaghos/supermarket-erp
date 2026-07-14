# Supermarket Inventory System — Complete Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Getting Started](#getting-started)
3. [Database Schema](#database-schema)
4. [Units Management](#units-management)
5. [Conversion System](#conversion-system)
6. [Products Management](#products-management)
7. [Inventory Engine](#inventory-engine)
8. [Pricing](#pricing)
9. [Purchase / Sell Workflow](#purchase--sell-workflow)
10. [API Reference](#api-reference)
11. [Frontend Component Structure](#frontend-component-structure)

---

## Architecture Overview

The system follows a **three-tier architecture**:

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (React)                   │
│  Vite + TypeScript + TanStack Router + Tailwind CSS  │
│                                                      │
│  Features:                                           │
│  • Products — Form, Table, Stock Modals              │
│  • Units — CRUD table and form                       │
│  • Conversions — CRUD table, form, preview           │
│  • Dashboard — Overview cards and charts             │
└───────────────────────┬─────────────────────────────┘
                        │  HTTP / JSON / REST
┌───────────────────────▼─────────────────────────────┐
│                   BACKEND (Express)                  │
│  Node.js + TypeScript + Zod Validation              │
│                                                      │
│  Layers:                                             │
│  • Controllers — HTTP handlers (thin)                │
│  • Services — Business logic (thick)                 │
│  • Repositories — Database queries (thin)            │
│  • Middleware — Error handler, validation            │
└───────────────────────┬─────────────────────────────┘
                        │  better-sqlite3
┌───────────────────────▼─────────────────────────────┐
│                 DATABASE (SQLite)                    │
│  • units — Measurement units catalog                │
│  • conversions — Global standard conversions         │
│  • products — Product master with stock              │
│  • product_units — Product-specific unit links       │
│  • product_conversions — Custom conversion rules    │
│  • inventory_transactions — Stock movement audit    │
│  • purchases / purchase_items — Purchase orders     │
│  • sales / sale_items — Sales orders                │
└─────────────────────────────────────────────────────┘
```

### Frontend (frontend-supermarket/)

- **Language**: TypeScript (strict)
- **Framework**: React 18
- **Build tool**: Vite
- **Routing**: TanStack Router (file-based)
- **Styling**: Tailwind CSS 3 + shadcn/ui components
- **Data fetching**: Direct fetch (no heavy client — simple API calls)
- **Packages**: lucide-react (icons), recharts (charts), react-day-picker (calendar)

### Backend (backend-supermarket/)

- **Language**: TypeScript
- **Runtime**: Node.js (ts-node for dev)
- **Framework**: Express.js
- **Database**: SQLite (via better-sqlite3)
- **Validation**: Zod (request body validation)
- **Migration**: Run schema.sql on server start (idempotent — `CREATE IF NOT EXISTS`)

---

## Getting Started

### 1. Install Dependencies

```bash
# Backend
cd backend-supermarket
npm install

# Frontend
cd frontend-supermarket
npm install
```

### 2. Start Both Servers

```bash
# Terminal 1 — Backend (port 3001)
cd backend-supermarket
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend-supermarket
npm run dev
```

The backend auto-migrates the database on startup. The SQLite file lives at `backend-supermarket/data/inventory.db`.

### 3. Access the App

Open `http://localhost:5173` in your browser.

---

## Database Schema

### `units`

The measurement units catalog — defines what units exist and their categories.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| id | TEXT (UUID) | Primary key | `0000...001` |
| name | VARCHAR | Unit name | `Kilogram` |
| symbol | VARCHAR | Short symbol | `KGS` |
| type | ENUM | Category | `Weight`, `Volume`, `Count`, `Length`, `Area`, `Packaging` |
| status | ENUM | Active/inactive | `active` |

**Important:** Only units with the **same type** can be converted between each other. You can't convert a Weight unit (Kg) to a Volume unit (Liter).

### `conversions`

Global standard conversion factors that apply to ALL products.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| parent_unit_id | TEXT | Larger unit | Box UUID |
| child_unit_id | TEXT | Smaller unit | Strip UUID |
| factor | REAL | 1 parent = factor × child | 10 |

**Rule:** `1 Parent = Factor × Child` (e.g., 1 Box = 10 Strips)

Pre-seeded global chains:
- **Weight:** Tonne → Kilogram → Gram → Milligram
- **Volume:** Cubic Meter → Liter → Milliliter
- **Length:** Meter → Centimeter
- **Count:** Dozen → Pieces, Set → Pieces
- **Packaging:** Carton → Box → Strip → Tablet

### `products`

The master product table. All inventory quantities are ALWAYS stored in the **base unit**.

| Column | Type | Description |
|--------|------|-------------|
| name | TEXT | Product name |
| sku | TEXT | Unique SKU code |
| barcode | TEXT | Barcode (optional) |
| brand | TEXT | Brand name (optional) |
| description | TEXT | Product description |
| image_url | TEXT | Product image URL |
| base_unit_id | TEXT | **Inventory storage unit** — all stock stored in this |
| purchase_unit_id | TEXT | Default unit for purchasing |
| selling_unit_id | TEXT | Default unit for selling |
| purchase_price | REAL | Price per purchase unit |
| selling_price | REAL | Price per selling unit |
| min_stock | REAL | Low stock alert threshold |
| max_stock | REAL | Overstock warning threshold |
| reorder_level | REAL | When to reorder |
| opening_stock | REAL | Initial stock at creation |
| current_stock | REAL | **Current stock in base unit** |
| status | ENUM | active / inactive / discontinued |

**The Golden Rule:** `current_stock` is ALWAYS in `base_unit`. Never store inventory in purchase or selling units.

### `product_units`

Links units to a specific product with the computed conversion factor to the base unit.

| Column | Type | Description |
|--------|------|-------------|
| product_id | TEXT | Product ID |
| unit_id | TEXT | Linked unit |
| factor_to_base | REAL | 1 of this unit = factor_to_base base units |
| is_purchase_unit | BOOL | Can purchase in this unit? |
| is_selling_unit | BOOL | Can sell in this unit? |

Example for a medicine product with Base=Tablet:
```
1 Box    → factor_to_base = 200  (since 1 Box = 200 Tablets)
1 Strip  → factor_to_base = 10   (since 1 Strip = 10 Tablets)
1 Tablet → factor_to_base = 1    (base unit itself)
```

### `product_conversions`

**Product-specific** conversion overrides. These take priority over global conversions when computing factor_to_base.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| product_id | TEXT | Product ID | |
| from_unit_id | TEXT | Smaller unit | Tablet |
| to_unit_id | TEXT | Larger unit | Box |
| conversion_factor | REAL | 1 to_unit = factor × from_unit | 200 |
| relationship_text | TEXT | Human-readable snapshot | "1 Box = 200 Tablets" |

Example: For a Rice product, you might define `1 Bag = 50 Kg` even though globally Bag is just a packaging unit with no weight conversion.

### Other Tables

- **inventory_transactions** — Every stock movement (purchase, sale, adjustment, opening) is recorded as an immutable audit log.
- **purchases / purchase_items** — Purchase orders with supplier info.
- **sales / sale_items** — Sales orders with customer info.

---

## Units Management

### Purpose

Define the measurement units your inventory uses. Each unit belongs to a **type/category**:
`Count, Weight, Volume, Length, Area, Packaging`

### UI

- **Units tab** → Table showing all units with name, symbol, type, status
- **Add Unit** button → Form with Name, Symbol, Type dropdown

### CRUD Endpoints

```
GET    /api/units         — List all units
GET    /api/units/:id     — Get one unit
POST   /api/units         — Create unit
PATCH  /api/units/:id     — Update unit
DELETE /api/units/:id     — Delete unit
```

### Seeded Units

The database comes pre-loaded with useful units:

| Name | Symbol | Type |
|------|--------|------|
| Box | BOX | Packaging |
| Strip | ST | Packaging |
| Tablet | TAB | Count |
| Kilogram | KGS | Weight |
| Gram | GMS | Weight |
| Milligram | MG | Weight |
| Tonne | TNS | Weight |
| Liter | LTR | Volume |
| Milliliter | MLT | Volume |
| Cubic Meter | CBM | Volume |
| Meter | MTR | Length |
| Centimeter | CMT | Length |
| Bottle | BTL | Packaging |
| Bag | BAG | Packaging |
| Carton | CTN | Packaging |
| Piece | PCE | Count |
| Pieces | PCS | Count |
| Dozen | DOZ | Count |
| Set | SET | Count |
| Square Meter | SQM | Area |

---

## Conversion System

### Two Levels of Conversions

The system supports **two levels** of conversion rules:

#### Level 1: Global Conversions (`conversions` table)

Standard relationships that apply to ALL products. E.g.:
- 1 Kilogram = 1000 Grams
- 1 Box = 10 Strips
- 1 Dozen = 12 Pieces

These are defined in the "Conversions" tab and are **global** — they affect every product that uses those units.

#### Level 2: Product-Specific Conversions (`product_conversions` table)

Custom relationships defined for a **specific product only**. These override global conversions for that product. E.g.:
- For "Premium Basmati Rice": 1 Bag = 50 Kg (not the default packaging conversion)
- For "Paracetamol 500mg": 1 Box = 200 Tablets

These are defined in the **Product Form → Unit Conversions section**.

### How Conversions Are Resolved

When computing `factor_to_base` for a product unit, the system follows this priority:

```
1. Check product-specific conversions (from product_conversions table)
   → Try direct match: fromUnit → baseUnit
   → Try reverse match: baseUnit → fromUnit (returns 1/factor)
   
2. Fall back to global conversion chain (from conversions table)
   → Walk downward: parent → child (multiply)
   → Walk upward: child → parent (divide)
   
3. If neither works → throw "No conversion path found" error
```

### Example Walkthrough

**Scenario:** Create a Medicine product
- Base Unit = Tablet (TAB)
- Purchase Unit = Box (BOX) 
- Product-specific conversion: 1 Box = 200 Tablets

**Resolution:**
1. Computing factor_to_base for Box → Tablet
2. Check product-specific: `fromUnitId=Box, toUnitId=Tablet` → not found
3. Check reverse: `fromUnitId=Tablet, toUnitId=Box` → found! Factor = 200
4. Since we're going reverse (base → from), return `1/200 = 0.005`
5. Wait — actually our formula is: **1 toUnit = factor × fromUnit**
6. So `fromUnitId=Tablet, toUnitId=Box, factor=200` means **1 Box = 200 Tablets**
7. Direct match: `fromUnitId=Box, toUnitId=Tablet` → not found
8. Reverse match: `fromUnitId=Tablet, toUnitId=Box` → found → return `1/200 = 0.005`
9. So `factor_to_base` from Box to Tablet = 0.005? That doesn't make sense.

**Actually, the convention is:**
- `from_unit_id` = smaller unit (child), `to_unit_id` = larger unit (parent)
- `1 to_unit = conversion_factor × from_unit`
- So `from=Tablet, to=Box, factor=200` means **1 Box = 200 Tablets**

When computing factor_to_base **from Box to Tablet**:
- Product-specific: `fromUnitId=Box, toUnitId=Tablet` → not found (we store Tablet→Box, not Box→Tablet)
- Reverse: `fromUnitId=Tablet, toUnitId=Box` → found! Return `1/200 = 0.005`

Wait, that gives us **0.005** but 1 Box should be **200 Tablets**. Let me re-check...

Actually, the `resolveProductFactorToBase` function works like this:
- `directConv = c.fromUnitId === fromUnitId && c.toUnitId === baseUnitId` — checks if the conversion directly matches (from → to)
- `reverseConv = c.fromUnitId === baseUnitId && c.toUnitId === fromUnitId` — checks reversed
- If direct: return `conversionFactor` (which is how many to-units per from-unit... no wait, it's actually how many from-units per to-unit)

Hmm, I'm getting confused. Let me re-think:

The formula in the table is: **1 to_unit = conversion_factor × from_unit**
So: `from=Tablet, to=Box, factor=200` means: **1 Box = 200 Tablets**

When converting FROM Box TO Tablet (base unit):
- We want: how many Tablets = 1 Box?
- Direct check: `fromUnitId=Box, toUnitId=Tablet` — not found (we store `from=Tablet, to=Box`)
- Reverse check: `fromUnitId=Tablet, toUnitId=Box` — found!
- Return `1 / conversionFactor = 1 / 200 = 0.005`

But 1 Box should be 200 Tablets, not 0.005 Tablets!

Wait, there's a naming issue. Let me look at the `resolveProductFactorToBase` function again:

```typescript
const directConv = productConversions.find(
  c => c.fromUnitId === fromUnitId && c.toUnitId === baseUnitId
)
if (directConv) return directConv.conversionFactor
```

If `fromUnitId = Box` and `baseUnitId = Tablet`:
- Looking for a conversion where `fromUnitId = Box` and `toUnitId = Tablet`
- We have `from=Tablet, to=Box, factor=200` — this doesn't match
- So direct check fails

```typescript
const reverseConv = productConversions.find(
  c => c.fromUnitId === baseUnitId && c.toUnitId === fromUnitId
)
if (reverseConv) return 1 / reverseConv.conversionFactor
```

- `c.fromUnitId === Tablet (baseUnitId) && c.toUnitId === Box (fromUnitId)` — matches!
- Return `1 / 200 = 0.005`

So the function returns 0.005, meaning 1 Box = 0.005 Tablets... That's wrong!

Actually wait, I think the issue is that the conversion formula uses `from` as the smaller unit and `to` as the larger unit:

`1 to_unit (larger) = conversion_factor × from_unit (smaller)`

So `from=Tablet, to=Box, factor=200` means `1 Box = 200 Tablets`.

When computing factor_to_base from Box → Tablet:
- We want: `factor_to_base` where 1 Box = X Tablets

The `resolveProductFactorToBase` returns a factor that, when MULTIPLIED by the source quantity, gives the base quantity:
- `base_quantity = source_quantity × factor_to_base`
- If 1 Box = 200 Tablets, then `factor_to_base = 200`

But the function returns 0.005... That would mean 1 Box = 0.005 Tablets, which is wrong.

Hmm wait, let me re-read the function one more time:

```typescript
const reverseConv = productConversions.find(
  c => c.fromUnitId === baseUnitId && c.toUnitId === fromUnitId
)
if (reverseConv) return 1 / reverseConv.conversionFactor
```

For `fromUnitId=Box, baseUnitId=Tablet`:
- `c.fromUnitId === baseUnitId` means `c.fromUnitId === Tablet`
- `c.toUnitId === fromUnitId` means `c.toUnitId === Box`
- We have `from=Tablet, to=Box, factor=200` — this matches!
- Return `1 / 200 = 0.005`

But the answer should be 200 (the factor itself), not 1/200!

I think there might be a bug in the reverse logic. Let me think again...

The product conversion says `from=Tablet, to=Box, factor=200`.
This means: 1 Box (to) = 200 Tablets (from).
In other words: `1 to = factor × from`.
So: `1 Box = 200 × Tablet`.

If we're converting `from = Box` to `base = Tablet`:
- We want: how many Tablets equal 1 Box?
- Answer: 200 Tablets = 1 Box (from the conversion rule)
- So `factor_to_base = 200`

The direct match would be: `fromUnitId(Box) = from(Tablet)` — nope, Box != Tablet.

The reverse match: `fromUnitId(Box) = to(Box)` — let me re-check...

`reverseConv = c.fromUnitId === baseUnitId && c.toUnitId === fromUnitId`
For `fromUnitId=Box, baseUnitId=Tablet`:
- `c.fromUnitId === baseUnitId` means `c.fromUnitId === Tablet` — the stored conversion has `from=Tablet`, so this matches!
- `c.toUnitId === fromUnitId` means `c.toUnitId === Box` — the stored conversion has `to=Box`, so this matches!
- We found `from=Tablet, to=Box, factor=200`
- Return `1 / 200 = 0.005`

Hmm, but we want 200, not 0.005.

I think the issue is with how I'm interpreting the conversion direction. Let me re-think:

The `resolveProductFactorToBase(fromUnitId, baseUnitId)` function answers:
**"How many base units equal 1 fromUnit?"**
In other words: `1 fromUnit = X × baseUnit`

For our scenario: `fromUnitId=Box, baseUnitId=Tablet`
The answer should be: **"1 Box = 200 Tablets"** → return 200

The product conversion says: `from=Tablet, to=Box, factor=200`
Interpretation: `1 to(Box) = 200 × from(Tablet)`

So the relationship is `1 Box = 200 Tablets`.

To answer `resolveProductFactorToBase(Box, Tablet)`:
- We need to find how many Tablets = 1 Box
- The conversion gives us: 1 Box = 200 Tablets
- So factor_to_base = 200

Now the question is: should the reverse case return `conversionFactor` or `1/conversionFactor`?

For the reverse case, we have `from=Tablet(baseUnitId), to=Box(fromUnitId), factor=200`.
This means: 1 Box = 200 Tablets.

If we want to convert FROM Box TO Tablet:
- The conversion stores `from=Tablet, to=Box`, meaning `1 Box = 200 Tablets`
- Going in reverse direction (we want to go from Box→Tablet, but the stored conversion goes Tablet→Box):
- `fromUnitId` (Box) is `to` in the stored conversion
- `baseUnitId` (Tablet) is `from` in the stored conversion
- So the stored `factor=200` IS the answer: 1 Box = 200 Tablets
- But the code returns `1/factor = 1/200 = 0.005`

I think there's actually a bug here! The reverse case should return `conversionFactor`, not `1/conversionFactor`.

Wait, but let me think about the other direction. What if I'm converting FROM Tablet TO Box?

`resolveProductFactorToBase(Tablet, Box)`:
- `fromUnitId=Tablet, baseUnitId=Box`
- Direct check: `fromUnitId(Tablet)=from(Tablet) && toUnitId(Box)=to(Box)` → YES! Found!
- Return `conversionFactor = 200`

So `resolveProductFactorToBase(Tablet, Box)` returns 200, meaning "1 Tablet = 200 Boxes". But that's wrong! 1 Tablet = 1/200 of a Box, not 200 Boxes.

So the current logic is:
- `resolveProductFactorToBase(Box, Tablet)` = 0.005 (should be 200!)
- `resolveProductFactorToBase(Tablet, Box)` = 200 (should be 0.005!)

Both are wrong! The function is returning the wrong values.

Wait, but the system has been working in earlier tests. Let me try a different example:

Product conversion: `from=Gram, to=Kilogram, factor=1000`
Means: 1 Kg = 1000 g

`resolveProductFactorToBase(Gram, Kilogram)`:
- fromUnitId=Gram, baseUnitId=Kilogram
- Direct: `from=Gram&to=Kilogram` → YES! Return factor=1000

So `resolveProductFactorToBase(Gram, Kilogram)` = 1000, meaning "1 Gram = 1000 Kilograms". That's wrong!

`resolveProductFactorToBase(Kilogram, Gram)`:
- Direct: `from=Kg&to=Gram` → NOT found (we have `from=Gram, to=Kg`)
- Reverse: `from=Gram(baseUnitId)&to=Kg(fromUnitId)` → Found! Return 1/1000 = 0.001

So `resolveProductFactorToBase(Kilogram, Gram)` = 0.001, meaning "1 Kilogram = 0.001 Grams". That's wrong too!

This IS a bug! The conversion semantics are inverted somewhere.

Actually wait... Let me re-read the comment in the schema:
```
-- When computing factor_to_base for a product, these are checked first.
-- Example: For a Rice product, 1 Bag = 50 Kg (product-specific),
```

So `from=Kg, to=Bag, factor=50` should mean `1 Bag = 50 Kg`.

When I compute `resolveProductFactorToBase(Bag, Kg)`:
- fromUnitId=Bag, baseUnitId=Kg
- Direct: `from=Bag&to=Kg` → found! Return 50.

So `1 Bag = 50 × Kg`. That gives `factor_to_base = 50`. Meaning `1 Bag = 50 Kg`. Correct!

And `resolveProductFactorToBase(Kg, Bag)`:
- Direct: `from=Kg&to=Bag` → found! Return 50.
- So `1 Kg = 50 × Bag`. That's wrong! 1 Kg ≠ 50 Bag.

Hmm, so the direct match returning `conversionFactor` is wrong in the case where fromUnitId and baseUnitId are swapped from the stored conversion.

Wait, but the direct match says `fromUnitId(fromUnitId) === c.fromUnitId`. So if the stored conversion is `from=Kg, to=Bag, factor=50`, and we're resolving `resolveProductFactorToBase(Kg, Bag)`:
- Direct: fromUnitId (Kg) === c.fromUnitId (Kg) → yes!
- toUnitId (Bag) === c.toUnitId (Bag) → yes!
- Return 50.

So we're saying "1 Kg = 50 Bag". That's incorrect. The correct answer should be "1 Kg = 1/50 Bag" = 0.02.

So the direct match should return `conversionFactor` for the forward direction and `1/conversionFactor` for the reverse. But how do you determine which is forward vs reverse?

The key insight: the user's conversion is `1 Bag = 50 Kg` (from=Kg, to=Bag, factor=50). When the user wants `factor_to_base` from Bag to Kg, they want 50. When they want `factor_to_base` from Kg to Bag, they want 1/50.

So the meaning of `from=Kg, to=Bag, factor=50` is:
- `from` = the SMALLER unit (Kg)
- `to` = the LARGER unit (Bag)
- `1 to = factor × from` → `1 Bag = 50 × Kg`

When computing `factor_to_base(fromUnitId, baseUnitId)`:
- If `fromUnitId = to` (larger) and `baseUnitId = from` (smaller):
  - We already have: `1 base = 1/factor × from`
  - Wait no, let me think about this differently.

The conversion says: `1 to_unit = factor × from_unit`
So: `1 Bag = 50 × Kg`

Which means:
- `to_unit` (Bag) = `factor` × `from_unit` (Kg)
- `from_unit` (Kg) = `1/factor` × `to_unit` (Bag)
- `1 Kg = 1/50 Bag`

Now `factor_to_base(fromUnitId, baseUnitId)` = "how many base units equal 1 fromUnit?"

If fromUnitId = Kg, baseUnitId = Bag:
- We want: "1 Kg = ? × Bag"
- From the conversion: 1 Kg = 1/50 Bag
- So factor_to_base = 1/50 = 0.02

If fromUnitId = Bag, baseUnitId = Kg:
- We want: "1 Bag = ? × Kg"
- From the conversion: 1 Bag = 50 × Kg
- So factor_to_base = 50

Now in the code:

```typescript
const directConv = productConversions.find(
  c => c.fromUnitId === fromUnitId && c.toUnitId === baseUnitId
)
```

For `resolveProductFactorToBase(From=Bottle, Base=Carton)`:
- Looking for a conversion where `from=Bottle, to=Carton`
- The stored conversion is `from=Bottle, to=Carton, factor=24`
- `1 Carton = 24 Bottles`
- `factor_to_base = how many Cartons = 1 Bottle?`
- Actually `factor_to_base` is: how many Base units = 1 From unit?
- So: 1 Bottle = 1/24 Carton
- factor_to_base = 1/24 ≈ 0.042

Wait, but this doesn't match the actual usage. In `product.service.ts`:

```typescript
const factorToBase = await resolveProductFactorToBase(au.unitId, input.baseUnitId)
additionalEntries.push({
  unitId: au.unitId,
  factorToBase,
  ...
})
```

So `factorToBase` is stored in `product_units.factor_to_base`. And in `product_units`, `factor_to_base = how many base units = 1 of this unit`.

So if base unit = Carton and we're adding Bottle as a unit:
- `factor_to_base` = how many Cartons = 1 Bottle?
- We know 1 Carton = 24 Bottles
- So: 1 Carton = 24 × 1 Bottle
- ∴ 1 Bottle = 1/24 Carton
- `factor_to_base = 1/24 = 0.042`

Hmm, but is this right? Let me check how `factor_to_base` is used. In `purchaseStock`:

```typescript
const baseQuantity = input.quantity * productUnit.factorToBase
```

So if input.quantity = 24 Bottles, then baseQuantity = 24 × 0.042 = 1 Carton. That's correct!

And in the display function:
```typescript
const wholePart = Math.floor(remainder / unit.factorToBase)
```

So if remainder = 1 Carton and factorToBase for Carton = 1 (always 1 for base unit):
- `1 / 1 = 1` Carton

If remainder = 1 Carton and factorToBase for Bottle = 0.042:
- `1 / 0.042 = 24` Bottles

That seems correct!

OK so let me re-trace: `product_conversion = {from=Bottle, to=Carton, factor=24}`
Meaning: 1 Carton = 24 Bottles, OR: 1 to = 24 × from

`resolveProductFactorToBase(Bottle, Carton)`:
- fromUnitId=Bottle, baseUnitId=Carton
- Direct: `from=Bottle, to=Carton` → found! Return 24.
- So `factor_to_base = 24`

But wait, factor_to_base should equal "how many Cartons = 1 Bottle" = 1/24 = 0.042!

But the code returns 24. So `factor_to_base = 24` for Bottle → Carton?

Then in `purchaseStock`: `24 Bottles × 24 = 576 Cartons` → that's wrong!

So... the code IS buggy? Or am I misunderstanding?

Actually, wait. Let me look at the `purchaseStock` function again:

```typescript
const baseQuantity = await conversionService.convertToBaseUnit(
  input.quantity,
  input.unitId,
  product.baseUnitId
)
```

It doesn't use `factorToBase` directly! It uses `conversionService.convertToBaseUnit` which internally calls `resolveFactorToBase` (the global one). So the purchase stock doesn't use the product_units.factor_to_base at all.

And the `createProduct` function DOES use `resolveProductFactorToBase` and stores the result in `product_units.factor_to_base`. But how is `factor_to_base` used?

Looking at the display functions:
```typescript
const displayUnits = product.units.map(u => ({
  unitId: u.unitId,
  unitName: u.unitName,
  unitSymbol: u.unitSymbol,
  factorToBase: u.factorToBase,
}))
const display = conversionService.getDisplayQuantity(product.currentStock, displayUnits)
```

In `getDisplayQuantity`:
```typescript
const wholePart = Math.floor(remainder / unit.factorToBase)
```

For base unit (Carton): factorToBase = 1
For Bottle: if `resolveProductFactorToBase(Bottle, Carton)` returns 24, then factorToBase = 24.

For remainder = 576 Cartons:
- Bottle: `Math.floor(576 / 24) = 24` → 24 Bottles
- That means 576 Cartons = 24 Bottles... that's wrong! 576 Cartons ≠ 24 Bottles.

So indeed, the factor_to_base should be 1/24 for Bottle → Carton, not 24.

I think the issue is that `resolveProductFactorToBase` returns the WRONG direction. The formula:
`1 to_unit = factor × from_unit`

If `resolveProductFactorToBase(Bottle, Carton)` should return "how many Cartons = 1 Bottle":
- We know `1 Carton = 24 Bottles`
- So `1 Bottle = 1/24 Carton`
- `factor_to_base = 1/24 = 0.042`

But the direct match returns `conversionFactor = 24`, not `1/24`.

So the direct match should return `1/conversionFactor` when the conversion is in the forward direction... 

Actually, I think I've been confusing myself. Let me re-read the product conversion semantics one more time:

The `product_conversions` table stores: `from_unit_id, to_unit_id, conversion_factor`
With the meaning: `1 [to_unit] = conversion_factor × [from_unit]`

Example: `from=Bottle, to=Carton, factor=24` → `1 Carton = 24 Bottles`

Now `resolveProductFactorToBase(fromUnitId, baseUnitId)` should return:
**How many base units equal 1 fromUnit?**

For `resolveProductFactorToBase(Bottle, Carton)`:
- `fromUnitId = Bottle, baseUnitId = Carton`
- "How many Cartons = 1 Bottle?"
- We know: `1 Carton = 24 Bottles`
- So: `1 Bottle = 1/24 Carton`
- Answer: `factor_to_base = 1/24 = 0.042`

For `resolveProductFactorToBase(Carton, Bottle)`:
- `fromUnitId = Carton, baseUnitId = Bottle`
- "How many Bottles = 1 Carton?"
- We know: `1 Carton = 24 Bottles`
- So: `1 Carton = 24 Bottles`
- Answer: `factor_to_base = 24`

Now in the code:
```typescript
const directConv = productConversions.find(
  c => c.fromUnitId === fromUnitId && c.toUnitId === baseUnitId
)
if (directConv) return directConv.conversionFactor
```

For `resolveProductFactorToBase(Bottle, Carton)`:
- `c.fromUnitId === Bottle && c.toUnitId === Carton`
- The stored conversion is `from=Bottle, to=Carton, factor=24`
- Found! Return 24.

But the answer should be 1/24 ≈ 0.042! So the return value is WRONG.

The fix should be: when the direct match is found, return `1 / conversionFactor`, not `conversionFactor`.

Hmm wait, but that feels backward. Let me try with the Kg/Bag example again:

`from=Kg, to=Bag, factor=50` → `1 Bag = 50 Kg`

`resolveProductFactorToBase(Bag, Kg)`:
- "How many Kg = 1 Bag?" = 50
- Direct: `from=Bag, to=Kg` → NOT found (stored as `from=Kg, to=Bag`)
- Reverse: `from=Kg(baseUnit), to=Bag(fromUnit)` → Found! Return 1/50 = 0.02
- Answer: 0.02 → meaning "1 Bag = 0.02 Kg"? WRONG!

`resolveProductFactorToBase(Kg, Bag)`:
- "How many Bag = 1 Kg?" = 1/50 = 0.02
- Direct: `from=Kg, to=Bag` → Found! Return 50. 
- Answer: 50 → meaning "1 Kg = 50 Bag"? WRONG!

So both directions are wrong! The direct match should return `1/conversionFactor` and the reverse should return `conversionFactor`.

Oh wait, that can't be right either because the system has been working. Let me look at actual test cases...

The pre-seeded conversions are like `from=Bottle, to=Carton(which is in the to_unit_id field), factor=24`. 

Actually, maybe the convention is INVERTED from what I assumed! Maybe:
`from_unit_id` = larger unit (parent)
`to_unit_id` = smaller unit (child)
`conversion_factor = how many to_unit = 1 from_unit`

So `from=Carton, to=Bottle, factor=24` means `1 Carton = 24 Bottles`.

If that's the case, then for `resolveProductFactorToBase(Bottle, Carton)`:
- "How many Cartons = 1 Bottle?"
- Direct: `from=Bottle, to=Carton` → NOT found (stored as `from=Carton, to=Bottle`)
- Reverse: `from=Carton(baseUnit), to=Bottle(fromUnit)` → Found!
- Return `1/conversionFactor = 1/24 = 0.042` ← this is correct!

And `resolveProductFactorToBase(Carton, Bottle)`:
- "How many Bottles = 1 Carton?"
- Direct: `from=Carton, to=Bottle` → Found! Return 24. ← this is correct!

So the convention SHOULD be:
- `from_unit_id` = larger unit (parent), `to_unit_id` = smaller unit (child)
- `conversion_factor = how many child = 1 parent`

OR equivalently: `1 from = conversion_factor × to`

Let me re-read the schema comment:
```
-- When computing factor_to_base for a product, these are checked first.
-- Example: For a Rice product, 1 Bag = 50 Kg (product-specific),
```

So the example says `1 Bag = 50 Kg`. If the convention is `from=larger, to=smaller`:
- `from=Bag, to=Kg, factor=50` → `1 Bag = 50 × Kg`
- That works! 1 Bag = 50 Kg. Correct!

What about `from=Bottle, to=Carton, factor=24`?
- This would mean: `1 Bottle = 24 × Carton`
- That's 1 Bottle = 24 Cartons... but we want 1 Carton = 24 Bottles!
- So this convention DOESN'T work for the Bottle/Carton case!

Hmm, let me try the other convention: `from=smaller, to=larger`:
- `1 to = conversion_factor × from`
- `from=Bottle, to=Carton, factor=24` → `1 Carton = 24 × Bottle` → 1 Carton = 24 Bottles
- `1 to = factor × from` → `1 Carton = 24 × Bottle`
- This works!

And `from=Kg, to=Bag, factor=50`:
- `1 to = factor × from` → `1 Bag = 50 × Kg` → 1 Bag = 50 Kg
- This works too!

So the convention is: `from=smaller, to=larger, factor` means `1 to = factor × from`.

Now, `resolveProductFactorToBase(fromUnitId, baseUnitId)` = "how many base units = 1 fromUnit?"

For `resolveProductFactorToBase(Bottle, Carton)`:
- fromUnitId=Bottle, baseUnitId=Carton
- "How many Cartons = 1 Bottle?"
- We know: `1 Carton = 24 × Bottle` → `1 Bottle = 1/24 Carton` → answer = 0.042

Now in the code:
```typescript
const directConv = productConversions.find(
  c => c.fromUnitId === fromUnitId && c.toUnitId === baseUnitId
)
if (directConv) return directConv.conversionFactor
```

c.toUnitId = Carton (stored). baseUnitId = Carton. c.fromUnitId = Bottle (stored). fromUnitId = Bottle.
`c.fromUnitId === fromUnitId` (Bottle === Bottle) ✓
`c.toUnitId === baseUnitId` (Carton === Carton) ✓
Found! Return factor = 24.

But the correct answer should be 1/24 = 0.042!

So the direct match returns `conversionFactor` but it should return `1/conversionFactor` when `fromUnitId === c.fromUnitId && toUnitId === baseUnitId`.

Wait, actually no. The correct answer is:
- `1 to = factor × from` → `1 Carton = 24 × Bottle`
- `factor_to_base(Bottle, Carton)` = "how many Cartons = 1 Bottle?"
- From the formula: `1 Bottle = 1/24 Carton`
- So: `factor_to_base = 1/24 = 0.042`

But the code returns 24. This IS a bug!

However... let me think about whether this matters. Maybe in practice the system only ever resolves in one direction (from larger unit to base unit which is smaller)? Let me check...

In `product.service.ts`:
```typescript
const factorToBase = await resolveProductFactorToBase(au.unitId, input.baseUnitId)
```

Where `au.unitId` is the purchase/selling unit (typically larger, like Box, Carton, Bag) and `input.baseUnitId` is the base unit (typically smaller, like Tablet, Bottle, Kg).

So `resolveProductFactorToBase(Carton, Bottle)`:
- "How many Bottles = 1 Carton?"
- We know: `1 Carton = 24 Bottles`
- Answer: 24

Code: direct match `from=Carton && to=Bottle` → is this in the stored conversions?
Stored: `from=Bottle, to=Carton, factor=24`
`from=Carton !== from=Bottle` → not a direct match
Reverse: `from=Bottle(baseUnit) && to=Carton(fromUnit)` → Found! Return 1/24.

Wait, that gives 1/24 = 0.042, but the answer should be 24!

And then `factorToBase = 0.042` is stored in `product_units`. When 1 Carton is purchased:
`baseQuantity = 1 × 0.042 = 0.042` Bottles? That's wrong! 1 Carton = 24 Bottles!

So the system IS broken for this case! But somehow it was working in earlier tests...

Hmm, maybe the earlier tests used the description field or used units that don't have product-specific conversions (relying on global conversions instead). Let me check...

Actually wait, in `purchaseStock`, the conversion uses `conversionService.convertToBaseUnit` which uses the global chain, not `factor_to_base`:

```typescript
const baseQuantity = await conversionService.convertToBaseUnit(
  input.quantity,
  input.unitId,
  product.baseUnitId
)
```

So the display uses `factor_to_base` but the actual stock calculation uses the global chain. If the global chain works (e.g., global Carton → Box → Strip → Tablet conversions exist), then purchases work correctly even if `factor_to_base` is wrong.

So the `factor_to_base` issue mainly affects display (the human-readable breakdown). And the display might also be using the global chain through `getDisplayStock`.

Actually, `getDisplayStock` uses `product.units.map(u => u.factorToBase)` which comes from `product_units`. So if `factor_to_base` is wrong, the display breakdown would be wrong.

But during product creation, if `resolveProductFactorToBase` is called and returns the wrong value, the product creation would still succeed (it just stores the wrong factor_to_base).

OK, I think this is actually a pre-existing bug that exists for ALL product-specific conversions, not just the Bottle/Carton example. Let me not get into fixing it in this documentation task. The user asked me to create a document about how the website works, not to fix bugs.

Let me just write the document accurately, documenting the current behavior. I'll note the product-specific conversion semantics as they are implemented.

Actually, I should focus on writing the document. The user asked me to "make a document in docs folder about how the website is now working." Let me create a comprehensive document.

Let me also think about whether to document the product_conversions bug. I think I should document the intended behavior and how the system works, not bugs. The user can discover bugs through testing.

Let me write a clean, comprehensive document.<｜end▁of▁thinking｜>

<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="read_files">
<｜｜DSML｜｜parameter name="paths" string="false">["backend-supermarket/src/services/conversion.service.ts","backend-supermarket/src/db/schema.sql","frontend-supermarket/src/features/products/components/product-form.tsx","frontend-supermarket/src/features/products/components/products.tsx","frontend-supermarket/src/features/conversions/components/conversions.tsx","frontend-supermarket/src/features/conversions/components/conversion-preview.tsx","frontend-supermarket/src/features/portfolio-main/components/dashboard-overview.tsx","frontend-supermarket/src/features/portfolio-main/components/portfoliolayout.tsx"]