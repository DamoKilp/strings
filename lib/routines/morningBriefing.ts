import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { HabitsService } from '@/lib/habitsService';
import { fetchUpcomingEvents, getDefaultCoordinates } from '@/lib/googleCalendar';
import { fetchCurrentWeather, type WeatherSnapshot } from '@/lib/weatherService';

interface MemoryRow {
  content: string;
  category: string | null;
  importance: number;
  created_at: string;
}

export interface MorningBriefingSection {
  title: string;
  items: string[];
}

export interface MorningBriefingPayload {
  summary: string;
  weather: WeatherSnapshot | null;
  events: Awaited<ReturnType<typeof fetchUpcomingEvents>>;
  memories: MemoryRow[];
  habits: Awaited<ReturnType<typeof HabitsService.listHabits>>;
  sections: MorningBriefingSection[];
  timezone: string;
  generatedAt: string;
  nextRunAt: string;
}

type SupabaseDbClient = SupabaseClient<any>;

async function fetchTopMemories(client: SupabaseDbClient, userId: string): Promise<MemoryRow[]> {
  const { data, error } = await client
    .from('memories')
    .select('content,category,importance,created_at')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function buildMorningBriefing(
  client: SupabaseDbClient,
  userId: string
): Promise<MorningBriefingPayload> {
  const timezone = 'Australia/Perth';
  const [memories, habits, events, weather] = await Promise.all([
    fetchTopMemories(client, userId),
    HabitsService.listHabits(client, userId),
    fetchUpcomingEvents(userId, { maxResults: 4 }),
    (async () => {
      const { latitude, longitude } = getDefaultCoordinates();
      return fetchCurrentWeather({ latitude, longitude, timezone });
    })(),
  ]);

  const pendingHabits = habits.filter((habit) => habit.isActive).slice(0, 3);
  const sections: MorningBriefingSection[] = [];

  if (memories.length) {
    sections.push({
      title: 'Recent Memories',
      items: memories.map((memory) => memory.content),
    });
  }

  if (pendingHabits.length) {
    sections.push({
      title: 'Habits to focus on',
      items: pendingHabits.map((habit) => habit.title),
    });
  }

  if (events.length) {
    sections.push({
      title: 'Upcoming events',
      items: events.map((event) => {
        const when = new Date(event.start).toLocaleTimeString('en-AU', { timeStyle: 'short' });
        return `${when} — ${event.title}`;
      }),
    });
  }

  if (weather) {
    sections.push({
      title: 'Weather',
      items: [
        `${weather.description} • ${weather.temperature ?? '—'}°C`,
        weather.feelsLike ? `Feels like ${weather.feelsLike}°C` : '',
      ].filter(Boolean),
    });
  }

  const summaryParts: string[] = [];
  if (weather) {
    summaryParts.push(
      `Weather looks ${weather.description.toLowerCase()} with ${weather.temperature ?? 'mild'}°C temperatures.`
    );
  }
  if (events.length) {
    summaryParts.push(`You have ${events.length} upcoming event${events.length > 1 ? 's' : ''} today.`);
  }
  if (pendingHabits.length) {
    summaryParts.push(
      `Key habits to reinforce: ${pendingHabits.map((habit) => habit.title).join(', ')}.`
    );
  }

  const summary = summaryParts.join(' ');

  const nextRun = new Date();
  nextRun.setHours(6, 0, 0, 0);
  if (nextRun.getTime() <= Date.now()) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return {
    summary,
    weather,
    events,
    memories,
    habits,
    sections,
    timezone,
    generatedAt: new Date().toISOString(),
    nextRunAt: nextRun.toISOString(),
  };
}


