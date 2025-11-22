# Agents Documentation

## Overview

This application supports custom AI agents that can be created and managed through the Agent Manager interface. Agents are system prompts that define how the AI behaves in conversations.

## Environment Variables

This application uses `.env` (not `.env.local`) for environment variable configuration.

### Required Environment Variables

Make sure your `.env` file in the project root contains:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Optional API Keys for AI Providers

Depending on which AI providers you want to use, you may also need:

```
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key
MISTRAL_API_KEY=your_mistral_key
FIREWORKS_API_KEY=your_fireworks_key
GROQ_API_KEY=your_groq_key
TOGETHER_API_KEY=your_together_key
XAI_API_KEY=your_xai_key
DEEPSEEK_API_KEY=your_deepseek_key
```

## Creating Custom Agents

1. Open the Agent Manager from the chat interface
2. Click "Add New Agent"
3. Fill in:
   - **Name**: Display name for the agent
   - **Description**: Brief description of the agent's purpose
   - **Content**: The system prompt that defines the agent's behavior
   - **Icon**: Choose an icon from the available options
   - **Color**: Select a color theme for the agent

## Built-in Agents

The application includes several built-in agents:
- Tutorial Guide
- Marine Facility Asset Engineer
- Navigational Aids Asset Engineer
- Strategic Asset Manager
- Various Engineering Specialists (Geotech, Civil, Structural, Electrical, Mechanical)
- Data Processing Specialist
- Location Mapping Specialist
- And more...

## Agent Preferences

Users can:
- Enable/disable agents
- Reorder agents using drag-and-drop
- Create custom agents with personalized system prompts

## Technical Details

- Agents are stored in the `user_agents` table in Supabase
- Agent preferences are stored in the `agent_preferences` table
- Built-in agents are defined in `components/data/prePrompts.ts`
- Agent management UI is in `components/chat/AgentManagerDialog.tsx`

### Generating Database Types

To generate TypeScript types from your Supabase database schema:

```bash
npx supabase gen types typescript --project-id nktqfxfotmcbxufilcnh --schema public > lib/database.types.ts
```

This command generates type definitions for all tables, views, and functions in the public schema and saves them to `lib/database.types.ts`. Run this command whenever the database schema changes to keep TypeScript types in sync.

## Layout Considerations

**Important:** When designing new pages or components, always account for the application's sidebar layout:

### Sidebar Structure

- **Outer Sidebar**: Fixed left rail, 64px wide on desktop (≥768px), hidden on mobile
  - Always present except on auth pages (`/sign-in`, `/sign-up`, `/sign-out`)
  - On mobile (<768px), renders as an overlay sheet, so no layout offset needed
- **Chat Sidebar**: Collapsible sidebar (48px collapsed, 252px expanded) - only on chat pages (`/`)
  - This is separate from the outer sidebar and only affects the chat interface

### Implementation Patterns

**CSS Variable Approach (Recommended):**
```tsx
// Use the CSS variable with responsive classes
<div className="ml-0 md:ml-[var(--outer-rail-width,64px)]">
  {/* Your page content */}
</div>
```

**Alternative - Explicit Breakpoint:**
```tsx
// Explicit 64px offset on desktop only
<div className="ml-0 md:ml-16"> {/* md:ml-16 = 64px */}
  {/* Your page content */}
</div>
```

### Best Practices

- **Always use responsive margin**: `ml-0 md:ml-[var(--outer-rail-width,64px)]` or `ml-0 md:ml-16`
- **Mobile-first**: Content should start at left edge on mobile (no offset)
- **Desktop spacing**: Account for 64px outer sidebar on desktop/tablet (≥768px)
- **Reference implementations**: 
  - See `app/admin/page.tsx` for page-level offset example
  - See `components/chat/ChatLayoutOffsets.tsx` for dynamic offset management
  - See `app/globals.css` for `.chat-page-container` pattern

