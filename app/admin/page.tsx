'use client'

import { useEffect, useState } from 'react'
import { useRBAC } from '@/app/hooks/useRBAC'
import { Permission, UserRole } from '@/types/rbac'
import { AdminUserManagement } from '@/components/admin/AdminUserManagement'
import { AdminPasswordChange } from '@/components/admin/AdminPasswordChange'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings } from 'lucide-react'

export default function AdminPage() {
  const { hasPermission, hasRole, isLoading } = useRBAC()
  const [mounted, setMounted] = useState(false)

  // Hydration safety pattern: set mounted state after initial render to prevent hydration mismatch
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if user has admin permissions (for User Management tab)
  const hasAdminAccess = hasPermission(Permission.MANAGE_USERS) || 
                        hasPermission(Permission.MANAGE_ROLES) ||
                        hasRole(UserRole.ADMIN) ||
                        hasRole(UserRole.SUPER_ADMIN)

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="text-center">
          <p className="glass-text-secondary text-sm">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ml-0 md:ml-[var(--outer-rail-width,64px)] px-2 sm:px-4 md:px-8 py-4 md:py-6 min-h-[100dvh] flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="glass-medium glass-legible rounded-3xl p-6 flex items-center justify-between relative overflow-hidden mb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold glass-text-primary">Settings</h1>
            <p className="glass-text-secondary text-sm">
              {hasAdminAccess 
                ? 'Manage users and system settings'
                : 'Configure your application preferences'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0">
        <Tabs defaultValue="settings" className="h-full flex flex-col">
          <TabsList className="glass-medium glass-legible rounded-2xl p-1.5 sm:h-[50px] mb-4">
            <TabsTrigger value="settings" className="h-[30px] px-4 text-sm">Settings</TabsTrigger>
            {hasAdminAccess && (
              <TabsTrigger value="users" className="h-[30px] px-4 text-sm">User Management</TabsTrigger>
            )}
            <TabsTrigger value="password" className="h-[30px] px-4 text-sm">Change Password</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="flex-1 min-h-0">
            <div className="glass-medium glass-legible rounded-2xl p-3 sm:p-6 h-full flex flex-col">
              <div className="shrink-0 mb-4">
                <h2 className="text-lg font-semibold glass-text-primary mb-2">Application Settings</h2>
                <p className="glass-text-secondary text-sm">
                  Configure application preferences and options
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <div className="space-y-4">
                  <p className="glass-text-secondary text-sm">
                    Settings panel coming soon. This will include:
                  </p>
                  <ul className="list-disc list-inside space-y-2 glass-text-secondary text-sm ml-4">
                    <li>Theme preferences</li>
                    <li>Notification settings</li>
                    <li>Default model selection</li>
                    <li>Chat preferences</li>
                    <li>Data export options</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {hasAdminAccess && (
            <TabsContent value="users" className="flex-1 min-h-0">
              <div className="glass-medium glass-legible rounded-2xl p-3 sm:p-6 h-full flex flex-col">
                <div className="shrink-0 mb-4">
                  <h2 className="text-lg font-semibold glass-text-primary mb-2">User Management</h2>
                  <p className="glass-text-secondary text-sm">
                    Add, remove, and manage user accounts
                  </p>
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <AdminUserManagement />
                </div>
              </div>
            </TabsContent>
          )}

          <TabsContent value="password" className="flex-1 min-h-0">
            <div className="glass-medium glass-legible rounded-2xl p-3 sm:p-6 h-full flex flex-col">
              <div className="shrink-0 mb-4">
                <h2 className="text-lg font-semibold glass-text-primary mb-2">Change Password</h2>
                <p className="glass-text-secondary text-sm">
                  Update your account password
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <AdminPasswordChange />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

