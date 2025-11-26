import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { HabitsService } from '@/lib/habitsService';

interface HabitStats {
  habitId: string;
  title: string;
  completions: number;
}

interface WeeklyReviewPayload {
  summary: string;
  highlights: string[];
  focusAreas: string[];
  habitStats: HabitStats[];
  generatedAt: string;
  nextRunAt: string;
}

type SupabaseDbClient = SupabaseClient<any>;

async function fetchHabitStats(
  client: SupabaseDbClient,
  userId: string,
  since: number
): Promise<HabitStats[]> {
  const habits = await HabitsService.listHabits(client, userId);
  if (!habits.length) return [];

  return habits.map((habit) => {
    const history = Array.isArray(habit.history) ? habit.history : [];
    const completions = history.filter((entry) => {
      const ts = Date.parse(entry);
      return !Number.isNaN(ts) && ts >= since;
    }).length;
    return {
      habitId: habit.id,
      title: habit.title,
      completions,
    };
  });
}

export async function buildWeeklyReview(
  client: SupabaseDbClient,
  userId: string
): Promise<WeeklyReviewPayload> {
  const sinceTs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const habitStats = await fetchHabitStats(client, userId, sinceTs);

  const highlights: string[] = [];
  const focusAreas: string[] = [];

  habitStats.forEach((stat) => {
    if (stat.completions >= 5) {
      highlights.push(`${stat.title}: ${stat.completions} completions`);
    } else {
      focusAreas.push(`${stat.title}: ${stat.completions} completions`);
    }
  });

  const summary = [
    `You maintained ${highlights.length} strong habit${highlights.length === 1 ? '' : 's'}.`,
    focusAreas.length
      ? `Focus on ${focusAreas.slice(0, 2).map((area) => area.split(':')[0]).join(', ')} next week.`
      : 'Great consistency across all tracked habits!',
  ].join(' ');

  return {
    summary,
    highlights,
    focusAreas,
    habitStats,
    generatedAt: new Date().toISOString(),
    nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}


