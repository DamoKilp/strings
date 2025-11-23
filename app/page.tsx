'use client'

import { useState } from 'react'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { Sidebar } from '@/components/sidebarComponents/Sidebar'
import { ChatLayoutOffsets } from '@/components/chat/ChatLayoutOffsets'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useIsMobile } from '@/app/hooks/use-mobile'

export default function Page() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const isMobile = useIsMobile()

  return (
    <main className="chat-page-container flex flex-col lg:flex-row min-h-[100dvh] w-full overflow-hidden relative">
      <ChatLayoutOffsets />
      {/* Mobile-only button to open sidebar */}
      <button
        className="fixed top-4 right-4 z-[60] flex items-center justify-center w-11 h-11 rounded-full bg-foreground/80 shadow-lg border border-foreground/20 backdrop-blur-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 lg:hidden"
        onClick={() => setIsMobileSidebarOpen(true)}
        aria-label="Open conversations"
      >
        <Menu size={28} className="text-background" />
      </button>
      {/* Mobile sidebar sheet */}
      {isMobile && (
        <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <Sidebar defaultCollapsed={false} />
          </SheetContent>
        </Sheet>
      )}
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
