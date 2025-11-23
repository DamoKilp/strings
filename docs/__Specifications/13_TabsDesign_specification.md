# Tabs Design Specification
**Purpose**: AI reference document for implementing consistent, space-efficient tabbed interfaces across the application.

<specification_metadata>
  <created>2025-01-15</created>
  <flow_name>Tabs Design Pattern</flow_name>
  <complexity_level>SIMPLE</complexity_level>
  <status>IMPLEMENTED</status>
  <related_flows>Predictive Modelling, Page Layouts, UI Components</related_flows>
  <ai_context>Reference specification for AI understanding of tab design patterns with minimal vertical space and top positioning</ai_context>
</specification_metadata>

<critical_requirements priority="1">
  <positioning>
    <rule>Tabs MUST always be positioned at the top of the page/container</rule>
    <rule>Tabs container uses flex-shrink-0 to prevent compression</rule>
    <rule>Tabs are the first element in the content area</rule>
  </positioning>

  <vertical_space>
    <rule>Minimal vertical padding - use p-2 for container, py-1 for TabsList</rule>
    <rule>TabsTrigger uses py-1.5 sm:py-2 (minimal vertical padding)</rule>
    <rule>TabsContent uses mt-0 (no top margin)</rule>
    <rule>Container margin-bottom: mb-2 (minimal spacing)</rule>
  </vertical_space>

  <design_system>
    <rule>Use glass-small glass-legible for TabsList background</rule>
    <rule>Pill-shaped tabs with rounded-full styling</rule>
    <rule>Active tab: white background with dark text</rule>
    <rule>Inactive tabs: transparent with subtle hover states</rule>
  </design_system>
</critical_requirements>

<standard_pattern priority="1">
  <structure>
    ```typescript
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* Tabs Header - Positioned at top with minimal padding */}
      <div className="glass-medium glass-legible rounded-2xl p-2 mb-2 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/12 via-slate-900/60 to-indigo-500/12 animate-gradient-pulse" />
        
        <div className="relative z-10 flex items-center justify-center gap-4 w-full">
          <TabsList className="relative inline-flex items-center justify-center gap-1 rounded-full px-1.5 py-1 glass-small glass-legible border border-white/15 bg-slate-900/40 flex-1 max-w-3xl">
            <TabsTrigger
              value="tab1"
              className="relative flex-1 min-w-[90px] px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-colors data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-700 dark:data-[state=inactive]:text-slate-200/80 data-[state=inactive]:hover:bg-white/10"
            >
              Tab 1
            </TabsTrigger>
            {/* Additional TabsTrigger components */}
          </TabsList>
        </div>
      </div>

      {/* Tab Contents - Full height, no top margin */}
      <div className="flex-1 min-h-0 min-w-0 relative">
        <TabsContent value="tab1" className="h-full mt-0 min-w-0 data-[state=inactive]:hidden">
          {/* Tab content */}
        </TabsContent>
        {/* Additional TabsContent components */}
      </div>
    </Tabs>
    ```
  </structure>

  <key_classes>
    <container>
      - `p-2` - Minimal padding (8px)
      - `mb-2` - Minimal bottom margin (8px)
      - `flex-shrink-0` - Prevent compression
      - `glass-medium glass-legible` - Glass design system
    </container>

    <tabs_list>
      - `px-1.5 py-1` - Minimal padding (6px vertical, 6px horizontal)
      - `rounded-full` - Pill shape
      - `glass-small glass-legible` - Glass design system
      - `border border-white/15` - Subtle border
      - `flex-1 max-w-3xl` - Flexible width with max constraint
    </tabs_list>

    <tab_trigger>
      - `py-1.5 sm:py-2` - Minimal vertical padding (6px mobile, 8px desktop)
      - `px-4 sm:px-6` - Horizontal padding
      - `rounded-full` - Pill shape
      - `flex-1 min-w-[90px]` - Equal distribution with minimum width
      - `text-xs sm:text-sm` - Responsive text size
      - `data-[state=active]:bg-white` - Active state styling
      - `data-[state=inactive]:hover:bg-white/10` - Hover state
    </tab_trigger>

    <tab_content>
      - `h-full` - Full height
      - `mt-0` - No top margin (critical for minimal spacing)
      - `min-w-0` - Prevent overflow
      - `data-[state=inactive]:hidden` - Hide inactive tabs
    </tab_content>
  </key_classes>
