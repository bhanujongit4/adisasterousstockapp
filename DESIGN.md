# Design System Document

## 1. Overview & Creative North Star: "The Obsidian Architect"

This design system is engineered for the high-stakes environment of premium financial analysis. The "Creative North Star" is **The Obsidian Architect**—a philosophy that treats the UI as a precision instrument carved from dark, monolithic glass. 

In a world of cluttered trading terminals, this system prioritizes **tonal depth over structural noise**. We break the "template" look by eschewing generic grids in favor of intentional asymmetry and layered information density. This is not just a dashboard; it is a sophisticated workspace that uses editorial typography scales and "glassmorphic" layering to ensure that even at maximum data density, the user feels a sense of calm authority and crystalline clarity.

---

## 2. Colors: Depth and Meaning

The palette is rooted in deep charcoal tones, providing a low-strain environment for long-duration analysis, punctuated by high-performance accents.

### Surface Hierarchy & Nesting
Instead of using lines to separate modules, we use the **Nesting Principle**. Hierarchy is defined by shifting background tones:
- **Base Layer:** `surface` (#121315) for the primary application background.
- **Sectioning:** Use `surface_container_low` (#1b1c1e) for large layout blocks.
- **Actionable Cards:** Place `surface_container` (#1f2022) or `surface_container_high` (#292a2c) inside those sections to create a natural, "lifted" feel.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section off UI components. Boundaries must be defined solely through background color shifts. A `surface_container_highest` module sitting on a `surface` background provides all the definition needed without the visual "vibration" of high-contrast lines.

### Signature Accents
- **Gains/Primary:** Use `primary` (#4edea3) for positive market movement and primary actions.
- **Losses/Tertiary:** Use `tertiary_container` (#ff7a73) for negative data, creating a sophisticated crimson tone rather than a jarring bright red.
- **Glassmorphism:** For floating menus or overlays, use `surface_variant` (#343537) at 60% opacity with a `backdrop-blur` of 20px. Use a subtle gradient transition from `primary` to `primary_container` for hero CTA buttons to add "soul" to the interface.

---

## 3. Typography: Editorial Authority

We use a high-end, Grotesque sans-serif (Inter/SF Pro) to convey a modern financial look.

*   **Display Scale:** Use `display-lg` (3.5rem) only for primary ticker prices. It should feel monumental.
*   **Monospace Integration:** All numerical data values (prices, percentages, volumes) must use a Monospaced variant of the font to ensure vertical alignment in data tables and ticker tapes.
*   **Hierarchy via Weight:** Contrast `label-sm` (all-caps, tracked out +10%) for section headers with `title-lg` for asset names. This creates an editorial feel that guides the eye through dense data sets.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are forbidden. We achieve depth through **Ambient Light and Tonal Stacking**.

### The Layering Principle
Stacking follows a logical progression: `surface_container_lowest` (furthest back) to `surface_bright` (closest to user). This mimics the stacking of physical glass panes.

### Ambient Shadows & Ghost Borders
- **Shadows:** When a component must float (e.g., a context menu), use a shadow color tinted with `on_surface` at 6% opacity, with a 32px blur and 16px spread. It should feel like an ambient glow, not a dark smudge.
- **The Ghost Border:** For high-density data cells where separation is critical for accessibility, use the `outline_variant` (#3c4a42) at 15% opacity. This "Ghost Border" provides a hint of structure without breaking the seamless Obsidian aesthetic.

---

## 5. Components: Precision Primitives

### Cards & Modules
Cards use the `md` (0.375rem) or `sm` (0.125rem) roundedness scale. Forbid the use of dividers; use `spacing-4` (0.9rem) or `spacing-6` (1.3rem) of vertical white space to separate content chunks.

### Buttons
- **Primary:** A subtle gradient from `primary` to `primary_container`. Text: `on_primary_fixed`.
- **Secondary:** Ghost style. Transparent background with a `Ghost Border` and `primary` text.
- **Tertiary:** No background. `on_surface_variant` text, shifting to `on_surface` on hover.

### High-Density Data Inputs
- **Input Fields:** Use `surface_container_highest` for the field background. No bottom line; instead, use a 1px `outline_variant` at 20% opacity. 
- **Chips:** For filters or active indicators, use a low-radius `sm` (0.125rem) with `surface_variant` background. Active states should glow with a subtle `primary` outer glow.

### Terminal-Specific Components
- **The P&L Ribbon:** A full-width element using `surface_container_lowest` to "recess" it into the UI, making the `primary` (gains) and `tertiary` (losses) values pop against the deepest black.
- **The Glass Chart Overlay:** Chart controls (Timeframe, Indicators) should be housed in a `Glassmorphic` floating bar at the top of the viewport.

---

## 6. Do's and Don'ts

### Do:
- **Use Intentional Asymmetry:** Align high-level stats to the right while labels stay left to create a dynamic, modern layout.
- **Embrace Breathing Room:** Even in high-density views, use the `spacing-8` (1.75rem) scale to let major sections breathe.
- **Contextual Tinting:** Use subtle background tints (e.g., 5% `primary` overlay) on cards containing positive data to reinforce sentiment without words.

### Don't:
- **No Divider Lines:** Never use a 100% opaque line to separate list items. Use the spacing scale or tonal shifts.
- **No Pure White:** Never use #FFFFFF. The brightest text should be `on_surface` (#e3e2e5) to maintain the sophisticated dark-mode harmony.
- **No Default Radius:** Avoid large, bubbly corners. Stick strictly to the `sm` and `md` scales (0.125rem - 0.375rem) to maintain a professional, terminal-like precision.