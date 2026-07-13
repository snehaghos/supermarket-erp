# Unit Conversion — How It Works

## Welcome!

This guide explains how the supermarket inventory system handles **unit conversions**.
We'll walk through the concepts step-by-step with real supermarket examples.

If you're new to the codebase, start here. This document is written for **beginner developers** who understand basic JavaScript, TypeScript, functions, and database queries.

---

## 🛒 Real-World Example

Imagine you work in a pharmacy. Your inventory has:

- **Boxes** of medicine
- **Strips** (a packet inside the box)
- **Tablets** (individual pills inside the strip)

If each **Box** contains 10 **Strips**, and each **Strip** contains 10 **Tablets**:

> **1 Box = 10 Strips = 100 Tablets**

That's a **conversion chain** — you can convert a larger unit (Box) down to smaller units (Strips, then Tablets).

---

## How the Database Stores Conversions

Each conversion relationship is stored as **one row** in the `conversions` table.

### The Conversion Table

| Column          | Meaning                                   | Example            |
|-----------------|-------------------------------------------|--------------------|
| `parent_unit_id` | The larger unit (the "parent")            | Box                |
| `child_unit_id`  | The smaller unit (the "child")            | Strip              |
| `factor`         | How many child units equal one parent     | 10                 |

### The Simple Rule

> **1 Parent = Factor × Child**

Or, put another way:

> **quantity_in_child_units = quantity_in_parent_units × factor**

### Seed Data Examples

| Parent   | Child    | Factor | Meaning                |
|----------|----------|--------|------------------------|
| Box      | Strip    | 10     | 1 Box = 10 Strips      |
| Strip    | Tablet   | 10     | 1 Strip = 10 Tablets   |
| Kilogram | Gram     | 1000   | 1 kg = 1000 grams      |
| Tonne    | Kilogram | 1000   | 1 Tonne = 1000 kg      |
| Dozen    | Pieces   | 12     | 1 Dozen = 12 Pieces    |

---

## How the Code Works

The conversion logic lives in **three separate layers**:

### 1. Repository Layer (`repositories/conversion.repository.ts`)

**Purpose:** Only talks to the database. Contains SQL queries.

Key function:
- `getByParentId(parentId)` — Looks up the conversion for a given parent unit.
  Returns the child unit ID and the factor.
  Returns `null` if no conversion exists for that parent.

```typescript
// Example: What is the conversion where Box is the parent?
const result = await getByParentId('box-uuid')
// Result: { childUnitId: 'strip-uuid', factor: 10 }
```

### 2. Service Layer (`services/conversion.service.ts`)

**Purpose:** Contains all business logic and rules. Coordinates between the controller and the repository.

Key functions:
- `getConversionPreview(quantity, unitId)` — The main algorithm that walks the chain.
- `validateNoCircularChain(parentId, childId)` — Prevents infinite loops in the database.

### 3. Controller Layer (`controllers/conversion.controller.ts`)

**Purpose:** Only handles HTTP requests and responses. Very thin — just calls the service.

---

## The Conversion Preview Algorithm (Step by Step)

This is the core algorithm. It's in `services/conversion.service.ts`, in the function called `getConversionPreview`.

### What It Does

Given a starting quantity and a unit, it walks the conversion chain downward — from larger units to smaller units — multiplying by the factor at each step.

### Step-by-Step Walkthrough

Let's trace through an example with the seed data:

> **Question:** How many Tablets are in 5 Boxes?

The chain is: **Box → Strip → Tablet**

Here's what the code does:

```
Step 0: Start with 5 Boxes
         → Record: { unit: Box, quantity: 5 }

Step 1: Find conversion: Box → Strip (factor = 10)
         → Multiply: 5 × 10 = 50
         → Record: { unit: Strip, quantity: 50 }

Step 2: Find conversion: Strip → Tablet (factor = 10)
         → Multiply: 50 × 10 = 500
         → Record: { unit: Tablet, quantity: 500 }

Step 3: No more conversions for Tablet → end of chain
         → Return all steps
```

**Final answer: 5 Boxes = 500 Tablets**

### The Code, Explained

