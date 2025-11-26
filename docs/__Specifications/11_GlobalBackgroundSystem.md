# Global Background System

## Overview
The background system (ThemedBackground and BodyBackgroundController) is configured in the **root layout** (`app/layout.tsx`) to ensure it applies to **all pages** automatically.

## How It Works

### Next.js Layout System
In Next.js App Router, the root `app/layout.tsx` file wraps **all pages** in your application. This means:
- ✅ **All routes** automatically get the background system
- ✅ **New pages** you create will automatically have it
- ✅ **No need to add it manually** to each page

### Current Setup

```tsx
// app/layout.tsx
<ThemeProvider>
  <BackgroundModeProvider>
    <BodyBackgroundController />  {/* Makes body transparent */}
    <ThemedBackground />          {/* Renders FacadeBackground */}
    <ChatProvider>
      {children}  {/* All pages render here */}
    </ChatProvider>
  </BackgroundModeProvider>
</ThemeProvider>
```

### Components

1. **BodyBackgroundController**
   - Makes `body` background transparent when `backgroundMode === 'facade'` or `'image'`
   - Runs on every page automatically
   - Uses `useEffect` to modify body styles

2. **ThemedBackground**
   - Renders `FacadeBackground` when `backgroundMode === 'facade'`
   - Renders image backgrounds when `backgroundMode === 'image'`
   - Fixed position, z-index: -10/-11 (behind all content)

3. **FacadeBackground**
   - Contains all theme presets
   - Dark mode includes a dark base layer (z-index: -11)
   - Gradient layer on top (z-index: -10)

## Ensuring It Always Applies

### ✅ Already Configured
Since these are in the root layout, they **already apply to all pages**:
- `/` (home/chat)
- `/sign-in`
- `/settings`
- `/admin`
- Any new pages you create

### ⚠️ Edge Cases to Watch

1. **Nested Layouts**
   - If you create `app/some-route/layout.tsx`, it will **nest inside** the root layout
   - Background system will still work (it's in the root)
   - ✅ **Safe**: Nested layouts don't override root layout

2. **Route Groups**
   - Route groups like `app/(auth)/layout.tsx` also nest inside root
   - ✅ **Safe**: Background system still applies

3. **Parallel Routes**
   - If using `@folder` syntax, they still use root layout
   - ✅ **Safe**: Background system applies

4. **Intercepting Routes**
   - Modal routes like `app/@modal/...` use root layout
   - ✅ **Safe**: Background system applies

### 🚫 What Would Break It

**Only these scenarios would break it:**
1. Creating a new root layout (not possible - only one root layout)
2. Removing the components from root layout
3. Using a different framework/routing system

### Best Practices

1. **Don't add ThemedBackground to individual pages**
   - It's already in the root layout
   - Adding it again would create duplicate backgrounds

2. **Don't override body background in page components**
   - Let `BodyBackgroundController` handle it
   - If you need custom backgrounds, use the `backgroundMode` context

3. **For page-specific backgrounds:**
   ```tsx
   // Use the context to change background mode
   const { setBackgroundMode, setFacadePreset } = useBackgroundMode();
   
   useEffect(() => {
     setBackgroundMode('facade');
     setFacadePreset('midnight');
   }, []);
   ```

## Verification Checklist

When adding new pages, verify:
- [ ] Page renders (it will automatically have background)
- [ ] Background appears correctly
- [ ] Dark mode shows darker backdrop
- [ ] No duplicate ThemedBackground components

## Troubleshooting

**Background not showing?**
1. Check that `BackgroundModeProvider` wraps your page
2. Check that `backgroundMode` is set to `'facade'` or `'image'`
3. Check browser console for errors
4. Verify `BodyBackgroundController` is making body transparent

**Background too light in dark mode?**
- Dark base layer is in `FacadeBackground` (z-index: -11)
- Check that `activeTheme === 'dark'` is true
- Verify dark base layer is rendering

**Multiple backgrounds?**
- Don't add `ThemedBackground` to individual pages
- It's already in root layout

## Summary

✅ **The background system is already configured to work on all pages**
✅ **No action needed when creating new pages**
✅ **Root layout ensures global application**

The setup is future-proof - any new pages you create will automatically have the themed background system.








