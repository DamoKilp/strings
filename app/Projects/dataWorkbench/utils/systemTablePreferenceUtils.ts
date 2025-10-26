/**
 * System Table Preference Utilities
 * 
 * Provides project-scoped preference keys for system tables to ensure
 * that different projects can have different column preferences for the same system table.
 */

// System table names (canonical roles)
const SYSTEM_TABLE_NAMES = ['components', 'asset_register', 'maintenance_plan', 'asset_condition_history', 'reactive_maintenance'] as const;

/**
 * Check if a table name represents a system table
 * This is a pure function that can be safely used in client components.
 */
export function isSystemTable(tableName: string): boolean {
  if (!tableName || typeof tableName !== 'string') {
    return false;
  }
  
  const normalizedName = tableName.toLowerCase().trim();
  const name = normalizedName.includes('.') ? normalizedName.split('.').pop()! : normalizedName;
  
  return SYSTEM_TABLE_NAMES.includes(name as any);
}

/**
 * Generate a project-scoped preference key for system tables
 * For system tables: returns "tableName_projectId"
 * For regular tables: returns "tableName" (unchanged)
 */
export function getProjectScopedTableName(tableName: string, projectId?: string | null): string {
  // Check if this is a system table
  if (isSystemTable(tableName)) {
    if (projectId && projectId.trim() !== '') {
      return `${tableName}_${projectId.trim()}`
    }
    // If no project ID provided for system table, use original name
    // This will cause issues but maintains backward compatibility
    console.warn(`[SystemTablePreferenceUtils] System table '${tableName}' accessed without project ID. Preferences may be shared across projects.`)
    return tableName
  }
  
  // For non-system tables, return original name
  return tableName
}

/**
 * Extract the original table name from a project-scoped preference key
 * Handles both project-scoped system tables and regular tables
 */
export function extractOriginalTableName(scopedTableName: string): string {
  // Check if this looks like a project-scoped system table name
  // Format: "tableName_projectId" where projectId is a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  
  // Try to find a UUID at the end of the string
  const parts = scopedTableName.split('_')
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1]
    if (uuidRegex.test(lastPart)) {
      // This looks like a project-scoped system table
      return parts.slice(0, -1).join('_')
    }
  }
  
  // Not a project-scoped name, return as-is
  return scopedTableName
}

/**
 * Check if a table name is project-scoped
 */
export function isProjectScopedTableName(tableName: string): boolean {
  return tableName !== extractOriginalTableName(tableName)
}

/**
 * Get the project ID from a project-scoped table name
 * Returns null if not a project-scoped name
 */
export function getProjectIdFromScopedTableName(scopedTableName: string): string | null {
  const originalName = extractOriginalTableName(scopedTableName)
  if (originalName === scopedTableName) {
    return null
  }
  
  // Extract the project ID (last part after the last underscore)
  const parts = scopedTableName.split('_')
  return parts[parts.length - 1] || null
}
