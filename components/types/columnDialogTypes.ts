/**
 * Column Dialog Types
 * Created: July 8, 2025
 * 
 * Dialog-specific type definitions for the Add Column Dialog system.
 * These types extend the canonical types for UI-specific needs without duplication.
 * 
 * Key Features:
 * - Props interfaces for dialog components
 * - Form state management types
 * - Validation state tracking
 * - Type-safe dialog interactions
 * - UI-specific extensions without breaking canonical types
 */

// ✅ Import from canonical sources - NO DUPLICATION
import type { ColumnDefinition } from '../../../../types/DynamicTable';
import type { GridColumnDefinition } from '../../../../app/Projects/dataWorkbench/types/gridTypes';
import type { ValidationResult } from '../services/ColumnValidationService';

/**
 * Props for the main AddRegularColumnDialog component
 */
export interface AddRegularColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (column: ColumnDefinition) => Promise<void>;
  existingColumns: ColumnDefinition[];
  tableName: string;
  projectId?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onRefresh?: () => Promise<void>; // ✅ NEW: Optional refresh callback for parent components
}

/**
 * Form state for column creation with UI-specific properties
 */
export interface ColumnFormState {
  // Core column properties
  displayName: string;
  internalName: string;
  type: ColumnDefinition['type'];
  nullable: boolean;
  defaultValue: string | number | boolean | null;
  
  // Optional database constraints
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  
  // Type-specific properties for UI
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  precision?: number; // For decimal types
  scale?: number; // For decimal types
  
  // UI-specific metadata
  helpText?: string;
  placeholder?: string;
  allowedValues?: any[]; // For enum-like behavior
}

/**
 * Validation state for all form fields
 */
export interface ValidationState {
  displayName: ValidationResult;
  internalName: ValidationResult;
  type: ValidationResult;
  defaultValue: ValidationResult;
  typeSpecificFields: Record<string, ValidationResult>;
  overall: ValidationResult;
}

/**
 * Dialog step/section state for multi-step UI
 */
export interface DialogStepState {
  currentStep: 'identity' | 'configuration' | 'preview';
  completedSteps: Set<string>;
  canProceed: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
}

/**
 * Props for dialog sections/steps
 */
export interface ColumnIdentitySectionProps {
  formState: ColumnFormState;
  validationState: ValidationState;
  existingColumns: ColumnDefinition[];
  onChange: (updates: Partial<ColumnFormState>) => void;
  onValidationChange: (field: keyof ValidationState, result: ValidationResult) => void;
  disabled?: boolean;
}

export interface BasicConfigurationSectionProps {
  formState: ColumnFormState;
  validationState: ValidationState;
  onChange: (updates: Partial<ColumnFormState>) => void;
  onValidationChange: (field: keyof ValidationState, result: ValidationResult) => void;
  disabled?: boolean;
}

export interface TypeSpecificSectionProps {
  formState: ColumnFormState;
  validationState: ValidationState;
  onChange: (updates: Partial<ColumnFormState>) => void;
  onValidationChange: (field: keyof ValidationState, result: ValidationResult) => void;
  disabled?: boolean;
}

export interface ColumnPreviewSectionProps {
  formState: ColumnFormState;
  validationState: ValidationState;
  tableName: string;
  existingColumns: ColumnDefinition[];
  onEdit: (step: DialogStepState['currentStep']) => void;
}

/**
 * Props for reusable input components
 */
export interface ValidatedInputProps {
  label: string;
  value: string | number;
  onChange: (value: string | number) => void;
  validation?: ValidationResult;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  type?: 'text' | 'number' | 'email' | 'url' | 'password';
  autoComplete?: string;
  debounceMs?: number;
}

export interface ValidatedSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; description?: string; disabled?: boolean }>;
  validation?: ValidationResult;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
}

export interface ValidatedTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  validation?: ValidationResult;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  showCounter?: boolean;
}

export interface ValidatedCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  validation?: ValidationResult;
  helpText?: string;
  disabled?: boolean;
  indeterminate?: boolean;
}

/**
 * Dialog action handlers and callbacks
 */
export interface DialogActionHandlers {
  onSave: () => Promise<void>;
  onCancel: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onStepChange: (step: DialogStepState['currentStep']) => void;
  onFieldChange: <K extends keyof ColumnFormState>(field: K, value: ColumnFormState[K]) => void;
  onValidationChange: (field: keyof ValidationState, result: ValidationResult) => void;
  onReset: () => void;
}

/**
 * Dialog configuration and behavior options
 */
export interface DialogConfig {
  enableStepNavigation: boolean;
  enablePreview: boolean;
  enableAdvancedOptions: boolean;
  enableTypeSpecificValidation: boolean;
  enableRealTimeValidation: boolean;
  debounceDelay: number;
  autoSaveOnChange: boolean;
  confirmOnCancel: boolean;
  showProgressIndicator: boolean;
  compactMode: boolean;
}

/**
 * Default dialog configuration
 */
