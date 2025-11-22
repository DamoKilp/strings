'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export function AdminPasswordChange() {
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(true) // Visible by default
  const [isChanging, setIsChanging] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPassword) {
      toast.error('New password is required')
      return
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }

    try {
      setIsChanging(true)
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      toast.success('Password changed successfully')
      setNewPassword('')
    } catch (error: any) {
      toast.error('Failed to change password: ' + (error.message || 'Unknown error'))
    } finally {
      setIsChanging(false)
    }
  }

  return (
    <form onSubmit={handleChangePassword} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="newPassword" className="glass-text-primary text-sm font-medium">
          New Password
        </Label>
        <div className="relative">
          <Input
            id="newPassword"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter your new password"
            required
            minLength={6}
            className="glass-small border-0 glass-text-primary placeholder:text-gray-500 focus:ring-2 focus:ring-blue-400/50 h-10 sm:h-11 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-white/10 transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 glass-text-secondary" />
            ) : (
              <Eye className="h-4 w-4 glass-text-secondary" />
            )}
          </button>
        </div>
        <p className="glass-text-secondary text-xs">
          Password must be at least 6 characters long
        </p>
      </div>
      <Button 
        type="submit" 
        disabled={isChanging || !newPassword}
        className="glass-small glass-interactive"
      >
        {isChanging ? 'Changing Password...' : 'Change Password'}
      </Button>
    </form>
  )
}

