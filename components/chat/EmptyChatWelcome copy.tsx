'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  Mic,
  Sparkles,
  Zap,
  FileSpreadsheet,
  ArrowRight,
  Volume2
} from 'lucide-react'

interface EmptyChatWelcomeProps {
  onQuickPrompt: (text: string) => void
  onStartDriveMode: () => void
  className?: string
}

export default function EmptyChatWelcome({ onQuickPrompt, onStartDriveMode, className }: EmptyChatWelcomeProps) {
  const router = useRouter()
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  const quickActions = [
    {
      icon: Sparkles,
      label: 'Explore Features',
      description: 'Discover all capabilities',
      onClick: () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('open-agent-manager'))
        }
      },
      gradient: 'from-amber-500 to-orange-500'
    },
    {
      icon: Zap,
      label: 'Data Tools',
      description: 'Clean and validate data',
      onClick: () => router.push('/Projects/table-data-management'),
      gradient: 'from-yellow-500 to-amber-500'
    },
    {
      icon: FileSpreadsheet,
      label: 'Import CSV',
      description: 'Load and prepare files',
      onClick: () => onQuickPrompt('Help me import a CSV file'),
      gradient: 'from-emerald-500 to-teal-500'
    }
  ]

  const features = [
    { icon: Volume2, label: 'Voice Enabled', desc: 'Natural conversations' },
    { icon: Bot, label: 'Smart Agents', desc: 'Expert specialists' },
    { icon: FileSpreadsheet, label: 'Data Ready', desc: 'Import & analyze' },
    { icon: Zap, label: 'Fast & Efficient', desc: 'Real-time processing' }
  ]

  return (
    <div className={`w-full h-full min-h-0 ${className ?? ''}`}>
      {/* Main content */}
      <div className="relative z-10 h-full min-h-0 flex flex-col items-center px-4 pt-6 md:pt-8 pb-0 overflow-hidden">
        <div className="w-full max-w-6xl flex flex-col gap-2 md:gap-2 overflow-hidden">
          {/* Header section */}
          <div className="text-center mb-8 md:mb-10 space-y-3 md:space-y-4 shrink-0">
            <div className="inline-flex items-center justify-center gap-2 mb-4">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-lg text-cyan-700 dark:text-cyan-300">AI Assistant Platform</span>
            </div>

          </div>

          {/* Main cards grid */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
            {/* Voice Chat Card */}
            <div
              onMouseEnter={() => setHoveredCard('voice')}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={onStartDriveMode}
              className="group relative cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 opacity-0 group-hover:opacity-100"></div>

              <div className="relative glass-medium dark:bg-gradient-to-br dark:from-slate-700/50 dark:to-slate-800/50 dark:border dark:border-slate-600/50 rounded-2xl p-6 md:p-8 group-hover:border-violet-400/50 transition-all duration-300 overflow-hidden">
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="relative z-10">
                  <div className="mb-6 flex items-start justify-between">
                    <div className="p-3 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl group-hover:shadow-lg group-hover:shadow-violet-500/50 transition-all duration-300">
                      <Mic className="w-6 h-6 text-white" />
                    </div>
                    <span className="px-3 py-1 bg-violet-500/20 border border-violet-400/30 rounded-full text-xs font-semibold text-violet-300">Drive Mode</span>
                  </div>

                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2">Voice Chat</h2>
                  <p className="text-slate-700 dark:text-gray-300 mb-4 md:mb-6">Real-time hands-free conversations. Perfect for multitasking and on-the-go interactions.</p>

                  <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-medium group-hover:gap-3 transition-all duration-300">
                    <span>Start Drive Mode</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Agents Card (hidden on mobile) */}
            <div
              onMouseEnter={() => setHoveredCard('agents')}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('open-agent-manager')) }}
              className="group relative cursor-pointer hidden md:block"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-cyan-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 opacity-0 group-hover:opacity-100"></div>

              <div className="relative glass-medium dark:bg-gradient-to-br dark:from-slate-700/50 dark:to-slate-800/50 dark:border dark:border-slate-600/50 rounded-2xl p-6 md:p-8 group-hover:border-cyan-400/50 transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="relative z-10">
                  <div className="mb-6 flex items-start justify-between">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-all duration-300">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-400/30 rounded-full text-xs font-semibold text-cyan-300">Smart</span>
                  </div>

                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2">AI Agents</h2>
                  <p className="text-slate-700 dark:text-gray-300 mb-4 md:mb-6">Specialized assistants for marine engineering, geotechnical analysis, and strategic asset management.</p>

                  <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 font-medium group-hover:gap-3 transition-all duration-300">
                    <span>Explore Agents</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick actions grid */}
          <div className="mb-6 md:mb-8 shrink-0">
            <div className="mb-3 md:mb-4">
              <h3 className="text-slate-600 dark:text-gray-400 text-xs md:text-sm font-semibold uppercase tracking-widest">Quick Actions</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={action.onClick}
                  className="group glass-small dark:bg-slate-700/40 dark:hover:bg-slate-700/60 dark:border dark:border-slate-600/50 dark:hover:border-slate-500/50 rounded-xl p-4 md:p-5 transition-all duration-300 text-left"
                >
                  <div className={`p-2 bg-gradient-to-br ${action.gradient} rounded-lg w-fit mb-3 group-hover:shadow-lg transition-all`}>
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{action.label}</h4>
                  <p className="text-sm text-slate-600 dark:text-gray-400">{action.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Feature highlights (hide on small screens to save space) */}
          <div className="hidden lg:block glass-medium dark:bg-gradient-to-r dark:from-slate-700/30 dark:to-slate-600/30 dark:border dark:border-slate-600/50 rounded-xl p-5 md:p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {features.map((feature, idx) => (
                <div key={idx} className="flex flex-col items-center md:items-start text-center md:text-left">
                  <feature.icon className="w-5 h-5 text-cyan-600 dark:text-cyan-400 mb-2 md:mb-3" />
                  <p className="font-semibold text-slate-900 dark:text-white text-sm mb-1">{feature.label}</p>
                  <p className="text-slate-600 dark:text-gray-400 text-xs">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer status */}
          <div className="text-center mt-6 md:mt-8 shrink-0">
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
