# Unit Conversion — How It Works

## Overview

The supermarket inventory system allows you to define **conversion relationships** between different units of measurement. For example:

- 1 **Box** = 10 **Strips**
- 1 **Strip** = 10 **Tablets**
- 1 **Kilogram** = 1000 **Grams**

These relationships form a **conversion chain** — a directed path from a larger (parent) unit down to a smaller (child) unit.

---

## Core Concept: The Conversion Factor

Each conversion is stored as a single row in the `conversions` table:

| Column          | Meaning                              |
|-----------------|--------------------------------------|
| `parent_unit_id` | The larger unit (e.g. Box)           |
| `child_unit_id`  | The smaller unit (e.g. Strip)        |
| `factor`         | Multiplier to convert parent → child |

### The Rule

> **1 parent_unit = factor × child_unit**

Or equivalently:

```
quantity_in_child_units = quantity_in_parent_units × factor
```

### Seed Data Example

| Parent | Child  | Factor | Equation               |
|--------|--------|--------|------------------------|
| Box    | Strip  | 10     | 1 Box = 10 Strips      |
| Strip  | Tablet | 10     | 1 Strip = 10 Tablets   |
| kg     | g      | 1000   | 1 kg = 1000 g          |

---

## The Mathematics

### Single-Step Conversion

If you have a direct conversion record from unit A → unit B with factor `f`:

```
B_quantity = A_quantity × f
```

**Example:** 3 Boxes → Strips

```
Strips = 3 Boxes × 10 (factor) = 30 Strips
```

### Chained (Multi-Step) Conversion

A unit may not have a direct conversion to the desired target. The system **walks the chain** by repeatedly applying the factor of each link.

Given a chain of conversions:

```
Unit₁ --(factor₁)--> Unit₂ --(factor₂)--> Unit₃ --(...)--> Unitₙ
```

The total quantity at the end is:

```
quantityₙ = quantity₁ × factor₁ × factor₂ × ... × factorₙ₋₁
```

Or using product notation:

```
                    n-1
quantityₙ = quantity₁ × ∏ factorᵢ
                    i=1
```

### Worked Example

Seed data chain: **Box → Strip → Tablet**

Starting with **5 Boxes**:

| Step | Unit   | Calculation      | Quantity |
|------|--------|------------------|----------|
| 0    | Box    | 5 (starting)     | 5        |
| 1    | Strip  | 5 × 10 = 50      | 50       |
| 2    | Tablet | 50 × 10 = 500    | 500      |

```
5 Boxes = 5 × 10 Strips = 50 Strips
50 Strips = 50 × 10 Tablets = 500 Tablets
```

> **Final result: 5 Boxes = 500 Tablets**

---

## The Algorithm (`getConversionPreview`)

Located in `backend-supermarket/src/controllers/conversion.controller.ts`, the `getConversionPreview` function implements this logic:

```
1. Fetch the starting unit by ID
2. Initialize: currentId = unitId, currentQty = quantity
3. Loop (max 20 iterations to prevent infinite loops):
   a. Query: "SELECT child_unit_id, factor FROM conversions WHERE parent_unit_id = currentId"
   b. If no row found → break (end of chain)
   c. Apply factor: currentQty = currentQty × factor
   d. Move down: currentId = child_unit_id
   e. Record the step with currentQty and unit name
4. Return array of all steps
```

### Pseudocode

```
function previewConversion(quantity, startUnitId):
    steps = [{ unit: startUnit, quantity }]
    currentId = startUnitId
    currentQty = quantity

    for i = 0 to 19:
        conversion = db.query("SELECT child_unit_id, factor
                               FROM conversions
                               WHERE parent_unit_id = $1
                               LIMIT 1", [currentId])

        if no conversion found → break

        currentQty = currentQty × conversion.factor
        currentId = conversion.child_unit_id

        childUnit = db.query("SELECT id, name, symbol
                              FROM units WHERE id = $1", [currentId])

        steps.append({ unit: childUnit, quantity: currentQty })

    return steps
```

### Safety Limit

- **Max 20 iterations** prevents infinite loops caused by circular conversion chains.
- Each conversion row is validated to have `parent_unit_id ≠ child_unit_id` (database constraint `ck_different_units`).
- The chain is **unidirectional**: it always walks parent → child (downward to smaller units).

---

## API Endpoint

| Method | Path                          | Description                        |
|--------|-------------------------------|------------------------------------|
| `POST` | `/api/conversions/preview`    | Preview a conversion chain         |

### Request Body

```json
{
  "quantity": 5,
  "unitId": "00000000-0000-0000-0000-000000000001"
}
```

### Response

```json
{
  "steps": [
    { "unitId": "...", "unitName": "Box",   "unitSymbol": "bx",  "quantity": 5 },
    { "unitId": "...", "unitName": "Strip", "unitSymbol": "st",  "quantity": 50 },
    { "unitId": "...", "unitName": "Tablet","unitSymbol": "tab", "quantity": 500 }
  ]
}
```

---

## Database Schema

The `conversions` table:

```sql
CREATE TABLE conversions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_unit_id  UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  child_unit_id   UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  factor          NUMERIC(15, 6) NOT NULL CHECK (factor > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_conversion_pair UNIQUE (parent_unit_id, child_unit_id),
  CONSTRAINT ck_different_units CHECK (parent_unit_id != child_unit_id)
);
```

Key constraints:
- `factor > 0` — factor must always be positive
- `parent_unit_id ≠ child_unit_id` — a unit cannot convert to itself
- `UNIQUE(parent_unit_id, child_unit_id)` — no duplicate conversion pairs

---

## Frontend API Client

The frontend communicates with the backend using **native `fetch`** calls (not axios). These are organized in `frontend-supermarket/src/lib/api.ts`.

### API Client Structure

```typescript
const API_BASE = '/api'

// Generic helpers using fetch
function get<T>(path): Promise<T>
function post<T>(path, body): Promise<T>
function patch<T>(path, body): Promise<T>
function del<T>(path): Promise<T>
```

### Conversion API

```typescript
export const conversionsApi = {
  getAll:   ()          => get<ConversionRow[]>('/conversions'),
  getById:  (id)        => get<ConversionRow>(`/conversions/${id}`),
  create:   (input)     => post<ConversionRow>('/conversions', input),
  update:   (id, input) => patch<ConversionRow>(`/conversions/${id}`, input),
  delete:   (id)        => del(`/conversions/${id}`),
  preview:  (qty, uid)  => post<PreviewResult>('/conversions/preview', { quantity, unitId }),
}
```

All API calls use `fetch` with `Content-Type: application/json` headers and JSON serialization. Error responses are parsed from the body and thrown as JavaScript `Error` objects.