export const DEFAULT_DIALOG_CONFIG: DialogConfig = {
  enableStepNavigation: true,
  enablePreview: true,
  enableAdvancedOptions: true,
  enableTypeSpecificValidation: true,
  enableRealTimeValidation: true,
  debounceDelay: 300,
  autoSaveOnChange: false,
  confirmOnCancel: true,
  showProgressIndicator: true,
  compactMode: false
};

/**
 * Dialog state management for complex interactions
 */
export interface DialogState {
  isOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  currentStep: DialogStepState['currentStep'];
  formState: ColumnFormState;
  validationState: ValidationState;
  stepState: DialogStepState;
  config: DialogConfig;
  error?: string;
  successMessage?: string;
}

/**
 * Dialog context for provider pattern
 */
export interface DialogContextValue {
  state: DialogState;
  actions: DialogActionHandlers;
  utils: {
    isFieldValid: (field: keyof ValidationState) => boolean;
    hasErrors: () => boolean;
    hasWarnings: () => boolean;
    canSave: () => boolean;
    canProceedToNextStep: () => boolean;
    getStepValidation: (step: DialogStepState['currentStep']) => ValidationResult;
    resetToDefaults: () => void;
    previewColumn: () => ColumnDefinition;
  };
}

/**
 * Type guard utilities for runtime type checking
 */
export const DialogTypeGuards = {
  isValidColumnType: (type: any): type is ColumnDefinition['type'] => {
    const validTypes: ColumnDefinition['type'][] = [
      'text', 'integer', 'decimal', 'boolean', 'date', 'timestamp', 'uuid'
    ];
    return typeof type === 'string' && validTypes.includes(type as ColumnDefinition['type']);
  },

  isValidFormState: (state: any): state is ColumnFormState => {
    return (
      typeof state === 'object' &&
      state !== null &&
      typeof state.displayName === 'string' &&
      typeof state.internalName === 'string' &&
      DialogTypeGuards.isValidColumnType(state.type) &&
      typeof state.nullable === 'boolean'
    );
  },

  isValidValidationResult: (result: any): result is ValidationResult => {
    return (
      typeof result === 'object' &&
      result !== null &&
      typeof result.isValid === 'boolean'
    );
  }
};

/**
 * Form state factory functions
 */
export const FormStateFactory = {
  createEmpty: (): ColumnFormState => ({
    displayName: '',
    internalName: '',
    type: 'text',
    nullable: true,
    defaultValue: null
  }),

  createFromColumn: (column: ColumnDefinition): ColumnFormState => ({
    displayName: column.display_name || column.name,
    internalName: column.name,
    type: column.type,
    nullable: column.nullable,
    defaultValue: column.defaultValue || null,
    isPrimaryKey: column.isPrimaryKey,
    isUnique: column.isUnique
  }),

  createFromGridColumn: (column: GridColumnDefinition): ColumnFormState => ({
    displayName: column.display_name || column.name,
    internalName: column.name,
    type: column.type,
    nullable: column.nullable,
    defaultValue: column.defaultValue || null,
    isPrimaryKey: column.isPrimaryKey,
    isUnique: column.isUnique,
    maxLength: column.maxLength,
    minLength: column.minLength,
    pattern: column.pattern,
    min: column.min,
    max: column.max
  })
};

/**
 * Validation state factory functions
 */
export const ValidationStateFactory = {
  createEmpty: (): ValidationState => ({
    displayName: { isValid: true },
    internalName: { isValid: true },
    type: { isValid: true },
    defaultValue: { isValid: true },
    typeSpecificFields: {},
    overall: { isValid: false } // Start as invalid until user enters data
  }),

  createFromResults: (results: Partial<Record<keyof ValidationState, ValidationResult>>): ValidationState => {
    const base = ValidationStateFactory.createEmpty();
    const { typeSpecificFields, ...otherResults } = results;
    
    return {
      ...base,
      ...otherResults,
      typeSpecificFields: (typeSpecificFields && typeof typeSpecificFields === 'object' && 'isValid' in typeSpecificFields) 
        ? {} // If typeSpecificFields is a ValidationResult, default to empty
        : typeSpecificFields || {},
      overall: {
        isValid: Object.values(results).every(result => result?.isValid !== false),
        severity: Object.values(results).some(result => result?.severity === 'error') ? 'error' :
                 Object.values(results).some(result => result?.severity === 'warning') ? 'warning' : 'info'
      }
    };
  }
};

/**
 * Dialog step management utilities
 */
