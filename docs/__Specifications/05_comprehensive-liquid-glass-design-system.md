# Liquid Glass Design System
**Concise specification for UI development - v5.0**

<specification_metadata>
  <created>2025-10-28</created>
  <updated>2025-10-28</updated>
  <version>v5.0 - Concise Practical Patterns</version>
  <status>ACTIVE</status>
  <reference_pages>
    - app/Projects/system-tables (page layout patterns)
    - app/Projects/dataWorkbench/components/specialized/RelationshipsDialog.tsx (dialog patterns)
  </reference_pages>
</specification_metadata>

## Core Philosophy

The Liquid Glass design system provides a **dark-mode-first**, translucent glass aesthetic with guaranteed readability. All patterns are battle-tested in production code.

**Key Principles:**
- Dark mode is primary (light mode is secondary)
- Glass materials provide visual depth without sacrificing legibility
- Semantic text classes adapt to any background
- Responsive by default

---

## Material Classes

### Container Materials

```css
/* PRIMARY: Main page sections, large content areas */
.glass-medium .glass-legible
/* rounded-2xl or rounded-3xl + appropriate padding */

/* ALTERNATIVE: For emphasized headers with gradients */
.glass-medium .glass-legible
/* Add gradient overlay inside for visual interest */
```

### Usage Rules

**Pages (from system-tables):**
```tsx
// ✅ Page wrapper
<div className="px-2 sm:px-4 md:px-8 py-4 md:py-6 min-h-[100dvh] flex flex-col overflow-x-hidden">

  // ✅ Header tile with gradient
  <div className="glass-medium glass-legible rounded-3xl p-6 flex items-center justify-between relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10" />
    <div className="relative z-10">
      <h1 className="text-xl md:text-2xl font-semibold glass-text-primary">Page Title</h1>
      <p className="glass-text-secondary text-sm">Page description</p>
    </div>
  </div>

  // ✅ Content container
  <div className="glass-medium glass-legible rounded-2xl p-3">
    {/* Content */}
  </div>
</div>
```

**Tabs (from system-tables):**
```tsx
// ✅ Tab container
<TabsList className="glass-medium glass-legible rounded-2xl p-1.5 sm:h-[50px]">
  <TabsTrigger value="tab1" className="h-[30px] px-4 text-sm">
    Tab 1
  </TabsTrigger>
</TabsList>
```

---

## Dialogs

### Standard Dialog Pattern (from RelationshipsDialog)

```tsx
// ✅ CORRECT: Full-screen dialog (90vw x 90vh)
<Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
  <DialogContent className="relative max-w-[90vw] w-[90vw] h-[90vh] max-h-[90vh] pb-4 overflow-hidden flex flex-col bg-transparent rounded-2xl border border-white/20 dark:border-slate-700/40 shadow-[0_12px_48px_rgba(0,0,0,0.05)]">

    {/* Facade background layer */}
    <div className="absolute inset-0 -z-10 dialog-facade-bg" />

    {/* Optional sheen overlay */}
    <div className="absolute inset-0 pointer-events-none rounded-2xl bg-gradient-to-br from-white/5 via-white/2 to-transparent dark:from-white/5 dark:via-white/10 dark:to-transparent" />

    {/* Header */}
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
    </DialogHeader>

    {/* Content with scroll */}
    <div className="flex-1 min-h-0 overflow-auto">
      {/* Your content */}
    </div>
  </DialogContent>
</Dialog>
```

### Dialog Size Guidelines

| Dialog Type | Size | Use Case |
|------------|------|----------|
| Full-screen | `max-w-[90vw] w-[90vw] h-[90vh]` | Complex interfaces, data grids, multi-panel layouts |
| Large | `max-w-3xl` | Forms with many fields, detailed views |
| Medium | `max-w-lg` | Standard forms, confirmations with content |
| Small | `max-w-md` | Simple forms, quick actions |
| Alert | `max-w-sm` | Alerts, confirmations |

**Example variations:**
```tsx
// Medium dialog
<DialogContent className="relative max-w-lg w-[calc(100vw-2rem)] rounded-2xl bg-transparent border border-white/20 dark:border-slate-700/40">
  {/* Same facade pattern as above */}
</DialogContent>

// Small alert dialog
<AlertDialogContent className="relative max-w-sm rounded-xl bg-transparent border border-white/20 dark:border-slate-700/40">
  {/* Same facade pattern as above */}
</AlertDialogContent>
```

---

## Text & Typography

### Semantic Text Classes (ALWAYS USE THESE)

```tsx
// ✅ PRIMARY TEXT: Headings, titles, important content
<h1 className="text-xl font-semibold glass-text-primary">Heading</h1>
<h2 className="text-lg glass-text-primary">Subheading</h2>

// ✅ SECONDARY TEXT: Body text, descriptions, labels
<p className="glass-text-secondary text-sm">Description text</p>
<label className="text-xs font-medium glass-text-secondary uppercase">Label</label>

// ✅ METRICS: Large numbers and values
<p className="text-2xl font-bold glass-text-primary">42</p>
```

