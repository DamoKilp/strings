import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { AssistantRoutineType } from '@/lib/types';

type PreferencesRow = Database['public']['Tables']['user_preferences']['Row'];
type NudgeSettings = PreferencesRow['nudge_settings'];

export type HabitRecord = {
  id: string;
  title: string;
  description?: string | null;
  cadence: 'daily' | 'weekly';
  reminderTime?: string | null;
  reminderDays?: number[] | null;
  isActive: boolean;
  streakCount: number;
  lastCompletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  history?: string[];
};

export type RoutineStatus = {
  type: AssistantRoutineType;
  status: 'active' | 'disabled' | 'idle';
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  config?: Record<string, unknown>;
};

export type GoogleCalendarToken = {
  accessToken: string;
  refreshToken: string;
  scope?: string | null;
  tokenType?: string | null;
  expiryDate?: string | null;
};

export type AssistantState = {
  habits: HabitRecord[];
  routines: RoutineStatus[];
  googleCalendar?: GoogleCalendarToken;
};

type AssistantSettingsContainer = {
  assistant?: AssistantState;
  [key: string]: unknown;
};

const defaultState: AssistantState = {
  habits: [],
  routines: [],
};

type TypedSupabaseClient = SupabaseClient<any>;

async function fetchRawSettings(
  client: TypedSupabaseClient,
  userId: string
): Promise<{ base: AssistantSettingsContainer; exists: boolean }> {
  const { data, error } = await client
    .from('user_preferences')
    .select('nudge_settings')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const base = (data?.nudge_settings as AssistantSettingsContainer | null) ?? {};
  return { base, exists: Boolean(data) };
}

function normalizeState(state?: AssistantState | null): AssistantState {
  const clone = state ? (JSON.parse(JSON.stringify(state)) as AssistantState) : defaultState;
  return {
    habits: Array.isArray(clone.habits) ? clone.habits : [],
    routines: Array.isArray(clone.routines) ? clone.routines : [],
    googleCalendar: clone.googleCalendar,
  };
}

export async function readAssistantState(client: TypedSupabaseClient, userId: string): Promise<AssistantState> {
  const { base } = await fetchRawSettings(client, userId);
  return normalizeState(base.assistant);
}

export async function updateAssistantState(
  client: TypedSupabaseClient,
  userId: string,
  updater: (current: AssistantState) => AssistantState
): Promise<AssistantState> {
  const { base } = await fetchRawSettings(client, userId);
  const current = normalizeState(base.assistant);
  const next = normalizeState(updater(JSON.parse(JSON.stringify(current))));
  const payload: Database['public']['Tables']['user_preferences']['Insert'] = {
    user_id: userId,
    nudge_settings: { ...base, assistant: next } as NudgeSettings,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from('user_preferences').upsert(payload, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  return next;
}

export async function getRoutineStatuses(
  client: TypedSupabaseClient,
  userId: string
): Promise<RoutineStatus[]> {
  const state = await readAssistantState(client, userId);
  return state.routines;
}

export async function upsertRoutineStatus(
  client: TypedSupabaseClient,
  userId: string,
  routine: RoutineStatus
): Promise<RoutineStatus[]> {
  const next = await updateAssistantState(client, userId, (draft) => {
    const existingIndex = draft.routines.findIndex((r) => r.type === routine.type);
    if (existingIndex === -1) {
      draft.routines.push(routine);
    } else {
      draft.routines[existingIndex] = { ...draft.routines[existingIndex], ...routine };
    }
    return draft;
  });
  return next.routines;
}

export async function saveGoogleCalendarToken(
  client: TypedSupabaseClient,
  userId: string,
  token: GoogleCalendarToken | null
): Promise<void> {
  await updateAssistantState(client, userId, (draft) => {
    draft.googleCalendar = token ?? undefined;
    return draft;
  });
}

