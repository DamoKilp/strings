
## 🎯 **EXECUTION FRAMEWORK**

### **🚫 NON-NEGOTIABLE RESTRICTIONS**

1. **NO DEV SERVER** - Code-only validation (`npx tsc --noEmit`)
2. **NO BLOATING CORE FILES** - VirtualGrid.tsx and DataWorkbenchLayout.tsx at capacity
3. **NO PREMATURE COMPLETION** - Always get user approval first
4. **NO BREAKING CHANGES** - Backwards compatibility is sacred
5. **NO TYPE DUPLICATION** - Import from hierarchy only
6. **NO DOC SPRAWL** - Use existing structure, summarize in chat
7. **NO LOG POLLUTION** - Minimal, strategic logging

---

### **✅ EXCELLENCE STANDARDS**

**ARCHITECTURE & TYPES**
- Follow architecture-spec-v4.md patterns precisely
- 100% TypeScript coverage (zero `any` types)
- Import from type hierarchy: `lib/types.ts` → `types/core/common.ts` → feature types
- Service layer separation enforced

**PERFORMANCE & SECURITY**
- Stable useEffect deps (NO object/array literals in dependencies)
- Zero runtime overhead for new features
- Typed RPCs ONLY - exec_sql is FORBIDDEN
- Multi-tenant: Composite keys `(project_id, key)` for all system tables
- All queries project-scoped with RLS enforcement

**DATABASE OPERATIONS**
- Available RPCs: `table_exists`, `get_public_table_columns`, `create_dynamic_table_safe`, `drop_table_cascade_safe`, `add_column_if_not_exists`, `list_public_triggers`, `list_public_tables`, `create_composite_fk_constraint`, `drop_constraint_if_exists`, `find_orphans_composite`, `delete_orphans_composite`, `delete_table_preferences`, `drop_table_and_prefs`
- **Supabase MCP Server**: Direct database access via MCP tools - view schema, execute SQL, manage migrations, deploy Edge Functions, create branches, access logs and advisors
-- Run npx supabase gen types typescript --project-id nktqfxfotmcbxufilcnh --schema public > lib/database.types.ts to update the app with the new changes

**USER EXPERIENCE**
- Accessible (ARIA, keyboard nav)
- Responsive design
- Helpful error messages

---

### **🎨 DESIGN SYSTEM**

**Glass Design System (Liquid Glass)**
```tsx
// Dialog pattern
<Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
  <DialogContent className="relative max-w-[90vw] w-[90vw] h-[90vh] max-h-[90vh] pb-4 overflow-hidden flex flex-col bg-transparent">
    <div className="absolute inset-0 -z-10" style={{ background: 'var(--background-gradient, rgba(255,255,255,0.3))' }} />
```

**Styling Hierarchy:**
- Containers: `glass-large` / `glass-legible`
- Cards/Buttons: `glass-small`
- Text: `glass-text-primary` / `glass-text-secondary`

---

## 🔒 **SECURITY & SAFETY**

### **SECURITY FIRST (CRITICAL FOR PRODUCTION)**

**Authentication & Authorization:**
- NEVER trust client-side user data - always verify server-side
- Use Supabase RLS policies for all data access
- Check `auth.uid()` in RLS policies for user ownership
- Validate project ownership before any operations

**Data Protection:**
- All queries MUST be project-scoped: `WHERE project_id = $1`
- Use typed RPCs with parameterized queries (prevents SQL injection)
- NEVER use string concatenation for queries
- NEVER use `exec_sql` (banned for security reasons)

**Input Validation:**
- Validate ALL user inputs server-side
- Sanitize data before database operations
- Use TypeScript types as first line of defense
- Check for null/undefined before operations

**Secrets Management:**
- NEVER commit secrets to code
- Use environment variables for sensitive data
- Client vars: `NEXT_PUBLIC_*` prefix only
- Server-only vars: unprefixed, never exposed to client