### Typography Scale

| Class | Size | Use |
|-------|------|-----|
| `text-2xl` | 24px | Large metrics, hero numbers |
| `text-xl` | 20px | Page titles (mobile: `md:text-2xl` for 28px on desktop) |
| `text-lg` | 18px | Section headings, card titles |
| `text-base` | 16px | Body text (default) |
| `text-sm` | 14px | Descriptions, secondary content |
| `text-xs` | 12px | Labels, captions, metadata |

---

## Interactive Elements

### Buttons

```tsx
// ✅ Standard button
<Button className="glass-small glass-interactive">
  <Plus className="w-4 h-4 mr-2" />
  Action
</Button>

// ✅ Icon-only button
<Button className="glass-small" aria-label="Refresh">
  <RefreshCw className="w-4 h-4" />
</Button>

// ✅ Small control button (from system-tables)
<button className="inline-flex items-center justify-center w-7 h-7 rounded-md border bg-background transition-colors hover:bg-background/80">
  <Icon className="h-4 w-4" />
</button>

// ✅ Destructive action
<button className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/20">
  <Trash2 className="h-4 w-4" />
</button>
```

### Form Controls

```tsx
// ✅ Input
<Input className="glass-small border-0 glass-text-primary placeholder:text-gray-500 focus:ring-2 focus:ring-blue-400/50 h-10 sm:h-11" />

// ✅ Select (native)
<select className="h-8 rounded-md border bg-background px-2 text-xs">
  <option>Option 1</option>
</select>

// ✅ Textarea
<Textarea className="glass-small" rows={3} />

// ✅ Label
<Label className="glass-text-primary text-sm font-medium">
  Field Name
</Label>
```

---

## Layout Patterns

### Responsive Container Padding

```tsx
// ✅ Page-level padding (from system-tables)
<div className="px-2 sm:px-4 md:px-8 py-4 md:py-6">
  {/* Adapts: 8px mobile → 16px tablet → 32px desktop */}
</div>

// ✅ Container padding
<div className="p-3">      {/* 12px - compact */}
<div className="p-6">      {/* 24px - comfortable */}
```

### Two-Column Layouts (from system-tables)

```tsx
// ✅ Responsive two-column with resizable divider
<div
  className="flex flex-col gap-4 lg:grid lg:grid-rows-1 h-full"
  style={{ gridTemplateColumns: `${leftPercent}% 6px 1fr` }}
>
  {/* Left pane */}
  <div className="glass-medium glass-legible rounded-2xl p-3">
    {/* Content */}
  </div>

  {/* Divider */}
  <div
    role="separator"
    className="hidden lg:block bg-white/20 rounded-md cursor-col-resize"
    onMouseDown={handleResize}
  />

  {/* Right pane */}
  <div className="glass-medium glass-legible rounded-2xl p-3">
    {/* Content */}
  </div>
</div>
```

### Flexible Content with Scroll

```tsx
// ✅ Container with internal scroll (from system-tables)
<div className="glass-medium glass-legible rounded-2xl p-3 h-full min-h-0 flex flex-col">
  {/* Fixed header */}
  <div className="shrink-0 mb-3">
    <h2 className="text-sm font-semibold glass-text-primary">Section Title</h2>
  </div>

  {/* Scrollable content */}
  <div className="flex-1 min-h-0 overflow-auto">
    {/* Your content */}
  </div>
</div>
```

---

## Icon Patterns

### Icon Containers with Color (from ProjectManagement/system-tables)

```tsx
// ✅ Icon with colored background
<div className="p-2 bg-blue-500/20 rounded-lg">
  <Database className="w-5 h-5 text-blue-400" />
</div>

// Color variants
<div className="p-2 bg-emerald-500/20 rounded-lg">
  <Shield className="w-5 h-5 text-emerald-400" />
</div>

<div className="p-2 bg-purple-500/20 rounded-lg">
  <Users className="w-5 h-5 text-purple-400" />
</div>

<div className="p-2 bg-amber-500/20 rounded-lg">
  <Zap className="w-5 h-5 text-amber-400" />
</div>

// ✅ Gradient icon container (for headers)
<div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
  <FolderPlus className="w-6 h-6 text-white" />
</div>
```

---

## Complete Examples

### Full Page Layout

