'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useChatContext } from '@/components/contexts/ChatProvider';
import { CheckCircle2, PlusCircle } from 'lucide-react';

interface HabitTrackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HabitTrackerDialog({ open, onOpenChange }: HabitTrackerDialogProps) {
  const { habits, actions } = useChatContext();
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('daily');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeHabits = useMemo(() => habits.filter((habit) => habit.isActive), [habits]);

  const handleCreateHabit = useCallback(async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          cadence,
        }),
      });
      setTitle('');
      await actions.refreshHabits();
    } finally {
      setIsSubmitting(false);
    }
  }, [title, cadence, actions]);

  const toggleHabitActive = useCallback(
    async (habitId: string, nextState: boolean) => {
      await fetch(`/api/habits/${habitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextState }),
      });
      await actions.refreshHabits();
    },
    [actions]
  );

  const completeHabit = useCallback(
    async (habitId: string) => {
      await actions.logHabitCompletion(habitId);
    },
    [actions]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-large max-w-2xl">
        <DialogHeader>
          <DialogTitle className="glass-text-primary">Habit Tracker</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="habit-title" className="glass-text-primary text-xs uppercase tracking-wide">
                New Habit
              </Label>
              <Input
                id="habit-title"
                placeholder="e.g. Hydrate before meetings"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="glass-small"
              />
            </div>
            <div className="space-y-2">
              <Label className="glass-text-primary text-xs uppercase tracking-wide">Cadence</Label>
              <div className="flex gap-3">
                {(['daily', 'weekly'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCadence(value)}
                    className={`flex-1 px-3 py-2 rounded-md border text-sm ${
                      cadence === value
                        ? 'border-cyan-400 text-cyan-100 bg-cyan-500/10'
                        : 'border-white/10 text-white/60 bg-white/5'
                    }`}
                  >
                    {value === 'daily' ? 'Daily' : 'Weekly'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleCreateHabit}
              disabled={!title.trim() || isSubmitting}
              className="glass-small inline-flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Add Habit
            </Button>
          </div>
          <div className="space-y-3">
            {activeHabits.length === 0 ? (
              <p className="glass-text-secondary text-sm">No active habits yet. Create one above to get started.</p>
            ) : (
              activeHabits.map((habit) => (
                <div
                  key={habit.id}
                  className="flex flex-col md:flex-row md:items-center justify-between glass-small p-3 rounded-xl border border-white/10"
                >
                  <div>
                    <p className="font-medium glass-text-primary">{habit.title}</p>
                    <p className="text-xs glass-text-secondary capitalize">Cadence: {habit.cadence}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-3 md:mt-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-emerald-300 hover:text-emerald-200"
                      onClick={() => completeHabit(habit.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Done
                    </Button>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={habit.isActive}
                        onCheckedChange={(checked) => toggleHabitActive(habit.id, checked)}
                      />
                      <span className="text-xs glass-text-secondary">{habit.isActive ? 'Active' : 'Paused'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