```typescript
// This function walks from a starting unit down the conversion chain.
// It returns an array of "steps" showing the quantity at each unit level.
export async function getConversionPreview(
  quantity: number,   // The starting quantity (e.g., 5)
  unitId: string       // The starting unit's ID (e.g., Box)
): Promise<ConversionStep[]> {
```

**Step 1 — Find the starting unit**

```typescript
  const steps: ConversionStep[] = []

  // Look up the starting unit in the database
  const startingUnit = await unitRepository.getById(unitId)

  // If the unit doesn't exist, throw a 404 error
  if (!startingUnit) {
    throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND')
  }

  // Record the starting step with the original quantity
  steps.push({
    unitId: startingUnit.id,
    unitName: startingUnit.name,
    unitSymbol: startingUnit.symbol,
    quantity,
  })
```

**Step 2 — Walk down the chain**

```typescript
  // Start with the given unit and quantity
  let currentUnitId = unitId
  let currentQuantity = quantity

  // Safety limit: prevent infinite loops (see "Safety" section below)
  let stepsRemaining = MAX_CONVERSION_CHAIN_DEPTH

  // Keep looping as long as we haven't hit the safety limit
  while (stepsRemaining > 0) {
    // Count down so we don't loop forever
    stepsRemaining--

    // Look for a conversion where the current unit is the PARENT
    // For example: if current is Box, find "Box → Strip"
    const conversion = await conversionRepository.getByParentId(currentUnitId)

    // If no conversion found, we've reached the end of the chain
    // For example: Tablet has no child conversion, so we stop
    if (!conversion) break

    // Apply the conversion factor
    // For example: 5 Boxes × 10 = 50 Strips
    currentQuantity = currentQuantity * conversion.factor

    // Move to the child unit for the next iteration
    // For example: now check if Strip has a child
    currentUnitId = conversion.childUnitId

    // Look up the child unit's name and symbol for display
    const childUnit = await unitRepository.getById(currentUnitId)

    // Record this step in the chain
    steps.push({
      unitId: currentUnitId,
      unitName: childUnit?.name ?? 'Unknown',
      unitSymbol: childUnit?.symbol ?? '',
      quantity: currentQuantity,
    })
  }

  // Return the full chain of conversion steps
  return steps
```

### The Loop — Visualized

```
┌─────────────────────────────────────────────────────┐
│                     Loop starts                      │
│                                                      │
│  1. Ask: "Does current unit have a child conversion?"│
│     ┌──────────┐                                     │
│     │  YES ═══► │ Multiply quantity × factor          │
│     │          │ Move to child unit                  │
│     │          │ Record the step                     │
│     │          │ Go back to step 1                   │
│     └──────────┘                                     │
│                                                      │
│     ┌──────────┐                                     │
│     │  NO  ════► │ End of chain — stop looping       │
│     └──────────┘                                     │
└─────────────────────────────────────────────────────┘
```

---

## Safety: Preventing Infinite Loops

### The Maximum Iteration Limit

A conversion chain *should* always go from larger units to smaller units
(e.g., Box → Strip → Tablet). But what if someone accidentally creates
a circular chain like **Box → Strip → Box**?

Without protection, the loop would never end! Here's how the code
prevents that:

```typescript
// This constant is defined at the top of the service file
const MAX_CONVERSION_CHAIN_DEPTH = 20
```

The loop stops after **20 iterations** maximum. This is a simple safety net.

### Preventing Circular Chains (Before They're Created)

The code also **prevents circular chains from being created** in the first place.
This validation happens in the `create` and `update` functions.

#### How It Works

When someone tries to create a new conversion (e.g., Tablet → Box):

1. Start from the **child** unit (Tablet)
2. Walk the conversion chain forward: does Tablet have a child? → No? Chain ends.
3. Since we never reached the **parent** unit (Box), this conversion is safe.

But if someone tries to create **Tablet → Box** when the chain is already
**Box → Strip → Tablet**:

1. Start from the **child** (Tablet — wait, the child is Box in this new conversion)
2. Wait — let's think about this more carefully.

Actually, the rule is:

```
If a chain already exists from child → ... → parent,
then adding parent → child would create a loop.
```

