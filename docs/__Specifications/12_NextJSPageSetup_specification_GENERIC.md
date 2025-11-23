# Next.js Page Setup Specification (Generic/Portable Version)
**Purpose**: AI reference document for understanding the standard patterns for creating secure, server-rendered Next.js pages. This is a **generic version** that can be adapted to any Next.js 15 + React 19 project.

> **Note**: This is a portable version. For VENTIAAM-specific patterns, see `12_NextJSPageSetup_specification.md`

<specification_metadata>
  <created>2025-01-15</created>
  <flow_name>Next.js Page Setup Pattern (Generic)</flow_name>
  <complexity_level>MODERATE</complexity_level>
  <status>GENERIC_TEMPLATE</status>
  <related_flows>Authentication, Server Actions, Data Retrieval, Cache Management</related_flows>
  <ai_context>Generic reference specification for AI understanding of secure, server-side page patterns following Next.js 15 + React 19 standards. Adapt authentication and data access patterns to your specific stack.</ai_context>
  <portability>✅ Fully portable across Next.js 15 + React 19 projects</portability>
</specification_metadata>

<flow_overview>
  <purpose>
    Defines the standard pattern for creating Next.js page.tsx files that are secure, server-rendered, and follow Next.js 15 + React 19 best practices.
  </purpose>
  
  <user_trigger>
    AI needs to create a new page.tsx file or refactor an existing page.
  </user_trigger>
  
  <end_result>
    A secure, server-rendered page that handles authentication, data loading, and renders content following established patterns.
  </end_result>
  
  <key_data_transformations>
    - Server-side authentication checks (adapt to your auth system)
    - Initial data loading (if required)
    - Cache revalidation configuration
  </key_data_transformations>
</flow_overview>

<critical_requirements priority="1">
  <security>
    <rule>ALL pages MUST be Server Components by default (async function, no 'use client')</rule>
    <rule>Server-side authentication checks required for protected pages</rule>
    <rule>No secrets or sensitive data exposed to client</rule>
    <rule>🔧 ADAPT: Use your authentication library's server-side client creation pattern</rule>
  </security>

  <server_rendering>
    <rule>Default to Server Components - only use Client Components for interactive features</rule>
    <rule>Minimise client-side code - keep client components minimal and isolated</rule>
    <rule>Use revalidate = 0 for dynamic content, or specific revalidation strategy</rule>
    <rule>Handle searchParams as Promise for Next.js 15 compatibility</rule>
  </server_rendering>

  <authentication_pattern>
    <rule>Protected pages MUST check authentication server-side</rule>
    <rule>Use redirect() from next/navigation for unauthenticated users</rule>
    <rule>Include redirect_to parameter for seamless return after login</rule>
    <rule>🔧 ADAPT: Middleware handles initial redirects, but server component provides safety check</rule>
  </authentication_pattern>

  <performance>
    <rule>Load critical data server-side when possible</rule>
    <rule>Use parallel loading for multiple data sources</rule>
    <rule>Minimise client component bundle size</rule>
  </performance>
</critical_requirements>