</standard_pattern>

<positioning_rules priority="1">
  <top_positioning>
    <rule>Tabs MUST be the first element in the page/container content area</rule>
    <rule>Container uses flex-shrink-0 to maintain position at top</rule>
    <rule>No margin-top on tabs container</rule>
    <example>
      ```typescript
      <div className="flex flex-col h-full">
        {/* Tabs at top - no spacing above */}
        <Tabs>
          <div className="p-2 mb-2 flex-shrink-0">
            {/* TabsList */}
          </div>
        </Tabs>
        {/* Other content below */}
      </div>
      ```
    </example>
  </top_positioning>

  <spacing_constraints>
    <rule>Container padding: p-2 (8px all sides)</rule>
    <rule>Container margin-bottom: mb-2 (8px)</rule>
    <rule>TabsList padding: px-1.5 py-1 (6px vertical)</rule>
    <rule>TabsTrigger padding: py-1.5 sm:py-2 (6-8px vertical)</rule>
    <rule>TabsContent margin-top: mt-0 (0px - critical for minimal spacing)</rule>
  </spacing_constraints>
</positioning_rules>

<design_details priority="2">
  <glass_design>
    <container>glass-medium glass-legible - Container background</container>
    <tabs_list>glass-small glass-legible - TabsList background</tabs_list>
    <gradient>bg-gradient-to-br from-purple-500/12 via-slate-900/60 to-indigo-500/12 - Subtle gradient overlay</gradient>
  </glass_design>

  <active_state>
    <background>bg-white - White background for active tab</background>
    <text>text-slate-900 - Dark text for contrast</text>
    <transition>transition-colors - Smooth color transitions</transition>
  </active_state>

  <inactive_state>
    <background>Transparent - No background</background>
    <text>text-slate-700 dark:text-slate-200/80 - Muted text</text>
    <hover>hover:bg-white/10 - Subtle hover effect</hover>
  </inactive_state>
</design_details>

<responsive_behavior priority="2">
  <mobile>
    <padding>py-1.5 px-4 - Smaller padding on mobile</padding>
    <text>text-xs - Smaller text on mobile</padding>
    <min_width>min-w-[90px] - Minimum tab width</min_width>
  </mobile>

  <desktop>
    <padding>py-2 px-6 - Larger padding on desktop</padding>
    <text>text-sm - Standard text size</text>
    <max_width>max-w-3xl - Maximum tabs container width</max_width>
  </desktop>
</responsive_behavior>

<common_antipatterns priority="1">
  <antipattern_1>
    <name>Excessive Vertical Padding</name>
    <bad_code>
      ```typescript
      // ❌ FORBIDDEN: Too much vertical padding
      <div className="p-6 mb-6"> {/* 24px padding */}
        <TabsList className="py-4"> {/* 16px padding */}
      ```
    </bad_code>
    <good_code>
      ```typescript
      // ✅ CORRECT: Minimal vertical padding
      <div className="p-2 mb-2"> {/* 8px padding */}
        <TabsList className="py-1"> {/* 4px padding */}
      ```
    </good_code>
  </antipattern_1>

  <antipattern_2>
    <name>Tabs Not at Top</name>
    <bad_code>
      ```typescript
      // ❌ FORBIDDEN: Tabs not at top
      <div>
        <Header />
        <OtherContent />
        <Tabs> {/* Tabs below other content */}
      ```
    </bad_code>
    <good_code>
      ```typescript
      // ✅ CORRECT: Tabs at top
      <div>
        <Tabs> {/* Tabs first */}
          <div className="p-2 mb-2 flex-shrink-0">
      ```
    </good_code>
  </antipattern_2>

  <antipattern_3>
    <name>TabsContent with Top Margin</name>
    <bad_code>
      ```typescript
      // ❌ FORBIDDEN: Top margin on TabsContent
      <TabsContent className="mt-4"> {/* Adds unwanted space */}
      ```
    </bad_code>
    <good_code>
      ```typescript
      // ✅ CORRECT: No top margin
      <TabsContent className="mt-0"> {/* Minimal spacing */}
      ```
    </good_code>
  </antipattern_3>
