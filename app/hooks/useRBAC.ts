'use client';

import { useAuth } from './useAuth';
import type { UserProfile, AuthContext } from '@/types/rbac';
import { UserRole, Permission, ROLE_PERMISSIONS } from '@/types/rbac';

/**
 * Legacy RBAC Hook - Now uses unified authentication system
 * 
 * This hook maintains backwards compatibility while using the new unified auth system.
 * It provides the same interface as before but with significantly better performance.
 * 
 * Migration: Components can gradually migrate to useAuth() directly for better performance.
 */

export function useRBAC(): AuthContext {
  const auth = useAuth();
  
  // Transform the unified auth state to match the legacy RBAC interface
  const user: UserProfile | null = auth.profile;
  const isLoading = auth.isLoading;

  // Get user permissions (memoized to keep stable reference for callbacks)
  const permissions = auth.profile?.role ? (ROLE_PERMISSIONS[auth.profile.role as UserRole] || []) : [];

  // Permission check function
  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  // Role check function
  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!auth.profile?.role) return false;
    const userRole = auth.profile.role as UserRole;
      const allowedRoles = Array.isArray(role) ? role : [role];
      return allowedRoles.includes(userRole);
  };

  return {
    user,
    permissions,
    hasPermission,
    hasRole,
    isLoading
  };
}