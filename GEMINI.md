# Gemini Rules

## Writing Style
- **Always write compact.** Only include necessary and useful information.
- No filler, no redundancy, no verbose explanations.

## Comparisons
- **Always use tables** for comparisons (approaches, libraries, trade-offs, etc.).

## UI/UX Architecture (Required for Every Feature)

### 1. Element Structure Map
Write a full tree/map of all UI elements for the feature.

### 2. Component Analysis
For each element in the map:
- **Exists?** → Link the component in the plan (e.g., `[ComponentName](file:///path/to/Component.tsx)`).
- **Doesn't exist?** → Mark as `[CREATE COMPONENT]` with a brief spec.

### 3. Layout & Interaction Spec
- Define layout relationships (parent → child, flex/grid, spacing).
- Define interaction states (hover, active, disabled, loading).
- Define responsive behavior if applicable.
