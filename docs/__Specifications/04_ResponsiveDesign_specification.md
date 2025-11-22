# 📐 Responsive Design Specification

<specification_metadata>
  <created>2025-08-08</created>
  <flow_name>ResponsiveDesign</flow_name>
  <complexity_level>COMPLEX</complexity_level>
  <status>PLANNED</status>
  <related_flows>Layout, Sidebars, Modals, DataWorkbench, Forms, Chat</related_flows>
  <ai_context>Reference spec for responsive behavior across the app</ai_context>
</specification_metadata>

<flow_overview>
  <purpose>
    Establish a single, consistent responsive system that adapts gracefully from small phones to large desktops while preserving current behavior and performance.
  </purpose>
  <user_trigger>
    Viewport size changes, device rotations, and container size changes.
  </user_trigger>
  <end_result>
    No horizontal scrolling on phones, scroll contained to intended regions, modals/drawers always fit viewport, and consistent breakpoint behavior across JS/TS, CSS, and Tailwind utilities.
  </end_result>
  <key_data_transformations>
    None. This is a UI/UX layout concern with configuration and class usage.
  </key_data_transformations>
</flow_overview>

<current_implementation priority="1">
  <entry_points>
    <ui_triggers>
      <trigger_1>CSS Tailwind utilities (e.g., sm:, md:, lg:)</trigger_1>
      <trigger_2>Custom hooks (duplicated useIsMobile at 768px)</trigger_2>
    </ui_triggers>
    <code_entry_points>
      <main_component>App layout in `app/layout.tsx` and `components/layout/MainContent.tsx`</main_component>
      <hook_or_service>`hooks/use-mobile.tsx`, `components/ui/use-mobile.tsx`</hook_or_service>
      <store_slice>N/A</store_slice>
    </code_entry_points>
  </entry_points>

  <core_components>
    <primary_files>
      - `tailwind.config.ts` — Tailwind content scan, container, theme tokens
      - `app/globals.css` — CSS variables and base styles
      - `app/layout.tsx` — Global providers and root structure
      - `components/layout/MainContent.tsx` — Root content height/scroll behavior
    </primary_files>
    <supporting_files>
      - `hooks/use-mobile.tsx` and `components/ui/use-mobile.tsx` — duplicate mobile detection
      - `app/Projects/dataWorkbench/utils/responsiveUtils.ts` — custom breakpoints (320/768/1200)
      - `app/Projects/dataWorkbench/components/ribbon/config/ribbonTabs.ts` — custom breakpoints (480/768/1024/1440)
    </supporting_files>
  </core_components>

  <data_flow_sequence>
    <step_1>
      <action>Viewport change triggers CSS media queries and React matchMedia listeners</action>
      <component>Tailwind utilities and `useIsMobile` hook</component>
      <data_change>N/A</data_change>
    </step_1>
    <step_2>
      <action>Layouts with `h-screen`/`min-h-screen` enforce full-viewport height</action>
      <component>`components/layout/MainContent.tsx`, pages/components using full-height wrappers</component>
      <data_change>N/A</data_change>
    </step_2>
    <step_3>
      <action>Modals/drawers/popovers use fixed positioning and min widths</action>
      <component>DW ribbon groups, form builder panels, chat overlays</component>
      <data_change>N/A</data_change>
    </step_3>
  </data_flow_sequence>
</current_implementation>