</common_antipatterns>

<checklist priority="1">
  <implementation_checklist>
    - ✅ Tabs positioned at top of page/container
    - ✅ Container uses p-2 (minimal padding)
    - ✅ Container uses mb-2 (minimal bottom margin)
    - ✅ Container uses flex-shrink-0
    - ✅ TabsList uses py-1 (minimal vertical padding)
    - ✅ TabsTrigger uses py-1.5 sm:py-2 (minimal vertical padding)
    - ✅ TabsContent uses mt-0 (no top margin)
    - ✅ TabsContent uses h-full (full height)
    - ✅ Glass design system classes applied
    - ✅ Rounded-full styling for pill shape
    - ✅ Active/inactive states properly styled
  </implementation_checklist>

  <spacing_checklist>
    - ✅ Total vertical space: ~40-50px (container + tabs)
    - ✅ No unnecessary margins or padding
    - ✅ TabsContent starts immediately below tabs
    - ✅ Responsive padding adjustments (mobile vs desktop)
  </spacing_checklist>
</checklist>

<examples priority="2">
  <example_1>
    <file_path>app/Projects/predictive-modelling/components/PredictiveModellingClient.tsx</file_path>
    <description>Reference implementation with 5 tabs (Setup, Data, Model, Scenarios, Run)</description>
    <key_features>
      - Top positioning with flex-shrink-0
      - Minimal padding (p-2, py-1, py-1.5)
      - Glass design system
      - Responsive text and padding
    </key_features>
  </example_1>
</examples>

<ai_context_notes priority="3">
  <key_concepts>
    <domain_terms>TabsList, TabsTrigger, TabsContent, glass design, pill shape, minimal spacing</domain_terms>
    <business_rules>Tabs always at top, minimal vertical space, consistent styling across app</business_rules>
    <user_expectations>Space-efficient navigation, clear active state, smooth transitions</user_expectations>
  </key_concepts>

  <common_modifications>
    <typical_changes>Adding/removing tabs, adjusting tab labels, adding action buttons alongside tabs</typical_changes>
    <extension_points>Sub-tabs within tab content, tab badges/indicators, tab icons</extension_points>
    <customization_areas>Tab colors (maintain glass design), tab widths, responsive breakpoints</customization_areas>
  </common_modifications>

  <debugging_tips>
    <common_issues>Tabs not at top, excessive vertical space, TabsContent spacing issues</common_issues>
    <debugging_techniques>Check flex-shrink-0 on container, verify mt-0 on TabsContent, inspect padding values</debugging_techniques>
    <logging_points>Tab change events, responsive breakpoint behavior</logging_points>
  </debugging_tips>
</ai_context_notes>

---

## 🎯 **AI Usage Instructions**

This specification defines the **standard tab design pattern** for the application. When implementing tabs:

1. **Always position tabs at the top** of the page/container
2. **Use minimal vertical padding** (p-2, py-1, py-1.5)
3. **Set TabsContent mt-0** to eliminate top margin
4. **Follow the glass design system** classes
5. **Use flex-shrink-0** on container to maintain top position

## 📚 **Specification Scope**

This document covers:
- Tab positioning (always at top)
- Minimal vertical spacing patterns
- Glass design system integration
- Responsive behavior
- Active/inactive states

## 📁 **File Storage & Naming Convention**

**Storage Location**: `docs/__Specifications/`

**Naming Convention**: `13_TabsDesign_specification.md`
- **13**: Sequential number for logical ordering
- **TabsDesign**: PascalCase description
- **specification**: Indicates this is a reference specification document

## 🔗 **Related Specifications**

- `05_comprehensive-liquid-glass-design-system.md` - Glass design system details
- `04_ResponsiveDesign_specification.md` - Responsive design patterns