<standard_page_patterns priority="1">
  <simple_page>
    <pattern_name>Simple Public Page</pattern_name>
    <description>Pages with minimal content, no authentication, no data loading</description>
    <code_example>
      ```typescript
      // app/home/page.tsx
      export const revalidate = 0; // Dynamic content, no caching

      export default async function HomePage() {
        return (
          <div className="min-h-screen p-4">
            <h1 className="text-2xl mb-4 font-bold">Page Title</h1>
            {/* Server-rendered content */}
          </div>
        );
      }
      ```
    </code_example>
    <when_to_use>Landing pages, simple informational pages, entry points</when_to_use>
    <portability>✅ Fully portable - no dependencies</portability>
  </simple_page>

  <protected_page>
    <pattern_name>Protected Page with Authentication</pattern_name>
    <description>Pages requiring authentication with server-side auth check</description>
    <code_example>
      ```typescript
      // app/dashboard/page.tsx
      import { redirect } from 'next/navigation'
      // 🔧 ADAPT: Import your authentication utility
      // Example for NextAuth.js: import { getServerSession } from 'next-auth'
      // Example for Clerk: import { auth } from '@clerk/nextjs/server'
      // Example for Supabase: import { createClient } from '@/utils/supabase/server'

      export default async function DashboardPage({ searchParams }: Props) {
        // 🔧 ADAPT: Use your authentication system's server-side check
        // Example patterns:
        
        // NextAuth.js:
        // const session = await getServerSession()
        // if (!session) redirect('/sign-in?redirect_to=/dashboard')
        
        // Clerk:
        // const { userId } = auth()
        // if (!userId) redirect('/sign-in?redirect_to=/dashboard')
        
        // Supabase:
        // const supabase = await createClient()
        // const { data: { user }, error } = await supabase.auth.getUser()
        // if (error || !user) redirect('/sign-in?redirect_to=/dashboard')
        
        // Generic placeholder:
        const isAuthenticated = await checkAuthentication() // 🔧 Implement this
        if (!isAuthenticated) {
          redirect('/sign-in?redirect_to=/dashboard')
        }

        // Await searchParams for Next.js 15 compatibility
        const params = await searchParams
        
        return (
          <div>
            {/* Server-rendered content */}
          </div>
        );
      }
      ```
    </code_example>
    <when_to_use>Dashboard pages, authenticated features, user-specific content</when_to_use>
    <portability>⚠️ Requires authentication system adaptation</portability>
  </protected_page>

  <data_loading_page>
    <pattern_name>Page with Server-Side Data Loading</pattern_name>
    <description>Pages that load initial data server-side before rendering</description>
    <code_example>
      ```typescript
      // app/posts/page.tsx
      import { redirect } from 'next/navigation'
      // 🔧 ADAPT: Import your data access utilities

      interface PostsPageProps {
        searchParams: Promise<{ [key: string]: string | string[] | undefined }>
      }

      export default async function PostsPage({ searchParams }: PostsPageProps) {
        // Authentication check (adapt to your system)
        const isAuthenticated = await checkAuthentication()
        if (!isAuthenticated) redirect('/sign-in')

        // Resolve searchParams
        const params = await searchParams
        const category = typeof params.category === 'string' ? params.category : undefined

        // 🚀 Server-side data loading in parallel
        let posts: Post[] | null = null
        let categories: Category[] | null = null

        try {
          // 🔧 ADAPT: Replace with your data loading functions
          // Load data in parallel for better performance
          const [postsResult, categoriesResult] = await Promise.all([
            loadPosts(category),        // 🔧 Implement this
            loadCategories(),           // 🔧 Implement this
          ])
          
          posts = postsResult.data
          categories = categoriesResult.data
        } catch (error) {
          // Handle errors gracefully
          console.error('Failed to load initial data:', error)
        }

        return (
          <PostsLayout 
            posts={posts}
            categories={categories}
          />
        );
      }
      ```
    </code_example>
    <when_to_use>Complex pages requiring initial data, data-driven pages</when_to_use>
    <portability>⚠️ Requires data access layer adaptation</portability>
  </data_loading_page>

  <client_wrapper_pattern>
    <pattern_name>Server Component + Client Component Pattern</pattern_name>
    <description>Server component handles auth/data, client component handles interactivity</description>
    <code_example>
      ```typescript
      // app/settings/page.tsx (Server Component)
      import { redirect } from 'next/navigation'
      // 🔧 ADAPT: Import your authentication utility
      import SettingsPageClient from './SettingsPageClient'

      export default async function SettingsPage({ searchParams }: Props) {
        // Server-side authentication (adapt to your system)
        const isAuthenticated = await checkAuthentication()
        if (!isAuthenticated) redirect('/sign-in?redirect_to=/settings')

        // Resolve searchParams
        const params = await searchParams

        // Load server-side data if needed
        // 🔧 ADAPT: Replace with your data loading
        const userData = await loadUserSettings()

        // Pass data to client component
        return <SettingsPageClient userData={userData} searchParams={params} />
      }

      // app/settings/SettingsPageClient.tsx (Client Component)
      'use client'
      export default function SettingsPageClient({ userData, searchParams }: Props) {
        // Interactive client-side logic
      }
      ```
    </code_example>
    <when_to_use>Pages with complex client-side interactivity, forms, real-time features</when_to_use>
    <portability>✅ Fully portable pattern - adapt data loading</portability>
  </client_wrapper_pattern>
