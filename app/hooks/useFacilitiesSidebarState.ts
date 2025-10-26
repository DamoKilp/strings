/**
 * useFacilitiesSidebarState Hook
 * 
 * Manages the persistent state of the facilities sidebar (open/closed).
 * Persists state to localStorage across browser sessions.
 * 
 * @returns {boolean} isOpen - Current sidebar open state
 * @returns {(open: boolean) => void} setSidebarOpen - Function to update sidebar state
 */

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'facilities_sidebar_open'
const DEFAULT_OPEN = true

export function useFacilitiesSidebarState() {
  // ✅ HYDRATION FIX: Always start with default on server, then sync with localStorage on client
  const [isOpen, setIsOpen] = useState<boolean>(DEFAULT_OPEN)

  // Sync with localStorage after mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) {
        const storedValue = stored === 'true'
        if (storedValue !== DEFAULT_OPEN) {
          // Only update if different from default to avoid flash
          setIsOpen(storedValue)
        }
      }
    } catch (error) {
      console.warn('Failed to load facilities sidebar state:', error)
    }
  }, [])

  // Update sidebar state and persist to localStorage
  const setSidebarOpen = useCallback((open: boolean) => {
    setIsOpen(open)
    
    try {
      localStorage.setItem(STORAGE_KEY, String(open))
    } catch (error) {
      console.warn('Failed to save facilities sidebar state:', error)
    }
  }, [])

  return {
    isOpen,
    setSidebarOpen
  }
}

