'use client'

import React, { useState } from 'react'
import {
  Mic,
  ArrowRight,
  SunMedium,
  CalendarDays,
  CalendarRange,
  RefreshCw,
  Activity,
} from 'lucide-react'
import { StringsIcon } from '@/components/icons/StringsIcon'

interface EmptyChatWelcomeProps {
  onQuickPrompt: (text: string) => void
  onStartDriveMode: () => void
  onRunMorningBriefing: () => void
  onRunWeeklyReview: () => void
  onRunProactiveCheckin: () => void
  onOpenHabitTracker: () => void
  onConnectCalendar: () => void
  className?: string
}

export default function EmptyChatWelcome({
  onQuickPrompt, // kept for backwards-compatibility (not currently used in UI)
  onStartDriveMode,
  onRunMorningBriefing,
  onRunWeeklyReview,
  onRunProactiveCheckin,
  onOpenHabitTracker,
  onConnectCalendar,
  className,
}: EmptyChatWelcomeProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  const updateTiles: {
    key: string
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    label: string
    description: string
    onClick: () => void
  }[] = [
    {
      key: 'morning',
      icon: SunMedium,
      label: 'Morning Briefing',
      description: 'Memories • weather • agenda',
      onClick: onRunMorningBriefing,
    },
    {
      key: 'habits',
      icon: Activity,
      label: 'Habit Tracker',
      description: 'Track streaks & daily habits',
      onClick: onOpenHabitTracker,
    },
    {
      key: 'weekly',
      icon: CalendarRange,
      label: 'Weekly Review',
      description: 'Summarise wins & focus areas',
      onClick: onRunWeeklyReview,
    },
    {
      key: 'checkins',
      icon: RefreshCw,
      label: 'Proactive Check-ins',
      description: 'Gentle follow-ups after events',
      onClick: onRunProactiveCheckin,
    },
    {
      key: 'calendar',
      icon: CalendarDays,
      label: 'Connect Calendar',
      description: 'Use upcoming events in chat',
      onClick: onConnectCalendar,
    },
  ]

  return (
    <div className={`w-full min-h-full empty-chat-root ${className ?? ''}`}>
      {/* Main content */}
      <div className="relative z-10 min-h-full flex flex-col items-center px-4 pt-4 sm:pt-6 pb-4">
        <div className="w-full max-w-xl sm:max-w-2xl flex flex-col gap-4 sm:gap-5">
          {/* Header section */}
          <div className="text-center space-y-2 sm:space-y-3 shrink-0 empty-chat-header">
            <div className="inline-flex items-center justify-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                <StringsIcon size={24} className="text-white" fill="white" />
              </div>
              <span className="font-semibold text-base sm:text-lg text-cyan-700 dark:text-cyan-300 empty-chat-title">
                AI Assistant Platform
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 max-w-md mx-auto empty-chat-tagline">
              Designed for mobile-first use. Start Drive Mode for hands-free conversations, or tap a routine to run Update
              2.0 features.
            </p>
          </div>

          {/* Primary Drive Mode call-to-action */}
          <button
            type="button"
            onMouseEnter={() => setHoveredCard('voice')}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={onStartDriveMode}
            className="group relative cursor-pointer w-full"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 opacity-0 group-hover:opacity-100" />

            <div className="relative glass-medium dark:bg-gradient-to-br dark:from-slate-700/60 dark:to-slate-900/60 dark:border dark:border-slate-700/60 rounded-2xl p-4 sm:p-5 md:p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl group-hover:shadow-lg group-hover:shadow-violet-500/50 transition-all duration-300">
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-violet-300 mb-1">
                    Drive Mode
                  </p>
                  <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white">
                    Start Voice Assistant
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-gray-300">
                    Real-time, hands-free conversations while you drive or multitask.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-400/40 text-[11px] sm:text-xs font-semibold text-violet-100">
                  Tap to start
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </button>

          {/* Update 2.0 routines grid */}
          <section className="shrink-0 empty-chat-routines">
            <div className="mb-3">
              <h3 className="text-slate-600 dark:text-gray-400 text-xs sm:text-sm font-semibold uppercase tracking-widest text-center sm:text-left">
                Update 2.0 routines
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 empty-chat-routines-grid">
              {updateTiles.map((tile) => (
                <button
                  key={tile.key}
                  type="button"
                  onClick={tile.onClick}
                  className="group glass-small w-full min-w-0 rounded-xl border border-white/10 p-2.5 sm:p-3 text-left flex flex-col gap-1.5 hover:border-white/20 hover:bg-white/5 active:scale-[0.98] transition-all duration-200 empty-chat-routine-tile"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-cyan-500/70 to-sky-500/80 group-hover:shadow-md group-hover:shadow-cyan-500/40 transition-all">
                      <tile.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <span className="font-semibold text-[11px] sm:text-xs glass-text-primary truncate">
                      {tile.label}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs glass-text-secondary leading-snug">
                    {tile.description}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* Footer status */}
          <div className="text-center mt-4 md:mt-6 shrink-0 empty-chat-footer">
            <div className="flex justify-center items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <p className="text-slate-600 dark:text-gray-400 text-sm">All systems operational • Ready to assist</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
