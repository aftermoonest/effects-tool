# Claude Code Rules

## Writing Style
- **Always write compact.** Only include necessary and useful information.
- No filler, no redundancy, no verbose explanations.

## Comparisons
- **Always use tables** for comparisons (approaches, libraries, trade-offs, etc.).

## UI/UX Architecture (Required for Every Feature)

### 1. Element Structure Map
Write a full tree/map of all UI elements for the feature.

### 2. Design Decisions
- Define design decisions (layout, interaction, etc.).
- Define edge cases.
- Define design relationships (parent → child, global → local).
- Define design management strategy (props, context, global state).

### 2. Component Analysis
For each element in the map:
- **Exists?** → Link the component in the plan (e.g., `[ComponentName](file:///path/to/Component.tsx)`).
- **Doesn't exist?** → Mark as `[CREATE COMPONENT]` with a brief spec.

### 3. Layout & Interaction Spec
- Define layout relationships (parent → child, flex/grid, spacing).
- Define interaction states (hover, active, disabled, loading).
- Define responsive behavior if applicable.

### 4. State Management
- Define state requirements (props, local state, global state).
- Define state relationships (parent → child, global → local).
- Define state management strategy (props, context, global state). 

### 5. Event Handling
- Define event relationships (parent → child, global → local).
- Define event management strategy (props, context, global state).

### 6. Styling
- Define styling relationships (parent → child, global → local).
- Define styling management strategy (props, context, global state).

### 7. Testing
- Define testing requirements (unit tests, integration tests, end-to-end tests).
- Define testing relationships (parent → child, global → local).
- Define testing management strategy (props, context, global state).

### 8. Performance
- Define performance requirements (memory, CPU, etc.).
- Define performance relationships (parent → child, global → local).
- Define performance management strategy (props, context, global state).

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Delete` / `Backspace` | Delete active layer |
| `Shift + Delete` | Delete active effect |
| `Ctrl/Cmd + Z` | Undo transform |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo transform |
| `Arrow Keys` | Nudge active image layer (1px) |
| `Shift + Arrow Keys` | Nudge active image layer (10px) |
| `Space` (hold) | Pan canvas |

- Shortcuts are disabled when a text input is focused (`isTextInputTarget` guard).
- Handled globally via `window` keydown listener in `CanvasViewport.tsx`.

## Effect Rendering Rules

### Effect Categories & Compositing

| Category | Effects | Compositing |
|----------|---------|-------------|
| Color Adjustments | brightness_contrast, black_white, levels, curves, selective_color | **Overlay** — blends with original via blend mode + opacity |
| Stylization & Generative Art | ascii, dithering, stippling, cellular_automata | **Replace** — effect output replaces the original image entirely |
| Filters & Convolutions | unsharp_mask, find_edges, minimum, add_noise, ripple | **Overlay** — blends with original via blend mode + opacity |

### Key Rules
- **Stylization & Generative Art effects must NEVER show the original image underneath.** They transform/replace the image, not overlay it. Controlled via `Compositor.GENERATIVE_EFFECT_TYPES`.
- New effects added to this category must be registered in `Compositor.GENERATIVE_EFFECT_TYPES`.
- Effects panel: all effects default to **collapsed** (`useState(false)` in `SortableEffectCard`).