</standard_page_patterns>

<security_patterns priority="1">
  <authentication_check>
    <pattern>
      ```typescript
      // ✅ CORRECT: Server-side auth check (generic pattern)
      // 🔧 ADAPT: Replace with your authentication system
      const isAuthenticated = await checkAuthentication()

      if (!isAuthenticated) {
        redirect('/sign-in?message=Please sign in&redirect_to=/current-page')
      }
      
      // Examples for common auth systems:
      
      // NextAuth.js:
      // const session = await getServerSession(authOptions)
      // if (!session) redirect('/sign-in?redirect_to=/current-page')
      
      // Clerk:
      // const { userId } = auth()
      // if (!userId) redirect('/sign-in?redirect_to=/current-page')
      
      // Supabase:
      // const supabase = await createClient()
      // const { data: { user }, error } = await supabase.auth.getUser()
      // if (error || !user) redirect('/sign-in?redirect_to=/current-page')
      ```
    </pattern>
    <rationale>Server-side checks prevent client-side bypass, provide immediate redirects</rationale>
    <portability>⚠️ Pattern is portable, implementation needs adaptation</portability>
  </authentication_check>

  <secrets_handling>
    <pattern>
      ```typescript
      // ✅ CORRECT: Server-only secrets (fully portable)
      // Server components run on server, have access to all env vars
      const apiKey = process.env.SECRET_API_KEY // Available on server
      
      // ❌ FORBIDDEN: Never expose secrets
      // 'use client'
      // const apiKey = process.env.SECRET_API_KEY // undefined in client
      
      // ✅ CORRECT: Client-safe env vars
      const publicUrl = process.env.NEXT_PUBLIC_API_URL // Available in client
      ```
    </pattern>
    <rationale>Server components run on server, client components have access to NEXT_PUBLIC_* only</rationale>
    <portability>✅ Fully portable - Next.js standard pattern</portability>
  </secrets_handling>

  <data_access>
    <pattern>
      ```typescript
      // ✅ CORRECT: Server-side data access (generic pattern)
      // 🔧 ADAPT: Replace with your database/client library
      
      // Example: Direct database client
      // const data = await db.query('SELECT * FROM posts WHERE id = ?', [id])
      
      // Example: ORM (Prisma)
      // const posts = await prisma.post.findMany({ where: { published: true } })
      
      // Example: API client
      // const response = await fetch('https://api.example.com/data', {
      //   headers: { 'Authorization': `Bearer ${serverToken}` }
      // })
      
      // Generic placeholder:
      const data = await loadDataWithAccessControl() // 🔧 Implement this
      ```
    </pattern>
    <rationale>Server-side access ensures security policies are applied, prevents client-side data exposure</rationale>
    <portability>⚠️ Pattern is portable, implementation needs adaptation</portability>
  </data_access>
</security_patterns>

