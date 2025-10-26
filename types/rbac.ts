import type { Database } from '@/lib/database.types';

// Import database types - NO DUPLICATION
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

// Role enumeration
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin', 
  DEVELOPER = 'developer',
  USER = 'user',
  CLIENT_VIEWER = 'client_viewer',
  GUEST = 'guest'
}

// Permission categories
export enum Permission {
  // System Administration
  MANAGE_USERS = 'manage_users',
  MANAGE_ROLES = 'manage_roles',
  SYSTEM_CONFIG = 'system_config',
  
  // User Invitation System (NEW)
  MANAGE_INVITATIONS = 'manage_invitations',
  SEND_USER_INVITATIONS = 'send_user_invitations',
  APPROVE_ACCESS_REQUESTS = 'approve_access_requests',
  VIEW_ACCESS_REQUESTS = 'view_access_requests',
  
  // Development Features
  PERFORMANCE_MONITORING = 'performance_monitoring',
  DEBUG_ACCESS = 'debug_access',
  DEVELOPMENT_TOOLS = 'development_tools',
  
  // Data Access
  READ_ALL_PROJECTS = 'read_all_projects',
  WRITE_ALL_PROJECTS = 'write_all_projects',
  DELETE_PROJECTS = 'delete_projects',
  
  // Table-specific permissions (dynamic)
  READ_USER_PROFILES = 'read_user_profiles',
  WRITE_USER_PROFILES = 'write_user_profiles',
  READ_DYNAMIC_TABLES = 'read_dynamic_tables',
  WRITE_DYNAMIC_TABLES = 'write_dynamic_tables',
  DELETE_DYNAMIC_TABLES = 'delete_dynamic_tables',
  READ_PERFORMANCE_DATA = 'read_performance_data',
  WRITE_PERFORMANCE_DATA = 'write_performance_data',
  
  // Client Features
  READ_ASSIGNED_PROJECTS = 'read_assigned_projects',
  WRITE_ASSIGNED_PROJECTS = 'write_assigned_projects',
  
  // Basic Features
  CREATE_PROJECT = 'create_project',
  READ_OWN_PROJECTS = 'read_own_projects',
  WRITE_OWN_PROJECTS = 'write_own_projects',
  
  // Advanced Features
  EXPORT_DATA = 'export_data',
  IMPORT_DATA = 'import_data',
  BACKUP_RESTORE = 'backup_restore',
  API_ACCESS = 'api_access'
}

// Permission categories for better organization
export const PERMISSION_CATEGORIES = {
  'System Administration': [
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
    Permission.SYSTEM_CONFIG
  ],
  'User Invitation System': [
    Permission.MANAGE_INVITATIONS,
    Permission.SEND_USER_INVITATIONS,
    Permission.APPROVE_ACCESS_REQUESTS,
    Permission.VIEW_ACCESS_REQUESTS
  ],
  'Development': [
    Permission.PERFORMANCE_MONITORING,
    Permission.DEBUG_ACCESS,
    Permission.DEVELOPMENT_TOOLS
  ],
  'Data Management': [
    Permission.READ_ALL_PROJECTS,
    Permission.WRITE_ALL_PROJECTS,
    Permission.DELETE_PROJECTS,
    Permission.READ_USER_PROFILES,
    Permission.WRITE_USER_PROFILES,
    Permission.READ_DYNAMIC_TABLES,
    Permission.WRITE_DYNAMIC_TABLES,
    Permission.DELETE_DYNAMIC_TABLES,
    Permission.READ_PERFORMANCE_DATA,
    Permission.WRITE_PERFORMANCE_DATA
  ],
  'Project Management': [
    Permission.CREATE_PROJECT,
    Permission.READ_OWN_PROJECTS,
    Permission.WRITE_OWN_PROJECTS,
    Permission.READ_ASSIGNED_PROJECTS,
    Permission.WRITE_ASSIGNED_PROJECTS
  ],
  'Advanced Features': [
    Permission.EXPORT_DATA,
    Permission.IMPORT_DATA,
    Permission.BACKUP_RESTORE,
    Permission.API_ACCESS
  ]
} as const;

