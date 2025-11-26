import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { readAssistantState, updateAssistantState, type HabitRecord } from './assistantSettings';

export type TypedSupabaseClient = SupabaseClient<any>;

function generateHabitId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export const HabitsService = {
  async listHabits(client: TypedSupabaseClient, userId: string): Promise<HabitRecord[]> {
    const state = await readAssistantState(client, userId);
    return state.habits;
  },

  async createHabit(
    client: TypedSupabaseClient,
    userId: string,
    payload: Partial<HabitRecord> & { title: string; cadence?: 'daily' | 'weekly' }
  ): Promise<HabitRecord> {
    const now = new Date().toISOString();
    const newHabit: HabitRecord = {
      id: generateHabitId(),
      title: payload.title.trim(),
      description: payload.description ?? null,
      cadence: payload.cadence ?? 'daily',
      reminderTime: payload.reminderTime ?? null,
      reminderDays: payload.reminderDays ?? null,
      isActive: true,
      streakCount: 0,
      lastCompletedAt: null,
      createdAt: now,
      updatedAt: now,
      history: [],
    };
    const state = await updateAssistantState(client, userId, (draft) => {
      draft.habits.push(newHabit);
      return draft;
    });
    return state.habits.find((habit) => habit.id === newHabit.id) ?? newHabit;
  },

  async updateHabit(
    client: TypedSupabaseClient,
    userId: string,
    habitId: string,
    payload: Partial<HabitRecord>
  ): Promise<HabitRecord | null> {
    const state = await updateAssistantState(client, userId, (draft) => {
      const index = draft.habits.findIndex((habit) => habit.id === habitId);
      if (index === -1) return draft;
      draft.habits[index] = {
        ...draft.habits[index],
        ...payload,
        title: payload.title?.trim() || draft.habits[index].title,
        updatedAt: new Date().toISOString(),
      };
      return draft;
    });
    return state.habits.find((habit) => habit.id === habitId) ?? null;
  },

  async deleteHabit(client: TypedSupabaseClient, userId: string, habitId: string): Promise<void> {
    await updateAssistantState(client, userId, (draft) => {
      draft.habits = draft.habits.filter((habit) => habit.id !== habitId);
      return draft;
    });
  },

  async logCompletion(
    client: TypedSupabaseClient,
    userId: string,
    habitId: string
  ): Promise<HabitRecord | null> {
    const state = await updateAssistantState(client, userId, (draft) => {
      const habit = draft.habits.find((h) => h.id === habitId);
      if (!habit) return draft;
      const now = new Date();
      const lastCompleted = habit.lastCompletedAt ? new Date(habit.lastCompletedAt) : null;
      const isSameDay =
        lastCompleted &&
        now.getFullYear() === lastCompleted.getFullYear() &&
        now.getMonth() === lastCompleted.getMonth() &&
        now.getDate() === lastCompleted.getDate();
      const updatedStreak = isSameDay ? habit.streakCount : habit.streakCount + 1;
      habit.streakCount = updatedStreak;
      habit.lastCompletedAt = now.toISOString();
      habit.updatedAt = habit.lastCompletedAt;
      if (!isSameDay) {
        habit.history = Array.isArray(habit.history) ? habit.history : [];
        habit.history.push(habit.lastCompletedAt);
        if (habit.history.length > 60) {
          habit.history = habit.history.slice(-60);
        }
      }
      return draft;
    });
    return state.habits.find((habit) => habit.id === habitId) ?? null;
  },
};


