/**
 * User Preferences Service
 * Created: June 20, 2025
 * 
 * Comprehensive user preferences management with Supabase integration.
 * Features: Auto-save (500ms debounce), cross-device sync, offline backup.
 * 
 * Architecture:
 * - Database as primary storage (Supabase)
 * - localStorage for quick access and offline backup
 * - IndexedDB for large preferences data
 * - Sync queue for offline->online restoration
 * - Conflict resolution with last-write-wins strategy
 */

import { createClient } from '@/utils/supabase/client'
// Local fallback type definitions for preferences (module not present)
type PreferenceType = 'ribbon' | 'grid' | 'formatting' | 'view' | 'general' | 'map'
type PreferenceResult<T = any> = { success: true; data?: T | null; lastModified?: string } | { success: false; error: string }
type PreferenceSyncOptions = { bypassCache?: boolean }
type OfflinePreferenceChange = { id: string; type: PreferenceType; tableName?: string; data: any; timestamp: string; operation: 'update' | 'delete' }
type PreferenceChangeEvent = { type: PreferenceType; tableName?: string; oldValue: any; newValue: any; source: 'local' | 'remote'; timestamp: string }
type PreferenceChangeListener = (event: PreferenceChangeEvent) => void
type RibbonPreferences = {
  activeTab: string
  isCollapsed: boolean
  isMinimized: boolean
  customizations: any[]
}
type GridPreferences = {
  columnWidths: Record<string, number>
  columnOrder: string[]
  hiddenColumns: string[]
  frozenColumns: number
  frozenRows: number
  showGridlines: boolean
  showHeaders: boolean
  showRowNumbers: boolean
  autoFitColumns: boolean
  sortStates?: any[]
  filterStates?: any[]
  appliedFilters?: Record<string, unknown>
  textWrap?: boolean
  autoRowHeight?: boolean
  bandedRows?: Record<string, unknown>
  gridColor?: string
}
type FormattingPreferences = Record<string, unknown>
type ViewPreferences = Record<string, unknown>
type GeneralPreferences = Record<string, unknown>
type MapPreferences = Record<string, unknown>
type UserPreferencesData = {
  ribbon: RibbonPreferences
  quickAccess: { items: string[]; position: 'above' | 'below' }
  formatting: FormattingPreferences
  view: ViewPreferences
  grid: GridPreferences
  general: GeneralPreferences
  map: MapPreferences
  rightPane: GridPreferences
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEYS = {
  LOCAL_STORAGE: 'dataworkbench_user_preferences',
  INDEXEDDB_NAME: 'DataWorkbenchPreferences',
  SYNC_QUEUE: 'dataworkbench_sync_queue',
  LAST_SYNC: 'dataworkbench_last_sync'
} as const

const DEFAULTS = {
  DEBOUNCE_DELAY: 1000, // 1 second delay after dragging finishes
  SYNC_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  LOCAL_STORAGE_LIMIT: 5 * 1024, // 5KB
  INDEXEDDB_VERSION: 1
} as const

// =============================================================================
// DEFAULT PREFERENCES
// =============================================================================

const getDefaultPreferences = (): UserPreferencesData => ({
  ribbon: {
    activeTab: 'home',
    isCollapsed: false,
    isMinimized: false,
    customizations: []
  },
  quickAccess: {
    items: ['copy', 'paste', 'undo', 'redo'],
    position: 'above'
  },
  formatting: {
    defaultFont: 'Inter',
    defaultFontSize: 14,
    recentColors: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF'],
    recentFonts: ['Inter', 'Arial', 'Helvetica', 'Times New Roman'],
    // Enhanced formatting preferences
    recentBackgrounds: [
      {
        type: 'solid',
        solid: { color: '#FFFFFF', opacity: 1 }
      },
      {
        type: 'gradient',
        gradient: {
          type: 'linear',
          colors: [
            { color: '#5B9BD5', position: 0 },
            { color: '#FFFFFF', position: 1 }
          ],
          angle: 90
        }
      }
    ],
    recentFontSizes: [8, 10, 12, 14, 16, 18, 24],
    fontLoadingPreference: 'web-fonts',
    autoFitText: false,
    defaultRowHeightMode: 'fixed',
    // Conditional formatting rules - empty by default, stored per table
    conditionalFormattingRules: []
  },
  view: {
    showGridlines: true,
    showHeaders: true,
    showFormulaBar: true,
    zoomLevel: 100,
    freezePanes: {
      rows: 0,
      columns: 0
    }
  },
  grid: {
    columnWidths: {},
    columnOrder: [],
    hiddenColumns: [],
    frozenColumns: 0,
    frozenRows: 0,
    showGridlines: true,
    showHeaders: true,
    showRowNumbers: true,
    autoFitColumns: false,
    defaultRowHeight: 35, // ✅ NEW: Default row height (increased for better text wrapping)
    textWrap: true, // ✅ NEW: Enable text wrapping by default
    autoRowHeight: true, // ✅ NEW: Enable auto-height by default
    virtualScrolling: true,
    // Column sorting and filtering defaults
    sortStates: [],
    filterStates: [],
    appliedFilters: {},
    showFilterRow: false
  },
  general: {
    theme: 'system',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    autoSave: true,
    autoSaveInterval: 30000, // 30 seconds
    notifications: true,
    keyboardShortcuts: {},
    accessibility: {
      highContrast: false,
      largeText: false,
      screenReader: false,
      keyboardNavigation: true,
      reducedMotion: false
    },
    performance: {
      virtualScrollThreshold: 1000,
      maxVisibleRows: 500,
      enableWebWorkers: true,
      cacheSize: 50, // MB
      debounceDelay: 500
    }
  },
  map: {
    markerLabels: {
      enabled: true,
      displayColumns: [],
      labelStyle: 'tooltip',
      maxLabels: 100,
      labelVisibilityDistance: 1
    },
    informationPopup: {
      enabled: true,
      // Minimal popup configuration (when Info button is OFF)
      minimalPopup: {
        showCoordinates: false,
        showBasicInfo: true,
        includeColumns: []
      },
      // Extended popup configuration (when Info button is ON)
      extendedPopup: {
        includeColumns: [],
        showCoordinates: true,
        showAssetInfo: true,
        popupStyle: 'compact'
      },
      // Legacy properties for backward compatibility
      includeColumns: [],
      showCoordinates: true,
      showAssetInfo: true,
      popupStyle: 'compact'
    },
    colors: {
      coloringMethod: 'condition',
      colorColumn: '',
      colorRules: [],
      defaultColor: '#3b82f6'
    },
    pushpins: {
      markerStyle: 'pushpin',
      markerSize: 'medium',
      customIcons: false,
      iconScale: 1.0
    },
    mapView: {
      defaultZoom: 12,
      autoFitBounds: true,
      clusterMarkers: false,
      showMapControls: true
    }
  },
  rightPane: {
    columnWidths: {},
    columnOrder: [],
    hiddenColumns: [],
    frozenColumns: 0,
    frozenRows: 0,
    autoFitColumns: false,
    sortStates: [],
    filterStates: [],
    appliedFilters: {},
    showFilterRow: false,
    showHeaders: true,
    showRowNumbers: true
  }
})

// =============================================================================
// INDEXEDDB UTILITIES
// =============================================================================

class IndexedDBManager {
  private db: IDBDatabase | null = null
  private readonly dbName = STORAGE_KEYS.INDEXEDDB_NAME
  private readonly version = DEFAULTS.INDEXEDDB_VERSION

  async initialize(): Promise<void> {
    if (typeof window === 'undefined') return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create preferences store
        if (!db.objectStoreNames.contains('preferences')) {
          const store = db.createObjectStore('preferences', { keyPath: 'key' })
          store.createIndex('type', 'type', { unique: false })
          store.createIndex('tableName', 'tableName', { unique: false })
        }

        // Create sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
          syncStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  async get(key: string): Promise<any> {
    if (!this.db) await this.initialize()
    if (!this.db) return null

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['preferences'], 'readonly')
      const store = transaction.objectStore('preferences')
      const request = store.get(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result?.data || null)
    })
  }

  async set(key: string, data: any, type?: PreferenceType, tableName?: string): Promise<void> {
    if (!this.db) await this.initialize()
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['preferences'], 'readwrite')
      const store = transaction.objectStore('preferences')
      const request = store.put({
        key,
        data,
        type,
        tableName,
        timestamp: Date.now()
      })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async addToSyncQueue(change: OfflinePreferenceChange): Promise<void> {
    if (!this.db) await this.initialize()
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')
      const request = store.add(change)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getSyncQueue(): Promise<OfflinePreferenceChange[]> {
    if (!this.db) await this.initialize()
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readonly')
      const store = transaction.objectStore('syncQueue')
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async clearSyncQueue(): Promise<void> {
    if (!this.db) await this.initialize()
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')
      const request = store.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

// =============================================================================
// USER PREFERENCES SERVICE
// =============================================================================

// Circuit breaker state interface
interface CircuitBreakerState {
  isOpen: boolean
  failures: number
  lastFailure: number
  nextRetry: number
  consecutiveSuccesses: number
}

export class UserPreferencesService {
  private static instance: UserPreferencesService | null = null
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private listeners: Set<PreferenceChangeListener> = new Set()
  private indexedDB: IndexedDBManager = new IndexedDBManager()
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
  
  // 🎯 TARGETED FIX: Track user ID for cache validation
  private lastValidatedUserId?: string
  
  // 🚀 NEW: Batch state updates to prevent React re-render cascades
  private pendingNotifications: Map<string, PreferenceChangeEvent> = new Map()
  private notificationTimer: NodeJS.Timeout | null = null

  // Throttle background refreshes per cache key to avoid duplicate Supabase calls
  private lastBackgroundRefreshAt: Map<string, number> = new Map()
  private readonly BACKGROUND_REFRESH_MIN_INTERVAL_MS = 10000 // 10s

  // Circuit breaker to prevent infinite loops and request deduplication
  private circuitBreaker = new Map<string, CircuitBreakerState>()
  private pendingRequests = new Map<string, Promise<PreferenceResult>>()
  
  // 🔥 TARGETED FIX: Priority-based save system to prevent race conditions
  private prioritySaveQueue = new Map<string, Promise<PreferenceResult>>()
  private readonly CRITICAL_PREFERENCE_TYPES = new Set(['grid']) // Types that need immediate save
  private readonly CRITICAL_GRID_PROPERTIES = new Set(['sortStates', 'filterStates', 'appliedFilters', 'showFilterRow'])
  
  // Enhanced service monitoring and management
  private serviceStartTime: number = Date.now()
  
  // Circuit breaker configuration - OPTIMIZED for better user experience
  private readonly CIRCUIT_BREAKER_CONFIG = {
    FAILURE_THRESHOLD: 5, // Increased from 3 to 5 - more tolerant of network issues
    SUCCESS_THRESHOLD: 2,
    TIMEOUT_MS: 15000, // Reduced from 30s to 15s - faster recovery
    MAX_BACKOFF_MS: 10000, // Reduced from 60s to 10s - much faster recovery
    INITIAL_BACKOFF_MS: 500 // Reduced from 1s to 500ms - faster initial retry
  } as const

  // Singleton pattern
  public static getInstance(): UserPreferencesService {
    if (!UserPreferencesService.instance) {
      UserPreferencesService.instance = new UserPreferencesService()
    }
    return UserPreferencesService.instance
  }

  private constructor() {
    this.initializeOnlineStatus()
    this.initializeIndexedDB()
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  private initializeOnlineStatus(): void {
    if (typeof window === 'undefined') return

    this.isOnline = navigator.onLine

    window.addEventListener('online', () => {
      this.isOnline = true
      this.syncOfflineChanges()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  private async initializeIndexedDB(): Promise<void> {
    try {
      await this.indexedDB.initialize()
    } catch (error) {
      console.warn('Failed to initialize IndexedDB:', error)
    }
  }

  // ==========================================================================
  // CIRCUIT BREAKER METHODS - PHASE 1
  // ==========================================================================

  /**
   * Get circuit breaker key for tracking state per user/type/table combination
   */
  private getCircuitBreakerKey(type: PreferenceType, tableName?: string, userId?: string): string {
    return `${userId || 'anonymous'}_${type}_${tableName || 'global'}`
  }

  /**
   * Check if circuit breaker is open for this request
   */
  private isCircuitBreakerOpen(key: string): boolean {
    const state = this.circuitBreaker.get(key)
    if (!state) return false

    if (!state.isOpen) return false

    // Check if enough time has passed to try again
    const now = Date.now()
    if (now >= state.nextRetry) {
      state.isOpen = false // Transition to half-open
      return false
    }

    return true
  }

  /**
   * Record circuit breaker failure
   */
  private recordCircuitBreakerFailure(key: string, error: any): void {
    const state = this.circuitBreaker.get(key) || {
      isOpen: false,
      failures: 0,
      lastFailure: 0,
      nextRetry: 0,
      consecutiveSuccesses: 0
    }

    state.failures += 1
    state.lastFailure = Date.now()
    state.consecutiveSuccesses = 0

    // Open circuit breaker if failure threshold exceeded
    if (state.failures >= this.CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD) {
      state.isOpen = true
      const backoffMs = Math.min(
        this.CIRCUIT_BREAKER_CONFIG.INITIAL_BACKOFF_MS * Math.pow(2, state.failures - 1),
        this.CIRCUIT_BREAKER_CONFIG.MAX_BACKOFF_MS
      )
      state.nextRetry = Date.now() + backoffMs

      console.warn(`⚡ Circuit breaker OPENED for ${key} after ${state.failures} failures. Next retry in ${backoffMs}ms`, {
        error: error?.message || error,
        errorCode: error?.code,
        backoffMs,
        nextRetry: new Date(state.nextRetry).toISOString()
      })

      // 🔥 PHASE 1: Invalidate cache when circuit breaker opens
      this.invalidateCacheForCircuitBreaker(key).catch(err => 
        console.warn('Cache invalidation failed:', err)
      )
    }

    this.circuitBreaker.set(key, state)
  }

  /**
   * Record circuit breaker success
   */
  private recordCircuitBreakerSuccess(key: string): void {
    const state = this.circuitBreaker.get(key)
    if (!state) return

    state.consecutiveSuccesses += 1
    state.failures = Math.max(0, state.failures - 1) // Gradually reduce failure count

    // Close circuit breaker if enough consecutive successes
    if (state.isOpen && state.consecutiveSuccesses >= this.CIRCUIT_BREAKER_CONFIG.SUCCESS_THRESHOLD) {
      state.isOpen = false
      state.failures = 0
    }

    this.circuitBreaker.set(key, state)
  }

  /**
   * Handle different types of database errors appropriately
   */
  private handleDatabaseError(error: any, type: PreferenceType, tableName?: string): { shouldTriggerCircuitBreaker: boolean; isRecoverable: boolean } {
    const errorCode = error?.code
    const httpStatus = error?.status || error?.statusCode

    // Categorize errors
    const recoverableErrors = ['PGRST116'] // No rows found - normal for new users
    const unrecoverableErrors = ['PGRST102', 'PGRST301', 'PGRST204'] // Multiple rows, parsing errors, etc.
    const networkErrors = [408, 429, 500, 502, 503, 504] // Timeout, rate limit, server errors
    const clientErrors = [400, 401, 403, 404, 406] // Bad request, unauthorized, forbidden, not found, not acceptable

    const isRecoverable = recoverableErrors.includes(errorCode) || networkErrors.includes(httpStatus)
    const shouldTriggerCircuitBreaker = unrecoverableErrors.includes(errorCode) || clientErrors.includes(httpStatus) || networkErrors.includes(httpStatus)


    return { shouldTriggerCircuitBreaker, isRecoverable }
  }

  // ==========================================================================
  // PREFERENCE INHERITANCE METHODS - PHASE 2
  // ==========================================================================

  // REMOVED: Right pane detection helper

  // REMOVED: Right pane main-table extraction helper

  // REMOVED: Right pane inheritance structure validation

  // REMOVED: Right pane inheritance resolution

  // ==========================================================================
  // PUBLIC METHODS - PREFERENCE MANAGEMENT
  // ==========================================================================

  /**
   * 🚀 NEW: Load multiple preferences in parallel for faster initialization
   * This is the key optimization to reduce post-authentication loading time
   */
  async loadCriticalPreferences<T = any>(
    types: PreferenceType[],
    tableName?: string,
    options: PreferenceSyncOptions & { bypassCache?: boolean } = {}
  ): Promise<Map<PreferenceType, PreferenceResult<T>>> {
    const results = new Map<PreferenceType, PreferenceResult<T>>();
    
    try {
      // Get user ID once for all operations
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || 'anonymous'

      // Execute all preference loads in parallel
      const preferenceResults = await Promise.all(
        types.map(type => this.getPreferences<T>(type, tableName, options))
      )
      
      // Map results back to preference types
      types.forEach((type, index) => {
        results.set(type, preferenceResults[index] as PreferenceResult<T>)
      })

      console.log(`🚀 [UserPreferencesService] Loaded ${types.length} preferences in parallel`, {
        types: types.join(', '),
        tableName: tableName || 'global',
        userId: userId
      })

      return results

    } catch (error) {
      console.error('❌ [UserPreferencesService] Parallel preference loading failed:', error)
      
      // Fallback to individual loading
      for (const type of types) {
        try {
          const result = await this.getPreferences<T>(type, tableName, options)
          results.set(type, result)
        } catch (individualError) {
          console.warn(`⚠️ [UserPreferencesService] Failed to load ${type}:`, individualError)
          results.set(type, { success: false, error: individualError instanceof Error ? individualError.message : 'Unknown error' })
        }
      }
      
      return results
    }
  }

  /**
   * Get preferences for a specific type and optional table
   * PHASE 1: Enhanced with circuit breaker and request deduplication
   * TARGETED FIX: Added user ID validation to prevent 406 cache errors
   */
  async getPreferences<T = any>(
    type: PreferenceType,
    tableName?: string,
    options: PreferenceSyncOptions & { bypassCache?: boolean } = {}
  ): Promise<PreferenceResult<T>> {
    
    try {
      // Note: We only log LOAD START when actually hitting the database in executePreferenceRequest

      // Pre-auth in-flight coalescing (prevents double-start before userId is known)
      const preKey = `pre|${type}|${tableName || 'global'}`
      if (this.pendingRequests.has(preKey) && !options.bypassCache) {
        return await this.pendingRequests.get(preKey) as PreferenceResult<T>
      }
      let resolvePre: ((value: PreferenceResult<T>) => void) | null = null
      let rejectPre: ((reason?: unknown) => void) | null = null
      const prePlaceholder = new Promise<PreferenceResult<T>>((resolve, reject) => {
        resolvePre = resolve
        rejectPre = reject
      })
      if (!options.bypassCache) {
        this.pendingRequests.set(preKey, prePlaceholder as unknown as Promise<PreferenceResult>)
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // FIX 1: Better auth handling with anonymous fallback
      let userId = user?.id
      if (!userId) {
        console.warn('⚠️ UserPreferencesService: User not authenticated, using anonymous mode')
        userId = 'anonymous'
        // For anonymous users, only load general preferences
        if (type !== 'general' && type !== 'view') {
          const defaults = this.getSystemDefaults(type)
          console.log('?? LOAD [anonymous]: Anonymous user, returning defaults')
          return { success: true, data: defaults as T }
        }
      }

      // FIX 2: Skip validations for manual refresh
      if (!options.bypassCache) {
        // 🎯 TARGETED FIX: Validate cache consistency for current user
        await this.validateCacheForCurrentUser(userId)

        // 🔥 PHASE 1: Circuit breaker check
        const circuitBreakerKey = this.getCircuitBreakerKey(type, tableName, userId)
        if (this.isCircuitBreakerOpen(circuitBreakerKey)) {
          console.warn(`⚡ Circuit breaker OPEN for ${circuitBreakerKey}, returning system defaults`)
          const defaults = this.getSystemDefaults(type)
          return { success: true, data: defaults as T }
        }
      }

      // FIX 3: Force fresh data for manual refresh
      if (options.bypassCache) {
        console.log(`🔄 UserPreferencesService: Manual refresh - bypassing cache for ${type}`)
        this.clearSpecificCache(type, tableName)
      }

      // 🔥 PHASE 1: Request deduplication (scoped by user and table)
      const requestKey = userId ? `${userId}|${this.getCacheKey(type, tableName)}` : this.getCacheKey(type, tableName)
      if (this.pendingRequests.has(requestKey) && !options.bypassCache) {
       
        return await this.pendingRequests.get(requestKey) as PreferenceResult<T>
      }

      // Create and store the request promise
      const requestPromise = this.executePreferenceRequest<T>(type, tableName, userId)
      this.pendingRequests.set(requestKey, requestPromise)
      if (!options.bypassCache) {
        // Link preKey placeholder to real promise
        requestPromise
          .then((res) => { if (resolvePre) { resolvePre(res) } })
          .catch((err) => { if (rejectPre) { rejectPre(err as unknown) } })
        this.pendingRequests.set(preKey, requestPromise as unknown as Promise<PreferenceResult>)
      }

      // Debug logging moved to executePreferenceRequest to avoid double logs on cache hits

      try {
        const result = await requestPromise
        
        
        
        // 🔥 PHASE 1: Record success for circuit breaker
        if (result.success && !options.bypassCache) {
          const circuitBreakerKey = this.getCircuitBreakerKey(type, tableName, userId)
          this.recordCircuitBreakerSuccess(circuitBreakerKey)
        }
        
        return result
      } finally {
        // Clean up pending request(s)
        this.pendingRequests.delete(requestKey)
        if (!options.bypassCache) this.pendingRequests.delete(preKey)
      }

    } catch (error) {
      console.error(`❌ UserPreferencesService: Exception getting preferences for ${type}:`, error)
      
      // Return system defaults as final fallback
      const defaults = this.getSystemDefaults(type)
      return { success: true, data: defaults as T }
    }
  }

  /**
   * Execute the actual preference request with circuit breaker protection
   * PHASE 1: Separated logic to prevent recursion
   */
  private async executePreferenceRequest<T>(
    type: PreferenceType,
    tableName: string | undefined,
    userId: string
  ): Promise<PreferenceResult<T>> {
    const circuitBreakerKey = this.getCircuitBreakerKey(type, tableName, userId)

    try {
      // Try to get from cache first
      const cacheKey = this.getCacheKey(type, tableName)
      const cached = await this.getFromLocalStorage(cacheKey)
      
      if (cached && this.isOnline) {
        // Return cached but also refresh in background (throttled)
        this.refreshFromDatabaseThrottled(type, tableName, userId).catch(err => 
          console.warn('Background refresh failed:', err)
        )
        return { success: true, data: cached }
      }

      // Get from database with improved duplicate handling
      const supabase = createClient()
      const query = supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('preference_type', type)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (tableName) {
        query.eq('table_name', tableName)
      } else {
        query.is('table_name', null)
      }
      
      // Use .maybeSingle() instead of .single() to handle duplicates gracefully
      const { data, error } = await query.maybeSingle()

      if (error) {
        // FIX 5: Improved error logging with detailed context
        console.error(`❌ UserPreferencesService: Database error for ${type}${tableName ? ` (${tableName})` : ''}:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId: userId,
          tableName: tableName,
          type: type
        })
        
        // Provide specific guidance based on error type
        if (error.code === 'PGRST116') {
          console.log(`ℹ️ No preferences found for ${type} - this is normal for new users`)
        } else if (error.code === '42P01') {
          console.error(`🚨 user_preferences table does not exist - database migration needed`)
        }
        
        // 🔥 PHASE 1: Enhanced error handling
        const errorAnalysis = this.handleDatabaseError(error, type, tableName)
        
        if (errorAnalysis.shouldTriggerCircuitBreaker) {
          this.recordCircuitBreakerFailure(circuitBreakerKey, error)
        }

        if (error.code === 'PGRST116') {
          // No preferences found - fall back to defaults for all tables
          
          // 🔥 PHASE 1: CRITICAL FIX - No more recursive calls!
          // For non-right-pane tables or failed inheritance, initialize defaults
          const initResult = await this.initializeDefaultPreferences(userId)
          if (initResult.success) {

            // Return system defaults directly instead of recursive call
            const defaults = this.getSystemDefaults(type)
            await this.saveToLocalStorage(cacheKey, defaults) // Cache the defaults
            return { success: true, data: defaults as T }
          } else {

            const defaults = this.getSystemDefaults(type)
            return { success: true, data: defaults as T }
          }
        }
        
        // Other database errors - return defaults without recursion
        console.error(`❌ UserPreferencesService: Database error for ${type}:`, error)
        const defaults = this.getSystemDefaults(type)
        return { success: true, data: defaults as T }
      }

      if (!data) {
        const defaults = this.getSystemDefaults(type)
        return { success: true, data: defaults as T }
      }
      // Cache the result
      await this.saveToLocalStorage(cacheKey, data.preferences)
      
      return { success: true, data: data.preferences as T }

    } catch (error) {
      console.error(`❌ UserPreferencesService: Exception in executePreferenceRequest for ${type}:`, error)
      
      // Record circuit breaker failure for exceptions
      this.recordCircuitBreakerFailure(circuitBreakerKey, error)
      
      // Try to get from cache as fallback
      const cacheKey = this.getCacheKey(type, tableName)
      const cached = await this.getFromLocalStorage(cacheKey)
      
      if (cached) {
        return { success: true, data: cached }
      }
      
      // Return system defaults as final fallback
      const defaults = this.getSystemDefaults(type)
      return { success: true, data: defaults as T }
    }
  }

  /**
   * Initialize default preferences for a new user using the database function
   */
  private async initializeDefaultPreferences(userId: string): Promise<PreferenceResult> {
    try {
      
      const supabase = createClient()
      
      // Call the database function to initialize defaults
      // Note: Function exists in database but not in types yet - cast as any to bypass type check
      const { data, error } = await (supabase as any).rpc('initialize_user_default_preferences', {
        p_user_id: userId
      })

      if (error) {
        console.error('❌ UserPreferencesService: Failed to initialize defaults via RPC:', error)
        return { success: false, error: error.message }
      }

      if (data) {
        return { success: true }
      }

      console.warn(`⚠️ UserPreferencesService: Initialize function returned false for user ${userId}`)
      return { success: false, error: 'Initialization function returned false' }

    } catch (error) {
      console.error('❌ UserPreferencesService: Exception during default initialization:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Get system default preferences based on type
   */
  private getSystemDefaults(type: PreferenceType): any {
    const allDefaults = getDefaultPreferences()
    
    switch (type) {
      case 'grid':
        return allDefaults.grid
      case 'ribbon':
        return allDefaults.ribbon
      case 'general':
        return allDefaults.general
      case 'formatting':
        return allDefaults.formatting
      case 'view':
        return allDefaults.view
      case 'map':
        return allDefaults.map
      default:
        console.warn(`⚠️ UserPreferencesService: Unknown preference type: ${type}, returning empty object`)
        return {}
    }
  }

  /**
   * Background refresh from database
   */
  private async refreshFromDatabase(type: PreferenceType, tableName: string | undefined, userId: string): Promise<void> {
    try {
      const supabase = createClient()
      
      const query2 = supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('preference_type', type)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (tableName) {
        query2.eq('table_name', tableName)
      } else {
        query2.is('table_name', null)
      }
      
      const { data, error } = await query2.maybeSingle()

      if (!error && data) {
        const cacheKey = this.getCacheKey(type, tableName)
        await this.saveToLocalStorage(cacheKey, data.preferences)
      }
    } catch (error) {
      console.warn(`⚠️ UserPreferencesService: Background refresh failed for ${type}:`, error)
    }
  }

  /**
   * Background refresh with per-key throttling
   */
  private async refreshFromDatabaseThrottled(type: PreferenceType, tableName: string | undefined, userId: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(type, tableName)
      const now = Date.now()
      const last = this.lastBackgroundRefreshAt.get(cacheKey) || 0
      if (now - last < this.BACKGROUND_REFRESH_MIN_INTERVAL_MS) {
        return
      }
      this.lastBackgroundRefreshAt.set(cacheKey, now)
      await this.refreshFromDatabase(type, tableName, userId)
    } catch (error) {
      console.warn('Throttled background refresh error:', error)
    }
  }

  // ==========================================================================
  // PROJECT-SCOPED TABLE NAME UTILITIES
  // ==========================================================================

  /**
   * Get project-scoped table name for system tables
   * Uses the current project ID from the project store, unless an explicit
   * override is provided.
   */
  private getProjectScopedTableName(tableName?: string, projectIdOverride?: string): string | undefined {
    if (!tableName) return undefined
    
    try {
      // Import the utility function dynamically
      const { getProjectScopedTableName } = require('@/app/Projects/dataWorkbench/utils/systemTablePreferenceUtils')
      
      // Get current project ID from project store (unless overridden)
      const { useProjectStore } = require('@/app/Projects/dataWorkbench/stores/projectStore')
      const projectId = projectIdOverride || useProjectStore.getState().selectedProjectId
      
      if (!projectId) {
        console.error(`❌ [UserPreferencesService] CRITICAL: No project ID available for system table '${tableName}'. This will cause data loading issues.`)
        // For system tables without project ID, we need to fail gracefully
        // Return undefined to force the calling code to handle this case
        return undefined
      }
      
      const scopedName = getProjectScopedTableName(tableName, projectId)
      // Reduce log noise; only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 [UserPreferencesService] Scoped table name: "${tableName}" -> "${scopedName}" (projectId: ${projectId})`)
      }
      return scopedName
    } catch (error) {
      console.error(`❌ [UserPreferencesService] Failed to get project-scoped table name for ${tableName}:`, error)
      // Return undefined instead of tableName to indicate failure
      return undefined
    }
  }

  // ==========================================================================
  // SPECIFIC PREFERENCE GETTERS/SETTERS
  // ==========================================================================

  async getRibbonPreferences(tableName?: string): Promise<PreferenceResult<RibbonPreferences>> {
    return this.getPreferences<RibbonPreferences>('ribbon', tableName)
  }

  async saveRibbonPreferences(data: Partial<RibbonPreferences>, tableName?: string): Promise<PreferenceResult> {
    const current = await this.getRibbonPreferences(tableName)
    const updated = { ...getDefaultPreferences().ribbon, ...current.data, ...data }
    return this.savePreferences('ribbon', updated, tableName)
  }

  async getGridPreferences(tableName?: string, projectIdOverride?: string): Promise<PreferenceResult<GridPreferences>> {
    // ✅ FIX: Use project-scoped table name for system tables (with optional explicit override)
    const scopedTableName = this.getProjectScopedTableName(tableName, projectIdOverride)
    
    if (!scopedTableName) {
      // If we can't get a scoped table name (e.g., no project ID), return error
      console.error(`❌ [UserPreferencesService] Cannot get grid preferences for '${tableName}' - no project scoping available`)
      return {
        success: false,
        error: `No project ID available for system table '${tableName}'`
      }
    }
    
    return this.getPreferences<GridPreferences>('grid', scopedTableName)
  }

  async saveGridPreferences(data: Partial<GridPreferences>, tableName?: string, projectIdOverride?: string): Promise<PreferenceResult> {
    
    try {
      // ✅ FIX: Use project-scoped table name for system tables
      const scopedTableName = this.getProjectScopedTableName(tableName, projectIdOverride)
      
      if (!scopedTableName) {
        console.error(`❌ [UserPreferencesService] Cannot save grid preferences for '${tableName}' - no project scoping available`)
        return {
          success: false,
          error: `No project ID available for system table '${tableName}'`
        }
      }
      
      // 1. Get current preferences with error handling
      const current = await this.getGridPreferences(tableName, projectIdOverride)
      
      // 2. Start with complete defaults to ensure no properties are missing
      const defaults = getDefaultPreferences().grid
      
      // 3. Enhanced merge logic with proper typing and null safety
      const currentData = (current.data as GridPreferences) || {}
      
      // 4. 🔥 ENHANCED: Intelligent merge vs replace logic
      const updated: GridPreferences = this.mergeGridPreferencesIntelligently(defaults, currentData, data)

      // 4a. Change detection: skip save if no semantic differences
      if (this.gridPrefsEqual(currentData, updated)) {
        this.logDebug(`[UserPreferencesService] Skipping save for ${scopedTableName} (no changes detected)`)
        return { success: true }
      }
      
      // 5. Validate merged data integrity before saving
      if (!this.validateGridPreferences(updated)) {
        console.warn('⚠️ Grid preferences validation failed, attempting recovery...')
        // Attempt recovery by using defaults for invalid fields
        const recoveredPrefs = { ...defaults, ...data }
        const result = await this.savePreferences('grid', recoveredPrefs, scopedTableName)
        return result
      }
      
      // 6. Save with atomic operation
      // DEV logging for column arrays summary
      if (this.shouldLog('info')) {
        const sample = (arr: string[]) => (arr || []).slice(0, 6).join(', ')
        this.logInfo(`💿 [UserPreferencesService.saveGridPreferences] table=${scopedTableName}`, {
          columnOrderCount: (updated.columnOrder || []).length,
          columnOrderSample: sample(updated.columnOrder || []),
          hiddenColumnsCount: (updated.hiddenColumns || []).length,
          hiddenColumnsSample: sample(updated.hiddenColumns || [])
        })
      }
    const result = await this.savePreferences('grid', updated, scopedTableName)
    return result
      
    } catch (error) {
      console.error('❌ Error in saveGridPreferences:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save grid preferences'
      }
    }
  }

  /**
   * 🔥 ENHANCED: Grid preferences save with explicit replace mode control
   * Use this method when you need explicit control over merge vs replace behavior
   */
  async saveGridPreferencesEnhanced(
    data: Partial<GridPreferences>, 
    tableName?: string,
    projectIdOverride?: string,
    options: { replaceMode?: 'merge' | 'replace' } = {}
  ): Promise<PreferenceResult> {
    
    try {
      // ✅ FIX: Use project-scoped table name for system tables
      const scopedTableName = this.getProjectScopedTableName(tableName, projectIdOverride)
      
      const current = await this.getGridPreferences(tableName, projectIdOverride)
      const defaults = getDefaultPreferences().grid
      const currentData = (current.data as GridPreferences) || {}
      
      let updated: GridPreferences
      
      // Use explicit replace mode if provided, otherwise use intelligent detection
      const explicitReplaceMode = options.replaceMode
      if (explicitReplaceMode) {
        if (explicitReplaceMode === 'replace') {

          updated = {
            ...defaults,
            ...data,
            columnWidths: data.columnWidths !== undefined ? data.columnWidths : (currentData.columnWidths || defaults.columnWidths || {}),
            hiddenColumns: data.hiddenColumns !== undefined ? data.hiddenColumns : (currentData.hiddenColumns || defaults.hiddenColumns || []),
            columnOrder: data.columnOrder !== undefined ? data.columnOrder : (currentData.columnOrder || defaults.columnOrder || [])
          }
        } else {
          updated = this.mergeGridPreferencesIntelligently(defaults, currentData, data)
        }
      } else {
        // Use intelligent detection
        updated = this.mergeGridPreferencesIntelligently(defaults, currentData, data)
      }
      
      if (!this.validateGridPreferences(updated)) {
        console.warn('⚠️ Grid preferences validation failed, using safe defaults...')
        updated = { ...defaults, ...this.extractSafeGridProperties(data) }
      }
      
  const result = await this.savePreferences('grid', updated, scopedTableName)
  return result
      
    } catch (error) {
      console.error('❌ Error in saveGridPreferencesEnhanced:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save grid preferences'
      }
    }
  }

  /**
   * Append columns to the project's allowlist (grid.columnOrder) for a system table
   * and ensure the columns are not hidden. Intended for post-DDL flows (e.g., import-created columns).
   */
  async appendColumnsToAllowlist(
    tableName: string,
    projectId: string,
    columnsToAppend: string[]
  ): Promise<PreferenceResult> {
    try {
      if (!Array.isArray(columnsToAppend) || columnsToAppend.length === 0) {
        return { success: true }
      }

      const current = await this.getGridPreferences(tableName, projectId)
      const currentOrder = Array.isArray(current.data?.columnOrder) ? (current.data!.columnOrder as string[]) : []
      const nextOrder = [...currentOrder, ...columnsToAppend.filter(c => !currentOrder.includes(c))]
      const currentHidden = Array.isArray(current.data?.hiddenColumns) ? (current.data!.hiddenColumns as string[]) : []
      const nextHidden = currentHidden.filter(h => !columnsToAppend.includes(h))

      return this.saveGridPreferencesEnhanced(
        { columnOrder: nextOrder, hiddenColumns: nextHidden },
        tableName,
        projectId,
        { replaceMode: 'replace' }
      )
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to append columns to allowlist'
      }
    }
  }

  /**
   * Extract only safe properties from data for fallback scenarios
   */
  private extractSafeGridProperties(data: Partial<GridPreferences>): Partial<GridPreferences> {
    const safe: Partial<GridPreferences> = {}
    
    // Only include properties that are validated as safe
    const safeProps: (keyof GridPreferences)[] = [
      'showGridlines', 'showRowNumbers', 'autoFitColumns', 'showHeaders',
      'defaultRowHeight', 'frozenColumns', 'frozenRows'
    ]
    
    for (const prop of safeProps) {
      if (data[prop] !== undefined) {
        (safe as any)[prop] = data[prop]
      }
    }
    
    return safe
  }

  async getFormattingPreferences(tableName?: string): Promise<PreferenceResult<FormattingPreferences>> {
    return this.getPreferences<FormattingPreferences>('formatting', tableName)
  }

  async saveFormattingPreferences(data: Partial<FormattingPreferences>, tableName?: string): Promise<PreferenceResult> {
    const current = await this.getFormattingPreferences(tableName)
    const updated = { ...getDefaultPreferences().formatting, ...current.data, ...data }
    return this.savePreferences('formatting', updated, tableName)
  }

  async getViewPreferences(tableName?: string): Promise<PreferenceResult<ViewPreferences>> {
    return this.getPreferences<ViewPreferences>('view', tableName)
  }

  async saveViewPreferences(data: Partial<ViewPreferences>, tableName?: string): Promise<PreferenceResult> {
    const current = await this.getViewPreferences(tableName)
    const updated = { ...getDefaultPreferences().view, ...current.data, ...data }
    return this.savePreferences('view', updated, tableName)
  }

  async getGeneralPreferences(): Promise<PreferenceResult<GeneralPreferences>> {
    return this.getPreferences<GeneralPreferences>('general')
  }

  async saveGeneralPreferences(data: Partial<GeneralPreferences>): Promise<PreferenceResult> {
    const current = await this.getGeneralPreferences()
    const updated = { ...getDefaultPreferences().general, ...current.data, ...data }
    return this.savePreferences('general', updated)
  }

  async getMapPreferences(tableName?: string): Promise<PreferenceResult<MapPreferences>> {
    return this.getPreferences<MapPreferences>('map', tableName)
  }

  async saveMapPreferences(data: Partial<MapPreferences>, tableName?: string): Promise<PreferenceResult> {
    const current = await this.getMapPreferences(tableName)
    const updated = { ...getDefaultPreferences().map, ...current.data, ...data }
    return this.savePreferences('map', updated, tableName)
  }

  // ==========================================================================
  // EVENT MANAGEMENT
  // ==========================================================================

  addChangeListener(listener: PreferenceChangeListener): void {
    this.listeners.add(listener)
  }

  removeChangeListener(listener: PreferenceChangeListener): void {
    this.listeners.delete(listener)
  }

  private notifyListeners(event: PreferenceChangeEvent): void {
    const notifyKey = `${event.type}_${event.tableName || 'global'}`
    
    // 🚀 OPTIMIZATION: Batch notifications to prevent React re-render cascade
    this.pendingNotifications.set(notifyKey, event)
    
    // Clear existing notification timer
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer)
    }
    
    // Batch notifications - only notify once per microtask
    this.notificationTimer = setTimeout(() => {
      const notifyStartTime = performance.now()
      let listenerCount = 0
      let notificationCount = 0
      
      // Process all pending notifications at once
      for (const [key, notification] of this.pendingNotifications) {
        notificationCount++
        this.listeners.forEach(listener => {
          try {
            listenerCount++
            listener(notification)
          } catch (error) {
            console.error('Error in preference change listener:', error)
          }
        })
      }
      
      // Clear pending notifications
      this.pendingNotifications.clear()
      this.notificationTimer = null
      
      const notifyEndTime = performance.now()
      const notifyDuration = notifyEndTime - notifyStartTime
      
      if (notifyDuration > 5 || notificationCount > 1) {
      }
    }, 0) // Use setTimeout 0 to batch in next microtask
  }
  // ==========================================================================
  // PRIVATE METHODS - DATABASE OPERATIONS
  // ==========================================================================

  private async getFromDatabase(
    type: PreferenceType,
    tableName?: string
  ): Promise<PreferenceResult> {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
        return { success: false, error: 'User not authenticated' }
      }


      // Use the RPC function with proper typing
      const { data, error } = await supabase.rpc('get_user_preference', {
        p_user_id: user.id,
        p_preference_type: type,
        p_table_name: tableName || 'global'
      })

      

      if (error) {
        console.error('❌ Database get error:', error)
        return {
          success: false,
          error: error.message || 'Database error'
        }
      }

      if (!data || data.length === 0) {
       
        return { success: true, data: null }
      }

      const result = data[0]
      

      return {
        success: true,
        data: result.preferences,
        lastModified: result.updated_at
      }

    } catch (error) {
      console.error('Database get error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Database error'
      }
    }
  }

  private async saveToDatabase(
    type: PreferenceType,
    data: any,
    tableName?: string
  ): Promise<PreferenceResult> {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
        return { success: false, error: 'User not authenticated' }
      }

      // Log the size of data being sent to Supabase
      const dataSize = JSON.stringify(data).length
     
      // Use the RPC function with proper typing
      const { data: result, error } = await supabase.rpc('save_user_preference', {
        p_user_id: user.id,
        p_preference_type: type,
        p_table_name: tableName || 'global',
        p_preferences: data,
        p_version: 1
      })

      if (error) {
        console.error('Database save error:', error)
        throw error
      }

      if (result && result.length > 0 && !result[0].success) {
        return {
          success: false,
          error: result[0].message || 'Save failed'
        }
      }

      return { success: true }

    } catch (error) {
      console.error('Database save error:', error)
      
      // Add to sync queue if offline
      if (!this.isOnline) {
        await this.addToSyncQueue({
          id: `${type}-${tableName || 'global'}-${Date.now()}`,
          type,
          tableName,
          data,
          timestamp: new Date().toISOString(),
          operation: 'update'
        })
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Database error'
      }
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - LOCAL STORAGE OPERATIONS
  // ==========================================================================

  private async getFromLocalStorage(key: string): Promise<any> {
    try {
      if (typeof window === 'undefined') return null

      const stored = localStorage.getItem(`${STORAGE_KEYS.LOCAL_STORAGE}_${key}`)
      if (!stored) return null

      const parsed = JSON.parse(stored)
      
      // Check if data is too old
      if (Date.now() - parsed.timestamp > DEFAULTS.CACHE_TTL) {
        localStorage.removeItem(`${STORAGE_KEYS.LOCAL_STORAGE}_${key}`)
        return null
      }

      return parsed.data

    } catch (error) {
      console.warn('LocalStorage get error:', error)
      return null
    }
  }

  private async saveToLocalStorage(key: string, data: any): Promise<void> {
    const localStorageStartTime = performance.now()
    
    try {
      if (typeof window === 'undefined') return

      const toStore = {
        data,
        timestamp: Date.now()
      }

      const serialized = JSON.stringify(toStore)
      
      // Check size limit for localStorage
      if (serialized.length > DEFAULTS.LOCAL_STORAGE_LIMIT) {
        // Use IndexedDB for large data
        await this.indexedDB.set(key, data)
      } else {
        localStorage.setItem(`${STORAGE_KEYS.LOCAL_STORAGE}_${key}`, serialized)
      }

      const localStorageEndTime = performance.now()
      const localStorageDuration = localStorageEndTime - localStorageStartTime
      if (localStorageDuration > 5) { // Only log if it takes more than 5ms
      }

    } catch (error) {
      console.warn('LocalStorage save error:', error)
      // Fallback to IndexedDB
      try {
        await this.indexedDB.set(key, data)
      } catch (idbError) {
        console.warn('IndexedDB fallback failed:', idbError)
      }
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - CACHE MANAGEMENT
  // ==========================================================================

  private getCacheKey(type: PreferenceType, tableName?: string): string {
    return tableName ? `${type}_${tableName}` : `${type}_global`
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key)
    if (!cached) return null

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > DEFAULTS.CACHE_TTL) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  // ==========================================================================
  // PRIVATE METHODS - DEBOUNCING & SYNC
  // ==========================================================================

  /**
   * 🎯 TARGETED FIX: Determine if preference change is critical and needs immediate save
   * Critical changes include sorting, filtering, and other user interaction states
   */
  private isCriticalPreferenceChange(type: PreferenceType, data: any): boolean {
    // Always treat grid preferences as potentially critical
    if (type === 'grid') {
      // Check if any critical grid properties are being updated
      for (const property of this.CRITICAL_GRID_PROPERTIES) {
        if (Object.prototype.hasOwnProperty.call(data, property)) {
          console.log(`🚨 Critical grid preference change detected: ${property}`)
          return true
        }
      }
    }
    
    // Future: Add other critical preference types here
    // if (type === 'view' && data.hasOwnProperty('currentView')) return true
    
    return false
  }

  /**
   * 🎯 TARGETED FIX: Immediate save for critical preferences to prevent race conditions
   */
  private async immediateSave(
    type: PreferenceType,
    data: any,
    tableName?: string
  ): Promise<PreferenceResult> {
    const saveKey = this.getCacheKey(type, tableName)
    
    // Check if already saving this preference
    if (this.prioritySaveQueue.has(saveKey)) {
      console.log(`⚡ Priority save already in progress for ${saveKey}, waiting...`)
      return await this.prioritySaveQueue.get(saveKey)!
    }
    
    console.log(`🚨 IMMEDIATE SAVE: ${type}${tableName ? ` (${tableName})` : ''} - preventing race condition`)
    
    // Create save promise and add to queue
    const savePromise = this.saveToDatabase(type, data, tableName)
    this.prioritySaveQueue.set(saveKey, savePromise)
    
    try {
      const result = await savePromise
      
      // Clear any pending debounced save for this key since we just saved immediately
      const existingTimer = this.debounceTimers.get(saveKey)
      if (existingTimer) {
        clearTimeout(existingTimer)
        this.debounceTimers.delete(saveKey)
        console.log(`🧹 Cleared debounced save for ${saveKey} (immediate save completed)`)
      }
      
      return result
    } finally {
      // Clean up the priority save queue
      this.prioritySaveQueue.delete(saveKey)
    }
  }

  private debouncedSave(
    type: PreferenceType,
    data: any,
    tableName?: string,
    options: PreferenceSyncOptions = {}
  ): void {
    const key = this.getCacheKey(type, tableName)
    const debugId = `${type}_${tableName || 'global'}_${Date.now()}`
    
    // Clear existing timer to reset the 1-second countdown
    const existingTimer = this.debounceTimers.get(key)
    if (existingTimer) {
      console.log(`⏰ DEBOUNCE [${debugId}]: Cleared previous timer for ${key}`)
      clearTimeout(existingTimer)
    }

    // Set new timer - only executes 1 second after the last save attempt
    const timer = setTimeout(async () => {
      console.log(`💾 DB SAVE START [${debugId}]: Executing database save for ${type}`)
      const dbSaveStartTime = performance.now()
      
      await this.saveToDatabase(type, data, tableName)
      
      const dbSaveEndTime = performance.now()
      const dbSaveDuration = dbSaveEndTime - dbSaveStartTime
      console.log(`✅ DB SAVE COMPLETE [${debugId}]: Took ${dbSaveDuration.toFixed(1)}ms`)
      
      this.debounceTimers.delete(key)
    }, DEFAULTS.DEBOUNCE_DELAY)

    this.debounceTimers.set(key, timer)
    console.log(`⏱️ DEBOUNCE [${debugId}]: Set ${DEFAULTS.DEBOUNCE_DELAY}ms timer for ${key}`)
  }

  private async addToSyncQueue(change: OfflinePreferenceChange): Promise<void> {
    try {
      await this.indexedDB.addToSyncQueue(change)
    } catch (error) {
      console.warn('Failed to add to sync queue:', error)
    }
  }

  private async syncOfflineChanges(): Promise<void> {
    try {
      const queue = await this.indexedDB.getSyncQueue()
      
      for (const change of queue) {
        try {
          await this.saveToDatabase(change.type, change.data, change.tableName)
        } catch (error) {
          console.warn('Failed to sync change:', change.id, error)
        }
      }

      // Clear queue after successful sync
      await this.indexedDB.clearSyncQueue()

    } catch (error) {
      console.warn('Failed to sync offline changes:', error)
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - DEFAULTS
  // ==========================================================================

  private getDefaultsForType(type: PreferenceType): any {
    const defaults = getDefaultPreferences()
    return defaults[type]
  }

  // ==========================================================================
  // PUBLIC METHODS - UTILITY
  // ==========================================================================

  /**
   * Clear all cached preferences
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Clear specific cached preferences for manual refresh
   */
  private clearSpecificCache(type: PreferenceType, tableName?: string): void {
    const cacheKey = this.getCacheKey(type, tableName)
    
    // Clear from memory cache
    this.cache.delete(cacheKey)
    
    // Clear from localStorage  
    if (typeof window !== 'undefined') {
      const storageKey = `${STORAGE_KEYS.LOCAL_STORAGE}_${cacheKey}`
      localStorage.removeItem(storageKey)
    }
    
    console.log(`🧹 UserPreferencesService: Cache cleared for ${type}${tableName ? ` (${tableName})` : ''}`)
  }

  /**
   * 🎯 TARGETED FIX: Validate cache consistency for current user
   * Prevents 406 errors from stale user data in cache
   */
  private async validateCacheForCurrentUser(currentUserId: string): Promise<void> {
    try {
      // Check if we have a different user ID stored (indicating user switch)
      const lastUserId = this.lastValidatedUserId
      
      if (lastUserId && lastUserId !== currentUserId) {
        this.clearCache()
        
        // Clear localStorage cache for previous user
        if (typeof window !== 'undefined') {
          Object.keys(localStorage).forEach(key => {
            if (key.includes('userprefs') || key.includes('dataworkbench')) {
              try {
                localStorage.removeItem(key)
              } catch (error) {
                console.warn('Failed to clear localStorage key:', key, error)
              }
            }
          })
        }
      }
      
      // Update last validated user ID
      this.lastValidatedUserId = currentUserId
      
    } catch (error) {
      console.warn('Cache validation failed:', error)
      // Non-critical error, continue with request
    }
  }

  /**
   * 🎯 TARGETED FIX: Clear cache when user signs out (called by authUtils)
   */
  clearCacheOnUserSignOut(): void {
    this.clearCache()
    this.lastValidatedUserId = undefined
    
    // Clear any pending requests
    this.pendingRequests.clear()
    
    // Clear localStorage cache
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('userprefs') || key.includes('dataworkbench')) {
          try {
            localStorage.removeItem(key)
          } catch (error) {
            console.warn('Failed to clear localStorage key on sign-out:', key, error)
          }
        }
      })
    }
  }

  /**
   * Force sync all preferences from database
   */
  async forceSync(): Promise<PreferenceResult> {
    try {
      this.clearCache()
      // For now, skip syncing all preferences - just continue with current behavior
      // const result = await this.getPreferences('general')
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      }
    }
  }

  /**
   * Check if service is online
   */
  isServiceOnline(): boolean {
    return this.isOnline
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Save preferences with debouncing and caching
   * PHASE 2: Enhanced with inheritance cache management
   */
  async savePreferences(type: PreferenceType, data: any, tableName?: string): Promise<PreferenceResult> {
    try {
      // 🔍 DEBUG: Track save operations
      const debugId = `${type}_${tableName || 'global'}_${Date.now()}`
      console.log(`🔄 SAVE START [${debugId}]: ${type} for ${tableName || 'global'}`, {
        sortStates: data?.sortStates?.length || 0,
        hiddenColumns: data?.hiddenColumns?.length || 0,
        data: JSON.stringify(data).substring(0, 200) + '...'
      })

      // Cache immediately for responsive UI
      const cacheKey = this.getCacheKey(type, tableName)
      await this.saveToLocalStorage(cacheKey, data)
      console.log(`💾 CACHED [${debugId}]: Saved to localStorage`)

      // 🔥 PHASE 2: Clear inheritance cache when main table preferences change (right pane logic removed)
      if (tableName) {
        this.clearInheritanceCacheForTable(tableName)
      }

      // Debounced database save
      console.log(`⏳ DEBOUNCE [${debugId}]: Starting 1-second timer for database save`)
      this.debouncedSave(type, data, tableName)

      // Notify listeners
      this.notifyListeners({
        type,
        tableName,
        oldValue: null,
        newValue: data,
        source: 'local',
        timestamp: new Date().toISOString()
      })

      return { success: true }
    } catch (error) {
      console.error(`❌ Error in savePreferences for ${type}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save preferences'
      }
    }
  }

  /**
   * Get circuit breaker status for monitoring
   * PHASE 1: For debugging and user feedback
   */
  getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreaker)
  }

  /**
   * Get inheritance statistics for monitoring
   * PHASE 2: For debugging and performance tracking
   */
  getInheritanceStats(): { inheritanceCacheSize: number; inheritanceKeys: string[] } {
    const inheritanceKeys = Array.from(this.cache.keys()).filter(key => key.startsWith('inherited_'))
    return {
      inheritanceCacheSize: inheritanceKeys.length,
      inheritanceKeys
    }
  }

  /**
   * Clear cache when circuit breaker opens
   * PHASE 1: Prevent stale data during circuit breaker events
   * PHASE 2: Also clear inheritance cache
   */
  private async invalidateCacheForCircuitBreaker(key: string): Promise<void> {
    try {
      // Clear in-memory cache
      for (const [cacheKey, _] of this.cache) {
        if (cacheKey.includes(key) || cacheKey.startsWith('inherited_')) {
          this.cache.delete(cacheKey)
        }
      }

      // Clear localStorage cache
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const storageKey = localStorage.key(i)
          if (storageKey && storageKey.includes('userprefs') && storageKey.includes(key)) {
            keysToRemove.push(storageKey)
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k))
      }

    } catch (error) {
      console.warn('Cache invalidation failed:', error)
    }
  }

  /**
   * Clear inheritance cache when main table preferences change
   * PHASE 2: Ensure right pane gets updated preferences when main table changes
   */
  private clearInheritanceCacheForTable(tableName: string): void {
    try {
      const keysToRemove = Array.from(this.cache.keys()).filter(key => 
        key.includes(`inherited_`) && key.includes(`_${tableName}`)
      )
      
      keysToRemove.forEach(key => {
        this.cache.delete(key)

      })
      
      if (keysToRemove.length > 0) {
      }
    } catch (error) {
      console.warn('Failed to clear inheritance cache:', error)
    }
  }

  /**
   * Clear only inheritance cache entries
   * PHASE 3: Selective cache management
   */
  clearInheritanceCache(): void {
    try {
      const keysToRemove = Array.from(this.cache.keys()).filter(key => key.startsWith('inherited_'))
      
      keysToRemove.forEach(key => {
        this.cache.delete(key)
      })
      
    } catch (error) {
      console.warn('Failed to clear inheritance cache:', error)
    }
  }

  /**
   * Reset all circuit breakers
   * PHASE 3: Circuit breaker management
   */
  resetAllCircuitBreakers(): void {
    try {
      const resetCount = this.circuitBreaker.size
      this.circuitBreaker.clear()
    } catch (error) {
      console.warn('Failed to reset circuit breakers:', error)
    }
  }

  /**
   * Get comprehensive service health status
   * PHASE 3: Health monitoring
   */
  getServiceHealth(): {
    status: 'healthy' | 'degraded' | 'offline'
    details: {
      isOnline: boolean
      cacheSize: number
      inheritanceCacheSize: number
      activeCircuitBreakers: number
      totalCircuitBreakers: number
      lastError?: string
      uptime: number
    }
  } {
    try {
      const cacheStats = this.getCacheStats()
      const inheritanceStats = this.getInheritanceStats()
      const circuitBreakerStatus = this.getCircuitBreakerStatus()
      
      const activeBreakers = Array.from(circuitBreakerStatus.values()).filter(state => state.isOpen)
      const isOnline = this.isServiceOnline()
      
      let status: 'healthy' | 'degraded' | 'offline' = 'healthy'
      if (!isOnline) {
        status = 'offline'
      } else if (activeBreakers.length > 0) {
        status = 'degraded'
      }

      return {
        status,
        details: {
          isOnline,
          cacheSize: cacheStats.size,
          inheritanceCacheSize: inheritanceStats.inheritanceCacheSize,
          activeCircuitBreakers: activeBreakers.length,
          totalCircuitBreakers: circuitBreakerStatus.size,
          uptime: Date.now() - this.serviceStartTime
        }
      }
    } catch (error) {
      return {
        status: 'offline',
        details: {
          isOnline: false,
          cacheSize: 0,
          inheritanceCacheSize: 0,
          activeCircuitBreakers: 0,
          totalCircuitBreakers: 0,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          uptime: 0
        }
      }
    }
  }

  /**
   * 🔥 ENHANCED: Intelligent grid preferences merging
   * Handles both partial updates (merging) and complete replacement scenarios
   * Automatically detects when complete replacement is intended
   */
  private mergeGridPreferencesIntelligently(
    defaults: GridPreferences,
    currentData: GridPreferences,
    data: Partial<GridPreferences>
  ): GridPreferences {
    // Detect merge vs replace mode
    const replaceMode = this.detectGridReplaceMode(data, currentData)
    
    if (replaceMode === 'replace') {
      
      // COMPLETE REPLACEMENT: Use data as primary source, fill gaps with defaults
      return {
        ...defaults,
        ...data,
        // Ensure arrays and objects are completely replaced when provided
        columnWidths: data.columnWidths !== undefined ? data.columnWidths : (currentData.columnWidths || defaults.columnWidths || {}),
        hiddenColumns: data.hiddenColumns !== undefined ? data.hiddenColumns : (currentData.hiddenColumns || defaults.hiddenColumns || []),
        columnOrder: data.columnOrder !== undefined ? data.columnOrder : (currentData.columnOrder || defaults.columnOrder || [])
      }
      
    } else {
      
      // INTELLIGENT MERGING: Improved version of current behavior
      return {
        ...defaults,
        ...currentData,
        ...data,
        // Smart merging for columnWidths - respects column removal
        columnWidths: this.mergeColumnWidthsIntelligently(
          currentData.columnWidths || {},
          data.columnWidths || {},
          data.columnOrder || currentData.columnOrder || []
        ),
        // Arrays: replace if provided, otherwise keep current
        hiddenColumns: data.hiddenColumns !== undefined ? data.hiddenColumns : (currentData.hiddenColumns || defaults.hiddenColumns || []),
        columnOrder: data.columnOrder !== undefined ? data.columnOrder : (currentData.columnOrder || defaults.columnOrder || []),
        // Objects: replace if provided, otherwise keep current
        bandedRows: data.bandedRows !== undefined ? data.bandedRows : currentData.bandedRows,
        gridColor: data.gridColor !== undefined ? data.gridColor : currentData.gridColor
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Added helpers for change detection & structured logging (scoped addition)
  // ---------------------------------------------------------------------------
  private gridPrefsEqual(a: GridPreferences, b: GridPreferences): boolean {
    if (!a || !b) return false
    const arrayEqual = (x?: string[], y?: string[]) => {
      if (!x && !y) return true
      if (!x || !y) return false
      if (x.length !== y.length) return false
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false
      return true
    }
    const shallowObjEqual = (x: Record<string, unknown> = {}, y: Record<string, unknown> = {}) => {
      const kx = Object.keys(x); const ky = Object.keys(y)
      if (kx.length !== ky.length) return false
      for (const k of kx) if (x[k] !== y[k]) return false
      return true
    }
    return (
      arrayEqual(a.columnOrder, b.columnOrder) &&
      arrayEqual(a.hiddenColumns, b.hiddenColumns) &&
      shallowObjEqual(a.columnWidths as Record<string, unknown>, b.columnWidths as Record<string, unknown>) &&
      a.frozenColumns === b.frozenColumns &&
      a.frozenRows === b.frozenRows &&
      a.showGridlines === b.showGridlines &&
      a.showHeaders === b.showHeaders &&
      a.showRowNumbers === b.showRowNumbers &&
      a.autoFitColumns === b.autoFitColumns
    )
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const order: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 }
    const env = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info')).toLowerCase()
    const current = order[env] ?? 20
    return order[level] >= current
  }
  private logInfo(msg: string, meta?: unknown) { if (this.shouldLog('info')) console.log(msg, meta ?? '') }
  private logDebug(msg: string, meta?: unknown) { if (this.shouldLog('debug')) console.log(msg, meta ?? '') }

  /**
   * Detect whether this update should use merge or replace mode
   * Based on the completeness and type of data being updated
   */
  private detectGridReplaceMode(
    data: Partial<GridPreferences>, 
    currentData: GridPreferences
  ): 'merge' | 'replace' {
    // If data contains special replace signal
    if ((data as any).__replaceMode === 'replace') {
      return 'replace'
    }
    
    // If updating column order, likely a complete layout change
    if (data.columnOrder && data.columnOrder.length > 0) {
      return 'replace'
    }
    
    // If data contains many properties, likely a complete update
    const dataKeys = Object.keys(data)
    const significantProps = ['columnWidths', 'hiddenColumns', 'columnOrder', 'frozenColumns']
    const significantPropsInData = dataKeys.filter(key => significantProps.includes(key))
    
    if (significantPropsInData.length >= 2) {
      return 'replace'
    }
    
    // If columnWidths is being cleared (empty object), it's a replacement
    if (data.columnWidths && Object.keys(data.columnWidths).length === 0) {
      return 'replace'
    }
    
    // Default to merge for single property updates
    return 'merge'
  }

  /**
   * Smart column widths merging that respects column removal
   * Only keeps widths for columns that are still in the current column order
   */
  private mergeColumnWidthsIntelligently(
    currentWidths: Record<string, number>,
    newWidths: Record<string, number>,
    activeColumns: string[]
  ): Record<string, number> {
    // Start with new widths
    const merged = { ...newWidths }
    
    // Add current widths only for columns that are still active
    for (const [column, width] of Object.entries(currentWidths)) {
      // Only merge if column is still active and not overridden by new data
      if (activeColumns.length === 0 || activeColumns.includes(column)) {
        if (!(column in newWidths)) {
          merged[column] = width
        }
      }
      // If activeColumns is provided and column is not in it, the width is excluded (column removed)
    }
    
    return merged
  }

  /**
   * Validate grid preferences data integrity to prevent corruption
   */
  private validateGridPreferences(prefs: GridPreferences): boolean {
    try {
      // Basic type checks
      if (typeof prefs !== 'object' || prefs === null) return false
      
      // Required boolean fields with defaults
      const booleanFields = ['showGridlines', 'showRowNumbers', 'autoFitColumns', 'showHeaders']
      for (const field of booleanFields) {
        const value = prefs[field as keyof GridPreferences]
        if (value !== undefined && typeof value !== 'boolean') return false
      }
      
      // Required number fields with validation
      const numberFields = ['frozenColumns', 'frozenRows']
      for (const field of numberFields) {
        const value = prefs[field as keyof GridPreferences]
        if (value !== undefined && (typeof value !== 'number' || isNaN(value) || value < 0)) return false
      }
      
      // Array fields validation (only checking properties that exist in GridPreferences)
      if (prefs.hiddenColumns && !Array.isArray(prefs.hiddenColumns)) return false
      if (prefs.columnOrder && !Array.isArray(prefs.columnOrder)) return false
      
      // Object fields validation
      if (prefs.columnWidths && typeof prefs.columnWidths !== 'object') return false
      
      // Optional complex objects
      if (prefs.bandedRows && typeof prefs.bandedRows !== 'object') return false
      if (prefs.gridColor && typeof prefs.gridColor !== 'string') return false
      
      return true
    } catch {
      return false
    }
  }
}

// =============================================================================
// EXPORT DEFAULT INSTANCE
// =============================================================================

export const userPreferences = UserPreferencesService.getInstance()
