'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useChatContext } from '@/components/contexts/ChatProvider';
import { SunMedium, CalendarRange, RefreshCw, Activity } from 'lucide-react';
import { HabitTrackerDialog } from '@/components/chat/HabitTrackerDialog';
import type { AssistantRoutineType } from '@/lib/types';

interface RoutinesBarProps {
  className?: string;
  onStartDriveMode?: () => void;
}

function RoutineButton({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
}: {
  icon: typeof SunMedium;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="glass-small flex-1 min-w-[140px] sm:min-w-[160px] md:min-w-[180px] text-left border border-white/10 rounded-xl p-3 sm:p-3.5 hover:border-white/20 hover:bg-white/5 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-300 flex-shrink-0" />
        <span className="font-medium glass-text-primary text-sm sm:text-base">{label}</span>
      </div>
      <p className="text-xs sm:text-sm glass-text-secondary leading-relaxed">{description}</p>
    </button>
  );
}

export function RoutinesBar({ className, onStartDriveMode }: RoutinesBarProps) {
  const { routineStatuses, actions } = useChatContext();
  const [habitDialogOpen, setHabitDialogOpen] = useState(false);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);

  const handleRun = useCallback(
    (routine: AssistantRoutineType) => {
      actions.runRoutine(routine);
    },
    [actions]
  );

  // Map routine types to their voice prompts
  const routinePrompts: Record<AssistantRoutineType | 'habit_tracker', string> = {
    morning_briefing: 'Give me my morning briefing',
    weekly_review: 'Give me my weekly review',
    proactive_checkin: 'How is my day going?',
    habit_checkin: 'Show me my habits',
    habit_tracker: 'Show me my habits',
  };

  const handleRoutineWithDriveMode = useCallback(
    (routine: AssistantRoutineType | 'habit_tracker', prompt?: string) => {
      const routinePrompt = prompt || routinePrompts[routine] || 'Hello';
      
      // Start drive mode if callback provided
      if (onStartDriveMode) {
        onStartDriveMode();
        
        // Send prompt after 1 second delay
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('drive-mode-send-prompt', {
            detail: { prompt: routinePrompt }
          }));
        }, 1000);
      } else {
        // Fallback to regular routine execution
        if (routine === 'habit_tracker') {
          setHabitDialogOpen(true);
        } else {
          handleRun(routine);
        }
      }
    },
    [onStartDriveMode, handleRun]
  );

  const connectCalendar = useCallback(async () => {
    setConnectingCalendar(true);
    try {
      const res = await fetch('/api/integrations/google/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectTo: '/' }),
      });
      if (!res.ok) throw new Error('Failed to start OAuth');
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('[RoutinesBar] connectCalendar error', error);
    } finally {
      setConnectingCalendar(false);
    }
  }, []);

  const fetchCalendarStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/google/status', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setCalendarConnected(Boolean(data?.connected));
    } catch {
      setCalendarConnected(null);
    }
  }, []);

  useEffect(() => {
    fetchCalendarStatus();
  }, [fetchCalendarStatus]);

  const checkinRoutine = useMemo(
    () => routineStatuses.find(r => r.type === 'proactive_checkin'),
    [routineStatuses]
  );

  const handleCheckinsToggle = useCallback(
    async (checked: boolean) => {
      await fetch('/api/assistant/routines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routine_type: 'proactive_checkin',
          status: checked ? 'active' : 'disabled',
        }),
      });
      await actions.refreshRoutineStatuses();
    },
    [actions]
  );

  const formatLastRun = useCallback((type: AssistantRoutineType) => {
    const entry = routineStatuses.find(r => r.type === type);
    if (!entry?.lastRunAt) return null;
    try {
      return new Date(entry.lastRunAt).toLocaleTimeString('en-AU', { timeStyle: 'short' });
    } catch {
      return null;
    }
  }, [routineStatuses]);

  const morningLastRun = useMemo(() => formatLastRun('morning_briefing'), [formatLastRun]);
  const weeklyLastRun = useMemo(() => formatLastRun('weekly_review'), [formatLastRun]);
  const checkinLastRun = useMemo(() => formatLastRun('proactive_checkin'), [formatLastRun]);
  const nextCheckin = useMemo(() => {
    if (!checkinRoutine?.nextRunAt) return null;
    try {
      return new Date(checkinRoutine.nextRunAt).toLocaleTimeString('en-AU', { timeStyle: 'short' });
    } catch {
      return null;
    }
  }, [checkinRoutine]);
  const proactiveEnabled = checkinRoutine?.status !== 'disabled';

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 mb-3 ${className ?? ''}`}>
      {/* Main routine buttons - optimized for mobile landscape */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2 sm:gap-3">
        <RoutineButton
          icon={SunMedium}
          label="Morning Briefing"
          description={morningLastRun ? `Last run ${morningLastRun}` : 'Memories • weather • agenda'}
          onClick={() => handleRoutineWithDriveMode('morning_briefing')}
        />
        <RoutineButton
          icon={CalendarRange}
          label="Weekly Review"
          description={weeklyLastRun ? `Last run ${weeklyLastRun}` : 'Summarize wins + focus'}
          onClick={() => handleRoutineWithDriveMode('weekly_review')}
        />
        <RoutineButton
          icon={RefreshCw}
          label="Proactive Check-in"
          description={checkinLastRun ? `Last run ${checkinLastRun}` : 'Gentle nudge after events'}
          onClick={() => handleRoutineWithDriveMode('proactive_checkin')}
        />
        <button
          type="button"
          onClick={() => handleRoutineWithDriveMode('habit_tracker')}
          className="glass-small flex-1 min-w-[140px] sm:min-w-[160px] md:min-w-[180px] text-left border border-white/10 rounded-xl p-3 sm:p-3.5 hover:border-white/20 hover:bg-white/5 active:scale-[0.98] transition-all duration-200"
        >
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-300 flex-shrink-0" />
            <span className="font-medium glass-text-primary text-sm sm:text-base">Habit Tracker</span>
          </div>
          <p className="text-xs sm:text-sm glass-text-secondary leading-relaxed">Log streaks + reminders</p>
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={connectCalendar}
          disabled={connectingCalendar}
          className="glass-small min-w-[140px] sm:min-w-[160px] md:min-w-[180px] border-cyan-500/40 hover:border-cyan-400/60 hover:bg-cyan-500/10 transition-all duration-200 text-xs sm:text-sm"
        >
          {calendarConnected ? (
            <span className="truncate">Calendar Connected</span>
          ) : (
            <span className="truncate">Connect Calendar</span>
          )}
        </Button>
      </div>
      
      {/* Proactive Check-ins toggle - full width for better mobile UX */}
      <div className="glass-small border border-white/10 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="glass-text-primary font-medium text-sm sm:text-base mb-0.5">Proactive Check-ins</p>
          <p className="text-xs sm:text-sm glass-text-secondary">
            {nextCheckin ? `Next reminder around ${nextCheckin}` : 'Schedule automatic follow-ups'}
          </p>
        </div>
        <Switch checked={proactiveEnabled} onCheckedChange={handleCheckinsToggle} className="flex-shrink-0" />
      </div>
      
      <HabitTrackerDialog open={habitDialogOpen} onOpenChange={setHabitDialogOpen} />
    </div>
  );
}


