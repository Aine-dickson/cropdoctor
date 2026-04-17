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

## Hybrid uncertainty resolution (planned)

This section documents the agreed design for uncertain or competing crop.health outputs.

### Goal

Keep current detection, advisory, and medicine recommendation flows, but add a robust interpretation layer for uncertain outcomes.

### Non-goal

This does **not** replace the existing Claude advisory flow for treatment guidance.

It only adds state-aware interpretation and prompting for uncertain cases.

### Decision states

Use the top disease suggestions plus confidence separation and family similarity to classify the scan into one state:

| State | Typical condition | User-facing outcome |
| --- | --- | --- |
| Healthy-Strong | `healthy` is top with strong confidence and clear gap from non-healthy candidates | Show healthy result as usual |
| Healthy-Uncertain | `healthy` is top but weak confidence or close non-healthy competitors | Show uncertain healthy message and monitoring guidance |
| Disease-Strong | Non-healthy top suggestion has strong confidence and clear gap | Show standard diagnosis + advisory + medicines |
| Disease-Competing-Same-Family | Top suggestions are close and belong to same family cluster | Show "possible diseases" with family-aware guidance |
| Disease-Competing-Mixed | Top suggestions are close but not same family | Show "possible diseases" with branch-style checks |
| Low-Confidence-Retake | Overall confidence too low for safe diagnosis | Short-circuit to retake-only UI |

### Initial thresholds (defaults)

These values are starting defaults and should be calibrated with production feedback.

- `LOW_CONFIDENCE_RETAKE`: `< 40%`
- `STRONG_CONFIDENCE`: `>= 80%`
- `HEALTHY_STRONG_MIN`: `>= 75%`
- `CANDIDATE_CLOSE_GAP`: `<= 8 percentage points`
- `COMPETING_DISEASE_MIN`: `>= 15%` (for non-healthy alternatives)

### Low-confidence candidate presentation rule

For retake and uncertain views:

1. Rank non-healthy suggestions by probability.
2. If top 2 are close (`gap <= CANDIDATE_CLOSE_GAP`), show both as possible diseases.
3. If the gap is larger, show only the top candidate.
4. Include plant name and confidence percentages in the UI.

### Disease family handling

Use a lightweight family classifier (keyword-based, current helper pattern) to detect overlap.

- If top candidates are close and same family, avoid forcing a single final diagnosis.
- Show family-aware wording: symptoms overlap at early stage and may diverge later.
- Provide safe next checks and conservative actions.

### Claude hybrid prompting modes

Use state-specific prompts in addition to current model routing:

1. `healthy_uncertain`
   - Prohibit definitive healthy wording.
   - Provide monitoring cues and re-scan timing.
2. `disease_competing_same_family`
   - Explain overlap and key visual differentiators.
   - Provide conservative, low-risk next actions.
3. `disease_competing_mixed`
   - Provide branch-by-symptom triage (if X then likely A, if Y then likely B).
4. `retake_only`
   - Return only photo retake instructions and reasons.

### Model routing compatibility

Keep existing routing behavior and extend by state:

- Strong / straightforward states -> Haiku
- Ambiguous / competing states -> Sonnet

### UX behavior for uncertain unhealthy crops

When top disease suggestions are competing:

1. Show status as uncertain diagnosis.
2. Show possible disease(s) based on close-gap rule.
3. Explain why uncertainty exists (competing probabilities, family overlap when applicable).
4. Provide two actions:
   - Retake photo
   - Continue with cautious guidance

### Data contract additions (planned)

Add interpretation metadata from worker to frontend payloads:

- `diagnosisState`
- `possibleDiseases`
- `confidenceGap`
- `sameFamilyCluster`
- `healthyUncertain`

These fields should be additive and should not break existing advisory fields.

### Rollout plan

1. Add state classification and payload metadata in worker.
2. Add uncertain/retake UI states in scan and results flows.
3. Add state-specific Claude prompt templates.
4. Monitor production feedback and tune thresholds per crop type.

### Guardrails

- Do not show definitive healthy messaging for `Healthy-Uncertain`.
- Do not invent unavailable medicines.
- Keep short-circuit retake behavior for very low-confidence scans.
- Preserve the current advisory + medicine recommendation pipeline for strong diagnoses.

## File-by-file implementation checklist

Use this checklist when implementing the hybrid uncertainty strategy.

### Phase 1: Worker classification + payload metadata

1. [cloudflare-worker/dashboard-worker.js](../cloudflare-worker/dashboard-worker.js)
   - Add final diagnosis state classifier (`diagnosisState`) from top suggestions.
   - Add `confidenceGap` between top 1 and top 2 non-healthy suggestions.
   - Add `sameFamilyCluster` boolean for close competing suggestions.
   - Add `healthyUncertain` boolean for weak "healthy" top results.
   - Keep `possibleDiseases` selection rule (top 2 if close, else top 1).
   - Keep existing retake short-circuit for very low confidence.
2. [cloudflare-worker/src/index.ts](../cloudflare-worker/src/index.ts)
   - Mirror all dashboard worker logic and types.
   - Ensure the response contract includes all additive fields.

### Phase 2: Frontend typing + state wiring

1. [src/lib/agriAi.ts](../src/lib/agriAi.ts)
   - Extend response types with:
     - `diagnosisState`
     - `possibleDiseases`
     - `confidenceGap`
     - `sameFamilyCluster`
     - `healthyUncertain`
   - Keep existing advisory request/response contracts unchanged.
2. [src/stores/detection.ts](../src/stores/detection.ts)
   - Carry new metadata into store result.
   - Continue storing retake state as a structured result object.
   - Keep enrichment calls disabled for retake short-circuit states.

### Phase 3: UI behavior by diagnosis state

1. [src/views/ScanView.vue](../src/views/ScanView.vue)
   - Keep retake-only packaged UI when `needsRetake` is true.
   - Show plant + possible disease candidates + retake guidance + retake action.
2. [src/views/ResultsView.vue](../src/views/ResultsView.vue)
   - Add uncertain-state rendering for:
     - `Healthy-Uncertain`
     - `Disease-Competing-Same-Family`
     - `Disease-Competing-Mixed`
   - Show confidence caveats and candidate alternatives clearly.
   - Keep strong-state flow unchanged (advisory + recommendations).

### Phase 4: Claude hybrid prompting (state-aware)

1. [cloudflare-worker/dashboard-worker.js](../cloudflare-worker/dashboard-worker.js)
   - Add prompt mode selection by diagnosis state.
   - Keep model routing compatibility:
     - Haiku for strong straightforward states.
     - Sonnet for ambiguous/competing states.
2. [cloudflare-worker/src/index.ts](../cloudflare-worker/src/index.ts)
   - Mirror prompt mode logic and route selection.

### Phase 5: QA and release checks

1. Scenario tests (manual or automated)
   - Healthy strong result.
   - Healthy uncertain (healthy top with close disease competitors).
   - Disease strong result.
   - Competing disease same-family result.
   - Competing disease mixed-family result.
   - Low-confidence retake short-circuit.
2. Regression checks
   - Existing advisory flow remains intact.
   - Existing medicine recommendation mapping remains intact.
   - No invented recommendations when catalogue match is missing.

### Acceptance criteria

Implementation is complete when all are true:

1. Uncertain healthy outputs no longer render as definitive healthy.
2. Competing disease outputs show possible disease alternatives and clear caveats.
3. Retake short-circuit remains focused and action-oriented.
4. Existing strong-diagnosis advisory + medicine recommendation flow is unchanged.