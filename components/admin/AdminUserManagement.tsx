'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { UserRole, ROLE_METADATA } from '@/types/rbac'

interface User {
  id: string
  user_id: string
  email: string
  role: string
  display_name: string | null
  is_active: boolean
  created_at: string
}

export function AdminUserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  
  // Add user form state
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.USER)
  const [newUserDisplayName, setNewUserDisplayName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        throw new Error('Failed to load users')
      }
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error: any) {
      toast.error('Failed to load users: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error('Email and password are required')
      return
    }

    try {
      setIsAdding(true)
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          display_name: newUserDisplayName || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      toast.success('User created successfully')
      setIsAddDialogOpen(false)
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserRole(UserRole.USER)
      setNewUserDisplayName('')
      loadUsers()
    } catch (error: any) {
      toast.error('Failed to create user: ' + (error.message || 'Unknown error'))
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    try {
      const response = await fetch(`/api/admin/users/${userToDelete.user_id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete user')
      }

      toast.success('User deleted successfully')
      setIsDeleteDialogOpen(false)
      setUserToDelete(null)
      loadUsers()
    } catch (error: any) {
      toast.error('Failed to delete user: ' + (error.message || 'Unknown error'))
    }
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.display_name && user.display_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'destructive'
      case UserRole.ADMIN:
        return 'default'
      case UserRole.DEVELOPER:
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-2.5 h-4 w-4 glass-text-secondary" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 glass-small border-0 glass-text-primary placeholder:text-gray-500 focus:ring-2 focus:ring-blue-400/50 h-10 sm:h-11"
          />
        </div>
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="glass-small glass-interactive"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 glass-text-secondary text-sm">Loading users...</div>
      ) : (
        <div className="glass-small rounded-xl overflow-hidden border border-white/20 dark:border-slate-700/40">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 glass-text-secondary text-sm">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium glass-text-primary">{user.email}</TableCell>
                    <TableCell className="glass-text-secondary">{user.display_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {ROLE_METADATA[user.role as UserRole]?.label || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="glass-text-secondary text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => {
                          setUserToDelete(user)
                          setIsDeleteDialogOpen(true)
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/20"
                        aria-label="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="relative max-w-lg w-[calc(100vw-2rem)] rounded-2xl bg-transparent border border-white/20 dark:border-slate-700/40">
          <div className="absolute inset-0 -z-10 dialog-facade-bg" />
          <div className="absolute inset-0 pointer-events-none rounded-2xl bg-gradient-to-br from-white/5 via-white/2 to-transparent dark:from-white/5 dark:via-white/10 dark:to-transparent" />
          
          <DialogHeader>
            <DialogTitle className="glass-text-primary">Add New User</DialogTitle>
            <DialogDescription className="glass-text-secondary text-sm">
              Create a new user account. The user will be able to sign in with the provided credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="glass-text-primary text-sm font-medium">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="glass-small border-0 glass-text-primary placeholder:text-gray-500 focus:ring-2 focus:ring-blue-400/50 h-10 sm:h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="glass-text-primary text-sm font-medium">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="glass-small border-0 glass-text-primary placeholder:text-gray-500 focus:ring-2 focus:ring-blue-400/50 h-10 sm:h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName" className="glass-text-primary text-sm font-medium">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Optional display name"
                value={newUserDisplayName}
                onChange={(e) => setNewUserDisplayName(e.target.value)}
                className="glass-small border-0 glass-text-primary placeholder:text-gray-500 focus:ring-2 focus:ring-blue-400/50 h-10 sm:h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="glass-text-primary text-sm font-medium">Role *</Label>
              <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as UserRole)}>
                <SelectTrigger className="glass-small border-0 glass-text-primary h-10 sm:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(UserRole).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_METADATA[role]?.label || role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsAddDialogOpen(false)}
              className="glass-small"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddUser} 
              disabled={isAdding}
              className="glass-small glass-interactive"
            >
              {isAdding ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="relative max-w-sm rounded-xl bg-transparent border border-white/20 dark:border-slate-700/40">
          <div className="absolute inset-0 -z-10 dialog-facade-bg" />
          <div className="absolute inset-0 pointer-events-none rounded-xl bg-gradient-to-br from-white/5 via-white/2 to-transparent dark:from-white/5 dark:via-white/10 dark:to-transparent" />
          
          <AlertDialogHeader>
            <AlertDialogTitle className="glass-text-primary">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="glass-text-secondary text-sm">
              This will permanently delete the user account for <strong className="glass-text-primary">{userToDelete?.email}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass-small">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              className="glass-small bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 border border-red-500/50"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