```tsx
// ✅ Complete page structure (from system-tables)
export default function MyPage() {
  return (
    <div className="px-2 sm:px-4 md:px-8 py-4 md:py-6 min-h-[100dvh] flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="glass-medium glass-legible rounded-3xl p-6 flex items-center justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold glass-text-primary">Page Title</h1>
            <p className="glass-text-secondary text-sm">Page description</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4">
        <Tabs>
          <TabsList className="glass-medium glass-legible rounded-2xl p-1.5">
            <TabsTrigger value="tab1" className="h-[30px] px-4 text-sm">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" className="h-[30px] px-4 text-sm">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 mt-4">
        <div className="glass-medium glass-legible rounded-2xl p-3 h-full flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto">
            {/* Your content */}
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Statistics Card

```tsx
// ✅ Stats card (from ProjectManagement)
<div className="glass-small rounded-xl p-4">
  <div className="flex items-center gap-3">
    <div className="p-2 bg-blue-500/20 rounded-lg">
      <Database className="w-5 h-5 text-blue-400" />
    </div>
    <div>
      <p className="text-xs font-medium glass-text-secondary uppercase tracking-wide">
        Total Items
      </p>
      <p className="text-2xl font-bold glass-text-primary">42</p>
    </div>
  </div>
</div>
```

---

## Responsive Design

### Breakpoints

| Breakpoint | Min Width | Typical Use |
|-----------|-----------|-------------|
| `sm:` | 640px | Tablets portrait |
| `md:` | 768px | Tablets landscape |
| `lg:` | 1024px | Desktops |
| `xl:` | 1280px | Large desktops |

### Common Responsive Patterns

```tsx
// ✅ Responsive text sizes
<h1 className="text-xl md:text-2xl font-semibold">Title</h1>

// ✅ Responsive padding
<div className="px-2 sm:px-4 md:px-8">

// ✅ Responsive grid
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

// ✅ Responsive layout switch (stacked mobile, side-by-side desktop)
<div className="flex flex-col lg:grid lg:grid-cols-2 gap-4">

// ✅ Hide on mobile, show on desktop
<div className="hidden sm:block">

// ✅ Show on mobile only
<div className="sm:hidden">
```

---

## Dark Mode

**Dark mode is PRIMARY.** All glass materials and text classes automatically adapt.

### Dark Mode Specifics

```tsx
// ✅ Borders adapt to theme
border border-white/20 dark:border-slate-700/40

// ✅ Shadows adapt to theme
shadow-[0_12px_48px_rgba(0,0,0,0.05)]

// ✅ Gradient overlays adapt
bg-gradient-to-br from-white/5 via-white/2 to-transparent dark:from-white/5 dark:via-white/10 dark:to-transparent

// ✅ Background colors adapt
bg-background  // Uses theme-aware background color

// ✅ Text colors adapt automatically with glass-text-* classes
glass-text-primary    // Dark text in light mode, light text in dark mode
glass-text-secondary  // Medium contrast in both modes
```

**NEVER hardcode text colors like `text-black` or `text-white`.** Always use `glass-text-primary` or `glass-text-secondary`.

---

## Accessibility

### Required Patterns

```tsx
// ✅ Icon-only buttons MUST have aria-label
<button aria-label="Refresh data">
  <RefreshCw className="w-4 h-4" />
</button>

// ✅ Interactive elements must have focus states (default in Tailwind)
focus:ring-2 focus:ring-blue-400/50

// ✅ Resizable dividers need proper ARIA
<div
  role="separator"
  aria-orientation="vertical"
  tabIndex={0}
  onKeyDown={handleKeyboard}
>

// ✅ Hidden labels for screen readers
<label htmlFor="search" className="sr-only">Search</label>
<input id="search" type="text" placeholder="Search..." />

// ✅ Expandable sections need state
<button
  aria-expanded={isOpen}
  aria-label={isOpen ? 'Collapse' : 'Expand'}
>
```

---

## Quick Reference

### Most Common Patterns

```tsx
// Page wrapper
<div className="px-2 sm:px-4 md:px-8 py-4 md:py-6 min-h-[100dvh]">

// Content container
<div className="glass-medium glass-legible rounded-2xl p-3">

// Header
<h1 className="text-xl md:text-2xl font-semibold glass-text-primary">

// Body text
<p className="glass-text-secondary text-sm">

// Button
<Button className="glass-small glass-interactive">

// Input
<Input className="glass-small border-0 glass-text-primary h-10">

// Dialog
<DialogContent className="relative max-w-[90vw] w-[90vw] h-[90vh] bg-transparent rounded-2xl border border-white/20 dark:border-slate-700/40">
  <div className="absolute inset-0 -z-10 dialog-facade-bg" />
  {/* Content */}
</DialogContent>
```

---

## CSS Variables Reference

The design system relies on these CSS custom properties (defined in global styles):

```css
/* Backdrop blur levels */
--glass-blur-small: 32px;
--glass-blur-medium: 40px;
--glass-blur-large: 48px;

/* Transparency levels */
--glass-alpha-minimal: 0.05;
--glass-alpha-light: 0.08;
--glass-alpha-medium: 0.12;

/* Adaptive text colors (auto-adjust based on theme/background) */
--text-primary-adaptive: /* computed */
--text-secondary-adaptive: /* computed */
```

---

**Version**: v5.0
**Last Updated**: 2025-10-28
**Reference Implementations**:
- Pages: `app/Projects/system-tables/`
- Dialogs: `app/Projects/dataWorkbench/components/specialized/RelationshipsDialog.tsx`
