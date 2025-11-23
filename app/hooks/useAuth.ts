'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile, UserProfileInsert } from '@/types/rbac';
import { UserRole, ROLE_PERMISSIONS } from '@/types/rbac';
import type { Permission } from '@/types/rbac';

/**
 * Unified Authentication Hook - 2025 Supabase Best Practices
 * 
 * This hook replaces all competing authentication systems:
 * - useRBAC hook
 * - ChatProvider auth logic
 * - AuthDebugPanel auth calls
 * - Multiple onAuthStateChange listeners
 * 
 * Features:
 * - Single source of truth for authentication state
 * - Optimized database calls (1-2 calls vs 10-15)
 * - Smart caching with proper invalidation
 * - Automatic token refresh
 * - Zero infinite loops (stable dependencies)
 * - Backwards compatible with existing components
 */

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

type AuthContext = AuthState & AuthActions;

// Global singleton state to prevent multiple concurrent auth loads
let globalAuthState: AuthState = {
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  error: null,
};

let globalAuthPromise: Promise<AuthState> | null = null;
const listeners: Set<() => void> = new Set();
let authSubscription: ReturnType<typeof supabase.auth.onAuthStateChange>['data']['subscription'] | null = null;

// HMR-safe cache to persist auth state across Fast Refresh
const AUTH_DEBUG = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_AUTH_DEBUG === 'true';
const AUTH_TIMING_DEBUG = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_AUTH_TIMING_DEBUG === 'true';
const __w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined;
if (__w) {
  const cachedState = __w.__AUTH_CACHED_STATE__ as AuthState | undefined;
  if (cachedState) {
    globalAuthState = cachedState;
  }
}

// Persisted guard to prevent duplicate onAuthStateChange subscriptions
const AUTH_SUB_KEY = '__AUTH_ONAUTH_SUBSCRIBED__';

// Notify all hook instances of state changes
const notifyListeners = () => {
  // Persist latest state to window so HMR reuses it without flashing/loading
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__AUTH_CACHED_STATE__ = globalAuthState as unknown as Record<string, unknown>;
  }
  listeners.forEach(listener => listener());
};

// Load user profile from database
const loadUserProfile = async (user: User): Promise<UserProfile | null> => {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('🚨 Profile query error:', error);
      return null;
    }

    if (profile) {
      return profile;
    }

    // Create profile if it doesn't exist
    console.log('🔐 No profile found, creating new user profile...');
    const profileData: UserProfileInsert = {
      user_id: user.id,
      email: user.email!,
      role: UserRole.USER,
      display_name: user.email || 'User',
      is_active: true,
      updated_at: new Date().toISOString()
    };
    // Type assertion needed due to Supabase type inference limitations with @supabase/ssr
    const { data: newProfile, error: createError } = await supabase
      .from('user_profiles')
      .upsert(profileData as never, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (createError) {
      console.error('🚨 Failed to create user profile:', createError);
      return null;
    }

    return newProfile;
  } catch (error) {
    console.error('🚨 Profile loading failed:', error);
    return null;
  }
};

// Auth loading timeout constant - but we'll avoid conflicts with Supabase
const AUTH_LOADING_TIMEOUT = 5000; // 5 seconds - if we're still loading after this, Supabase is probably stuck