<performance_patterns priority="2">
  <parallel_loading>
    <pattern>
      ```typescript
      // ✅ CORRECT: Parallel data loading (fully portable)
      const [dataResult, userResult, settingsResult] = await Promise.all([
        loadData(id),           // 🔧 Implement this
        loadUser(id),           // 🔧 Implement this
        loadSettings(id),       // 🔧 Implement this
      ])
      ```
    </pattern>
    <rationale>Parallel loading reduces total page load time</rationale>
    <portability>✅ Fully portable - standard JavaScript pattern</portability>
  </parallel_loading>

  <cache_revalidation>
    <pattern>
      ```typescript
      // ✅ CORRECT: Cache revalidation strategies (fully portable)
      
      // Dynamic content (no cache)
      export const revalidate = 0

      // Static with ISR (revalidate every hour)
      export const revalidate = 3600

      // Time-based revalidation (revalidate every minute)
      export const revalidate = 60
      
      // On-demand revalidation (in Server Actions)
      // revalidateTag('posts') or revalidatePath('/posts')
      ```
    </pattern>
    <rationale>Proper revalidation strategy balances performance and freshness</rationale>
    <portability>✅ Fully portable - Next.js standard pattern</portability>
  </cache_revalidation>

  <minimal_client_code>
    <pattern>
      ```typescript
      // ✅ CORRECT: Minimise client components (fully portable)
      // Server component loads data, client component only handles interactivity
      
      // ❌ FORBIDDEN: Don't make entire page client component
      // 'use client' // Only when necessary for interactivity
      ```
    </pattern>
    <rationale>Smaller bundle size, faster initial render, better SEO</rationale>
    <portability>✅ Fully portable - React/Next.js best practice</portability>
  </minimal_client_code>
</performance_patterns>

<common_antipatterns priority="1">
  <antipattern_1>
    <name>Client Component for Entire Page</name>
    <bad_code>
      ```typescript
      // ❌ FORBIDDEN: Entire page as client component
      'use client'
      export default function Page() {
        // Everything client-side
      }
      ```
    </bad_code>
    <good_code>
      ```typescript
      // ✅ CORRECT: Server component by default
      export default async function Page() {
        // Server-rendered, only client components for interactivity
      }
      ```
    </good_code>
    <rationale>Client components don't have server-side benefits (auth, data loading, SEO)</rationale>
    <portability>✅ Fully portable - universal antipattern</portability>
  </antipattern_1>

  <antipattern_2>
    <name>Client-Side Authentication Check</name>
    <bad_code>
      ```typescript
      // ❌ FORBIDDEN: Client-side auth check
      'use client'
      export default function Page() {
        const { user } = useAuth()
        if (!user) return <div>Access Denied</div> // Shows error, doesn't redirect
      }
      ```
    </bad_code>
    <good_code>
      ```typescript
      // ✅ CORRECT: Server-side auth check
      export default async function Page() {
        // 🔧 ADAPT: Use your auth system's server-side check
        const isAuthenticated = await checkAuthentication()
        if (!isAuthenticated) redirect('/sign-in') // Immediate redirect
      }
      ```
    </good_code>
    <rationale>Client-side checks can be bypassed, provide poor UX with loading states</rationale>
    <portability>✅ Fully portable - universal antipattern</portability>
  </antipattern_2>

  <antipattern_3>
    <name>Secrets in Client Components</name>
    <bad_code>
      ```typescript
      // ❌ FORBIDDEN: Accessing server-only secrets in client
      'use client'
      const apiKey = process.env.SECRET_API_KEY // undefined in client
      ```
    </bad_code>
    <good_code>
      ```typescript
      // ✅ CORRECT: Server-only secrets stay in server components
      export default async function Page() {
        const apiKey = process.env.SECRET_API_KEY // Available on server
      }
      ```
    </good_code>
    <rationale>Client components run in browser, only NEXT_PUBLIC_* env vars are available</rationale>
    <portability>✅ Fully portable - Next.js standard limitation</portability>
  </antipattern_3>

  <antipattern_4>
    <name>Not Awaiting searchParams</name>
    <bad_code>
      ```typescript
      // ❌ FORBIDDEN: Direct access to searchParams in Next.js 15
      export default async function Page({ searchParams }: Props) {
        const tableId = searchParams.table // Error in Next.js 15
      }
      ```
    </bad_code>
    <good_code>
      ```typescript
      // ✅ CORRECT: Await searchParams in Next.js 15
      export default async function Page({ searchParams }: Props) {
        const params = await searchParams
        const tableId = typeof params.table === 'string' ? params.table : undefined
      }
      ```
    </good_code>
    <rationale>Next.js 15 changed searchParams to Promise for better streaming support</rationale>
    <portability>✅ Fully portable - Next.js 15 standard</portability>
  </antipattern_4>