**Attack Prevention:**
- XSS: React escapes by default, but sanitize HTML if needed
- CSRF: Next.js handles for forms, verify for custom endpoints
- Rate limiting: Implement on sensitive operations
- SQL injection: Prevented by typed RPCs and parameterized queries

**Security Checklist:**
```xml
<security_checklist>
  ✅ RLS policies enforce user/project isolation
  ✅ All queries use typed RPCs (no exec_sql)
  ✅ Input validation on all user data
  ✅ Project ownership verified server-side
  ✅ No secrets in code or client-side
  ✅ Parameterized queries prevent injection
</security_checklist>
```

---

## ⚡ **EXECUTION PROTOCOL**

### **COMPLEX TASKS:**
1. Analyze requirements
2. Create plan using template (`plan_template.md` / `plan_template_openai.md`)
3. Validate against specs
4. Get user approval
5. Implement in phases with validation gates

**Triggers:** Multiple files, new features, architecture changes, DB integration

### **SIMPLE TASKS:**
1. Review architecture specs & existing code
2. Implement following patterns
3. Verify compliance
4. Get user approval

---

## 🛡️ **CRITICAL CODE PATTERNS**

**Infinite Loop Prevention:**
```typescript
// ✅ CORRECT: Stable dependencies
useEffect(() => { /* ... */ }, [primitiveValue, memoizedObject])

// ❌ FORBIDDEN: Creates new refs every render
useEffect(() => { /* ... */ }, [{ key: value }, [item]])
```

**Type Safety:**
```typescript
// ✅ Import from hierarchy
import type { GridColumnDefinition } from '../../types/gridTypes'

// ❌ NEVER duplicate types
interface GridColumnDefinition { /* forbidden */ }
```

**Secure Database Access:**
```typescript
// ✅ Typed RPC with project scoping
const { data, error } = await supabase
  .rpc('get_public_table_columns', { p_table: tableName })
  .eq('project_id', projectId)

// ❌ FORBIDDEN: exec_sql, string concat, no project filter
```

---

## 📊 **QUALITY GATES**

**Validation Commands:**
```bash
npx tsc --noEmit                           # Type safety check
npm run lint                               # Code quality
```

**Metrics:**
- Component size: <1500 LOC (target: <1000)
- Type coverage: 100%
- Performance: Zero overhead
- Security: RLS enforced, inputs validated

---
## � **BUILD WITH EXCELLENCE**

**Elite Engineer Mindset:**
1. **PRECISION** - Structure, types, patterns right from the start
2. **PERFORMANCE** - Stable deps, efficient queries, optimized renders
3. **SECURITY** - RLS enforced, inputs validated, project-scoped
4. **USER-CENTRIC** - Accessible, responsive, helpful errors
5. **MAINTAINABLE** - Clear, documented, testable code

**Never Compromise:**
- Type safety (no `any`)
- Security (RLS + validation)
- Architecture (follow blueprint)
- Performance (stable effects)
- User experience (accessibility)

**Remember:** Architecture first, plan complex tasks, ask for clarity, preserve functionality, respect limits, get approval, summarize in chat only.

---

**TASK**: Read the 3 mandatory files, confirm readiness, then build secure, exceptional code! 🚀
- Performance (stable effects, efficient renders)
- User experience (accessibility, responsiveness)
- Code maintainability (clear, documented, testable)

---

## 🔥 **LET'S BUILD SOMETHING EXCEPTIONAL**

You have the architectural blueprint. You have the quality standards. You have the execution protocols.

Now let's craft production-grade code that's elegant, performant, type-safe, and maintainable.

**Remember:**
- Architecture first - always
- Plan complex, execute simple
- No assumptions - ask for clarity
- Preserve functionality - never break existing features
- Respect limits - size constraints are real
- User approval - always confirm before completion
- No doc sprawl - summarize in chat only

---

**TASK**: Read the 3 mandatory files completely, confirm your readiness, then let's build with excellence! 🚀
```