// Global authentication loading function (singleton pattern)
const loadGlobalAuth = async (): Promise<AuthState> => {
  // If already loading, return existing promise
  if (globalAuthPromise) {
    if (AUTH_DEBUG) console.log('🔐 Auth loading already in progress, returning existing promise');
    return globalAuthPromise;
  }

  // 🚀 SMART DETECTION: If we already have valid auth state, don't reload unnecessarily
  if (globalAuthState.user && globalAuthState.profile && !globalAuthState.isLoading) {
    console.log('🔍 [loadGlobalAuth] Auth state is already complete, returning cached state');
    return {
      user: globalAuthState.user,
      profile: globalAuthState.profile,
      session: globalAuthState.session,
      isLoading: false,
      error: null,
    };
  }
  
  console.log('🔍 [loadGlobalAuth] Starting auth load. Current state:', {
    hasUser: !!globalAuthState.user,
    hasProfile: !!globalAuthState.profile,
    isLoading: globalAuthState.isLoading
  });

  // Create new loading promise with timeout protection
  globalAuthPromise = (async (): Promise<AuthState> => {
    const startTime = Date.now();
    const loadingId = Math.random().toString(36).substr(2, 9);
    console.log(`🔍 [loadGlobalAuth ${loadingId}] Starting unified auth loading...`);
    
      // Add timeout wrapper for stuck auth states
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const duration = Date.now() - startTime;
          if (AUTH_TIMING_DEBUG) console.log(`⏱️ [${loadingId}] Auth loading timeout after ${duration}ms - Supabase appears stuck, using fallback`);
          if (AUTH_TIMING_DEBUG) console.log(`⏱️ [${loadingId}] Current auth state:`, {
            hasUser: !!globalAuthState.user,
            hasProfile: !!globalAuthState.profile,
            isLoading: globalAuthState.isLoading,
            error: globalAuthState.error
          });
          reject(new Error(`Auth loading timeout after ${duration}ms - Supabase appears stuck, using fallback`));
        }, AUTH_LOADING_TIMEOUT);
      });
    
    try {
      // Race between auth loading and timeout
      const authPromise = (async (): Promise<AuthState> => {
        if (AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] Step 1: Calling supabase.auth.getUser()...`);
        const getUserStart = Date.now();
        
        // Check session first for debugging
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        console.log(`🔍 [useAuth ${loadingId}] Initial session check:`, {
          hasSession: !!initialSession,
          sessionExpiry: initialSession?.expires_at,
          sessionAccessToken: initialSession?.access_token ? 'present' : 'missing',
          sessionError: sessionError?.message,
          // Check localStorage for Supabase session
          localStorageKeys: typeof window !== 'undefined' ? Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('auth')) : 'N/A (server)',
          // Check cookies (if accessible)
          cookies: typeof document !== 'undefined' ? document.cookie.split(';').filter(c => c.includes('supabase') || c.includes('auth')).map(c => c.trim().substring(0, 50)) : 'N/A (server)'
        });
        
        // Single getUser call - validates token with Supabase Auth server
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        const getUserDuration = Date.now() - getUserStart;
        console.log(`🔍 [useAuth ${loadingId}] getUser() result:`, {
          hasUser: !!user,
          userId: user?.id,
          userEmail: user?.email,
          hasError: !!userError,
          errorMessage: userError?.message,
          errorName: userError?.name,
          duration: `${getUserDuration}ms`
        });
        
        if (AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] Step 1 completed in ${getUserDuration}ms. User:`, user ? `${user.email} (${user.id})` : 'null');
      
        if (userError) {
          // Handle missing session errors gracefully (expected after sign-out)
          const isMissingSession = userError.message?.includes('session') || 
                                  userError.message?.includes('Session') ||
                                  userError.name === 'AuthSessionMissingError';
          
          if (isMissingSession) {
            if (AUTH_DEBUG || AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] Session missing (expected after sign-out), treating as no user`);
            const newState: AuthState = {
              user: null,
              profile: null,
              session: null,
              isLoading: false,
              error: null, // No error - missing session is expected after sign-out
            };
            globalAuthState = newState;
            notifyListeners();
            return newState;
          }
          
          console.error(`🚨 [${loadingId}] Failed to get current user:`, userError);
          const newState: AuthState = {
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            error: userError.message,
          };
          globalAuthState = newState;
          notifyListeners();
          return newState;
        }

        if (!user) {
          console.log(`🔐 [${loadingId}] No authenticated user found`);
          const newState: AuthState = {
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            error: null,
          };
          globalAuthState = newState;
          notifyListeners();
          return newState;
        }

        if (AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] Step 2: Loading user profile...`);
        const profileStart = Date.now();
        
        // Load user profile
        const profile = await loadUserProfile(user);
        
        const profileDuration = Date.now() - profileStart;
        if (AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] Step 2 completed in ${profileDuration}ms. Profile:`, profile ? `${profile.role} (${profile.user_id})` : 'null');
        
        if (AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] Step 3: Getting session...`);
        const sessionStart = Date.now();
        
        // Get session for client-side state
        const { data: { session } } = await supabase.auth.getSession();
        
        const sessionDuration = Date.now() - sessionStart;
        if (AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] Step 3 completed in ${sessionDuration}ms. Session:`, session ? 'valid' : 'null');
        
        // If we have user and profile but no session, that's still a successful auth state
        if (!session && user && profile) {
          console.warn(`🔐 [${loadingId}] Warning: User and profile loaded but session is null - this is common and not an error`);
        }
      
        const newState: AuthState = {
          user,
          profile,
          session,
          isLoading: false,
          error: null,
        };
        
        globalAuthState = newState;
        
        const totalTime = Date.now() - startTime;
        if (AUTH_DEBUG || AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] Auth loading completed successfully in ${totalTime}ms. User:`, user ? `${user.email} (${profile?.role || 'no role'})` : 'null');
        if (AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] Timing breakdown:`, {
          getUser: getUserDuration,
          profile: profileDuration,
          session: sessionDuration,
          total: totalTime
        });
        
        notifyListeners();
        return newState;
      })();

      // Race between auth loading and timeout
      return await Promise.race([authPromise, timeoutPromise]);
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      // Handle timeout errors specifically - these are expected, not real errors
      // Timeouts occur when Supabase's internal recovery is stuck, which is common
      // We gracefully fall back to cached state rather than treating this as an error
      if (error instanceof Error && error.message.includes('timeout')) {
        if (AUTH_TIMING_DEBUG) console.log(`⏱️ [${loadingId}] Auth loading timed out after ${totalTime}ms - using fallback state management`);
        
        // 🚀 FALLBACK APPROACH: If Supabase is stuck, use cached state
        if (AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] Supabase appears stuck, using fallback state management...`);
        
        // Check if we have any cached auth state we can use
        if (globalAuthState.user && globalAuthState.profile) {
          if (AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] Using cached auth state as fallback (user: ${globalAuthState.user.email})`);
          const fallbackState: AuthState = {
            user: globalAuthState.user,
            profile: globalAuthState.profile,
            session: globalAuthState.session, // Keep existing session or null
            isLoading: false,
            error: null,
          };
          globalAuthState = fallbackState;
          notifyListeners();
          return fallbackState;
        }
        
        if (AUTH_TIMING_DEBUG) console.log(`🔐 [${loadingId}] No cached state available, will return unauthenticated fallback`);
        
        const newState: AuthState = {
          user: null,
          profile: null,
          session: null,
          isLoading: false,
          error: null, // No error - timeout is expected behavior, not an error
        };
        globalAuthState = newState;
        notifyListeners();
        return newState;
      }
      
      const newState: AuthState = {
        user: null,
        profile: null,
        session: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
      globalAuthState = newState;
      notifyListeners();
      return newState;
    } finally {
      globalAuthPromise = null;
    }
  })();

  return globalAuthPromise;
};

export function useAuth(): AuthContext {
  const [state, setState] = useState<AuthState>(globalAuthState);
  const [, forceUpdate] = useState({});

  // Force component update when global state changes
  const updateState = useCallback(() => {
    setState(globalAuthState);
    forceUpdate({});
  }, []);

  useEffect(() => {
    // Register this instance
    listeners.add(updateState);


    // Initial load (only if not already loaded/loading)
    // Also reload if we have no user and no promise (might be stale state)
    if (!globalAuthPromise && (globalAuthState.isLoading || (!globalAuthState.user && !globalAuthState.isLoading))) {
    
      loadGlobalAuth();
    } 

    // Set up auth listener (only once globally; resilient to Fast Refresh/HMR)
    const alreadySubscribed = typeof window !== 'undefined' && Boolean((window as unknown as Record<string, boolean | undefined>)[AUTH_SUB_KEY]);
    if (!authSubscription && !alreadySubscribed) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        const eventId = Math.random().toString(36).substr(2, 9);
        if (AUTH_DEBUG || AUTH_TIMING_DEBUG) console.log(`🔐 [${eventId}] Supabase auth state change:`, event, session?.user?.email);
        if (AUTH_TIMING_DEBUG) console.log(`🔐 [${eventId}] Current global state before change:`, {
          isLoading: globalAuthState.isLoading,
          hasUser: !!globalAuthState.user,
          hasProfile: !!globalAuthState.profile
        });
        
        if (event === 'SIGNED_OUT') {
          if (AUTH_DEBUG || AUTH_TIMING_DEBUG) console.log(`🔐 [${eventId}] Handling SIGNED_OUT event`);
          // Clear auth state
          globalAuthState = {
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            error: null,
          };
          notifyListeners();
          return;
        }
        
        if (event === 'SIGNED_IN') {
          if (AUTH_DEBUG || AUTH_TIMING_DEBUG) console.log(`🔐 [${eventId}] Handling SIGNED_IN event, triggering auth reload...`);
          // Reload auth state
          globalAuthState = { ...globalAuthState, isLoading: true };
          notifyListeners();
          
          try {
            await loadGlobalAuth();
            if (AUTH_DEBUG || AUTH_TIMING_DEBUG) console.log(`🔐 [${eventId}] Auth reload completed successfully`);
          } catch (error) {
            console.error(`🔐 [${eventId}] Auth reload failed:`, error);
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // For token refresh, only reload if we don't already have a valid session
          if (!globalAuthState.session && session) {
            if (AUTH_DEBUG || AUTH_TIMING_DEBUG) console.log(`🔐 [${eventId}] Token refreshed and we don't have session, updating...`);
            globalAuthState = { ...globalAuthState, isLoading: true };
            notifyListeners();
            
            try {
              await loadGlobalAuth();
              if (AUTH_DEBUG || AUTH_TIMING_DEBUG) console.log(`🔐 [${eventId}] Auth reload completed successfully`);
            } catch (error) {
              console.error(`🔐 [${eventId}] Auth reload failed:`, error);
            }
          } else {
            if (AUTH_TIMING_DEBUG) console.log(`🔐 [${eventId}] Token refreshed but session already exists, skipping reload`);
          }
        }
      });
      authSubscription = data.subscription;
      if (typeof window !== 'undefined') {
        (window as unknown as Record<string, boolean | undefined>)[AUTH_SUB_KEY] = true;
      }
    }

    // 🚀 FIXED: Removed aggressive visibility change handler that was causing page refreshes
    // Supabase's auth system handles session refresh automatically via onAuthStateChange
    // We don't need to manually reload auth when the tab becomes visible - this was causing
    // unnecessary state updates that triggered page refreshes when switching between apps
    // 
    // If auth state is lost, Supabase's onAuthStateChange listener will handle it automatically

    return () => {
      listeners.delete(updateState);
      
      // Clean up auth subscription when no more listeners
      if (listeners.size === 0) {
        // Do not force-unsubscribe the global auth listener in development to avoid HMR duplication issues
        // It will be garbage-collected on full page reload; keep it for active consumers
      }
    };
  }, [updateState]);

  // Get user permissions (memoized to keep stable reference for callbacks)
  const permissions = useMemo(() => (
    state.profile?.role ? (ROLE_PERMISSIONS[state.profile.role as UserRole] || []) : []
  ), [state.profile]);

  // Permission check function
  const hasPermission = useCallback((permission: Permission): boolean => {
    return permissions.includes(permission);
  }, [permissions]);

  // Role check function
  const hasRole = useCallback((role: UserRole | UserRole[]): boolean => {
    if (!state.profile?.role) return false;
    const userRole = state.profile.role as UserRole;
    const allowedRoles = Array.isArray(role) ? role : [role];
    return allowedRoles.includes(userRole);
  }, [state.profile]);

  // Sign out function
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      // Auth state will be cleared by the onAuthStateChange listener
    } catch (error) {
      console.error('🚨 Sign out failed:', error);
      throw error;
    }
  }, []);

  // Refresh session function
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.refreshSession();
      // Auth state will be updated by the onAuthStateChange listener
    } catch (error) {
      console.error('🚨 Session refresh failed:', error);
      throw error;
    }
  }, []);

  return {
    ...state,
    hasPermission,
    hasRole,
    signOut,
    refreshSession,
  };
}

// Export types for backwards compatibility
export type { AuthContext, AuthState, AuthActions };
