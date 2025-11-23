'use client'

import { ChatInterface } from '@/components/chat/ChatInterface'
import { Sidebar } from '@/components/sidebarComponents/Sidebar'
import { ChatLayoutOffsets } from '@/components/chat/ChatLayoutOffsets'

export default function Page() {
  return (
    <main className="chat-page-container flex flex-col lg:flex-row min-h-[100dvh] w-full overflow-hidden">
      <ChatLayoutOffsets />
      {/* Chat Sidebar (collapsible) - Hidden on mobile, shown on desktop */}
      <aside className="hidden lg:block h-full flex-shrink-0">
        <Sidebar defaultCollapsed={true} />
      </aside>
      {/* Chat Interface */}
      <div className="flex-1 h-full min-w-0 w-full lg:w-auto">
        <ChatInterface />
      </div>
    </main>
  )
}