<technical_patterns priority="2">
  <architectural_requirements>
    <component_size_limits>Keep components under 1000 lines (hard max 1500) per architecture-spec-v4.md</component_size_limits>
    <infinite_loop_prevention>Follow project rules for stable hooks</infinite_loop_prevention>
    <type_safety>Import types from hierarchy; no duplication</type_safety>
  </architectural_requirements>

  <design_tokens>
    <breakpoints>
      Use Tailwind default breakpoints as the single source of truth:
      - sm: 640px
      - md: 768px
      - lg: 1024px
      - xl: 1280px
      - 2xl: 1536px
    </breakpoints>
    <implementation>
      - Define shared TS constants `BREAKPOINTS` in `lib/ui-constants.ts` (or a new `lib/breakpoints.ts`).
      - Replace custom values in `responsiveUtils.ts` and `ribbonTabs.ts` with imports from the shared constants.
      - Provide a single `useBreakpoint`/`useIsMobile` hook in `hooks/` consuming the shared constants; remove duplicates.
    </implementation>
  </design_tokens>

  <viewport_and_height>
    <rules>
      - Explicitly export `viewport` in `app/layout.tsx` to ensure `<meta name="viewport">`.
      - Prefer `min-h-[100dvh]` for top-level containers; avoid nested `h-screen`.
      - Put `overflow-y-auto` on inner scroll regions to prevent double scrollbars.
    </rules>
  </viewport_and_height>

  <width_and_overflow>
    <rules>
      - Default to fluid width with `w-full min-w-0` in flex/grid children.
      - Replace hard `min-w-[Npx]` with responsive constraints:
        - Example: `w-full min-w-0 sm:min-w-[280px] md:min-w-[320px]` or percentage widths.
      - For wide content (tables/code): wrap with `overflow-x-auto` (standardize this pattern).
    </rules>
  </width_and_overflow>

  <modals_drawers_popovers>
    <rules>
      - Constrain surfaces with `max-w-[min(100vw-2rem, 28rem)]` on phones, scaling at sm/md/lg.
      - Constrain height with `max-h-[min(90dvh,100dvh-2rem)]` and scroll internal content.
      - Drawers on `<lg`: overlay with `max-w-[85vw]` and body scroll lock; on `lg+`: inline fixed width allowed.
    </rules>
  </modals_drawers_popovers>

  <sidebars_navigation>
    <rules>
      - Maintain `lg:hidden`/`lg:block` pattern.
      - On mobile, off-canvas drawers respect `max-w-[85vw]` and use backdrop overlays.
      - Ensure content region has `min-w-0` to avoid overflow.
    </rules>
  </sidebars_navigation>

  <dataworkbench_mobile_policy>
    <rules>
      - Officially support tablet and up for full editing experience.
      - On phones, present a compact read-only or guidance message, ensuring no broken UI.
      - All DW menus/popovers must respect modal/drawer constraints.
    </rules>
  </dataworkbench_mobile_policy>
</technical_patterns>

<integration_points priority="3">
  <dataworkbench>
    Replace custom breakpoints in `utils/responsiveUtils.ts` and `ribbon/config/ribbonTabs.ts` with shared constants; update popover/dialog classes to responsive max sizes.
  </dataworkbench>
  <forms>
    Continue grid-based responsiveness; ensure action bars and sections wrap appropriately on `<sm`.
  </forms>
  <chat>
    Remove nested `h-screen`; ensure sidebar math does not cause double scroll; content `min-w-0`.
  </chat>
  <form_builder>
    Make right preview pane responsive (`w-full min-w-0` on mobile); eliminate rigid min-widths on small screens.
  </form_builder>
</integration_points>

<error_handling priority="3">
  <common_failure_points>
    <validation_failures>Layout overflow on small screens from hard min-widths.</validation_failures>
    <state_sync_failures>Conflicting breakpoint logic across modules.</state_sync_failures>
  </common_failure_points>
  <graceful_degradation>
    On smallest devices, prefer stacked layout and scrollable sections over clipping.
  </graceful_degradation>
</error_handling>

<performance_characteristics priority="4">
  <typical_performance>
    CSS-only responsive changes; negligible runtime impact. Avoid JS layout thrash.
  </typical_performance>
  <optimization_techniques>
    Prefer CSS media queries and container-aware utilities over JS resize observers.
  </optimization_techniques>
</performance_characteristics>

<testing_approach priority="4">
  <manual_testing_scenarios>
    <happy_path>
      - 360×640, 390×844: No horizontal scroll, modals fit viewport.
      - 768×1024: Sidebars usable; drawers overlay correctly.
      - Desktop: No regressions.
    </happy_path>
    <edge_cases>
      - iOS Safari dynamic toolbar: `100dvh` keeps surfaces visible.
      - Long content in modals: internal scrolling without clipping headers/footers.
    </edge_cases>
  </manual_testing_scenarios>
</testing_approach>

<refactoring_considerations priority="4">
  <current_technical_debt>
    - Duplicated `useIsMobile` hook in two locations.
    - Divergent breakpoint constants across DW modules.
    - Widespread rigid `min-w-[...]` values.
    - Nested `h-screen` causing double scrollbars.
  </current_technical_debt>
  <refactoring_opportunities>
    - Centralize tokens and hooks; standardize surface sizing patterns.
  </refactoring_opportunities>
</refactoring_considerations>

<ai_context_notes priority="5">
  <key_concepts>
    Keep behavior backwards-compatible. Make changes additive and responsive-only; avoid breaking props or exports.
  </key_concepts>
  <debugging_tips>
    Use Chrome device toolbar; watch for unexpected horizontal scroll. Add temporary outline utilities to detect overflow (`overflow-x-hidden` vs needed `overflow-x-auto`).
  </debugging_tips>
</ai_context_notes>


