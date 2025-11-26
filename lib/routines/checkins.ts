import { fetchUpcomingEvents } from '@/lib/googleCalendar';

export interface CheckInPayload {
  prompt: string;
  eventTitle?: string;
  eventTime?: string;
  generatedAt: string;
  nextRunAt: string;
}

export async function buildProactiveCheckIn(userId: string): Promise<CheckInPayload> {
  const events = await fetchUpcomingEvents(userId, { maxResults: 1 });
  const target = events[0];
  let nextRunAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  if (!target) {
    return {
      prompt: 'How is your day going? Anything I can help you prepare for?',
      generatedAt: new Date().toISOString(),
      nextRunAt,
    };
  }

  const when = new Date(target.start).toLocaleTimeString('en-AU', {
    timeStyle: 'short',
  });
  try {
    const eventStart = new Date(target.start);
    nextRunAt = new Date(eventStart.getTime() + 30 * 60 * 1000).toISOString();
  } catch {
    nextRunAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  }

  return {
    prompt: `How did "${target.title}" go? Want to capture any notes while it is fresh?`,
    eventTitle: target.title,
    eventTime: when,
    generatedAt: new Date().toISOString(),
    nextRunAt,
  };
}


