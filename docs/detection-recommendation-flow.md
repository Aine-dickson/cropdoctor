# Detection to Recommendation Flow

This note documents the current disease detection pipeline and the places that may need updates if the AI output, catalogue, or stock handling changes later.

## Current flow

1. **Scan flow** uploads an image and sends it to Plant.id for disease detection.
2. The detected disease is passed to the AI enrichment layer for a summary, steps, and related disease terms.
3. The app maps that disease and those search terms to medicines in the local catalogue.
4. Results, describe, and search views reuse the same shared AI and catalogue helpers.

## Shared pieces

- [src/lib/agriAi.ts](../src/lib/agriAi.ts) controls AI response parsing and fallback behavior.
- [src/lib/medicineCatalog.ts](../src/lib/medicineCatalog.ts) defines the product catalogue and the disease-to-product lookup.
- [src/stores/detection.ts](../src/stores/detection.ts) wires scan results to AI enrichment and catalogue mapping.

## What may require future updates

### 1. If the AI response shape changes

Update [src/lib/agriAi.ts](../src/lib/agriAi.ts) first.

Keep the output contract stable if possible:

- `summary`
- `steps`
- `relatedDiseases`
- `searchTerms`
- `disease`
- `confidence`

If the model starts returning extra fields, add them here and let the views consume them through the shared helpers rather than directly from raw AI output.

### 2. If the product catalogue changes

Update [src/lib/medicineCatalog.ts](../src/lib/medicineCatalog.ts).

This is the single source of truth for:

- product identity
- display metadata
- disease mapping
- browse/search/product detail lookup

If a product is renamed or diseases are reclassified, only this file should need a change in the normal case.

### 3. If the detection model changes

Update [src/stores/detection.ts](../src/stores/detection.ts).

This is where image detection is called and where scan results are enriched before the UI receives them.

### 4. If search or describe logic changes

Update [src/views/SearchView.vue](../src/views/SearchView.vue) and [src/views/DescribeView.vue](../src/views/DescribeView.vue) only if their UI needs to present different sections.

The actual AI and mapping logic should remain in the shared helpers, not duplicated in the views.

## How to handle recommendations that are not in catalogue

This is currently handled as a **no catalogue match** state.

That means:

- AI can still explain the disease.
- The app does **not** invent product recommendations.
- The UI tells the user that there is no direct match in the current catalogue and suggests Browse/Search or a refined diagnosis.

This is the correct behavior for items we do not sell or do not map yet.

## How to handle out-of-stock products later

There is no real stock model in the app yet, so we cannot truthfully mark products as out of stock today.

If stock tracking is added later, the recommended approach is:

1. Add a stock field to the product model, for example `stock`, `isAvailable`, or `inventoryCount`.
2. Update [src/lib/medicineCatalog.ts](../src/lib/medicineCatalog.ts) to expose that field.
3. Filter or badge products in Results/Search/Browse based on availability.
4. In the UI, distinguish between:
   - `no catalogue match` - we do not sell a mapped product
   - `out of stock` - we sell it, but it is temporarily unavailable

Suggested UI wording for out-of-stock cases:

- `Recommended treatment is currently out of stock.`
- `We found a match, but it is not available right now. Try a similar alternative below.`

## Suggested update rule

When the AI or product mapping flow changes, update in this order:

1. [src/lib/agriAi.ts](../src/lib/agriAi.ts)
2. [src/lib/medicineCatalog.ts](../src/lib/medicineCatalog.ts)
3. [src/stores/detection.ts](../src/stores/detection.ts)
4. The relevant view files only if the UI needs new sections or labels

This keeps the flow predictable and avoids duplicating business rules in multiple views.