import { ChatInterface } from '@/components/chat/ChatInterface'
import { Sidebar } from '@/components/sidebarComponents/Sidebar'
import { ChatLayoutOffsets } from '@/components/chat/ChatLayoutOffsets'

export default function Page() {
  return (
    <main className="chat-page-container flex">
      <ChatLayoutOffsets />
      {/* Chat Sidebar (collapsible) */}
      <aside className="h-full">
        <Sidebar defaultCollapsed={true} />
      </aside>
      {/* Chat Interface */}
      <div className="flex-1 h-full">
        <ChatInterface />
      </div>
    </main>
  )
}
