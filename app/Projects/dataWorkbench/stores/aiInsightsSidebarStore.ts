/**
 * AI Insights Sidebar Store
 * Created: July 12, 2025
 * 
 * Simple, SSR-safe store for sidebar state management.
 * Follows architecture-specification.md: Single responsibility, slice pattern.
 * Fixed: Proper snapshot caching to prevent infinite loops.
 */

import { create } from 'zustand'

// =============================================================================
// SIDEBAR STATE TYPES
// =============================================================================

export interface AIInsightsSidebarState {
  isOpen: boolean
  width: number
  isResizing: boolean
  currentTable: string | null
  currentProject: string | null
  lastOpenedAt: number | null
}

export interface AIInsightsSidebarActions {
  openSidebar: (tableName?: string, projectId?: string) => void
  closeSidebar: () => void
  toggleSidebar: (tableName?: string, projectId?: string) => void
  setWidth: (width: number) => void
  setResizing: (resizing: boolean) => void
  setContext: (tableName: string | null, projectId: string | null) => void
  reset: () => void
}

export type AIInsightsSidebarStore = AIInsightsSidebarState & AIInsightsSidebarActions

// =============================================================================
// CACHED SNAPSHOTS - Prevent infinite loops
// =============================================================================

let cachedOpenSnapshot = false
let cachedWidthSnapshot = 400
let cachedContextSnapshot: { currentTable: string | null; currentProject: string | null } = { 
  currentTable: null, 
  currentProject: null 
}
let cachedResizingSnapshot = false

// =============================================================================
// STORE CREATION - Without subscribeWithSelector to prevent loops
// =============================================================================

export const useAIInsightsSidebarStore = create<AIInsightsSidebarStore>((set, get) => ({
  // Initial state - SSR safe
  isOpen: false,
  width: 400,
  isResizing: false,
  currentTable: null,
  currentProject: null,
  lastOpenedAt: null,

  // Actions
  openSidebar: (tableName?: string, projectId?: string) => {
    const state = get()
    const newState = {
      isOpen: true,
      currentTable: tableName || state.currentTable,
      currentProject: projectId || state.currentProject || 'default',
      lastOpenedAt: Date.now()
    }
    
    // Update cached snapshots
    cachedOpenSnapshot = true
    cachedContextSnapshot = {
      currentTable: newState.currentTable,
      currentProject: newState.currentProject
    }
    
    set(newState)
  },

  closeSidebar: () => {
    // Update cached snapshots
    cachedOpenSnapshot = false
    cachedResizingSnapshot = false
    
    set({
      isOpen: false,
      isResizing: false
    })
  },

  toggleSidebar: (tableName?: string, projectId?: string) => {
    const state = get()
    if (state.isOpen) {
      state.closeSidebar()
    } else {
      state.openSidebar(tableName, projectId)
    }
  },

  setWidth: (width: number) => {
    // Clamp width between reasonable bounds
    const clampedWidth = Math.max(300, Math.min(800, width))
    
    // Update cached snapshot
    cachedWidthSnapshot = clampedWidth
    
    set({ width: clampedWidth })
  },

  setResizing: (resizing: boolean) => {
    // Update cached snapshot
    cachedResizingSnapshot = resizing
    
    set({ isResizing: resizing })
  },

  setContext: (tableName: string | null, projectId: string | null) => {
    // Update cached snapshot
    cachedContextSnapshot = {
      currentTable: tableName,
      currentProject: projectId
    }
    
    set({
      currentTable: tableName,
      currentProject: projectId
    })
  },

  reset: () => {
    // Reset cached snapshots
    cachedOpenSnapshot = false
    cachedWidthSnapshot = 400
    cachedContextSnapshot = { currentTable: null, currentProject: null }
    cachedResizingSnapshot = false
    
    set({
      isOpen: false,
      width: 400,
      isResizing: false,
      currentTable: null,
      currentProject: null,
      lastOpenedAt: null
    })
  }
}))

// =============================================================================
// SSR-SAFE SELECTORS WITH CACHED SNAPSHOTS
// =============================================================================

export const selectSidebarOpen = (state: AIInsightsSidebarStore) => {
  if (typeof window === 'undefined') return false
  
  // Update cached snapshot when state changes
  if (cachedOpenSnapshot !== state.isOpen) {
    cachedOpenSnapshot = state.isOpen
  }
  
  return cachedOpenSnapshot
}

export const selectSidebarWidth = (state: AIInsightsSidebarStore) => {
  if (typeof window === 'undefined') return 400
  
  // Update cached snapshot when state changes
  if (cachedWidthSnapshot !== state.width) {
    cachedWidthSnapshot = state.width
  }
  
  return cachedWidthSnapshot
}

export const selectSidebarContext = (state: AIInsightsSidebarStore) => {
  if (typeof window === 'undefined') return { currentTable: null, currentProject: null }
  
  // Update cached snapshot when state changes
  const currentContext = {
    currentTable: state.currentTable,
    currentProject: state.currentProject
  }
  
  if (cachedContextSnapshot.currentTable !== currentContext.currentTable ||
      cachedContextSnapshot.currentProject !== currentContext.currentProject) {
    cachedContextSnapshot = currentContext
  }
  
  return cachedContextSnapshot
}

export const selectSidebarResizing = (state: AIInsightsSidebarStore) => {
  if (typeof window === 'undefined') return false
  
  // Update cached snapshot when state changes
  if (cachedResizingSnapshot !== state.isResizing) {
    cachedResizingSnapshot = state.isResizing
  }
  
  return cachedResizingSnapshot
}
