// utils/auth/authUtils.ts
'use client';

import { supabase } from '@/utils/supabase/client';

/**
 * Comprehensive client-side cleanup when user signs out
 * Clears all user-specific data from localStorage and application state
 * 🎯 TARGETED FIX: Enhanced with UserPreferencesService cache clearing
 */
export async function clearUserDataOnSignOut(userId?: string) {

  
  try {
    // 🎯 ENHANCED CLEANUP: Comprehensive localStorage/sessionStorage clearing
    const keysToRemove = [
      'ventiaam_last_active_chat',
      'chat-init-retry-count',
      'performance-monitoring-enabled',
      'chatInputHeight', // User input preferences
      'ventiaam_projects', // Project selection state  
      'kml-color-schemes', // KML color preferences
      'color-schemes', // Color scheme preferences
      'active-color-scheme', // Active color scheme
      'table-search-settings', // Search settings
    ];
    
    // Clear general keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);

      } catch (e) {

      }
    });
    
    // 🎯 ENHANCED: Clear all localStorage keys with user-specific patterns
    const userSpecificPatterns = [
      'ventiaam_conversations_',
      'ventiaam_convo_settings_',
      'dataworkbench_user_preferences',
      'dataworkbench_',
      'userprefs',
      'ribbon_state_',
      'right_pane_columns_',
      'local_conversations_'
    ];
    
    if (typeof window !== 'undefined') {
      const allKeys = Object.keys(localStorage);

      
      allKeys.forEach(key => {
        const shouldClear = userSpecificPatterns.some(pattern => key.includes(pattern));
        if (shouldClear) {
          try {
            localStorage.removeItem(key);

          } catch (e) {

          }
        }
      });
    }
    
    // Clear user-specific conversation data
    if (userId) {
      const userConversationKey = `ventiaam_conversations_${userId}`;
      try {
        localStorage.removeItem(userConversationKey);

      } catch (e) {

      }
    } else {

    }
    
    // 🎯 ENHANCED: Clear all sessionStorage (performance cache and temporary data)
    if (typeof window !== 'undefined') {
      const sessionKeys = Object.keys(sessionStorage);

      
      sessionKeys.forEach(key => {
        try {
          sessionStorage.removeItem(key);

        } catch (e) {

        }
      });
    }
    
    // DataWorkbench removed: skip clearing UserPreferencesService cache
    
    // 🎯 ENHANCED: Clear additional service caches and states
    try {
      // Clear IndexedDB for UserPreferences
      if (typeof window !== 'undefined' && window.indexedDB) {
        // Clear DataWorkbench IndexedDB
        const deleteRequest = indexedDB.deleteDatabase('DataWorkbenchPreferences');
        deleteRequest.onsuccess = () => {

        };
        deleteRequest.onerror = () => {

        };
      }
    } catch (error) {

    }
    
    // 🎯 ENHANCED: Trigger global state reset for React components
    try {
      if (typeof window !== 'undefined') {
        // DataWorkbench store removed
        
        // Dispatch a custom event that components can listen to
        window.dispatchEvent(new CustomEvent('user-signed-out', { 
          detail: { userId, timestamp: Date.now() } 
        }));

      }
    } catch (error) {

    }
    

  } catch (error) {

  }
}

/**
 * Force a redirect to the sign-in page using hard navigations.
 * Designed to work reliably in PWAs and in cases where SPA routing is stuck.
 */
export function forceRedirectToSignIn(): void {
  if (typeof window === 'undefined') return;
  const targetPath = '/sign-in';

  // Immediate hard navigation (does not create a new history entry)
  try {
    window.location.replace(targetPath);
  } catch {}

  // Fallback: ensure we land on sign-in even if the first attempt is blocked
  try {
    setTimeout(() => {
      try {
        if (!window.location.pathname.startsWith('/sign-in')) {
          window.location.href = targetPath;
        }
      } catch {}
    }, 300);
  } catch {}

  // Last resort after a longer delay
  try {
    setTimeout(() => {
      try {
        if (!window.location.pathname.startsWith('/sign-in')) {
          window.location.assign(targetPath);
        }
      } catch {}
    }, 1200);
  } catch {}
}

/**
 * Reset application state when switching users
 * This should be called when a different user signs in
 */
export function resetApplicationState() {

  
  // Force a page reload to ensure clean state
  // This is the safest way to ensure all React state is reset
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}