</common_antipatterns>

<checklist priority="1">
  <before_creating_page>
    - ✅ Determine if page needs authentication
    - ✅ Determine if page needs initial data loading
    - ✅ Determine if page needs client-side interactivity
    - ✅ Plan Server Component vs Client Component split
    - ✅ Plan revalidation strategy
    - ✅ 🔧 Identify authentication system to use
    - ✅ 🔧 Identify data access layer to use
  </before_creating_page>

  <implementation_checklist>
    - ✅ Page is async Server Component by default
    - ✅ Authentication check happens server-side (if protected)
    - ✅ searchParams is awaited (Next.js 15 compatibility)
    - ✅ Data loading happens server-side (if needed)
    - ✅ Client components are minimal and isolated
    - ✅ No secrets exposed to client
    - ✅ Proper error handling for data loading
    - ✅ revalidate export configured appropriately
    - ✅ TypeScript types defined for props
  </implementation_checklist>

  <security_checklist>
    - ✅ Server-side authentication checks (protected pages)
    - ✅ Redirect to sign-in for unauthenticated users
    - ✅ No secrets in client components
    - ✅ 🔧 Database/API queries use appropriate access control
    - ✅ Input validation for searchParams
    - ✅ Proper error handling without exposing internals
  </security_checklist>

  <performance_checklist>
    - ✅ Parallel data loading when possible
    - ✅ Minimal client component bundle size
    - ✅ Appropriate revalidation strategy
    - ✅ Server-side rendering for SEO and initial load
    - ✅ Critical data loaded server-side
  </performance_checklist>
</checklist>

<adaptation_guide priority="1">
  <authentication_adaptation>
    <common_systems>
      <nextauth>
        ```typescript
        // NextAuth.js pattern
        import { getServerSession } from 'next-auth/next'
        import { authOptions } from '@/app/api/auth/[...nextauth]/route'
        
        export default async function Page() {
          const session = await getServerSession(authOptions)
          if (!session) redirect('/sign-in')
        }
        ```
      </nextauth>
      
      <clerk>
        ```typescript
        // Clerk pattern
        import { auth } from '@clerk/nextjs/server'
        
        export default async function Page() {
          const { userId } = auth()
          if (!userId) redirect('/sign-in')
        }
        ```
      </clerk>
      
      <supabase>
        ```typescript
        // Supabase pattern
        import { createClient } from '@/utils/supabase/server'
        
        export default async function Page() {
          const supabase = await createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) redirect('/sign-in')
        }
        ```
      </supabase>
      
      <custom>
        ```typescript
        // Custom authentication pattern
        // Create a utility function for consistent auth checking
        async function checkAuthentication() {
          // Your authentication logic here
          return { authenticated: boolean, user: User | null }
        }
        
        export default async function Page() {
          const { authenticated, user } = await checkAuthentication()
          if (!authenticated) redirect('/sign-in')
        }
        ```
      </custom>
    </common_systems>
  </authentication_adaptation>

  <data_access_adaptation>
    <common_patterns>
      <database_direct>
        ```typescript
        // Direct database access (PostgreSQL, MySQL, etc.)
        import { db } from '@/lib/db'
        
        export default async function Page() {
          const data = await db.query('SELECT * FROM posts')
        }
        ```
      </database_direct>
      
      <orm>
        ```typescript
        // ORM pattern (Prisma, Drizzle, TypeORM, etc.)
        import { prisma } from '@/lib/prisma'
        
        export default async function Page() {
          const posts = await prisma.post.findMany()
        }
        ```
      </orm>
      
      <api_client>
        ```typescript
        // API client pattern
        import { apiClient } from '@/lib/api'
        
        export default async function Page() {
          const data = await apiClient.get('/posts')
        }
        ```
      </api_client>
    </common_patterns>
  </data_access_adaptation>
</adaptation_guide>