// Role configuration interface
export interface RoleConfiguration {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean; // Cannot be deleted
  isActive: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

// Role-Permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // All permissions
    ...Object.values(Permission)
  ],
  
  [UserRole.ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
    Permission.READ_ALL_PROJECTS,
    Permission.WRITE_ALL_PROJECTS,
    Permission.DELETE_PROJECTS,
    Permission.CREATE_PROJECT,
    Permission.READ_OWN_PROJECTS,
    Permission.WRITE_OWN_PROJECTS
  ],
  
  [UserRole.DEVELOPER]: [
    Permission.PERFORMANCE_MONITORING,
    Permission.DEBUG_ACCESS,
    Permission.DEVELOPMENT_TOOLS,
    Permission.CREATE_PROJECT,
    Permission.READ_OWN_PROJECTS,
    Permission.WRITE_OWN_PROJECTS
  ],
  
  [UserRole.USER]: [
    Permission.CREATE_PROJECT,
    Permission.READ_OWN_PROJECTS,
    Permission.WRITE_OWN_PROJECTS
  ],
  
  [UserRole.CLIENT_VIEWER]: [
    Permission.READ_ASSIGNED_PROJECTS
  ],
  
  [UserRole.GUEST]: [
    // No permissions - trial access only
  ]
};

// Role metadata for UI display
export const ROLE_METADATA: Record<UserRole, {
  label: string;
  description: string;
  color: string;
  canBeAssignedBy: UserRole[];
}> = {
  [UserRole.SUPER_ADMIN]: {
    label: 'Super Administrator',
    description: 'Full system access and control',
    color: 'destructive',
    canBeAssignedBy: [UserRole.SUPER_ADMIN]
  },
  [UserRole.ADMIN]: {
    label: 'Administrator',
    description: 'User management and system administration',
    color: 'default',
    canBeAssignedBy: [UserRole.SUPER_ADMIN]
  },
  [UserRole.DEVELOPER]: {
    label: 'Developer',
    description: 'Development tools and performance monitoring',
    color: 'secondary',
    canBeAssignedBy: [UserRole.SUPER_ADMIN, UserRole.ADMIN]
  },
  [UserRole.USER]: {
    label: 'User',
    description: 'Standard application access',
    color: 'outline',
    canBeAssignedBy: [UserRole.SUPER_ADMIN, UserRole.ADMIN]
  },
  [UserRole.CLIENT_VIEWER]: {
    label: 'Client Viewer',
    description: 'Read-only access for clients',
    color: 'outline',
    canBeAssignedBy: [UserRole.SUPER_ADMIN, UserRole.ADMIN]
  },
  [UserRole.GUEST]: {
    label: 'Guest',
    description: 'Limited trial access',
    color: 'outline',
    canBeAssignedBy: [UserRole.SUPER_ADMIN, UserRole.ADMIN]
  }
};

// Helper constants for backward compatibility
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: ROLE_METADATA[UserRole.SUPER_ADMIN].label,
  [UserRole.ADMIN]: ROLE_METADATA[UserRole.ADMIN].label,
  [UserRole.DEVELOPER]: ROLE_METADATA[UserRole.DEVELOPER].label,
  [UserRole.USER]: ROLE_METADATA[UserRole.USER].label,
  [UserRole.CLIENT_VIEWER]: ROLE_METADATA[UserRole.CLIENT_VIEWER].label,
  [UserRole.GUEST]: ROLE_METADATA[UserRole.GUEST].label
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: ROLE_METADATA[UserRole.SUPER_ADMIN].description,
  [UserRole.ADMIN]: ROLE_METADATA[UserRole.ADMIN].description,
  [UserRole.DEVELOPER]: ROLE_METADATA[UserRole.DEVELOPER].description,
  [UserRole.USER]: ROLE_METADATA[UserRole.USER].description,
  [UserRole.CLIENT_VIEWER]: ROLE_METADATA[UserRole.CLIENT_VIEWER].description,
  [UserRole.GUEST]: ROLE_METADATA[UserRole.GUEST].description
};

// Authorization context
export interface AuthContext {
  user: UserProfile | null;
  permissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isLoading: boolean;
}

// Role check utilities
export interface RoleCheckResult {
  authorized: boolean;
  message?: string;
  requiredRole?: UserRole[];
  requiredPermission?: Permission[];
}

// Audit log types
export interface RoleAuditLog {
  id: string;
  user_id: string;
  target_user_id: string;
  old_role: string | null;
  new_role: string;
  changed_at: string;
  changed_by_email: string | null;
  reason: string | null;
}

// Role change request
export interface RoleChangeRequest {
  targetUserId: string;
  newRole: UserRole;
  reason?: string;
}