So when creating **Box → Strip**, check: does Strip already have a path to Box?
If the chain is Box → Strip → Tablet, and someone creates Tablet → Box,
the check is: does Tablet have a path to Box?

1. Start from Tablet (child of the new conversion)
2. Tablet has no child → chain ends
3. Never reached Box → this conversion is safe

What about creating **Strip → Box** when Box → Strip already exists?

1. Start from Box (child of Strip → Box)
2. Box's child is Strip
3. Strip equals the parent of the new conversion → **Circular! Reject!**

```typescript
export async function validateNoCircularChain(
  parentUnitId: string,
  childUnitId: string
): Promise<void> {
  // Start from the child unit and walk forward through the conversion chain
  let currentUnitId = childUnitId
  let stepsChecked = 0

  // Walk the chain, checking up to MAX_CONVERSION_CHAIN_DEPTH steps
  while (stepsChecked < MAX_CONVERSION_CHAIN_DEPTH) {
    stepsChecked++

    // Find the conversion where the current unit is the parent
    const nextConversion = await conversionRepository.getByParentId(currentUnitId)

    // If this unit has no child, the chain ends — no circular path
    if (!nextConversion) break

    // If the child of this conversion is the original parent unit,
    // then adding the new conversion would create a loop
    if (nextConversion.childUnitId === parentUnitId) {
      throw new AppError(
        400,
        'This conversion would create a circular chain',
        'CIRCULAR_CONVERSION_CHAIN'
      )
    }

    // Move to the next unit in the chain and continue checking
    currentUnitId = nextConversion.childUnitId
  }
}
```

---

## The Conversion Factor

The **factor** is simply a multiplier:

> **quantity_in_child = quantity_in_parent × factor**

| Factor | Meaning                              |
|--------|--------------------------------------|
| 10     | The child unit is 10× smaller        |
| 1000   | The child unit is 1000× smaller      |
| 12     | The child unit is 12× smaller        |

The factor must always be **greater than 0**. This is enforced by the
database (CHECK constraint) and by the validation middleware.

---

## Summary

### How the Code is Organized

```
Controller (HTTP) ──> Service (Business Logic) ──> Repository (SQL)
     │                       │                           │
     │  Receives request     │  Validates rules           │  Queries database
     │  Returns response     │  Calls repository          │  Returns raw data
     │  No SQL / No logic    │  Throws errors             │  No logic
```

### Key Points to Remember

1. **Conversions are directional**: always from parent (larger) → child (smaller).
2. **1 parent = factor × child** is the only conversion formula.
3. **Multiply, never divide**: you always multiply the quantity by the factor.
4. **The chain walks downward**: larger units → smaller units, step by step.
5. **Safety limit of 20 steps**: prevents infinite loops.
6. **Circular chains are rejected** before they can be created.
7. **Each layer has one job**: controller (HTTP), service (logic), repository (SQL).

### Common Confusions

**Q: Why don't we use division?**
A: The conversion model is always 1 parent = factor × child.
   To go from parent to child, you multiply by the factor.
   In our system, we always convert *downward* (larger → smaller),
   so we always multiply. Division is never needed.

**Q: What if I want to go from smaller to larger (e.g., Tablets → Boxes)?**
A: This system only supports parent → child conversions.
   To go backward, you would need the reverse conversion to be defined
   (which would create a circular chain — see the safety section above).

**Q: Why not use a graph or recursion?**
A: The chain model is simpler to understand and debug.
   Each unit has at most one child conversion, so the "chain" is really
   a simple linked list. No need for complex graph traversal algorithms.

---

## API Reference

### `POST /api/conversions/preview`

Preview a conversion chain.

**Request:**
```json
{
  "quantity": 5,
  "unitId": "00000000-0000-0000-0000-000000000001"
}
```

**Response:**
```json
{
  "steps": [
    { "unitId": "...", "unitName": "Box",   "unitSymbol": "BOX",  "quantity": 5 },
    { "unitId": "...", "unitName": "Strip", "unitSymbol": "ST",   "quantity": 50 },
    { "unitId": "...", "unitName": "Tablet","unitSymbol": "TAB",  "quantity": 500 }
  ]
}
```