<examples priority="2">
  <example_1>
    <file_path>app/home/page.tsx</file_path>
    <type>Simple Public Page</type>
    <description>Minimal page with server rendering, no auth, no data loading</description>
    <portability>✅ Fully portable - no dependencies</portability>
    <code>
      ```typescript
      export const revalidate = 0;

      export default async function HomePage() {
        return (
          <div className="min-h-screen p-4">
            <h1 className="text-2xl mb-4 font-bold">Home</h1>
            {/* Server-rendered content */}
          </div>
        );
      }
      ```
    </code>
  </example_1>
</examples>

<ai_context_notes priority="3">
  <key_concepts>
    <domain_terms>Server Component, Client Component, searchParams, revalidate, redirect</domain_terms>
    <business_rules>Protected pages require server-side auth checks, all pages default to Server Components</business_rules>
    <user_expectations>Fast initial loads, secure authentication, seamless redirects</user_expectations>
  </key_concepts>

  <portability_notes>
    <fully_portable>
      - Server Component patterns
      - Client Component patterns
      - searchParams handling
      - revalidate configuration
      - Performance patterns
      - Security patterns (structure, not implementation)
      - Antipatterns
      - Checklists (structure)
    </fully_portable>
    
    <requires_adaptation>
      - Authentication implementation (pattern is portable, implementation isn't)
      - Data access implementation (pattern is portable, implementation isn't)
      - Project-specific file paths
      - Project-specific data structures
    </requires_adaptation>
  </portability_notes>

  <adaptation_checklist>
    Before using in a new project:
    1. ✅ Identify authentication system (NextAuth, Clerk, Supabase, custom)
    2. ✅ Replace authentication examples with your system's pattern
    3. ✅ Identify data access layer (database, ORM, API client)
    4. ✅ Replace data loading examples with your patterns
    5. ✅ Update file paths to match your project structure
    6. ✅ Remove or adapt project-specific references
    7. ✅ Update searchParams examples if using different patterns
  </adaptation_checklist>
</ai_context_notes>

---

## 🎯 **AI Usage Instructions**

This **generic specification** can be used in any Next.js 15 + React 19 project. Before using:

1. **Review the Adaptation Guide** to identify what needs customisation
2. **Replace authentication patterns** with your authentication system
3. **Replace data access patterns** with your data layer
4. **Update examples** to match your project structure
5. **Follow the checklists** for consistent implementation

## 📚 **Specification Scope**

This document covers **standard page setup patterns** for Next.js 15 + React 19 that are **portable across projects**:
- ✅ Server Component patterns (fully portable)
- ⚠️ Authentication handling (pattern portable, implementation needs adaptation)
- ⚠️ Data loading strategies (pattern portable, implementation needs adaptation)
- ✅ Client Component integration (fully portable)
- ✅ Security best practices (structure portable, implementation needs adaptation)
- ✅ Performance optimization (fully portable)

## 🔧 **Adaptation Required**

Marked with 🔧 throughout this document:
- Authentication system integration
- Data access layer integration
- Project-specific file paths
- Project-specific data structures

## 📁 **File Storage & Naming Convention**

**Storage Location**: `docs/__Specifications/`

**Naming Convention**: `12_NextJSPageSetup_specification_GENERIC.md`
- **GENERIC**: Indicates this is a portable version that needs adaptation
- **12**: Sequential number for logical ordering
- **NextJSPageSetup**: PascalCase description

## 🔗 **Related Specifications**

- `12_NextJSPageSetup_specification.md` - VENTIAAM-specific version with Supabase patterns
- Architecture specifications from your project
- Next.js 15 documentation for latest patterns

## ✅ **Portability Summary**

**Fully Portable (✅)**: ~70% of the spec
- Server/Client Component patterns
- searchParams handling
- revalidate strategies
- Performance patterns
- Security patterns (structure)
- Antipatterns
- Checklists

**Requires Adaptation (⚠️)**: ~30% of the spec
- Authentication implementation
- Data access implementation
- Project-specific examples

**Overall**: This spec is highly portable and can be adapted to any Next.js 15 + React 19 project in ~15-30 minutes by replacing authentication and data access patterns.