export const DialogStepUtils = {
  getStepOrder: (): DialogStepState['currentStep'][] => [
    'identity',
    'configuration', 
    'preview'
  ],

  getNextStep: (current: DialogStepState['currentStep']): DialogStepState['currentStep'] | null => {
    const steps = DialogStepUtils.getStepOrder();
    const currentIndex = steps.indexOf(current);
    return currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null;
  },

  getPreviousStep: (current: DialogStepState['currentStep']): DialogStepState['currentStep'] | null => {
    const steps = DialogStepUtils.getStepOrder();
    const currentIndex = steps.indexOf(current);
    return currentIndex > 0 ? steps[currentIndex - 1] : null;
  },

  isStepComplete: (step: DialogStepState['currentStep'], validationState: ValidationState): boolean => {
    switch (step) {
      case 'identity':
        return validationState.displayName.isValid && 
               validationState.internalName.isValid && 
               validationState.type.isValid;
      case 'configuration':
        return validationState.defaultValue.isValid;
      case 'preview':
        return validationState.overall.isValid;
      default:
        return false;
    }
  },

  getStepTitle: (step: DialogStepState['currentStep']): string => {
    switch (step) {
      case 'identity':
        return 'Column Identity';
      case 'configuration':
        return 'Basic Configuration';
      case 'preview':
        return 'Review & Create';
      default:
        return 'Unknown Step';
    }
  },

  getStepDescription: (step: DialogStepState['currentStep']): string => {
    switch (step) {
      case 'identity':
        return 'Set the column name and data type';
      case 'configuration':
        return 'Configure null values and defaults';
      case 'preview':
        return 'Review your column configuration';
      default:
        return '';
    }
  }
};

/**
 * Column transformation utilities for dialog interaction
 */
export const ColumnTransformUtils = {
  formStateToColumnDefinition: (formState: ColumnFormState): ColumnDefinition => ({
    name: formState.internalName,
    display_name: formState.displayName,
    type: formState.type,
    nullable: formState.nullable,
    defaultValue: formState.defaultValue,
    isPrimaryKey: formState.isPrimaryKey,
    isUnique: formState.isUnique
  }),

  columnDefinitionToFormState: (column: ColumnDefinition): ColumnFormState => ({
    displayName: column.display_name || column.name,
    internalName: column.name,
    type: column.type,
    nullable: column.nullable,
    defaultValue: column.defaultValue || null,
    isPrimaryKey: column.isPrimaryKey,
    isUnique: column.isUnique
  }),

  validateFormStateTransformation: (formState: ColumnFormState): ValidationResult => {
    const errors: string[] = [];

    if (!formState.displayName?.trim()) {
      errors.push('Display name is required');
    }

    if (!formState.internalName?.trim()) {
      errors.push('Internal name is required');
    }

    if (!formState.type) {
      errors.push('Column type is required');
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      severity: errors.length > 0 ? 'error' : 'info'
    };
  }
};

/**
 * Event handler type definitions for form interactions
 */
export interface DialogFormEvents {
  onFieldFocus: (field: keyof ColumnFormState) => void;
  onFieldBlur: (field: keyof ColumnFormState) => void;
  onFieldChange: <K extends keyof ColumnFormState>(field: K, value: ColumnFormState[K]) => void;
  onValidationChange: (field: keyof ValidationState, result: ValidationResult) => void;
  onStepChange: (step: DialogStepState['currentStep']) => void;
  onFormSubmit: (formState: ColumnFormState) => Promise<void>;
  onFormReset: () => void;
  onFormCancel: () => void;
}

/**
 * Accessibility and keyboard navigation support
 */
export interface DialogAccessibilityProps {
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  role?: string;
  tabIndex?: number;
}

/**
 * Theme and styling configuration
 */
export interface DialogThemeConfig {
  size: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  variant: 'default' | 'compact' | 'expanded';
  colorScheme: 'blue' | 'gray' | 'green' | 'purple';
  animation: 'none' | 'fade' | 'slide' | 'scale';
  showBackdrop: boolean;
  closeOnBackdropClick: boolean;
  closeOnEscape: boolean;
}

export const DEFAULT_THEME_CONFIG: DialogThemeConfig = {
  size: 'lg',
  variant: 'default',
  colorScheme: 'blue',
  animation: 'fade',
  showBackdrop: true,
  closeOnBackdropClick: false,
  closeOnEscape: true
};

// =============================================================================
// IMAGE COLUMN DIALOG TYPES (Phase 5A - Minimal Implementation)
// =============================================================================

/**
 * Props for the AddImageColumnDialog component
 */
export interface AddImageColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (column: ColumnDefinition) => Promise<void>; // Note: ColumnDefinition, not ImageColumnDefinition
  existingColumns: ColumnDefinition[];
  tableName: string;
  projectId?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onRefresh?: () => Promise<void>; // Optional refresh callback for parent components
}

/**
 * Form state for image column creation (no inheritance - standalone interface)
 */
export interface ImageColumnFormState {
  // Core fields (from ColumnFormState - essential only)
  displayName: string;
  internalName: string;
  type: 'text'; // Note: Stored as text, but treated as image in UI
  nullable: boolean;
  
  // Essential image fields only (from existing ImageColumnDefinition)
  allowUpload: boolean;
  maxFileSize: number; // in bytes
  allowedTypes: string[]; // MIME types like ['image/jpeg', 'image/png', 'image/webp']
  thumbnailSize: { width: number; height: number };
  compressionQuality: number; // 0-100
}

/**
 * Validation state for image column form fields
 */
export interface ImageColumnValidationState {
  displayName: ValidationResult;
  internalName: ValidationResult;
  maxFileSize: ValidationResult;
  allowedTypes: ValidationResult;
  thumbnailSize: ValidationResult;
  compressionQuality: ValidationResult;
  overall: ValidationResult;
}
